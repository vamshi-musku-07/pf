import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import GooglePlacesInput from "@/components/GooglePlacesInput";
import KeyboardBottomSheet, { scrollSheetToField } from "@/components/KeyboardBottomSheet";
import { formatLocationFromGeocode } from "@/lib/formatLocation";
import { goBackTo, getBackToParam, BACK_TO_HOME } from "@/lib/navigationBack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addEventCommentAPI,
  addPollAPI,
  addSignupSlotAPI,
  createEventAPI,
  deleteEventAPI,
  deleteEventCommentAPI,
  getEventByIdAPI,
  getEventByShareIdAPI,
  getEventsAPI,
  getMyEventsAPI,
  getJoinedEventsAPI,
  getNearbyEventsAPI,
  joinEventAPI,
  leaveEventAPI,
  removePollAPI,
  removeSignupSlotAPI,
  signUpForSlotAPI,
  updateEventAPI,
  voteOnPollAPI,
  withdrawFromSlotAPI,
} from "@/services/EventApi";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { createEventShareLink, extractEventShareId, shareEventInvite } from "@/lib/shareLinks";
import { clearUpcomingCache } from "@/lib/homeUpcomingCache";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { scanReceiptAPI } from "@/services/TriCountApi";
import {
  addEventPhotoAPI,
  deleteEventPhotoAPI,
  addAnnouncementAPI,
  deleteAnnouncementAPI,
  postRecapAPI,
} from "@/services/EventApi";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Normalize API / form date values to YYYY-MM-DD for inputs and pickers. */
const normalizeEventDateToInput = (dateValue) => {
  if (!dateValue) return "";
  const raw = String(dateValue).trim();
  const isoDay = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) return isoDay[1];
  const d = dateValue instanceof Date ? dateValue : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseEventDateInput = (dateValue) => {
  const normalized = normalizeEventDateToInput(dateValue);
  if (!normalized) return null;
  const d = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatEventDateLabel = (dateValue) => {
  const parsed = parseEventDateInput(dateValue);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatDate = (d) => formatEventDateLabel(d);

const formatDateTime = (date, time) => {
  if (!date) return "";
  const base = formatEventDateLabel(date);
  return time ? `${base}  ${time}` : base;
};

const getEventDateTime = (ev) => {
  if (!ev?.date) return null;
  const d = new Date(ev.date);
  if (Number.isNaN(d.getTime())) return null;
  if (ev.time) {
    const [hh, mm] = String(ev.time).split(":").map(Number);
    d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d;
};

const isEventEnded = (ev) => {
  const dt = getEventDateTime(ev);
  return dt ? dt.getTime() < Date.now() : false;
};

const isEventCancelled = (ev) => String(ev?.status || "").toLowerCase() === "cancelled";

const getParticipantCount = (ev) =>
  Number(ev?.participantCount ?? (Array.isArray(ev?.participants) ? ev.participants.length : 0)) || 0;

const isEventFull = (ev) => {
  const max = Number(ev?.maxParticipants) || 0;
  return max > 0 && getParticipantCount(ev) >= max;
};

const getEventCreatorId = (ev) => {
  const createdBy = ev?.createdBy;
  if (!createdBy) return "";
  if (typeof createdBy === "object") {
    return String(createdBy._id || createdBy.id || createdBy.userId || "");
  }
  return String(createdBy);
};

const isEventOwner = (ev, uid) => {
  if (!uid) return false;
  const creatorId = getEventCreatorId(ev);
  return !!creatorId && String(creatorId) === String(uid);
};

const isUserJoinedEvent = (ev, uid) =>
  isEventOwner(ev, uid) ||
  (!!uid && (ev?.participants || []).some((p) => String(p.userId) === String(uid)));

const isEventPastOrInactive = (ev) => isEventEnded(ev) || isEventCancelled(ev);

const sortEventsForDisplay = (list) => {
  const upcoming = [];
  const past = [];
  for (const ev of list) {
    if (isEventPastOrInactive(ev)) past.push(ev);
    else upcoming.push(ev);
  }
  const asc = (a, b) => (getEventDateTime(a)?.getTime() ?? Infinity) - (getEventDateTime(b)?.getTime() ?? Infinity);
  const desc = (a, b) => (getEventDateTime(b)?.getTime() ?? 0) - (getEventDateTime(a)?.getTime() ?? 0);
  upcoming.sort(asc);
  past.sort(desc);
  return [...upcoming, ...past];
};

const buildEventSections = (sortedList) => {
  const upcoming = sortedList.filter((ev) => !isEventPastOrInactive(ev));
  const past = sortedList.filter((ev) => isEventPastOrInactive(ev));
  const sections = [];
  if (upcoming.length) sections.push({ title: "Explore", data: upcoming });
  if (past.length) sections.push({ title: "Past & cancelled", data: past });
  return sections;
};

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const joined = data.errors
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.message === "string") return item.message;
        if (typeof item?.msg === "string") return item.msg;
        return null;
      })
      .filter(Boolean)
      .join(", ");
    if (joined) return joined;
  }

  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
};

/** Payload shape expected by event-service (Joi) */
const buildEventRecurrence = (recurrence) => {
  const type = recurrence?.type;
  if (!type || type === "none") return undefined;
  const out = { type, interval: Number(recurrence.interval) || 1 };
  const end = recurrence.endDate;
  if (end && String(end).trim()) {
    const parsed = new Date(end);
    if (!Number.isNaN(parsed.getTime())) {
      out.endDate = parsed.toISOString();
    }
  }
  return out;
};

const parseJoinBlockReason = (err) => {
  const msg = getErrorMessage(err, "").toLowerCase();
  if (msg.includes("full")) return "full";
  if (msg.includes("cancelled") || msg.includes("canceled")) return "cancelled";
  if (msg.includes("ended") || msg.includes("already taken place") || msg.includes("past")) return "ended";
  return null;
};

const CREATE_FIELD_MESSAGES = {
  title: "Please enter an event title.",
  date: "Please select a date.",
  time: "Please select a time.",
  location: "Please enter a location.",
};

const parseCreateFormApiErrors = (err) => {
  const errors = {};
  const data = err?.response?.data;
  const lines = [];
  if (typeof data === "string" && data.trim()) lines.push(data.trim());
  if (typeof data?.message === "string" && data.message.trim()) lines.push(data.message.trim());
  if (Array.isArray(data?.errors)) {
    data.errors.forEach((item) => {
      if (typeof item === "string") lines.push(item);
      else if (typeof item?.message === "string") lines.push(item.message);
      else if (typeof item?.msg === "string") lines.push(item.msg);
    });
  }
  const blob = lines.join(" ").toLowerCase();
  Object.keys(CREATE_FIELD_MESSAGES).forEach((field) => {
    if (
      blob.includes(field) &&
      (blob.includes("required") || blob.includes("path `") || blob.includes("must"))
    ) {
      errors[field] = CREATE_FIELD_MESSAGES[field];
    }
  });
  return errors;
};

const validateCreateForm = (form, timeDisplay) => {
  const errors = {};
  if (!form.title?.trim()) errors.title = CREATE_FIELD_MESSAGES.title;
  if (!form.date?.trim()) errors.date = CREATE_FIELD_MESSAGES.date;
  if (!form.time?.trim() && !timeDisplay?.trim()) errors.time = CREATE_FIELD_MESSAGES.time;
  if (!form.location?.trim()) errors.location = CREATE_FIELD_MESSAGES.location;
  return errors;
};

const FieldErrorText = ({ message }) =>
  message ? (
    <Text style={{ color: "#DC2626", fontSize: 12, marginTop: -8, marginBottom: 10, fontWeight: "600" }}>
      {message}
    </Text>
  ) : null;

