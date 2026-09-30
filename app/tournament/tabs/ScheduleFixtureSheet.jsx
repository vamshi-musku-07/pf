import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { buildScheduleFixturePayload } from "@/features/tournament/manageConfig";

function PickerField({ label, value, placeholder, icon, onPress, isDark, T }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: isDark ? T.textDim : "#6B7280",
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: isDark ? T.border : "#E5E7EB",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: value ? (isDark ? T.text : "#0B1324") : isDark ? T.textMuted : "#9CA3AF",
          }}
        >
          {value || placeholder}
        </Text>
        <Ionicons name={icon} size={16} color={isDark ? T.iconMuted : "#94A3B8"} />
      </View>
    </TouchableOpacity>
  );
}

export default function ScheduleFixtureSheet({ visible, fixture, busy, onClose, onSave }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [venue, setVenue] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const existing = fixture?.scheduledAt ? new Date(fixture.scheduledAt) : null;
    setDate(existing);
    setTime(existing);
    setVenue(fixture?.venue || "");
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, [visible, fixture]);

  const handleSave = () => {
    onSave(buildScheduleFixturePayload({ date, time, venue }));
  };

  const dateLabel = date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const timeLabel = time
    ? time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <KeyboardBottomSheet
      visible={visible}
      onClose={onClose}
      contentPadding={20}
      sheetBackgroundColor={isDark ? T.surface : "#fff"}
      footerBorderColor={isDark ? T.border : "#F3F4F6"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={onClose}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E5E7EB",
              backgroundColor: isDark ? T.surfaceAlt : "transparent",
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "700", color: isDark ? T.text : "#374151" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: "#0B1324",
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
              ...(isDark && { borderWidth: 1, borderColor: T.border }),
            }}
          >
            {busy ? (
              <ActivityIndicator color="#BAF072" />
            ) : (
              <Text style={{ fontWeight: "800", color: "#BAF072" }}>Save schedule</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324", marginBottom: 2 }}>
        Schedule match
      </Text>
      <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF", marginBottom: 16 }} numberOfLines={2}>
        {fixture?.label}
        {fixture?.homeTeamName && fixture?.awayTeamName
          ? ` · ${fixture.homeTeamName} vs ${fixture.awayTeamName}`
          : ""}
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <PickerField
          label="Date"
          value={dateLabel}
          placeholder="Pick date"
          icon="calendar-outline"
          onPress={() => setShowDatePicker(true)}
          isDark={isDark}
          T={T}
        />
        <PickerField
          label="Time"
          value={timeLabel}
          placeholder="Pick time"
          icon="time-outline"
          onPress={() => setShowTimePicker(true)}
          isDark={isDark}
          T={T}
        />
      </View>

      {showDatePicker ? (
        <DateTimePicker
          value={date || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={isDark ? "dark" : "light"}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowDatePicker(false);
            if (d) setDate(d);
          }}
        />
      ) : null}
      {showTimePicker ? (
        <DateTimePicker
          value={time || new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={isDark ? "dark" : "light"}
          onChange={(_, t) => {
            if (Platform.OS === "android") setShowTimePicker(false);
            if (t) setTime(t);
          }}
        />
      ) : null}

      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: isDark ? T.textDim : "#6B7280",
          marginTop: 14,
          marginBottom: 6,
        }}
      >
        Venue
      </Text>
      <TextInput
        value={venue}
        onChangeText={setVenue}
        placeholder="Ground / venue (optional)"
        placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
        maxLength={80}
        editable={!busy}
        style={{
          backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
          borderRadius: 12,
          padding: 12,
          fontSize: 14,
          color: isDark ? T.text : "#0B1324",
          borderWidth: 1,
          borderColor: isDark ? T.border : "#E5E7EB",
        }}
      />
    </KeyboardBottomSheet>
  );
}
