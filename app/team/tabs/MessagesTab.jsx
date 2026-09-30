import { useState, useEffect, useCallback, useRef } from "react";
import { ActivityIndicator, Alert, Animated as RNAnimated, Image, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Animated, { FadeInUp } from "react-native-reanimated";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, useAudioRecorder, RecordingPresets } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { io } from "socket.io-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAccessToken } from "@/lib/tokenStorage";
import { MESSAGE_API_URL } from "@/config/api";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { getTeamMessagesAPI, createMessageAPI, uploadMediaAPI, deleteMessageAPI, updateMessageAPI, toggleMessageReactionAPI } from "@/services/MessageApi";
import * as Haptics from "expo-haptics";
import TelegramReactionPicker from "@/components/messages/TelegramReactionPicker";
import MessageReactionsRow from "@/components/messages/MessageReactionsRow";
import ReactionBurstOverlay from "@/components/messages/ReactionBurstOverlay";
import SwipeToReply from "@/components/messages/SwipeToReply";
import ReplyQuote from "@/components/messages/ReplyQuote";
import ChatImageAttachment from "@/components/messages/ChatImageAttachment";
import VoiceMessagePlayer from "@/components/messages/VoiceMessagePlayer";
import AttachmentPreviewThumb from "@/components/messages/AttachmentPreviewThumb";
import {
  ImageViewerModal,
  VideoPlayerModal,
} from "@/components/messages/ChatMediaViewer";
import { buildReplyPreviewFromMessage } from "@/lib/messageReplyPreview";
import { buildMessageUploadFormData } from "@/lib/messageMediaUpload";
import { DEFAULT_QUICK_REACTION_KEY } from "@/constants/messageReactions";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

function MessagesSkeleton({ isDark = false }) {
  const pulse = useRef(new RNAnimated.Value(0.4)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const rows = [
    { mine: false, w: 180 },
    { mine: true,  w: 140 },
    { mine: false, w: 220 },
    { mine: false, w: 160 },
    { mine: true,  w: 200 },
    { mine: false, w: 130 },
    { mine: true,  w: 170 },
  ];
  const bone = isDark ? "#2A2A2E" : "#E2E8F0";
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, ...(isDark ? { backgroundColor: "#16161A" } : {}) }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: r.mine ? "flex-end" : "flex-start", alignItems: "flex-end", marginBottom: 14 }}>
          {!r.mine && (
            <RNAnimated.View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bone, opacity: pulse, marginRight: 8 }} />
          )}
          <RNAnimated.View style={{ width: r.w, height: 38, borderRadius: 18, backgroundColor: bone, opacity: pulse }} />
        </View>
      ))}
    </View>
  );
}