const CATEGORIES = [
  { label: "Social Event", value: "social event",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Music & Concerts", value: "music",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Food & Drink", value: "food",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Fitness & Wellness", value: "fitness",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Sports", value: "sports",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Gaming & Esports", value: "gaming",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Tech & Hackathon", value: "tech",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Arts & Culture", value: "arts",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Networking", value: "networking",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Outdoor & Adventure", value: "outdoor",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Workshop", value: "workshop",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Volunteer Work", value: "volunteer work",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Fundraiser", value: "fundraiser",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
  { label: "Other", value: "other",barcolor:"black", color: "#e4edf18a", bg: "#010c13" },
];

const getCatConfig = (val) =>
  CATEGORIES.find((c) => c.value === val) || CATEGORIES[CATEGORIES.length - 1];

const CARD_COLORS = ["#CBD87C", "#E95B4F", "#F9CD62", "#CFCAC2"];

// Strava-style dark theme palette
const T = {
  bg: "#0B0B0F",
  surface: "#17171C",
  surfaceAlt: "#1F1F26",
  border: "#26262D",
  accent: "#9AEA62",
  text: "#FFFFFF",
  textDim: "#9CA3AF",
  textFaint: "#6B7280",
  textMuted: "#6B7280",
  onAccent: "#0B0B0F",
  inputBg: "#1F1F26",
  inputBorder: "#26262D",
  overlay: "rgba(0,0,0,0.6)",
};

const getEventsTheme = (isDark) => {
  const base = getAppTheme(isDark);
  return {
    ...base,
    isDark,
    accent: isDark ? "#9AEA62" : "#111827",
    onAccent: isDark ? "#0B1324" : "#FFFFFF",
    textFaint: base.textMuted,
    controlBg: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
    headerGlow: isDark
      ? ["rgba(139,92,246,0.5)", "rgba(139,92,246,0.2)", "rgba(139,92,246,0)"]
      : ["rgba(139,92,246,0.13)", "rgba(139,92,246,0.05)", "rgba(139,92,246,0)"],
  };
};

const CATEGORY_ICONS = {
  "social event": "people",
  music: "musical-notes",
  food: "restaurant",
  fitness: "barbell",
  sports: "football",
  gaming: "game-controller",
  tech: "hardware-chip",
  arts: "color-palette",
  networking: "briefcase",
  outdoor: "trail-sign",
  workshop: "construct",
  "volunteer work": "heart",
  fundraiser: "cash",
  other: "sparkles",
};

const getCategoryIcon = (val) => CATEGORY_ICONS[val] || "sparkles";

// Short labels for the compact grid-card chip so long names don't overflow.
const CATEGORY_SHORT = {
  "social event": "Social",
  music: "Music",
  food: "Food",
  fitness: "Fitness",
  sports: "Sports",
  gaming: "Gaming",
  tech: "Tech",
  arts: "Arts",
  networking: "Network",
  outdoor: "Outdoor",
  workshop: "Workshop",
  "volunteer work": "Volunteer",
  fundraiser: "Fundraiser",
  other: "Other",
};

const getCategoryShort = (val) => CATEGORY_SHORT[val] || getCatConfig(val).label;

// 3D medallion badges shown on the event grid cards.
const CATEGORY_BADGES = {
  "social event": require("../assets/images/cat-badge-social.png"),
  music: require("../assets/images/cat-badge-music.png"),
  food: require("../assets/images/cat-badge-food.png"),
  fitness: require("../assets/images/cat-badge-fitness.png"),
  sports: require("../assets/images/cat-badge-sports.png"),
  gaming: require("../assets/images/cat-badge-gaming.png"),
  tech: require("../assets/images/cat-badge-tech.png"),
  arts: require("../assets/images/cat-badge-arts.png"),
  networking: require("../assets/images/cat-badge-networking.png"),
  outdoor: require("../assets/images/cat-badge-outdoor.png"),
  workshop: require("../assets/images/cat-badge-workshop.png"),
  "volunteer work": require("../assets/images/cat-badge-volunteer.png"),
  fundraiser: require("../assets/images/cat-badge-fundraiser.png"),
  other: require("../assets/images/cat-badge-other.png"),
};

const getCategoryBadge = (val) => CATEGORY_BADGES[val] || CATEGORY_BADGES.other;

// Split a list into rows of two for a 2-column grid.
const chunkPairs = (arr) => {
  const rows = [];
  for (let i = 0; i < arr.length; i += 2) rows.push(arr.slice(i, i + 2));
  return rows;
};

const CategoryPicker = ({ value, onChange, theme = T }) => {
  const [open, setOpen] = useState(false);
  const selected = getCatConfig(value);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: theme.inputBg,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          borderWidth: 1,
          borderColor: theme.inputBorder,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: selected.color,
            }}
          />
          <Text style={{ fontSize: 15, color: theme.text, fontWeight: "600" }}>{selected.label}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textDim} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: "center", padding: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderColor: theme.border }}>
                <Text style={{ fontWeight: "800", fontSize: 16, color: theme.text }}>
                  Select Category
                </Text>
              </View>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    onChange(cat.value);
                    setOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: value === cat.value ? theme.surfaceAlt : theme.surface,
                    borderBottomWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: cat.color,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      color: value === cat.value ? theme.accent : theme.text,
                      fontWeight: value === cat.value ? "800" : "600",
                    }}
                  >
                    {cat.label}
                  </Text>
                  {value === cat.value && (
                    <Ionicons name="checkmark" size={18} color={theme.accent} style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const EventCard = ({ ev, index, userId, joiningId, leavingId, isMyTab, userProfiles, onJoin, onLeave, onDelete, onOpen }) => {
  const cat = getCatConfig(ev.category);
  const cardColor = CARD_COLORS[index % CARD_COLORS.length];
  const count = getParticipantCount(ev);
  const max = Number(ev?.maxParticipants) || 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((count / max) * 100))) : 0;
  const almostFull = max > 0 && pct >= 80;
  const full = isEventFull(ev);
  // Mine tab should never show Join even if owner id data is inconsistent.
  const mine = isMyTab || isEventOwner(ev, userId);
  const isCancelled = isEventCancelled(ev);
  const isOver = isEventEnded(ev);
  const joined = isUserJoinedEvent(ev, userId) && !mine;
  const canJoin = !mine && !isOver && !isCancelled;

  return (
    <View
      style={{
        marginBottom: 18,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
      }}
    >
  

      <TouchableOpacity
        onPress={() => onOpen(ev._id)}
        activeOpacity={0.94}
        style={{
          backgroundColor: isOver || isCancelled ? "#E8E8E8" : cardColor,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isOver || isCancelled ? "#CCCCCC" : "#38393a",
          overflow: "hidden",
          opacity: isOver || isCancelled ? 0.85 : 1,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: isOver ? "#94A3B8" : isCancelled ? "#FCA5A5" : "rgba(255,255,255,0.9)",
          }}
        />

        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isOver || isCancelled ? "rgba(0,0,0,0.05)" : cat.bg,
            borderBottomWidth: 1,
            borderBottomColor: "#E2E8F0",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                backgroundColor: isOver ? "#94A3B8" : isCancelled ? "#EF4444" : cat.color,
              }}
            />
            <Text style={{ color: isOver ? "#64748B" : isCancelled ? "#EF4444" : cat.color, fontSize: 22, fontWeight: "800", textTransform: "uppercase" }}>
              {isCancelled ? "CANCELLED" : isOver ? "ENDED" : cat.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!isOver && !isCancelled && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: almostFull ? "#FEE2E2" : "#EEF2FF",
                  borderWidth: 1,
                  borderColor: almostFull ? "#FCA5A5" : "#C7D2FE",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: almostFull ? "#DC2626" : "#334155" }}>
                  {count}/{max || "inf"}
                </Text>
              </View>
            )}
            {(isOver || isCancelled) && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: isOver ? "#F1F5F9" : "#FEE2E2", borderWidth: 1, borderColor: isOver ? "#CBD5E1" : "#FCA5A5" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: isOver ? "#64748B" : "#EF4444" }}>
                  {count} attended
                </Text>
              </View>
            )}
            {isMyTab && (
              <TouchableOpacity
                onPress={() => onDelete(ev._id)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#FEE2E2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
            <Text style={{ fontSize: 27, fontWeight: "800", color: "#0F172A", flex: 1 }} numberOfLines={2}>
              {ev.title}
            </Text>
      
          </View>

          <View style={{ gap: 7, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="calendar-outline" size={15} color="#111212" />
              <Text style={{ color: "#101011", fontSize: 13 }}>{formatDateTime(ev.date || ev.startDate, ev.time)}</Text>
            </View>
            {!!ev.location && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name="location-outline" size={15} color="#111212" />
                <Text style={{ color: "#101011", fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {ev.location}
                </Text>
                {ev.distanceKm != null && (
                  <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: "600" }}>
                    {ev.distanceKm < 1 ? `${Math.round(ev.distanceKm * 1000)}m` : `${ev.distanceKm}km`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {!!ev.description && (
            <Text style={{ color: "#111111", fontSize: 13, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>
              {ev.description}
            </Text>
          )}

          <View style={{ marginBottom: 12 }}>
            <View
              style={{
                height: 7,
                backgroundColor: "#E2E8F0",
                borderRadius: 999,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#CBD5E1",
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: almostFull ? "#EF4444" : cat.barcolor,
                }}
              />
            </View>
          </View>

          {count > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              {(ev.participants || []).slice(0, 4).map((p, i) => {
                const profile = userProfiles?.[p.userId];
                const initials = (p.name || "?").slice(0, 2).toUpperCase();
                const avatarColors = ["#0F172A", "#7C3AED", "#0369A1", "#B45309"];
                const avatarStyle = {
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: cardColor,
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: 10 - i,
                };
                return profile?.profilePicture ? (
                  <Image
                    key={p.userId || i}
                    source={{ uri: profile.profilePicture }}
                    style={avatarStyle}
                  />
                ) : (
                  <View
                    key={p.userId || i}
                    style={[avatarStyle, { backgroundColor: avatarColors[i % avatarColors.length], alignItems: "center", justifyContent: "center" }]}
                  >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{initials}</Text>
                  </View>
                );
              })}
              {count > 4 && (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(0,0,0,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: cardColor,
                    marginLeft: -10,
                    zIndex: 5,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>+{count - 4}</Text>
                </View>
              )}
              <Text style={{ color: "#1E293B", fontSize: 12, fontWeight: "700", marginLeft: 8 }}>
                {count} joined
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => onOpen(ev._id)}
              style={{
                flex: 1,
                backgroundColor: isOver || isCancelled ? "#F1F5F9" : "#F8FAFC",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                borderRadius: 12,
                paddingVertical: 11,
                alignItems: "center",
                shadowColor: "#94A3B8",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Text style={{ color: isOver || isCancelled ? "#64748B" : "#1E293B", fontSize: 13, fontWeight: "700" }}>
                {isOver ? "View Recap" : "Details"}
              </Text>
            </TouchableOpacity>

            {canJoin && (
              joined ? (
                <TouchableOpacity
                  onPress={() => onLeave(ev._id)}
                  disabled={leavingId === ev._id || joiningId === ev._id}
                  style={{
                    flex: 1,
                    backgroundColor: "#FEE2E2",
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center",
                    opacity: leavingId === ev._id ? 0.7 : 1,
                    shadowColor: "#F87171",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.18,
                    shadowRadius: 3,
                    elevation: 2,
                  }}
                >
                  {leavingId === ev._id ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 13 }}>Leave</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => onJoin(ev._id)}
                  disabled={joiningId === ev._id || full}
                  style={{
                    flex: 1,
                    backgroundColor: full ? "#E2E8F0" : "#0F172A",
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center",
                    opacity: joiningId === ev._id ? 0.7 : 1,
                    shadowColor: "#0F172A",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.22,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  {joiningId === ev._id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <ActivityIndicator size="small" color="#BAF072" />
                      <Text style={{ color: "#BAF072", fontWeight: "800", fontSize: 13 }}>Joining…</Text>
                    </View>
                  ) : (
                    <Text style={{ color: full ? "#64748B" : "#BAF072", fontWeight: "800", fontSize: 13 }}>
                      {full ? "Full" : "Join"}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            )}

            {isOver && !isCancelled && !mine && (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F1F5F9",
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                }}
              >
                <Text style={{ color: "#64748B", fontWeight: "800", fontSize: 13 }}>Ended</Text>
              </View>
            )}

            {mine && !isOver && !isCancelled && (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#BBF7D0",
                }}
              >
                <Text style={{ color: "#16A34A", fontWeight: "800", fontSize: 13 }}>Hosting</Text>
              </View>
            )}

            {isCancelled && !mine && (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FEE2E2",
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#FCA5A5",
                }}
              >
                <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 13 }}>Cancelled</Text>
              </View>
            )}

          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// Strava-style compact grid card used in the events list.
const EventGridCard = ({
  ev,
  userId,
  joiningId,
  leavingId,
  isMyTab,
  onJoin,
  onLeave,
  onDelete,
  onOpen,
  theme = T,
}) => {
  const cat = getCatConfig(ev.category);
  const count = getParticipantCount(ev);
  const max = Number(ev?.maxParticipants) || 0;
  const full = isEventFull(ev);
  const mine = isMyTab || isEventOwner(ev, userId);
  const isCancelled = isEventCancelled(ev);
  const isOver = isEventEnded(ev);
  const joined = isUserJoinedEvent(ev, userId) && !mine;
  const canJoin = !mine && !isOver && !isCancelled;
  const busy = joiningId === ev._id || leavingId === ev._id;
  const badge = getCategoryBadge(ev.category);

  return (
    <TouchableOpacity
      onPress={() => onOpen(ev._id)}
      activeOpacity={0.9}
      style={{
        flex: 1,
        backgroundColor: theme.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        minHeight: 234,
        opacity: isOver || isCancelled ? 0.7 : 1,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Image source={badge} style={{ width: 60, height: 60 }} resizeMode="contain" />
        {isMyTab ? (
          <TouchableOpacity
            onPress={() => onDelete(ev._id)}
            hitSlop={8}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: "rgba(239,68,68,0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="trash-outline" size={15} color="#F87171" />
          </TouchableOpacity>
        ) : (
          <View
            style={{
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: theme.surfaceAlt,
              flexShrink: 1,
              marginLeft: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: theme.textDim, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              {isCancelled ? "Cancelled" : isOver ? "Ended" : getCategoryShort(ev.category)}
            </Text>
          </View>
        )}
      </View>

      <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800", marginTop: 12, lineHeight: 21 }} numberOfLines={2}>
        {ev.title}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
        <Ionicons name="calendar-outline" size={13} color={theme.textFaint} />
        <Text style={{ color: theme.textDim, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {formatDateTime(ev.date || ev.startDate, ev.time)}
        </Text>
      </View>

      {!!ev.location && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <Ionicons name="location-outline" size={13} color={theme.textFaint} />
          <Text style={{ color: theme.textDim, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {ev.location}
          </Text>
        </View>
      )}

      {!!ev.description && (
        <Text style={{ color: theme.textFaint, fontSize: 12, lineHeight: 17, marginTop: 8 }} numberOfLines={2}>
          {ev.description}
        </Text>
      )}

      <View style={{ marginTop: "auto", paddingTop: 12 }}>
        {canJoin ? (
          joined ? (
            <TouchableOpacity
              onPress={() => onLeave(ev._id)}
              disabled={busy}
              style={{
                backgroundColor: "rgba(239,68,68,0.14)",
                borderRadius: 999,
                paddingVertical: 11,
                alignItems: "center",
              }}
            >
              {leavingId === ev._id ? (
                <ActivityIndicator size="small" color="#F87171" />
              ) : (
                <Text style={{ color: "#F87171", fontWeight: "800", fontSize: 13 }}>Leave</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onJoin(ev._id)}
              disabled={busy || full}
              style={{
                backgroundColor: full ? theme.surfaceAlt : theme.accent,
                borderRadius: 999,
                paddingVertical: 11,
                alignItems: "center",
              }}
            >
              {joiningId === ev._id ? (
                <ActivityIndicator size="small" color={theme.onAccent} />
              ) : (
                <Text style={{ color: full ? theme.textDim : theme.onAccent, fontWeight: "800", fontSize: 13 }}>
                  {full ? "Full" : "Join"}
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : (
          <View
            style={{
              backgroundColor: theme.surfaceAlt,
              borderRadius: 999,
              paddingVertical: 11,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: mine && !isOver && !isCancelled ? theme.accent : theme.textDim,
                fontWeight: "800",
                fontSize: 13,
              }}
            >
              {isCancelled ? "Cancelled" : isOver ? "View Recap" : mine ? "Hosting" : "Details"}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Suggested carousel: center card is raised + enlarged, neighbours dip down ──
const SUGG_SCREEN_W = Dimensions.get("window").width;
// Narrower card => a slice of the neighbouring cards peeks in on each side.
const SUGG_CARD_W = Math.round(SUGG_SCREEN_W * 0.74);
const SUGG_SPACING = 2;
const SUGG_SNAP = SUGG_CARD_W + SUGG_SPACING;
// Symmetric side inset so the active card stays perfectly centered.
const SUGG_SIDE = (SUGG_SCREEN_W - 32 - SUGG_SNAP) / 2;

// Compact overflow label for the attendee stack: 3 shown, rest as "+N" / "+1k".
const formatAttendeeOverflow = (n) => {
  if (n >= 1000) return `+${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `+${n}`;
};

const SuggestedCard = ({
  ev,
  scrollX,
  index,
  userId,
  userProfiles,
  joiningId,
  leavingId,
  onJoin,
  onOpen,
  theme = T,
}) => {
  const inputRange = [
    (index - 1) * SUGG_SNAP,
    index * SUGG_SNAP,
    (index + 1) * SUGG_SNAP,
  ];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.94, 1, 0.94],
    extrapolate: "clamp",
  });
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [20, 0, 20],
    extrapolate: "clamp",
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.55, 1, 0.55],
    extrapolate: "clamp",
  });

  const badge = getCategoryBadge(ev.category);
  const mine = isEventOwner(ev, userId);
  const isOver = isEventEnded(ev);
  const isCancelled = isEventCancelled(ev);
  const joined = isUserJoinedEvent(ev, userId) && !mine;
  const full = isEventFull(ev);
  const canJoin = !mine && !isOver && !isCancelled && !joined;
  const count = getParticipantCount(ev);
  const max = Number(ev?.maxParticipants) || 0;

  return (
    <Animated.View
      style={{
        width: SUGG_SNAP,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onOpen(ev._id)}
        style={{
          marginHorizontal: SUGG_SPACING / 2,
          borderRadius: 24,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: theme.isDark ? 0.4 : 0.12,
          shadowRadius: 18,
          elevation: 12,
        }}
      >
        <LinearGradient
          colors={theme.isDark ? ["#20202A", "#141419"] : [theme.surface, theme.bgAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18, minHeight: 218 }}
        >
          {/* Top row: framed badge + attendee avatars + category chip */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 18,
                  backgroundColor: theme.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image source={badge} style={{ width: 52, height: 52 }} resizeMode="contain" />
              </View>

              {count > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {(ev.participants || []).slice(0, 3).map((p, i) => {
                    const profile = userProfiles?.[p.userId];
                    const initials = (profile?.username || profile?.fullname || profile?.name || p.name || "?")
                      .trim()
                      .charAt(0)
                      .toUpperCase();
                    const avatarColors = ["#7C3AED", "#0369A1", "#B45309"];
                    const avatarStyle = {
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      borderWidth: 2,
                      borderColor: theme.surface,
                      marginLeft: i === 0 ? 0 : -11,
                      zIndex: 10 - i,
                    };
                    return profile?.profilePicture ? (
                      <Image key={p.userId || i} source={{ uri: profile.profilePicture }} style={avatarStyle} />
                    ) : (
                      <View
                        key={p.userId || i}
                        style={[avatarStyle, { backgroundColor: avatarColors[i % avatarColors.length], alignItems: "center", justifyContent: "center" }]}
                      >
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{initials}</Text>
                      </View>
                    );
                  })}
                  {count > 3 && (
                    <View
                      style={{
                        height: 30,
                        minWidth: 30,
                        paddingHorizontal: 6,
                        borderRadius: 15,
                        backgroundColor: theme.isDark
                          ? "rgba(154,234,98,0.16)"
                          : "rgba(17,24,39,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: theme.surface,
                        marginLeft: -11,
                        zIndex: 1,
                      }}
                    >
                      <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "800" }}>
                        {formatAttendeeOverflow(count - 3)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: 11,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: theme.isDark
                  ? "rgba(154,234,98,0.14)"
                  : "rgba(17,24,39,0.08)",
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: theme.accent,
                  fontSize: 10,
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {getCategoryShort(ev.category)}
              </Text>
            </View>
          </View>

          <Text
            style={{ color: theme.text, fontSize: 18, fontWeight: "800", lineHeight: 23, marginTop: 14 }}
            numberOfLines={2}
          >
            {ev.title}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 }}>
            <Ionicons name="calendar-outline" size={14} color={theme.accent} />
            <Text style={{ color: theme.textDim, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
              {formatDateTime(ev.date || ev.startDate, ev.time)}
            </Text>
          </View>
          {!!ev.location && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
              <Ionicons name="location-outline" size={14} color={theme.accent} />
              <Text style={{ color: theme.textDim, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
                {ev.location}
              </Text>
            </View>
          )}
          {max > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
              <Ionicons name="people-outline" size={14} color={theme.accent} />
              <Text style={{ color: theme.textDim, fontSize: 12.5 }}>
                {count}/{max} joined
              </Text>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            {canJoin ? (
              <TouchableOpacity
                onPress={() => onJoin(ev._id)}
                disabled={joiningId === ev._id || full}
                style={{
                  backgroundColor: full ? theme.surfaceAlt : theme.accent,
                  borderRadius: 999,
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                {joiningId === ev._id ? (
                  <ActivityIndicator size="small" color={theme.onAccent} />
                ) : (
                  <Text style={{ color: full ? theme.textDim : theme.onAccent, fontWeight: "800", fontSize: 14 }}>
                    {full ? "Full" : "Join Event"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  backgroundColor: theme.surfaceAlt,
                  borderRadius: 999,
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: joined ? theme.accent : theme.textDim,
                    fontWeight: "800",
                    fontSize: 14,
                  }}
                >
                  {isCancelled ? "Cancelled" : isOver ? "View Recap" : joined ? "Joined" : "View Details"}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const SuggestedCarousel = ({
  events,
  userId,
  userProfiles,
  joiningId,
  leavingId,
  onJoin,
  onOpen,
  theme = T,
}) => {
  // Open focused on the 2nd card when there's more than one.
  const initialOffset = events && events.length > 1 ? SUGG_SNAP : 0;
  const scrollX = useRef(new Animated.Value(initialOffset)).current;

  if (!events || events.length === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
        Suggested Events
      </Text>
      <Text style={{ color: theme.textDim, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
        Discover events happening around you
      </Text>
      <Animated.FlatList
        data={events}
        keyExtractor={(ev) => `sugg-${ev._id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SUGG_SNAP}
        decelerationRate="fast"
        contentOffset={{ x: initialOffset, y: 0 }}
        getItemLayout={(_, index) => ({
          length: SUGG_SNAP,
          offset: SUGG_SNAP * index,
          index,
        })}
        contentContainerStyle={{ paddingHorizontal: Math.max(SUGG_SIDE, 0) }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        renderItem={({ item, index }) => (
          <SuggestedCard
            ev={item}
            index={index}
            scrollX={scrollX}
            userId={userId}
            userProfiles={userProfiles}
            joiningId={joiningId}
            leavingId={leavingId}
            onJoin={onJoin}
            onOpen={onOpen}
            theme={theme}
          />
        )}
      />
    </View>
  );
};

export default function EventsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const insets = useSafeAreaInsets();
  const { backendUser, isSignedIn } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getEventsTheme(isDark);
  const styles = getEventStyles(T);
  // Prefer canonical auth userId first (matches createdBy/userId fields in APIs).
  const userId = backendUser?.userId || backendUser?.id || backendUser?._id || "";
  const userName = backendUser?.username || backendUser?.name || backendUser?.email || "User";
  const rawShareId = Array.isArray(params.shareId) ? params.shareId[0] : params.shareId;
  const shareIdParam = typeof rawShareId === "string" ? rawShareId.trim() : "";
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const eventIdParam = typeof rawEventId === "string" ? rawEventId.trim() : "";

  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);
  const handledShareIdRef = useRef("");
  const handledEventIdRef = useRef("");
  const createScrollRef = useRef(null);
  const detailsScrollRef = useRef(null);
  const editScrollRef = useRef(null);
  const createLocationY = useRef(0);
  const createMaxParticipantsY = useRef(0);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const [showDetails, setShowDetails] = useState(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [remindedEventIds, setRemindedEventIds] = useState({});
  const [userProfiles, setUserProfiles] = useState({});

  const [slotForm, setSlotForm] = useState({ title: "", description: "", maxSignups: "10" });
  const [pollForm, setPollForm] = useState({ question: "", optionsText: "" });
  const [commentText, setCommentText] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("loading");

  // Details tabs
  const [detailsTab, setDetailsTab] = useState("info");

  // Photo gallery
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Announcements
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", isPinned: false });
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  // Recap
  const [recapForm, setRecapForm] = useState({ summary: "" });
  const [showRecapForm, setShowRecapForm] = useState(false);
  const [uploadingRecap, setUploadingRecap] = useState(false);

  // Edit event
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", location: "", maxParticipants: "" });
  const [editPickerDate, setEditPickerDate] = useState(new Date());
  const [editShowDatePicker, setEditShowDatePicker] = useState(false);
  const [editShowTimePicker, setEditShowTimePicker] = useState(false);
  const [editTimeDisplay, setEditTimeDisplay] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Cancellation
  const [cancellingEvent, setCancellingEvent] = useState(false);

  // Share QR modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEventLink, setShareEventLink] = useState("");

  // Check-in QR
  const [showCheckinQR, setShowCheckinQR] = useState(false);

  // Join by QR / link
  const [showJoinEvent, setShowJoinEvent] = useState(false);
  const [joinEventTab, setJoinEventTab] = useState("scan");
  const [joinEventUrl, setJoinEventUrl] = useState("");
  const [joiningEvent, setJoiningEvent] = useState(false);
  const [eventScanned, setEventScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    coordinates: null,
    category: "social event",
    maxParticipants: "50",
    recurrence: { type: "none", endDate: "" },
  });

  const [pickerDate, setPickerDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState("");
  const [createFormErrors, setCreateFormErrors] = useState({});
  const [joinBlockedReason, setJoinBlockedReason] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const params = { limit: 50 };
      if (search.trim()) params.search = search.trim();

      const [allRes, myRes, joinedRes] = await Promise.allSettled([getEventsAPI(params), getMyEventsAPI(), getJoinedEventsAPI()]);
      const allEvents = allRes.status === "fulfilled" ? (allRes.value.events || allRes.value.data || []) : [];
      const myEventsData = myRes.status === "fulfilled" ? (myRes.value.events || myRes.value.data || []) : [];
      const joinedEventsData = joinedRes.status === "fulfilled" ? (joinedRes.value.events || joinedRes.value.data || []) : [];

      if (allRes.status === "fulfilled") setEvents(allEvents);
      if (myRes.status === "fulfilled") setMyEvents(myEventsData);
      if (joinedRes.status === "fulfilled") setJoinedEvents(joinedEventsData);

      const ids = new Set();
      [...allEvents, ...myEventsData, ...joinedEventsData].forEach((ev) =>
        (ev.participants || []).forEach((p) => p.userId && ids.add(p.userId))
      );
      if (ids.size > 0) {
        try {
          const profiles = await getUsersByIdsAPI([...ids]);
          setUserProfiles((prev) => ({ ...prev, ...profiles }));
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, search]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchAll();
  }, [fetchAll, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationStatus("denied");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        const city = formatLocationFromGeocode(geo);
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, city });
        setLocationStatus("granted");
        setTab("nearby");
      } catch {
        setLocationStatus("denied");
      }
    })();
  }, [isSignedIn]);

  const fetchNearbyEvents = useCallback(async (locationOverride = userLocation) => {
    if (
      !isSignedIn ||
      !locationOverride?.latitude ||
      !locationOverride?.longitude
    ) {
      setNearbyEvents([]);
      return [];
    }

    setNearbyLoading(true);

    try {
      const params = {
        lat: locationOverride.latitude,
        lng: locationOverride.longitude,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      const data = await getNearbyEventsAPI(params);
      const nextNearbyEvents = data?.events || data?.data || [];
      setNearbyEvents(nextNearbyEvents);

      const participantIds = new Set();
      nextNearbyEvents.forEach((eventItem) => {
        (eventItem.participants || []).forEach((participant) => {
          if (participant.userId) participantIds.add(participant.userId);
        });
      });

      if (participantIds.size > 0) {
        try {
          const profiles = await getUsersByIdsAPI([...participantIds]);
          setUserProfiles((prev) => ({ ...prev, ...profiles }));
        } catch {}
      }

      return nextNearbyEvents;
    } catch {
      const fallbackEvents = locationOverride?.city
        ? events.filter((eventItem) =>
            eventItem.location
              ?.toLowerCase()
              .includes(locationOverride.city.toLowerCase()),
          )
        : [];
      setNearbyEvents(fallbackEvents);
      return fallbackEvents;
    } finally {
      setNearbyLoading(false);
    }
  }, [events, isSignedIn, search, userLocation]);

  useEffect(() => {
    if (!isSignedIn || !userLocation?.latitude || !userLocation?.longitude) return;
    fetchNearbyEvents(userLocation);
  }, [fetchNearbyEvents, isSignedIn, userLocation]);

  const openInMaps = (address) => {
    const encoded = encodeURIComponent(address);
    const url =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?q=${encoded}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open maps"));
  };

  const fetchUserProfiles = useCallback(async (event) => {
    const ids = new Set();
    (event?.participants || []).forEach((participant) => {
      if (participant.userId) ids.add(participant.userId);
    });
    (event?.signupSlots || []).forEach((slot) => {
      (slot.signups || []).forEach((s) => s.userId && ids.add(s.userId));
      (slot.waitlist || []).forEach((s) => s.userId && ids.add(s.userId));
    });
    if (ids.size === 0) return;
    try {
      const profiles = await getUsersByIdsAPI([...ids]);
      setUserProfiles((prev) => ({ ...prev, ...profiles }));
    } catch {}
  }, []);

  const refreshEventDetails = useCallback(async (eventId) => {
    const data = await getEventByIdAPI(eventId);
    const event = data?.event || data;
    setSelectedEvent(event);
    fetchUserProfiles(event);
    return event;
  }, [fetchUserProfiles]);

  const openEventDetails = useCallback(async (eventId) => {
    setShowDetails(true);
    setDetailsTab("info");
    setJoinBlockedReason(null);
    setDetailsLoading(true);
    try {
      await refreshEventDetails(eventId);
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to load event details"));
      setShowDetails(false);
    } finally {
      setDetailsLoading(false);
    }
  }, [refreshEventDetails]);

  useEffect(() => {
    if (
      !isSignedIn ||
      !eventIdParam ||
      handledEventIdRef.current === eventIdParam
    ) {
      return;
    }

    handledEventIdRef.current = eventIdParam;
    openEventDetails(eventIdParam);
  }, [eventIdParam, isSignedIn, openEventDetails]);

  useEffect(() => {
    if (!isSignedIn || !shareIdParam || handledShareIdRef.current === shareIdParam) {
      return;
    }

    handledShareIdRef.current = shareIdParam;

    (async () => {
      setShowDetails(true);
      setDetailsLoading(true);

      try {
        const data = await getEventByShareIdAPI(shareIdParam);
        const sharedEvent = data?.event || data;

        if (!sharedEvent?._id) {
          throw new Error("Shared event is unavailable");
        }

        setSelectedEvent(sharedEvent);
        fetchUserProfiles(sharedEvent);
      } catch (err) {
        setShowDetails(false);
        Alert.alert(
          "Invite Error",
          getErrorMessage(err, "This event invite is no longer available."),
        );
      } finally {
        setDetailsLoading(false);
      }
    })();
  }, [fetchUserProfiles, isSignedIn, shareIdParam]);

  const handleSearchChange = (text) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(text), 400);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      fetchAll(),
      userLocation?.latitude && userLocation?.longitude
        ? fetchNearbyEvents(userLocation)
        : Promise.resolve([]),
    ]);
    if (selectedEvent?._id) {
      try {
        await refreshEventDetails(selectedEvent._id);
      } catch {}
    }
    setRefreshing(false);
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      category: "social event",
      maxParticipants: "50",
      recurrence: { type: "none", endDate: "" },
    });
    setPickerDate(new Date());
    setTimeDisplay("");
    setCreateFormErrors({});
  };

  const clearCreateFieldError = (field) => {
    setCreateFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const onDateChange = (event, selected) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") return;
    if (selected) {
      setPickerDate(selected);
      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, "0");
      const dd = String(selected.getDate()).padStart(2, "0");
      setForm((prev) => ({ ...prev, date: `${yyyy}-${mm}-${dd}` }));
      clearCreateFieldError("date");
    }
  };

  const onTimeChange = (event, selected) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (event.type === "dismissed") return;
    if (selected) {
      setPickerDate(selected);
      const hh = String(selected.getHours()).padStart(2, "0");
      const min = String(selected.getMinutes()).padStart(2, "0");
      const hours12 = selected.getHours() % 12 || 12;
      const ampm = selected.getHours() < 12 ? "AM" : "PM";
      setTimeDisplay(`${String(hours12).padStart(2, "0")}:${min} ${ampm}`);
      setForm((prev) => ({ ...prev, time: `${hh}:${min}` }));
      clearCreateFieldError("time");
    }
  };

  const handleCreate = async () => {
    const fieldErrors = validateCreateForm(form, timeDisplay);
    if (Object.keys(fieldErrors).length > 0) {
      setCreateFormErrors(fieldErrors);
      if (fieldErrors.title) scrollSheetToField(createScrollRef, 0);
      else if (fieldErrors.date || fieldErrors.time) scrollSheetToField(createScrollRef, createLocationY.current ? createLocationY.current * 0.35 : 120);
      else if (fieldErrors.location) scrollSheetToField(createScrollRef, createLocationY.current);
      return;
    }
    setCreateFormErrors({});

    setCreating(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        date: form.date.trim(),
        time: form.time.trim(),
        location: form.location.trim(),
        category: form.category,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants, 10) : 50,
        creatorName: userName,
        ...(form.coordinates ? { coordinates: form.coordinates } : {}),
        recurrence: buildEventRecurrence(form.recurrence),
      };
      await createEventAPI(payload);
      setShowCreate(false);
      resetForm();
      await fetchAll();
    } catch (err) {
      const apiFieldErrors = parseCreateFormApiErrors(err);
      if (Object.keys(apiFieldErrors).length > 0) {
        setCreateFormErrors(apiFieldErrors);
      } else {
        const msg = getErrorMessage(err, "Something went wrong. Please check the form and try again.");
        const needsServerUpdate = /recurrence.*not allowed/i.test(msg);
        Alert.alert(
          "Couldn't create event",
          needsServerUpdate
            ? "Repeating events need the latest event-service on your server. Redeploy event-service (same as you did for opponents), then try again."
            : msg,
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const showJoinBlocked = (reason, fromCard) => {
    setJoinBlockedReason(reason);
    if (!fromCard) return;
    const title =
      reason === "cancelled" ? "Event cancelled"
      : reason === "ended" ? "Event ended"
      : reason === "full" ? "Event full"
      : "Can't join";
    const message =
      reason === "cancelled" ? "This event has been cancelled and is no longer accepting participants."
      : reason === "ended" ? "This event has already taken place."
      : reason === "full" ? "This event has reached its participant limit."
      : "This event is no longer accepting participants.";
    Alert.alert(title, message);
  };

  const handleJoin = async (eventId, evSnapshot) => {
    if (joiningId || leavingId) return;
    const isDetailsOpen = selectedEvent?._id === eventId && showDetails;
    const fromCard = !isDetailsOpen;

    const ev =
      evSnapshot ||
      (isDetailsOpen ? selectedEvent : null) ||
      events.find((e) => e._id === eventId) ||
      myEvents.find((e) => e._id === eventId) ||
      joinedEvents.find((e) => e._id === eventId) ||
      nearbyEvents.find((e) => e._id === eventId);

    if (ev && isEventCancelled(ev)) {
      showJoinBlocked("cancelled", fromCard);
      return;
    }
    if (ev && isEventEnded(ev)) {
      showJoinBlocked("ended", fromCard);
      return;
    }
    if (ev && isEventFull(ev)) {
      showJoinBlocked("full", fromCard);
      return;
    }

    setJoinBlockedReason(null);
    setJoiningId(eventId);
    try {
      await joinEventAPI(eventId, userName);
      await clearUpcomingCache();
      await fetchAll();
      if (selectedEvent?._id === eventId) await refreshEventDetails(eventId);
    } catch (err) {
      const blockReason = parseJoinBlockReason(err);
      if (blockReason) {
        showJoinBlocked(blockReason, fromCard);
      } else if (fromCard) {
        Alert.alert("Couldn't join", getErrorMessage(err, "Please try again in a moment."));
      } else {
        Alert.alert("Couldn't join", getErrorMessage(err, "Please try again in a moment."));
      }
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = (eventId) => {
    if (leavingId || joiningId) return;
    Alert.alert("Leave Event", "Are you sure you want to leave this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setLeavingId(eventId);
          try {
            await leaveEventAPI(eventId);
            await clearUpcomingCache();
            await fetchAll();
            if (selectedEvent?._id === eventId) await refreshEventDetails(eventId);
          } catch (err) {
            Alert.alert("Error", getErrorMessage(err, "Failed to leave event"));
          } finally {
            setLeavingId(null);
          }
        },
      },
    ]);
  };

  const handleDelete = (eventId) => {
    Alert.alert("Delete Event", "Delete this event permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEventAPI(eventId);
            if (selectedEvent?._id === eventId) setShowDetails(false);
            await fetchAll();
          } catch (err) {
            Alert.alert("Error", getErrorMessage(err, "Failed to delete event"));
          }
        },
      },
    ]);
  };

  const openEditEvent = () => {
    if (!selectedEvent) return;
    const dateVal = normalizeEventDateToInput(selectedEvent.date);
    const parsedDate = parseEventDateInput(dateVal) || new Date();
    setEditPickerDate(parsedDate);
    const timeStr = selectedEvent.time || "";
    if (timeStr) {
      const [hh, mm] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setHours(hh, mm);
      const hours12 = hh % 12 || 12;
      const ampm = hh < 12 ? "AM" : "PM";
      setEditTimeDisplay(`${String(hours12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ampm}`);
      setEditPickerDate(d);
    } else {
      setEditTimeDisplay("");
    }
    setEditForm({
      title: selectedEvent.title || "",
      description: selectedEvent.description || "",
      date: dateVal,
      time: timeStr,
      location: selectedEvent.location || "",
      maxParticipants: String(selectedEvent.maxParticipants || "50"),
      category: selectedEvent.category || "social event",
    });
    setShowEditEvent(true);
  };

  const handleEditEvent = async () => {
    if (!editForm.title.trim()) return Alert.alert("Error", "Title is required");
    if (!editForm.date.trim()) return Alert.alert("Error", "Date is required");
    setSavingEdit(true);
    try {
      const res = await updateEventAPI(selectedEvent._id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        date: editForm.date,
        time: editForm.time || undefined,
        location: editForm.location.trim() || undefined,
        maxParticipants: editForm.maxParticipants ? parseInt(editForm.maxParticipants, 10) : undefined,
        category: editForm.category,
      });
      const updated = res?.event || res?.data || res;
      if (updated?._id) setSelectedEvent(updated);
      setShowEditEvent(false);
      await fetchAll();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to update event"));
    } finally { setSavingEdit(false); }
  };

  const handleCancelEvent = () => {
    if (!selectedEvent?._id) return;
    const isCancelled = selectedEvent.status === "cancelled";
    Alert.alert(
      isCancelled ? "Reopen Event" : "Cancel Event",
      isCancelled ? "Reopen this event so participants can join again?" : "Cancel this event? Participants will see it as cancelled.",
      [
        { text: "No", style: "cancel" },
        { text: isCancelled ? "Reopen" : "Cancel Event", style: isCancelled ? "default" : "destructive", onPress: async () => {
          setCancellingEvent(true);
          try {
            const res = await updateEventAPI(selectedEvent._id, { status: isCancelled ? "active" : "cancelled" });
            const updated = res?.event || res?.data || res;
            if (updated?._id) setSelectedEvent(updated);
            await fetchAll();
          } catch (err) {
            Alert.alert("Error", getErrorMessage(err, "Failed to update event"));
          } finally { setCancellingEvent(false); }
        }},
      ]
    );
  };

  const handleAddSlot = async () => {
    if (!selectedEvent?._id) return;
    if (!slotForm.title.trim()) return Alert.alert("Error", "Slot title is required");

    setSubmittingAction(true);
    try {
      await addSignupSlotAPI(selectedEvent._id, {
        title: slotForm.title.trim(),
        description: slotForm.description.trim(),
        maxSignups: slotForm.maxSignups ? parseInt(slotForm.maxSignups, 10) : 10,
      });
      setSlotForm({ title: "", description: "", maxSignups: "10" });
      await refreshEventDetails(selectedEvent._id);
      await fetchAll();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to add slot"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    if (!selectedEvent?._id) return;
    setSubmittingAction(true);
    try {
      await removeSignupSlotAPI(selectedEvent._id, slotId);
      await refreshEventDetails(selectedEvent._id);
      await fetchAll();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to remove slot"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSlotSignupToggle = async (slot) => {
    if (!selectedEvent?._id) return;
    const signed = (slot?.signups || []).some((s) => s.userId === userId);
    const waitlisted = (slot?.waitlist || []).some((s) => s.userId === userId);
    const maxSignups = slot?.maxSignups || 1;
    const currentSignups = (slot?.signups || []).length;
    const willBeWaitlisted = !signed && !waitlisted && currentSignups >= maxSignups;
    setSubmittingAction(true);
    try {
      if (signed || waitlisted) {
        await withdrawFromSlotAPI(selectedEvent._id, slot._id);
      } else {
        await signUpForSlotAPI(selectedEvent._id, slot._id, userName);
        if (willBeWaitlisted) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `You're on the waitlist`,
              body: `We'll notify you when a spot opens in "${slot.title}" for ${selectedEvent.title}`,
              data: { eventId: selectedEvent._id, slotId: slot._id },
            },
            trigger: null,
          }).catch(() => {});
        }
      }
      await refreshEventDetails(selectedEvent._id);
      await fetchAll();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to update signup"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAddPoll = async () => {
    if (!selectedEvent?._id) return;
    if (!pollForm.question.trim()) return Alert.alert("Error", "Poll question is required");

    const options = pollForm.optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map((text) => ({ text }));

    if (options.length < 2) {
      return Alert.alert("Error", "Enter at least 2 options separated by commas");
    }

    setSubmittingAction(true);
    try {
      await addPollAPI(selectedEvent._id, { question: pollForm.question.trim(), options });
      setPollForm({ question: "", optionsText: "" });
      await refreshEventDetails(selectedEvent._id);
      await fetchAll();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to add poll"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemovePoll = async (pollId) => {
    if (!selectedEvent?._id) return;
    setSubmittingAction(true);
    try {
      await removePollAPI(selectedEvent._id, pollId);
      await refreshEventDetails(selectedEvent._id);
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to remove poll"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleVote = async (pollId, optionIndex) => {
    if (!selectedEvent?._id) return;
    setSubmittingAction(true);
    try {
      await voteOnPollAPI(selectedEvent._id, pollId, optionIndex);
      await refreshEventDetails(selectedEvent._id);
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to vote"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedEvent?._id) return;
    if (!commentText.trim()) return;
    setSubmittingAction(true);
    try {
      await addEventCommentAPI(selectedEvent._id, { text: commentText.trim(), name: userName });
      setCommentText("");
      await refreshEventDetails(selectedEvent._id);
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to add comment"));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!selectedEvent?._id || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      await deleteEventCommentAPI(selectedEvent._id, commentId);
      await refreshEventDetails(selectedEvent._id);
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to delete comment"));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleShareEvent = () => {
    if (!selectedEvent?.shareId) return;
    const link = createEventShareLink(selectedEvent.shareId);
    setShareEventLink(link);
    setShowShareModal(true);
  };

  const handleNativeShare = async () => {
    try {
      await shareEventInvite({
        title: selectedEvent?.title,
        eventTitle: selectedEvent?.title,
        shareId: selectedEvent?.shareId,
      });
    } catch { /* dismissed */ }
  };

  // ── Schedule local reminder notification ──
  const scheduleReminder = async (event) => {
    if (!event?._id || remindedEventIds[event._id]) return;

    const eventDate = new Date(event.date);
    const [h, m] = (event.time || "00:00").split(":").map(Number);
    eventDate.setHours(h, m, 0, 0);
    const now = new Date();

    if (eventDate <= now) {
      Alert.alert("Event Ended", "This event has already taken place. Reminders can only be set for upcoming events.");
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: s2 } = await Notifications.requestPermissionsAsync();
      if (s2 !== "granted") return;
    }

    const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    const twoHoursBefore = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
    const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);

    const scheduled = [];
    if (oneDayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Tomorrow: ${event.title}`, body: `${event.time} at ${event.location}`, data: { eventId: event._id } },
        trigger: { date: oneDayBefore },
      });
      scheduled.push("1 day before");
    }
    if (twoHoursBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Are you ready? ${event.title}`, body: `Starts in 2 hours at ${event.location}`, data: { eventId: event._id } },
        trigger: { date: twoHoursBefore },
      });
      scheduled.push("2 hours before");
    }
    if (oneHourBefore > now && twoHoursBefore <= now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Starting soon: ${event.title}`, body: `In 1 hour at ${event.location}`, data: { eventId: event._id } },
        trigger: { date: oneHourBefore },
      });
      scheduled.push("1 hour before");
    }
    if (scheduled.length > 0) {
      setRemindedEventIds((prev) => ({ ...prev, [event._id]: true }));
      Alert.alert("Reminder Set", `You'll be notified ${scheduled.join(", ")}.`);
    } else {
      Alert.alert("Starts Very Soon", "The event is less than 1 hour away — no reminder needed!");
    }
  };

  // ── Photo upload ──
  const handleAddPhoto = async () => {
    if (!(await ensurePhotoLibraryAccess())) return Alert.alert("Permission needed", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await addEventPhotoAPI(selectedEvent._id, base64, asset.mimeType || "image/jpeg", "");
      if (res.event) setSelectedEvent(res.event);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to upload photo");
    } finally { setUploadingPhoto(false); }
  };

  const handleDeletePhoto = (photoId) => {
    Alert.alert("Delete Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const res = await deleteEventPhotoAPI(selectedEvent._id, photoId);
          if (res.event) setSelectedEvent(res.event);
        } catch { Alert.alert("Error", "Failed to delete photo"); }
      }},
    ]);
  };

  // ── Announcements ──
  const handleAddAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) return Alert.alert("Error", "Title and message are required");
    try {
      const res = await addAnnouncementAPI(selectedEvent._id, announcementForm);
      if (res.event) setSelectedEvent(res.event);
      setAnnouncementForm({ title: "", body: "", isPinned: false });
      setShowAnnouncementForm(false);
    } catch (err) { Alert.alert("Error", err?.response?.data?.message || "Failed to post announcement"); }
  };

  const handleDeleteAnnouncement = (id) => {
    Alert.alert("Delete", "Remove this announcement?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const res = await deleteAnnouncementAPI(selectedEvent._id, id);
          if (res.event) setSelectedEvent(res.event);
        } catch { Alert.alert("Error", "Failed to delete"); }
      }},
    ]);
  };

  // ── Recap ──
  const handlePostRecap = async () => {
    if (!recapForm.summary.trim()) return Alert.alert("Error", "Summary is required");
    setUploadingRecap(true);
    try {
      const payload = { summary: recapForm.summary.trim() };
      if (recapForm.file && recapForm.mimeType) {
        payload.file = recapForm.file;
        payload.mimeType = recapForm.mimeType;
      }
      const res = await postRecapAPI(selectedEvent._id, payload);
      if (res.event) setSelectedEvent(res.event);
      setShowRecapForm(false);
      setRecapForm({ summary: "" });
    } catch (err) { Alert.alert("Error", err?.response?.data?.message || "Failed to post recap"); }
    finally { setUploadingRecap(false); }
  };

  const handlePickRecapCover = async () => {
    if (!(await ensurePhotoLibraryAccess())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
    setRecapForm((p) => ({ ...p, file: base64, mimeType: result.assets[0].mimeType || "image/jpeg", coverPreview: result.assets[0].uri }));
  };

  const handleScannedJoinInput = async (rawInput, { rescan } = {}) => {
    const shareId = extractEventShareId(rawInput);
    if (!shareId) {
      Alert.alert(
        "Invalid invite",
        "We couldn't find a valid event invite code in that QR or link.\n\nMake sure you're scanning the Share Event QR (not the host's check-in QR).",
        [{ text: "OK", onPress: () => rescan && rescan() }],
      );
      return;
    }
    setJoiningEvent(true);
    try {
      const data = await getEventByShareIdAPI(shareId);
      const event = data?.event || data?.data || data;
      if (!event?._id) throw new Error("Event not found");
      setShowJoinEvent(false);
      setJoinEventUrl("");
      setEventScanned(false);
      setSelectedEvent(event);
      setShowDetails(true);
      fetchUserProfiles(event);
      if (isEventCancelled(event)) {
        Alert.alert("Event cancelled", "This event has been cancelled and is no longer accepting participants.");
      } else if (isEventEnded(event)) {
        Alert.alert("Event ended", "This event has already taken place.");
      }
    } catch (err) {
      const status = err?.response?.status;
      const message =
        status === 404
          ? "We couldn't find this event. It may have been deleted, or the invite code is no longer valid."
          : getErrorMessage(err, "Invalid or expired invite link.");
      Alert.alert("Failed to open event", message, [{ text: "OK", onPress: () => rescan && rescan() }]);
    } finally {
      setJoiningEvent(false);
    }
  };

  const joinEventByShareId = (shareId) => handleScannedJoinInput(shareId);

  const handleEventQRScanned = useCallback(({ data }) => {
    if (eventScanned || joiningEvent) return;
    setEventScanned(true);
    handleScannedJoinInput(data, { rescan: () => setEventScanned(false) });
  }, [eventScanned, joiningEvent]);

  const handleUploadEventQR = async () => {
    if (!(await ensurePhotoLibraryAccess())) return Alert.alert("Permission needed", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 0.9 });
    if (result.canceled || !result.assets?.length) return;
    setJoiningEvent(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await scanReceiptAPI(base64, result.assets[0].mimeType || "image/jpeg", "barcode");
      const barcodeValue = res?.data?.barcode;
      if (!barcodeValue) return Alert.alert("No QR found", "No QR code was detected in that image. Try a clearer photo.");
      await handleScannedJoinInput(barcodeValue);
    } catch {
      Alert.alert("Error", "Could not read QR code from image.");
    } finally { setJoiningEvent(false); }
  };

  const baseEvents =
    tab === "mine" ? myEvents
    : tab === "joined" ? joinedEvents
    : tab === "nearby" ? nearbyEvents
    : events;

  const displayedEvents = sortEventsForDisplay(
    categoryFilter === "all"
      ? baseEvents
      : baseEvents.filter((ev) => ev.category === categoryFilter),
  );
  const eventSections = buildEventSections(displayedEvents).map((s) => ({
    ...s,
    data: chunkPairs(s.data),
  }));
  // Upcoming, joinable picks for the "Suggested Events" carousel at the top.
  // Exclude events the current user hosts — "suggested" is for discovering others'.
  const suggestedEvents = displayedEvents
    .filter(
      (ev) =>
        !isEventEnded(ev) &&
        !isEventCancelled(ev) &&
        !isEventOwner(ev, userId),
    )
    .slice(0, 6);
  const isListLoading =
    loading ||
    (tab === "nearby" &&
      locationStatus === "granted" &&
      nearbyLoading &&
      nearbyEvents.length === 0);
  const isOwner = selectedEvent && isEventOwner(selectedEvent, userId);
  const isJoinedSelected =
    selectedEvent && isUserJoinedEvent(selectedEvent, userId) && !isOwner;
  const selectedEventEnded = selectedEvent && isEventEnded(selectedEvent);
  const selectedEventCancelled = selectedEvent && isEventCancelled(selectedEvent);
  const selectedEventFull = selectedEvent && isEventFull(selectedEvent);
  // Hosts retain edit/manage; participants lose interactive abilities on cancelled/ended events.
  const canParticipate =
    isOwner || (isJoinedSelected && !selectedEventCancelled && !selectedEventEnded);

  // Reminder state for the details header icon.
  const selectedEventDateObj = selectedEvent?.date
    ? (() => {
        const d = new Date(selectedEvent.date);
        if (selectedEvent.time) {
          const [hh, mm] = String(selectedEvent.time).split(":").map(Number);
          d.setHours(hh || 0, mm || 0, 0, 0);
        } else {
          d.setHours(23, 59, 59, 0);
        }
        return d;
      })()
    : null;
  const selectedEventIsPast = selectedEventDateObj ? selectedEventDateObj < new Date() : false;
  const selectedEventReminded = !!remindedEventIds[selectedEvent?._id];
  const selectedEventHero =
    selectedEvent?.photos?.[0]?.url || selectedEvent?.recap?.coverPhotoUrl || null;
  const selectedEventMapUri =
    selectedEvent?.location
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(selectedEvent.location)}&zoom=15&size=600x300&markers=color:red%7C${encodeURIComponent(selectedEvent.location)}&key=${GOOGLE_MAPS_API_KEY}`
      : null;

  const detailCircleBtn = {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  };

  const modalSheetBottomPad = Math.max(40, insets.bottom + 24);
  const shareModalSheet = {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: modalSheetBottomPad,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar backgroundColor={T.bg} barStyle={T.statusBar} />
      <LinearGradient
        pointerEvents="none"
        colors={T.headerGlow}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }}
      />
      <View
        style={{
          backgroundColor: "transparent",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
            style={{
              marginRight: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: T.controlBg,
              borderWidth: 1,
              borderColor: T.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.text, fontWeight: "900", fontSize: 19 }}>Events</Text>
            <Text style={{ color: T.textDim, fontSize: 12 }}>Polls, slots, comments and signups</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setJoinEventTab("scan"); setEventScanned(false); setJoinEventUrl(""); setShowJoinEvent(true); }}
            accessibilityRole="button"
            accessibilityLabel="Scan event QR"
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="scan-outline" size={24} color={T.accent} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: T.controlBg,
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginTop: 12,
          }}
        >
          <Ionicons name="search" size={16} color={T.textDim} />
          <TextInput
            value={searchInput}
            onChangeText={handleSearchChange}
            placeholder="Search events..."
            placeholderTextColor={T.textMuted}
            style={{ flex: 1, marginLeft: 8, color: T.text, fontSize: 14 }}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Ionicons name="close-circle" size={16} color={T.textDim} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
          {(userLocation ? ["all", "nearby", "joined", "mine"] : ["all", "joined", "mine"]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: tab === t ? T.accent : T.controlBg,
                borderWidth: 1,
                borderColor: tab === t ? T.accent : T.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              {t === "nearby" && (
                <Ionicons name="location" size={12} color={tab === t ? T.onAccent : T.textDim} />
              )}
              <Text
                style={{
                  color: tab === t ? T.onAccent : T.textDim,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {t === "all" ? "All" : t === "nearby" ? "Near You" : t === "joined" ? "Joined" : "Mine"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[{ value: "all", label: "All", icon: "apps" }, ...CATEGORIES].map((c) => {
              const active = categoryFilter === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCategoryFilter(c.value)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? T.accent : "transparent",
                    borderWidth: 1,
                    borderColor: active ? T.accent : T.border,
                  }}
                >
                  <Ionicons
                    name={c.icon || getCategoryIcon(c.value)}
                    size={13}
                    color={active ? T.onAccent : T.textDim}
                  />
                  <Text style={{ color: active ? T.onAccent : T.textDim, fontWeight: "700", fontSize: 12 }}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Location status row — below tabs */}
        {locationStatus === "loading" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
            <ActivityIndicator size="small" color={T.textDim} />
            <Text style={{ color: T.textDim, fontSize: 12 }}>Detecting your location...</Text>
          </View>
        ) : locationStatus === "granted" && userLocation ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
            <Ionicons name="location" size={14} color={T.accent} />
            <Text style={{ color: T.textDim, fontSize: 12, fontWeight: "600" }}>
              {userLocation.city ? `Your location: ${userLocation.city}` : "Location detected"}
            </Text>
          </View>
        ) : null}
      </View>

      {isListLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
          <LottieView
            source={require("@/app/animations/event.json")}
            autoPlay
            loop
            style={{ width: 100, height: 100 }}
          />
        </View>
      ) : (
        <SectionList
          style={{ backgroundColor: T.bg }}
          sections={eventSections}
          keyExtractor={(row) => row.map((e) => e._id || `${e.title}-${e.date}`).join("|")}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {row.map((ev) => (
                <EventGridCard
                  key={ev._id}
                  ev={ev}
                  userId={userId}
                  joiningId={joiningId}
                  leavingId={leavingId}
                  isMyTab={tab === "mine"}
                  onJoin={(id) => handleJoin(id, ev)}
                  onLeave={handleLeave}
                  onDelete={handleDelete}
                  onOpen={openEventDetails}
                  theme={T}
                />
              ))}
              {row.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingTop: title === "Explore" ? 4 : 16, paddingBottom: 10 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: T.textDim,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            (tab === "all" || tab === "nearby") && suggestedEvents.length > 0 ? (
              <SuggestedCarousel
                events={suggestedEvents}
                userId={userId}
                userProfiles={userProfiles}
                joiningId={joiningId}
                leavingId={leavingId}
                onJoin={(id) => {
                  const ev = suggestedEvents.find((e) => e._id === id);
                  handleJoin(id, ev);
                }}
                onOpen={openEventDetails}
                theme={T}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[T.accent]}
              tintColor={T.accent}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <MaterialIcons name="event-note" size={58} color={T.border} />
              <Text
                style={{
                  color: T.textDim,
                  fontSize: 16,
                  fontWeight: "700",
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                {tab === "mine"
                  ? "You haven't created any events yet"
                  : tab === "joined"
                  ? "You haven't joined any events yet"
                  : tab === "nearby"
                  ? `No events found near ${userLocation?.city || "you"}`
                  : search
                  ? `No events found for "${search}"`
                  : "No events available"}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating create button */}
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        accessibilityRole="button"
        accessibilityLabel="Create event"
        activeOpacity={0.9}
        style={{
          position: "absolute",
          right: 20,
          bottom: Math.max(insets.bottom, 16) + 16,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: T.accent,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={30} color={T.onAccent} />
      </TouchableOpacity>

      <KeyboardBottomSheet
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        scrollRef={createScrollRef}
        sheetBackgroundColor={T.bg}
        footerBorderColor={T.border}
        footer={(
          <TouchableOpacity
            onPress={handleCreate}
            disabled={creating}
            style={{
              backgroundColor: T.accent,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? (
              <ActivityIndicator color={T.onAccent} />
            ) : (
              <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 16 }}>Create Event</Text>
            )}
          </TouchableOpacity>
        )}
      >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "900", color: T.text }}>Create Event</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  <Ionicons name="close" size={24} color={T.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>TITLE *</Text>
              <TextInput
                value={form.title}
                onChangeText={(v) => {
                  setForm({ ...form, title: v });
                  clearCreateFieldError("title");
                }}
                style={[
                  styles.input,
                  createFormErrors.title && { borderColor: "#F87171", backgroundColor: "rgba(239,68,68,0.12)" },
                ]}
                placeholder="Event title"
                placeholderTextColor={T.textMuted}
              />
              <FieldErrorText message={createFormErrors.title} />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                placeholder="What's this event about?"
                placeholderTextColor={T.textMuted}
                multiline
              />

              <View style={{ flexDirection: "row", gap: 10, marginBottom: 0 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>DATE *</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.input,
                      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                      createFormErrors.date && { borderColor: "#F87171", backgroundColor: "rgba(239,68,68,0.12)" },
                    ]}
                  >
                    <Text style={{ color: form.date ? T.text : T.textMuted, fontSize: 15 }}>
                      {form.date ? formatEventDateLabel(form.date) : "Select date"}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={T.textDim} />
                  </TouchableOpacity>
                  <FieldErrorText message={createFormErrors.date} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>TIME *</Text>
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={[
                      styles.input,
                      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                      createFormErrors.time && { borderColor: "#F87171", backgroundColor: "rgba(239,68,68,0.12)" },
                    ]}
                  >
                    <Text style={{ color: timeDisplay ? T.text : T.textMuted, fontSize: 15 }}>{timeDisplay || "Select time"}</Text>
                    <Ionicons name="time-outline" size={18} color={T.textDim} />
                  </TouchableOpacity>
                  <FieldErrorText message={createFormErrors.time} />
                </View>
              </View>

              {showDatePicker && (
                <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, marginBottom: 14, overflow: "hidden", borderWidth: 1, borderColor: T.border }}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={new Date()}
                    onChange={onDateChange}
                    themeVariant={isDark ? "dark" : "light"}
                    accentColor={T.accent}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={{ backgroundColor: T.accent, margin: 12, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: T.onAccent, fontWeight: "800" }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {showTimePicker && (
                <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, marginBottom: 14, overflow: "hidden", borderWidth: 1, borderColor: T.border }}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    is24Hour={false}
                    onChange={onTimeChange}
                    themeVariant={isDark ? "dark" : "light"}
                    accentColor={T.accent}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      onPress={() => setShowTimePicker(false)}
                      style={{ backgroundColor: T.accent, margin: 12, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: T.onAccent, fontWeight: "800" }}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View
                onLayout={(e) => {
                  createLocationY.current = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.label}>LOCATION *</Text>
                <GooglePlacesInput
                  value={form.location}
                  onSelect={(v, coords) => {
                    setForm((p) => ({ ...p, location: v, coordinates: coords || null }));
                    clearCreateFieldError("location");
                  }}
                  onFocus={() => scrollSheetToField(createScrollRef, createLocationY.current)}
                  placeholder="Venue / address (e.g. Hitech City, Hyderabad)"
                  inputStyle={{
                    backgroundColor: createFormErrors.location ? T.dangerBg : T.inputBg,
                    borderWidth: 1,
                    borderColor: createFormErrors.location ? T.dangerText : T.inputBorder,
                    borderRadius: 12,
                    color: T.text,
                  }}
                  containerStyle={{ marginBottom: createFormErrors.location ? 4 : 14 }}
                />
                <FieldErrorText message={createFormErrors.location} />
              </View>

              <Text style={styles.label}>CATEGORY</Text>
              <CategoryPicker
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                theme={T}
              />

              <View
                onLayout={(e) => {
                  createMaxParticipantsY.current = e.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.label}>MAX PARTICIPANTS</Text>
                <TextInput
                  value={form.maxParticipants}
                  onChangeText={(v) => setForm({ ...form, maxParticipants: v })}
                  onFocus={() => scrollSheetToField(createScrollRef, createMaxParticipantsY.current)}
                  style={styles.input}
                  placeholder="Default 50"
                  placeholderTextColor={T.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={styles.label}>REPEAT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[{ v: "none", l: "No Repeat" }, { v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }, { v: "monthly", l: "Monthly" }].map((r) => (
                    <TouchableOpacity key={r.v} onPress={() => setForm((p) => ({ ...p, recurrence: { ...p.recurrence, type: r.v } }))}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: form.recurrence.type === r.v ? T.accent : T.inputBg, borderWidth: 1, borderColor: form.recurrence.type === r.v ? T.accent : T.inputBorder }}>
                      <Text style={{ color: form.recurrence.type === r.v ? T.onAccent : T.textDim, fontWeight: "600", fontSize: 13 }}>{r.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

      </KeyboardBottomSheet>

      <KeyboardBottomSheet
        visible={showDetails}
        onClose={() => { setShowOwnerMenu(false); setShowDetails(false); }}
        scrollRef={detailsScrollRef}
        contentPadding={20}
        maxHeightRatio={0.94}
        sheetBackgroundColor={T.bg}
        footerBorderColor={T.border}
      >
            {detailsLoading ? (
              <View style={{ padding: 32, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={T.accent} />
              </View>
            ) : (
              <>
                {/* Hero header */}
                <View
                  style={{
                    marginHorizontal: -20,
                    marginTop: -20,
                    marginBottom: 16,
                    height: 200,
                    backgroundColor: T.surface,
                    zIndex: showOwnerMenu ? 50 : 1,
                  }}
                >
                  {/* Clipped image layer */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      overflow: "hidden",
                    }}
                  >
                    {selectedEventHero ? (
                      <Image source={{ uri: selectedEventHero }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : selectedEventMapUri ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => openInMaps(selectedEvent.location)}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <Image source={{ uri: selectedEventMapUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <LinearGradient
                        colors={[T.surfaceAlt, T.bg]}
                        style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
                      >
                        <Image source={getCategoryBadge(selectedEvent?.category)} style={{ width: 100, height: 100 }} resizeMode="contain" />
                      </LinearGradient>
                    )}
                    <LinearGradient
                      colors={["rgba(0,0,0,0.5)", "transparent", "rgba(11,11,15,0.55)"]}
                      locations={[0, 0.45, 1]}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                      pointerEvents="none"
                    />
                  </View>

                  {/* Open in Maps affordance (only when the hero is a map) */}
                  {!selectedEventHero && !!selectedEventMapUri && (
                    <TouchableOpacity
                      onPress={() => openInMaps(selectedEvent.location)}
                      activeOpacity={0.85}
                      style={{
                        position: "absolute",
                        bottom: 12,
                        right: 12,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Open in Maps</Text>
                    </TouchableOpacity>
                  )}

                  {/* Top overlay controls */}
                  <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <TouchableOpacity onPress={() => { setShowOwnerMenu(false); setShowDetails(false); }} style={detailCircleBtn}>
                      <Ionicons name="chevron-back" size={20} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {!selectedEventIsPast && !selectedEventCancelled && (
                        <TouchableOpacity onPress={() => scheduleReminder(selectedEvent)} disabled={selectedEventReminded} style={detailCircleBtn}>
                          <Ionicons name={selectedEventReminded ? "notifications" : "notifications-outline"} size={18} color={selectedEventReminded ? T.accent : "#fff"} />
                        </TouchableOpacity>
                      )}
                      {isOwner && (
                        <TouchableOpacity onPress={() => setShowCheckinQR(true)} style={detailCircleBtn}>
                          <Ionicons name="qr-code-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                      {isOwner ? (
                        <TouchableOpacity onPress={() => setShowOwnerMenu((p) => !p)} style={detailCircleBtn}>
                          <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={handleShareEvent} style={detailCircleBtn}>
                          <Ionicons name="share-social-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Owner dropdown menu */}
                  {isOwner && showOwnerMenu && (
                    <>
                      <Pressable onPress={() => setShowOwnerMenu(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View
                        style={{
                          position: "absolute",
                          top: 54,
                          right: 12,
                          backgroundColor: T.surfaceAlt,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: T.border,
                          overflow: "hidden",
                          minWidth: 176,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.4,
                          shadowRadius: 12,
                          elevation: 12,
                        }}
                      >
                        <TouchableOpacity onPress={() => { setShowOwnerMenu(false); openEditEvent(); }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: T.border }}>
                          <Ionicons name="pencil-outline" size={17} color={T.text} />
                          <Text style={{ color: T.text, fontWeight: "700", fontSize: 14 }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setShowOwnerMenu(false); handleCancelEvent(); }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: T.border }}>
                          <Ionicons name={selectedEvent?.status === "cancelled" ? "refresh-outline" : "ban-outline"} size={17} color={T.text} />
                          <Text style={{ color: T.text, fontWeight: "700", fontSize: 14 }}>{selectedEvent?.status === "cancelled" ? "Reopen" : "Cancel"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setShowOwnerMenu(false); handleShareEvent(); }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: T.border }}>
                          <Ionicons name="share-social-outline" size={17} color={T.text} />
                          <Text style={{ color: T.text, fontWeight: "700", fontSize: 14 }}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setShowOwnerMenu(false); handleDelete(selectedEvent._id); }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
                          <Ionicons name="trash-outline" size={17} color="#F87171" />
                          <Text style={{ color: "#F87171", fontWeight: "700", fontSize: 14 }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {/* Date chip */}
                <View style={{ alignSelf: "flex-start", backgroundColor: T.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 }}>
                  <Text style={{ color: T.text, fontWeight: "700", fontSize: 12 }}>
                    {formatDateTime(selectedEvent?.date, selectedEvent?.time)}
                  </Text>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 24, fontWeight: "900", color: T.text, marginBottom: 10, lineHeight: 30 }}>
                  {selectedEvent?.title || "Event"}
                </Text>

                {/* Location */}
                {!!selectedEvent?.location && (
                  <TouchableOpacity onPress={() => openInMaps(selectedEvent.location)} activeOpacity={0.8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Ionicons name="location-outline" size={16} color={T.textDim} />
                    <Text style={{ color: T.textDim, flex: 1 }} numberOfLines={1}>{selectedEvent.location}</Text>
                    <Ionicons name="chevron-forward" size={14} color={T.textMuted} />
                  </TouchableOpacity>
                )}

                {/* Category */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Ionicons name={getCategoryIcon(selectedEvent?.category)} size={16} color={T.textDim} />
                  <Text style={{ color: T.textDim }}>{getCatConfig(selectedEvent?.category).label}</Text>
                </View>

                {/* Attendees preview */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  {(selectedEvent?.participants || []).slice(0, 4).map((p, i) => {
                    const profile = userProfiles[p.userId];
                    const initials = (p.name || "?").slice(0, 2).toUpperCase();
                    const avatarColors = ["#7C3AED", "#0369A1", "#B45309", "#065F46"];
                    const avatarStyle = { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: T.bg, marginLeft: i === 0 ? 0 : -9, zIndex: 10 - i };
                    return profile?.profilePicture ? (
                      <Image key={p.userId || i} source={{ uri: profile.profilePicture }} style={avatarStyle} />
                    ) : (
                      <View key={p.userId || i} style={[avatarStyle, { backgroundColor: avatarColors[i % avatarColors.length], alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{initials}</Text>
                      </View>
                    );
                  })}
                  <Text style={{ color: T.textDim, marginLeft: (selectedEvent?.participants || []).length ? 10 : 0, fontSize: 13, fontWeight: "600" }}>
                    {(selectedEvent?.participants || []).length}
                    {selectedEvent?.maxParticipants ? `/${selectedEvent.maxParticipants}` : ""} going
                  </Text>
                </View>

                {/* Prominent Join / Leave / Hosting */}
                {isOwner ? (
                  <View
                    style={{
                      backgroundColor: selectedEventCancelled
                        ? "rgba(239,68,68,0.12)"
                        : T.isDark
                          ? "rgba(154,234,98,0.12)"
                          : "rgba(17,24,39,0.06)",
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      marginBottom: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderWidth: 1,
                      borderColor: selectedEventCancelled
                        ? "rgba(239,68,68,0.3)"
                        : T.isDark
                          ? "rgba(154,234,98,0.3)"
                          : "rgba(17,24,39,0.18)",
                    }}
                  >
                    <Ionicons
                      name={selectedEventCancelled ? "close-circle" : "star"}
                      size={18}
                      color={selectedEventCancelled ? "#F87171" : T.accent}
                    />
                    <Text
                      style={{
                        color: selectedEventCancelled ? "#F87171" : T.accent,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {selectedEventCancelled
                        ? "You hosted this event (cancelled)"
                        : selectedEventEnded
                          ? "You hosted this event"
                          : "You're hosting this event"}
                    </Text>
                  </View>
                ) : isJoinedSelected && selectedEventCancelled ? (
                    <View style={{ marginBottom: 14, gap: 10 }}>
                      <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
                        <Ionicons name="close-circle" size={18} color="#F87171" />
                        <Text style={{ color: "#F87171", fontWeight: "700", fontSize: 15 }}>This event has been cancelled</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleLeave(selectedEvent._id)}
                        disabled={leavingId === selectedEvent?._id}
                        style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: leavingId === selectedEvent?._id ? 0.7 : 1 }}
                      >
                        {leavingId === selectedEvent?._id ? (
                          <ActivityIndicator size="small" color={T.textDim} />
                        ) : (
                          <>
                            <Ionicons name="exit-outline" size={16} color={T.textDim} />
                            <Text style={{ color: T.textDim, fontWeight: "700", fontSize: 14 }}>Remove from my events</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : isJoinedSelected ? (
                    <TouchableOpacity
                      onPress={() => handleLeave(selectedEvent._id)}
                      disabled={leavingId === selectedEvent?._id || joiningId === selectedEvent?._id}
                      style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 14, flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", opacity: leavingId === selectedEvent?._id ? 0.7 : 1 }}
                    >
                      {leavingId === selectedEvent?._id ? (
                        <ActivityIndicator size="small" color="#F87171" />
                      ) : (
                        <>
                          <Ionicons name="exit-outline" size={18} color="#F87171" />
                          <Text style={{ color: "#F87171", fontWeight: "700", fontSize: 15 }}>Leave Event</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : selectedEventCancelled ? (
                    <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
                      <Ionicons name="close-circle" size={18} color="#F87171" />
                      <Text style={{ color: "#F87171", fontWeight: "700", fontSize: 15 }}>This event has been cancelled</Text>
                    </View>
                  ) : selectedEventEnded ? (
                    <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: T.border }}>
                      <Ionicons name="time-outline" size={18} color={T.textDim} />
                      <Text style={{ color: T.textDim, fontWeight: "700", fontSize: 15 }}>This event has ended</Text>
                    </View>
                  ) : selectedEventFull ? (
                    <View style={{ marginBottom: 14 }}>
                      <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Ionicons name="people-outline" size={18} color={T.textDim} />
                        <Text style={{ color: T.textDim, fontWeight: "700", fontSize: 15 }}>Event full</Text>
                      </View>
                      <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                        This event has reached its participant limit.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ marginBottom: 14 }}>
                      <TouchableOpacity
                        onPress={() => handleJoin(selectedEvent._id, selectedEvent)}
                        disabled={joiningId === selectedEvent?._id || leavingId === selectedEvent?._id}
                        style={{
                          backgroundColor: T.accent,
                          borderRadius: 14,
                          paddingVertical: 14,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 8,
                          opacity: joiningId === selectedEvent?._id ? 0.6 : 1,
                        }}
                      >
                        {joiningId === selectedEvent?._id ? (
                          <>
                            <ActivityIndicator color={T.onAccent} size="small" />
                            <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 15 }}>Joining…</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={18} color={T.onAccent} />
                            <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 15 }}>Join Event</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      {joinBlockedReason ? (
                        <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                          {joinBlockedReason === "full"
                            ? "This event has reached its participant limit."
                            : joinBlockedReason === "ended"
                              ? "This event has already taken place."
                              : joinBlockedReason === "cancelled"
                                ? "This event has been cancelled."
                                : "This event is no longer accepting participants."}
                        </Text>
                      ) : null}
                    </View>
                  )}

                {!!selectedEvent?.description && (
                  <Text style={{ color: T.textDim, lineHeight: 20, marginBottom: 14 }}>{selectedEvent.description}</Text>
                )}

                {/* Details tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[
                      { key: "info", label: "Info" },
                      { key: "attendees", label: `Attendees (${(selectedEvent?.participants || []).length})` },
                      { key: "gallery", label: `Photos${(selectedEvent?.photos?.length || 0) > 0 ? ` (${selectedEvent.photos.length})` : ""}` },
                      { key: "announcements", label: `Announcements${(selectedEvent?.announcements?.length || 0) > 0 ? ` (${selectedEvent.announcements.length})` : ""}` },
                      { key: "recap", label: "Recap" },
                    ].map((t) => (
                      <TouchableOpacity key={t.key} onPress={() => setDetailsTab(t.key)}
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: detailsTab === t.key ? T.accent : T.surfaceAlt }}>
                        <Text style={{ color: detailsTab === t.key ? T.onAccent : T.textDim, fontWeight: "700", fontSize: 12 }}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {detailsTab === "attendees" && (
                  <View>
                    <Text style={styles.sectionTitle}>Attendees ({(selectedEvent?.participants || []).length})</Text>
                    {(selectedEvent?.participants || []).length === 0 ? (
                      <Text style={styles.emptyText}>No participants yet.</Text>
                    ) : (
                      (selectedEvent?.participants || []).map((p, i) => {
                        const profile = userProfiles[p.userId];
                        const initials = (p.name || "?").slice(0, 2).toUpperCase();
                        const isMe = p.userId === userId;
                        const isCreator = selectedEvent.createdBy === p.userId || selectedEvent.createdBy?._id === p.userId;
                        return (
                          <View key={p.userId || i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: T.border }}>
                            {profile?.profilePicture ? (
                              <Image source={{ uri: profile.profilePicture }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            ) : (
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: T.accent, fontWeight: "800", fontSize: 14 }}>{initials}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: "700", color: T.text, fontSize: 14 }}>
                                {p.name || profile?.username || "Participant"}{isMe ? " (You)" : ""}
                              </Text>
                              {profile?.username && <Text style={{ color: T.textDim, fontSize: 12 }}>@{profile.username}</Text>}
                            </View>
                            {isCreator && (
                              <View style={{ backgroundColor: T.isDark ? "rgba(154,234,98,0.12)" : "rgba(17,24,39,0.07)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                <Text style={{ color: T.accent, fontWeight: "700", fontSize: 11 }}>Organizer</Text>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {detailsTab === "info" && <><Text style={styles.sectionTitle}>Signup Slots</Text>
                {(selectedEvent?.signupSlots || []).length === 0 ? (
                  <Text style={styles.emptyText}>No slots yet.</Text>
                ) : (
                  (selectedEvent?.signupSlots || []).map((slot) => {
                    const signups = slot?.signups || [];
                    const waitlist = slot?.waitlist || [];
                    const signed = signups.some((s) => s.userId === userId);
                    const waitlisted = waitlist.some((s) => s.userId === userId);
                    const maxSignups = slot?.maxSignups || 1;
                    const pct = Math.min(100, Math.round((signups.length / maxSignups) * 100));

                    return (
                      <View key={slot._id} style={styles.blockCard}>
                        <Text style={styles.blockTitle}>{slot.title}</Text>
                        {!!slot.description && <Text style={styles.blockDescription}>{slot.description}</Text>}
                        <Text style={styles.blockMeta}>
                          {signups.length}/{maxSignups} signed up{waitlist.length > 0 ? `, ${waitlist.length} waitlisted` : ""}
                        </Text>
                        <View style={{ height: 6, backgroundColor: T.surfaceAlt, borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: T.accent }} />
                        </View>

                        {signups.length > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                            {signups.slice(0, 5).map((s, i) => {
                              const profile = userProfiles[s.userId];
                              const initials = (s.name || "?").slice(0, 2).toUpperCase();
                              const avatarColors = ["#0F172A", "#7C3AED", "#0369A1", "#B45309", "#065F46"];
                              return profile?.profilePicture ? (
                                <Image
                                  key={s.userId}
                                  source={{ uri: profile.profilePicture }}
                                  style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: T.surface, marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
                                />
                              ) : (
                                <View
                                  key={s.userId}
                                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: avatarColors[i % avatarColors.length], alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.surface, marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
                                >
                                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{initials}</Text>
                                </View>
                              );
                            })}
                            {signups.length > 5 && (
                              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: T.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.surface, marginLeft: -10 }}>
                                <Text style={{ color: T.textDim, fontSize: 10, fontWeight: "800" }}>+{signups.length - 5}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {waitlist.length > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#F59E0B", marginRight: 6 }}>Waitlist</Text>
                            {waitlist.slice(0, 4).map((s, i) => {
                              const profile = userProfiles[s.userId];
                              const initials = (s.name || "?").slice(0, 2).toUpperCase();
                              return profile?.profilePicture ? (
                                <Image
                                  key={s.userId}
                                  source={{ uri: profile.profilePicture }}
                                  style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#FEF3C7", marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}
                                />
                              ) : (
                                <View
                                  key={s.userId}
                                  style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#92400E", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FEF3C7", marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}
                                >
                                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{initials}</Text>
                                </View>
                              );
                            })}
                            {waitlist.length > 4 && (
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FEF3C7", marginLeft: -8 }}>
                                <Text style={{ color: "#92400E", fontSize: 9, fontWeight: "800" }}>+{waitlist.length - 4}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {canParticipate && (
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleSlotSignupToggle(slot)}
                            disabled={submittingAction || selectedEventEnded}
                            style={{
                              flex: 1,
                              borderRadius: 10,
                              backgroundColor: signed || waitlisted ? "rgba(239,68,68,0.14)" : T.accent,
                              alignItems: "center",
                              paddingVertical: 9,
                              opacity: selectedEventEnded ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ color: signed || waitlisted ? "#F87171" : T.onAccent, fontWeight: "800", fontSize: 12 }}>
                              {signed ? "Withdraw" : waitlisted ? "Leave Waitlist" : "Sign Up"}
                            </Text>
                          </TouchableOpacity>
                          {isOwner && (
                            <TouchableOpacity
                              onPress={() => handleRemoveSlot(slot._id)}
                              disabled={submittingAction}
                              style={{
                                width: 44,
                                borderRadius: 10,
                                backgroundColor: "rgba(239,68,68,0.14)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#F87171" />
                            </TouchableOpacity>
                          )}
                        </View>
                        )}
                      </View>
                    );
                  })
                )}

                {isOwner && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionSubTitle}>Add Slot</Text>
                    <TextInput
                      value={slotForm.title}
                      onChangeText={(v) => setSlotForm((p) => ({ ...p, title: v }))}
                      onFocus={() => {
                        setTimeout(() => detailsScrollRef.current?.scrollToEnd({ animated: true }), 200);
                      }}
                      style={styles.compactInput}
                      placeholder="Slot title"
                      placeholderTextColor={T.textMuted}
                    />
                    <TextInput
                      value={slotForm.description}
                      onChangeText={(v) => setSlotForm((p) => ({ ...p, description: v }))}
                      style={styles.compactInput}
                      placeholder="Description (optional)"
                      placeholderTextColor={T.textMuted}
                    />
                    <TextInput
                      value={slotForm.maxSignups}
                      onChangeText={(v) => setSlotForm((p) => ({ ...p, maxSignups: v }))}
                      style={styles.compactInput}
                      placeholder="Max signups"
                      keyboardType="number-pad"
                      placeholderTextColor={T.textMuted}
                    />
                    <TouchableOpacity onPress={handleAddSlot} disabled={submittingAction} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>Add Slot</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Polls</Text>
                {(selectedEvent?.polls || []).length === 0 ? (
                  <Text style={styles.emptyText}>No polls yet.</Text>
                ) : (
                  (selectedEvent?.polls || []).map((poll) => {
                    const totalVotes = (poll.options || []).reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
                    return (
                      <View key={poll._id} style={styles.blockCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={styles.blockTitle}>{poll.question}</Text>
                          {isOwner && (
                            <TouchableOpacity onPress={() => handleRemovePoll(poll._id)} disabled={submittingAction}>
                              <Ionicons name="trash-outline" size={16} color="#F87171" />
                            </TouchableOpacity>
                          )}
                        </View>
                        {(poll.options || []).map((opt, idx) => {
                          const votes = opt.votes?.length || 0;
                          const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                          const voted = (opt.votes || []).some((v) => v.userId === userId);
                          return (
                            <TouchableOpacity
                              key={`${poll._id}-${idx}`}
                              onPress={() => handleVote(poll._id, idx)}
                              disabled={submittingAction || !canParticipate || selectedEventEnded}
                              style={{ marginTop: 8, opacity: canParticipate ? 1 : 0.55 }}
                            >
                              <View
                                style={{
                                  backgroundColor: voted
                                    ? T.isDark
                                      ? "rgba(154,234,98,0.14)"
                                      : "rgba(17,24,39,0.07)"
                                    : T.inputBg,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: voted ? T.accent : T.inputBorder,
                                  overflow: "hidden",
                                }}
                              >
                                <View style={{ width: `${pct}%`, backgroundColor: voted ? (T.isDark ? "rgba(154,234,98,0.25)" : "rgba(17,24,39,0.12)") : T.surfaceAlt, height: "100%", position: "absolute", top: 0, left: 0, bottom: 0 }} />
                                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 9 }}>
                                  <Text style={{ color: T.text, fontWeight: voted ? "800" : "600", flex: 1 }} numberOfLines={1}>{opt.text}</Text>
                                  <Text style={{ color: T.textDim, fontWeight: "700", marginLeft: 8 }}>{votes} ({pct}%)</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })
                )}

                {isOwner && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionSubTitle}>Add Poll</Text>
                    <TextInput
                      value={pollForm.question}
                      onChangeText={(v) => setPollForm((p) => ({ ...p, question: v }))}
                      onFocus={() => {
                        setTimeout(() => detailsScrollRef.current?.scrollToEnd({ animated: true }), 200);
                      }}
                      style={styles.compactInput}
                      placeholder="Poll question"
                      placeholderTextColor={T.textMuted}
                    />
                    <TextInput
                      value={pollForm.optionsText}
                      onChangeText={(v) => setPollForm((p) => ({ ...p, optionsText: v }))}
                      onFocus={() => {
                        setTimeout(() => detailsScrollRef.current?.scrollToEnd({ animated: true }), 200);
                      }}
                      style={styles.compactInput}
                      placeholder="Option A, Option B, Option C"
                      placeholderTextColor={T.textMuted}
                    />
                    <TouchableOpacity onPress={handleAddPoll} disabled={submittingAction} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>Create Poll</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Comments</Text>
                {(selectedEvent?.comments || []).length === 0 ? (
                  <Text style={styles.emptyText}>No comments yet.</Text>
                ) : (
                  (selectedEvent?.comments || []).map((comment) => {
                    const canDelete = comment.userId === userId || isOwner;
                    const isDeleting = deletingCommentId === comment._id;
                    return (
                      <View key={comment._id} style={[styles.blockCard, { marginBottom: 8, opacity: isDeleting ? 0.6 : 1 }]}> 
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: T.text, fontWeight: "800" }}>{comment.name || "User"}</Text>
                          {canDelete && (
                            <TouchableOpacity
                              onPress={() => handleDeleteComment(comment._id)}
                              disabled={!!deletingCommentId}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center" }}
                            >
                              {isDeleting ? (
                                <ActivityIndicator size="small" color="#F87171" />
                              ) : (
                                <Ionicons name="trash-outline" size={15} color="#F87171" />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={{ color: T.textDim, marginTop: 4, lineHeight: 18 }}>{comment.text}</Text>
                      </View>
                    );
                  })
                )}

                {canParticipate ? (
                <View style={styles.formSection}>
                  <TextInput
                    value={commentText}
                    onChangeText={setCommentText}
                    onFocus={() => {
                      setTimeout(() => detailsScrollRef.current?.scrollToEnd({ animated: true }), 200);
                    }}
                    style={[styles.compactInput, { minHeight: 46 }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={T.textMuted}
                  />
                  <TouchableOpacity onPress={handleAddComment} disabled={submittingAction || selectedEventEnded || !!deletingCommentId} style={[styles.secondaryBtn, { opacity: submittingAction ? 0.7 : 1 }]}>
                    {submittingAction ? (
                      <ActivityIndicator size="small" color={T.onAccent} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Post Comment</Text>
                    )}
                  </TouchableOpacity>
                </View>
                ) : (
                  <Text style={[styles.emptyText, { marginBottom: 12 }]}>Join the event to post a comment.</Text>
                )}
                </>}

                {/* ── Gallery Tab ── */}
                {detailsTab === "gallery" && (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={styles.sectionTitle}>Photo Gallery</Text>
                      {canParticipate && (
                      <TouchableOpacity onPress={handleAddPhoto} disabled={uploadingPhoto || selectedEventEnded}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, opacity: selectedEventEnded ? 0.5 : 1 }}>
                        {uploadingPhoto ? <ActivityIndicator size="small" color={T.onAccent} /> : <Ionicons name="camera-outline" size={15} color={T.onAccent} />}
                        <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 13 }}>Add Photo</Text>
                      </TouchableOpacity>
                      )}
                    </View>
                    {(selectedEvent?.photos || []).length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                        <Ionicons name="images-outline" size={48} color={T.border} />
                        <Text style={{ color: T.textMuted, textAlign: "center" }}>
                          {canParticipate ? "No photos yet. Be the first to add one!" : "No photos yet. Join to add photos."}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {(selectedEvent.photos).map((photo) => (
                          <View key={photo._id} style={{ width: "31%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" }}>
                            <Image source={{ uri: photo.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            {(isOwner || photo.uploadedBy === userId) && (
                              <TouchableOpacity onPress={() => handleDeletePhoto(photo._id)}
                                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
                                <Ionicons name="close" size={13} color="white" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* ── Announcements Tab ── */}
                {detailsTab === "announcements" && (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={styles.sectionTitle}>Announcements</Text>
                      {isOwner && (
                        <TouchableOpacity onPress={() => setShowAnnouncementForm((p) => !p)}
                          style={{ backgroundColor: T.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                          <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 13 }}>+ Post</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {isOwner && showAnnouncementForm && (
                      <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: T.border }}>
                        <TextInput value={announcementForm.title} onChangeText={(v) => setAnnouncementForm((p) => ({ ...p, title: v }))}
                          placeholder="Title" placeholderTextColor={T.textMuted}
                          style={{ backgroundColor: T.bg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: T.border, color: T.text }} />
                        <TextInput value={announcementForm.body} onChangeText={(v) => setAnnouncementForm((p) => ({ ...p, body: v }))}
                          placeholder="Message..." placeholderTextColor={T.textMuted} multiline
                          style={{ backgroundColor: T.bg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: T.border, color: T.text, minHeight: 80, textAlignVertical: "top" }} />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity onPress={() => setShowAnnouncementForm(false)}
                            style={{ flex: 1, backgroundColor: T.surfaceAlt, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                            <Text style={{ color: T.textDim, fontWeight: "600" }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleAddAnnouncement}
                            style={{ flex: 1, backgroundColor: T.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                            <Text style={{ color: T.onAccent, fontWeight: "800" }}>Post</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {(selectedEvent?.announcements || []).length === 0 ? (
                      <Text style={styles.emptyText}>No announcements yet.</Text>
                    ) : (
                      [...(selectedEvent.announcements)].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)).map((ann) => (
                        <View key={ann._id} style={{ backgroundColor: ann.isPinned ? "rgba(245,158,11,0.1)" : "#17171C", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: ann.isPinned ? "rgba(245,158,11,0.35)" : "#26262D" }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <View style={{ flex: 1 }}>
                              {ann.isPinned && <Text style={{ color: "#FBBF24", fontSize: 10, fontWeight: "700", marginBottom: 2 }}>📌 PINNED</Text>}
                              <Text style={{ fontWeight: "800", color: T.text, fontSize: 14, marginBottom: 4 }}>{ann.title}</Text>
                              <Text style={{ color: T.textDim, fontSize: 13, lineHeight: 19 }}>{ann.body}</Text>
                            </View>
                            {isOwner && (
                              <TouchableOpacity onPress={() => handleDeleteAnnouncement(ann._id)} style={{ marginLeft: 8 }}>
                                <Ionicons name="trash-outline" size={16} color="#F87171" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* ── Recap Tab ── */}
                {detailsTab === "recap" && (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={styles.sectionTitle}>Post-Event Recap</Text>
                      {isOwner && new Date(selectedEvent?.date) < new Date() && (
                        <TouchableOpacity onPress={() => setShowRecapForm((p) => !p)}
                          style={{ backgroundColor: T.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                          <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 13 }}>{selectedEvent?.recap?.summary ? "Edit" : "+ Add Recap"}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {isOwner && showRecapForm && (
                      <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: T.border }}>
                        <TextInput value={recapForm.summary} onChangeText={(v) => setRecapForm((p) => ({ ...p, summary: v }))}
                          placeholder="How did the event go? Share a recap..." placeholderTextColor={T.textMuted} multiline
                          style={{ backgroundColor: T.bg, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.border, color: T.text, minHeight: 100, textAlignVertical: "top" }} />
                        <TouchableOpacity onPress={handlePickRecapCover}
                          style={{ backgroundColor: T.surfaceAlt, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 10, flexDirection: "row", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: T.border }}>
                          <Ionicons name="image-outline" size={16} color={T.textDim} />
                          <Text style={{ color: T.textDim, fontWeight: "600" }}>{recapForm.coverPreview ? "Cover selected ✓" : "Add Cover Photo"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handlePostRecap} disabled={uploadingRecap}
                          style={{ backgroundColor: T.accent, borderRadius: 10, paddingVertical: 12, alignItems: "center", opacity: uploadingRecap ? 0.6 : 1 }}>
                          {uploadingRecap ? <ActivityIndicator color={T.onAccent} /> : <Text style={{ color: T.onAccent, fontWeight: "800" }}>Publish Recap</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                    {selectedEvent?.recap?.summary ? (
                      <View>
                        {selectedEvent.recap.coverPhotoUrl ? (
                          <Image source={{ uri: selectedEvent.recap.coverPhotoUrl }} style={{ width: "100%", height: 180, borderRadius: 14, marginBottom: 12 }} resizeMode="cover" />
                        ) : null}
                        <Text style={{ color: T.text, fontSize: 15, lineHeight: 22 }}>{selectedEvent.recap.summary}</Text>
                        {selectedEvent.recap.postedAt && (
                          <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 8 }}>Posted {new Date(selectedEvent.recap.postedAt).toLocaleDateString()}</Text>
                        )}
                      </View>
                    ) : (
                      <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                        <Ionicons name="document-text-outline" size={48} color={T.border} />
                        <Text style={{ color: T.textMuted, textAlign: "center" }}>
                          {new Date(selectedEvent?.date) < new Date()
                            ? isOwner ? "Post a recap to share how it went" : "No recap posted yet"
                            : "Recap will be available after the event"}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

              </>
            )}
      </KeyboardBottomSheet>
      {/* ── Share Event QR Modal ── */}
      <Modal visible={showShareModal} transparent animationType="slide" hardwareAccelerated onRequestClose={() => setShowShareModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={{ position: "absolute", inset: 0, flex: 1 }} activeOpacity={1} onPress={() => setShowShareModal(false)} />
          <View style={[shareModalSheet, { position: "absolute", left: 0, right: 0, bottom: 0 }]}>
            <View style={{ width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: "800", color: T.text, marginBottom: 4 }}>Share Event</Text>
            <Text style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }} numberOfLines={1}>{selectedEvent?.title}</Text>

            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: T.border }}>
                {shareEventLink ? <QRCode value={shareEventLink} size={180} /> : null}
              </View>
              <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 10, textAlign: "center" }}>
                Scan to join <Text style={{ fontWeight: "700", color: T.text }}>{selectedEvent?.title}</Text>
              </Text>
            </View>

            <View style={{ backgroundColor: T.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
              <Text style={{ color: T.textDim, fontSize: 12, fontFamily: "monospace" }} numberOfLines={2}>{shareEventLink}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setShowShareModal(false)}
                style={{ flex: 1, backgroundColor: T.surfaceAlt, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                <Text style={{ fontWeight: "600", color: T.textDim, fontSize: 15 }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNativeShare}
                style={{ flex: 1, backgroundColor: T.isDark ? "#081126" : T.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 48, shadowColor: "#081126", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}>
                <Text style={{ fontWeight: "700", color: T.isDark ? "#9AEA62" : T.onAccent, fontSize: 15 }}>Share Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Join Event Modal ── */}
      <Modal visible={showJoinEvent} animationType="slide" transparent hardwareAccelerated onRequestClose={() => { setShowJoinEvent(false); setEventScanned(false); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => { setShowJoinEvent(false); setEventScanned(false); }} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#0f172a", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: modalSheetBottomPad }}>
            <View style={{ width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
            <Text style={{ color: "white", fontWeight: "800", fontSize: 20, paddingHorizontal: 24, marginBottom: 16 }}>Join an Event</Text>

            {/* Tabs */}
            <View style={{ flexDirection: "row", marginHorizontal: 24, marginBottom: 20, backgroundColor: "#1e293b", borderRadius: 12, padding: 4 }}>
              {[{ key: "scan", icon: "qr-code-outline", label: "Scan" }, { key: "upload", icon: "image-outline", label: "Upload" }, { key: "link", icon: "link-outline", label: "Link" }].map((t) => (
                <TouchableOpacity key={t.key} onPress={() => { setJoinEventTab(t.key); setEventScanned(false); }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: joinEventTab === t.key ? T.accent : "transparent" }}>
                  <Ionicons name={t.icon} size={15} color={joinEventTab === t.key ? T.onAccent : "#64748b"} />
                  <Text style={{ color: joinEventTab === t.key ? T.onAccent : "#64748b", fontWeight: "700", fontSize: 13 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Scan Tab — live CameraView */}
            {joinEventTab === "scan" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20 }}>
                {!cameraPermission?.granted ? (
                  <View style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
                    <Ionicons name="camera-outline" size={52} color="#64748b" />
                    <Text style={{ color: "#94a3b8", textAlign: "center", fontSize: 14 }}>Camera permission needed{"\n"}to scan QR codes</Text>
                    <TouchableOpacity onPress={requestCameraPermission}
                      style={{ backgroundColor: T.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                      <Text style={{ color: T.onAccent, fontWeight: "700", fontSize: 14 }}>Allow Camera</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ borderRadius: 20, overflow: "hidden" }}>
                    <CameraView
                      style={{ width: "100%", aspectRatio: 1 }}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={eventScanned ? undefined : handleEventQRScanned}
                    />
                    <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                      {["tl", "tr", "bl", "br"].map((corner) => (
                        <View key={corner} style={{
                          position: "absolute", width: 28, height: 28, borderColor: T.accent, borderWidth: 3,
                          ...(corner.includes("t") ? { top: "25%", borderBottomWidth: 0 } : { bottom: "25%", borderTopWidth: 0 }),
                          ...(corner.includes("l") ? { left: "25%", borderRightWidth: 0, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 } : { right: "25%", borderLeftWidth: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4 }),
                        }} />
                      ))}
                      <Text style={{ color: "white", marginTop: "60%", fontWeight: "600", fontSize: 13, textShadowColor: "black", textShadowRadius: 4 }}>
                        {joiningEvent ? "Opening event…" : "Align QR code in frame"}
                      </Text>
                    </View>
                    {joiningEvent && (
                      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <ActivityIndicator size="large" color={T.accent} />
                        <Text style={{ color: "white", fontWeight: "600" }}>Opening event…</Text>
                      </View>
                    )}
                    {eventScanned && !joiningEvent && (
                      <TouchableOpacity onPress={() => setEventScanned(false)}
                        style={{ position: "absolute", bottom: 16, alignSelf: "center", backgroundColor: T.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: T.onAccent, fontWeight: "700" }}>Tap to scan again</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Upload Tab */}
            {joinEventTab === "upload" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20, alignItems: "center", gap: 16 }}>
                <View style={{ width: "100%", borderWidth: 2, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 16, paddingVertical: 40, alignItems: "center", gap: 10 }}>
                  <Ionicons name="image-outline" size={48} color="#64748b" />
                  <Text style={{ color: "#94a3b8", textAlign: "center", fontSize: 14 }}>Upload a screenshot or photo{"\n"}containing the QR code</Text>
                </View>
                <TouchableOpacity onPress={handleUploadEventQR} disabled={joiningEvent}
                  style={{ width: "100%", backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: joiningEvent ? 0.6 : 1 }}>
                  {joiningEvent ? <ActivityIndicator color={T.onAccent} /> : <Text style={{ color: T.onAccent, fontWeight: "700", fontSize: 15 }}>Choose Image</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Link Tab */}
            {joinEventTab === "link" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20, gap: 12 }}>
                <Text style={{ color: "#94a3b8", fontSize: 13 }}>Paste a PlayFlash event invite link or share code</Text>
                <TextInput
                  value={joinEventUrl}
                  onChangeText={setJoinEventUrl}
                  placeholder="Invite link or 12-character invite code"
                  placeholderTextColor="#475569"
                  style={{ backgroundColor: "#1e293b", borderRadius: 12, padding: 14, color: "white", fontSize: 14, borderWidth: 1, borderColor: "#334155" }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => joinEventByShareId(extractEventShareId(joinEventUrl))}
                  disabled={!joinEventUrl.trim() || joiningEvent}
                  style={{ backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: (!joinEventUrl.trim() || joiningEvent) ? 0.5 : 1 }}>
                  {joiningEvent ? <ActivityIndicator color={T.onAccent} /> : <Text style={{ color: T.onAccent, fontWeight: "700", fontSize: 15 }}>Open Event</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Event Modal ── */}
      <KeyboardBottomSheet
        visible={showEditEvent}
        onClose={() => setShowEditEvent(false)}
        scrollRef={editScrollRef}
        maxHeightRatio={0.88}
        sheetBackgroundColor={T.bg}
        footerBorderColor={T.border}
        footer={(
          <TouchableOpacity
            onPress={handleEditEvent}
            disabled={savingEdit}
            style={{
              backgroundColor: T.accent,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              opacity: savingEdit ? 0.6 : 1,
            }}
          >
            {savingEdit ? (
              <ActivityIndicator color={T.onAccent} />
            ) : (
              <Text style={{ color: T.onAccent, fontWeight: "800", fontSize: 16 }}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}
      >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: T.text }}>Edit Event</Text>
                <TouchableOpacity onPress={() => setShowEditEvent(false)}>
                  <Ionicons name="close" size={24} color={T.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>TITLE *</Text>
              <TextInput value={editForm.title} onChangeText={(v) => setEditForm((p) => ({ ...p, title: v }))}
                style={styles.input} placeholder="Event title" placeholderTextColor={T.textMuted} />

              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput value={editForm.description} onChangeText={(v) => setEditForm((p) => ({ ...p, description: v }))}
                style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} placeholder="What's this event about?" placeholderTextColor={T.textMuted} multiline />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>DATE *</Text>
                  <TouchableOpacity onPress={() => setEditShowDatePicker(true)}
                    style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                    <Text style={{ color: editForm.date ? T.text : T.textMuted, fontSize: 15 }}>
                      {editForm.date ? formatEventDateLabel(editForm.date) : "Select date"}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>TIME</Text>
                  <TouchableOpacity onPress={() => setEditShowTimePicker(true)}
                    style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                    <Text style={{ color: editTimeDisplay ? T.text : T.textMuted, fontSize: 15 }}>{editTimeDisplay || "Select time"}</Text>
                    <Ionicons name="time-outline" size={18} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {editShowDatePicker && (
                <DateTimePicker
                  value={editPickerDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={new Date()}
                  onChange={(e, d) => {
                    setEditShowDatePicker(Platform.OS === "ios");
                    if (e.type !== "dismissed" && d) {
                      setEditPickerDate(d);
                      const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
                      setEditForm((p) => ({ ...p, date: `${yyyy}-${mm}-${dd}` }));
                    }
                  }}
                />
              )}
              {editShowTimePicker && (
                <DateTimePicker
                  value={editPickerDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  is24Hour={false}
                  onChange={(e, d) => {
                    setEditShowTimePicker(Platform.OS === "ios");
                    if (e.type !== "dismissed" && d) {
                      setEditPickerDate(d);
                      const hh = d.getHours(); const min = d.getMinutes();
                      const hours12 = hh % 12 || 12; const ampm = hh < 12 ? "AM" : "PM";
                      setEditTimeDisplay(`${String(hours12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${ampm}`);
                      setEditForm((p) => ({ ...p, time: `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}` }));
                    }
                  }}
                />
              )}

              <Text style={styles.label}>LOCATION</Text>
              <GooglePlacesInput
                value={editForm.location}
                onSelect={(v, coords) => setEditForm((p) => ({ ...p, location: v, coordinates: coords || null }))}
                placeholder="Venue / address (e.g. Hitech City, Hyderabad)"
                inputStyle={{
                  backgroundColor: T.inputBg,
                  borderWidth: 1,
                  borderColor: T.inputBorder,
                  borderRadius: 12,
                }}
                containerStyle={{ marginBottom: 14 }}
              />

              <Text style={styles.label}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c.value} onPress={() => setEditForm((p) => ({ ...p, category: c.value }))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: editForm.category === c.value ? T.accent : T.surfaceAlt, borderWidth: 1, borderColor: editForm.category === c.value ? T.accent : T.border }}>
                      <Text style={{ color: editForm.category === c.value ? T.onAccent : T.textDim, fontWeight: "600", fontSize: 13 }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>MAX PARTICIPANTS</Text>
              <TextInput value={editForm.maxParticipants} onChangeText={(v) => setEditForm((p) => ({ ...p, maxParticipants: v }))}
                style={styles.input} placeholder="Default 50" placeholderTextColor={T.textMuted} keyboardType="number-pad" />

      </KeyboardBottomSheet>

      {/* ── Check-in QR Modal ── */}
      <Modal visible={showCheckinQR} transparent animationType="slide" hardwareAccelerated onRequestClose={() => setShowCheckinQR(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <TouchableOpacity style={{ position: "absolute", inset: 0 }} activeOpacity={1} onPress={() => setShowCheckinQR(false)} />
          <View style={[shareModalSheet, { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }]}>
            <View style={{ width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: "800", color: T.text, marginBottom: 6 }}>Check-in QR</Text>
            <Text style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, textAlign: "center" }}>Show this QR code at the event entrance. Scan attendees in.</Text>
            <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: T.border, marginBottom: 16 }}>
              {selectedEvent?.shareId ? <QRCode value={`checkin:${selectedEvent._id}:${selectedEvent.shareId}`} size={200} /> : null}
            </View>
            <Text style={{ color: T.textMuted, fontSize: 12, textAlign: "center", marginBottom: 20 }}>
              Each attendee scan confirms their attendance at {selectedEvent?.title}
            </Text>
            <TouchableOpacity onPress={() => setShowCheckinQR(false)}
              style={{ width: "100%", backgroundColor: "#0B1324", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
              <Text style={{ color: T.isDark ? "#BAF072" : "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getEventStyles = (theme) => ({
  label: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    marginBottom: 14,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 8,
  },
  sectionSubTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: theme.textMuted,
    marginBottom: 8,
  },
  blockCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  blockTitle: {
    color: theme.text,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 3,
  },
  blockDescription: {
    color: theme.textDim,
    marginBottom: 4,
  },
  blockMeta: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  formSection: {
    marginTop: 8,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  compactInput: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    marginBottom: 8,
  },
  secondaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: theme.onAccent,
    fontWeight: "800",
  },
});
