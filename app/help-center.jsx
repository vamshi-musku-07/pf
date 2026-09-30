import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { sendChatMessageAPI, clearChatAPI } from "@/services/ChatbotApi";
import { goBackTo, getBackToParam, BACK_TO_PROFILE } from "@/lib/navigationBack";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const paramStr = (value) => (Array.isArray(value) ? value[0] : value) || undefined;

const SUGGESTED = [
  "How do I create a team?",
  "How do tournaments work?",
  "What is cricket NRR?",
  "How does the parent portal work?",
  "How do I watch a match as a spectator?",
  "How do I go live stream a game?",
];

const FAQ = [
  {
    q: "How do I create a team?",
    a: "Go to the Teams tab → tap the + button → fill in team details like name, sport, age group and location.",
  },
  {
    q: "How do invitations work?",
    a: "As a coach you can invite players from the Team tab. Players receive notifications and can accept/decline via the Invitations page.",
  },
  {
    q: "How do I record game scores?",
    a: "Open a team → go to Stats tab → select a game → use the score controls to update in real time.",
  },
  {
    q: "How do I set my RSVP / availability?",
    a: "Open your team → tap the RSVP tab → choose your availability status for upcoming events.",
  },
  {
    q: "Can I manage two teams at once?",
    a: "Yes! You can own multiple teams and also be a player in others. Switch between them from the Teams tab.",
  },
  {
    q: "How do tournaments work?",
    a: "Create a tournament from Invitations or Tournaments, enroll teams, generate fixtures, and track Standings, Fixtures, and Bracket tabs.",
  },
  {
    q: "How does the parent portal work?",
    a: "Profile → Parent Portal. Your email must be set as parent contact on your child's player profile by the coach.",
  },
];

