import { useState, useEffect, useRef } from "react";
import { ActivityIndicator, Alert, Animated as RNAnimated, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { io } from "socket.io-client";
import { useRouter } from "expo-router";
import { getSchedulesByTeamAPI, createScheduleAPI, updateScheduleAPI, deleteScheduleAPI } from "@/services/ScheduleApi";
import { getMyTournamentsAPI } from "@/services/TournamentApi";
import TeamTournamentsStrip from "./TeamTournamentsStrip";
import { patchTeamSchedulesInCache } from "@/lib/teamCache";
import { formatDate } from "./helpers";
import GooglePlacesInput from "@/components/GooglePlacesInput";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const TYPE_CONFIG_LIGHT = {
  game: { color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC", label: "Game" },
  practice: {
    color: "#2563EB",
    bg: "#DBEAFE",
    border: "#93C5FD",
    label: "Practice",
  },
  other: {
    color: "#D97706",
    bg: "#FEF3C7",
    border: "#FCD34D",
    label: "Event",
  },
};

const TYPE_CONFIG_DARK = {
  game: { color: "#4ADE80", bg: "rgba(34,197,94,0.28)", border: "rgba(74,222,128,0.45)", label: "Game" },
  practice: {
    color: "#60A5FA",
    bg: "rgba(59,130,246,0.32)",
    border: "rgba(96,165,250,0.5)",
    label: "Practice",
  },
  other: {
    color: "#FBBF24",
    bg: "rgba(245,158,11,0.28)",
    border: "rgba(251,191,36,0.45)",
    label: "Event",
  },
};

const getEventDurationParts = (ev) => {
  if (ev?.durationHours != null || ev?.durationMinutes != null) {
    return {
      hours: Number(ev.durationHours) || 0,
      minutes: Number(ev.durationMinutes) || 0,
    };
  }
  if (ev?.duration && typeof ev.duration === "object") {
    return {
      hours: Number(ev.duration.hours) || 0,
      minutes: Number(ev.duration.minutes) || 0,
    };
  }
  return null;
};

const scrollToFieldY = (scrollRef, yOffset, delayMs = Platform.OS === "ios" ? 320 : 150) => {
  setTimeout(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, yOffset - 80),
      animated: true,
    });
  }, delayMs);
};

const getScheduleId = (schedule) => {
  if (!schedule) return "";
  const raw = schedule._id ?? schedule.id;
  if (!raw) return "";
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (typeof raw === "object" && raw.$oid) return String(raw.$oid);
  return String(raw);
};

const scheduleEventIso = (schedule) => {
  if (!schedule) return "";
  try {
    return new Date(schedule.startDate || schedule.date).toISOString();
  } catch {
    return "";
  }
};

/** Collect every schedule row that represents the same event (mirror copies across teams). */
const collectRelatedScheduleIds = (schedules, original, primaryId) => {
  const ids = new Set();
  if (primaryId) ids.add(primaryId);
  const originalIso = scheduleEventIso(original);
  if (!originalIso) return [...ids];

  for (const s of schedules || []) {
    const sid = getScheduleId(s);
    if (!sid || ids.has(sid)) continue;
    if (s.eventType !== original.eventType) continue;
    if (scheduleEventIso(s) !== originalIso) continue;
    ids.add(sid);
  }
  return [...ids];
};

function SkeletonCard({ isDark = false }) {
  const opacity = useRef(new RNAnimated.Value(0.5)).current;
  const bone = isDark ? "#2A2A2E" : "#E8EDF4";
  const cardBg = isDark ? "#16161A" : "white";
  const insetBg = isDark ? "#1E1E24" : "#F8FAFC";
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <RNAnimated.View style={{ opacity, backgroundColor: cardBg, borderRadius: 18, marginBottom: 12, overflow: "hidden", borderWidth: isDark ? 1 : 0, borderColor: "#2A2A2E", shadowColor: "#081126", shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.25 : 0.08, shadowRadius: 8, elevation: 3 }}>
      <View style={{ padding: 14, paddingLeft: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bone, marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: "62%", height: 14, backgroundColor: bone, borderRadius: 7, marginBottom: 8 }} />
            <View style={{ width: "38%", height: 10, backgroundColor: bone, borderRadius: 5 }} />
          </View>
        </View>
        <View style={{ backgroundColor: insetBg, borderRadius: 12, padding: 10 }}>
          <View style={{ width: "72%", height: 12, backgroundColor: bone, borderRadius: 6, marginBottom: 7 }} />
          <View style={{ width: "52%", height: 12, backgroundColor: bone, borderRadius: 6, marginBottom: 7 }} />
          <View style={{ width: "42%", height: 12, backgroundColor: bone, borderRadius: 6 }} />
        </View>
      </View>
    </RNAnimated.View>
  );
}

