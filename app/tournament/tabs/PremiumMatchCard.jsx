import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@/constants/typography";
import { TournamentTeamLogo, formatFixtureDateTime } from "@/features/tournament/helpers";
import {
  MATCH_CARD_THEMES,
  buildMatchHeadline,
  describeMatchStage,
  describePastResult,
  formatFixtureSideScore,
  isAwayWinner,
  isHomeWinner,
  resolveFixtureTeamName,
} from "@/features/tournament/liveMatchConfig";
import BaseballLineScore, { buildLineScoreFromFixture } from "@/components/game/BaseballLineScore";
import BasketballLineScore, { buildBasketballLineScoreFromFixture } from "@/components/game/BasketballLineScore";

const SIZES = {
  regular: {
    outerMargin: 14,
    radius: 18,
    padding: 16,
    stripe: 3,
    badgePx: 10,
    badgePy: 5,
    badgeFont: 10,
    dot: 7,
    stageFont: 11,
    eyebrowFont: 11,
    eyebrowMb: 12,
    headerMb: 14,
    teamsMb: 14,
    logoRing: 52,
    logoSize: 40,
    logoMb: 8,
    nameFont: 13,
    scoreFont: 15,
    vsFont: 28,
    vsMinW: 56,
    vsPx: 8,
    headlineFont: 16,
    resultFont: 13,
    metaFont: 11,
    metaMb: 14,
    ctaPy: 12,
    ctaFont: 14,
    ctaIcon: 18,
    adminPy: 11,
    adminFont: 13,
    showEyebrow: true,
    showStage: true,
    showHeadline: true,
    showMeta: true,
  },
  compact: {
    outerMargin: 0,
    radius: 14,
    padding: 10,
    stripe: 2,
    badgePx: 7,
    badgePy: 3,
    badgeFont: 8,
    dot: 5,
    stageFont: 9,
    eyebrowFont: 9,
    eyebrowMb: 6,
    headerMb: 8,
    teamsMb: 8,
    logoRing: 34,
    logoSize: 26,
    logoMb: 4,
    nameFont: 10,
    scoreFont: 12,
    vsFont: 18,
    vsMinW: 28,
    vsPx: 4,
    headlineFont: 11,
    resultFont: 10,
    metaFont: 9,
    metaMb: 8,
    ctaPy: 8,
    ctaFont: 11,
    ctaIcon: 14,
    adminPy: 8,
    adminFont: 10,
    showEyebrow: false,
    showStage: false,
    showHeadline: false,
    showMeta: false,
  },
};

function StatusBadge({ theme, sizes }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: sizes.dot > 5 ? 6 : 4,
        backgroundColor: theme.badgeBg,
        borderWidth: 1,
        borderColor: theme.badgeBorder,
        paddingHorizontal: sizes.badgePx,
        paddingVertical: sizes.badgePy,
        borderRadius: 999,
      }}
    >
      {theme.dotColor ? (
        <View
          style={{
            width: sizes.dot,
            height: sizes.dot,
            borderRadius: sizes.dot / 2,
            backgroundColor: theme.dotColor,
          }}
        />
      ) : null}
      <Text
        style={{
          color: theme.badgeColor,
          fontSize: sizes.badgeFont,
          fontWeight: "900",
          letterSpacing: 1,
        }}
      >
        {theme.badge}
      </Text>
    </View>
  );
}

function TeamBlock({ name, logo, score, won, theme, sizes }) {
  const checkSize = sizes.logoRing < 40 ? 14 : 18;
  return (
    <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
      <View
        style={{
          width: sizes.logoRing,
          height: sizes.logoRing,
          borderRadius: sizes.logoRing / 2,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderWidth: 1.5,
          borderColor: won ? theme.accent : theme.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: sizes.logoMb,
        }}
      >
        <View style={{ marginRight: -6 }}>
          <TournamentTeamLogo teamLogo={logo} teamName={name} size={sizes.logoSize} />
        </View>
        {won ? (
          <View
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              backgroundColor: theme.accent,
              borderRadius: checkSize / 2,
              width: checkSize,
              height: checkSize,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark" size={checkSize - 4} color="#0B1324" />
          </View>
        ) : null}
      </View>
      <Text
        style={{
          color: won ? "#FFFFFF" : "#F8FAFC",
          fontSize: sizes.nameFont,
          fontWeight: won ? "900" : "800",
          textAlign: "center",
          lineHeight: sizes.nameFont + 3,
        }}
        numberOfLines={sizes.logoRing < 40 ? 1 : 2}
      >
        {name}
      </Text>
      {score ? (
        <Text
          style={{
            color: theme.accent,
            fontSize: sizes.scoreFont,
            fontWeight: "900",
            marginTop: 2,
            fontFamily: fonts.scoreDisplay,
          }}
        >
          {score}
        </Text>
      ) : null}
    </View>
  );
}

