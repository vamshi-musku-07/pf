import { useState, useCallback, useEffect, useRef } from "react";
import { showToast } from "@/context/ToastContext";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Modal,
  useWindowDimensions,
  Animated,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

const LIVE_HUB_ICON = require("../assets/images/team-live-3d.png");
import {
  RtcSurfaceView,
  VideoSourceType,
} from "react-native-agora";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  createStreamAPI,
  getStreamAPI,
  getActiveTeamStreamAPI,
  endStreamAPI,
  getStreamStatusAPI,
} from "@/services/LiveStreamApi";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useLiveStream } from "@/context/LiveStreamContext";
import {
  initializeGameSocket,
  joinGameRoom,
  leaveGameRoom,
  onScoreUpdate,
  onGameEvent,
  onGameUpdate,
  onSocketReconnect,
} from "@/services/GameSocketService";
import { getGameByIdAPI } from "@/services/GameApi";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { normalizeGameModel } from "@/lib/gameModel";
import { getChessLivestreamLabel } from "@/lib/chessUtils";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

// ── Permissions ───────────────────────────────────────────────────────────────
async function requestAndroidPermissions() {
  if (Platform.OS !== "android") return true;
  const grants = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

function useIsLandscape() {
  const { width, height } = useWindowDimensions();
  return width > height;
}

// ── Score extraction (aligned with HomeTab / GameScreen) ─────────────────────
function extractScores(game) {
  if (!game) return { home: 0, away: 0 };
  const sport = game.base?.sport;
  const s = game.sport;
  if (!sport || !s) return { home: 0, away: 0 };

  if (sport === "Cricket") {
    if (s.score?.home != null || s.score?.away != null) {
      return { home: s.score.home || 0, away: s.score.away || 0 };
    }
    const homeId = String(game.base?.teamId || "");
    let h = 0;
    let a = 0;
    for (const inn of s.innings || []) {
      if (String(inn.battingTeamId) === homeId) h = inn.total_runs || 0;
      else a = inn.total_runs || 0;
    }
    return { home: h, away: a };
  }

  if (sport === "Pickleball") {
    const h = s.score?.home || 0;
    const a = s.score?.away || 0;
    if (h || a) return { home: h, away: a };
    const gs = s.gameScores || [];
    if (gs.length > 0) {
      return {
        home: gs.filter((g) => g.player1Points > g.player2Points).length,
        away: gs.filter((g) => g.player2Points > g.player1Points).length,
      };
    }
    return {
      home: s.currentPointScore?.player1 || 0,
      away: s.currentPointScore?.player2 || 0,
    };
  }

  if (sport === "Tennis" || sport === "TableTennis" || sport === "Badminton") {
    const gs = s.gameScores || s.setScores || s.games || [];
    const hw = gs.filter((g) => g.winner === "player1").length;
    const aw = gs.filter((g) => g.winner === "player2").length;
    if (hw || aw) return { home: hw, away: aw };
    if (s.score?.home != null || s.score?.away != null) {
      return { home: s.score.home || 0, away: s.score.away || 0 };
    }
    if (s.result?.homeGamesWon != null || s.result?.awayGamesWon != null) {
      return { home: s.result.homeGamesWon || 0, away: s.result.awayGamesWon || 0 };
    }
    return {
      home: s.currentPointScore?.player1 || 0,
      away: s.currentPointScore?.player2 || 0,
    };
  }

  if (sport === "Volleyball" || sport === "Rugby") {
    const h =
      s.result?.setsWon?.home ??
      (s.sets || []).filter((st) => st.winner === "home").length ??
      s.homeScore ??
      0;
    const a =
      s.result?.setsWon?.away ??
      (s.sets || []).filter((st) => st.winner === "away").length ??
      s.awayScore ??
      0;
    if (h || a) return { home: h, away: a };
    return { home: s.homeScore || 0, away: s.awayScore || 0 };
  }

  return {
    home: s.score?.home ?? s.homeScore ?? 0,
    away: s.score?.away ?? s.awayScore ?? 0,
  };
}

const sameGameId = (a, b) => a != null && b != null && String(a) === String(b);

// ── Game score hook — always fetches BOTH team names from API ─────────────────
function useGameScore(gameId) {
  const [scores, setScores]       = useState({ home: 0, away: 0 });
  const [homeLabel, setHomeLabel] = useState("HOME");
  const [awayLabel, setAwayLabel] = useState("AWAY");
  const [lastEvent, setLastEvent] = useState(null);
  const [showEvent, setShowEvent] = useState(false);
  const [sport, setSport] = useState(null);
  const [gameSnapshot, setGameSnapshot] = useState(null);
  const debounceRef = useRef(null);
  const lastFetchAtRef = useRef(0);

  const fetchAndSync = useCallback(async () => {
    if (!gameId) return;
    try {
      const res  = await getGameByIdAPI(gameId);
      const game = normalizeGameModel(res);
      if (!game?.base) return;
      setSport(game.base?.sport || null);
      setGameSnapshot(game);
      setScores(extractScores(game));
      const homeId = game.base?.teamId;
      const awayId = game.base?.opponentTeamId;
      await Promise.allSettled([
        homeId ? getTeamByIdAPI(homeId).then(tr => {
          const n = tr?.data?.teamName || tr?.team?.teamName || tr?.teamName;
          if (n) setHomeLabel(n);
        }) : Promise.resolve(),
        awayId ? getTeamByIdAPI(awayId).then(tr => {
          const n = tr?.data?.teamName || tr?.team?.teamName || tr?.teamName;
          if (n) setAwayLabel(n);
        }) : Promise.resolve(),
      ]);
    } catch { }
  }, [gameId]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastFetchAtRef.current < 2000) {
        debounceRef.current = null;
        return;
      }
      lastFetchAtRef.current = now;
      fetchAndSync();
      debounceRef.current = null;
    }, 800);
  }, [fetchAndSync]);

  useEffect(() => {
    fetchAndSync();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchAndSync]);

  const applyGameSnapshot = useCallback((payload) => {
    const normalized = normalizeGameModel(
      payload?.game ? { base: payload.game.base, sport: payload.game.sport } : payload,
    );
    if (!normalized?.base) return;
    setSport(normalized.base?.sport || null);
    setGameSnapshot(normalized);
    setScores(extractScores(normalized));
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let unsubs = [];
    let cancelled = false;

    (async () => {
      await initializeGameSocket();
      if (cancelled) return;
      joinGameRoom(gameId);

      const u1 = onScoreUpdate((d) => {
        if (!sameGameId(d.gameId, gameId)) return;
        setScores((p) => ({
          home: d.homeScore ?? d.total?.home ?? p.home,
          away: d.awayScore ?? d.total?.away ?? p.away,
        }));
      });

      const u2 = onGameUpdate((d) => {
        if (!sameGameId(d.gameId, gameId)) return;
        // batch_applied (GameScreen scoring path) — apply snapshot immediately
        if (d.game?.base && d.game?.sport) {
          applyGameSnapshot(d);
          return;
        }
        // Fallback refresh only for key lifecycle messages without snapshot
        const t = String(d?.type || "").toLowerCase();
        if (t.includes("started") || t.includes("ended") || t.includes("progress")) {
          debouncedFetch();
        }
      });

      const u3 = onGameEvent((d) => {
        if (!sameGameId(d.gameId, gameId)) return;
        setLastEvent({
          label: d.eventType?.replace(/_/g, " ")?.toUpperCase() || "EVENT",
          player: d.playerName || "",
        });
        setShowEvent(true);
        setTimeout(() => setShowEvent(false), 3000);
      });

      const u4 = onSocketReconnect(() => {
        joinGameRoom(gameId);
        fetchAndSync();
      });

      unsubs = [u1, u2, u3, u4];
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u?.());
      leaveGameRoom(gameId);
    };
  }, [gameId, debouncedFetch, fetchAndSync, applyGameSnapshot]);

  return { scores, homeLabel, awayLabel, lastEvent, showEvent, sport, gameSnapshot };
}