export default function ScheduleTab({ schedules, isOwner, teamId, onRefresh, refreshing, isSelfOwnedOpponent = false, opponentTeamId = null, onScheduleDeleted }) {
  const router = useRouter();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [tournaments, setTournaments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);

  // Tournaments this team is part of (shown as a strip above the schedule).
  useEffect(() => {
    let active = true;
    if (!teamId) return;
    getMyTournamentsAPI([teamId])
      .then((res) => {
        if (active) setTournaments(res?.data || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [teamId]);
  const [form, setForm] = useState({
    eventType: "practice",
    title: "",
    startDate: new Date(),
    allDay: false,
    durationHours: 1,
    durationMinutes: 30,
    arriveTime: new Date(),
    repeats: "Never",
    location: "",
  });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showArrivePicker, setShowArrivePicker] = useState(false);
  const [locationSuggestionsOpen, setLocationSuggestionsOpen] = useState(false);
  const scheduleModalScrollRef = useRef(null);
  const locationFieldY = useRef(0);
  const titleFieldY = useRef(0);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const editingTargetRef = useRef(null);
  const scheduleFooterBottomPad = Math.max(8, insets.bottom + 6);

  // confirmedDeletedIds: a ref (never reset on re-render or prop change).
  // Once an ID lands here after a successful API delete it is ALWAYS filtered
  // from the display — even if the backend returns stale cache data on refresh.
  const confirmedDeletedIds = useRef(new Set());
  // deletedIds state: optimistic hide from the moment the user taps Delete,
  // before the API call even completes.
  const [deletedIds, setDeletedIds] = useState([]);
  // Show skeleton while waiting for new data after save
  const [localRefreshing, setLocalRefreshing] = useState(false);
  // Optimistic patches so cards update immediately after save (duration, etc.)
  const [schedulePatches, setSchedulePatches] = useState({});
  // When parent refreshes schedules, drop optimistic patches only after the server
  // row matches what we saved (avoids flicker back to stale data on slow backends).
  useEffect(() => {
    setDeletedIds([]);
    setLocalRefreshing(false);
    setSchedulePatches((prev) => {
      const keys = Object.keys(prev || {});
      if (!keys.length) return prev;
      const next = { ...prev };
      for (const id of keys) {
        const patch = prev[id];
        const row = (schedules || []).find((s) => String(s._id) === id);
        if (!row || !patch) continue;
        const rowStart = new Date(row.startDate || row.date).getTime();
        const patchStart = new Date(patch.startDate || patch.date).getTime();
        const sameStart = !Number.isNaN(rowStart) && rowStart === patchStart;
        const sameLocation = String(row.location || "").trim() === String(patch.location || "").trim();
        const sameType = String(row.eventType || "") === String(patch.eventType || "");
        if (sameStart && sameLocation && sameType) {
          delete next[id];
        }
      }
      return next;
    });
  }, [schedules]);

  const now = new Date();
  // Apply BOTH filters: optimistic (state) + confirmed permanent (ref)
  let filtered = [...(schedules || [])]
    .filter(
      (s) => !deletedIds.includes(String(s._id)) && !confirmedDeletedIds.current.has(String(s._id))
    )
    .map((s) => {
      const patch = schedulePatches[String(s._id)];
      return patch ? { ...s, ...patch } : s;
    });
  if (filter === "upcoming")
    filtered = filtered.filter((s) => new Date(s.date || s.startDate) >= now);
  if (filter === "past")
    filtered = filtered.filter((s) => new Date(s.date || s.startDate) < now);
  if (typeFilter !== "all")
    filtered = filtered.filter((s) => s.eventType === typeFilter);
  filtered.sort(
    (a, b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate),
  );
  // Deduplicate for display only — when isSelfOwnedOpponent both teams' schedules
  // are present in the array (needed so handleDelete can find the opponent copy).
  // We show only one card per eventType+startDate, keeping the first occurrence
  // (which belongs to the home team since mySchedules comes first in the array).
  const displaySeen = new Set();
  const displayFiltered = filtered.filter((s) => {
    try {
      const key = `${s.eventType}_${new Date(s.startDate || s.date).toISOString()}`;
      if (displaySeen.has(key)) return false;
      displaySeen.add(key);
      return true;
    } catch {
      return true;
    }
  });

  const openAdd = () => {
    editingTargetRef.current = null;
    setEditing(null);
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setForm({
      eventType: "practice",
      title: "",
      startDate: d,
      allDay: false,
      durationHours: 1,
      durationMinutes: 30,
      arriveTime: new Date(d.getTime() - 30 * 60000),
      repeats: "Never",
      location: "",
      sendNotification: true,
    });
    setShowModal(true);
    setLocationSuggestionsOpen(false);
  };

  const openEdit = (ev) => {
    editingTargetRef.current = ev;
    setEditing(ev);
    const sd =
      ev.startDate || ev.date ? new Date(ev.startDate || ev.date) : new Date();
    let dh = 1,
      dm = 30;
    if (ev.durationHours != null) dh = ev.durationHours;
    if (ev.durationMinutes != null) dm = ev.durationMinutes;
    if (ev.duration && typeof ev.duration === "object") {
      dh = ev.duration.hours || 0;
      dm = ev.duration.minutes || 0;
    }
    setForm({
      eventType: ev.eventType || "practice",
      title: ev.title || "",
      startDate: sd,
      allDay: ev.allDay || false,
      durationHours: dh,
      durationMinutes: dm,
      arriveTime: ev.arriveTime
        ? new Date(ev.arriveTime)
        : new Date(sd.getTime() - 30 * 60000),
      repeats: ev.repeats || "Never",
      location: ev.location || "",
      sendNotification: ev.sendNotification !== false,
    });
    setShowModal(true);
    setLocationSuggestionsOpen(false);
  };

  const closeEditor = () => {
    setShowModal(false);
    setEditing(null);
    editingTargetRef.current = null;
    setLocationSuggestionsOpen(false);
  };

  const handleSave = async () => {
    if (!form.location.trim())
      return Alert.alert("Location required", "Please add a location for this event.");
    if (form.eventType === "other" && !form.title.trim())
      return Alert.alert("Title required", "Please add a title for this event.");
    setSaving(true);
    try {
      const data = {
        teamId,
        eventType: form.eventType,
        startDate: form.startDate,
        location: form.location.trim(),
        allDay: form.allDay,
        durationHours: parseInt(form.durationHours) || 0,
        durationMinutes: parseInt(form.durationMinutes) || 0,
        repeats: form.repeats,
        sendNotification: form.sendNotification !== false,
      };
      if (form.eventType !== "other") {
        data.arriveTime = form.arriveTime;
      }
      if (form.eventType === "other" && form.title.trim()) {
        data.title = form.title.trim();
      }
      const durationPatch = {
        durationHours: data.durationHours,
        durationMinutes: data.durationMinutes,
        duration: { hours: data.durationHours, minutes: data.durationMinutes },
      };

      const editTarget = editingTargetRef.current || editing;
      const scheduleId = getScheduleId(editTarget);

      if (editTarget) {
        if (!scheduleId) {
          Alert.alert("Couldn't update event", "We couldn't identify this event. Please try again.");
          setSaving(false);
          return;
        }

        const idsToUpdate = collectRelatedScheduleIds(schedules, editTarget, scheduleId);
        const patchPayload = { ...data, ...durationPatch, startDate: data.startDate };
        const nextPatches = {};
        idsToUpdate.forEach((sid) => {
          nextPatches[String(sid)] = patchPayload;
        });
        setSchedulePatches((prev) => ({ ...prev, ...nextPatches }));
        closeEditor();

        await Promise.all(
          idsToUpdate.map(async (sid) => {
            const row = (schedules || []).find((s) => getScheduleId(s) === sid);
            const payload = {
              ...data,
              teamId: row?.teamId || row?.team || teamId,
            };
            await updateScheduleAPI(sid, payload);
          }),
        );
        await patchTeamSchedulesInCache(teamId, idsToUpdate, patchPayload);
        if (opponentTeamId) {
          await patchTeamSchedulesInCache(opponentTeamId, idsToUpdate, patchPayload);
        }
      } else {
        closeEditor();
        await createScheduleAPI(data);
        // Mirror create to opponent team
        if (isSelfOwnedOpponent && opponentTeamId) {
          try { await createScheduleAPI({ ...data, teamId: opponentTeamId }); } catch {}
        }
      }
      onRefresh();
    } catch (err) {
      Alert.alert(
        "Couldn't save event",
        err.response?.data?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (ev) => {
    Alert.alert("Delete Event", `Delete "${ev.title || ev.eventType}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const evId = String(ev._id);
          setDeletingEventId(ev._id);
          // Optimistic hide — item disappears immediately
          setDeletedIds((prev) => [...prev, evId]);
          try {
            await deleteScheduleAPI(ev._id);
            // ── Permanent filter: add to the ref so no future refresh can
            //    resurrect this item, even if Redis cache is stale. ──
            confirmedDeletedIds.current.add(evId);
            // Notify parent so its filterDeleted guard also covers it
            onScheduleDeleted?.(evId);
            // Mirror delete to opponent team if applicable.
            // schedules prop now contains ALL entries from both teams (no dedup)
            // so we can reliably find the matching opponent copy here.
            if (isSelfOwnedOpponent && opponentTeamId) {
              const evIso = new Date(ev.startDate || ev.date).toISOString();
              const oppMatch = (schedules || []).find((s) => {
                try {
                  const sIso = new Date(s.startDate || s.date).toISOString();
                  return (
                    String(s._id) !== evId &&
                    String(s.teamId || s.team || "") === String(opponentTeamId) &&
                    s.eventType === ev.eventType &&
                    sIso === evIso
                  );
                } catch {
                  return false;
                }
              });
              if (oppMatch) {
                const oppId = String(oppMatch._id);
                // Optimistic hide + permanent filter for opponent copy too
                setDeletedIds((prev) => [...prev, oppId]);
                confirmedDeletedIds.current.add(oppId);
                onScheduleDeleted?.(oppId);
                try {
                  await deleteScheduleAPI(oppMatch._id);
                } catch {}
              }
            }
          } catch {
            // Rollback optimistic hide if the API call actually failed
            setDeletedIds((prev) => prev.filter((id) => id !== evId));
          } finally {
            setDeletingEventId(null);
          }
        },
      },
    ]);
  };

  const formatTime12 = (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateLong = (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const typeConfig = isDark ? TYPE_CONFIG_DARK : TYPE_CONFIG_LIGHT;

  const upcomingCount = (schedules || []).filter(
    (s) => new Date(s.date || s.startDate) >= now,
  ).length;

  const fieldRowClass = isDark ? "rounded-xl px-4 py-3.5 mb-1 flex-row items-center justify-between" : "bg-gray-100 rounded-xl px-4 py-3.5 mb-1 flex-row items-center justify-between";
  const fieldRowStyle = isDark ? { backgroundColor: T.inputBg } : undefined;
  const labelStyle = isDark ? { color: T.textMuted } : undefined;
  const bodyTextStyle = isDark ? { color: T.text } : undefined;
  const iconMuted = isDark ? T.textMuted : "#6B7280";
  const chevronMuted = isDark ? T.textMuted : "#9CA3AF";
  const inactiveChipBg = isDark ? T.inputBg : "#F3F4F6";
  const inactiveChipText = isDark ? T.textDim : "#6B7280";

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? T.bg : "#F0F4F8" }}>
      {/* Header — dark navy banner (branded; same in light + dark) */}
      <View className="" style={{ backgroundColor: "#081126", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 }}>Schedule</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              {/* <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#9AEA62" }} /> */}
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {upcomingCount} upcoming
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>·</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {(schedules || []).length} total
              </Text>
            </View>
          </View>
          {isOwner && (
            <TouchableOpacity
              onPress={openAdd}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#9AEA62", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 7 }}
            >
              <Ionicons name="add" size={16} color="#081126" />
              <Text style={{ color: "#081126", fontWeight: "800", fontSize: 13 }}>Add Event</Text>
            </TouchableOpacity>
          )}
        </View>

     <View className="flex flex-col items-center">
         {/* Time segmented control */}
        <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 4, marginBottom: 12 }}>
          {[
            { k: "all", l: "All" },
            { k: "upcoming", l: "Upcoming" },
            { k: "past", l: "Past" },
          ].map(({ k, l }) => (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: filter === k ? "#9AEA62" : "transparent" }}
            >
              <Text style={{ fontWeight: "700", fontSize: 13, color: filter === k ? "#081126" : "rgba(255,255,255,0.5)" }}>
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { k: "all", l: "All", icon: "grid-outline" },
            { k: "game", l: "Games", icon: "trophy-outline" },
            { k: "practice", l: "Practice", icon: "fitness-outline" },
            { k: "other", l: "Other", icon: "star-outline" },
          ].map(({ k, l, icon }) => (
            <TouchableOpacity
              key={k}
              onPress={() => setTypeFilter(k)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 5,
                backgroundColor: typeFilter === k ? "#9AEA62" : "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderColor: typeFilter === k ? "#9AEA62" : "rgba(255,255,255,0.15)",
              }}
            >
              <Ionicons name={icon} size={12} color={typeFilter === k ? "#081126" : "rgba(255,255,255,0.7)"} />
              <Text style={{ fontWeight: "700", fontSize: 12, color: typeFilter === k ? "#081126" : "rgba(255,255,255,0.7)" }}>
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
     </View>
      </View>

      <TeamTournamentsStrip
        teamId={teamId}
        tournaments={tournaments}
        isDark={isDark}
        style={{ paddingTop: 12, paddingHorizontal: 16 }}
      />

      {displayFiltered.length === 0 && localRefreshing ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
        </ScrollView>
      ) : displayFiltered.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={["#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          <ExpoImage
            source={TEAM_EMPTY_ICONS.events}
            style={[TEAM_EMPTY_ICON_STYLE, { marginBottom: 8 }]}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? T.text : "#0F172A" }}>No events found</Text>
          <Text style={{ color: isDark ? T.textMuted : "#94A3B8", fontSize: 13, marginTop: 4 }}>
            {filter !== "all" ? "Try changing your filter" : "Nothing scheduled yet"}
          </Text>
          {isOwner && filter === "all" && (
            <TouchableOpacity
              onPress={openAdd}
              style={{
                marginTop: 20,
                backgroundColor: isDark ? "#1E1E24" : "#081126",
                borderWidth: isDark ? 1 : 0,
                borderColor: "#2A2A2E",
                paddingHorizontal: 28,
                paddingVertical: 12,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={isDark ? "#F5F5F7" : "#9AEA62"} />
              <Text style={{ color: isDark ? "#F5F5F7" : "#9AEA62", fontWeight: "800", fontSize: 14 }}>Add First Event</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={["#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          {displayFiltered.map((ev, idx) => {
            const isPast = new Date(ev.date || ev.startDate) < now;
            const evDate = new Date(ev.date || ev.startDate);
            const durationParts = getEventDurationParts(ev);
            const hasDuration = !!durationParts;
            const tc = typeConfig[ev.eventType] || typeConfig.other;
            return (
              <View
                key={ev._id || idx}
                style={{
                  backgroundColor: isDark ? T.surface : "white",
                  borderRadius: 18,
                  marginBottom: 12,
                  overflow: "hidden",
                  opacity: 1,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: T.border,
                  shadowColor: "#081126",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.3 : 0.08,
                  shadowRadius: 8,
                  elevation: 30,
                }}
              >
                {/* Left accent — thin bar in dark (full-color blob washes out icon/badge) */}
                {isDark ? (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      backgroundColor: tc.color,
                    }}
                  />
                ) : (
                  <View
                    className="w-30 rounded-tr-full rounded-br-full"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: tc.color,
                    }}
                  />
                )}
                <View style={{ padding: 14, paddingLeft: 18 }}>
                  {/* Header row */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: tc.bg,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: isDark ? 1 : 0,
                          borderColor: tc.border,
                        }}
                      >
                        <Ionicons
                          name={
                            ev.eventType === "game"
                              ? "trophy-outline"
                              : ev.eventType === "practice"
                                ? "fitness-outline"
                                : "calendar-outline"
                          }
                          size={20}
                          color={tc.color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "800", fontSize: 15, color: isDark ? T.text : "#0F172A" }} numberOfLines={1}>
                          {ev.title || tc.label}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 20,
                              backgroundColor: tc.bg,
                              borderWidth: isDark ? 1 : 0,
                              borderColor: tc.border,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: tc.color, textTransform: "capitalize" }}>
                              {ev.eventType}
                            </Text>
                          </View>
                          {isPast && (
                            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: "#f4380e" }}>
                              <Text style={{ fontSize: 11, color: "#fafafb", fontWeight: "600" }}>Past</Text>
                            </View>
                          )}
                          {ev.repeats && ev.repeats !== "Never" && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="repeat-outline" size={11} color={isDark ? T.textMuted : "#9CA3AF"} />
                              <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF" }}>{ev.repeats}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    {isOwner && (
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => openEdit(ev)}
                          disabled={deletingEventId === ev._id}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: isDark ? T.surfaceAlt : "#F0F4F8",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="create-outline" size={15} color={isDark ? T.textDim : "#64748B"} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(ev)}
                          disabled={deletingEventId === ev._id}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: isDark ? T.dangerBg : "#FEF2F2",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {deletingEventId === ev._id ? (
                            <ActivityIndicator size="small" color={isDark ? T.dangerText : "#EF4444"} />
                          ) : (
                            <Ionicons name="trash-outline" size={15} color={isDark ? T.dangerText : "#EF4444"} />
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Details row — already dark inset; keep in both themes */}
                  <View style={{ backgroundColor: isDark ? "#0A0A0C" : "#161616", borderRadius: 12, padding: 10, gap: 6, borderWidth: isDark ? 1 : 0, borderColor: T.borderSubtle }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="calendar-outline" size={18} color={isDark ? T.textDim : "#64748B"} />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? T.textDim : "#8b94a2" }}>{formatDateLong(evDate)}</Text>
                    </View>
                    {!ev.allDay && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="time-outline" size={18} color={isDark ? T.textDim : "#64748B"} />
                        <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#b3b9c2" }}>
                          {formatTime12(evDate)}
                          {hasDuration ? (
                            <Text style={{ color: isDark ? T.textMuted : "#a2adbe" }}>
                              {" "}· {durationParts.hours}h {durationParts.minutes}m
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                    )}
                    {ev.allDay && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="sunny-outline" size={18} color={isDark ? T.textDim : "#64748B"} />
                        <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#475569" }}>All day</Text>
                      </View>
                    )}
                    {ev.arriveTime && !ev.allDay && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="walk-outline" size={18} color={isDark ? T.textDim : "#64748B"} />
                        <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#b3b9c2" }}>Arrive by {formatTime12(ev.arriveTime)}</Text>
                      </View>
                    )}
                    {ev.location ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="location-outline" size={18} color="#9AEA62" />
                        <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#b3b9c2", flex: 1 }} numberOfLines={1}>{ev.location}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          closeEditor();
        }}
      >
        <View style={{ flex: 1, backgroundColor: isDark ? T.overlay : "rgba(8, 17, 38, 0.55)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView
            style={{ width: "100%" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <View style={{ backgroundColor: isDark ? T.surface : "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 3, borderTopColor: isDark ? T.border : "#9AEA62", height: "94%", overflow: "hidden" }}>
              <View style={{ alignItems: "center", paddingTop: 10 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? T.border : "#D1D5DB" }} />
              </View>
              <View style={{ paddingHorizontal: 24, paddingTop: 8, flexShrink: 0 }}>
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ fontSize: 20, fontWeight: "800", color: isDark ? T.text : "#081126" }}>
                  {editing ? "Edit Event" : "New Event"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    closeEditor();
                  }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6", alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={20} color={isDark ? T.textDim : "#374151"} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={scheduleModalScrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator
              nestedScrollEnabled
              bounces={false}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 16,
              }}
            >
                {/* Event Type */}
                <Text
                  className="text-gray-500 text-xs font-bold mb-2"
                  style={labelStyle}
                >
                  EVENT TYPE *
                </Text>
                <View className="flex-row gap-2 mb-4">
                  {["game", "practice", "other"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm({ ...form, eventType: t })}
                      className="flex-1 py-2.5 rounded-xl items-center"
                      style={{
                        backgroundColor:
                          form.eventType === t ? "#081126" : inactiveChipBg,
                      }}
                    >
                      <Text
                        style={{
                          color: form.eventType === t ? "#9AEA62" : inactiveChipText,
                        }}
                        className="font-bold capitalize text-sm"
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date Picker */}
                <Text
                  className="text-gray-500 text-xs font-bold mb-1"
                  style={labelStyle}
                >
                  DATE & TIME *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className={fieldRowClass}
                  style={fieldRowStyle}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={iconMuted}
                    />
                    <Text className="text-gray-800" style={bodyTextStyle}>
                      {formatDateLong(form.startDate)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={chevronMuted} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={form.startDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    themeVariant={isDark ? "dark" : "light"}
                    minimumDate={new Date()}
                    onChange={(e, d) => {
                      setShowDatePicker(Platform.OS === "ios");
                      if (d) {
                        const newDate = new Date(form.startDate);
                        newDate.setFullYear(
                          d.getFullYear(),
                          d.getMonth(),
                          d.getDate(),
                        );
                        setForm({ ...form, startDate: newDate });
                        if (!form.allDay)
                          setTimeout(() => setShowTimePicker(true), 300);
                      }
                    }}
                  />
                )}

                {/* Time Picker (not for allDay) */}
                {!form.allDay && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowTimePicker(true)}
                      className={fieldRowClass}
                      style={fieldRowStyle}
                    >
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={iconMuted}
                        />
                        <Text className="text-gray-800" style={bodyTextStyle}>
                          Start: {formatTime12(form.startDate)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={chevronMuted} />
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={form.startDate}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        themeVariant={isDark ? "dark" : "light"}
                        minuteInterval={15}
                        onChange={(e, d) => {
                          setShowTimePicker(Platform.OS === "ios");
                          if (d) setForm({ ...form, startDate: d });
                        }}
                      />
                    )}
                  </>
                )}

                {/* All Day Toggle (game/practice only) */}
                {form.eventType !== "other" && (
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, allDay: !form.allDay })}
                    className={isDark ? "flex-row items-center justify-between rounded-xl px-4 py-3 mb-3" : "flex-row items-center justify-between bg-gray-100 rounded-xl px-4 py-3 mb-3"}
                    style={isDark ? { backgroundColor: T.inputBg } : undefined}
                  >
                    <Text className="text-gray-700 font-medium" style={bodyTextStyle}>All Day</Text>
                    <Ionicons
                      name={form.allDay ? "checkbox" : "square-outline"}
                      size={22}
                      color={form.allDay ? (isDark ? "#F5F5F7" : "#081126") : chevronMuted}
                    />
                  </TouchableOpacity>
                )}

                {/* Duration (game/practice only) */}
                {form.eventType !== "other" && (
                  <>
                    <Text
                      className="text-gray-500 text-xs font-bold mb-1"
                      style={labelStyle}
                    >
                      DURATION
                    </Text>
                    <View className="flex-row gap-3 mb-3">
                      <View
                        className={isDark ? "flex-1 flex-row items-center rounded-xl px-4 py-3" : "flex-1 flex-row items-center bg-gray-100 rounded-xl px-4 py-3"}
                        style={isDark ? { backgroundColor: T.inputBg } : undefined}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            setForm({
                              ...form,
                              durationHours: Math.max(
                                0,
                                (parseInt(form.durationHours) || 0) - 1,
                              ),
                            })
                          }
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={22}
                            color={iconMuted}
                          />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center font-bold text-gray-800" style={bodyTextStyle}>
                          {form.durationHours}h
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setForm({
                              ...form,
                              durationHours: Math.min(
                                23,
                                (parseInt(form.durationHours) || 0) + 1,
                              ),
                            })
                          }
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={iconMuted}
                          />
                        </TouchableOpacity>
                      </View>
                      <View
                        className={isDark ? "flex-1 flex-row items-center rounded-xl px-4 py-3" : "flex-1 flex-row items-center bg-gray-100 rounded-xl px-4 py-3"}
                        style={isDark ? { backgroundColor: T.inputBg } : undefined}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            setForm({
                              ...form,
                              durationMinutes: Math.max(
                                0,
                                (parseInt(form.durationMinutes) || 0) - 15,
                              ),
                            })
                          }
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={22}
                            color={iconMuted}
                          />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center font-bold text-gray-800" style={bodyTextStyle}>
                          {form.durationMinutes}m
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setForm({
                              ...form,
                              durationMinutes: Math.min(
                                59,
                                (parseInt(form.durationMinutes) || 0) + 15,
                              ),
                            })
                          }
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={iconMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* Arrive Time (game/practice only) */}
                {form.eventType !== "other" && !form.allDay && (
                  <>
                    <Text
                      className="text-gray-500 text-xs font-bold mb-1"
                      style={labelStyle}
                    >
                      ARRIVE TIME
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowArrivePicker(true)}
                      className={isDark ? "rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between" : "bg-gray-100 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"}
                      style={isDark ? { backgroundColor: T.inputBg } : undefined}
                    >
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name="walk-outline"
                          size={18}
                          color={iconMuted}
                        />
                        <Text className="text-gray-800" style={bodyTextStyle}>
                          {formatTime12(form.arriveTime)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={chevronMuted} />
                    </TouchableOpacity>
                    {showArrivePicker && (
                      <DateTimePicker
                        value={form.arriveTime}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        themeVariant={isDark ? "dark" : "light"}
                        minuteInterval={15}
                        onChange={(e, d) => {
                          setShowArrivePicker(Platform.OS === "ios");
                          if (d) setForm({ ...form, arriveTime: d });
                        }}
                      />
                    )}
                  </>
                )}

                {/* Repeats (game/practice only) */}
                {form.eventType !== "other" && (
                  <>
                    <Text
                      className="text-gray-500 text-xs font-bold mb-1"
                      style={labelStyle}
                    >
                      REPEATS
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-3"
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {["Never", "Daily", "Weekly", "Monthly"].map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setForm({ ...form, repeats: r })}
                          className="px-4 py-2 rounded-xl"
                          style={{
                            backgroundColor:
                              form.repeats === r ? "#081126" : inactiveChipBg,
                          }}
                        >
                          <Text
                            style={{
                              color: form.repeats === r ? "#9AEA62" : inactiveChipText,
                            }}
                            className="font-semibold text-sm"
                          >
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Title (only for "other" event type) */}
                {form.eventType === "other" && (
                  <>
                    <Text
                      className="text-gray-500 text-xs font-bold mb-1"
                      style={labelStyle}
                    >
                      TITLE *
                    </Text>
                    <View
                      onLayout={(e) => {
                        titleFieldY.current = e.nativeEvent.layout.y;
                      }}
                    >
                      <TextInput
                        value={form.title}
                        onChangeText={(v) => setForm({ ...form, title: v })}
                        onFocus={() => scrollToFieldY(scheduleModalScrollRef, titleFieldY.current)}
                        className={isDark ? "rounded-xl px-4 py-3 mb-3" : "bg-gray-100 rounded-xl px-4 py-3 mb-3"}
                        style={isDark ? { backgroundColor: T.inputBg, color: T.text } : { color: "#111827" }}
                        placeholder="Event title"
                        placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                      />
                    </View>
                  </>
                )}

                {/* Location */}
                <View
                  style={{ zIndex: 30 }}
                  onLayout={(e) => {
                    locationFieldY.current = e.nativeEvent.layout.y;
                  }}
                >
                  <Text
                    className="text-gray-500 text-xs font-bold mb-1"
                    style={labelStyle}
                  >
                    LOCATION *
                  </Text>
                  <GooglePlacesInput
                    value={form.location}
                    onSelect={(v) => setForm({ ...form, location: v })}
                    onFocus={() => scrollToFieldY(scheduleModalScrollRef, locationFieldY.current)}
                    onSuggestionsVisibilityChange={setLocationSuggestionsOpen}
                    placeholder="Enter location (e.g., Main Stadium, Field 2)"
                    containerStyle={{ marginBottom: locationSuggestionsOpen ? 190 : 16 }}
                  />
                </View>

                {/* Notify team members toggle */}
                <TouchableOpacity
                  onPress={() => setForm({ ...form, sendNotification: !form.sendNotification })}
                  className={isDark ? "flex-row items-center justify-between rounded-xl px-4 py-3 mb-2" : "flex-row items-center justify-between bg-gray-100 rounded-xl px-4 py-3 mb-2"}
                  style={{ zIndex: 1, ...(isDark ? { backgroundColor: T.inputBg } : {}) }}
                >
                  <View style={{ flex: 1 }}>
                    <Text className="text-gray-700 font-medium" style={bodyTextStyle}>Notify team members</Text>
                    <Text className="text-gray-400 text-xs mt-0.5" style={isDark ? { color: T.textMuted } : undefined}>
                      {editing ? "Send update notification" : "Send push & email notification"}
                    </Text>
                  </View>
                  <Ionicons
                    name={form.sendNotification ? "notifications" : "notifications-off-outline"}
                    size={22}
                    color={form.sendNotification ? (isDark ? "#F5F5F7" : "#9AEA62") : chevronMuted}
                  />
                </TouchableOpacity>
            </ScrollView>
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: keyboardInset > 0 ? keyboardInset + 8 : scheduleFooterBottomPad,
                borderTopWidth: 1,
                borderTopColor: isDark ? T.borderSubtle : "#F3F4F6",
                backgroundColor: isDark ? T.surface : "#fff",
                flexShrink: 0,
              }}
            >
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="bg-[#9AEA62] py-4 rounded-xl items-center"
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#081126" />
                ) : (
                  <Text className="text-[#081126] font-bold text-base">
                    {editing ? "Update" : "Create Event"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      </Modal>
    </View>
  );
}

// =============================================
// OPPONENTS TAB - Owner only (2-step: name → logo)
// =============================================
