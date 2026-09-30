import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { TournamentTeamLogo, PrimaryButton, divisionCopy } from "@/features/tournament/helpers";

export default function KnockoutRoundPairingSheet({
  visible,
  remaining = null,
  busy = false,
  onClose,
  onConfirm,
  onRefresh,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const teams = remaining?.teams || [];
  const teamIds = (remaining?.teamIds || teams.map((t) => t.teamId)).map(String);
  const odd = teamIds.length % 2 === 1;
  const expectedPairs = Math.floor(teamIds.length / 2);

  const [selected, setSelected] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [byeTeamId, setByeTeamId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setPairs([]);
    setByeTeamId(null);
    onRefresh?.();
  }, [visible]);

  const pairedIds = useMemo(() => {
    const set = new Set();
    for (const p of pairs) {
      set.add(String(p.homeTeamId));
      set.add(String(p.awayTeamId));
    }
    if (byeTeamId) set.add(String(byeTeamId));
    return set;
  }, [pairs, byeTeamId]);

  const available = teams.filter((t) => !pairedIds.has(String(t.teamId)));
  const nameOf = (tid) =>
    teams.find((t) => String(t.teamId) === String(tid))?.teamName || "Team";
  const logoOf = (tid) =>
    teams.find((t) => String(t.teamId) === String(tid))?.teamLogo || "";

  const toggleSelect = (teamId) => {
    const tid = String(teamId);
    if (pairedIds.has(tid)) return;
    setSelected((prev) => {
      if (prev.includes(tid)) return prev.filter((x) => x !== tid);
      if (prev.length >= 2) return [tid];
      return [...prev, tid];
    });
  };

  const addPair = () => {
    if (selected.length !== 2) return;
    if (pairs.length >= expectedPairs) return;
    setPairs((prev) => [
      ...prev,
      { homeTeamId: selected[0], awayTeamId: selected[1] },
    ]);
    setSelected([]);
  };

  const removePair = (index) => {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const assignBye = (teamId) => {
    const tid = String(teamId);
    if (!odd) return;
    if (pairedIds.has(tid) && String(byeTeamId) !== tid) return;
    setByeTeamId((prev) => (String(prev) === tid ? null : tid));
    setSelected((prev) => prev.filter((x) => x !== tid));
  };

  const canConfirm =
    remaining?.open &&
    pairs.length === expectedPairs &&
    (!odd || !!byeTeamId) &&
    teamIds.length >= 2;

  const handleConfirm = () => {
    if (!canConfirm) return;
    Alert.alert(
      "Confirm knockout round?",
      odd
        ? `${pairs.length} match(es) + bye for ${nameOf(byeTeamId)}. Pairings lock for this round.`
        : `${pairs.length} match(es) will be published for this round.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () =>
            onConfirm?.({
              pairs,
              byeTeamId: odd ? byeTeamId : null,
              remainingTeamIds: teamIds,
            }),
        },
      ],
    );
  };

  const open = !!remaining?.open;
  const reason = remaining?.reason;

  return (
    <KeyboardBottomSheet
      visible={visible}
      onClose={onClose}
      contentPadding={20}
      sheetBackgroundColor={isDark ? T.surface : "#fff"}
      footerBorderColor={isDark ? T.border : "#F3F4F6"}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>
        Set knockout round
      </Text>
      <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginTop: 6, lineHeight: 18 }}>
        Tap two teams to form a match
        {odd ? ". With an odd count, assign one bye (auto-advances)." : "."}
      </Text>

      {!open ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <Ionicons name="information-circle-outline" size={36} color={isDark ? T.iconMuted : "#94A3B8"} />
          <Text
            style={{
              marginTop: 10,
              color: isDark ? T.textDim : "#64748B",
              textAlign: "center",
              fontSize: 13,
              lineHeight: 18,
              paddingHorizontal: 12,
            }}
          >
            {reason === "league_not_published"
              ? "Publish league fixtures first."
              : reason === "qualifiers_not_ready"
                ? remaining?.error ||
                  `Finish all ${divisionCopy(tournament?.sport).singularLower} league matches before playoffs.`
                : reason === "round_in_progress"
                  ? "Finish the current knockout round before pairing the next."
                  : reason === "tournament_complete"
                    ? "Knockout is complete."
                    : reason === "no_knockout"
                      ? "This league has no knockout stage."
                      : "Knockout pairing is not available yet."}
          </Text>
        </View>
      ) : (
        <>
          {odd ? (
            <View
              style={{
                marginTop: 12,
                backgroundColor: isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
              }}
            >
              <Text style={{ fontSize: 12, color: isDark ? "#FCD34D" : "#92400E", lineHeight: 17, fontWeight: "600" }}>
                Odd number of teams — pick one team for a bye (advances automatically), then pair
                the other two.
              </Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginTop: 14 }}>
            REMAINING ({available.length} free / {teamIds.length} total)
          </Text>
          <ScrollView style={{ maxHeight: 200, marginTop: 8 }}>
            {teams.map((t) => {
              const tid = String(t.teamId);
              const used = pairedIds.has(tid);
              const isSel = selected.includes(tid);
              const isBye = String(byeTeamId) === tid;
              return (
                <View
                  key={tid}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? T.border : "#F1F5F9",
                    opacity: used && !isBye ? 0.45 : 1,
                  }}
                >
                  <TouchableOpacity
                    disabled={used && !isBye}
                    onPress={() => toggleSelect(tid)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                  >
                    <Ionicons
                      name={isSel ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSel ? "#22C55E" : isDark ? T.iconMuted : "#CBD5E1"}
                    />
                    <TournamentTeamLogo teamLogo={t.teamLogo} teamName={t.teamName} size={32} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? T.text : "#0B1324", flex: 1 }}>
                      {t.teamName}
                    </Text>
                  </TouchableOpacity>
                  {odd ? (
                    <TouchableOpacity
                      disabled={(used && !isBye) || (!!byeTeamId && !isBye)}
                      onPress={() => assignBye(tid)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: isBye
                          ? isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7"
                          : isDark ? T.surfaceAlt : "#F8FAFC",
                        borderWidth: 1,
                        borderColor: isBye
                          ? isDark ? "rgba(245,158,11,0.5)" : "#F59E0B"
                          : isDark ? T.border : "#E2E8F0",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: isBye ? "#B45309" : isDark ? T.textDim : "#64748B",
                        }}
                      >
                        {isBye ? "BYE" : "Bye"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={addPair}
            disabled={busy || selected.length !== 2 || pairs.length >= expectedPairs}
            style={{
              marginTop: 12,
              backgroundColor: "#0B1324",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              opacity:
                busy || selected.length !== 2 || pairs.length >= expectedPairs ? 0.5 : 1,
              ...(isDark && { borderWidth: 1, borderColor: T.border }),
            }}
          >
            <Text style={{ color: "#BAF072", fontWeight: "800" }}>
              Add pair ({pairs.length}/{expectedPairs})
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginTop: 16 }}>
            THIS ROUND
          </Text>
          <ScrollView style={{ maxHeight: 140, marginTop: 8 }}>
            {pairs.map((p, idx) => (
              <View
                key={`${p.homeTeamId}-${p.awayTeamId}-${idx}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? T.border : "#F1F5F9",
                }}
              >
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TournamentTeamLogo
                    teamLogo={logoOf(p.homeTeamId)}
                    teamName={nameOf(p.homeTeamId)}
                    size={28}
                  />
                  <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0B1324", fontSize: 13 }}>
                    {nameOf(p.homeTeamId)}
                  </Text>
                  <Text style={{ color: isDark ? T.iconMuted : "#94A3B8", fontWeight: "700", fontSize: 12 }}>vs</Text>
                  <TournamentTeamLogo
                    teamLogo={logoOf(p.awayTeamId)}
                    teamName={nameOf(p.awayTeamId)}
                    size={28}
                  />
                  <Text style={{ fontWeight: "700", color: isDark ? T.text : "#0B1324", fontSize: 13, flex: 1 }}>
                    {nameOf(p.awayTeamId)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removePair(idx)}>
                  <Ionicons name="close-circle" size={20} color={isDark ? T.iconMuted : "#94A3B8"} />
                </TouchableOpacity>
              </View>
            ))}
            {byeTeamId ? (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#B45309" }}>
                  Bye: {nameOf(byeTeamId)} (advances)
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ marginTop: 14 }}>
            <PrimaryButton
              label="Confirm round"
              onPress={handleConfirm}
              disabled={busy || !canConfirm}
              busy={busy}
            />
          </View>
        </>
      )}

      {busy && open ? (
        <View style={{ position: "absolute", right: 24, top: 24 }}>
          <ActivityIndicator color={isDark ? "#BAF072" : "#0B1324"} />
        </View>
      ) : null}
    </KeyboardBottomSheet>
  );
}
