import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { sortDivisions, divisionCopy, formatDivisionDisplayName } from "@/features/tournament/helpers";

export default function DivisionAdminSheet({
  visible,
  mode,
  divisions = [],
  division,
  team,
  teamIds = [],
  teamCountLabel,
  busy = false,
  sport,
  onClose,
  onConfirm,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [name, setName] = useState("");
  const [reassignTo, setReassignTo] = useState(null);
  const copy = divisionCopy(sport);

  const sorted = sortDivisions(divisions);
  const otherDivisions = sorted.filter((d) => String(d.id) !== String(division?.id));
  const teamCount = (division?.teamIds || []).length;
  const isMoveMode = mode === "moveTeam" || mode === "moveTeams";
  const bulkCount = teamIds?.length || 0;

  useEffect(() => {
    if (!visible) return;
    if (mode === "rename") setName(division?.name || "");
    else if (mode === "create") setName("");
    if (mode === "delete") {
      setReassignTo(otherDivisions[0]?.id || null);
    }
    if (mode === "moveTeams") {
      setReassignTo(null);
    }
  }, [visible, mode, division?.id, division?.name, otherDivisions[0]?.id]);

  const title =
    mode === "create"
      ? `Add ${copy.singularLower}`
      : mode === "rename"
        ? `Rename ${copy.singularLower}`
        : mode === "delete"
          ? `Delete ${copy.singularLower}`
          : mode === "moveTeams"
            ? "Move teams"
            : "Move team";

  const submitLabel =
    mode === "create"
      ? `Add ${copy.singularLower}`
      : mode === "rename"
        ? "Save"
        : mode === "delete"
          ? `Delete ${copy.singularLower}`
          : null;

  const handleSubmit = () => {
    if (mode === "create") onConfirm({ name: name.trim() || undefined });
    else if (mode === "rename") onConfirm({ name: name.trim() });
    else if (mode === "delete") onConfirm({ reassignTo });
    else if (mode === "moveTeam" && reassignTo) onConfirm({ divisionId: reassignTo });
    else if (mode === "moveTeams" && reassignTo) onConfirm({ divisionId: reassignTo, teamIds });
  };

  const canSubmit =
    !busy &&
    (mode === "create" ||
      (mode === "rename" && name.trim().length > 0) ||
      (mode === "delete" && (teamCount === 0 || reassignTo)) ||
      (mode === "moveTeam" && reassignTo) ||
      (mode === "moveTeams" && reassignTo && bulkCount > 0));

  return (
    <KeyboardBottomSheet
      visible={visible}
      onClose={onClose}
      contentPadding={20}
      sheetBackgroundColor={isDark ? T.surface : "#fff"}
      footerBorderColor={isDark ? T.border : "#F3F4F6"}
      footer={
        isMoveMode ? null : (
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
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: mode === "delete" ? "#DC2626" : "#0B1324",
                alignItems: "center",
                opacity: !canSubmit ? 0.5 : 1,
                ...(isDark && mode !== "delete" && { borderWidth: 1, borderColor: T.border }),
              }}
            >
              {busy ? (
                <ActivityIndicator color={mode === "delete" ? "#fff" : "#BAF072"} />
              ) : (
                <Text style={{ fontWeight: "800", color: mode === "delete" ? "#fff" : "#BAF072" }}>
                  {submitLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )
      }
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324", marginBottom: 4 }}>{title}</Text>

      {isMoveMode ? (
        <>
          <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginBottom: 14 }}>
            {mode === "moveTeams" ? (
              <>
                Move{" "}
                <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  {teamCountLabel || `${bulkCount} team${bulkCount === 1 ? "" : "s"}`}
                </Text>{" "}
                to a {copy.singularLower}.
              </>
            ) : team ? (
              <>
                Move <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>{team.teamName}</Text> to another{" "}
                {copy.singularLower}.
              </>
            ) : (
              `Choose a ${copy.singularLower}.`
            )}
          </Text>
          {sorted.map((div) => {
            const active =
              mode === "moveTeam" && team
                ? String(div.id) === String(team.divisionId || "main")
                : false;
            const selected = String(div.id) === String(reassignTo);
            return (
              <TouchableOpacity
                key={div.id}
                disabled={busy || active}
                onPress={() => {
                  setReassignTo(div.id);
                  if (mode === "moveTeam") {
                    onConfirm({ divisionId: div.id });
                  } else {
                    onConfirm({ divisionId: div.id, teamIds });
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                  backgroundColor: active
                    ? isDark ? T.surfaceAlt : "#F8FAFC"
                    : selected
                      ? isDark ? "rgba(186,240,114,0.16)" : "#E8F8D8"
                      : isDark ? T.surface : "#fff",
                  borderWidth: 1,
                  borderColor: active
                    ? isDark ? T.border : "#E2E8F0"
                    : selected
                      ? "#BAF072"
                      : isDark ? T.border : "#E5E7EB",
                  opacity: active ? 0.6 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                    {formatDivisionDisplayName(div, sport)}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 2 }}>
                    {(div.teamIds || []).length} team{(div.teamIds || []).length === 1 ? "" : "s"}
                  </Text>
                </View>
                {active ? (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? T.textDim : "#6B7280" }}>Current</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={isDark ? T.iconMuted : "#94A3B8"} />
                )}
              </TouchableOpacity>
            );
          })}
        </>
      ) : null}

      {(mode === "create" || mode === "rename") && (
        <>
          <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginBottom: 12 }}>
            {mode === "create"
              ? `Optional name — defaults to ${copy.singular} letter/number if left blank.`
              : `Rename ${formatDivisionDisplayName(division, sport)}.`}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              mode === "create"
                ? formatDivisionDisplayName({ order: divisions.length + 1, name: `Division ${divisions.length + 1}` }, sport)
                : `${copy.singular} name`
            }
            placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
            autoFocus
            maxLength={60}
            editable={!busy}
            style={{
              backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
              borderRadius: 12,
              padding: 12,
              fontSize: 15,
              color: isDark ? T.text : "#0B1324",
              borderWidth: 1,
              borderColor: isDark ? T.border : "#E5E7EB",
              marginBottom: 8,
            }}
          />
        </>
      )}

      {mode === "delete" && division ? (
        <>
          <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginBottom: 12, lineHeight: 20 }}>
            Delete{" "}
            <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
              {formatDivisionDisplayName(division, sport)}
            </Text>
            {teamCount > 0
              ? ` and move its ${teamCount} team${teamCount === 1 ? "" : "s"} to another ${copy.singularLower}.`
              : "."}
          </Text>
          {teamCount > 0 ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginBottom: 8 }}>
                Move teams to
              </Text>
              {otherDivisions.map((div) => {
                const selected = String(div.id) === String(reassignTo);
                return (
                  <TouchableOpacity
                    key={div.id}
                    disabled={busy}
                    onPress={() => setReassignTo(div.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selected
                        ? isDark ? "rgba(186,240,114,0.16)" : "#E8F8D8"
                        : isDark ? T.surface : "#fff",
                      borderWidth: 1,
                      borderColor: selected ? "#BAF072" : isDark ? T.border : "#E5E7EB",
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                    {formatDivisionDisplayName(div, sport)}
                  </Text>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={isDark ? "#BAF072" : "#22C55E"} /> : null}
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View
              style={{
                backgroundColor: isDark ? T.dangerBg : "#FEF2F2",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: isDark ? "rgba(248,113,113,0.35)" : "#FECACA",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: isDark ? T.dangerText : "#991B1B", lineHeight: 18 }}>
                This {copy.singularLower} has no teams. It will be removed from the tournament.
              </Text>
            </View>
          )}
        </>
      ) : null}
    </KeyboardBottomSheet>
  );
}
