import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { previewScheduleNotifyAPI } from "@/services/TournamentApi";
import { divisionCopy, formatDivisionDisplayName } from "@/features/tournament/helpers";

const defaultPlayoffNote =
  "After the league stage, curtailed games for washed out games will be scheduled during the weekend. The tentative schedule for playoffs will be sent soon.";

export default function ScheduleNotifySheet({
  visible,
  tournament,
  busy,
  onClose,
  onSend,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const unitCopy = divisionCopy(tournament?.sport);
  const unitOrderExample = `${formatDivisionDisplayName({ name: "Division 1", order: 1 }, tournament?.sport)} first, then ${formatDivisionDisplayName({ name: "Division 2", order: 2 }, tournament?.sport)}`;
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState(null);
  const [contactEmail, setContactEmail] = useState("");
  const [signOffName, setSignOffName] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [playoffNote, setPlayoffNote] = useState(defaultPlayoffNote);
  const [subject, setSubject] = useState("");

  const tournamentId = tournament?._id || tournament?.id;

  const fieldStyle = {
    backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? T.border : "#E5E7EB",
    fontSize: 14,
    color: isDark ? T.text : "#0B1324",
  };

  useEffect(() => {
    if (!visible || !tournamentId) {
      setPreview(null);
      return undefined;
    }

    setSignOffName((prev) => prev || `${tournament?.name || "Tournament"} Committee`);
    setSubject((prev) => prev || `${tournament?.name || "Tournament"} Schedule`);

    let cancelled = false;
    setLoadingPreview(true);
    previewScheduleNotifyAPI(tournamentId)
      .then((data) => {
        if (!cancelled) setPreview(data?.data || data || null);
      })
      .catch(() => {
        if (!cancelled) setPreview({ canNotify: false, reason: "preview_failed" });
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, tournamentId, tournament?.name]);

  const canSend = useMemo(() => {
    if (busy || loadingPreview) return false;
    if (!preview?.canNotify) return false;
    return (preview?.recipientCount || 0) > 0;
  }, [busy, loadingPreview, preview]);

  const previewLine = useMemo(() => {
    if (loadingPreview) return "Checking coach contacts…";
    if (!preview) return "Load preview to continue.";
    if (!preview.canNotify) {
      if (preview.reason === "no_fixtures") return "Add and schedule fixtures first.";
      if (preview.reason === "no_coach_emails") {
        return "No coach emails found. Add team managers or ensure owners have account emails.";
      }
      return "Schedule email is not ready yet.";
    }
    const fixtures = preview.fixtureCount || 0;
    const recipients = preview.recipientCount || 0;
    return `${fixtures} match${fixtures === 1 ? "" : "es"} · ${recipients} coach email${recipients === 1 ? "" : "s"}`;
  }, [loadingPreview, preview]);

  const handleSend = () => {
    onSend({
      contactEmail: contactEmail.trim(),
      signOffName: signOffName.trim(),
      customNote: customNote.trim(),
      playoffNote: playoffNote.trim(),
      subject: subject.trim(),
    });
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
            onPress={handleSend}
            disabled={!canSend}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: "#0B1324",
              alignItems: "center",
              opacity: !canSend ? 0.5 : 1,
              ...(isDark && { borderWidth: 1, borderColor: T.border }),
            }}
          >
            {busy ? (
              <ActivityIndicator color="#BAF072" />
            ) : (
              <Text style={{ fontWeight: "800", color: "#BAF072" }}>Email coaches</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Ionicons name="mail-outline" size={22} color={isDark ? T.text : "#0B1324"} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: isDark ? T.text : "#0B1324", marginLeft: 8 }}>
            Intimate coaches
          </Text>
        </View>
        <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
          Queues the full schedule spreadsheet to team owners and managers. The app responds right
          away — emails send in the background and you'll get a notification when finished.
        </Text>

        <View
          style={{
            backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDark ? T.border : "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 4 }}>
            Recipients
          </Text>
          <Text style={{ fontSize: 14, color: isDark ? T.text : "#0B1324" }}>{previewLine}</Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6 }}>
          Email subject
        </Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Spring HT 2023 Schedule"
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          style={fieldStyle}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6, marginTop: 12 }}>
          Contact email (for questions)
        </Text>
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="htc@trianglecricketleague.org"
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          autoCapitalize="none"
          keyboardType="email-address"
          style={fieldStyle}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6, marginTop: 12 }}>
          Sign-off name
        </Text>
        <TextInput
          value={signOffName}
          onChangeText={setSignOffName}
          placeholder="HT Committee"
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          style={fieldStyle}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6, marginTop: 12 }}>
          Extra note (optional)
        </Text>
        <TextInput
          value={customNote}
          onChangeText={setCustomNote}
          placeholder="Any scheduling context for team reps"
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          multiline
          style={[fieldStyle, { minHeight: 72, textAlignVertical: "top" }]}
        />

        <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 6, marginTop: 12 }}>
          Playoffs / rain note
        </Text>
        <TextInput
          value={playoffNote}
          onChangeText={setPlayoffNote}
          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
          multiline
          style={[fieldStyle, { minHeight: 88, textAlignVertical: "top" }]}
        />

        <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 12, marginTop: 12, lineHeight: 18 }}>
          Attachment: Excel file (.xlsx) with columns Date, Time,{" "}
          {unitCopy.singular}, Team 1, Team 2, Ground, Umpires. Rows are grouped{" "}
          {unitOrderExample}, and so on.
        </Text>
      </ScrollView>
    </KeyboardBottomSheet>
  );
}
