import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import {
  refreshStreamTokenAPI,
  endStreamAPI,
  viewerHeartbeatAPI,
  viewerLeaveAPI,
  getViewerCountAPI,
} from "@/services/LiveStreamApi";

const VIEWER_HEARTBEAT_INTERVAL_MS = 20_000;
const VIEWER_COUNT_POLL_INTERVAL_MS = 8_000;

// Agora is lazy-loaded to avoid crash in Expo Go or when native module isn't linked
let _agora = null;
function getAgora() {
  if (!_agora) {
    _agora = require("react-native-agora");
  }
  return _agora;
}

const LiveStreamContext = createContext(null);

export function useLiveStream() {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) throw new Error("useLiveStream must be inside LiveStreamProvider");
  return ctx;
}

export function LiveStreamProvider({ children }) {
  const [streamState, setStreamState] = useState(null);
  // streamState shape: { streamData, roomName, gameId, mode, remoteUid, isMinimized }

  const engineRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxAutoReconnectAttempts = 3;

  // Viewer presence + viewer-count polling
  const heartbeatTimerRef = useRef(null);
  const viewerPollTimerRef = useRef(null);
  const activeRoomRef = useRef(null);
  const activeModeRef = useRef(null);

  const stopViewerTrackers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (viewerPollTimerRef.current) {
      clearInterval(viewerPollTimerRef.current);
      viewerPollTimerRef.current = null;
    }
  }, []);

  const startViewerTrackers = useCallback((roomName, mode) => {
    stopViewerTrackers();
    if (!roomName) return;

    activeRoomRef.current = roomName;
    activeModeRef.current = mode;

    const pollCount = async () => {
      try {
        const data = await getViewerCountAPI(roomName);
        setStreamState((prev) =>
          prev && prev.roomName === roomName
            ? { ...prev, viewerCount: Number(data?.viewerCount) || 0 }
            : prev,
        );
      } catch {}
    };

    const sendHeartbeat = async () => {
      try {
        const data = await viewerHeartbeatAPI(roomName);
        if (typeof data?.viewerCount === "number") {
          setStreamState((prev) =>
            prev && prev.roomName === roomName
              ? { ...prev, viewerCount: data.viewerCount }
              : prev,
          );
        }
      } catch {}
    };

    // Viewers send heartbeats; broadcasters only poll
    if (mode === "viewer") {
      sendHeartbeat();
      heartbeatTimerRef.current = setInterval(sendHeartbeat, VIEWER_HEARTBEAT_INTERVAL_MS);
    }

    pollCount();
    viewerPollTimerRef.current = setInterval(pollCount, VIEWER_COUNT_POLL_INTERVAL_MS);
  }, [stopViewerTrackers]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const resetReconnectState = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    clearReconnectTimer();
  }, [clearReconnectTimer]);

  const handleJoinSuccess = useCallback(() => {
    const hadReconnectAttempt = reconnectAttemptsRef.current > 0;
    resetReconnectState();
    setStreamState((prev) =>
      prev
        ? {
            ...prev,
            isReconnecting: false,
            reconnectAttempt: 0,
            error: null,
            lastReconnectSuccessAt: hadReconnectAttempt ? Date.now() : prev.lastReconnectSuccessAt,
          }
        : prev,
    );
  }, [resetReconnectState]);

  const startStream = useCallback(
    ({ streamData, roomName, gameId, mode }) => {
      // Tear down any existing engine first
      try {
        engineRef.current?.leaveChannel();
        engineRef.current?.release();
      } catch {}
      engineRef.current = null;
      clearReconnectTimer();

      const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = getAgora();
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      const scheduleAutoReconnect = () => {
        if (reconnectAttemptsRef.current >= maxAutoReconnectAttempts) {
          setStreamState((prev) =>
            prev
              ? {
                  ...prev,
                  isReconnecting: false,
                  error:
                    prev.error ||
                    "Network issue detected. Tap Reconnect Stream to retry.",
                }
              : prev,
          );
          return;
        }
        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;
        const delayMs = nextAttempt === 1 ? 1500 : nextAttempt === 2 ? 3000 : 5000;
        setStreamState((prev) =>
          prev
            ? {
                ...prev,
                isReconnecting: true,
                reconnectAttempt: nextAttempt,
                reconnectMax: maxAutoReconnectAttempts,
              }
            : prev,
        );
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(async () => {
          try {
            const refreshed = await refreshStreamTokenAPI(
              roomName,
              mode === "broadcaster" ? "publisher" : "subscriber",
            );
            startStream({
              streamData: refreshed,
              roomName: refreshed.channelName || roomName,
              gameId,
              mode,
            });
          } catch {
            scheduleAutoReconnect();
          }
        }, delayMs);
      };

      engine.initialize({
        appId: streamData.appId,
        logConfig: { level: 0x0001 },
      });
      engine.setChannelProfile(
        ChannelProfileType.ChannelProfileLiveBroadcasting,
      );

      if (mode === "broadcaster") {
        engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        engine.enableVideo();
        engine.enableAudio();
        engine.startPreview();

        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            handleJoinSuccess();
          },
          onError: (err) => {
            setStreamState((prev) =>
              prev ? { ...prev, error: `Agora error ${err}` } : prev,
            );
            scheduleAutoReconnect();
          },
          onTokenPrivilegeWillExpire: async () => {
            try {
              engine.renewToken(
                (await refreshStreamTokenAPI(roomName, "publisher")).token,
              );
            } catch {}
          },
        });

        engine.joinChannel(
          streamData.token,
          streamData.channelName,
          streamData.uid,
          { publishCameraTrack: true, publishMicrophoneTrack: true },
        );
      } else {
        engine.setClientRole(ClientRoleType.ClientRoleAudience);
        engine.enableVideo();

        engine.registerEventHandler({
          onUserJoined: (_c, uid) =>
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    remoteUid: prev.remoteUid ?? uid,
                  }
                : prev,
            ),
          onJoinChannelSuccess: () => {
            handleJoinSuccess();
          },
          onUserOffline: (_c, uid) =>
            setStreamState((prev) =>
              prev
                ? {
                    ...prev,
                    remoteUid: prev.remoteUid === uid ? null : prev.remoteUid,
                  }
                : prev,
            ),
          onError: (err) => {
            setStreamState((prev) =>
              prev ? { ...prev, error: `Agora error ${err}` } : prev,
            );
            scheduleAutoReconnect();
          },
          onTokenPrivilegeWillExpire: async () => {
            try {
              engine.renewToken(
                (await refreshStreamTokenAPI(roomName, "subscriber")).token,
              );
            } catch {}
          },
        });

        engine.joinChannel(
          streamData.token,
          streamData.channelName,
          streamData.uid,
          { autoSubscribeAudio: true, autoSubscribeVideo: true },
        );
      }

      setStreamState({
        streamData,
        roomName,
        gameId,
        mode,
        remoteUid: null,
        isMinimized: false,
        viewerCount: 0,
        error: null,
        isMuted: false,
        isReconnecting: false,
        reconnectAttempt: 0,
        reconnectMax: maxAutoReconnectAttempts,
        lastReconnectSuccessAt: null,
      });

      // Hotstar-style backend viewer count: heartbeat from viewers, poll for everyone
      startViewerTrackers(roomName, mode);
    },
    [clearReconnectTimer, resetReconnectState, handleJoinSuccess, startViewerTrackers],
  );

  const minimize = useCallback(() => {
    setStreamState((prev) => (prev ? { ...prev, isMinimized: true } : prev));
  }, []);

  const maximize = useCallback(() => {
    setStreamState((prev) => (prev ? { ...prev, isMinimized: false } : prev));
  }, []);

  const endStream = useCallback(async () => {
    const state = streamState;
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;

    // Stop heartbeat / count polling and tell backend we're leaving
    stopViewerTrackers();
    const leftRoom = activeRoomRef.current;
    const leftMode = activeModeRef.current;
    activeRoomRef.current = null;
    activeModeRef.current = null;
    if (leftMode === "viewer" && leftRoom) {
      try { await viewerLeaveAPI(leftRoom); } catch {}
    }

    try {
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
    } catch {}
    engineRef.current = null;

    if (state?.mode === "broadcaster" && state?.roomName) {
      try {
        await endStreamAPI(state.roomName);
      } catch {}
    }

    setStreamState(null);
  }, [streamState, clearReconnectTimer, stopViewerTrackers]);

  const reconnectStream = useCallback(async () => {
    if (!streamState) return;
    setStreamState((prev) =>
      prev
        ? { ...prev, isReconnecting: true, error: null, reconnectAttempt: 0 }
        : prev,
    );
    reconnectAttemptsRef.current = 0;
    clearReconnectTimer();
    try {
      const refreshed = await refreshStreamTokenAPI(
        streamState.roomName,
        streamState.mode === "broadcaster" ? "publisher" : "subscriber",
      );
      startStream({
        streamData: refreshed,
        roomName: refreshed.channelName || streamState.roomName,
        gameId: streamState.gameId,
        mode: streamState.mode,
      });
    } catch (err) {
      setStreamState((prev) =>
        prev
          ? {
              ...prev,
              isReconnecting: false,
              error: err?.response?.data?.message || err?.message || "Reconnect failed",
            }
          : prev,
      );
    }
  }, [streamState, startStream, clearReconnectTimer]);

  const toggleMute = useCallback(() => {
    setStreamState((prev) => {
      if (!prev) return prev;
      const newMuted = !prev.isMuted;
      engineRef.current?.muteLocalAudioStream(newMuted);
      return { ...prev, isMuted: newMuted };
    });
  }, []);

  const switchCamera = useCallback(() => {
    engineRef.current?.switchCamera();
  }, []);

  useEffect(() => {
    return () => {
      stopViewerTrackers();
    };
  }, [stopViewerTrackers]);

  return (
    <LiveStreamContext.Provider
      value={{
        streamState,
        engineRef,
        startStream,
        minimize,
        maximize,
        endStream,
        reconnectStream,
        toggleMute,
        switchCamera,
      }}
    >
      {children}
    </LiveStreamContext.Provider>
  );
}