// ── Score pill ────────────────────────────────────────────────────────────────
function ScorePill({ homeLabel, awayLabel, scores, lastEvent, showEvent, compact }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: compact ? 6 : 10,
        backgroundColor: "rgba(0,0,0,0.80)",
        paddingHorizontal: compact ? 10 : 14, paddingVertical: compact ? 5 : 7,
        borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
      }}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }} numberOfLines={1}>
            {homeLabel.slice(0, 10)}
          </Text>
          <Text style={{ color: "white", fontSize: compact ? 20 : 26, fontWeight: "900", lineHeight: compact ? 24 : 30, minWidth: 20, textAlign: "right" }}>
            {scores.home}
          </Text>
        </View>
        <Text style={{ color: "#475569", fontWeight: "800", fontSize: compact ? 14 : 18 }}>:</Text>
        <View style={{ alignItems: "flex-start" }}>
          <Text style={{ color: "#94A3B8", fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }} numberOfLines={1}>
            {awayLabel.slice(0, 10)}
          </Text>
          <Text style={{ color: "white", fontSize: compact ? 20 : 26, fontWeight: "900", lineHeight: compact ? 24 : 30, minWidth: 20 }}>
            {scores.away}
          </Text>
        </View>
      </View>
      {showEvent && lastEvent && (
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(234,179,8,0.18)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(234,179,8,0.35)" }}>
          <Text style={{ color: "#FBBF24", fontWeight: "700", fontSize: 11 }}>{lastEvent.label}</Text>
          {lastEvent.player ? <Text style={{ color: "white", fontSize: 11 }}>{lastEvent.player}</Text> : null}
        </View>
      )}
    </View>
  );
}