export default function PremiumMatchCard({
  fixture,
  variant = "live",
  compact = false,
  totalOvers,
  sport,
  scheduledInnings,
  isAdmin,
  busy,
  onWatchLive,
  onOpen,
  onStart,
  onSchedule,
  onEnterResult,
  pastOpensScorecard = false,
  isDark = false,
  T,
  showAdminActions = false,
}) {
  const sizes = compact ? SIZES.compact : SIZES.regular;
  const theme = MATCH_CARD_THEMES[variant] || MATCH_CARD_THEMES.live;
  const homeName = resolveFixtureTeamName(fixture, "home");
  const awayName = resolveFixtureTeamName(fixture, "away");
  const headline = buildMatchHeadline(fixture);
  const stageLabel = describeMatchStage(fixture);
  const scheduledLabel = formatFixtureDateTime(fixture?.scheduledAt);
  const hasGame = !!fixture?.gameId;
  const canPlay = fixture?.homeTeamId && fixture?.awayTeamId;
  const homeWon = isHomeWinner(fixture);
  const awayWon = isAwayWinner(fixture);
  const homeScore = formatFixtureSideScore(fixture?.result?.home, sport);
  const awayScore = formatFixtureSideScore(fixture?.result?.away, sport);
  const resultLine = describePastResult(fixture);
  const isBaseball = String(sport || "").toLowerCase() === "baseball";
  const isBasketball = String(sport || "").toLowerCase() === "basketball";
  const showBaseballLine =
    isBaseball &&
    (variant === "past" || variant === "live") &&
    (fixture?.result?.home?.byInning?.length ||
      fixture?.result?.away?.byInning?.length ||
      fixture?.result?.byInning);
  const showBasketballLine =
    isBasketball &&
    (variant === "past" || variant === "live") &&
    (fixture?.result?.home?.byQuarter?.length || fixture?.result?.away?.byQuarter?.length);

  const handlePrimaryPress = () => {
    if (variant === "live" && hasGame && isAdmin && onOpen) onOpen(fixture);
    else if (variant === "live" && hasGame && onWatchLive) onWatchLive(fixture);
    else if (variant === "past" && hasGame && pastOpensScorecard && onWatchLive) onWatchLive(fixture);
    else if (variant === "past" && hasGame && isAdmin && onOpen) onOpen(fixture);
    else if (variant === "past" && hasGame && onWatchLive) onWatchLive(fixture);
    else if (variant === "past" && hasGame && onOpen) onOpen(fixture);
    else if (variant === "upcoming" && isAdmin && !hasGame && onStart) onStart(fixture);
    else if (variant === "upcoming" && isAdmin && hasGame && onOpen) onOpen(fixture);
  };

  const primaryEnabled =
    (variant === "live" && hasGame && (onOpen || onWatchLive)) ||
    (variant === "past" && hasGame && (onWatchLive || onOpen)) ||
    (variant === "upcoming" && isAdmin && canPlay && (onStart || onOpen));

  const ctaLabel =
    variant === "live"
      ? hasGame
        ? isAdmin && onOpen
          ? compact
            ? "Score"
            : "Resume scoring"
          : compact
            ? "Watch"
            : theme.ctaLabel
        : "Soon"
      : variant === "past"
        ? hasGame
          ? pastOpensScorecard
            ? compact
              ? "Scorecard"
              : theme.ctaLabel
            : compact
              ? isAdmin && onOpen
                ? "Score"
                : "Scorecard"
              : isAdmin && onOpen
                ? "Resume scoring"
                : theme.ctaLabel
          : resultLine || homeScore || awayScore
            ? compact
              ? "Result"
              : "Full time"
            : "Done"
        : scheduledLabel && compact
          ? scheduledLabel.split(" · ")[0]
          : scheduledLabel
            ? scheduledLabel
            : compact
              ? "Upcoming"
              : theme.ctaLabel;

  const ctaIcon =
    variant === "upcoming"
      ? scheduledLabel
        ? "calendar-outline"
        : "hourglass-outline"
      : theme.ctaIcon;

  const ctaTextColor =
    (variant === "live" && hasGame) || (variant === "past" && hasGame)
      ? theme.ctaText
      : "#94A3B8";

  const pastCtaBg =
    variant === "past" && hasGame && pastOpensScorecard
      ? "rgba(52,211,153,0.22)"
      : null;

  return (
    <View style={{ marginBottom: sizes.outerMargin, borderRadius: sizes.radius, overflow: "hidden" }}>
      <TouchableOpacity
        activeOpacity={primaryEnabled ? 0.88 : 1}
        onPress={primaryEnabled ? handlePrimaryPress : undefined}
        disabled={!primaryEnabled}
      >
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: sizes.padding,
            borderRadius: sizes.radius,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: sizes.stripe,
              backgroundColor: theme.accent,
              opacity: 0.85,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: sizes.headerMb,
              gap: 6,
            }}
          >
            <StatusBadge theme={theme} sizes={sizes} />
            {sizes.showStage ? (
              <Text
                style={{
                  flex: 1,
                  color: "#94A3B8",
                  fontSize: sizes.stageFont,
                  fontWeight: "700",
                  textAlign: "right",
                }}
                numberOfLines={1}
              >
                {stageLabel}
              </Text>
            ) : null}
          </View>

          {sizes.showEyebrow ? (
            <Text
              style={{
                color: "#E2E8F0",
                fontSize: sizes.eyebrowFont,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                textAlign: "center",
                marginBottom: sizes.eyebrowMb,
                opacity: 0.75,
              }}
            >
              {theme.eyebrow}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: sizes.teamsMb }}>
            <TeamBlock
              name={homeName}
              logo={fixture?.homeTeamLogo}
              score={variant === "past" ? homeScore : null}
              won={homeWon}
              theme={theme}
              sizes={sizes}
            />
            <View style={{ alignItems: "center", paddingHorizontal: sizes.vsPx, minWidth: sizes.vsMinW }}>
              <Text
                style={{
                  fontFamily: fonts.scoreDisplay,
                  color: theme.vsColor,
                  fontSize: sizes.vsFont,
                  letterSpacing: 0.5,
                  lineHeight: sizes.vsFont + 2,
                }}
              >
                VS
              </Text>
            </View>
            <TeamBlock
              name={awayName}
              logo={fixture?.awayTeamLogo}
              score={variant === "past" ? awayScore : null}
              won={awayWon}
              theme={theme}
              sizes={sizes}
            />
          </View>

          {showBaseballLine ? (
            <View style={{ marginBottom: 10 }}>
              <BaseballLineScore
                {...buildLineScoreFromFixture({
                  ...fixture,
                  homeTeamName: homeName,
                  awayTeamName: awayName,
                  scheduledInnings: fixture?.result?.scheduledInnings ?? scheduledInnings,
                })}
                compact={compact}
                isDark
              />
            </View>
          ) : null}
          {showBasketballLine ? (
            <View style={{ marginBottom: 10 }}>
              <BasketballLineScore
                {...buildBasketballLineScoreFromFixture({
                  ...fixture,
                  homeTeamName: homeName,
                  awayTeamName: awayName,
                })}
                compact={compact}
                isDark
              />
            </View>
          ) : null}

          {sizes.showHeadline ? (
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: sizes.headlineFont,
                fontWeight: "800",
                textAlign: "center",
                letterSpacing: -0.2,
                marginBottom: resultLine || variant !== "past" ? 8 : 12,
              }}
              numberOfLines={2}
            >
              {headline}
            </Text>
          ) : compact ? (
            <Text
              style={{
                color: "#CBD5E1",
                fontSize: sizes.headlineFont,
                fontWeight: "700",
                textAlign: "center",
                marginBottom: resultLine ? 4 : sizes.metaMb,
              }}
              numberOfLines={1}
            >
              {headline}
            </Text>
          ) : null}

          {resultLine ? (
            <Text
              style={{
                color: theme.accent,
                fontSize: sizes.resultFont,
                fontWeight: "700",
                textAlign: "center",
                marginBottom: sizes.metaMb,
              }}
              numberOfLines={compact ? 1 : 2}
            >
              {resultLine}
            </Text>
          ) : null}

          {sizes.showMeta &&
          (variant === "upcoming" || variant === "live") &&
          (scheduledLabel || fixture?.venue || totalOvers) ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 12,
                marginBottom: sizes.metaMb,
              }}
            >
              {scheduledLabel ? (
                <Text style={{ color: "#64748B", fontSize: sizes.metaFont, fontWeight: "600" }}>
                  {scheduledLabel}
                </Text>
              ) : null}
              {fixture?.venue ? (
                <Text style={{ color: "#64748B", fontSize: sizes.metaFont, fontWeight: "600" }} numberOfLines={1}>
                  {fixture.venue}
                </Text>
              ) : null}
              {totalOvers ? (
                <Text style={{ color: "#64748B", fontSize: sizes.metaFont, fontWeight: "600" }}>
                  {totalOvers} overs
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor:
                pastCtaBg ||
                (primaryEnabled || variant === "upcoming" ? theme.ctaBg : "rgba(255,255,255,0.06)"),
              paddingVertical: sizes.ctaPy,
              borderRadius: 10,
              borderWidth: variant === "past" && hasGame && pastOpensScorecard ? 1 : 0,
              borderColor:
                variant === "past" && hasGame && pastOpensScorecard
                  ? "rgba(52,211,153,0.45)"
                  : "transparent",
            }}
          >
            <Ionicons name={ctaIcon} size={sizes.ctaIcon} color={ctaTextColor} />
            <Text
              style={{
                color:
                  variant === "past" && hasGame && pastOpensScorecard
                    ? "#A7F3D0"
                    : ctaTextColor,
                fontWeight: "800",
                fontSize: sizes.ctaFont,
              }}
              numberOfLines={1}
            >
              {ctaLabel}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {variant === "upcoming" && isAdmin && canPlay && (!compact || showAdminActions) ? (
        <View
          style={{
            flexDirection: compact ? "column" : "row",
            gap: compact ? 6 : 8,
            marginTop: 8,
          }}
        >
          {!hasGame ? (
            <TouchableOpacity
              disabled={busy}
              onPress={() => onStart?.(fixture)}
              style={{
                flex: compact ? undefined : 1,
                width: compact ? "100%" : undefined,
                backgroundColor: "#0B1324",
                paddingVertical: sizes.adminPy,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                minHeight: compact ? 34 : 40,
                opacity: busy ? 0.7 : 1,
                ...(isDark && { borderWidth: 1, borderColor: T?.border || "#2A2A2E" }),
              }}
            >
              {busy ? (
                <ActivityIndicator color="#BAF072" />
              ) : (
                <Text style={{ color: "#BAF072", fontWeight: "800", fontSize: sizes.adminFont }}>
                  {compact ? "Start" : "Start match"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onOpen?.(fixture)}
              style={{
                flex: compact ? undefined : 1,
                width: compact ? "100%" : undefined,
                backgroundColor: "#BAF072",
                paddingVertical: sizes.adminPy,
                borderRadius: 12,
                alignItems: "center",
                minHeight: compact ? 34 : undefined,
              }}
            >
              <Text style={{ color: "#0B1324", fontWeight: "800", fontSize: sizes.adminFont }}>
                {compact ? "Resume" : "Resume scoring"}
              </Text>
            </TouchableOpacity>
          )}
          {(onSchedule || onEnterResult) && compact ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {onSchedule ? (
                <TouchableOpacity
                  onPress={() => onSchedule(fixture)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: sizes.adminPy,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? T?.border || "#2A2A2E" : "#E2E8F0",
                    backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={isDark ? T?.textDim || "#A1A1AA" : "#374151"} />
                  ) : (
                    <Text
                      style={{
                        color: isDark ? T?.text || "#F5F5F7" : "#374151",
                        fontWeight: "700",
                        fontSize: sizes.adminFont,
                      }}
                    >
                      {fixture.scheduledAt ? "Resched" : "Sched"}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {onEnterResult ? (
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onEnterResult(fixture)}
                  style={{
                    flex: 1,
                    paddingVertical: sizes.adminPy,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? T?.border || "#2A2A2E" : "#E2E8F0",
                    backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={isDark ? T?.textDim || "#A1A1AA" : "#374151"} />
                  ) : (
                    <Text
                      style={{
                        color: isDark ? T?.text || "#F5F5F7" : "#374151",
                        fontWeight: "700",
                        fontSize: sizes.adminFont,
                      }}
                    >
                      Result
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              {onSchedule ? (
                <TouchableOpacity
                  onPress={() => onSchedule(fixture)}
                  disabled={busy}
                  style={{
                    paddingVertical: sizes.adminPy,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? T?.border || "#2A2A2E" : "#E2E8F0",
                    backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 96,
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={isDark ? T?.textDim || "#A1A1AA" : "#374151"} />
                  ) : (
                    <Text
                      style={{
                        color: isDark ? T?.text || "#F5F5F7" : "#374151",
                        fontWeight: "700",
                        fontSize: sizes.adminFont,
                      }}
                    >
                      {fixture.scheduledAt ? "Reschedule" : "Schedule"}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {onEnterResult ? (
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onEnterResult(fixture)}
                  style={{
                    paddingVertical: sizes.adminPy,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? T?.border || "#2A2A2E" : "#E2E8F0",
                    backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 72,
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={isDark ? T?.textDim || "#A1A1AA" : "#374151"} />
                  ) : (
                    <Text
                      style={{
                        color: isDark ? T?.text || "#F5F5F7" : "#374151",
                        fontWeight: "700",
                        fontSize: sizes.adminFont,
                      }}
                    >
                      Result
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
