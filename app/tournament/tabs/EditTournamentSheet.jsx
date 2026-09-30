import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Switch, ActivityIndicator, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { showToast } from "@/context/ToastContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { validateEditTournamentForm, buildEditTournamentPayload, canEditQualifiersPerDivision } from "@/features/tournament/manageConfig";
import {
  QUALIFIERS_PER_DIVISION_OPTIONS,
  BASEBALL_INNINGS_OPTIONS,
  BASEBALL_EXTRA_INNINGS_OPTIONS,
  BASEBALL_TIME_LIMIT_OPTIONS,
  BASKETBALL_QUARTER_OPTIONS,
  BASKETBALL_OVERTIME_OPTIONS,
  BASKETBALL_SHOT_CLOCK_OPTIONS,
} from "@/features/tournament/createConfig";

function inputStyle(isDark, T) {
  return {
    backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: isDark ? T.text : "#0B1324",
    borderWidth: 1,
    borderColor: isDark ? T.border : "#E5E7EB",
  };
}

function FieldLabel({ children, isDark, T }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6, marginTop: 14 }}>
      {children}
    </Text>
  );
}

function DateField({ label, value, onPress, isDark, T }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>{label}</Text>
      <View style={[inputStyle(isDark, T), { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <Text style={{ fontSize: 14, color: value ? (isDark ? T.text : "#0B1324") : isDark ? T.textMuted : "#9CA3AF" }}>
          {value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not set"}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={isDark ? T.iconMuted : "#94A3B8"} />
      </View>
    </TouchableOpacity>
  );
}

function ToggleRow({ title, subtitle, value, onValueChange, disabled, isDark, T }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>{title}</Text>
        <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 2, lineHeight: 17 }}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: "#9AEA62" }} />
    </View>
  );
}