function StreamScoreHeader({ sport, gameSnapshot, homeLabel, awayLabel, scores, lastEvent, showEvent, compact }) {
  if (sport === "Chess" && gameSnapshot) {
    const chessLabel = getChessLivestreamLabel(gameSnapshot, homeLabel, awayLabel);
    return (
      <View style={{ alignItems: "center" }}>
        <View style={{
          backgroundColor: "rgba(0,0,0,0.80)",
          paddingHorizontal: compact ? 12 : 16,
          paddingVertical: compact ? 6 : 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          maxWidth: 280,
        }}>
          <Text style={{ color: "white", fontSize: compact ? 13 : 15, fontWeight: "800", textAlign: "center" }}>
            {chessLabel}
          </Text>
        </View>
        {showEvent && lastEvent && (
          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(234,179,8,0.18)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(234,179,8,0.35)" }}>
            <Text style={{ color: "#FBBF24", fontWeight: "700", fontSize: 11 }}>{lastEvent.label}</Text>
            {lastEvent.player ? <Text style={{ color: "white", fontSize: 11 }}>{lastEvent.player}</Text> : null}
          </View>
        )}
      </View>
    );
  }
  return (
    <ScorePill
      homeLabel={homeLabel}
      awayLabel={awayLabel}
      scores={scores}
      lastEvent={lastEvent}
      showEvent={showEvent}
      compact={compact}
    />
  );
}

// ── LIVE badge ────────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EF4444", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "white" }} />
      <Text style={{ color: "white", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 }}>LIVE</Text>
    </View>
  );
}

