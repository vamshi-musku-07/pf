import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  ScrollView,
  Animated,
  Image,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { goBackTo, getBackToParam, BACK_TO_PROFILE } from "@/lib/navigationBack";
import * as ImagePicker from "expo-image-picker";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  createTicketAPI,
  getMyTicketsAPI,
  getTicketMessagesAPI,
  sendTicketMessageAPI,
  closeTicketAPI,
  uploadImageAPI,
} from "@/services/SupportApi";
import {
  initializeSupportSocket,
  joinTicketRoom,
  leaveTicketRoom,
  sendSocketMessage,
  startTyping,
  stopTyping,
  markTicketRead,
  onNewMessage,
  onTicketUpdated,
  onTypingUpdate,
  onAgentJoined,
  removeAllListeners,
  disconnectSupportSocket,
} from "@/services/SupportSocketService";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "general", label: "General", icon: "help-circle-outline" },
  { id: "bug", label: "Bug Report", icon: "bug-outline" },
  { id: "account", label: "Account", icon: "person-outline" },
  { id: "billing", label: "Billing", icon: "card-outline" },
  { id: "feature", label: "Feature Request", icon: "bulb-outline" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#6b7280" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "high", label: "High", color: "#ef4444" },
  { id: "urgent", label: "Urgent", color: "#7c3aed" },
];

const getStatusConfig = (isDark) => ({
  open: {
    label: "Open",
    color: isDark ? "#60A5FA" : "#3b82f6",
    bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#dbeafe",
  },
  in_progress: {
    label: "In Progress",
    color: isDark ? "#FCD34D" : "#f59e0b",
    bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3c7",
  },
  waiting_user: {
    label: "Waiting",
    color: isDark ? "#A78BFA" : "#8b5cf6",
    bg: isDark ? "rgba(139, 92, 246, 0.15)" : "#ede9fe",
  },
  resolved: {
    label: "Resolved",
    color: isDark ? "#34D399" : "#10b981",
    bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#d1fae5",
  },
  closed: {
    label: "Closed",
    color: isDark ? "#9CA3AF" : "#6b7280",
    bg: isDark ? "rgba(107, 114, 128, 0.15)" : "#f3f4f6",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ─── Animated Typing Dots ─────────────────────────────────────────────────────
const TypingDots = () => {
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(Math.max(0, 560 - delay)),
        ])
      );
    const a0 = make(d0, 0);
    const a1 = make(d1, 160);
    const a2 = make(d2, 320);
    a0.start(); a1.start(); a2.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); };
  }, []);

  const dot = (val) => ({
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#9ca3af",
    marginHorizontal: 2,
    opacity: val,
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={dot(d0)} />
      <Animated.View style={dot(d1)} />
      <Animated.View style={dot(d2)} />
    </View>
  );
};

