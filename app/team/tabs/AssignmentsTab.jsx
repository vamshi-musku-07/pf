import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Dimensions,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { io } from "socket.io-client";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  getAssignmentsByTeamIdAPI,
  createAssignmentAPI,
  deleteAssignmentAPI,
  respondToAssignmentAPI,
  updateAssignmentAPI,
} from "@/services/AssignmentApi";
import { generateAssignmentMessageAPI } from "@/services/ChatbotApi";
import { createMessageAPI } from "@/services/MessageApi";
import {
  computeFairAssignments,
  getDefaultRotationEvent,
  formatEventLabel,
  getRotationEventTitle,
  buildFallbackTeamMessage,
} from "@/lib/assignmentRotator";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { statusBadge, getAssignmentOptionsForSport, PlayerAvatar } from "./helpers";
import { showToast } from "@/context/ToastContext";
import { PLAYER_WS_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";
import { showLocalNotification } from "@/services/PushNotificationService";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

// ── Constants ─────────────────────────────────────────────────────────────────
const ET_COLOR = { game: "#89d9a6", practice: "#708fd1", other: "#c9a276" };
const ET_BG    = { game: "#DCFCE7", practice: "#DBEAFE", other: "#FEF3C7" };
const ET_BG_DARK = {
  game: "rgba(34,197,94,0.18)",
  practice: "rgba(59,130,246,0.2)",
  other: "rgba(245,158,11,0.18)",
};
const ET_COLOR_DARK = { game: "#86EFAC", practice: "#93C5FD", other: "#FBBF24" };
const ET_ICON  = { game: "trophy-outline", practice: "fitness-outline", other: "calendar-outline" };

// Mirror Split Bill (tricount) New Group sheet sizing so the keyboard behaviour
// and button placement are identical across both flows.
const { height: WINDOW_HEIGHT } = Dimensions.get("window");
const CREATE_SHEET_MODAL_MAX_HEIGHT = Math.round(WINDOW_HEIGHT * 0.88);
const CREATE_SHEET_HEADER_HEIGHT = 56;
const CREATE_SHEET_FOOTER_HEIGHT = 88;
const getCreateSheetLayout = (keyboardInset, bottomInset = 0, topInset = 0) => {
  const footerHeight = CREATE_SHEET_FOOTER_HEIGHT + bottomInset;
  const sheetMaxHeight = Math.max(
    280,
    Math.min(
      CREATE_SHEET_MODAL_MAX_HEIGHT,
      WINDOW_HEIGHT - topInset - Math.max(keyboardInset, bottomInset) - 16,
    ),
  );
  const scrollMaxHeight = Math.max(
    120,
    sheetMaxHeight - CREATE_SHEET_HEADER_HEIGHT - footerHeight - 16,
  );
  return { sheetMaxHeight, scrollMaxHeight };
};

const STATUS_CONFIG = {
  pending:   { bg: "#FEF3C7", text: "#92400E", glow: "#FCD34D", icon: "time-outline",           label: "Pending" },
  confirmed: { bg: "#DCFCE7", text: "#166534", glow: "#86EFAC", icon: "checkmark-circle-outline", label: "Confirmed" },
  declined:  { bg: "#FEE2E2", text: "#991B1B", glow: "#FCA5A5", icon: "close-circle-outline",    label: "Declined" },
};

const STATUS_CONFIG_DARK = {
  pending:   { bg: "rgba(245,158,11,0.18)", text: "#FBBF24", glow: "#FCD34D", icon: "time-outline", label: "Pending" },
  confirmed: { bg: "rgba(34,197,94,0.18)", text: "#86EFAC", glow: "#86EFAC", icon: "checkmark-circle-outline", label: "Confirmed" },
  declined:  { bg: "rgba(239,68,68,0.2)", text: "#FCA5A5", glow: "#FCA5A5", icon: "close-circle-outline", label: "Declined" },
};

function getStatusConfig(status, isDark) {
  const map = isDark ? STATUS_CONFIG_DARK : STATUS_CONFIG;
  return map[status] || map.pending;
}

function getEventTypeStyle(eventType, isDark) {
  if (isDark) {
    return {
      color: ET_COLOR_DARK[eventType] || "#A1A1AA",
      bg: ET_BG_DARK[eventType] || "#1E1E24",
    };
  }
  return {
    color: ET_COLOR[eventType] || "#64748B",
    bg: ET_BG[eventType] || "#F1F5F9",
  };
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard({ isDark = false }) {
  const pulse = useRef(new RNAnimated.Value(0.4)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bone = isDark ? "#2A2A2E" : "#E8EDF4";
  const boneAlt = isDark ? "#27272A" : "#F1F5F9";
  const cardBg = isDark ? "#16161A" : "#fff";
  const insetBg = isDark ? "#1E1E24" : "#F8FAFC";
  return (
    <RNAnimated.View
      style={{
        opacity: pulse,
        backgroundColor: cardBg,
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
        ...(isDark
          ? { borderWidth: 1, borderColor: "#2A2A2E" }
          : {
              shadowColor: "#081126",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            }),
      }}
    >
      <View style={{ padding: 14, paddingLeft: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bone, marginRight: 10 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 14, backgroundColor: bone, borderRadius: 7, width: "70%" }} />
            <View style={{ height: 10, backgroundColor: boneAlt, borderRadius: 5, width: "45%" }} />
          </View>
          <View style={{ height: 24, width: 72, backgroundColor: boneAlt, borderRadius: 12 }} />
        </View>
        <View style={{ backgroundColor: insetBg, borderRadius: 12, padding: 10, gap: 8 }}>
          <View style={{ height: 12, backgroundColor: bone, borderRadius: 6, width: "55%" }} />
          <View style={{ height: 12, backgroundColor: bone, borderRadius: 6, width: "40%" }} />
        </View>
      </View>
    </RNAnimated.View>
  );
}

const CARD_SHADOW = {
  shadowColor: "#081126",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

// ── Assignment card ────────────────────────────────────────────────────────────
function AssignmentCard({
  a,
  schedules,
  isOwner,
  isMyAssignment,
  onDelete,
  onEdit,
  onRespond,
  respondModalOpenId,
  isDark = false,
}) {
  const { color, bg } = getEventTypeStyle(a.eventType, isDark);
  const etIcon = ET_ICON[a.eventType] || "calendar-outline";
  const sc = getStatusConfig(a.status, isDark);
  const T = getAppTheme(isDark);

  const linkedEvent = (schedules || []).find(
    (s) => (s._id || s.id) === a.eventId
  );

  const fakePlayer = {
    firstName: a.assignedTo?.split(" ")[0] || "?",
    lastName: a.assignedTo?.split(" ").slice(1).join(" ") || "",
  };

  const eventDate = linkedEvent
    ? new Date(linkedEvent.startDate || linkedEvent.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const isPending = a.status === "pending";
  const isResponding = respondModalOpenId === a._id;

  return (
    <View
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
        borderWidth: isMyAssignment && isPending ? 1.5 : 1,
        borderColor:
          isMyAssignment && isPending
            ? "#B7FF57"
            : isDark
              ? T.border
              : "#EEF2F6",
        ...(isDark ? {} : CARD_SHADOW),
      }}
    >
      <View style={{ padding: 14, paddingLeft: 18 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Ionicons name={etIcon} size={20} color={color} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontWeight: "800",
                fontSize: 15,
                color: isDark ? T.text : "#0F172A",
                lineHeight: 20,
              }}
              numberOfLines={2}
            >
              {a.assignment}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: bg }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color, textTransform: "capitalize" }}>
                  {a.eventType || "event"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 20,
                  backgroundColor: sc.bg,
                }}
              >
                <Ionicons name={sc.icon} size={11} color={sc.text} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: sc.text }}>{sc.label}</Text>
              </View>
            </View>
          </View>

          {isOwner && (
            <View style={{ flexDirection: "row", gap: 4, marginLeft: 6 }}>
              <TouchableOpacity
                onPress={onEdit}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isDark ? T.inputBg : "#F0F4F8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="create-outline" size={15} color={isDark ? T.textDim : "#64748B"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(239,68,68,0.14)" : "#FEF2F2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Assignee + event details */}
        <View
          style={{
            backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
            borderRadius: 12,
            padding: 10,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PlayerAvatar player={fakePlayer} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: isDark ? T.textMuted : "#94A3B8",
                  letterSpacing: 0.6,
                }}
              >
                ASSIGNED TO
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isDark ? T.text : "#0F172A",
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {a.assignedTo || "Unassigned"}
              </Text>
            </View>
            {isMyAssignment && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: isDark ? "rgba(154,234,98,0.18)" : "#E8F8D8",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: isDark ? "#F5F5F7" : "#081126",
                  }}
                >
                  YOU
                </Text>
              </View>
            )}
          </View>

          {linkedEvent && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: isDark ? T.borderSubtle : "#E8EDF4",
              }}
            >
              <Ionicons name="calendar-outline" size={15} color={isDark ? T.textDim : "#64748B"} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: isDark ? T.textDim : "#475569",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {linkedEvent.title || linkedEvent.eventType}
              </Text>
              {eventDate ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isDark ? T.textMuted : "#94A3B8",
                  }}
                >
                  {eventDate}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Items */}
        {a.items?.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: isDark ? T.textMuted : "#94A3B8",
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              ITEMS NEEDED
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {a.items.map((item, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: isDark ? T.surfaceAlt : "#fff",
                    borderWidth: 1,
                    borderColor: isDark ? T.border : "#E2E8F0",
                  }}
                >
                  <Ionicons name="cube-outline" size={11} color={isDark ? T.textDim : "#64748B"} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isDark ? T.text : "#334155",
                    }}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Note */}
        {a.declineNote ? (
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: isOwner && !isMyAssignment
                ? (isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB")
                : (isDark ? "rgba(59,130,246,0.14)" : "#F0F9FF"),
              borderWidth: 1,
              borderColor: isOwner && !isMyAssignment
                ? (isDark ? "rgba(245,158,11,0.35)" : "#FDE68A")
                : (isDark ? "rgba(59,130,246,0.35)" : "#BAE6FD"),
            }}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={
                isOwner && !isMyAssignment
                  ? (isDark ? "#FBBF24" : "#B45309")
                  : (isDark ? "#93C5FD" : "#0369A1")
              }
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color:
                    isOwner && !isMyAssignment
                      ? (isDark ? "#FBBF24" : "#B45309")
                      : (isDark ? "#93C5FD" : "#0369A1"),
                  marginBottom: 2,
                }}
              >
                {isOwner && !isMyAssignment ? "NOTE FROM PLAYER" : "YOUR NOTE"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color:
                    isOwner && !isMyAssignment
                      ? (isDark ? "#FCD34D" : "#92400E")
                      : (isDark ? "#BFDBFE" : "#0C4A6E"),
                  lineHeight: 17,
                }}
              >
                {a.declineNote}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Actions — pending & mine */}
        {isMyAssignment && isPending && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => onRespond("declined")}
              disabled={isResponding}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: isDark ? T.surfaceAlt : "#fff",
                borderWidth: 1.5,
                borderColor: isDark ? "rgba(239,68,68,0.45)" : "#FECACA",
                opacity: isResponding ? 0.6 : 1,
              }}
            >
              <Ionicons name="close-outline" size={16} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13 }}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onRespond("confirmed")}
              disabled={isResponding}
              style={{
                flex: 1.2,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: "#081126",
                opacity: isResponding ? 0.6 : 1,
              }}
            >
              <Ionicons name="checkmark" size={16} color="#B7FF57" />
              <Text style={{ color: "#B7FF57", fontWeight: "800", fontSize: 13 }}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Responded strip */}
        {isMyAssignment && !isPending && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: sc.bg,
            }}
          >
            <Ionicons name={sc.icon} size={15} color={sc.text} />
            <Text style={{ fontWeight: "700", fontSize: 13, color: sc.text }}>
              You {a.status} this assignment
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function AssignmentsTab({
  teamId, teamName, teamSport, players, schedules: rawSchedules, isOwner, refreshing, onRefresh,
  isSelfOwnedOpponent = false, opponentTeamId = null,
}) {
  const assignmentOptions = useMemo(
    () => getAssignmentOptionsForSport(teamSport),
    [teamSport],
  );
  const isCricketTeam = String(teamSport || "").toLowerCase() === "cricket";

  // Deduplicate by _id — merged dual-team schedules can contain the same event twice
  const schedules = rawSchedules
    ? [...new Map(rawSchedules.map((s) => [String(s._id || s.id), s])).values()]
    : [];
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const [assignments, setAssignments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm] = useState({
    assignmentType: "", customTitle: "", assignedToId: "", eventId: "", items: [],
  });
  const [saving, setSaving]             = useState(false);
  const [opponentPlayers, setOpponentPlayers] = useState([]);

  // Unified respond modal — handles both confirm and decline
  const [respondModal, setRespondModal] = useState(null); // { id, status }
  const [noteText, setNoteText]         = useState("");
  const [submittingRespond, setSubmittingRespond] = useState(false);

  // Edit assignment
  const [editingAssignment, setEditingAssignment] = useState(null); // the full assignment object
  const [editForm, setEditForm] = useState({ assignmentType: "", customTitle: "", items: [] });
  const [editSaving, setEditSaving]     = useState(false);

  // Auto-assign fair rotation
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoEventId, setAutoEventId] = useState("");
  const [autoMessage, setAutoMessage] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoPostBusy, setAutoPostBusy] = useState(false);
  const [autoStep, setAutoStep] = useState("preview"); // preview | done
  const autoMessageScrollRef = useRef(null);

  const socketRef = useRef(null);
  const myPlayerIdRef = useRef("");
  const respondSheetRef = useRef(null);
  const editSheetRef = useRef(null);
  const knownAssignmentIdsRef = useRef(new Set());
  const initialAssignmentsLoadedRef = useRef(false);

  const renderSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  // ── Load opponent players ─────────────────────────────────────────────────
  useEffect(() => {
    loadAssignments();
    if (isSelfOwnedOpponent && opponentTeamId) {
      getPlayersByTeamAPI(opponentTeamId)
        .then((r) => {
          const list = r.data || r.players || [];
          setOpponentPlayers(list.map((p) => ({ ...p, _sourceTeamId: opponentTeamId })));
        })
        .catch(() => {});
    }
  }, []);

  // ── Socket.io — listen for new assignment notifications ───────────────────
  useEffect(() => {
    if (!teamId) return;
    const myId = String(backendUser?.id || backendUser?._id || "");

    let socket;
    (async () => {
      try {
        const token = await getAccessToken();
        socket = io(PLAYER_WS_URL, {
          path: "/player-io",
          transports: ["websocket"],
          reconnectionAttempts: 3,
          timeout: 8000,
          auth: { token },
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join-team", teamId);
        });

        const handleNew = (data) => {
          // Only notify if this assignment is for me (check both auth ID and player doc ID)
          const aid = String(data?.assignedToId || "");
          if (aid && aid !== myId && aid !== myPlayerIdRef.current) return;
          showToast(`New assignment: ${data?.assignment || "Check your assignments!"}`, "info");
          showLocalNotification({
            title: "New Assignment",
            body: data?.assignment || "You have a new assignment. Tap to view.",
            data: { teamId, assignmentId: data?._id },
          }).catch(() => {});
          loadAssignments();
        };

        socket.on("assignment:new", handleNew);
      } catch {
        // socket.io not available — silent fail
      }
    })();

    return () => {
      if (socketRef.current) {
        socketRef.current.off("assignment:new");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [teamId, backendUser]);

  const allPlayers = [
    ...(players || []).map((p) => ({ ...p, _sourceTeamId: teamId })),
    ...opponentPlayers,
  ];

  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  // silent=true → keeps existing list visible (used for pull-to-refresh)
  // silent=false → shows skeleton cards (used for initial load)
  const loadAssignments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAssignmentsByTeamIdAPI(teamId);
      let list = res.data || res.assignments || [];

      if (isSelfOwnedOpponent && opponentTeamId) {
        try {
          const oppRes = await getAssignmentsByTeamIdAPI(opponentTeamId);
          const oppList = oppRes.data || oppRes.assignments || [];
          const seen = new Set(list.map((a) => a._id));
          for (const a of oppList) {
            if (!seen.has(a._id)) { seen.add(a._id); list.push(a); }
          }
        } catch {}
      }

      setAssignments(list);
      if (!initialAssignmentsLoadedRef.current) {
        list.forEach((a) => knownAssignmentIdsRef.current.add(String(a._id || a.id || "")));
        initialAssignmentsLoadedRef.current = true;
      }
    } catch {
    } finally {
      if (!silent) setLoading(false);
    }
  }, [teamId, isSelfOwnedOpponent, opponentTeamId]);

  // Pull-to-refresh: keeps list visible, runs loadAssignments silently
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAssignments({ silent: true });
    onRefresh?.();
    setIsRefreshing(false);
  }, [loadAssignments, onRefresh]);

  const coachName = useMemo(() => {
    const u = backendUser;
    if (!u) return "Coach";
    return (
      u.fullname ||
      u.username ||
      u.name ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.email?.split("@")[0] ||
      "Coach"
    );
  }, [backendUser]);

  const rotationSchedules = useMemo(
    () =>
      [...schedules]
        .filter((s) => ["game", "practice", "other"].includes(s.eventType))
        .sort(
          (a, b) =>
            new Date(a.startDate || a.date).getTime() -
            new Date(b.startDate || b.date).getTime(),
        ),
    [schedules],
  );

  const selectedAutoEvent = useMemo(
    () => rotationSchedules.find((s) => String(s._id || s.id) === String(autoEventId)),
    [rotationSchedules, autoEventId],
  );

  const autoPreview = useMemo(() => {
    if (!autoEventId || allPlayers.length === 0 || !selectedAutoEvent) return { picks: [] };
    return computeFairAssignments({
      players: allPlayers,
      assignments,
      schedules,
      assignmentOptions,
      sport: teamSport,
      eventId: autoEventId,
      eventType: selectedAutoEvent.eventType,
      lookbackEvents: 3,
    });
  }, [
    autoEventId,
    allPlayers,
    assignments,
    schedules,
    assignmentOptions,
    teamSport,
    selectedAutoEvent,
  ]);

  const autoModalKeyboardInset = showAutoModal && autoStep === "done" ? keyboardInset : 0;
  const autoModalFooterPad =
    autoModalKeyboardInset > 0 ? 8 : Math.max(insets.bottom + 16, 20);
  const autoSheetMaxHeight = Math.max(
    280,
    Math.min(
      CREATE_SHEET_MODAL_MAX_HEIGHT,
      WINDOW_HEIGHT - insets.top - Math.max(autoModalKeyboardInset, insets.bottom) - 16,
    ),
  );
  const autoScrollMaxHeight = Math.max(
    120,
    autoSheetMaxHeight - CREATE_SHEET_HEADER_HEIGHT - CREATE_SHEET_FOOTER_HEIGHT - 24,
  );

  const openAutoAssignModal = () => {
    if (rotationSchedules.length === 0) {
      Alert.alert(
        "No Events Scheduled",
        "Schedule a game, practice, or other event before using auto-assign.",
        [{ text: "OK" }],
      );
      return;
    }
    if (allPlayers.length === 0) {
      showToast("Add players to your roster first", "error");
      return;
    }
    const defaultEvent = getDefaultRotationEvent(schedules);
    setAutoEventId(
      String(
        defaultEvent?._id ||
          defaultEvent?.id ||
          rotationSchedules[0]?._id ||
          rotationSchedules[0]?.id ||
          "",
      ),
    );
    setAutoMessage("");
    setAutoStep("preview");
    setShowAutoModal(true);
  };

  const handleAutoAssignConfirm = async () => {
    const event = selectedAutoEvent;
    if (!event) {
      showToast("Select an event", "error");
      return;
    }
    if (autoPreview.picks.length === 0) {
      showToast("No duties to assign", "error");
      return;
    }

    setAutoBusy(true);
    try {
      for (const pick of autoPreview.picks) {
        const player = pick.player;
        await createAssignmentAPI({
          assignment: pick.dutyLabel,
          teamId: player?._sourceTeamId || teamId,
          eventId: event._id || event.id,
          eventType: event.eventType,
          assignedTo: pick.playerName,
          assignedToId: player?.userId || player?._id || player?.id || "",
          email: player?.parentEmail || player?.email || "",
          assignedTeamName: teamName || "",
          items: [],
          eventTitle: getRotationEventTitle(event),
          eventDate: formatEventLabel(event),
          eventLocation: event.location || "",
        });
      }

      const eventDate = new Date(event.startDate || event.date);
      const eventDateStr = Number.isNaN(eventDate.getTime())
        ? ""
        : eventDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const eventTitle = getRotationEventTitle(event);

      let messageText = "";
      try {
        const res = await generateAssignmentMessageAPI({
          teamName,
          coachName,
          sport: teamSport,
          eventTitle,
          eventDate: eventDateStr,
          eventType: event.eventType,
          assignments: autoPreview.picks.map((p) => ({
            dutyLabel: p.dutyLabel,
            playerName: p.playerName,
            reason: p.reason,
          })),
        });
        messageText = res?.data?.message || "";
      } catch {
        messageText = buildFallbackTeamMessage({
          teamName,
          coachName,
          eventTitle,
          eventDate: eventDateStr,
          eventType: event.eventType,
          picks: autoPreview.picks,
        });
      }

      if (!messageText) {
        messageText = buildFallbackTeamMessage({
          teamName,
          coachName,
          eventTitle,
          eventDate: eventDateStr,
          eventType: event.eventType,
          picks: autoPreview.picks,
        });
      }

      setAutoMessage(messageText);
      setAutoStep("done");
      showToast("Duties assigned fairly", "success");
      loadAssignments();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to auto-assign", "error");
    } finally {
      setAutoBusy(false);
    }
  };

  const handlePostAutoMessage = async () => {
    if (!autoMessage.trim()) return;
    setAutoPostBusy(true);
    try {
      await createMessageAPI({
        teamId,
        message: autoMessage.trim(),
        messageType: "text",
        senderName: coachName || backendUser?.username || backendUser?.email || "Coach",
      });
      showToast("Posted to team chat", "success");
      setShowAutoModal(false);
      setAutoMessage("");
      setAutoStep("preview");
    } catch {
      showToast("Could not post to team chat", "error");
    } finally {
      setAutoPostBusy(false);
    }
  };

  // ── Create assignment ────────────────────────────────────────────────────
  const openModal = () => {
    if (!schedules || schedules.length === 0) {
      Alert.alert(
        "No Events Scheduled",
        "You need to schedule at least one game or practice before creating an assignment.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    setForm({ assignmentType: "", customTitle: "", assignedToId: "", eventId: "", items: [] });
    Keyboard.dismiss();
    setShowModal(true);
  };

  const handleSave = async () => {
    const titleOpt = assignmentOptions.find((o) => o.value === form.assignmentType);
    const assignmentTitle =
      form.assignmentType === "custom" ? form.customTitle.trim() : titleOpt?.label || "";
    if (!assignmentTitle) { showToast("Please select an assignment type", "error"); return; }
    if (!form.assignedToId) { showToast("Please select a player to assign to", "error"); return; }
    if (!form.eventId) { showToast("Please select an event", "error"); return; }

    const player = allPlayers.find((p) => (p._id || p.id) === form.assignedToId);
    const event  = (schedules || []).find((s) => (s._id || s.id) === form.eventId);
    if (!event) { showToast("Event not found", "error"); return; }

    const assignmentTeamId = player?._sourceTeamId || teamId;
    setSaving(true);
    try {
      await createAssignmentAPI({
        assignment: assignmentTitle,
        teamId: assignmentTeamId,
        eventId: event._id || event.id,
        eventType: event.eventType,
        assignedTo: player ? `${player.firstName} ${player.lastName ? player.lastName : " "}`.trim() : "",
        assignedToId: player?.userId || player?._id || player?.id || "",
        email: player?.parentEmail || player?.email || "",
        assignedTeamName: teamName || "",
        items: form.items.filter(Boolean),
      });
      setShowModal(false);
      showToast("Assignment created", "success");
      loadAssignments();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to create assignment", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit assignment ──────────────────────────────────────────────────────
  const openEdit = (a) => {
    // Try to match existing assignment options or default to "custom"
    const matched = assignmentOptions.find((o) => o.label === a.assignment);
    setEditForm({
      assignmentType: matched ? matched.value : "custom",
      customTitle: matched ? "" : a.assignment,
      items: a.items ? [...a.items] : [],
    });
    setEditingAssignment(a);
    editSheetRef.current?.expand();
  };

  const submitEdit = async () => {
    const titleOpt = assignmentOptions.find((o) => o.value === editForm.assignmentType);
    const assignmentTitle =
      editForm.assignmentType === "custom" ? editForm.customTitle.trim() : titleOpt?.label || "";
    if (!assignmentTitle) { showToast("Please provide a title", "error"); return; }

    setEditSaving(true);
    try {
      await updateAssignmentAPI(editingAssignment._id, {
        teamId: editingAssignment.teamId,
        assignment: assignmentTitle,
        items: editForm.items.filter(Boolean),
      });
      showToast("Assignment updated", "success");
      editSheetRef.current?.close();
      setEditingAssignment(null);
      loadAssignments();
    } catch {
      showToast("Failed to update assignment", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Respond (confirm / decline) ──────────────────────────────────────────
  const closeRespondModal = () => {
    if (submittingRespond) return;
    respondSheetRef.current?.close();
  };

  const openRespondModal = (id, status) => {
    setRespondModal({ id, status });
    setNoteText("");
    respondSheetRef.current?.expand();
  };

  const submitRespond = async (skipNote = false) => {
    if (!respondModal || submittingRespond) return;
    const { id, status } = respondModal;
    const note = skipNote ? undefined : (noteText.trim() || undefined);
    setSubmittingRespond(true);
    try {
      await respondToAssignmentAPI(id, { status, declineNote: note });
      showToast(status === "confirmed" ? "Assignment accepted!" : "Assignment declined", status === "confirmed" ? "success" : "info");
      loadAssignments();
      respondSheetRef.current?.close();
    } catch {
      showToast("Could not update assignment", "error");
    } finally {
      setSubmittingRespond(false);
    }
  };

  const respondModalFooterPad = Math.max(insets.bottom + 16, 20);
  const createModalKeyboardInset = showModal ? keyboardInset : 0;
  const createModalFooterPad = createModalKeyboardInset > 0 ? 8 : Math.max(insets.bottom + 16, 20);
  const {
    sheetMaxHeight: createSheetMaxHeight,
    scrollMaxHeight: createScrollMaxHeight,
  } = getCreateSheetLayout(createModalKeyboardInset, insets.bottom, insets.top);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (a) => {
    Alert.alert("Delete Assignment", `Delete "${a.assignment}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteAssignmentAPI(a._id, a.teamId);
            showToast("Assignment deleted", "info");
            loadAssignments();
          } catch {
            showToast("Failed to delete", "error");
          }
        },
      },
    ]);
  };

  const myId = String(backendUser?.id || backendUser?._id || "");
  // Find the current user's player record in this team (to match old assignments stored with player._id)
  const myPlayerRecord = allPlayers.find(
    (p) => p.userId && String(p.userId) === myId
  );
  const myPlayerId = myPlayerRecord ? String(myPlayerRecord.id || myPlayerRecord._id || "") : "";
  // Keep ref in sync so socket handler always has current value
  myPlayerIdRef.current = myPlayerId;

  const isMyAssignmentFn = (a) => {
    if (!myId) return false;
    const aid = String(a.assignedToId || "");
    return aid === myId || (myPlayerId && aid === myPlayerId);
  };

  const filtered = filter === "all" ? assignments : assignments.filter((a) => a.eventType === filter);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? T.bg : "#F8F9FB" }}>
      {/* Header */}
      <View
        className="px-4 pt-4 pb-4"
        style={{
          backgroundColor: isDark ? T.surface : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? T.borderSubtle : "#F1F5F9",
        }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xl font-bold" style={{ color: isDark ? T.text : "#111827" }}>Assignments</Text>
            <Text className="text-sm mt-0.5" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>{assignments.length} total</Text>
          </View>
          {isOwner && (
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={openAutoAssignModal}
                className="flex-row items-center gap-1.5 px-3 py-2.5 rounded-xl"
                style={
                  isDark
                    ? { backgroundColor: T.surfaceAlt, borderWidth: 1, borderColor: T.border }
                    : { backgroundColor: "#E8F8D8", borderWidth: 1, borderColor: "#B7FF57" }
                }
              >
                <Ionicons name="sparkles" size={15} color={isDark ? T.text : "#081126"} />
                <Text className="font-bold text-xs" style={{ color: isDark ? T.text : "#081126" }}>Auto-assign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openModal}
                className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "#081126" }}
              >
                <Ionicons name="add" size={16} color="#B7FF57" />
                <Text className="font-bold text-sm" style={{ color: "#B7FF57" }}>Assign</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Filter tabs */}
        <View className="flex-row rounded-xl p-1" style={{ backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9" }}>
          {[{ k: "all", l: "All" }, { k: "game", l: "Games" }, { k: "practice", l: "Practice" }, { k: "other", l: "Other" }].map(({ k, l }) => (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              className="flex-1 py-2 rounded-lg items-center"
              style={{ backgroundColor: filter === k ? "#081126" : "transparent" }}
            >
              <Text className="font-semibold text-xs" style={{ color: filter === k ? "#B7FF57" : (isDark ? T.textDim : "#6B7280") }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} isDark={isDark} />)}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[isDark ? T.refresh : "#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          <ExpoImage
            source={TEAM_EMPTY_ICONS.assignments}
            style={[TEAM_EMPTY_ICON_STYLE, { marginBottom: 8 }]}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text className="text-lg font-semibold" style={{ color: isDark ? T.textDim : "#6B7280" }}>No assignments</Text>
          <Text className="text-sm mt-1" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>
            {filter !== "all" ? "Try a different filter" : "Nothing assigned yet"}
          </Text>
          {isOwner && filter === "all" && (
            <TouchableOpacity
              onPress={openModal}
              className="mt-5 px-7 py-3 rounded-xl"
              style={{ backgroundColor: "#B7FF57" }}
            >
              <Text className="font-bold text-base" style={{ color: "#081126" }}>Create Assignment</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[isDark ? T.refresh : "#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          {filtered.map((a, idx) => {
            const isMyAssignment = isMyAssignmentFn(a);
            const aid = String(a._id || a.id || idx);
            const isNew =
              initialAssignmentsLoadedRef.current && !knownAssignmentIdsRef.current.has(aid);
            if (isNew) knownAssignmentIdsRef.current.add(aid);
            const Wrapper = isNew ? Animated.View : View;
            const enterAnim = isNew
              ? FadeInUp.duration(220).springify().damping(18)
              : undefined;
            return (
              <Wrapper key={aid} entering={enterAnim}>
                <AssignmentCard
                  a={a}
                  schedules={schedules}
                  isOwner={isOwner}
                  isMyAssignment={isMyAssignment}
                  onDelete={() => handleDelete(a)}
                  onEdit={() => openEdit(a)}
                  onRespond={(status) => openRespondModal(a._id, status)}
                  respondModalOpenId={respondModal?.id}
                  isDark={isDark}
                />
              </Wrapper>
            );
          })}
          <View className="h-16" />
        </ScrollView>
      )}

      {/* ── Respond bottom sheet (confirm / decline + note) ── */}
      <BottomSheet
        ref={respondSheetRef}
        index={-1}
        snapPoints={[420]}
        enableDynamicSizing={false}
        enablePanDownToClose={!submittingRespond}
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: isDark ? T.surface : "#fff",
        }}
        handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(idx) => { if (idx === -1) { setRespondModal(null); setNoteText(""); } }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: respondModalFooterPad,
          }}
        >
              {respondModal?.status === "confirmed" ? (
                <>
                  <View className="flex-row items-center gap-3 mb-5">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7" }}
                    >
                      <Ionicons name="checkmark-circle" size={22} color={isDark ? "#86EFAC" : "#16A34A"} />
                    </View>
                    <View>
                      <Text className="text-lg font-bold" style={{ color: isDark ? T.text : "#111827" }}>Accept Assignment</Text>
                      <Text className="text-xs" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>You can leave an optional note for your coach</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>NOTE TO COACH (optional)</Text>
                  <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="e.g. I'll be there 10 minutes early!"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    className="rounded-xl px-4 py-3 mb-5"
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                      borderWidth: 1,
                      borderColor: isDark ? T.border : "#E5E7EB",
                      minHeight: 80,
                      textAlignVertical: "top",
                      color: isDark ? T.text : "#1F2937",
                    }}
                    multiline
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={closeRespondModal}
                      disabled={submittingRespond}
                      className="flex-1 py-3.5 rounded-xl items-center"
                      style={{
                        backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        opacity: submittingRespond ? 0.6 : 1,
                      }}
                    >
                      <Text className="font-bold text-sm" style={{ color: isDark ? T.text : "#4B5563" }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => submitRespond(true)}
                      disabled={submittingRespond}
                      className="flex-1 py-3.5 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: isDark ? T.surfaceAlt : "#E0F2FE",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        opacity: submittingRespond ? 0.7 : 1,
                      }}
                    >
                      {submittingRespond ? (
                        <ActivityIndicator size="small" color={isDark ? T.text : "#0284C7"} />
                      ) : (
                        <Text className="font-bold text-sm" style={{ color: isDark ? T.text : "#0284C7" }}>Skip Note</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => submitRespond(false)}
                      disabled={submittingRespond}
                      className="flex-1 flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl"
                      style={{
                        backgroundColor: isDark ? "#081126" : "#16A34A",
                        opacity: submittingRespond ? 0.7 : 1,
                      }}
                    >
                      {submittingRespond ? (
                        <ActivityIndicator size="small" color={isDark ? "#B7FF57" : "#fff"} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={16} color={isDark ? "#B7FF57" : "#fff"} />
                          <Text className="font-bold text-sm" style={{ color: isDark ? "#B7FF57" : "#fff" }}>Accept</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View className="flex-row items-center gap-3 mb-5">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: isDark ? "rgba(239,68,68,0.2)" : "#FEE2E2" }}
                    >
                      <Ionicons name="close-circle" size={22} color="#DC2626" />
                    </View>
                    <View>
                      <Text className="text-lg font-bold" style={{ color: isDark ? T.text : "#111827" }}>Decline Assignment</Text>
                      <Text className="text-xs" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>Let your coach know why (recommended)</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>REASON / NOTE (optional)</Text>
                  <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="e.g. I have a scheduling conflict that day"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    className="rounded-xl px-4 py-3 mb-5"
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                      borderWidth: 1,
                      borderColor: isDark ? T.border : "#E5E7EB",
                      minHeight: 80,
                      textAlignVertical: "top",
                      color: isDark ? T.text : "#1F2937",
                    }}
                    multiline
                  />
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={closeRespondModal}
                      disabled={submittingRespond}
                      className="flex-1 py-3.5 rounded-xl items-center"
                      style={{
                        backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        opacity: submittingRespond ? 0.6 : 1,
                      }}
                    >
                      <Text className="font-bold text-sm" style={{ color: isDark ? T.text : "#4B5563" }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => submitRespond(true)}
                      disabled={submittingRespond}
                      className="flex-1 py-3.5 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: isDark ? T.surfaceAlt : "#FEF3C7",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        opacity: submittingRespond ? 0.7 : 1,
                      }}
                    >
                      {submittingRespond ? (
                        <ActivityIndicator size="small" color={isDark ? T.text : "#92400E"} />
                      ) : (
                        <Text className="font-bold text-sm" style={{ color: isDark ? T.text : "#92400E" }}>Skip Note</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => submitRespond(false)}
                      disabled={submittingRespond}
                      className="flex-1 flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl"
                      style={{ backgroundColor: "#DC2626", opacity: submittingRespond ? 0.7 : 1 }}
                    >
                      {submittingRespond ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="close-circle-outline" size={16} color="#fff" />
                          <Text className="text-white font-bold text-sm">Decline</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
        </BottomSheetView>
      </BottomSheet>

      {/* ── Edit Assignment bottom sheet ── */}
      <BottomSheet
        ref={editSheetRef}
        index={-1}
        snapPoints={["85%"]}
        enableDynamicSizing={false}
        enablePanDownToClose={!editSaving}
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: isDark ? T.surface : "#fff",
        }}
        handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(idx) => { if (idx === -1) setEditingAssignment(null); }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom + 16, 20),
          }}
          keyboardShouldPersistTaps="handled"
        >
              <View className="flex-row items-center justify-between mb-5">
                <View>
                  <Text className="text-xl font-bold" style={{ color: isDark ? T.text : "#111827" }}>Edit Assignment</Text>
                  <Text className="text-xs mt-0.5" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>{editingAssignment?.assignment}</Text>
                </View>
                <TouchableOpacity onPress={() => editSheetRef.current?.close()}>
                  <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
                </TouchableOpacity>
              </View>

              <Text className="text-xs font-bold mb-3" style={{ color: isDark ? T.textMuted : "#6B7280" }}>ASSIGNMENT TYPE *</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {assignmentOptions.map((opt) => {
                  const sel = editForm.assignmentType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setEditForm({ ...editForm, assignmentType: sel ? "" : opt.value })}
                      className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
                      style={{
                        backgroundColor: sel ? "#081126" : (isDark ? T.surfaceAlt : "#F3F4F6"),
                        borderWidth: sel || !isDark ? 0 : 1,
                        borderColor: isDark ? T.border : undefined,
                      }}
                    >
                      <Ionicons name={opt.icon} size={14} color={sel ? "#B7FF57" : (isDark ? T.textMuted : "#9CA3AF")} />
                      <Text className="text-xs font-semibold" style={{ color: sel ? "#B7FF57" : (isDark ? T.textDim : "#6B7280") }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {editForm.assignmentType === "custom" && (
                <>
                  <Text className="text-xs font-bold mb-1" style={{ color: isDark ? T.textMuted : "#6B7280" }}>CUSTOM TITLE *</Text>
                  <TextInput
                    value={editForm.customTitle}
                    onChangeText={(v) => setEditForm({ ...editForm, customTitle: v })}
                    className="rounded-xl px-4 py-3 mb-4"
                    placeholder="Assignment name"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                      borderWidth: isDark ? 1 : 0,
                      borderColor: isDark ? T.border : undefined,
                      color: isDark ? T.text : "#111827",
                    }}
                  />
                </>
              )}

              <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>ITEMS NEEDED (optional)</Text>
              {editForm.items.map((item, i) => (
                <View key={i} className="flex-row items-center gap-2 mb-2">
                  <TextInput
                    value={item}
                    onChangeText={(v) => {
                      const u = [...editForm.items]; u[i] = v;
                      setEditForm({ ...editForm, items: u });
                    }}
                    className="flex-1 rounded-xl px-4 py-2.5"
                    placeholder={`Item ${i + 1}`}
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                      borderWidth: isDark ? 1 : 0,
                      borderColor: isDark ? T.border : undefined,
                      color: isDark ? T.text : "#111827",
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setEditForm({ ...editForm, items: editForm.items.filter((_, j) => j !== i) })}
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: isDark ? "rgba(239,68,68,0.14)" : "#FEF2F2" }}
                  >
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => setEditForm({ ...editForm, items: [...editForm.items, ""] })}
                className="flex-row items-center gap-2 mb-5 py-2"
              >
                <Ionicons name="add-circle-outline" size={18} color={isDark ? T.refresh : "#16A34A"} />
                <Text className="font-semibold text-sm" style={{ color: isDark ? T.refresh : "#15803D" }}>Add item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitEdit}
                disabled={editSaving}
                className="py-4 rounded-xl items-center"
                style={{ backgroundColor: "#2563EB", opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-base text-white">Save Changes</Text>
                )}
              </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Create Assignment modal (matches Split Bill New Group keyboard behavior) ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        hardwareAccelerated
        onRequestClose={() => {
          if (!saving) {
            Keyboard.dismiss();
            setShowModal(false);
          }
        }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: createModalKeyboardInset, backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            activeOpacity={1}
            onPress={() => {
              if (!saving) {
                Keyboard.dismiss();
                setShowModal(false);
              }
            }}
          />
          <View
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: createSheetMaxHeight,
              width: "100%",
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, flexShrink: 0 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold" style={{ color: isDark ? T.text : "#111827" }}>New Assignment</Text>
                {isCricketTeam ? (
                  <Text className="text-xs mt-1" style={{ color: isDark ? T.textDim : "#6B7280" }}>Cricket match-day duties — scorer, umpire, drinks & more</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => {
                    if (!saving) {
                      Keyboard.dismiss();
                      setShowModal(false);
                    }
                  }}
                >
                  <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ maxHeight: createScrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={createModalKeyboardInset > 0}
              nestedScrollEnabled
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 12,
              }}
            >

                <Text className="text-xs font-bold mb-3" style={{ color: isDark ? T.textMuted : "#6B7280" }}>ASSIGNMENT TYPE *</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {assignmentOptions.map((opt) => {
                    const sel = form.assignmentType === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setForm({ ...form, assignmentType: sel ? "" : opt.value })}
                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
                        style={{
                          backgroundColor: sel ? "#081126" : (isDark ? T.surfaceAlt : "#F3F4F6"),
                          borderWidth: sel || !isDark ? 0 : 1,
                          borderColor: isDark ? T.border : undefined,
                        }}
                      >
                        <Ionicons name={opt.icon} size={14} color={sel ? "#B7FF57" : (isDark ? T.textMuted : "#9CA3AF")} />
                        <Text className="text-xs font-semibold" style={{ color: sel ? "#B7FF57" : (isDark ? T.textDim : "#6B7280") }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {form.assignmentType === "custom" && (
                  <>
                    <Text className="text-xs font-bold mb-1" style={{ color: isDark ? T.textMuted : "#6B7280" }}>CUSTOM TITLE *</Text>
                    <TextInput
                      value={form.customTitle}
                      onChangeText={(v) => setForm({ ...form, customTitle: v })}
                      className="rounded-xl px-4 py-3 mb-4"
                      placeholder="Enter assignment name"
                      placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                      style={{
                        backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        color: isDark ? T.text : "#111827",
                      }}
                    />
                  </>
                )}

                <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>ASSIGN TO *</Text>
                <View
                  className="rounded-xl mb-4 overflow-hidden"
                  style={{
                    maxHeight: 180,
                    backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? T.border : undefined,
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {allPlayers.length === 0 ? (
                      <View className="p-4 items-center">
                        <Text className="text-sm" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>No players found</Text>
                      </View>
                    ) : (
                      allPlayers.map((p, pidx) => {
                        const pid = p._id || p.id || `p${pidx}`;
                        const sel = form.assignedToId === pid;
                        return (
                          <TouchableOpacity
                            key={pid}
                            onPress={() => setForm({ ...form, assignedToId: sel ? "" : pid })}
                            className="flex-row items-center justify-between px-4 py-3"
                            style={{
                              borderBottomWidth: pidx < allPlayers.length - 1 ? 1 : 0,
                              borderBottomColor: isDark ? T.borderSubtle : "#F1F5F9",
                              backgroundColor: sel ? "#081126" : "transparent",
                            }}
                          >
                            <View className="flex-row items-center gap-3">
                              <PlayerAvatar player={p} size={32} />
                              <View>
                                <Text className="font-semibold text-sm" style={{ color: sel ? "#B7FF57" : (isDark ? T.text : "#1E293B") }}>
                                  {p.firstName} {p.lastName || " "}
                                </Text>
                                {p.position ? (
                                  <Text className="text-xs" style={{ color: sel ? "#B7FF57" : (isDark ? T.textMuted : "#94A3B8") }}>{p.position}</Text>
                                ) : null}
                              </View>
                            </View>
                            {sel && <Ionicons name="checkmark-circle" size={20} color="#B7FF57" />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>

                <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>LINK TO EVENT *</Text>
                <View
                  className="rounded-xl mb-4 overflow-hidden"
                  style={{
                    maxHeight: 160,
                    backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? T.border : undefined,
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {(schedules || []).length === 0 ? (
                      <View className="p-4 items-center">
                        <Text className="text-sm" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>No events found</Text>
                      </View>
                    ) : (
                      (schedules || []).map((ev, eidx) => {
                        const eid = ev._id || ev.id || `e${eidx}`;
                        const sel = form.eventId === eid;
                        const { color: ec, bg: evBg } = getEventTypeStyle(ev.eventType, isDark);
                        return (
                          <TouchableOpacity
                            key={eid}
                            onPress={() => setForm({ ...form, eventId: sel ? "" : eid })}
                            className="flex-row items-center justify-between px-4 py-3"
                            style={{
                              borderBottomWidth: eidx < schedules.length - 1 ? 1 : 0,
                              borderBottomColor: isDark ? T.borderSubtle : "#F1F5F9",
                              backgroundColor: sel ? "#081126" : "transparent",
                            }}
                          >
                            <View className="flex-row items-center gap-3">
                              <View
                                className="w-8 h-8 rounded-lg items-center justify-center"
                                style={{ backgroundColor: evBg }}
                              >
                                <Ionicons
                                  name={ET_ICON[ev.eventType] || "calendar-outline"}
                                  size={15}
                                  color={ec}
                                />
                              </View>
                              <View>
                                <Text className="font-semibold text-sm" style={{ color: sel ? "#B7FF57" : (isDark ? T.text : "#1E293B") }}>
                                  {ev.title || ev.eventType}
                                </Text>
                                <Text className="text-xs" style={{ color: sel ? "#B7FF57" : (isDark ? T.textMuted : "#94A3B8") }}>
                                  {new Date(ev.startDate || ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </Text>
                              </View>
                            </View>
                            {sel && <Ionicons name="checkmark-circle" size={20} color="#B7FF57" />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>

                <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>ITEMS NEEDED (optional)</Text>
                {form.items.map((item, i) => (
                  <View key={i} className="flex-row items-center gap-2 mb-2">
                    <TextInput
                      value={item}
                      onChangeText={(v) => {
                        const u = [...form.items]; u[i] = v;
                        setForm({ ...form, items: u });
                      }}
                      className="flex-1 rounded-xl px-4 py-2.5"
                      placeholder={`Item ${i + 1}`}
                      placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                      style={{
                        backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                        borderWidth: isDark ? 1 : 0,
                        borderColor: isDark ? T.border : undefined,
                        color: isDark ? T.text : "#111827",
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: isDark ? "rgba(239,68,68,0.14)" : "#FEF2F2" }}
                    >
                      <Ionicons name="close" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setForm({ ...form, items: [...form.items, ""] })}
                  className="flex-row items-center gap-2 mb-2 py-2"
                >
                  <Ionicons name="add-circle-outline" size={18} color={isDark ? T.refresh : "#16A34A"} />
                  <Text className="font-semibold text-sm" style={{ color: isDark ? T.refresh : "#15803D" }}>Add item</Text>
                </TouchableOpacity>
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: createModalFooterPad,
                borderTopWidth: 1,
                borderTopColor: isDark ? T.borderSubtle : "#F3F4F6",
                backgroundColor: isDark ? T.surface : "#fff",
                flexShrink: 0,
              }}
            >
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="py-4 rounded-xl items-center"
                style={{ backgroundColor: "#B7FF57", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#081126" />
                ) : (
                  <Text className="font-bold text-base" style={{ color: "#081126" }}>Create Assignment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Auto-assign fair rotation modal ── */}
      <Modal
        visible={showAutoModal}
        animationType="slide"
        transparent
        hardwareAccelerated
        onRequestClose={() => {
          if (!autoBusy && !autoPostBusy) {
            Keyboard.dismiss();
            setShowAutoModal(false);
          }
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            paddingBottom: autoModalKeyboardInset,
            backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.5)",
          }}
        >
          <TouchableOpacity
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            activeOpacity={1}
            onPress={() => {
              if (!autoBusy && !autoPostBusy) {
                Keyboard.dismiss();
                setShowAutoModal(false);
              }
            }}
          />
          <View
            style={{
              backgroundColor: isDark ? T.surface : "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: autoSheetMaxHeight,
              width: "100%",
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
              <View className="flex-row items-center justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text className="text-xl font-bold" style={{ color: isDark ? T.text : "#111827" }}>Auto-assign fairly</Text>
                  <Text className="text-xs mt-0.5" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>
                    Rotates duties fairly across games, practices & events (last 3 of same type)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!autoBusy && !autoPostBusy) setShowAutoModal(false);
                  }}
                >
                  <Ionicons name="close" size={24} color={isDark ? T.textDim : "#6B7280"} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={autoMessageScrollRef}
              style={{ maxHeight: autoScrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={autoModalKeyboardInset > 0}
              nestedScrollEnabled
            >
              {autoStep === "preview" ? (
                <>
                  <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>SELECT EVENT</Text>
                  <View
                    className="rounded-xl mb-4 overflow-hidden"
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                      borderWidth: isDark ? 1 : 0,
                      borderColor: isDark ? T.border : undefined,
                    }}
                  >
                    {rotationSchedules.map((g, idx) => {
                      const gid = String(g._id || g.id);
                      const sel = autoEventId === gid;
                      return (
                        <TouchableOpacity
                          key={gid}
                          onPress={() => setAutoEventId(gid)}
                          className="px-4 py-3"
                          style={{
                            borderBottomWidth: idx < rotationSchedules.length - 1 ? 1 : 0,
                            borderBottomColor: isDark ? T.borderSubtle : "#F1F5F9",
                            backgroundColor: sel ? "#081126" : "transparent",
                          }}
                        >
                          <Text className="font-semibold text-sm" style={{ color: sel ? "#B7FF57" : (isDark ? T.text : "#1E293B") }}>
                            {formatEventLabel(g)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>PROPOSED DUTIES</Text>
                  {autoPreview.picks.length === 0 ? (
                    <Text className="text-sm" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>No rotation duties available for this sport.</Text>
                  ) : (
                    autoPreview.picks.map((pick) => (
                      <View
                        key={pick.dutyValue}
                        style={{
                          marginBottom: 8,
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                          borderWidth: 1,
                          borderColor: isDark ? T.border : "#E2E8F0",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontWeight: "800", fontSize: 14, color: isDark ? T.text : "#0F172A" }} numberOfLines={1}>
                              {pick.dutyLabel}
                            </Text>
                            <Text style={{ color: isDark ? T.textMuted : "#94A3B8", fontSize: 11, marginTop: 3 }} numberOfLines={2}>
                              {pick.reason}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 10,
                              backgroundColor: "#081126",
                            }}
                          >
                            <Text style={{ fontWeight: "700", fontSize: 12, color: "#B7FF57" }} numberOfLines={1}>
                              {pick.playerName}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </>
              ) : (
                <>
                  <Text className="text-xs font-bold mb-2" style={{ color: isDark ? T.textMuted : "#6B7280" }}>TEAM CHAT MESSAGE</Text>
                  <Text className="text-xs mb-2" style={{ color: isDark ? T.textMuted : "#9CA3AF" }}>
                    From {coachName} — edit before posting
                  </Text>
                  <TextInput
                    value={autoMessage}
                    onChangeText={setAutoMessage}
                    onFocus={() => {
                      setTimeout(() => autoMessageScrollRef.current?.scrollToEnd({ animated: true }), 80);
                    }}
                    multiline
                    className="rounded-xl px-4 py-3"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    style={{
                      minHeight: 160,
                      textAlignVertical: "top",
                      borderWidth: 1,
                      borderColor: isDark ? T.border : "#E5E7EB",
                      backgroundColor: isDark ? T.inputBg : "#F9FAFB",
                      color: isDark ? T.text : "#1F2937",
                    }}
                  />
                </>
              )}
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: autoModalFooterPad,
                gap: 10,
                borderTopWidth: 1,
                borderTopColor: isDark ? T.borderSubtle : "#F3F4F6",
                backgroundColor: isDark ? T.surface : "#fff",
                flexShrink: 0,
              }}
            >
              {autoStep === "preview" ? (
                <TouchableOpacity
                  onPress={handleAutoAssignConfirm}
                  disabled={autoBusy || autoPreview.picks.length === 0}
                  className="py-4 rounded-xl items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: "#B7FF57", opacity: autoBusy || autoPreview.picks.length === 0 ? 0.6 : 1 }}
                >
                  {autoBusy ? (
                    <ActivityIndicator color="#081126" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#081126" />
                      <Text className="font-bold text-base" style={{ color: "#081126" }}>
                        Assign & generate message
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={handlePostAutoMessage}
                    disabled={autoPostBusy || !autoMessage.trim()}
                    className="py-4 rounded-xl items-center flex-row justify-center gap-2"
                    style={{ backgroundColor: "#081126", opacity: autoPostBusy || !autoMessage.trim() ? 0.6 : 1 }}
                  >
                    {autoPostBusy ? (
                      <ActivityIndicator color="#B7FF57" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#B7FF57" />
                        <Text className="font-bold text-base" style={{ color: "#B7FF57" }}>
                          Post to team chat
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowAutoModal(false)}
                    className="py-3 rounded-xl items-center"
                    style={{
                      backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9",
                      borderWidth: isDark ? 1 : 0,
                      borderColor: isDark ? T.border : undefined,
                    }}
                  >
                    <Text className="font-semibold text-sm" style={{ color: isDark ? T.text : "#4B5563" }}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