// ── Options modal ─────────────────────────────────────────────────────────────
function OptionsModal({ visible, onClose, onResetZoom, onShare, zoomLevel, viewerCount }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: "#1a1d2e", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16, marginBottom: 20 }}>Stream Options</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            {[
              { icon: "eye-outline",    label: "Viewers", value: String(viewerCount) },
              { icon: "search-outline", label: "Zoom",    value: zoomLevel > 1 ? `${zoomLevel.toFixed(1)}×` : "1×" },
              { icon: "wifi-outline",   label: "Quality",  value: "HD" },
            ].map(stat => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, alignItems: "center" }}>
                <Ionicons name={stat.icon} size={18} color="#47feb7" />
                <Text style={{ color: "white", fontWeight: "800", fontSize: 15, marginTop: 4 }}>{stat.value}</Text>
                <Text style={{ color: "#6B7280", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {[
            { icon: "share-social-outline", label: "Share Stream", color: "#3B82F6", onPress: onShare },
            { icon: "expand-outline",       label: "Reset Zoom",   color: "#F59E0B", onPress: onResetZoom, disabled: zoomLevel <= 1 },
          ].map(action => (
            <TouchableOpacity
              key={action.label}
              onPress={() => { action.onPress?.(); onClose(); }}
              disabled={action.disabled}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: action.disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)", borderRadius: 14, marginBottom: 10, opacity: action.disabled ? 0.35 : 1 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: action.color + "22", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15, flex: 1 }}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#374151" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Pinch-to-zoom hook ────────────────────────────────────────────────────────
// Uses native onTouchStart/Move/End — does NOT compete with the responder chain,
// so buttons inside the same view still work normally.
function usePinchZoom() {
  const scaleAnim     = useRef(new Animated.Value(1)).current;
  const currentScale  = useRef(1);
  const lastScale     = useRef(1);
  const initialDist   = useRef(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  const dist = (touches) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const resetZoom = useCallback(() => {
    lastScale.current    = 1;
    currentScale.current = 1;
    initialDist.current  = 0;
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    setZoomLevel(1);
  }, [scaleAnim]);

  const touchHandlers = {
    onTouchStart: (e) => {
      if (e.nativeEvent.touches.length >= 2)
        initialDist.current = dist(e.nativeEvent.touches);
    },
    onTouchMove: (e) => {
      if (e.nativeEvent.touches.length >= 2 && initialDist.current > 0) {
        const d = dist(e.nativeEvent.touches);
        const next = Math.max(1, Math.min(5, lastScale.current * (d / initialDist.current)));
        currentScale.current = next;
        scaleAnim.setValue(next);
        setZoomLevel(Math.round(next * 10) / 10);
      }
    },
    onTouchEnd: (e) => {
      if (initialDist.current > 0 && e.nativeEvent.touches.length < 2) {
        lastScale.current = Math.max(1, currentScale.current);
        if (currentScale.current < 1.08) resetZoom();
        initialDist.current = 0;
      }
    },
  };

  return { scaleAnim, zoomLevel, resetZoom, touchHandlers };
}

// ── Shared: force landscape on mount regardless of system rotation lock ────────
// Uses LANDSCAPE (sensor-based) not LANDSCAPE_RIGHT for wider device support.
// Works even when the user has "Auto-rotate" disabled, because it calls
// Activity.setRequestedOrientation() at the Android Activity level.
function useForceLandscape() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);
}

// ── Portrait-only fallback overlay (shown when device ignores the lock) ────────
function RotatePrompt({ onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0a0c18", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <StatusBar hidden />
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Ionicons name="phone-landscape-outline" size={80} color="#9AEA62" style={{ marginBottom: 16 }} />
        <Text style={{ color: "white", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Rotate your phone
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          The stream requires landscape mode.{"\n"}
          Rotate your phone sideways to continue.
        </Text>
      </View>

      {/* Animated arrow indicating rotation direction */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 40,
        backgroundColor: "rgba(154,234,98,0.08)", borderRadius: 16, padding: 20,
        borderWidth: 1, borderColor: "rgba(154,234,98,0.2)" }}>
        <Ionicons name="arrow-redo-outline" size={24} color="#9AEA62" />
        <View>
          <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 14 }}>Tilt 90° to the right</Text>
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>The screen will auto-adjust</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onBack}
        style={{ flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
      >
        <Ionicons name="arrow-back" size={16} color="white" />
        <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Broadcaster ───────────────────────────────────────────────────────────────
function BroadcasterRoom({ roomName, gameId }) {
  useForceLandscape();          // ← lock to landscape on mount
  const isLandscape = useIsLandscape();
  const { scores, homeLabel, awayLabel, lastEvent, showEvent, sport, gameSnapshot } = useGameScore(gameId);
  const { streamState, minimize, endStream: ctxEndStream, reconnectStream, toggleMute, switchCamera } = useLiveStream();

  const isMuted = streamState?.isMuted || false;
  const viewerCount = streamState?.viewerCount || 0;
  const error = streamState?.error || null;
  const isReconnecting = !!streamState?.isReconnecting;
  const reconnectAttempt = streamState?.reconnectAttempt || 0;
  const reconnectMax = streamState?.reconnectMax || 3;
  const isReady = !!streamState;

  const handleLeave = useCallback(async () => {
    await ctxEndStream();
  }, [ctxEndStream]);

  const handleMinimize = useCallback(() => {
    // Unlock orientation before minimizing
    ScreenOrientation.unlockAsync().catch(() => {});
    minimize();
  }, [minimize]);

  const handleShare = useCallback(async () => {
    try { await Share.share({ message: `Watch our live game stream! Room: ${roomName}` }); } catch { }
  }, [roomName]);

  if (error) return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Ionicons name="warning-outline" size={48} color="#EF4444" />
      <Text style={{ color: "white", marginTop: 12, textAlign: "center", fontSize: 14 }}>{error}</Text>
      {isReconnecting ? (
        <Text style={{ color: "#9AEA62", marginTop: 8, fontSize: 12 }}>
          Reconnecting... ({reconnectAttempt}/{reconnectMax})
        </Text>
      ) : null}
      <TouchableOpacity onPress={reconnectStream} style={{ marginTop: 12, backgroundColor: "#081126", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "#9AEA62", fontWeight: "700" }}>Reconnect Stream</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleLeave} style={{ marginTop: 20, backgroundColor: "#EF4444", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  // If still portrait after lock attempt → device ignored the lock, ask user to rotate
  if (!isLandscape) return <RotatePrompt onBack={handleMinimize} />;

  // ── Landscape layout ──
  if (isLandscape) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar hidden />
        {isReady
          ? <RtcSurfaceView canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }} style={{ flex: 1 }} zOrderMediaOverlay />
          : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="white" size="large" /></View>
        }
        {/* Score centered at top */}
        <View style={{ position: "absolute", top: 12, left: 0, right: 0, alignItems: "center", zIndex: 200, pointerEvents: "none" }}>
          <StreamScoreHeader sport={sport} gameSnapshot={gameSnapshot} homeLabel={homeLabel} awayLabel={awayLabel} scores={scores} lastEvent={lastEvent} showEvent={showEvent} compact />
        </View>
        {/* Controls on right edge */}
        <SafeAreaView edges={["top", "right", "bottom"]} style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 200 }}>
          <View style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, paddingHorizontal: 8, gap: 14 }}>
            <TouchableOpacity onPress={handleLeave} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "white" }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMinimize} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="contract-outline" size={18} color="white" />
            </TouchableOpacity>
            <LiveBadge />
            <View style={{ alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.60)", paddingHorizontal: 8, paddingVertical: 8, borderRadius: 999 }}>
              <Ionicons name="eye-outline" size={14} color="white" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{viewerCount}</Text>
            </View>
            <TouchableOpacity onPress={toggleMute} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isMuted ? "#EF4444" : "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={switchCamera} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="camera-reverse" size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(59,130,246,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="share-social-outline" size={18} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Portrait layout — ALL controls at bottom ──
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />
      {isReady
        ? <RtcSurfaceView canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }} style={{ flex: 1 }} zOrderMediaOverlay />
        : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="white" size="large" /></View>
      }

      {/* Rotate hint */}
      <View style={{ position: "absolute", bottom: 150, left: 0, right: 0, alignItems: "center", zIndex: 100, pointerEvents: "none" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
          <Ionicons name="phone-landscape-outline" size={18} color="#9AEA62" />
          <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>Rotate for fullscreen</Text>
        </View>
      </View>

      {/* All controls at bottom */}
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
          {/* Score + info row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <TouchableOpacity onPress={handleMinimize} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="contract-outline" size={20} color="white" />
            </TouchableOpacity>

            <StreamScoreHeader sport={sport} gameSnapshot={gameSnapshot} homeLabel={homeLabel} awayLabel={awayLabel} scores={scores} lastEvent={lastEvent} showEvent={showEvent} compact />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LiveBadge />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }}>
                <Ionicons name="eye-outline" size={12} color="white" />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{viewerCount}</Text>
              </View>
            </View>
          </View>

          {/* Action buttons row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" }}>
            <TouchableOpacity
              onPress={toggleMute}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isMuted ? "#EF4444" : "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="white" />
            </TouchableOpacity>

            {/* Stop broadcast */}
            <TouchableOpacity
              onPress={handleLeave}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "white" }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: "white" }} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={switchCamera}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="camera-reverse" size={22} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(59,130,246,0.2)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="share-social-outline" size={22} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────────────
