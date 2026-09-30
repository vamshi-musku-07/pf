import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { PrimaryButton } from "@/features/tournament/helpers";
import { previewPlayoffsAPI } from "@/services/TournamentApi";
import {
  getLeaguePhaseProgress,
  formatQualifierLines,
  formatSeedLine,
  formatBracketSummaryLine,
} from "@/features/tournament/nextStageConfig";
import { buildLocalPlayoffPreview, extractApiError } from "@/features/tournament/playoffPreviewConfig";

function ThemedSectionCard({ title, isDark, T, children }) {
  return (
    <View
      style={{
        backgroundColor: isDark ? T.surface : "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: isDark ? T.border : "#EEF2F6",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ProgressBar({ completed, total, isDark, T, unitLabel }) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: isDark ? T.border : "#E2E8F0",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: "#BAF072",
            borderRadius: 999,
          }}
        />
      </View>
      <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280", marginTop: 6 }}>
        {completed} of {total} {unitLabel} matches complete ({pct}%)
      </Text>
    </View>
  );
}

export default function NextStageCard({
  tournament,
  tournamentId,
  fixtures = [],
  standingsByDivision = {},
  busy,
  onGenerateNextStage,
  onOpenBracket,
  nextStageLabel = "Set knockout round",
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const sportKey = String(tournament?.sport || "").toLowerCase();
  const unitLower =
    sportKey === "football" || sportKey === "volleyball"
      ? "group"
      : sportKey === "baseball"
        ? "pool"
        : "division";
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewHint, setPreviewHint] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const resolvedTournamentId = String(
    tournamentId || tournament?._id || tournament?.id || "",
  ).trim();

  const leagueProgress = getLeaguePhaseProgress(fixtures);
  const playoffsGenerated = !!tournament.playoffsGenerated;
  const canFetchPreview =
    tournament.format === "hybrid" &&
    tournament.fixturesGenerated &&
    !playoffsGenerated &&
    !!resolvedTournamentId;

  const applyLocalPreview = useCallback(() => {
    const local = buildLocalPlayoffPreview(tournament, fixtures, standingsByDivision);
    setPreview(local);
    return local;
  }, [tournament, fixtures, standingsByDivision]);

  const loadPreview = useCallback(async () => {
    if (!canFetchPreview) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHint(null);

    try {
      const res = await previewPlayoffsAPI(resolvedTournamentId);
      const payload = res?.data || null;
      if (payload) {
        setPreview(payload);
        if (!payload.ready && payload.error) {
          setPreviewHint(payload.error);
        }
        return;
      }
      applyLocalPreview();
    } catch (error) {
      const local = applyLocalPreview();
      const message = extractApiError(error);
      if (local?.qualifiers?.length || local?.seedOrder?.length) {
        setPreviewHint(message);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(message || local?.error || "Could not load preview");
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [canFetchPreview, resolvedTournamentId, applyLocalPreview]);

  useEffect(() => {
    if (!canFetchPreview) {
      setPreview(null);
      setPreviewError(null);
      setPreviewHint(null);
      return;
    }
    loadPreview();
  }, [canFetchPreview, loadPreview, leagueProgress.completed, leagueProgress.complete]);

  if (tournament.format !== "hybrid" || !tournament.fixturesGenerated) {
    return null;
  }

  if (playoffsGenerated) {
    return (
      <ThemedSectionCard title="Knockout stage" isDark={isDark} T={T}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <Ionicons name="checkmark-circle" size={22} color={isDark ? "#4ADE80" : "#16A34A"} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: isDark ? "#86EFAC" : "#166534", fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
              Knockout is underway. After each round finishes, pair the remaining teams for the next round.
            </Text>
            {onOpenBracket ? (
              <TouchableOpacity onPress={onOpenBracket} style={{ marginTop: 10 }}>
                <Text style={{ color: isDark ? "#93C5FD" : "#2563EB", fontWeight: "700", fontSize: 13 }}>Open Bracket tab</Text>
              </TouchableOpacity>
            ) : null}
            {onGenerateNextStage ? (
              <View style={{ marginTop: 12 }}>
                <PrimaryButton
                  label={nextStageLabel}
                  onPress={onGenerateNextStage}
                  disabled={busy}
                  busy={busy}
                  isDark={isDark}
                  T={T}
                />
              </View>
            ) : null}
          </View>
        </View>
      </ThemedSectionCard>
    );
  }

  const ready = preview?.ready || leagueProgress.complete;
  const qualifierText = preview?.qualifiers?.length
    ? formatQualifierLines(preview.qualifiers, {
        qualifiersPerDivision:
          preview.qualifiersPerDivision || tournament.config?.qualifiersPerDivision,
        sport: tournament?.sport,
      })
    : null;
  const seedText = preview?.seedOrder?.length ? formatSeedLine(preview.seedOrder) : null;
  const bracketText = formatBracketSummaryLine(preview?.bracketSummary);

  return (
    <ThemedSectionCard title="Next stage" isDark={isDark} T={T}>
      <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
        When all {unitLower} matches finish, qualifiers are ready. You choose who plays whom in the
        knockout
        {tournament.config?.qualifiersPerDivision > 0
          ? ` (top ${tournament.config.qualifiersPerDivision} per ${unitLower} advance).`
          : "."}
      </Text>

      {leagueProgress.total > 0 ? (
        <ProgressBar
          completed={leagueProgress.completed}
          total={leagueProgress.total}
          isDark={isDark}
          T={T}
          unitLabel={unitLower}
        />
      ) : (
        <Text style={{ color: "#B45309", fontSize: 12, marginTop: 8 }}>No league fixtures yet.</Text>
      )}

      {!leagueProgress.complete ? (
        <Text style={{ color: "#B45309", fontSize: 12, marginTop: 10, lineHeight: 17 }}>
          {leagueProgress.remaining} match{leagueProgress.remaining === 1 ? "" : "es"} remaining before
          qualifiers can be confirmed.
        </Text>
      ) : null}

      {leagueProgress.complete ? (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: expanded ? 8 : 0 }}
        >
          <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={16} color={isDark ? T.text : "#0B1324"} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? T.text : "#0B1324", marginLeft: 4 }}>
            Qualifier preview
          </Text>
          {previewLoading ? (
            <ActivityIndicator size="small" color={isDark ? T.textDim : "#6B7280"} style={{ marginLeft: 8 }} />
          ) : null}
        </TouchableOpacity>
      ) : null}

      {leagueProgress.complete && expanded ? (
        <View
          style={{
            backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? T.border : "#E2E8F0",
            padding: 12,
            marginBottom: 12,
          }}
        >
          {previewError ? (
            <Text style={{ color: isDark ? T.dangerText : "#DC2626", fontSize: 12, lineHeight: 17 }}>{previewError}</Text>
          ) : previewLoading && !preview ? (
            <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 12 }}>Loading qualifiers…</Text>
          ) : qualifierText ? (
            <>
              {previewHint ? (
                <Text style={{ color: "#B45309", fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
                  {previewHint}
                </Text>
              ) : null}
              {preview?.advanceHint ? (
                <Text style={{ color: "#B45309", fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
                  {preview.advanceHint}
                </Text>
              ) : null}
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.text : "#374151", marginBottom: 6 }}>
                Qualifiers from standings
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#1E293B", lineHeight: 18 }}>{qualifierText}</Text>
              {seedText ? (
                <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280", marginTop: 10, lineHeight: 16 }}>
                  Seeds: {seedText}
                </Text>
              ) : null}
              {bracketText ? (
                <Text style={{ fontSize: 11, color: isDark ? T.textDim : "#6B7280", marginTop: 6, lineHeight: 16 }}>{bracketText}</Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 12 }}>
              {preview?.error || previewHint || "Preview unavailable — check standings are complete."}
            </Text>
          )}
        </View>
      ) : null}

      <PrimaryButton
        label={nextStageLabel}
        onPress={onGenerateNextStage}
        disabled={busy || !ready || previewLoading}
        busy={busy}
        isDark={isDark}
        T={T}
      />
    </ThemedSectionCard>
  );
}
