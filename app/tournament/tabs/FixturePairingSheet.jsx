import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  TournamentTeamLogo,
  sortDivisions,
  PrimaryButton,
  divisionCopy,
  formatDivisionDisplayName,
} from "@/features/tournament/helpers";

const LARGE_DIVISION_THRESHOLD = 8;

function pairKey(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

export default function FixturePairingSheet({
  visible,
  tournament,
  fixtures = [],
  busy = false,
  onClose,
  onAddMatch,
  onDeleteMatch,
  onPublish,
  onFillRoundRobin,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const copy = divisionCopy(tournament?.sport);
  const divisions = sortDivisions(tournament?.divisions);
  const hasMultiple = divisions.length > 1;
  const [divisionId, setDivisionId] = useState(null);
  const [homeId, setHomeId] = useState(null);
  const [awayId, setAwayId] = useState(null);
  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDivisionId(divisions[0]?.id || "main");
    setHomeId(null);
    setAwayId(null);
    setSearch("");
    setShowManual(false);
  }, [visible, tournament?._id]);

  const teamsInDivision = useMemo(() => {
    const divId = String(divisionId || "main");
    return (tournament?.teams || []).filter(
      (t) => String(t.divisionId || "main") === divId,
    );
  }, [tournament?.teams, divisionId]);

  const draftMatches = useMemo(() => {
    const divId = String(divisionId || "main");
    return (fixtures || []).filter(
      (f) =>
        (!f.stage || f.stage === "league") &&
        String(f.divisionId || "main") === divId,
    );
  }, [fixtures, divisionId]);

  const progress = useMemo(() => {
    const ids = teamsInDivision.map((t) => String(t.teamId));
    const n = ids.length;
    const totalPairs = n < 2 ? 0 : (n * (n - 1)) / 2;
    const existing = new Set();
    const matchCounts = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const fx of draftMatches) {
      if (fx.homeTeamId && fx.awayTeamId) {
        existing.add(pairKey(fx.homeTeamId, fx.awayTeamId));
      }
      if (fx.homeTeamId && matchCounts[String(fx.homeTeamId)] != null) {
        matchCounts[String(fx.homeTeamId)] += 1;
      }
      if (fx.awayTeamId && matchCounts[String(fx.awayTeamId)] != null) {
        matchCounts[String(fx.awayTeamId)] += 1;
      }
    }
    const idleTeams = ids.filter((id) => (matchCounts[id] || 0) === 0);
    return {
      teamCount: n,
      totalPairs,
      addedPairs: existing.size,
      missingPairs: Math.max(0, totalPairs - existing.size),
      idleTeams,
      matchCounts,
      complete: totalPairs > 0 && existing.size >= totalPairs,
    };
  }, [teamsInDivision, draftMatches]);

  const isLarge = progress.teamCount >= LARGE_DIVISION_THRESHOLD;
  const allLeagueCount = (fixtures || []).filter(
    (f) => !f.stage || f.stage === "league",
  ).length;

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamsInDivision;
    return teamsInDivision.filter((t) =>
      String(t.teamName || "").toLowerCase().includes(q),
    );
  }, [teamsInDivision, search]);

  useEffect(() => {
    if (!visible) return;
    setShowManual(!isLarge);
  }, [visible, divisionId, isLarge]);

  const pickTeam = (teamId) => {
    const tid = String(teamId);
    if (homeId === tid) {
      setHomeId(null);
      return;
    }
    if (awayId === tid) {
      setAwayId(null);
      return;
    }
    if (!homeId) setHomeId(tid);
    else if (!awayId && tid !== homeId) setAwayId(tid);
    else {
      setHomeId(tid);
      setAwayId(null);
    }
  };

  const handleAdd = () => {
    if (!homeId || !awayId) return;
    onAddMatch?.({
      homeTeamId: homeId,
      awayTeamId: awayId,
      divisionId: divisionId || "main",
    });
    setHomeId(null);
    setAwayId(null);
  };

  const confirmPublish = () => {
    const idleNote =
      progress.idleTeams.length > 0
        ? `\n\n${progress.idleTeams.length} team(s) still have no matches in this ${copy.singularLower}.`
        : "";
    const missingNote =
      progress.missingPairs > 0
        ? `\n\n${progress.missingPairs} possible pair(s) not added yet (ok if you want a custom schedule).`
        : "";
    Alert.alert(
      "Publish fixtures?",
      `Teams and ${copy.pluralLower} lock after publish. You can still schedule match times.${idleNote}${missingNote}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Publish", onPress: () => onPublish?.() },
      ],
    );
  };

  const confirmFillDivision = () => {
    const count = progress.missingPairs;
    Alert.alert(
      "Fill full round-robin?",
      count === 0
        ? `Every pair in this ${copy.singularLower} is already scheduled.`
        : `Adds the remaining ${count} match${count === 1 ? "" : "es"} so every team plays every other team once in this ${copy.singularLower}.\n\nExample with 3 teams A, B, C → A vs B, A vs C, B vs C. A team left out of one match still plays in the others.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: count === 0 ? "OK" : `Fill ${copy.singularLower}`,
          onPress: () => {
            if (count > 0) onFillRoundRobin?.({ divisionId: divisionId || "main" });
          },
        },
      ],
    );
  };

  const pct =
    progress.totalPairs > 0
      ? Math.min(100, Math.round((progress.addedPairs / progress.totalPairs) * 100))
      : 0;

  return (
    <KeyboardBottomSheet
      visible={visible}
      onClose={onClose}
      contentPadding={20}
      sheetBackgroundColor={isDark ? T.surface : "#fff"}
      footerBorderColor={isDark ? T.border : "#F3F4F6"}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>
        Build league fixtures
      </Text>
      <Text style={{ fontSize: 13, color: isDark ? T.textDim : "#6B7280", marginTop: 6, lineHeight: 18 }}>
        {`League is not knockout — adding A vs B does not eliminate C. C still needs matches (e.g. vs A and vs B). For big ${copy.pluralLower}, use Fill round-robin instead of picking every pair by hand.`}
      </Text>

      {hasMultiple ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {divisions.map((d) => {
            const active = String(d.id) === String(divisionId);
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => {
                  setDivisionId(d.id);
                  setHomeId(null);
                  setAwayId(null);
                  setSearch("");
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? "#0B1324" : isDark ? T.surfaceAlt : "#F1F5F9",
                  ...(isDark && !active && { borderWidth: 1, borderColor: T.border }),
                }}
              >
                <Text
                  style={{
                    color: active ? "#BAF072" : isDark ? T.textDim : "#64748B",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {formatDivisionDisplayName(d, tournament?.sport)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View
        style={{
          marginTop: 14,
          backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: isDark ? T.border : "#E2E8F0",
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>
          This {copy.singularLower}: {progress.addedPairs} / {progress.totalPairs} pairs
        </Text>
        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: isDark ? T.border : "#E2E8F0",
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: progress.complete ? "#22C55E" : "#BAF072",
            }}
          />
        </View>
        <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#64748B", marginTop: 8, lineHeight: 16 }}>
          {progress.teamCount} teams
          {progress.missingPairs > 0
            ? ` · ${progress.missingPairs} pairs left`
            : progress.totalPairs > 0
              ? " · full round-robin ready"
              : ""}
          {progress.idleTeams.length > 0
            ? ` · ${progress.idleTeams.length} team(s) with 0 matches`
            : ""}
        </Text>
      </View>

      <TouchableOpacity
        onPress={confirmFillDivision}
        disabled={busy || progress.teamCount < 2 || progress.missingPairs === 0}
        style={{
          marginTop: 12,
          backgroundColor: "#0B1324",
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          opacity: busy || progress.teamCount < 2 || progress.missingPairs === 0 ? 0.5 : 1,
          ...(isDark && { borderWidth: 1, borderColor: T.border }),
        }}
      >
        {busy ? (
          <ActivityIndicator color="#BAF072" />
        ) : (
          <Text style={{ color: "#BAF072", fontWeight: "800" }}>
            {progress.missingPairs === 0
              ? `Round-robin complete for this ${copy.singularLower}`
              : `Fill remaining ${progress.missingPairs} matches`}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowManual((v) => !v)}
        style={{
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Ionicons
          name={showManual ? "chevron-down" : "chevron-forward"}
          size={16}
          color={isDark ? T.iconMuted : "#64748B"}
        />
        <Text style={{ color: isDark ? T.textDim : "#64748B", fontWeight: "700", fontSize: 13 }}>
          {showManual ? "Hide custom match picker" : "Add a custom match instead"}
        </Text>
      </TouchableOpacity>

      {showManual ? (
        <View style={{ marginTop: 10 }}>
          {teamsInDivision.length > 10 ? (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search teams…"
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
              style={{
                borderWidth: 1,
                borderColor: isDark ? T.border : "#E5E7EB",
                backgroundColor: isDark ? T.surfaceAlt : "transparent",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: isDark ? T.text : "#0B1324",
                marginBottom: 8,
              }}
            />
          ) : null}

          <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginBottom: 6 }}>
            SELECT TWO TEAMS (home + away)
          </Text>
          <ScrollView style={{ maxHeight: 160 }}>
            {filteredTeams.length === 0 ? (
              <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 13 }}>No teams match.</Text>
            ) : (
              filteredTeams.map((t) => {
                const tid = String(t.teamId);
                const selected = tid === homeId || tid === awayId;
                const tag = tid === homeId ? "Home" : tid === awayId ? "Away" : null;
                const games = progress.matchCounts[tid] || 0;
                return (
                  <TouchableOpacity
                    key={tid}
                    onPress={() => pickTeam(tid)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? T.border : "#F1F5F9",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={selected ? "#22C55E" : isDark ? T.iconMuted : "#CBD5E1"}
                    />
                    <TournamentTeamLogo teamLogo={t.teamLogo} teamName={t.teamName} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? T.text : "#0B1324" }}>
                        {t.teamName}
                      </Text>
                      <Text style={{ fontSize: 11, color: games === 0 ? "#B45309" : isDark ? T.textMuted : "#9CA3AF" }}>
                        {games === 0 ? "No matches yet" : `${games} match${games === 1 ? "" : "es"}`}
                      </Text>
                    </View>
                    {tag ? (
                      <Text style={{ fontSize: 11, fontWeight: "800", color: isDark ? "#93C5FD" : "#2563EB" }}>{tag}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={handleAdd}
            disabled={busy || !homeId || !awayId}
            style={{
              marginTop: 12,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: isDark ? T.border : "#0B1324",
              backgroundColor: isDark ? T.surfaceAlt : "transparent",
              opacity: busy || !homeId || !awayId ? 0.5 : 1,
            }}
          >
            <Text style={{ color: isDark ? T.text : "#0B1324", fontWeight: "800" }}>Add this match</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginTop: 18 }}>
        MATCHES IN DIVISION ({draftMatches.length})
      </Text>
      <ScrollView style={{ maxHeight: 140, marginTop: 8 }}>
        {draftMatches.length === 0 ? (
          <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 13 }}>
            No matches yet — tap Fill remaining matches above.
          </Text>
        ) : (
          draftMatches.map((fx) => (
            <View
              key={fx._id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? T.border : "#F1F5F9",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>
                  {fx.homeTeamName} vs {fx.awayTeamName}
                </Text>
              </View>
              <TouchableOpacity
                disabled={busy}
                onPress={() => onDeleteMatch?.(fx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={isDark ? "#F87171" : "#DC2626"} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          label={`Publish fixtures${allLeagueCount ? ` (${allLeagueCount})` : ""}`}
          onPress={confirmPublish}
          disabled={busy || allLeagueCount < 1}
          busy={busy}
        />
      </View>
    </KeyboardBottomSheet>
  );
}