function ViewerRoom({ roomName, gameId }) {
  useForceLandscape();          // ← lock to landscape on mount
  const isLandscape = useIsLandscape();
  const { scores, homeLabel, awayLabel, lastEvent, showEvent, sport, gameSnapshot } = useGameScore(gameId);
  const { scaleAnim, zoomLevel, resetZoom, touchHandlers } = usePinchZoom();
  const { streamState, minimize, endStream: ctxEndStream, reconnectStream } = useLiveStream();

  const remoteUid = streamState?.remoteUid ?? null;
  const viewerCount = streamState?.viewerCount || 0;
  const error = streamState?.error || null;
  const isReconnecting = !!streamState?.isReconnecting;
  const reconnectAttempt = streamState?.reconnectAttempt || 0;
  const reconnectMax = streamState?.reconnectMax || 3;

  const [showControls, setShowControls] = useState(true);
  const [showOptions, setShowOptions]   = useState(false);

  const controlsTimer = useRef(null);
  const lastTapRef    = useRef(0);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      resetZoom();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    setShowControls(prev => { if (!prev) resetControlsTimer(); return !prev; });
  }, [resetControlsTimer, resetZoom]);

  const handleShare = useCallback(async () => {
    try { await Share.share({ message: `Watch our live game stream! Room: ${roomName}` }); } catch { }
  }, [roomName]);

  const handleLeave = useCallback(async () => {
    await ctxEndStream();
  }, [ctxEndStream]);

  const handleMinimize = useCallback(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    minimize();
  }, [minimize]);

  useEffect(() => { resetControlsTimer(); return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }; }, [resetControlsTimer]);

  if (error) return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Ionicons name="warning-outline" size={48} color="#EF4444" />
      <Text style={{ color: "white", marginTop: 12, textAlign: "center" }}>{error}</Text>
      {isReconnecting ? (
        <Text style={{ color: "#9AEA62", marginTop: 8, fontSize: 12 }}>
          Reconnecting... ({reconnectAttempt}/{reconnectMax})
        </Text>
      ) : null}
      <TouchableOpacity onPress={reconnectStream} style={{ marginTop: 12, backgroundColor: "#081126", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "#9AEA62", fontWeight: "700" }}>Reconnect Stream</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleLeave} style={{ marginTop: 20, backgroundColor: "#EF4444", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  // If still portrait after lock attempt → device ignored the lock, ask user to rotate
  if (!isLandscape) return <RotatePrompt onBack={handleMinimize} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar hidden />

      {/* Video — pinch handled via native touch events on the Animated.View */}
      <Animated.View
        style={{ flex: 1, transform: [{ scale: scaleAnim }] }}
        {...touchHandlers}
      >
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={handleTap}>
          {remoteUid !== null
            ? <RtcSurfaceView canvas={{ uid: remoteUid }} style={{ flex: 1 }} />
            : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="white" size="large" />
                <Text style={{ color: "#94A3B8", marginTop: 12, fontSize: 14 }}>Waiting for broadcaster…</Text>
                {isReconnecting ? (
                  <Text style={{ color: "#9AEA62", marginTop: 8, fontSize: 12 }}>
                    Auto-retrying... ({reconnectAttempt}/{reconnectMax})
                  </Text>
                ) : null}
                <TouchableOpacity onPress={reconnectStream} style={{ marginTop: 14, backgroundColor: "#081126", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
                  <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 13 }}>Reconnect Stream</Text>
                </TouchableOpacity>
              </View>
          }
        </TouchableOpacity>
      </Animated.View>

      {/* Zoom badge */}
      {zoomLevel > 1.05 && (
        <View style={{ position: "absolute", top: 16, left: 16, zIndex: 300, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} pointerEvents="none">
          <Ionicons name="search-outline" size={12} color="#9AEA62" />
          <Text style={{ color: "#9AEA62", fontSize: 12, fontWeight: "800" }}>{zoomLevel.toFixed(1)}×</Text>
          <Text style={{ color: "#6B7280", fontSize: 10 }}>· dbl-tap reset</Text>
        </View>
      )}

      {/* ── LANDSCAPE: right-rail controls + top score only ── */}
      {isLandscape && showControls && (
        <>
          {/* Score pill at top center */}
          <View style={{ position: "absolute", top: 12, left: 0, right: 0, alignItems: "center", zIndex: 200, pointerEvents: "none" }}>
            <StreamScoreHeader sport={sport} gameSnapshot={gameSnapshot} homeLabel={homeLabel} awayLabel={awayLabel} scores={scores} lastEvent={lastEvent} showEvent={showEvent} compact />
          </View>

          {/* Right-rail: all controls in one column */}
          <SafeAreaView edges={["top", "right", "bottom"]} style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 200 }}>
            <View style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, paddingHorizontal: 8, gap: 12 }}>
              <TouchableOpacity onPress={handleMinimize} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.60)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="contract-outline" size={20} color="white" />
              </TouchableOpacity>
              {remoteUid !== null && <LiveBadge />}
              <View style={{ alignItems: "center", gap: 2, backgroundColor: "rgba(0,0,0,0.60)", paddingHorizontal: 7, paddingVertical: 7, borderRadius: 999 }}>
                <Ionicons name="eye-outline" size={14} color="white" />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{viewerCount}</Text>
              </View>
              <TouchableOpacity onPress={handleShare} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(59,130,246,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="share-social-outline" size={18} color="#60A5FA" />
              </TouchableOpacity>
              {/* Leave — red, clearly distinct */}
              <TouchableOpacity onPress={handleLeave} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="exit-outline" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowOptions(true); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="ellipsis-horizontal" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </>
      )}

      {/* ── PORTRAIT: bottom overlay only ── */}
      {!isLandscape && showControls && (
        <SafeAreaView edges={["bottom", "left", "right"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.78)", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
            {/* Score + info row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <TouchableOpacity onPress={handleMinimize} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="contract-outline" size={20} color="white" />
              </TouchableOpacity>
              <StreamScoreHeader sport={sport} gameSnapshot={gameSnapshot} homeLabel={homeLabel} awayLabel={awayLabel} scores={scores} lastEvent={lastEvent} showEvent={showEvent} compact />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {remoteUid !== null && <LiveBadge />}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }}>
                  <Ionicons name="eye-outline" size={12} color="white" />
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{viewerCount}</Text>
                </View>
              </View>
            </View>
            {/* Action buttons */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={handleShare} style={{ alignItems: "center", gap: 4 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(59,130,246,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(59,130,246,0.4)" }}>
                  <Ionicons name="share-social-outline" size={20} color="#60A5FA" />
                </View>
                <Text style={{ color: "#60A5FA", fontSize: 10, fontWeight: "700" }}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLeave} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EF4444", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 }}>
                <Ionicons name="exit-outline" size={18} color="white" />
                <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>Leave</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowOptions(true); if (controlsTimer.current) clearTimeout(controlsTimer.current); }} style={{ alignItems: "center", gap: 4 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="white" />
                </View>
                <Text style={{ color: "#94A3B8", fontSize: 10, fontWeight: "700" }}>Options</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#374151", fontSize: 10, textAlign: "center", marginTop: 8 }}>
              Pinch to zoom · Tap to show/hide · Double-tap to reset zoom
            </Text>
          </View>
        </SafeAreaView>
      )}

      <OptionsModal
        visible={showOptions}
        onClose={() => { setShowOptions(false); resetControlsTimer(); }}
        onResetZoom={resetZoom}
        onShare={handleShare}
        zoomLevel={zoomLevel}
        viewerCount={viewerCount}
      />
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LiveStreamTab({ team, isOwner, canBroadcast: canBroadcastProp, currentGame, onStreamEnded }) {
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const { streamState, startStream, maximize } = useLiveStream();
  const [goLiveLoading, setGoLiveLoading] = useState(false);
  const [watchLoading, setWatchLoading]   = useState(false);
  const [roomLive, setRoomLive] = useState(false);
  const [broadcasterUserId, setBroadcasterUserId] = useState(null);
  const prevModeRef = useRef(null);
  const lastReconnectToastRef = useRef(null);

  const canBroadcast = canBroadcastProp ?? isOwner ?? false;
  const myUserId = String(backendUser?.id || backendUser?._id || backendUser?.userId || "");
  const isMyBroadcast = !!myUserId && !!broadcasterUserId && String(broadcasterUserId) === myUserId;
  const showGoLive = canBroadcast && (!roomLive || isMyBroadcast);

  const gameId   = currentGame?.base?._id || currentGame?._id || null;
  const roomName = gameId ? `game-${gameId}` : `team-${team?._id}`;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getStreamStatusAPI(roomName);
        if (cancelled) return;
        setRoomLive(!!status?.isLive);
        setBroadcasterUserId(status?.broadcasterUserId || null);
      } catch {
        if (!cancelled) {
          setRoomLive(false);
          setBroadcasterUserId(null);
        }
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomName]);

  // Show toast after broadcaster ends stream and Modal has closed
  useEffect(() => {
    if (prevModeRef.current === "broadcaster" && !streamState) {
      showToast("Stream ended — recording will appear in your Media tab shortly", "success", "top");
      onStreamEnded?.();
    }
    prevModeRef.current = streamState?.mode ?? null;
  }, [streamState]);

  useEffect(() => {
    const ts = streamState?.lastReconnectSuccessAt;
    if (!ts) return;
    if (lastReconnectToastRef.current === ts) return;
    lastReconnectToastRef.current = ts;
    showToast("Reconnected successfully", "success", "top");
  }, [streamState?.lastReconnectSuccessAt]);

  const watchStream = useCallback(async () => {
    setWatchLoading(true);
    try {
      let data = null;
      if (team?._id) {
        try {
          data = await getActiveTeamStreamAPI(team._id);
        } catch {}
      }
      if (!data) {
        data = await getStreamAPI(roomName);
      }
      if (!data?.token || !data?.channelName) throw new Error("No active stream found");
      startStream({ streamData: data, roomName: data.channelName, gameId, mode: "viewer" });
    } catch (err) {
      Alert.alert("No Stream Found", err.response?.data?.message || err.message || "Could not connect");
    } finally { setWatchLoading(false); }
  }, [team?._id, roomName, gameId, startStream]);

  const goLive = useCallback(async () => {
    setGoLiveLoading(true);
    try {
      const granted = await requestAndroidPermissions();
      if (!granted) { Alert.alert("Permissions Required", "Camera and microphone access are needed."); return; }
      const data = await createStreamAPI(roomName, team?._id);
      if (!data?.token || !data?.channelName) throw new Error("Invalid response from stream server");
      setRoomLive(true);
      setBroadcasterUserId(myUserId || null);
      startStream({ streamData: data, roomName: data.channelName, gameId, mode: "broadcaster" });
    } catch (err) {
      const code = err.response?.data?.code;
      const message = err.response?.data?.message || err.message || "Could not create stream";
      if (err.response?.status === 409 || code === "STREAM_IN_USE") {
        Alert.alert("Stream in progress", message, [
          { text: "Watch live", onPress: () => watchStream() },
          { text: "OK", style: "cancel" },
        ]);
      } else {
        Alert.alert("Stream Setup Failed", message);
      }
    } finally { setGoLiveLoading(false); }
  }, [roomName, gameId, team?._id, startStream, myUserId, watchStream]);

  // If stream is active and not minimized, show full-screen room
  if (streamState && !streamState.isMinimized) {
    const RoomComponent = streamState.mode === "broadcaster" ? BroadcasterRoom : ViewerRoom;
    return (
      <Modal visible animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
        <RoomComponent roomName={streamState.roomName} gameId={streamState.gameId} />
      </Modal>
    );
  }

  // If stream is minimized, show the PiP (handled by FloatingVideoPlayer in root layout)
  // Show the lobby/entry UI with option to re-maximize
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? T.bg : "#F8F9FB" }}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* If minimized, show a banner to go back to stream */}
      {streamState?.isMinimized && (
        <TouchableOpacity
          onPress={maximize}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: isDark ? T.surface : "#0F172A",
            padding: 14,
            borderRadius: 14,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDark ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.3)",
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="videocam" size={18} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isDark ? T.text : "white", fontWeight: "800", fontSize: 13 }}>Live Stream Active</Text>
            <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 11 }}>Tap to return to full screen</Text>
          </View>
          <Ionicons name="expand-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
      <View style={{ alignItems: "center", marginBottom: 28 }}>
        <ExpoImage
          source={LIVE_HUB_ICON}
          style={{ width: 96, height: 96, marginBottom: 12 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
        />
        <Text style={{ fontSize: 24, fontWeight: "800", color: isDark ? T.text : "#0F172A", textAlign: "center" }}>
          {showGoLive ? "Ready to go live?" : roomLive ? "Live now" : "Ready to watch?"}
        </Text>
        <Text style={{ color: isDark ? T.textDim : "#64748B", textAlign: "center", marginTop: 8, fontSize: 14, lineHeight: 22 }}>
          {showGoLive
            ? "Broadcast the game live from your phone. Team owners and managers can go live while others watch."
            : roomLive && canBroadcast
              ? "Someone is already broadcasting this match. Watch as a viewer — only one person can go live at a time."
              : "Watch the live game stream with real-time scores and pinch-to-zoom controls."}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: isDark ? T.surface : "white",
          borderRadius: 20,
          padding: 16,
          marginBottom: 24,
          elevation: isDark ? 0 : 2,
          borderWidth: isDark ? 1 : 0,
          borderColor: T.border,
        }}
      >
        <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0F172A", fontSize: 15, marginBottom: 12 }}>Features</Text>
        {[
          { icon: "phone-portrait-outline",  text: "Full-screen landscape stream",              color: "#EF4444" },
          { icon: "search-outline",           text: "Pinch to zoom · Double-tap to reset",       color: "#8B5CF6" },
          { icon: "mic-outline",              text: "Live audio with mute toggle",                color: "#3B82F6" },
          { icon: "camera-reverse-outline",   text: "Switch front / rear camera",                 color: "#F59E0B" },
        ].map((f, i, arr) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: i < arr.length - 1 ? 12 : 0 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: f.color + "20", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={f.icon} size={18} color={f.color} />
            </View>
            <Text style={{ color: isDark ? T.textDim : "#475569", fontSize: 14, flex: 1 }}>{f.text}</Text>
          </View>
        ))}
      </View>

      {showGoLive && (
        <TouchableOpacity onPress={goLive} disabled={goLiveLoading || watchLoading} style={{ backgroundColor: "#EF4444", paddingVertical: 16, borderRadius: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 12, opacity: (goLiveLoading || watchLoading) ? 0.7 : 1 }}>
          {goLiveLoading ? <ActivityIndicator color="white" /> : (<><Ionicons name="radio-outline" size={20} color="white" /><Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>{isMyBroadcast && roomLive ? "Resume broadcast" : "Go Live"}</Text></>)}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={watchStream}
        disabled={goLiveLoading || watchLoading}
        style={{
          backgroundColor: isDark ? "#1E1E24" : "#081126",
          borderWidth: isDark ? 1 : 0,
          borderColor: "#2A2A2E",
          paddingVertical: 16,
          borderRadius: 18,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
          opacity: (goLiveLoading || watchLoading) ? 0.7 : 1,
        }}
      >
        {watchLoading ? (
          <ActivityIndicator color={isDark ? "#F5F5F7" : "#9AEA62"} />
        ) : (
          <>
            <Ionicons name="play-circle-outline" size={22} color={isDark ? "#F5F5F7" : "#9AEA62"} />
            <Text style={{ color: isDark ? "#F5F5F7" : "#9AEA62", fontWeight: "800", fontSize: 16 }}>
              {canBroadcast ? "Watch as Viewer" : "Watch Live Stream"}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
