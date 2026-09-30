import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showToast } from "@/context/ToastContext";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import {
  buildTournamentExplainerPayload,
  pickDefaultExplainerTeamId,
} from "@/lib/tournamentExplainerContext";
import {
  EmptyState,
  TournamentTeamLogo,
  fmtNrr,
  formOf,
} from "@/features/tournament/helpers";
import { getPlayoffCutCount } from "@/features/tournament/standingsConfig";
import NrrHelpSheet from "./NrrHelpSheet";
import TeamMatchHistory from "./TeamMatchHistory";
import BasketballStandingsTable from "./BasketballStandingsTable";

const TABLE_MIN_WIDTH = 580;

export default function StandingsTab({
  standings,
  format,
  teams = [],
  tournament,
  fixtures = [],
  hintTeamId,
  onExplain,
  explainerLoading,
  onOpenFixture,
  divisionName,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const showExplainer = format === "round_robin" || format === "hybrid";
  const [focusTeamId, setFocusTeamId] = useState(() =>
    pickDefaultExplainerTeamId(standings, hintTeamId),
  );
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [nrrHelpOpen, setNrrHelpOpen] = useState(false);

  useEffect(() => {
    setFocusTeamId(pickDefaultExplainerTeamId(standings, hintTeamId));
    setExpandedTeamId(null);
  }, [standings, hintTeamId]);

  const handleExplain = async () => {
    if (!focusTeamId || !tournament || explainerLoading) return;
    const payload = buildTournamentExplainerPayload({
      tournament,
      standings,
      fixtures,
      focusTeamId,
    });
    if (!payload) {
      showToast("Select a team from the table", "warning");
      return;
    }
    const focusRow = standings.find((r) => String(r.teamId) === String(focusTeamId));
    setNrrHelpOpen(false);
    onExplain?.(payload, focusRow?.teamName);
  };

  const toggleRow = (teamId) => {
    const tid = String(teamId);
    if (showExplainer) setFocusTeamId(tid);
    setExpandedTeamId((prev) => (prev === tid ? null : tid));
  };

  const handleNrrExplain = () => {
    setNrrHelpOpen(false);
    handleExplain();
  };

  if (!standings.length) {
    const subtitle =
      format === "knockout"
        ? "Knockout tournaments rank teams in the bracket, not a points table."
        : "Standings appear once teams are enrolled and league matches are completed.";
    return (
      <EmptyState
        icon="podium-outline"
        title="No standings yet"
        subtitle={subtitle}
        isDark={isDark}
        T={T}
      />
    );
  }

  const logoByTeamId = Object.fromEntries(
    (teams || []).map((t) => [String(t.teamId), t.teamLogo || t.teamlogo || ""]),
  );
  const isFootball = String(tournament?.sport || "").toLowerCase() === "football";
  const isVolleyball = String(tournament?.sport || "").toLowerCase() === "volleyball";
  const isBaseball = String(tournament?.sport || "").toLowerCase() === "baseball";
  const isBasketball = String(tournament?.sport || "").toLowerCase() === "basketball";
  const teamColWidth = 158;
  const fmtPct = (pct) => {
    const n = Number(pct);
    if (!Number.isFinite(n)) return ".000";
    const text = n.toFixed(3);
    return text.startsWith("0") ? text.slice(1) : text;
  };
  const cols = isFootball
    ? [
        { key: "played", label: "P" },
        { key: "won", label: "W" },
        { key: "tied", label: "D" },
        { key: "lost", label: "L" },
        { key: "gf", label: "GF" },
        { key: "ga", label: "GA" },
        { key: "gd", label: "GD" },
        { key: "points", label: "Pts" },
      ]
    : isVolleyball
      ? [
          { key: "played", label: "P" },
          { key: "won", label: "W" },
          { key: "lost", label: "L" },
          { key: "setsWon", label: "SW" },
          { key: "setsLost", label: "SL" },
          { key: "setDiff", label: "PD" },
          { key: "points", label: "Pts" },
        ]
      : isBaseball
        ? [
            { key: "played", label: "P" },
            { key: "won", label: "W" },
            { key: "lost", label: "L" },
            { key: "runsScored", label: "RS" },
            { key: "runsAllowed", label: "RA" },
            { key: "runDifferential", label: "RD" },
            { key: "winPercentage", label: "PCT" },
          ]
      : [
          { key: "played", label: "P" },
          { key: "won", label: "W" },
          { key: "lost", label: "L" },
          { key: "tied", label: "T" },
          { key: "noResult", label: "NR" },
          { key: "points", label: "Pts" },
        ];
  const focusRow = standings.find((r) => String(r.teamId) === String(focusTeamId));
  const focusRank = standings.findIndex((r) => String(r.teamId) === String(focusTeamId)) + 1;

  const cardBg = isDark ? T.surface : "#fff";
  const cardBorder = isDark ? T.border : "#EEF2F6";
  const titleColor = isDark ? T.text : "#0B1324";
  const mutedLabel = isDark ? T.textMuted : "#94A3B8";
  const linkColor = isDark ? "#93C5FD" : "#2563EB";
  const nrrPos = isDark ? "#4ADE80" : "#166534";
  const nrrNeg = isDark ? "#F87171" : "#B91C1C";
  const statColor = isDark ? T.textDim : "#4B5563";
  const rowBorder = isDark ? T.borderSubtle : "#F1F5F9";
  const expandBg = isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4";
  const selectBg = isDark ? "rgba(186,240,114,0.1)" : "#F7FEE7";
  const zebraBg = isDark ? T.surfaceAlt : "#FAFBFC";
  const historyBg = isDark ? T.bgAlt : "#F8FAFC";
  const chipIdleBg = isDark ? T.surfaceAlt : "#F1F5F9";
  const chipIdleBorder = isDark ? T.border : "#E2E8F0";
  const chipIdleText = isDark ? T.textDim : "#475569";

  return (
    <View>
      {showExplainer ? (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: titleColor }}>What do we need?</Text>
            </View>
            <TouchableOpacity
              onPress={handleExplain}
              disabled={explainerLoading || !focusTeamId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: "#0B1324",
                opacity: explainerLoading || !focusTeamId ? 0.6 : 1,
                ...(isDark && { borderWidth: 1, borderColor: T.border }),
              }}
            >
              {explainerLoading ? (
                <ActivityIndicator size="small" color="#BAF072" />
              ) : (
                <Ionicons name="sparkles" size={16} color="#BAF072" />
              )}
              <Text style={{ color: "#BAF072", fontWeight: "800", fontSize: 12 }}>Explain</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: mutedLabel, marginBottom: 8, letterSpacing: 0.5 }}>
            TEAM
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {standings.map((row, idx) => {
              const tid = String(row.teamId);
              const selected = tid === String(focusTeamId);
              return (
                <TouchableOpacity
                  key={tid}
                  onPress={() => {
                    setFocusTeamId(tid);
                    setExpandedTeamId(tid);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 999,
                    marginRight: 8,
                    backgroundColor: selected ? "#0B1324" : chipIdleBg,
                    borderWidth: 1,
                    borderColor: selected ? "#0B1324" : chipIdleBorder,
                  }}
                >
                  <TournamentTeamLogo
                    teamLogo={row.teamLogo || logoByTeamId[tid]}
                    teamName={row.teamName}
                    size={20}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: selected ? "#BAF072" : chipIdleText,
                      maxWidth: 100,
                    }}
                    numberOfLines={1}
                  >
                    {row.teamName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: selected ? "#94A3B8" : isDark ? T.textMuted : "#9CA3AF",
                      marginLeft: 4,
                    }}
                  >
                    #{idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {focusRow ? (
            <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#64748B", marginTop: 8 }}>
              {focusRow.teamName}:{" "}
              {isBaseball
                ? `${fmtPct(focusRow.winPercentage)} PCT`
                : `${focusRow.points ?? 0} pts`}
              {isFootball
                ? ` · GD ${focusRow.gd > 0 ? "+" : ""}${focusRow.gd ?? 0} · GF ${focusRow.gf ?? 0}`
                : isVolleyball
                  ? ` · Sets ${focusRow.setsWon ?? 0}–${focusRow.setsLost ?? 0} · PD ${
                      (focusRow.setDiff ?? (focusRow.setsWon || 0) - (focusRow.setsLost || 0)) > 0 ? "+" : ""
                    }${focusRow.setDiff ?? (focusRow.setsWon || 0) - (focusRow.setsLost || 0)}`
                  : isBaseball
                    ? ` · RD ${(focusRow.runDifferential ?? 0) > 0 ? "+" : ""}${focusRow.runDifferential ?? 0} · RS ${focusRow.runsScored ?? 0}`
                  : isBasketball
                    ? ` · ${focusRow.won ?? 0}-${focusRow.lost ?? 0} · ${fmtPct(focusRow.winPercentage)} PCT · PD ${(focusRow.pointDiff ?? 0) > 0 ? "+" : ""}${focusRow.pointDiff ?? 0}`
                  : ` · NRR ${fmtNrr(focusRow.nrr)}`}
              {" · "}
              {focusRank}
              {focusRank === 1 ? "st" : focusRank === 2 ? "nd" : focusRank === 3 ? "rd" : "th"} place
            </Text>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => setNrrHelpOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          alignSelf: "flex-start",
        }}
      >
        <Ionicons name="help-circle-outline" size={16} color={linkColor} />
        <Text style={{ fontSize: 13, fontWeight: "700", color: linkColor }}>
          {isFootball
            ? "How does the table work?"
            : isVolleyball
              ? "How do volleyball standings work?"
              : isBaseball
                ? "How do baseball standings work?"
                : isBasketball
                  ? "How do basketball standings work?"
                : "How is NRR calculated?"}
        </Text>
      </TouchableOpacity>

      {isBasketball ? (
        <BasketballStandingsTable
          standings={standings}
          logoByTeamId={logoByTeamId}
          tournament={tournament}
          fixtures={fixtures}
          focusTeamId={showExplainer ? focusTeamId : null}
          expandedTeamId={expandedTeamId}
          onToggleRow={toggleRow}
          onOpenFixture={onOpenFixture}
          playoffCut={getPlayoffCutCount(tournament, format)}
          title={[tournament?.name, divisionName].filter(Boolean).join(", ")}
          updatedAt={tournament?.updatedAt}
          isDark={isDark}
          T={T}
        />
      ) : (
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: cardBorder,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: isFootball || isVolleyball || isBaseball || isBasketball ? 620 : TABLE_MIN_WIDTH }}>
            <View style={{ flexDirection: "row", backgroundColor: "#0B1324", paddingVertical: 10, paddingHorizontal: 12 }}>
              <Text style={{ width: 28, color: "#94A3B8", fontWeight: "700", fontSize: 12 }}>#</Text>
              <Text style={{ width: teamColWidth, color: "#94A3B8", fontWeight: "700", fontSize: 12 }}>Team</Text>
              {cols.map((c) => (
                <Text
                  key={c.key}
                  style={{
                    width: c.key === "winPercentage" ? 48 : 36,
                    textAlign: "center",
                    color: "#94A3B8",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {c.label}
                </Text>
              ))}
              {!isFootball && !isVolleyball && !isBaseball && !isBasketball ? (
                <Text style={{ width: 62, textAlign: "center", color: "#94A3B8", fontWeight: "700", fontSize: 12 }}>NRR</Text>
              ) : null}
              <Text style={{ width: 84, color: "#94A3B8", fontWeight: "700", fontSize: 12, paddingLeft: 6 }}>Form</Text>
              <Text style={{ width: 20 }} />
            </View>

            {standings.map((row, idx) => {
              const tid = String(row.teamId);
              const selected = tid === String(focusTeamId);
              const expanded = tid === expandedTeamId;
              const rowBg = expanded
                ? expandBg
                : selected
                  ? selectBg
                  : idx % 2
                    ? zebraBg
                    : cardBg;
              const gdVal = row.gd ?? (row.gf || 0) - (row.ga || 0);
              const setDiffVal = row.setDiff ?? (row.setsWon || 0) - (row.setsLost || 0);
              const rdVal = row.runDifferential ?? (row.runsScored || 0) - (row.runsAllowed || 0);
              const pdVal = row.pointDiff ?? (row.pointsFor || 0) - (row.pointsAgainst || 0);

              return (
                <View key={row.teamId}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleRow(tid)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                      borderBottomWidth: expanded ? 0 : 1,
                      borderBottomColor: rowBorder,
                      backgroundColor: rowBg,
                    }}
                  >
                    <Text style={{ width: 28, fontWeight: "800", color: titleColor }}>{idx + 1}</Text>
                    <View style={{ width: teamColWidth, flexDirection: "row", alignItems: "center" }}>
                      <TournamentTeamLogo
                        teamLogo={row.teamLogo || logoByTeamId[tid]}
                        teamName={row.teamName}
                        size={24}
                      />
                      <Text style={{ flex: 1, fontWeight: "700", color: titleColor, fontSize: 13 }} numberOfLines={1}>
                        {row.teamName}
                      </Text>
                    </View>
                    {cols.map((c) => {
                      let display = row[c.key] ?? 0;
                      if (c.key === "gd") {
                        display = gdVal > 0 ? `+${gdVal}` : String(gdVal);
                      }
                      if (c.key === "setDiff") {
                        display = setDiffVal > 0 ? `+${setDiffVal}` : String(setDiffVal);
                      }
                      if (c.key === "runDifferential") {
                        display = rdVal > 0 ? `+${rdVal}` : String(rdVal);
                      }
                      if (c.key === "winPercentage") {
                        display = fmtPct(row.winPercentage);
                      }
                      if (c.key === "pointDiff") {
                        display = pdVal > 0 ? `+${pdVal}` : String(pdVal);
                      }
                      const signedKey = c.key === "gd" || c.key === "setDiff" || c.key === "runDifferential" || c.key === "pointDiff";
                      const signedVal =
                        c.key === "setDiff"
                          ? setDiffVal
                          : c.key === "runDifferential"
                            ? rdVal
                            : c.key === "pointDiff"
                              ? pdVal
                              : gdVal;
                      return (
                        <Text
                          key={c.key}
                          style={{
                            width: c.key === "winPercentage" ? 48 : 36,
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight:
                              c.key === "points" || c.key === "winPercentage" || signedKey ? "800" : "500",
                            color:
                              signedKey
                                ? signedVal > 0
                                  ? nrrPos
                                  : signedVal < 0
                                    ? nrrNeg
                                    : statColor
                                : c.key === "points" || c.key === "winPercentage"
                                  ? titleColor
                                  : statColor,
                          }}
                        >
                          {display}
                        </Text>
                      );
                    })}
                    {!isFootball && !isVolleyball && !isBaseball && !isBasketball ? (
                      <Text
                        style={{
                          width: 62,
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: "600",
                          color: (row.nrr || 0) >= 0 ? nrrPos : nrrNeg,
                        }}
                      >
                        {fmtNrr(row.nrr)}
                      </Text>
                    ) : null}
                    <View style={{ width: 84, flexDirection: "row", gap: 3, paddingLeft: 6 }}>
                      {(row.form || []).map((f, i) => {
                        const s = formOf(f);
                        return (
                          <View
                            key={i}
                            style={{
                              width: 15,
                              height: 15,
                              borderRadius: 8,
                              backgroundColor: s.bg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}>{s.t}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={isDark ? T.iconMuted : "#94A3B8"}
                      style={{ width: 20 }}
                    />
                  </TouchableOpacity>

                  {expanded ? (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingBottom: 12,
                        backgroundColor: historyBg,
                        borderBottomWidth: 1,
                        borderBottomColor: cardBorder,
                      }}
                    >
                      <TeamMatchHistory
                        teamId={tid}
                        teamName={row.teamName}
                        fixtures={fixtures}
                        onOpenFixture={onOpenFixture}
                        isDark={isDark}
                        T={T}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      )}

      <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 10, lineHeight: 16 }}>
        Tap a team row to see match history. Open a scorecard when available.
      </Text>

      <NrrHelpSheet
        visible={nrrHelpOpen}
        onClose={() => setNrrHelpOpen(false)}
        showExplain={showExplainer}
        onExplain={handleNrrExplain}
        explainerLoading={explainerLoading}
        isDark={isDark}
        T={T}
        mode={isFootball ? "football" : isVolleyball ? "volleyball" : isBaseball ? "baseball" : isBasketball ? "basketball" : "cricket"}
      />
    </View>
  );
}
