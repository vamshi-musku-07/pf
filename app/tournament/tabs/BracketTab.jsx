import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { EmptyState, divisionCopy } from "@/features/tournament/helpers";
import PremiumMatchCard from "./PremiumMatchCard";
import BracketByeCard from "./BracketByeCard";
import { resolveMatchCardVariant } from "@/features/tournament/liveMatchConfig";
import {
  KO_STAGES,
  stageHeaderLabel,
  bracketSubtitle,
  isByeFixture,
} from "@/features/tournament/bracketConfig";

const COLUMN_WIDTH = 200;

export default function BracketTab({
  fixtures,
  format,
  isAdmin,
  onStart,
  onOpen,
  onEnterResult,
  onWatchLive,
  onSchedule,
  busy,
  totalOvers,
  sport,
  scheduledInnings,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const ko = (fixtures || []).filter((f) => KO_STAGES.includes(f.stage));
  if (format === "round_robin") {
    return (
      <EmptyState
        icon="git-network-outline"
        title="No bracket"
        subtitle="Round-robin tournaments are ranked by the points table, not a knockout bracket."
        isDark={isDark}
        T={T}
      />
    );
  }
  if (!ko.length) {
    return (
      <EmptyState
        icon="git-network-outline"
        title="No bracket yet"
        subtitle={
          format === "hybrid"
            ? `Finish ${divisionCopy(sport).singularLower} matches, then use Generate Next Stage in Manage.`
            : "Generate fixtures to create the bracket."
        }
        isDark={isDark}
        T={T}
      />
    );
  }

  const byStage = {};
  ko.forEach((f) => {
    byStage[f.stage] = byStage[f.stage] || [];
    byStage[f.stage].push(f);
  });
  const order = KO_STAGES.filter((s) => byStage[s]);
  const subtitle = bracketSubtitle(format, ko);

  return (
    <View>
      {subtitle ? (
        <Text
          style={{
            fontSize: 13,
            color: isDark ? T.textDim : "#6B7280",
            marginBottom: 14,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 12, paddingBottom: 8 }}>
          {order.map((stage) => {
            const matches = byStage[stage].sort((a, b) => a.matchNumber - b.matchNumber);
            return (
              <View key={stage} style={{ width: COLUMN_WIDTH }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: isDark ? T.text : "#0B1324",
                    marginBottom: 10,
                    textAlign: "center",
                  }}
                >
                  {stageHeaderLabel(stage, matches.length)}
                </Text>
                <View style={{ gap: 10 }}>
                  {matches.map((f) =>
                    isByeFixture(f) ? (
                      <BracketByeCard key={f._id} fixture={f} allFixtures={fixtures} />
                    ) : (
                      <PremiumMatchCard
                        key={f._id}
                        fixture={f}
                        variant={resolveMatchCardVariant(f)}
                        compact
                        totalOvers={totalOvers}
                        sport={sport}
                        scheduledInnings={scheduledInnings}
                        isAdmin={isAdmin}
                        busy={busy}
                        onWatchLive={onWatchLive}
                        onOpen={onOpen}
                        onStart={onStart}
                        onSchedule={onSchedule}
                        onEnterResult={onEnterResult}
                        isDark={isDark}
                        T={T}
                      />
                    ),
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