export default function MessagesTab({ teamId, opponentTeamId = null, isSelfOwnedOpponent = false }) {
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const insets = useSafeAreaInsets();
  const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || "";
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const keyboardInset = useKeyboardInset();
  const [selectedMsg, setSelectedMsg] = useState(null);
  
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { _id, senderName, message }
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [burstMsgId, setBurstMsgId] = useState(null);
  const [burstReactionKey, setBurstReactionKey] = useState(null);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [imageModalUri, setImageModalUri] = useState(null);
  const [videoModalUri, setVideoModalUri] = useState(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPreparedRef = useRef(false);
  const scrollRef = useRef(null);
  const listContentHeightRef = useRef(0);
  const socketRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const gifSearchTimeoutRef = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0 });
  const msgActionSheetRef = useRef(null);
  const editSheetRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const knownMsgIdsRef = useRef(new Set());
  // Tracks whether the user is scrolled near the bottom of the message list.
  // Used to suppress auto-scroll when the user is reading older messages.
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AudioModule.requestRecordingPermissionsAsync();
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.warn("[MessagesTab] Audio mode init failed:", err?.message);
      }
    })();
  }, []);

  const ensureRecordingAudioMode = async () => {
    await AudioModule.setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const resetRecordingUi = () => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    audioPreparedRef.current = false;
  };

  const mimeTypeForRecordingUri = (uri) => {
    const ext = (uri.split(".").pop() || "").split("?")[0].toLowerCase();
    const map = {
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      caf: "audio/x-caf",
      aac: "audio/aac",
      "3gp": "audio/3gpp",
      wav: "audio/wav",
      mpeg: "audio/mpeg",
      mp3: "audio/mpeg",
    };
    return map[ext] || "audio/mp4";
  };

  const extensionForMime = (mimeType) => {
    if (mimeType.includes("3gpp")) return "3gp";
    if (mimeType.includes("caf")) return "caf";
    if (mimeType.includes("wav")) return "wav";
    return "m4a";
  };

  const getMessageSenderId = (msg) => {
    if (!msg) return null;
    let id = null;
    if (typeof msg.senderId === "string") id = msg.senderId;
    else if (msg.senderId?._id) id = msg.senderId._id;
    else if (msg.senderId?.id) id = msg.senderId.id;
    else if (msg.sender?._id) id = msg.sender._id;
    return id ? String(id) : null;
  };

  const getCurrentUserId = useCallback(() => {
    const id =
      backendUser?.id || backendUser?._id || backendUser?.userId;
    return id ? String(id) : "";
  }, [backendUser]);

  const isOwnMessage = useCallback(
    (msg) => {
      const sid = getMessageSenderId(msg);
      const uid = getCurrentUserId();
      return !!(sid && uid && sid === uid);
    },
    [getCurrentUserId],
  );

  const messageHasEditableText = (msg) => !!(msg?.message || "").trim();

  const handleScroll = useCallback((e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    isAtBottomRef.current = distanceFromBottom < 120;
  }, []);

  const scrollToBottom = useCallback((animated = true, force = false) => {
    if (!force && !isAtBottomRef.current) return;
    const list = scrollRef.current;
    if (!list) return;

    const attempt = () => {
      try {
        const y = Math.max(0, listContentHeightRef.current + 500);
        list.scrollToOffset({ offset: y, animated });
      } catch {
        // ignore — list may not be laid out yet
      }
    };

    attempt();
    requestAnimationFrame(attempt);
    setTimeout(attempt, 60);
    setTimeout(attempt, 200);
  }, []);

  const handleListContentSizeChange = useCallback((_w, h) => {
    if (typeof h === "number" && h > 0) listContentHeightRef.current = h;
    if (isAtBottomRef.current) scrollToBottom(false, true);
  }, [scrollToBottom]);

  const appendUniqueMessage = useCallback((incoming) => {
    if (!incoming) return;
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const incomingId = String(incoming._id || incoming.id || "");
      const incomingSenderId = String(
        incoming?.senderId?._id ||
        incoming?.senderId?.id ||
        incoming?.senderId ||
        incoming?.sender?._id ||
        "",
      );
      const incomingText = (incoming?.message || "").trim();
      const incomingCreatedAt = Number(new Date(incoming?.createdAt || Date.now()));
      const incomingReplyId = String(
        incoming?.replyTo?.messageId ||
        incoming?.replyTo?._id ||
        incoming?.replyTo?.id ||
        "",
      );
      const incomingAttachmentCount = Array.isArray(incoming?.attachments)
        ? incoming.attachments.length
        : 0;

      if (incomingId) {
        const existingIndex = list.findIndex(
          (m) => String(m._id || m.id || "") === incomingId,
        );
        if (existingIndex >= 0) return list;

        // Reconcile server/socket echo with optimistic local message so sender
        // doesn't see a temporary duplicate "blink" before it collapses.
        const optimisticIndex = list.findIndex((m) => {
          if (!m?._isOptimistic) return false;
          const mid = String(m._id || m.id || "");
          if (!mid.startsWith("temp_")) return false;

          const midSender = String(
            m?.senderId?._id ||
            m?.senderId?.id ||
            m?.senderId ||
            m?.sender?._id ||
            "",
          );
          const sameSender = incomingSenderId
            ? midSender === incomingSenderId
            : true;
          const sameText = (m?.message || "").trim() === incomingText;
          const midReplyId = String(
            m?.replyTo?.messageId ||
            m?.replyTo?._id ||
            m?.replyTo?.id ||
            "",
          );
          const sameReply = midReplyId === incomingReplyId;
          const midAttachmentCount = Array.isArray(m?.attachments)
            ? m.attachments.length
            : 0;
          const sameAttachmentCount = midAttachmentCount === incomingAttachmentCount;
          const midCreatedAt = Number(new Date(m?.createdAt || 0));
          const closeInTime = Math.abs(incomingCreatedAt - midCreatedAt) < 15000;
          return sameSender && sameText && sameReply && sameAttachmentCount && closeInTime;
        });

        if (optimisticIndex >= 0) {
          const next = [...list];
          next[optimisticIndex] = incoming;
          return next;
        }
      }

      const fallbackExists = list.some(
        (m) =>
          m?.createdAt === incoming?.createdAt &&
          getMessageSenderId(m) === getMessageSenderId(incoming) &&
          (m?.message || "") === (incoming?.message || ""),
      );
      if (fallbackExists) return list;

      return [...list, incoming];
    });
  }, []);

  const extractMsgList = (res) =>
    Array.isArray(res)
      ? res
      : Array.isArray(res?.data?.messages)
        ? res.data.messages
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.messages)
            ? res.messages
            : [];

  const loadMessages = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getTeamMessagesAPI(teamId);
      let list = extractMsgList(res);

      // If opponent is self-owned, merge both teams' messages into one chat
      if (isSelfOwnedOpponent && opponentTeamId) {
        try {
          const oppRes = await getTeamMessagesAPI(opponentTeamId);
          const oppList = extractMsgList(oppRes);
          const seen = new Set(list.map((m) => m._id || m.id));
          for (const m of oppList) {
            if (!seen.has(m._id || m.id)) { seen.add(m._id || m.id); list.push(m); }
          }
        } catch {}
      }

      const sorted = [...list].sort(
        (a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0),
      );
      sorted.forEach((m) => knownMsgIdsRef.current.add(String(m._id || m.id || "")));
      setMessages(sorted);
      isAtBottomRef.current = true;
      setTimeout(() => {
        scrollToBottom(false, true);
        initialLoadDoneRef.current = true;
      }, 150);
    } catch {
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initTeamSocket = async () => {
      try {
        const token = await getAccessToken();
        if (!isMounted || !token || !teamId) return;

        const socketBaseUrl = MESSAGE_API_URL.replace(/\/api\/v1\/messages\/?$/, "");

        const socket = io(socketBaseUrl, {
          path: "/player-io",
          transports: ["websocket", "polling"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000,
          forceNew: true,
        });

        socketRef.current = socket;

        const joinRooms = () => {
          socket.emit("authenticate", {
            name: backendUser?.username || backendUser?.email || "User",
            username: backendUser?.username,
          });
          socket.emit("join-team", teamId);
          // Also join the opponent team's room so messages flow both ways
          if (isSelfOwnedOpponent && opponentTeamId) {
            socket.emit("join-team", opponentTeamId);
          }
        };

        socket.on("connect", joinRooms);
        // Re-join rooms on reconnect so coach/owner doesn't lose room membership
        socket.on("reconnect", joinRooms);

        socket.on("new-message", (payload) => {
          appendUniqueMessage(payload);
          // Only auto-scroll if the user is already near the bottom.
          // If they're reading history, don't interrupt them.
          if (isAtBottomRef.current) {
            scrollToBottom(true, true);
          }
        });

        socket.on("message-reaction", (payload) => {
          const messageId = payload?.messageId;
          if (!messageId) return;
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id || m.id || "") === String(messageId)
                ? { ...m, reactions: payload.reactions || [] }
                : m,
            ),
          );
        });

        socket.on("message-deleted", (payload) => {
          const messageId = payload?.messageId;
          if (!messageId) return;
          setMessages((prev) =>
            prev.filter((m) => String(m._id || m.id || "") !== String(messageId)),
          );
        });

        socket.on("message-updated", (payload) => {
          const messageId = payload?.messageId;
          if (!messageId) return;
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id || m.id || "") === String(messageId)
                ? {
                    ...m,
                    message: payload.message ?? m.message,
                    isEdited: payload.isEdited ?? true,
                    editedAt: payload.editedAt ?? m.editedAt,
                  }
                : m,
            ),
          );
        });
      } catch {}
    };

    initTeamSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.off("new-message");
        socketRef.current.off("message-reaction");
        socketRef.current.off("message-deleted");
        socketRef.current.off("message-updated");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [teamId, backendUser?.username, backendUser?.email, appendUniqueMessage, scrollToBottom]);

  useEffect(() => {
    if (loading || messages.length === 0) return;
    if (isAtBottomRef.current) scrollToBottom(true);
  }, [messages.length, loading, scrollToBottom]);

  useEffect(() => {
    if (keyboardInset > 0) {
      isAtBottomRef.current = true;
      scrollToBottom(true, true);
      const t = setTimeout(() => scrollToBottom(true, true), 80);
      return () => clearTimeout(t);
    }
  }, [keyboardInset, scrollToBottom]);

  const onRefreshMessages = async () => {
    setRefreshing(true);
    await loadMessages(false);
    setRefreshing(false);
  };

  // --- Image / Video picker ---
  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your media library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 1,
      allowsMultipleSelection: false,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const lowerName = (asset.fileName || "").toLowerCase();
      const lowerUri = (asset.uri || "").toLowerCase();
      const lowerMime = (asset.mimeType || "").toLowerCase();
      const isGif =
        lowerMime === "image/gif" ||
        lowerName.endsWith(".gif") ||
        /\.gif(\?|$)/.test(lowerUri);
      const isVideo =
        !isGif &&
        (asset.type === "video" || asset.uri?.match(/\.(mp4|mov|avi|mkv)$/i));
      setAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: isGif ? "gif" : isVideo ? "video" : "image",
          name:
            asset.fileName ||
            `media_${Date.now()}.${isGif ? "gif" : isVideo ? "mp4" : "jpg"}`,
          mimeType:
            asset.mimeType || (isGif ? "image/gif" : isVideo ? "video/mp4" : "image/jpeg"),
        },
      ]);
    }
  };

  // --- Audio recording ---
  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Please allow microphone access.");
        return;
      }
      await ensureRecordingAudioMode();
      await audioRecorder.prepareToRecordAsync();
      audioPreparedRef.current = true;
      audioRecorder.record();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      audioPreparedRef.current = false;
      console.warn("[MessagesTab] startRecording failed:", err?.message);
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const pauseRecording = async () => {
    if (!isRecording || isPaused) return;
    clearInterval(recordingIntervalRef.current);
    try {
      await audioRecorder.pause();
      setIsPaused(true);
    } catch {
      // silently ignore — recording still active, timer stopped
    }
  };

  const resumeRecording = async () => {
    if (!isRecording || !isPaused) return;
    try {
      if (!audioPreparedRef.current) {
        await ensureRecordingAudioMode();
        await audioRecorder.prepareToRecordAsync();
        audioPreparedRef.current = true;
      }
      audioRecorder.record();
      setIsPaused(false);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.warn("[MessagesTab] resumeRecording failed:", err?.message);
    }
  };

  const stopRecording = async () => {
    if (!isRecording && !isPaused) return;
    clearInterval(recordingIntervalRef.current);

    if (recordingDuration < 1) {
      try {
        if (audioPreparedRef.current) await audioRecorder.stop();
      } catch {}
      resetRecordingUi();
      Alert.alert("Too short", "Hold the mic for at least 1 second to record.");
      return;
    }

    try {
      if (audioPreparedRef.current) {
        await audioRecorder.stop();
      }

      let uri = audioRecorder.uri;
      if (!uri) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        uri = audioRecorder.uri;
      }

      if (!uri) {
        Alert.alert("Recording error", "Could not save the recording. Please try again.");
        resetRecordingUi();
        return;
      }

      const mimeType = mimeTypeForRecordingUri(uri);
      const ext = extensionForMime(mimeType);
      let finalUri = uri;

      if (FileSystem.cacheDirectory) {
        const dest = `${FileSystem.cacheDirectory}voice_${Date.now()}.${ext}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          finalUri = dest;
        } catch {
          finalUri = uri;
        }
      }

      setAttachments((prev) => [
        ...prev,
        {
          uri: finalUri,
          type: "audio",
          name: `voice_${Date.now()}.${ext}`,
          mimeType,
        },
      ]);
    } catch (err) {
      console.warn("[MessagesTab] stopRecording failed:", err?.message);
      Alert.alert("Recording error", "Could not stop recording.");
    } finally {
      resetRecordingUi();
    }
  };

  const cancelRecording = async () => {
    if (!isRecording && !isPaused) return;
    clearInterval(recordingIntervalRef.current);
    try {
      if (audioPreparedRef.current) await audioRecorder.stop();
    } catch {}
    resetRecordingUi();
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchTrendingGifs = useCallback(async () => {
    if (!GIPHY_API_KEY) return;
    setIsLoadingGifs(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=g`,
      );
      const data = await res.json();
      setGifResults(data?.data || []);
    } catch {
      setGifResults([]);
    } finally {
      setIsLoadingGifs(false);
    }
  }, [GIPHY_API_KEY]);

  const searchGifs = useCallback(
    async (query) => {
      if (!GIPHY_API_KEY) return;
      if (!query.trim()) {
        fetchTrendingGifs();
        return;
      }
      setIsLoadingGifs(true);
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30&rating=g`,
        );
        const data = await res.json();
        setGifResults(data?.data || []);
      } catch {
        setGifResults([]);
      } finally {
        setIsLoadingGifs(false);
      }
    },
    [GIPHY_API_KEY, fetchTrendingGifs],
  );

  useEffect(() => {
    if (showGifPicker && gifResults.length === 0 && GIPHY_API_KEY) {
      fetchTrendingGifs();
    }
  }, [showGifPicker, gifResults.length, GIPHY_API_KEY, fetchTrendingGifs]);

  useEffect(() => {
    return () => {
      if (gifSearchTimeoutRef.current) {
        clearTimeout(gifSearchTimeoutRef.current);
      }
    };
  }, []);

  const handleGifSelect = (gif) => {
    const gifUrl = gif?.images?.original?.url;
    if (!gifUrl) return;
    setAttachments((prev) => [
      ...prev,
      {
        uri: gifUrl,
        type: "gif",
        name: gif?.title || `gif_${Date.now()}.gif`,
        mimeType: "image/gif",
        fileType: "gif",
        size: Number(gif?.images?.original?.size || 0),
        isRemote: true,
      },
    ]);
    setShowGifPicker(false);
    setGifSearchQuery("");
  };

  // --- Long-press: own messages → action menu; others → reactions ---
  const handleLongPress = (msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedMsg(msg);
    setReactionPickerMsg(msg);
    if (isOwnMessage(msg)) {
      msgActionSheetRef.current?.expand();
    } else {
      setShowReactionPicker(true);
    }
  };

  const applyMessageReactions = useCallback((messageId, reactions) => {
    setMessages((prev) =>
      prev.map((m) =>
        String(m._id || m.id || "") === String(messageId)
          ? { ...m, reactions: reactions || [] }
          : m,
      ),
    );
  }, []);

  const handleToggleReaction = async (msg, reactionKey, showBurst = false) => {
    const messageId = msg?._id || msg?.id;
    if (!messageId || String(messageId).startsWith("temp_")) return;

    try {
      const res = await toggleMessageReactionAPI(messageId, reactionKey);
      const payload = res?.data || res;
      const reactions = payload?.reactions || [];
      applyMessageReactions(messageId, reactions);

      if (showBurst && payload?.active !== false) {
        setBurstMsgId(String(messageId));
        setBurstReactionKey(reactionKey);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
    } catch {
      Alert.alert("Error", "Could not update reaction.");
    }
  };

  const handleMessagePress = (msg) => {
    const messageId = String(msg?._id || msg?.id || "");
    const now = Date.now();
    if (
      lastTapRef.current.id === messageId &&
      now - lastTapRef.current.time < 320
    ) {
      handleToggleReaction(msg, DEFAULT_QUICK_REACTION_KEY, true);
      lastTapRef.current = { id: null, time: 0 };
      return;
    }
    lastTapRef.current = { id: messageId, time: now };
  };

  const openMoreActions = () => {
    if (reactionPickerMsg) setSelectedMsg(reactionPickerMsg);
    setShowReactionPicker(false);
    msgActionSheetRef.current?.expand();
  };

  const startReplyToMessage = useCallback((msg) => {
    const preview = buildReplyPreviewFromMessage(msg);
    if (!preview) return;
    setReplyingTo(preview);
  }, []);

  const closeMsgSheet = useCallback(() => {
    msgActionSheetRef.current?.close();
  }, []);

  const renderSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  );

  const handleReply = () => {
    if (!selectedMsg) return;
    closeMsgSheet();
    startReplyToMessage(selectedMsg);
  };

  const handleOpenReact = () => {
    closeMsgSheet();
    setShowReactionPicker(true);
  };

  const handleDeleteMsg = () => {
    if (!selectedMsg) return;
    const id = String(selectedMsg._id || selectedMsg.id || "");
    if (!id || id.startsWith("temp_")) {
      closeMsgSheet();
      Alert.alert("Delete Message", "This message is still sending. Try again in a moment.");
      return;
    }
    closeMsgSheet();
    Alert.alert("Delete Message", "Are you sure you want to delete this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setMessages((prev) =>
            prev.filter((m) => String(m._id || m.id || "") !== id),
          );
          try {
            await deleteMessageAPI(id);
          } catch {
            loadMessages(false);
            Alert.alert("Error", "Could not delete this message.");
          }
          setSelectedMsg(null);
        },
      },
    ]);
  };

  const handleOpenEdit = () => {
    if (!selectedMsg) return;
    if (!messageHasEditableText(selectedMsg)) {
      Alert.alert("Edit Message", "Only text messages can be edited.");
      return;
    }
    const id = String(selectedMsg._id || selectedMsg.id || "");
    if (id.startsWith("temp_")) {
      Alert.alert("Edit Message", "This message is still sending. Try again in a moment.");
      return;
    }
    closeMsgSheet();
    setEditText(selectedMsg.message || "");
    setEditingMsg(selectedMsg);
    setTimeout(() => editSheetRef.current?.expand(), 120);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    const id = String(editingMsg._id || editingMsg.id || "");
    if (id.startsWith("temp_")) return;
    setEditSaving(true);
    setMessages((prev) =>
      prev.map((m) =>
        String(m._id || m.id || "") === id
          ? { ...m, message: editText.trim(), isEdited: true }
          : m,
      ),
    );
    try {
      await updateMessageAPI(id, { message: editText.trim() });
    } catch {
      loadMessages(false);
      Alert.alert("Error", "Could not save your edit.");
    } finally {
      setEditSaving(false);
      editSheetRef.current?.close();
      setSelectedMsg(null);
    }
  };

  // --- Send message ---
  const sendMsg = async () => {
    if (!text.trim() && attachments.length === 0) return;

    const msgText = text.trim();
    const msgReplyingTo = replyingTo;
    const msgAttachments = [...attachments];

    // ── Optimistic: show message instantly for text-only sends ──────────────
    // This ensures the sender sees their own message immediately without
    // waiting for the socket echo (which the backend may not send back to
    // the sender's own socket connection).
    const tempId = `temp_${Date.now()}`;
    const isTextOnly = msgText && msgAttachments.length === 0;
    if (isTextOnly) {
      const optimistic = {
        _id: tempId,
        _isOptimistic: true,
        message: msgText,
        teamId,
        senderId: backendUser?.id || backendUser?._id,
        senderName: backendUser?.username || backendUser?.email || "User",
        senderProfileImage: backendUser?.profileImage || null,
        createdAt: new Date().toISOString(),
        messageType: "text",
        attachments: [],
        replyTo: msgReplyingTo || undefined,
      };
      setMessages((prev) => [...prev, optimistic]);
      // User sent a message — always snap to bottom to show it.
      isAtBottomRef.current = true;
      scrollToBottom(true, true);
    }

    // Clear input immediately so UX feels fast
    setText("");
    setAttachments([]);
    setReplyingTo(null);

    setSending(true);
    try {
      let uploadedAttachments = [];

      const remoteGifAttachments = msgAttachments
        .filter((att) => att.type === "gif" && att.isRemote)
        .map((att) => ({
          url: att.uri,
          type: "image/gif",
          name: att.name || "GIF",
          size: att.size || 0,
          fileType: "gif",
        }));

      const uploadableAttachments = msgAttachments.filter(
        (att) => !(att.type === "gif" && att.isRemote),
      );

      if (uploadableAttachments.length > 0) {
        setIsUploading(true);
        const formData = await buildMessageUploadFormData(uploadableAttachments);
        const uploadRes = await uploadMediaAPI(formData);
        setIsUploading(false);
        if (!uploadRes?.success || !Array.isArray(uploadRes.data) || uploadRes.data.length === 0) {
          throw new Error(uploadRes?.message || "Failed to upload attachment");
        }
        uploadedAttachments = uploadRes.data;
      }

      const allAttachments = [...uploadedAttachments, ...remoteGifAttachments];

      let msgType = "text";
      if (allAttachments.length > 0) {
        const types = allAttachments.map((a) => a.fileType || a.type || "");
        if (types.some((t) => t === "gif" || `${t}`.startsWith("image/gif"))) msgType = "gif";
        else if (types.some((t) => t.startsWith("audio") || t === "audio")) msgType = "audio";
        else if (types.some((t) => t.startsWith("video") || t === "video")) msgType = "video";
        else if (types.some((t) => t.startsWith("image") || t === "image")) msgType = "image";
        else msgType = "media";
      }

      const res = await createMessageAPI({
        teamId,
        message: msgText,
        messageType: msgType,
        senderName: backendUser?.username || backendUser?.email || "User",
        senderProfileImage: backendUser?.profileImage || null,
        ...(msgReplyingTo?.messageId ? { replyTo: msgReplyingTo } : {}),
        attachments: allAttachments.map((a) => ({
          url: a.url, type: a.type, name: a.name, size: a.size, fileType: a.fileType,
        })),
      });

      // Replace optimistic temp entry with the real message from the server.
      // For media messages the optimistic was never added, so just append the real one.
      const newMsg = res?.data || res;
      const realId = String(newMsg?._id || newMsg?.id || "");
      setMessages((prev) => {
        // Remove the temp optimistic entry (and any socket duplicate with the real ID)
        const without = prev.filter((m) => {
          const mid = String(m._id || m.id || "");
          return mid !== tempId && mid !== realId;
        });
        if (realId) {
          // Always append the server-confirmed message so the coach sees their own message
          return [...without, newMsg];
        }
        // No usable ID in response — fall back to a silent reload
        return without;
      });

      if (!realId) {
        // Response shape unrecognised — reload without showing a spinner
        loadMessages(false);
      }

      // Always snap to bottom after a successful send (user's own message).
      isAtBottomRef.current = true;

      // Broadcast the confirmed message via socket so team members receive it in
      // real time even when the HTTP-API socket emit was missed (e.g. the coach's
      // socket hadn't joined the room yet when the controller ran sendToTeam).
      if (realId && socketRef.current?.connected) {
        const socketPayload = {
          message: msgText,
          messageType: msgType,
          _id: realId,
          senderName: backendUser?.username || backendUser?.email || "User",
          senderProfileImage: backendUser?.profileImage || null,
          createdAt: newMsg?.createdAt || new Date().toISOString(),
          attachments: allAttachments.map((a) => ({
            url: a.url, type: a.type, name: a.name, size: a.size, fileType: a.fileType,
          })),
          ...(newMsg?.replyTo ? { replyTo: newMsg.replyTo } : {}),
        };

        // Broadcast to the owner's main team room.
        socketRef.current.emit("send-message", { ...socketPayload, teamId });

        // When the owner also created the opponent team, broadcast to that room too
        // so opponent players receive the message live.
        if (isSelfOwnedOpponent && opponentTeamId) {
          socketRef.current.emit("send-message", { ...socketPayload, teamId: opponentTeamId });
        }
      }

      scrollToBottom(true, true);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => String(m._id || m.id || "") !== tempId));
      setAttachments(msgAttachments);
      if (msgReplyingTo) setReplyingTo(msgReplyingTo);
      const serverMsg = err?.response?.data?.message;
      Alert.alert("Error", serverMsg || err?.message || "Failed to send message.");
    } finally {
      setSending(false);
      setIsUploading(false);
    }
  };

  const messageHasImageAttachment = (msg) =>
    Array.isArray(msg?.attachments) &&
    msg.attachments.some((att) => {
      const mime = att?.type || "";
      const ft = att?.fileType || "";
      return mime.startsWith("image/") || ft === "image" || ft === "gif";
    });

  // --- Render attachment inside a message bubble ---
  const renderMsgAttachments = (
    atts,
    variant = "incoming",
    burstReactionKey = null,
    onBurstDone,
  ) => {
    if (!atts || atts.length === 0) return null;
    return atts.map((att, i) => {
      const url = att.url || att.uri || "";
      const mime = att.type || "";
      const ft = att.fileType || "";
      const isAud =
        mime.startsWith("audio/") || ft === "audio" || ft === "voice";
      const isImg =
        !isAud && (mime.startsWith("image/") || ft === "image" || ft === "gif");
      const isVid =
        !isAud && !isImg && (mime.startsWith("video/") || ft === "video");

      if (isImg) {
        return (
          <View key={`${url}-${i}`} style={{ position: "relative", alignSelf: "flex-start" }}>
            <ChatImageAttachment
              uri={url}
              variant={variant}
              isDark={isDark}
              onPress={() => setImageModalUri(url)}
            />
            {burstReactionKey ? (
              <ReactionBurstOverlay
                reactionKey={burstReactionKey}
                centered
                size={76}
                onDone={onBurstDone}
              />
            ) : null}
          </View>
        );
      }
      if (isVid) {
        return (
          <TouchableOpacity
            key={`${url}-${i}`}
            activeOpacity={0.9}
            onPress={() => setVideoModalUri(url)}
            style={{
              marginTop: 8,
              borderRadius: 12,
              overflow: "hidden",
              width: 220,
              height: 165,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExpoImage
              source={{ uri: url }}
              style={{ width: 220, height: 165 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={url}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="play-circle"
                size={48}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </TouchableOpacity>
        );
      }
      if (isAud) {
        return (
          <VoiceMessagePlayer
            key={`${url}-${i}`}
            uri={url}
            variant={variant}
            isDark={isDark}
          />
        );
      }
      return (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
            backgroundColor: isDark
              ? (variant === "outgoing" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)")
              : "rgba(0,0,0,0.05)",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Ionicons name="document" size={20} color={isDark ? T.textDim : "#6B7280"} />
          <Text
            style={{ marginLeft: 8, color: isDark ? T.textDim : "#6B7280", fontSize: 13 }}
            numberOfLines={1}
          >
            {att.name || "File"}
          </Text>
        </View>
      );
    });
  };

  if (loading) return <MessagesSkeleton isDark={isDark} />;

  const composerSafePad =
    keyboardInset > 0 ? 6 : Math.max(insets.bottom, 10);

  return (
    <View style={{ flex: 1, marginBottom: keyboardInset, ...(isDark ? { backgroundColor: T.surface } : {}) }}>
        <FlashList
          ref={scrollRef}
          data={messages}
          keyExtractor={(item, idx) => item._id || item.id || String(idx)}
          style={isDark ? { flex: 1, backgroundColor: T.surface } : { flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 12,
            ...(isDark ? { backgroundColor: T.surface } : {}),
          }}
          estimatedItemSize={80}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={handleListContentSizeChange}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefreshMessages}
              colors={[isDark ? T.refresh : "#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
          renderItem={({ item: msg }) => {
          const currentUserId = getCurrentUserId();
          const isMe = isOwnMessage(msg);
          const senderInitial = (msg.senderName || "U").charAt(0).toUpperCase();
          const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const messageId = String(msg._id || msg.id || "");
          const showBurst =
            burstMsgId && messageId === burstMsgId && burstReactionKey;

          const isNew = initialLoadDoneRef.current && !knownMsgIdsRef.current.has(messageId);
          if (isNew) knownMsgIdsRef.current.add(messageId);
          const Wrapper = isNew ? Animated.View : View;
          const enterAnim = isNew ? FadeInUp.duration(250).springify().damping(18) : undefined;

          if (isMe) {
            return (
              <Wrapper entering={enterAnim} style={{ alignItems: "flex-end", marginBottom: 12, paddingLeft: 48 }}>
                <View style={{ position: "relative", maxWidth: "100%", alignSelf: "flex-end" }}>
                <SwipeToReply isMe onReply={() => startReplyToMessage(msg)}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleMessagePress(msg)}
                    onLongPress={() => handleLongPress(msg)}
                    delayLongPress={350}
                    style={{ maxWidth: "100%" }}
                  >
                    <View style={{ backgroundColor: "#081126", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderBottomRightRadius: 4, alignSelf: "flex-end", position: "relative" }}>
                      {showBurst && !messageHasImageAttachment(msg) ? (
                        <ReactionBurstOverlay
                          reactionKey={burstReactionKey}
                          centered
                          onDone={() => {
                            setBurstMsgId(null);
                            setBurstReactionKey(null);
                          }}
                        />
                      ) : null}
                      {msg.replyTo ? <ReplyQuote reply={msg.replyTo} variant="outgoing" isDark={isDark} /> : null}
                      {!!msg.message && (
                        <Text style={{ color: "#fff" }}>{msg.message}</Text>
                      )}
                      {renderMsgAttachments(
                        msg.attachments,
                        "outgoing",
                        showBurst && messageHasImageAttachment(msg) ? burstReactionKey : null,
                        () => {
                          setBurstMsgId(null);
                          setBurstReactionKey(null);
                        },
                      )}
                    </View>
                  </TouchableOpacity>
                  <MessageReactionsRow
                    reactions={msg.reactions}
                    currentUserId={currentUserId}
                    align="right"
                    isDark={isDark}
                    onToggle={(key) => handleToggleReaction(msg, key, true)}
                  />
                </SwipeToReply>
                </View>
                <Text style={{ fontSize: 10, color: isDark ? T.textMuted : "#9ca3af", textAlign: "right", marginTop: 2 }}>
                  {timeStr}{msg.isEdited ? " · edited" : ""}
                </Text>
              </Wrapper>
            );
          }

          return (
            <Wrapper entering={enterAnim} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12, paddingRight: 48 }}>
              {/* Avatar */}
              <View style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", backgroundColor: "#081126", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {msg.senderProfileImage ? (
                  <ExpoImage source={{ uri: msg.senderProfileImage }} style={{ width: 32, height: 32 }} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 13 }}>{senderInitial}</Text>
                )}
              </View>
              {/* Bubble */}
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: isDark ? T.textMuted : "#9ca3af", fontSize: 11, marginBottom: 3, marginLeft: 2 }}>{msg.senderName || "User"}</Text>
                <SwipeToReply onReply={() => startReplyToMessage(msg)}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleMessagePress(msg)}
                    onLongPress={() => handleLongPress(msg)}
                    delayLongPress={350}
                  >
                    <View
                      style={{
                        backgroundColor: isDark ? T.surfaceAlt : "#fff",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 18,
                        borderBottomLeftRadius: 4,
                        shadowColor: "#000",
                        shadowOpacity: isDark ? 0 : 0.06,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: isDark ? 0 : 2,
                        position: "relative",
                      }}
                    >
                      {showBurst && !messageHasImageAttachment(msg) ? (
                        <ReactionBurstOverlay
                          reactionKey={burstReactionKey}
                          centered
                          onDone={() => {
                            setBurstMsgId(null);
                            setBurstReactionKey(null);
                          }}
                        />
                      ) : null}
                      {msg.replyTo ? <ReplyQuote reply={msg.replyTo} variant="incoming" isDark={isDark} /> : null}
                      {!!msg.message && (
                        <Text style={{ color: isDark ? T.text : "#1f2937" }}>{msg.message}</Text>
                      )}
                      {renderMsgAttachments(
                        msg.attachments,
                        "incoming",
                        showBurst && messageHasImageAttachment(msg) ? burstReactionKey : null,
                        () => {
                          setBurstMsgId(null);
                          setBurstReactionKey(null);
                        },
                      )}
                    </View>
                  </TouchableOpacity>
                  <MessageReactionsRow
                    reactions={msg.reactions}
                    currentUserId={currentUserId}
                    align="left"
                    isDark={isDark}
                    onToggle={(key) => handleToggleReaction(msg, key, true)}
                  />
                </SwipeToReply>
                <Text style={{ fontSize: 10, color: isDark ? T.textMuted : "#9ca3af", marginTop: 2, marginLeft: 2 }}>
                  {timeStr}{msg.isEdited ? " · edited" : ""}
                </Text>
              </View>
            </Wrapper>
          );
        }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <ExpoImage
                source={TEAM_EMPTY_ICONS.messages}
                style={TEAM_EMPTY_ICON_STYLE}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
              <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", marginTop: 4 }}>No messages yet</Text>
            </View>
          }
        />

        <View
          style={{
            backgroundColor: isDark ? T.surface : "#fff",
            borderTopWidth: 1,
            borderTopColor: isDark ? T.border : "#F3F4F6",
          }}
        >
        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 16,
              paddingTop: 8,
              gap: 8,
              backgroundColor: isDark ? T.surface : "#fff",
            }}
          >
            {attachments.map((att, i) => (
              <AttachmentPreviewThumb
                key={`${att.uri || att.name || "att"}-${i}`}
                attachment={att}
                isDark={isDark}
                onRemove={() => removeAttachment(i)}
              />
            ))}
          </View>
        )}

        {/* Recording indicator */}
        {(isRecording || isPaused) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              backgroundColor: isPaused
                ? (isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7")
                : (isDark ? "rgba(239,68,68,0.18)" : "#FEE2E2"),
              gap: 12,
            }}
          >
            {/* Dot: red when recording, amber when paused */}
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isPaused ? "#F59E0B" : "#EF4444",
              }}
            />
            <Text style={{ color: isPaused ? (isDark ? "#FBBF24" : "#B45309") : (isDark ? "#F87171" : "#EF4444"), fontWeight: "600", fontSize: 15 }}>
              {isPaused ? "Paused" : "Recording"} {formatRecTime(recordingDuration)}
            </Text>
            {/* Cancel */}
            <TouchableOpacity onPress={cancelRecording} style={{ marginLeft: 4 }}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
            {/* Pause / Resume */}
            <TouchableOpacity onPress={isPaused ? resumeRecording : pauseRecording} style={{ marginLeft: 2 }}>
              <Ionicons
                name={isPaused ? "play-circle" : "pause-circle"}
                size={28}
                color={isPaused ? "#F59E0B" : "#EF4444"}
              />
            </TouchableOpacity>
            {/* Stop & save */}
            <TouchableOpacity onPress={stopRecording} style={{ marginLeft: 2 }}>
              <Ionicons name="stop-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Upload progress */}
        {isUploading && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
              backgroundColor: isDark ? "rgba(154,234,98,0.12)" : "#F0FDF4",
              gap: 8,
            }}
          >
            <ActivityIndicator size="small" color={isDark ? T.refresh : "#081126"} />
            <Text style={{ color: isDark ? T.text : "#081126", fontSize: 13 }}>
              Uploading media...
            </Text>
          </View>
        )}

        {/* Reply preview bar */}
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? T.surfaceAlt : "#f0f9ff",
              borderTopWidth: 1,
              borderTopColor: isDark ? T.border : "#e0f2fe",
              paddingHorizontal: 16,
              paddingVertical: 10,
              gap: 10,
            }}
          >
            <View style={{ width: 3, alignSelf: "stretch", backgroundColor: "#9AEA62", borderRadius: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.text : "#081126", marginBottom: 4 }}>
                Replying to {replyingTo.senderName}
              </Text>
              <ReplyQuote reply={replyingTo} variant="composer" compact isDark={isDark} />
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color={isDark ? T.textDim : "#6b7280"} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View
          className={isDark ? "flex-row items-end gap-1 px-3 pt-2" : "flex-row items-end gap-1 px-3 pt-2 bg-white"}
          style={{ paddingBottom: composerSafePad, ...(isDark ? { backgroundColor: T.surface } : {}) }}
        >
        {/* Image picker */}
        <TouchableOpacity
          onPress={pickMedia}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="image-outline" size={22} color={isDark ? T.iconMuted : "#6B7280"} />
        </TouchableOpacity>

        {/* GIF picker */}
        <TouchableOpacity
          onPress={() => setShowGifPicker(true)}
          style={{
            minWidth: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ color: isDark ? T.iconMuted : "#6B7280", fontSize: 12, fontWeight: "800" }}>
            GIF
          </Text>
        </TouchableOpacity>

        {/* Audio recorder */}
        <TouchableOpacity
          onPress={(isRecording || isPaused) ? stopRecording : startRecording}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={(isRecording || isPaused) ? "stop-circle" : "mic-outline"}
            size={22}
            color={(isRecording || isPaused) ? "#EF4444" : (isDark ? T.iconMuted : "#6B7280")}
          />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => {
            isAtBottomRef.current = true;
            scrollToBottom(true, true);
          }}
          placeholder="Type a message..."
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          className={isDark ? "flex-1 rounded-2xl px-4 py-2.5" : "flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-gray-900"}
          style={{
            maxHeight: 100,
            minHeight: 40,
            ...(isDark
              ? { backgroundColor: T.inputBg, color: T.text }
              : {}),
          }}
          multiline
          maxLength={2000}
          blurOnSubmit={false}
          onContentSizeChange={() => {
            if (isAtBottomRef.current) scrollToBottom(true, true);
          }}
        />

        {/* Send button */}
        <TouchableOpacity
          onPress={sendMsg}
          disabled={sending || (!text.trim() && attachments.length === 0)}
          className="w-10 h-10 rounded-full bg-[#081126] items-center justify-center"
          style={{ opacity: text.trim() || attachments.length > 0 ? 1 : 0.4 }}
        >
          {sending ? (
            <ActivityIndicator color="#9AEA62" size="small" />
          ) : (
            <Ionicons name="send" size={16} color="#9AEA62" />
          )}
        </TouchableOpacity>
        </View>
        </View>

      {/* GIF picker modal */}
      <Modal
        visible={showGifPicker}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowGifPicker(false);
          setGifSearchQuery("");
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
            paddingBottom: keyboardInset > 0 ? keyboardInset : 0,
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "78%",
              paddingBottom: Math.max(insets.bottom, 12),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
              }}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: isDark ? T.text : "#111827" }}>GIFs</Text>
                <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280" }}>Powered by GIPHY</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowGifPicker(false);
                  setGifSearchQuery("");
                }}
              >
                <Ionicons name="close" size={22} color={isDark ? T.textDim : "#6B7280"} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
              <TextInput
                value={gifSearchQuery}
                onChangeText={(val) => {
                  setGifSearchQuery(val);
                  if (gifSearchTimeoutRef.current) {
                    clearTimeout(gifSearchTimeoutRef.current);
                  }
                  gifSearchTimeoutRef.current = setTimeout(() => {
                    searchGifs(val);
                  }, 450);
                }}
                placeholder="Search GIFs..."
                placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                style={{
                  backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: isDark ? T.text : "#111827",
                  fontSize: 14,
                }}
              />
            </View>

            {!GIPHY_API_KEY ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 28, alignItems: "center" }}>
                <Text style={{ color: isDark ? T.text : "#111827", fontWeight: "700" }}>GIPHY key missing</Text>
                <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 12, marginTop: 6, textAlign: "center" }}>
                  Add EXPO_PUBLIC_GIPHY_API_KEY in app .env
                </Text>
              </View>
            ) : isLoadingGifs ? (
              <View style={{ paddingVertical: 30, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="small" color={isDark ? T.refresh : "#081126"} />
              </View>
            ) : gifResults.length === 0 ? (
              <View style={{ paddingVertical: 30, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 13 }}>
                  {gifSearchQuery ? "No GIFs found" : "Type to search for GIFs"}
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  paddingHorizontal: 8,
                  paddingBottom: 14,
                }}
              >
                {gifResults.map((gif) => (
                  <TouchableOpacity
                    key={gif.id}
                    activeOpacity={0.85}
                    onPress={() => handleGifSelect(gif)}
                    style={{ width: "33.33%", padding: 4 }}
                  >
                    <Image
                      source={{ uri: gif?.images?.fixed_width_small?.url || gif?.images?.downsized?.url }}
                      style={{ width: "100%", aspectRatio: 1, borderRadius: 8 }}
                      resizeMode="cover"
                      resizeMethod="resize"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Message actions bottom sheet */}
      <BottomSheet
        ref={msgActionSheetRef}
        index={-1}
        snapPoints={[280]}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          ...(isDark ? { backgroundColor: T.surface } : {}),
        }}
        handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
        onChange={(idx) => { if (idx === -1) setSelectedMsg(null); }}
      >
        <BottomSheetView style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            <TouchableOpacity
              onPress={handleReply}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 }}
            >
              <Ionicons name="return-down-back-outline" size={22} color={isDark ? T.text : "#374151"} />
              <Text style={{ fontSize: 16, color: isDark ? T.text : "#374151", marginLeft: 16, fontWeight: "500" }}>Reply</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: isDark ? T.borderSubtle : "#F3F4F6", marginHorizontal: 24 }} />

            <TouchableOpacity
              onPress={handleOpenReact}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 }}
            >
              <Ionicons name="happy-outline" size={22} color={isDark ? T.text : "#374151"} />
              <Text style={{ fontSize: 16, color: isDark ? T.text : "#374151", marginLeft: 16, fontWeight: "500" }}>React</Text>
            </TouchableOpacity>

            {selectedMsg && isOwnMessage(selectedMsg) ? (
              <>
                <View style={{ height: 1, backgroundColor: isDark ? T.borderSubtle : "#F3F4F6", marginHorizontal: 24 }} />
                {messageHasEditableText(selectedMsg) ? (
                  <>
                    <TouchableOpacity
                      onPress={handleOpenEdit}
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 }}
                    >
                      <Ionicons name="create-outline" size={22} color={isDark ? T.text : "#374151"} />
                      <Text style={{ fontSize: 16, color: isDark ? T.text : "#374151", marginLeft: 16, fontWeight: "500" }}>Edit Message</Text>
                    </TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: isDark ? T.borderSubtle : "#F3F4F6", marginHorizontal: 24 }} />
                  </>
                ) : null}
                <TouchableOpacity
                  onPress={handleDeleteMsg}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16 }}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={{ fontSize: 16, color: "#EF4444", marginLeft: 16, fontWeight: "500" }}>Delete Message</Text>
                </TouchableOpacity>
              </>
            ) : null}
        </BottomSheetView>
      </BottomSheet>

      <TelegramReactionPicker
        visible={showReactionPicker}
        isDark={isDark}
        onClose={() => {
          setShowReactionPicker(false);
          setReactionPickerMsg(null);
        }}
        onMore={openMoreActions}
        onSelect={(key) => {
          if (reactionPickerMsg) {
            handleToggleReaction(reactionPickerMsg, key, true);
          }
          setReactionPickerMsg(null);
        }}
      />

      {/* Edit message bottom sheet */}
      <BottomSheet
        ref={editSheetRef}
        index={-1}
        snapPoints={[320]}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          ...(isDark ? { backgroundColor: T.surface } : {}),
        }}
        handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(idx) => { if (idx === -1) { setEditingMsg(null); setEditText(""); } }}
      >
        <BottomSheetView style={{ padding: 20, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 20) }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? T.text : "#111827", marginBottom: 12 }}>Edit Message</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              style={{
                backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: isDark ? T.text : "#111827",
                minHeight: 80,
                maxHeight: 160,
                marginBottom: 12,
              }}
              placeholder="Edit your message..."
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => editSheetRef.current?.close()}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: "center",
                  ...(isDark ? { borderWidth: 1, borderColor: T.border } : {}),
                }}
              >
                <Text style={{ fontWeight: "600", color: isDark ? T.textDim : "#374151" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={editSaving || !editText.trim()}
                style={{ flex: 1, backgroundColor: "#081126", borderRadius: 12, paddingVertical: 13, alignItems: "center", opacity: editSaving || !editText.trim() ? 0.5 : 1 }}
              >
                {editSaving ? <ActivityIndicator color="#9AEA62" size="small" /> : <Text style={{ fontWeight: "700", color: "#9AEA62" }}>Save</Text>}
              </TouchableOpacity>
            </View>
        </BottomSheetView>
      </BottomSheet>

      {imageModalUri ? (
        <ImageViewerModal
          uri={imageModalUri}
          onClose={() => setImageModalUri(null)}
        />
      ) : null}
      {videoModalUri ? (
        <VideoPlayerModal
          uri={videoModalUri}
          onClose={() => setVideoModalUri(null)}
        />
      ) : null}
    </View>
  );
}

// =============================================
// POSTS / MEDIA TAB - Gallery with likes & comments
// =============================================