export default function EditTournamentSheet({ visible, tournament, busy, onClose, onSave }) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [pointsWin, setPointsWin] = useState("2");
  const [pointsTie, setPointsTie] = useState("1");
  const [pointsNoResult, setPointsNoResult] = useState("1");
  const [pointsWinStraight, setPointsWinStraight] = useState("3");
  const [pointsWinClose, setPointsWinClose] = useState("2");
  const [pointsLossClose, setPointsLossClose] = useState("1");
  const [pointsLossStraight, setPointsLossStraight] = useState("0");
  const [matchFormat, setMatchFormat] = useState("best_of_5");
  const [setPoints, setSetPoints] = useState("25");
  const [decidingSetPoints, setDecidingSetPoints] = useState("15");
  const [winByTwo, setWinByTwo] = useState(true);
  const [superOver, setSuperOver] = useState(true);
  const [extraTime, setExtraTime] = useState(true);
  const [penaltyShootout, setPenaltyShootout] = useState(true);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [qualifiersPerDivision, setQualifiersPerDivision] = useState(1);
  const [scheduledInnings, setScheduledInnings] = useState("7");
  const [extraInnings, setExtraInnings] = useState("unlimited");
  const [extraInningsMax, setExtraInningsMax] = useState("3");
  const [allowPoolTies, setAllowPoolTies] = useState(true);
  const [mercyRuleEnabled, setMercyRuleEnabled] = useState(true);
  const [mercyAfter5, setMercyAfter5] = useState("10");
  const [mercyAfter7, setMercyAfter7] = useState("8");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("0");
  const [quarterMinutes, setQuarterMinutes] = useState("10");
  const [overtimeMinutes, setOvertimeMinutes] = useState("5");
  const [shotClockSeconds, setShotClockSeconds] = useState("24");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (!visible || !tournament) return;
    const sport = String(tournament.sport || "").toLowerCase();
    setName(tournament.name || "");
    setSeason(tournament.season || "");
    setVenue(tournament.venue || "");
    setDescription(tournament.description || "");
    setStartDate(tournament.startDate ? new Date(tournament.startDate) : null);
    setEndDate(tournament.endDate ? new Date(tournament.endDate) : null);
    setPointsWin(String(tournament.config?.pointsWin ?? (sport === "football" ? 3 : 2)));
    setPointsTie(String(tournament.config?.pointsTie ?? 1));
    setPointsNoResult(String(tournament.config?.pointsNoResult ?? (sport === "volleyball" || sport === "baseball" ? 0 : 1)));
    setPointsWinStraight(String(tournament.config?.pointsWinStraight ?? 3));
    setPointsWinClose(String(tournament.config?.pointsWinClose ?? 2));
    setPointsLossClose(String(tournament.config?.pointsLossClose ?? 1));
    setPointsLossStraight(String(tournament.config?.pointsLossStraight ?? 0));
    setMatchFormat(tournament.config?.matchFormat === "best_of_3" ? "best_of_3" : "best_of_5");
    setSetPoints(String(tournament.config?.setPoints ?? 25));
    setDecidingSetPoints(String(tournament.config?.decidingSetPoints ?? 15));
    setWinByTwo(tournament.config?.winByTwo !== false);
    setSuperOver(tournament.config?.superOver !== false);
    setExtraTime(tournament.config?.extraTime !== false);
    setPenaltyShootout(tournament.config?.penaltyShootout !== false);
    setThirdPlace(!!tournament.config?.thirdPlace);
    setQualifiersPerDivision(
      Math.max(1, Number(tournament.config?.qualifiersPerDivision) || 1),
    );
    setScheduledInnings(String(tournament.config?.scheduledInnings ?? 7));
    setExtraInnings(String(tournament.config?.extraInnings || "unlimited"));
    setExtraInningsMax(String(tournament.config?.extraInningsMax ?? 3));
    setAllowPoolTies(tournament.config?.allowPoolTies !== false);
    setMercyRuleEnabled(tournament.config?.mercyRuleEnabled !== false);
    const mercy = tournament.config?.mercyRules || [];
    setMercyAfter5(String(mercy.find((r) => Number(r.afterInning) === 5)?.leadRuns ?? 10));
    setMercyAfter7(String(mercy.find((r) => Number(r.afterInning) === 7)?.leadRuns ?? 8));
    setTimeLimitMinutes(String(tournament.config?.timeLimitMinutes ?? 0));
    setQuarterMinutes(String(tournament.config?.quarterMinutes ?? 10));
    setOvertimeMinutes(String(tournament.config?.overtimeMinutes ?? 5));
    setShotClockSeconds(String(tournament.config?.shotClockSeconds ?? 24));
    setShowStartPicker(false);
    setShowEndPicker(false);
  }, [visible, tournament]);

  const showKnockoutOptions = tournament?.format === "knockout" || tournament?.format === "hybrid";
  const isFootball = String(tournament?.sport || "").toLowerCase() === "football";
  const isVolleyball = String(tournament?.sport || "").toLowerCase() === "volleyball";
  const isBaseball = String(tournament?.sport || "").toLowerCase() === "baseball";
  const isBasketball = String(tournament?.sport || "").toLowerCase() === "basketball";
  const groupUnit = isFootball || isVolleyball || isBasketball ? "group" : isBaseball ? "pool" : "division";
  const showQualifiersPerDivision = canEditQualifiersPerDivision(tournament);
  const divisionCount = (tournament?.divisions || []).length || 1;
  const rulesLocked = !!(tournament?.fixturesGenerated || tournament?.playoffsGenerated);
  const fieldStyle = inputStyle(isDark, T);

  const handleSave = () => {
    const form = {
      name,
      season,
      venue,
      description,
      startDate,
      endDate,
      pointsWin,
      pointsTie,
      pointsNoResult,
      pointsWinStraight,
      pointsWinClose,
      pointsLossClose,
      pointsLossStraight,
      matchFormat,
      totalSets: matchFormat === "best_of_3" ? 3 : 5,
      setPoints,
      decidingSetPoints,
      winByTwo,
      superOver,
      extraTime,
      penaltyShootout,
      thirdPlace,
      qualifiersPerDivision,
      scheduledInnings,
      extraInnings,
      extraInningsMax,
      allowPoolTies,
      mercyRuleEnabled,
      mercyRules: [
        { afterInning: 5, leadRuns: parseInt(mercyAfter5, 10) || 10 },
        { afterInning: 7, leadRuns: parseInt(mercyAfter7, 10) || 8 },
      ],
      timeLimitMinutes,
      quarterMinutes,
      overtimeMinutes,
      shotClockSeconds,
    };
    const error = validateEditTournamentForm(form);
    if (error) {
      showToast(error, "warning");
      return;
    }
    onSave(buildEditTournamentPayload(form, tournament));
  };

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
            {busy ? <ActivityIndicator color="#BAF072" /> : <Text style={{ fontWeight: "800", color: "#BAF072" }}>Save changes</Text>}
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324", marginBottom: 2 }}>Edit tournament</Text>
      <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF" }}>
        {isFootball
          ? "Format, match length and groups are locked once fixtures exist."
          : isVolleyball
            ? "Format, set rules and groups are locked once fixtures exist."
            : isBaseball
              ? "Format and pools are locked once fixtures exist. Match rules can still be adjusted carefully."
              : isBasketball
                ? "Format and groups are locked once fixtures exist. Quarter/OT/shot-clock changes should be done carefully."
              : "Format, overs and divisions are locked once fixtures exist."}
      </Text>

      <FieldLabel isDark={isDark} T={T}>Name</FieldLabel>
      <TextInput value={name} onChangeText={setName} maxLength={80} editable={!busy} style={fieldStyle} placeholder="Tournament name" placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"} />

      <FieldLabel isDark={isDark} T={T}>Season</FieldLabel>
      <TextInput value={season} onChangeText={setSeason} maxLength={40} editable={!busy} style={fieldStyle} placeholder="e.g. 2026 Summer" placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"} />

      <FieldLabel isDark={isDark} T={T}>Venue</FieldLabel>
      <TextInput value={venue} onChangeText={setVenue} maxLength={80} editable={!busy} style={fieldStyle} placeholder="Default ground / venue" placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"} />

      <FieldLabel isDark={isDark} T={T}>Description</FieldLabel>
      <TextInput
        value={description}
        onChangeText={setDescription}
        maxLength={400}
        editable={!busy}
        multiline
        style={[fieldStyle, { minHeight: 70, textAlignVertical: "top" }]}
        placeholder="Optional details for the public page"
        placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <DateField label="Start date" value={startDate} onPress={() => setShowStartPicker(true)} isDark={isDark} T={T} />
        <DateField label="End date" value={endDate} onPress={() => setShowEndPicker(true)} isDark={isDark} T={T} />
      </View>
      {showStartPicker ? (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={isDark ? "dark" : "light"}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowStartPicker(false);
            if (d) setStartDate(d);
          }}
        />
      ) : null}
      {showEndPicker ? (
        <DateTimePicker
          value={endDate || startDate || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={isDark ? "dark" : "light"}
          minimumDate={startDate || undefined}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowEndPicker(false);
            if (d) setEndDate(d);
          }}
        />
      ) : null}

      {isVolleyball ? (
        <>
          <FieldLabel isDark={isDark} T={T}>Match format</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { id: "best_of_3", label: "Best of 3" },
              { id: "best_of_5", label: "Best of 5" },
            ].map((opt) => {
              const active = matchFormat === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setMatchFormat(opt.id)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <FieldLabel isDark={isDark} T={T}>Set points (regular / deciding)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput value={setPoints} onChangeText={setSetPoints} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { flex: 1, textAlign: "center" }]} />
            <TextInput value={decidingSetPoints} onChangeText={setDecidingSetPoints} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { flex: 1, textAlign: "center" }]} />
          </View>
          <ToggleRow
            title="Win by 2 points"
            subtitle="Sets continue past the target until a 2-point lead."
            value={winByTwo}
            onValueChange={setWinByTwo}
            disabled={busy}
            isDark={isDark}
            T={T}
          />
          <FieldLabel isDark={isDark} T={T}>Standings points (3–0/3–1 · 3–2 · 2–3 · 0–3/1–3 · NR)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              { value: pointsWinStraight, set: setPointsWinStraight },
              { value: pointsWinClose, set: setPointsWinClose },
              { value: pointsLossClose, set: setPointsLossClose },
              { value: pointsLossStraight, set: setPointsLossStraight },
              { value: pointsNoResult, set: setPointsNoResult },
            ].map((p, idx) => (
              <TextInput
                key={idx}
                value={p.value}
                onChangeText={p.set}
                keyboardType="number-pad"
                editable={!busy}
                style={[fieldStyle, { width: "18%", minWidth: 52, textAlign: "center", flexGrow: 1 }]}
              />
            ))}
          </View>
        </>
      ) : isBaseball ? (
        <>
          <FieldLabel isDark={isDark} T={T}>Scheduled innings</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASEBALL_INNINGS_OPTIONS.map((opt) => {
              const active =
                opt.id === "Custom"
                  ? !["5", "7", "9"].includes(String(scheduledInnings))
                  : String(scheduledInnings) === String(opt.innings);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setScheduledInnings(String(opt.innings))}
                  disabled={busy || rulesLocked}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy || rulesLocked ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.id === "Custom" ? "Custom" : `${opt.innings}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!["5", "7", "9"].includes(String(scheduledInnings)) ? (
            <TextInput
              value={scheduledInnings}
              onChangeText={setScheduledInnings}
              keyboardType="number-pad"
              editable={!busy && !rulesLocked}
              style={[fieldStyle, { marginTop: 8, textAlign: "center" }]}
              placeholder="Innings"
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            />
          ) : null}

          <FieldLabel isDark={isDark} T={T}>Extra innings</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASEBALL_EXTRA_INNINGS_OPTIONS.map((opt) => {
              const active = extraInnings === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setExtraInnings(opt.id)}
                  disabled={busy || rulesLocked}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy || rulesLocked ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {extraInnings === "custom" ? (
            <TextInput
              value={extraInningsMax}
              onChangeText={setExtraInningsMax}
              keyboardType="number-pad"
              editable={!busy && !rulesLocked}
              style={[fieldStyle, { marginTop: 8, textAlign: "center" }]}
              placeholder="Max extra innings"
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            />
          ) : null}

          <ToggleRow
            title="Allow pool ties"
            subtitle="Pool games may end tied after regulation / time limit."
            value={allowPoolTies}
            onValueChange={setAllowPoolTies}
            disabled={busy || rulesLocked}
            isDark={isDark}
            T={T}
          />
          <ToggleRow
            title="Mercy / run rule"
            subtitle="End early when one team leads by the configured margin."
            value={mercyRuleEnabled}
            onValueChange={setMercyRuleEnabled}
            disabled={busy || rulesLocked}
            isDark={isDark}
            T={T}
          />
          {mercyRuleEnabled ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginBottom: 4 }}>After 5</Text>
                <TextInput value={mercyAfter5} onChangeText={setMercyAfter5} keyboardType="number-pad" editable={!busy && !rulesLocked} style={[fieldStyle, { textAlign: "center" }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginBottom: 4 }}>After 7</Text>
                <TextInput value={mercyAfter7} onChangeText={setMercyAfter7} keyboardType="number-pad" editable={!busy && !rulesLocked} style={[fieldStyle, { textAlign: "center" }]} />
              </View>
            </View>
          ) : null}

          <FieldLabel isDark={isDark} T={T}>Time limit</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASEBALL_TIME_LIMIT_OPTIONS.map((opt) => {
              const active =
                opt.id === "Custom"
                  ? !["0", "90", "120"].includes(String(timeLimitMinutes))
                  : String(timeLimitMinutes) === String(opt.minutes);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setTimeLimitMinutes(String(opt.minutes))}
                  disabled={busy || rulesLocked}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy || rulesLocked ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {rulesLocked ? (
            <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 8, lineHeight: 16 }}>
              Match rules are locked because fixtures already exist. Contact support if a live correction is required.
            </Text>
          ) : null}
        </>
      ) : isBasketball ? (
        <>
          <FieldLabel isDark={isDark} T={T}>Quarter length (minutes)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASKETBALL_QUARTER_OPTIONS.map((opt) => {
              const active =
                opt.id === "Custom"
                  ? !["6", "8", "10", "12"].includes(String(quarterMinutes))
                  : String(quarterMinutes) === String(opt.minutes);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setQuarterMinutes(String(opt.minutes))}
                  disabled={busy || rulesLocked}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy || rulesLocked ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.id === "Custom" ? "Custom" : `${opt.minutes}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!["6", "8", "10", "12"].includes(String(quarterMinutes)) ? (
            <TextInput value={quarterMinutes} onChangeText={setQuarterMinutes} keyboardType="number-pad" editable={!busy && !rulesLocked} style={[fieldStyle, { marginTop: 8, textAlign: "center" }]} />
          ) : null}
          <FieldLabel isDark={isDark} T={T}>Overtime length (minutes)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASKETBALL_OVERTIME_OPTIONS.map((opt) => {
              const active =
                opt.id === "Custom"
                  ? !["3", "5", "10"].includes(String(overtimeMinutes))
                  : String(overtimeMinutes) === String(opt.minutes);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setOvertimeMinutes(String(opt.minutes))}
                  disabled={busy}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.id === "Custom" ? "Custom" : `${opt.minutes}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!["3", "5", "10"].includes(String(overtimeMinutes)) ? (
            <TextInput value={overtimeMinutes} onChangeText={setOvertimeMinutes} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { marginTop: 8, textAlign: "center" }]} />
          ) : null}
          <FieldLabel isDark={isDark} T={T}>Shot clock (seconds)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BASKETBALL_SHOT_CLOCK_OPTIONS.map((opt) => {
              const active =
                opt.id === "Custom"
                  ? !["24", "30", "35"].includes(String(shotClockSeconds))
                  : String(shotClockSeconds) === String(opt.seconds);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setShotClockSeconds(String(opt.seconds))}
                  disabled={busy || rulesLocked}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy || rulesLocked ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>
                    {opt.id === "Custom" ? "Custom" : `${opt.seconds}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!["24", "30", "35"].includes(String(shotClockSeconds)) ? (
            <TextInput value={shotClockSeconds} onChangeText={setShotClockSeconds} keyboardType="number-pad" editable={!busy && !rulesLocked} style={[fieldStyle, { marginTop: 8, textAlign: "center" }]} />
          ) : null}
          {rulesLocked ? (
            <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 8, lineHeight: 16 }}>
              Quarter and shot-clock rules are locked because fixtures already exist.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <FieldLabel isDark={isDark} T={T}>Points (win / tie / no result)</FieldLabel>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput value={pointsWin} onChangeText={setPointsWin} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { flex: 1, textAlign: "center" }]} />
            <TextInput value={pointsTie} onChangeText={setPointsTie} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { flex: 1, textAlign: "center" }]} />
            <TextInput value={pointsNoResult} onChangeText={setPointsNoResult} keyboardType="number-pad" editable={!busy} style={[fieldStyle, { flex: 1, textAlign: "center" }]} />
          </View>
        </>
      )}

      {showQualifiersPerDivision ? (
        <>
          <FieldLabel isDark={isDark} T={T}>
            Teams qualifying per {groupUnit}
          </FieldLabel>
          <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF", marginBottom: 8, lineHeight: 17 }}>
            Top {qualifiersPerDivision} from each {groupUnit} advance (
            {divisionCount * qualifiersPerDivision} teams total). Set Top 1 to send only {groupUnit} winners.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {QUALIFIERS_PER_DIVISION_OPTIONS.map((k) => {
              const active = qualifiersPerDivision === k;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setQualifiersPerDivision(k)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#0B1324" : isDark ? T.border : "#E5E7EB",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: active ? "#BAF072" : isDark ? T.text : "#374151" }}>Top {k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {showKnockoutOptions ? (
        <>
          {isFootball ? (
            <>
              <ToggleRow
                title="Extra time"
                subtitle="Knockout draws go to extra time before penalties."
                value={extraTime}
                onValueChange={setExtraTime}
                disabled={busy}
                isDark={isDark}
                T={T}
              />
              <ToggleRow
                title="Penalty shootout"
                subtitle="Resolve tied knockout ties with a penalty shootout."
                value={penaltyShootout}
                onValueChange={setPenaltyShootout}
                disabled={busy}
                isDark={isDark}
                T={T}
              />
            </>
          ) : isVolleyball || isBaseball ? null : (
            <ToggleRow
              title="Super Over tie-breaker"
              subtitle="Tied knockout games are decided by a Super Over instead of being drawn."
              value={superOver}
              onValueChange={setSuperOver}
              disabled={busy}
              isDark={isDark}
              T={T}
            />
          )}
          <ToggleRow
            title="3rd place playoff"
            subtitle="Semifinal losers play one extra match for third place."
            value={thirdPlace}
            onValueChange={setThirdPlace}
            disabled={busy}
            isDark={isDark}
            T={T}
          />
        </>
      ) : null}
    </KeyboardBottomSheet>
  );
}