// ─── Ticket List Item ─────────────────────────────────────────────────────────
const TicketItem = ({ ticket, onPress, isDark, T }) => {
  const STATUS_CONFIG = getStatusConfig(isDark);
  const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  return (
    <TouchableOpacity
      onPress={() => onPress(ticket)}
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? T.border : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: T.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{ticket.ticketNumber}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: st.bg }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: st.color }}>
            {st.label}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: T.textMuted, fontSize: 12, textTransform: "capitalize" }}>{ticket.category}</Text>
          {ticket.unreadUser > 0 && (
            <View style={{ backgroundColor: "#3b82f6", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{ticket.unreadUser}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: T.textMuted, fontSize: 12 }}>{fmtTime(ticket.lastActivityAt)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg, myId, isDark, T }) => {
  const isMe = msg.senderId === myId || msg.senderRole === "user";
  const isSystem = msg.senderRole === "system";
  const isImage = msg.contentType === "image";

  if (isSystem) {
    return (
      <View style={{ alignItems: "center", marginVertical: 8 }}>
        <Text style={{ color: T.textMuted, fontSize: 12, backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
          {msg.content}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12, alignItems: isMe ? "flex-end" : "flex-start" }}>
      {!isMe && (
        <Text style={{ color: T.textMuted, fontSize: 11, marginBottom: 4, marginLeft: 4 }}>
          {msg.senderName}{msg.senderRole === "agent" ? " · Support" : ""}
        </Text>
      )}
      <View
        style={{
          maxWidth: "78%",
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 4 : 18,
          borderBottomLeftRadius: isMe ? 18 : 4,
          overflow: "hidden",
          backgroundColor: isMe ? "#9AEA62" : (isDark ? T.surface : "#fff"),
          borderWidth: isDark && !isMe ? 1 : 0,
          borderColor: isDark && !isMe ? T.border : "transparent",
          shadowColor: "#000",
          shadowOpacity: isMe ? 0 : 0.04,
          shadowRadius: 4,
          elevation: isMe ? 0 : 1,
        }}
      >
        {isImage ? (
          <Image
            source={{ uri: msg.content }}
            style={{ width: 220, height: 180 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, lineHeight: 21, color: isMe ? "#1f2937" : T.text }}>
            {msg.content}
          </Text>
        )}
      </View>
      <Text style={{ color: T.textMuted, fontSize: 10, marginTop: 3, marginHorizontal: 4 }}>
        {fmtTime(msg.createdAt)}
      </Text>
    </View>
  );
};

// ─── New Ticket Modal ─────────────────────────────────────────────────────────
const NewTicketModal = ({ visible, onClose, onSubmit, loading, isDark, T }) => {
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

  const reset = () => {
    setSubject(""); setMessage(""); setCategory("general"); setPriority("medium");
  };

  const submit = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Required", "Please fill in subject and message.");
      return;
    }
    onSubmit({ subject, message, category, priority });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? T.bg : "#f9fafb" }} edges={["top", "bottom"]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: isDark ? T.surface : "#fff", borderBottomWidth: 1, borderBottomColor: isDark ? T.border : "#F3F4F6", paddingTop: Math.max(16, insets.top + 4) }}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={{ color: T.textDim, fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color: T.text, fontWeight: "700", fontSize: 17 }}>New Ticket</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            style={{ backgroundColor: "#9AEA62", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ fontWeight: "600", color: "#1f2937", fontSize: 14 }}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: T.text, fontWeight: "600", marginBottom: 8 }}>Subject *</Text>
          <TextInput
            style={{ backgroundColor: isDark ? T.inputBg : "#fff", borderWidth: 1, borderColor: isDark ? T.inputBorder : "#E5E7EB", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: T.text, fontSize: 15, marginBottom: 20 }}
            placeholder="What's your issue about?"
            placeholderTextColor={T.textMuted}
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
          />

          <Text style={{ color: T.text, fontWeight: "600", marginBottom: 8 }}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: category === c.id ? "#9AEA62" : (isDark ? T.surface : "#fff"),
                  borderColor: category === c.id ? "#9AEA62" : (isDark ? T.border : "#E5E7EB"),
                }}
              >
                <Ionicons name={c.icon} size={14} color={category === c.id ? "#1f2937" : T.textDim} />
                <Text style={{ fontSize: 13, fontWeight: "500", color: category === c.id ? "#1f2937" : T.textDim }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: T.text, fontWeight: "600", marginBottom: 8 }}>Priority</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPriority(p.id)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: priority === p.id ? 2 : 1,
                  alignItems: "center",
                  borderColor: priority === p.id ? p.color : (isDark ? T.border : "#E5E7EB"),
                  backgroundColor: priority === p.id ? `${p.color}15` : (isDark ? T.surface : "#fff"),
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "600", textTransform: "capitalize", color: priority === p.id ? p.color : T.textDim }}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: T.text, fontWeight: "600", marginBottom: 8 }}>Describe your issue *</Text>
          <TextInput
            style={{
              backgroundColor: isDark ? T.inputBg : "#fff",
              borderWidth: 1,
              borderColor: isDark ? T.inputBorder : "#E5E7EB",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: T.text,
              fontSize: 15,
              minHeight: 140,
              textAlignVertical: "top",
            }}
            placeholder="Tell us what's happening in detail…"
            placeholderTextColor={T.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CustomerSupport = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const composerSafePad = keyboardInset > 0 ? 6 : Math.max(insets.bottom, 10);
  const { backendUser, isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [view, setView] = useState("list"); // "list" | "chat"
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [pendingImage, setPendingImage] = useState(null); // { uri, mimeType }
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typingInfo, setTypingInfo] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);

  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTypingRef = useRef(false);
  const activeTicketRef = useRef(null);
  const backendUserRef = useRef(null);
  const msgLengthRef = useRef(0);

  // Keep refs in sync — socket callbacks read these to avoid stale closures
  useEffect(() => { activeTicketRef.current = activeTicket; }, [activeTicket]);
  useEffect(() => { backendUserRef.current = backendUser; }, [backendUser]);

  // Scroll to end whenever new messages are added.
  // Using a ref instead of onContentSizeChange so padding/typing-indicator
  // changes do NOT trigger a scroll — only real message additions do.
  useEffect(() => {
    const len = messages.length;
    if (len === 0) {
      msgLengthRef.current = 0;
      return;
    }
    if (len > msgLengthRef.current) {
      const isInitialLoad = msgLengthRef.current === 0;
      // Instant for initial history load, animated for live incoming messages
      flatListRef.current?.scrollToEnd({ animated: !isInitialLoad });
    }
    msgLengthRef.current = len;
  }, [messages.length]);

  useEffect(() => {
    if (keyboardInset > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [keyboardInset]);

  // ── Load tickets ────────────────────────────────────────────────────────────
  const loadTickets = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoadingTickets(true);
    try {
      const { tickets: t } = await getMyTicketsAPI();
      setTickets(t || []);
    } catch (err) {
      console.error("loadTickets:", err.message);
    } finally {
      setLoadingTickets(false);
      setRefreshing(false);
    }
  }, []);

  // ── Initialize socket + register all listeners ─────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    let mounted = true;

    loadTickets();

    // Socket is created asynchronously (needs to await token fetch).
    // Listeners MUST be registered inside .then() — socket is null until then.
    initializeSupportSocket().then((s) => {
      if (!s || !mounted) return;
      setSocketConnected(true);

      // ── message:new ────────────────────────────────────────────────────────
      onNewMessage(({ ticketId, message: msg }) => {
        const cur = activeTicketRef.current;
        if (cur && ticketId.toString() === cur._id.toString()) {
          // Chat is open for this ticket — append message live
          // onContentSizeChange handles auto-scroll when messages change
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === msg._id);
            return exists ? prev : [...prev, msg];
          });
          markTicketRead(ticketId);
        } else {
          // Different ticket or list view — bump unread badge
          setTickets((prev) =>
            prev.map((t) =>
              t._id.toString() === ticketId.toString()
                ? {
                    ...t,
                    lastActivityAt: new Date().toISOString(),
                    unreadUser:
                      msg.senderRole === "agent"
                        ? (t.unreadUser || 0) + 1
                        : t.unreadUser,
                  }
                : t
            )
          );
        }
      });

      // ── ticket:updated (status/priority changes) ───────────────────────────
      onTicketUpdated((ticket) => {
        setTickets((prev) =>
          prev.map((t) => (t._id === ticket._id ? { ...t, ...ticket } : t))
        );
        if (activeTicketRef.current?._id === ticket._id) {
          setActiveTicket((prev) => ({ ...prev, ...ticket }));
        }
      });

      // ── typing:update ──────────────────────────────────────────────────────
      onTypingUpdate(({ ticketId, userId, name, role, isTyping }) => {
        const cur = activeTicketRef.current;
        if (!cur || ticketId.toString() !== cur._id.toString()) return;
        if (userId === backendUserRef.current?.id) return; // ignore own typing
        setTypingInfo(isTyping ? { name, role } : null);
      });

      // ── agent:joined ───────────────────────────────────────────────────────
      onAgentJoined(() => {
        setAgentJoined(true);
        setTimeout(() => setAgentJoined(false), 4000);
      });
    });

    return () => {
      mounted = false;
      removeAllListeners();
      disconnectSupportSocket();
    };
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open ticket chat ────────────────────────────────────────────────────────
  const openTicket = useCallback(async (ticket) => {
    setActiveTicket(ticket);
    setView("chat");
    setLoadingMessages(true);
    setMessages([]);
    setAgentJoined(false);
    setTypingInfo(null);
    setPendingImage(null);

    try {
      const { messages: msgs } = await getTicketMessagesAPI(ticket._id);
      setMessages(msgs || []);
      joinTicketRoom(ticket._id);
      markTicketRead(ticket._id);
      setTickets((prev) =>
        prev.map((t) => (t._id === ticket._id ? { ...t, unreadUser: 0 } : t))
      );
    } catch {
      Alert.alert("Error", "Could not load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Back from chat ──────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (activeTicket) leaveTicketRoom(activeTicket._id);
    // Do NOT call removeAllListeners() here — listeners must stay registered
    // throughout the component lifecycle so messages keep arriving in the list view
    setView("list");
    setActiveTicket(null);
    setMessages([]);
    setTypingInfo(null);
    setPendingImage(null);
    setInputText("");
    loadTickets();
  }, [activeTicket]);

  // ── Pick image ──────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setPendingImage({ uri: asset.uri, mimeType: asset.mimeType || "image/jpeg" });
    }
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    if (!activeTicket) return;

    setInputText("");
    stopTyping(activeTicket._id);
    isTypingRef.current = false;

    // ── Send image ──
    if (pendingImage) {
      const imgToSend = pendingImage;
      setPendingImage(null);

      const optimisticId = `opt-img-${Date.now()}`;
      const optimistic = {
        _id: optimisticId,
        ticketId: activeTicket._id,
        senderId: backendUser?.id || "me",
        senderName: backendUser?.username || "You",
        senderRole: "user",
        content: imgToSend.uri,
        contentType: "image",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setUploading(true);
      try {
        const { url } = await uploadImageAPI(activeTicket._id, imgToSend.uri, imgToSend.mimeType);
        // Send via socket as image message
        const sent = sendSocketMessage(activeTicket._id, url, "image");
        if (!sent) {
          await sendTicketMessageAPI(activeTicket._id, { content: url, contentType: "image" });
        }
        setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      } catch {
        Alert.alert("Upload failed", "Could not send image. Please try again.");
        setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
        setPendingImage(imgToSend);
      } finally {
        setUploading(false);
      }
    }

    // ── Send text ──
    if (text) {
      const optimisticId = `opt-${Date.now()}`;
      const optimistic = {
        _id: optimisticId,
        ticketId: activeTicket._id,
        senderId: backendUser?.id || "me",
        senderName: backendUser?.username || "You",
        senderRole: "user",
        content: text,
        contentType: "text",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const sent = sendSocketMessage(activeTicket._id, text);
      if (!sent) {
        setSending(true);
        try {
          const msg = await sendTicketMessageAPI(activeTicket._id, { content: text });
          setMessages((prev) => prev.map((m) => (m._id === optimisticId ? msg : m)));
        } catch {
          Alert.alert("Error", "Message failed to send.");
          setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
          setInputText(text);
        } finally {
          setSending(false);
        }
      } else {
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
        }, 500);
      }
    }
  }, [inputText, pendingImage, activeTicket, backendUser]);

  // ── Typing events ───────────────────────────────────────────────────────────
  const handleTyping = (text) => {
    setInputText(text);
    if (!activeTicket) return;
    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      startTyping(activeTicket._id);
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        stopTyping(activeTicket._id);
      }
    }, 2500);
    if (text.length === 0 && isTypingRef.current) {
      isTypingRef.current = false;
      stopTyping(activeTicket._id);
    }
  };

  // ── Create ticket ───────────────────────────────────────────────────────────
  const getSupportErrorMessage = (err, fallback) => {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.message;

    if (
      err?.code === "ERR_NETWORK" ||
      !err?.response ||
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      return (
        "Support service is unreachable. Start support-service (port 3008), ensure MongoDB is connected, and keep your Cloudflare tunnel for SUPPORT_API_URL running — or use the LAN URLs in .env for local testing."
      );
    }
    if (status === 401) {
      return "Session expired. Please sign in again and retry.";
    }
    return serverMsg || err?.message || fallback;
  };

  const handleCreateTicket = async (data) => {
    setCreatingTicket(true);
    try {
      const { ticket } = await createTicketAPI({
        ...data,
        userName: backendUser?.username || backendUser?.email || "User",
        userEmail: backendUser?.email,
        userAvatar: null,
      });
      setShowNewTicket(false);
      setTickets((prev) => [ticket, ...prev]);
      openTicket(ticket);
    } catch (err) {
      console.error(
        "[Support] createTicket:",
        err?.response?.status,
        err?.message,
        err?.response?.data,
      );
      Alert.alert(
        "Could not create ticket",
        getSupportErrorMessage(err, "Failed to create ticket. Please try again."),
      );
    } finally {
      setCreatingTicket(false);
    }
  };

  // ── Close ticket ────────────────────────────────────────────────────────────
  const handleCloseTicket = () => {
    Alert.alert("Close Ticket", "Are you sure you want to close this ticket?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: async () => {
          try {
            const updated = await closeTicketAPI(activeTicket._id);
            setActiveTicket(updated);
            setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
          } catch {
            Alert.alert("Error", "Could not close ticket.");
          }
        },
      },
    ]);
  };

  const isClosed = ["resolved", "closed"].includes(activeTicket?.status);

  // ─── RENDER: TICKET LIST ────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? T.bg : "#f3f4f6" }} edges={["top", "bottom"]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={{ backgroundColor: isDark ? T.surface : "#fff", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: isDark ? T.border : "#F3F4F6", paddingTop: 12, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color={T.text} />
            </TouchableOpacity>
            <Text style={{ color: T.text, fontWeight: "700", fontSize: 18 }}>Support</Text>
            <TouchableOpacity
              onPress={() => setShowNewTicket(true)}
              style={{ backgroundColor: "#9AEA62", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            >
              <Text style={{ color: "#1f2937", fontWeight: "600", fontSize: 13 }}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: socketConnected ? "#10b981" : T.textMuted,
            }}
          />
          <Text style={{ color: T.textMuted, fontSize: 12 }}>
            {socketConnected ? "Connected · Real-time active" : "Connecting…"}
          </Text>
        </View>

        {loadingTickets ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#9AEA62" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <MaterialIcons name="support-agent" size={64} color={T.textMuted} />
            <Text style={{ color: T.text, fontWeight: "700", fontSize: 20, marginTop: 16, textAlign: "center" }}>No Support Tickets</Text>
            <Text style={{ color: T.textDim, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
              Having trouble? Create a ticket and our team will help you.
            </Text>
            <TouchableOpacity
              onPress={() => setShowNewTicket(true)}
              style={{ backgroundColor: "#9AEA62", marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}
            >
              <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 15 }}>Create Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(t) => t._id}
            renderItem={({ item }) => <TicketItem ticket={item} onPress={openTicket} isDark={isDark} T={T} />}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadTickets(true)} tintColor="#9AEA62" />
            }
          />
        )}

        <NewTicketModal
          visible={showNewTicket}
          onClose={() => setShowNewTicket(false)}
          onSubmit={handleCreateTicket}
          loading={creatingTicket}
          isDark={isDark}
          T={T}
        />
      </SafeAreaView>
    );
  }

  // ─── RENDER: CHAT ───────────────────────────────────────────────────────────
  const STATUS_CONFIG = getStatusConfig(isDark);
  const st = STATUS_CONFIG[activeTicket?.status] || STATUS_CONFIG.open;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? T.bg : "#f9fafb" }} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {/* Header */}
      <View
        style={{
          backgroundColor: isDark ? T.surface : "#fff",
          paddingTop: 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? T.border : "#f3f4f6",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={goBack} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
              {activeTicket?.subject}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text style={{ color: T.textMuted, fontSize: 11 }}>{activeTicket?.ticketNumber}</Text>
              <View style={{ width: 3, height: 3, backgroundColor: T.borderSubtle, borderRadius: 2 }} />
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: st.bg }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: st.color }}>{st.label}</Text>
              </View>
            </View>
          </View>
          {!isClosed && (
            <TouchableOpacity
              onPress={handleCloseTicket}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: isDark ? T.border : "#e5e7eb", borderRadius: 10 }}
            >
              <Text style={{ color: T.textDim, fontSize: 12 }}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Agent joined toast */}
      {agentJoined && (
        <View style={{ backgroundColor: "#9AEA62", paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: "#1f2937", fontSize: 13, fontWeight: "700", textAlign: "center" }}>
            A support agent has joined ✓
          </Text>
        </View>
      )}

      <View style={{ flex: 1, marginBottom: keyboardInset }}>
        {loadingMessages ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#9AEA62" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(m) => m._id}
            renderItem={({ item }) => (
              <MessageBubble msg={item} myId={backendUser?.id || "me"} isDark={isDark} T={T} />
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Ionicons name="chatbubbles-outline" size={40} color={T.textMuted} />
                <Text style={{ color: T.textDim, marginTop: 12, fontSize: 14 }}>
                  Start the conversation below
                </Text>
              </View>
            }
          />
        )}

        <View
          style={{
            backgroundColor: isDark ? T.surface : "#fff",
            borderTopWidth: 1,
            borderTopColor: isDark ? T.border : "#f3f4f6",
          }}
        >
        {/* Typing indicator */}
        {typingInfo && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
            <TypingDots />
            <Text style={{ color: T.textDim, fontSize: 12 }}>
              {(typingInfo.role === "agent" || typingInfo.role === "admin") ? "Support Agent" : typingInfo.name} is typing…
            </Text>
          </View>
        )}

        {/* Image preview strip */}
        {pendingImage && (
          <View style={{ paddingHorizontal: 12, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ position: "relative" }}>
              <Image
                source={{ uri: pendingImage.uri }}
                style={{ width: 72, height: 72, borderRadius: 10 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setPendingImage(null)}
                style={{
                  position: "absolute", top: -6, right: -6,
                  backgroundColor: "#ef4444", borderRadius: 10,
                  width: 20, height: 20, alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
            {uploading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color="#9AEA62" />
                <Text style={{ color: T.textDim, fontSize: 13 }}>Uploading…</Text>
              </View>
            )}
          </View>
        )}

        {isClosed ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: composerSafePad, alignItems: "center" }}>
            <Text style={{ color: T.textDim, fontSize: 14 }}>
              This ticket is {activeTicket?.status}. Create a new ticket for further help.
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              paddingHorizontal: 10,
              paddingTop: 10,
              paddingBottom: composerSafePad,
              gap: 8,
            }}
          >
            {/* Image picker button */}
            <TouchableOpacity
              onPress={pickImage}
              style={{
                width: 38, height: 38, borderRadius: 19,
                alignItems: "center", justifyContent: "center",
                backgroundColor: isDark ? T.inputBg : "#f3f4f6",
              }}
            >
              <Ionicons name="image-outline" size={20} color={T.textDim} />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              style={{
                flex: 1,
                backgroundColor: isDark ? T.inputBg : "#f3f4f6",
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 15,
                color: T.text,
                maxHeight: 120,
              }}
              placeholder="Type a message…"
              placeholderTextColor={T.textMuted}
              value={inputText}
              onChangeText={handleTyping}
              onFocus={() => flatListRef.current?.scrollToEnd({ animated: true })}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
            />

            {/* Send button */}
            <TouchableOpacity
              onPress={sendMessage}
              disabled={(!inputText.trim() && !pendingImage) || sending || uploading}
              style={{
                width: 38, height: 38, borderRadius: 19,
                alignItems: "center", justifyContent: "center",
                backgroundColor: (inputText.trim() || pendingImage) ? "#9AEA62" : (isDark ? T.surfaceAlt : "#f3f4f6"),
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <Ionicons
                  name="send"
                  size={16}
                  color={(inputText.trim() || pendingImage) ? "#1f2937" : T.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CustomerSupport;