function Message({ item, isDark, T }) {
  const isUser = item.role === "user";
  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "80%",
        marginBottom: 10,
      }}
    >
      {!isUser && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "#B7FF57",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="smart-toy" size={14} color="#081126" />
          </View>
          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: "600" }}>Play Flash AI</Text>
        </View>
      )}
      <View
        style={{
          backgroundColor: isUser ? "#081126" : (isDark ? T.surface : "#fff"),
          borderRadius: 16,
          borderTopRightRadius: isUser ? 4 : 16,
          borderTopLeftRadius: isUser ? 16 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
          borderWidth: isDark && !isUser ? 1 : 0,
          borderColor: isDark && !isUser ? T.border : "transparent",
        }}
      >
        <Text
          style={{
            color: isUser ? "#fff" : T.text,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator({ isDark, T }) {
  return (
    <View style={{ alignSelf: "flex-start", marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <View
          style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: "#B7FF57", alignItems: "center", justifyContent: "center",
          }}
        >
          <MaterialIcons name="smart-toy" size={14} color="#081126" />
        </View>
        <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: "600" }}>Play Flash AI</Text>
      </View>
      <View
        style={{
          backgroundColor: isDark ? T.surface : "#fff", borderRadius: 16, borderTopLeftRadius: 4,
          paddingHorizontal: 16, paddingVertical: 12,
          flexDirection: "row", gap: 5, alignItems: "center",
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? T.border : "transparent",
        }}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 7, height: 7, borderRadius: 3.5,
              backgroundColor: T.textMuted,
              opacity: 0.4 + i * 0.2,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function HelpCenter() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const composerSafePad = keyboardInset > 0 ? 6 : Math.max(insets.bottom, 10);
  const flatRef = useRef(null);
  const sessionIdRef = useRef(`help_${Date.now()}`);
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const screenContext = {
    teamId: paramStr(params.teamId),
    sport: paramStr(params.sport),
    tournamentId: paramStr(params.tournamentId),
    role: paramStr(params.role),
    screen: paramStr(params.screen),
  };

  const contextLabel = (() => {
    if (screenContext.tournamentId && screenContext.sport) {
      return `Answering about ${screenContext.sport} tournament`;
    }
    if (screenContext.teamId && screenContext.sport) {
      return `Answering about ${screenContext.sport} team`;
    }
    if (screenContext.screen === "parent_portal") return "Answering for parent portal";
    if (screenContext.sport) return `Answering about ${screenContext.sport}`;
    return null;
  })();

  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      text: "Hi! I'm your Play Flash AI assistant. Ask me anything about the app — creating teams, assignments, game scores, and more! 🏆",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "faq"

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, loading]);

  useEffect(() => {
    if (keyboardInset > 0) {
      scrollToEnd();
      const t = setTimeout(() => scrollToEnd(), 80);
      return () => clearTimeout(t);
    }
  }, [keyboardInset, scrollToEnd]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    const userMsg = { id: Date.now().toString(), role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const context = Object.fromEntries(
        Object.entries(screenContext).filter(([, v]) => v),
      );
      const res = await sendChatMessageAPI(
        msg,
        sessionIdRef.current,
        Object.keys(context).length > 0 ? context : undefined,
      );
      if (res?.data?.sessionId) sessionIdRef.current = res.data.sessionId;
      const reply =
        res?.data?.reply ||
        res?.reply ||
        "Sorry, I couldn't understand that. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: `ai_${Date.now()}`, role: "assistant", text: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: "I'm having trouble connecting right now. Check your internet and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try { await clearChatAPI(sessionIdRef.current); } catch {}
    setMessages([
      {
        id: "intro",
        role: "assistant",
        text: "Hi! I'm your Play Flash AI assistant. How can I help you today? 🏆",
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? T.bg : "#F3F4F6" }}>
      <StatusBar barStyle="light-content" backgroundColor="#081126" translucent={false} />

      {/* Header — dark background extends behind status bar */}
      <View style={{ backgroundColor: "#081126", paddingTop: insets.top }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, BACK_TO_PROFILE)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <View
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: "#B7FF57", alignItems: "center", justifyContent: "center",
          }}
        >
          <MaterialIcons name="smart-toy" size={20} color="#081126" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Help Center</Text>
          <Text style={{ color: "#9CA3AF", fontSize: 11 }}>AI-powered support</Text>
        </View>
        {activeTab === "chat" && (
          <TouchableOpacity
            onPress={handleClear}
            style={{
              paddingHorizontal: 10, paddingVertical: 6,
              backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10,
            }}
          >
            <Text style={{ color: "#9CA3AF", fontSize: 11 }}>Clear</Text>
          </TouchableOpacity>
        )}
        </View>
        {contextLabel ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "rgba(183,255,87,0.15)",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text style={{ color: "#B7FF57", fontSize: 11, fontWeight: "600" }}>{contextLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Tab toggle */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: isDark ? T.surface : "#fff",
          marginHorizontal: 16,
          marginTop: 12,
          borderRadius: 12,
          padding: 4,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark ? T.border : "transparent",
        }}
      >
        {[
          { key: "chat", label: "AI Chat", icon: "chatbubbles-outline" },
          { key: "faq", label: "FAQ", icon: "help-circle-outline" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 9,
              borderRadius: 9,
              backgroundColor: activeTab === t.key ? "#081126" : "transparent",
            }}
          >
            <Ionicons
              name={t.icon}
              size={15}
              color={activeTab === t.key ? "#B7FF57" : (isDark ? T.textMuted : "#9CA3AF")}
            />
            <Text
              style={{
                color: activeTab === t.key ? "#B7FF57" : (isDark ? T.textMuted : "#9CA3AF"),
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "faq" ? (
        /* ── FAQ list ── */
        <FlatList
          data={FAQ}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setActiveTab("chat");
                sendMessage(item.q);
              }}
              style={{
                backgroundColor: isDark ? T.surface : "#fff",
                borderRadius: 16,
                padding: 16,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? T.border : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isDark ? "rgba(183,255,87,0.15)" : "#F0FFF0",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}
                >
                  <Ionicons name="help-circle" size={18} color={isDark ? "#9AEA62" : "#16A34A"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: T.text, fontSize: 14, marginBottom: 4 }}>
                    {item.q}
                  </Text>
                  <Text style={{ color: T.textDim, fontSize: 13, lineHeight: 19 }}>
                    {item.a}
                  </Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={T.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1, marginBottom: keyboardInset }}>
          <FlatList
            ref={flatRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            onContentSizeChange={scrollToEnd}
            renderItem={({ item }) => <Message item={item} isDark={isDark} T={T} />}
            ListFooterComponent={loading ? <TypingIndicator isDark={isDark} T={T} /> : null}
          />

          {messages.length <= 1 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Text
                style={{ color: T.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 8 }}
              >
                SUGGESTED
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTED.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => sendMessage(s)}
                    style={{
                      backgroundColor: isDark ? T.surface : "#fff",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: isDark ? T.border : "#E5E7EB",
                    }}
                  >
                    <Text style={{ color: T.text, fontSize: 12, fontWeight: "500" }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: composerSafePad,
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopWidth: 1,
              borderTopColor: isDark ? T.border : "#F3F4F6",
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={scrollToEnd}
              placeholder="Ask anything about Play Flash…"
              placeholderTextColor={T.textMuted}
              multiline
              blurOnSubmit={false}
              style={{
                flex: 1,
                backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 14,
                color: T.text,
                maxHeight: 100,
              }}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: !input.trim() || loading ? (isDark ? T.surfaceAlt : "#E5E7EB") : "#081126",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {loading
                ? <ActivityIndicator size="small" color={T.textMuted} />
                : <Ionicons name="send" size={18} color={!input.trim() ? T.textMuted : "#B7FF57"} />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
