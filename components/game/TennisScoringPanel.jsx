import { useMemo } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { fonts } from "@/constants/typography";

const TENNIS_BALL_3D = require("@/assets/images/tennis-ball-3d.png");

function raisedScoreShadow(isDark) {
  return {
    shadowColor: isDark ? "#000000" : "#94A3B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.28 : 0.16,
    shadowRadius: 3,
    elevation: 3,
  };
}

const POINT_WIN_3D = {
  home: { bg: "#22C55E", border: "#16A34A", deep: "#15803D", text: "#FFFFFF" },
  away: { bg: "#F43F5E", border: "#E11D48", deep: "#BE123C", text: "#FFFFFF" },
};

const ACTION_3D = {
  ace: { bg: "#FBBF24", border: "#F59E0B", deep: "#D97706", text: "#1C1917" },
  winner: { bg: "#10B981", border: "#059669", deep: "#047857", text: "#FFFFFF" },
  doubleFault: { bg: "#FB7185", border: "#F43F5E", deep: "#E11D48", text: "#FFFFFF" },
  let: { bg: "#3B82F6", border: "#2563EB", deep: "#1D4ED8", text: "#FFFFFF" },
};

function RaisedBtn({ onPress, disabled, palette, style, children, isDark, serving = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: palette.bg,
        borderRadius: 12,
        borderWidth: serving ? 2 : 1,
        borderColor: serving ? "#FACC15" : palette.border,
        borderBottomWidth: 3,
        borderBottomColor: palette.deep,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        ...raisedScoreShadow(isDark),
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

function TennisScoringPanelMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onScore,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onEndGame: _onEndGame,
}) {
  const UI = useGameScoringTheme();
  const homeAccent = UI.isDark ? "#34d399" : "#15803D";
  const awayAccent = UI.isDark ? "#f87171" : "#DC2626";
  const warnAccent = UI.isDark ? "#facc15" : "#B45309";
  const softBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const boardBg = UI.isDark ? "#0a2e1a" : "#ECFDF5";
  const boardBorder = UI.isDark ? "rgba(16,185,129,0.2)" : "#A7F3D0";
  const boardHeaderBg = UI.isDark ? "rgba(5,150,105,0.15)" : "#D1FAE5";
  const boardDivider = UI.isDark ? "rgba(255,255,255,0.06)" : "#BBF7D0";
  const mutedCol = UI.isDark ? "#6B7280" : UI.muted;
  const dimCol = UI.isDark ? "#4B5563" : "#9CA3AF";

  const sport = currentGame?.sport;
  const opponentSide = userSide === "home" ? "away" : "home";
  const userIsHome = userSide === "home";

  const sets = sport?.sets || [];
  const currentSetNumber = sport?.currentSetNumber || 1;
  const gameScore = sport?.currentGameScore || { home: 0, away: 0 };
  const pointScore = sport?.currentPointScore || { home: "0", away: "0" };
  const setsWon = sport?.score || { home: 0, away: 0 };
  const servingTeam = sport?.servingTeam || "home";
  const serveSide = sport?.serveSide || "deuce";
  const matchFormat = sport?.matchFormat || "best_of_3";
  const matchConfig = sport?.matchConfig || {};
  const isTiebreaker = sport?.tiebreaker || false;
  const matchFormatLabel = matchFormat === "best_of_5" ? "Best of 5" : "Best of 3";
  const advantageScoring = matchConfig.advantageScoring !== false;

  const u = {
    sets: userIsHome ? setsWon.home : setsWon.away,
    games: userIsHome ? gameScore.home : gameScore.away,
    points: String(userIsHome ? pointScore.home : pointScore.away),
    serving: servingTeam === userSide,
    name: userIsHome ? teamNames.home : teamNames.away,
  };
  const o = {
    sets: userIsHome ? setsWon.away : setsWon.home,
    games: userIsHome ? gameScore.away : gameScore.home,
    points: String(userIsHome ? pointScore.away : pointScore.home),
    serving: servingTeam === opponentSide,
    name: userIsHome ? teamNames.away : teamNames.home,
  };

  const isDeuce = advantageScoring && pointScore.home === "40" && pointScore.away === "40";
  const disabled = isUpdating || gameOver || sport?.matchStatus === "final";
  const serverName = servingTeam === userSide ? u.name : o.name;
  const isDecidingPoint = !advantageScoring && pointScore.home === "40" && pointScore.away === "40";

  const contextualTags = useMemo(() => ([
    isTiebreaker
      ? {
          label: "Tiebreak",
          color: UI.isDark ? "#c084fc" : "#7E22CE",
          bg: UI.isDark ? "rgba(168,85,247,0.15)" : "#F3E8FF",
        }
      : null,
    isDeuce
      ? {
          label: "Deuce",
          color: UI.isDark ? "#fb923c" : "#C2410C",
          bg: UI.isDark ? "rgba(249,115,22,0.15)" : "#FFEDD5",
        }
      : null,
    isDecidingPoint
      ? {
          label: "Deciding Point",
          color: warnAccent,
          bg: UI.isDark ? "rgba(234,179,8,0.12)" : "#FEF3C7",
        }
      : null,
    (u.points === "AD" || o.points === "AD")
      ? {
          label: `Ad ${u.points === "AD" ? u.name : o.name}`,
          color: warnAccent,
          bg: UI.isDark ? "rgba(234,179,8,0.12)" : "#FEF3C7",
        }
      : null,
  ].filter(Boolean)), [
    UI.isDark,
    isTiebreaker,
    isDeuce,
    isDecidingPoint,
    u.points,
    o.points,
    u.name,
    o.name,
    warnAccent,
  ]);

  const getPointContext = (side) => {
    const sidePoints = side === userSide ? u.points : o.points;
    const otherPoints = side === userSide ? o.points : u.points;
    const sideIsServer = servingTeam === side;
    if (isTiebreaker) return null;
    const wouldWinGame =
      (sidePoints === "40" && otherPoints !== "40" && otherPoints !== "AD") ||
      sidePoints === "AD";
    if (!wouldWinGame) return null;
    const sideGames = side === userSide ? u.games : o.games;
    const otherGames = side === userSide ? o.games : u.games;
    const nextGames = sideGames + 1;
    const wouldWinSet =
      (nextGames >= 6 && nextGames - otherGames >= 2) ||
      (nextGames === 7 && otherGames === 5);
    const sideSets = side === userSide ? u.sets : o.sets;
    const setsToWin = matchFormat === "best_of_5" ? 3 : 2;
    const wouldWinMatch = wouldWinSet && sideSets + 1 >= setsToWin;
    if (wouldWinMatch) {
      return {
        label: "Match Point",
        color: UI.isDark ? "#f59e0b" : "#B45309",
        bg: UI.isDark ? "rgba(245,158,11,0.22)" : "#FEF3C7",
      };
    }
    if (wouldWinSet) {
      return {
        label: "Set Point",
        color: UI.isDark ? "#a78bfa" : "#6D28D9",
        bg: UI.isDark ? "rgba(167,139,250,0.22)" : "#EDE9FE",
      };
    }
    return sideIsServer
      ? {
          label: "Game Point",
          color: homeAccent,
          bg: UI.isDark ? "rgba(52,211,153,0.22)" : "#D1FAE5",
        }
      : {
          label: "Break Point",
          color: awayAccent,
          bg: UI.isDark ? "rgba(248,113,113,0.22)" : "#FEE2E2",
        };
  };
  const userPointCtx = getPointContext(userSide);
  const oppPointCtx = getPointContext(opponentSide);

  const setHistory = sets.map((s) => ({
    userGames: userIsHome ? s.homeGames : s.awayGames,
    oppGames: userIsHome ? s.awayGames : s.homeGames,
    userWon: s.winner === userSide,
    tb: s.isTiebreaker,
  }));

  return (
    <View style={{ width: "100%" }}>
      {/* ═══ SCOREBOARD ═══ */}
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: boardBorder,
          backgroundColor: boardBg,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: boardHeaderBg,
            borderBottomWidth: 1,
            borderBottomColor: boardBorder,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 4,
              color: homeAccent,
            }}
          >
            {isTiebreaker
              ? `Set ${currentSetNumber} · Tiebreaker`
              : `Set ${currentSetNumber}`}
          </Text>
          <Text
            style={{
              fontSize: 10,
              color: UI.isDark ? "rgba(52,211,153,0.55)" : "#059669",
              fontWeight: "700",
            }}
          >
            {matchFormatLabel}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: boardDivider,
          }}
        >
          <View style={{ flex: 1.5 }} />
          {sets.map((_, i) => (
            <Text
              key={i}
              style={{
                width: 30,
                textAlign: "center",
                fontSize: 9,
                fontWeight: "700",
                color: dimCol,
              }}
            >
              S{i + 1}
            </Text>
          ))}
          <Text
            style={{
              width: 44,
              textAlign: "center",
              fontSize: 10,
              fontWeight: "700",
              color: mutedCol,
            }}
          >
            GM
          </Text>
          <Text
            style={{
              width: 56,
              textAlign: "center",
              fontSize: 10,
              fontWeight: "700",
              color: warnAccent,
            }}
          >
            PTS
          </Text>
        </View>

        {[u, o].map((player, idx) => {
          const isUser = idx === 0;
          return (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingVertical: 10,
                borderBottomWidth: idx === 0 ? 1 : 0,
                borderBottomColor: boardDivider,
              }}
            >
              <View
                style={{
                  flex: 1.5,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: 8,
                }}
              >
                {player.serving ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: warnAccent,
                      marginRight: 6,
                      borderWidth: UI.isDark ? 0 : 1,
                      borderColor: "#FDE68A",
                    }}
                  />
                ) : (
                  <View style={{ width: 10, marginRight: 6 }} />
                )}
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: isUser ? UI.text : UI.muted,
                  }}
                  numberOfLines={1}
                >
                  {player.name}
                </Text>
              </View>
              {setHistory.map((s, i) => (
                <Text
                  key={i}
                  style={{
                    width: 30,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: (isUser ? s.userWon : !s.userWon) ? homeAccent : dimCol,
                  }}
                >
                  {isUser ? s.userGames : s.oppGames}
                </Text>
              ))}
              <Text
                style={{
                  width: 44,
                  textAlign: "center",
                  fontSize: 20,
                  fontWeight: "900",
                  color: UI.text,
                }}
              >
                {player.games}
              </Text>
              <Text
                style={{
                  width: 56,
                  textAlign: "center",
                  fontSize: 28,
                  fontWeight: "900",
                  color:
                    player.points === "AD"
                      ? warnAccent
                      : isUser
                        ? homeAccent
                        : awayAccent,
                }}
              >
                {player.points}
              </Text>
            </View>
          );
        })}

        {/* Serve banner */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: UI.isDark ? "rgba(250,204,21,0.08)" : "#FEF9C3",
            borderTopWidth: 1,
            borderTopColor: UI.isDark ? "rgba(250,204,21,0.15)" : "#FDE68A",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "900",
              color: warnAccent,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {serverName} serving
          </Text>
          <View
            style={{
              backgroundColor: UI.isDark ? "rgba(59,130,246,0.2)" : "#DBEAFE",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: UI.isDark ? "rgba(59,130,246,0.3)" : "#93C5FD",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "900",
                color: UI.isDark ? "#93c5fd" : "#1D4ED8",
                letterSpacing: 1,
              }}
            >
              {serveSide === "ad" ? "AD SIDE" : "DEUCE SIDE"}
            </Text>
          </View>
        </View>

        {contextualTags.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: UI.isDark ? "rgba(0,0,0,0.28)" : "rgba(15,23,42,0.04)",
            }}
          >
            {contextualTags.map((tag) => (
              <View
                key={tag.label}
                style={{
                  backgroundColor: tag.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: softBorder,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "900", color: tag.color, letterSpacing: 1 }}>
                  {tag.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {!displayOnly && (
        <>
          <View style={{ marginBottom: 10, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: UI.muted,
                textAlign: "center",
              }}
            >
              Tap the player who won the point
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                color: UI.textMuted,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Open Scorecard tab for sets · P · Diff · PTS
            </Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                paddingHorizontal: 4,
              }}
            >
              {[
                { side: userSide, player: u, ctx: userPointCtx, palette: POINT_WIN_3D.home },
                { side: opponentSide, player: o, ctx: oppPointCtx, palette: POINT_WIN_3D.away },
              ].map(({ side, player, ctx, palette }) => (
                <View key={side} style={{ flex: 1 }}>
                  <RaisedBtn
                    onPress={() => !disabled && onScore("pointWon", side)}
                    disabled={disabled}
                    palette={palette}
                    isDark={UI.isDark}
                    serving={player.serving}
                    style={{
                      height: 168,
                      overflow: "hidden",
                      borderColor: ctx ? ctx.color : (player.serving ? "#FACC15" : palette.border),
                      borderWidth: ctx || player.serving ? 2 : 1,
                    }}
                  >
                    {ctx ? (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: ctx.bg,
                          paddingVertical: 5,
                          alignItems: "center",
                          borderBottomWidth: 1,
                          borderBottomColor: ctx.color,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "900",
                            color: ctx.color,
                            textTransform: "uppercase",
                            letterSpacing: 1.5,
                          }}
                        >
                          {ctx.label}
                        </Text>
                      </View>
                    ) : null}
                    {player.serving && !ctx ? (
                      <Text
                        style={{
                          position: "absolute",
                          top: 10,
                          fontSize: 9,
                          fontWeight: "900",
                          color: "#FACC15",
                          letterSpacing: 1,
                        }}
                      >
                        SERVING
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        color: "rgba(255,255,255,0.85)",
                        marginBottom: 6,
                        marginTop: ctx ? 18 : 0,
                      }}
                    >
                      Point Win
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: palette.text,
                        textAlign: "center",
                        paddingHorizontal: 8,
                      }}
                      numberOfLines={2}
                    >
                      {player.name}
                    </Text>
                  </RaisedBtn>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <RaisedBtn
                      onPress={() => !disabled && onScore("ace", side)}
                      disabled={disabled}
                      palette={ACTION_3D.ace}
                      isDark={UI.isDark}
                      style={{ flex: 1, paddingVertical: 22 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "900", color: ACTION_3D.ace.text, letterSpacing: 1 }}>
                        ACE
                      </Text>
                    </RaisedBtn>
                    <RaisedBtn
                      onPress={() => !disabled && onScore("winner", side)}
                      disabled={disabled}
                      palette={ACTION_3D.winner}
                      isDark={UI.isDark}
                      style={{ flex: 1, paddingVertical: 22 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "900", color: ACTION_3D.winner.text, letterSpacing: 1 }}>
                        WINNER
                      </Text>
                    </RaisedBtn>
                  </View>

                  <RaisedBtn
                    onPress={() => !disabled && onScore("double_fault", side)}
                    disabled={disabled}
                    palette={ACTION_3D.doubleFault}
                    isDark={UI.isDark}
                    style={{ marginTop: 8, paddingVertical: 14, width: "100%" }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "900", color: ACTION_3D.doubleFault.text, letterSpacing: 0.5 }}>
                      DBL FAULT
                    </Text>
                  </RaisedBtn>
                </View>
              ))}
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 16,
              paddingHorizontal: 4,
            }}
          >
            <RaisedBtn
              onPress={() => !disabled && onScore("let", userSide)}
              disabled={disabled}
              palette={ACTION_3D.let}
              isDark={UI.isDark}
              style={{
                flex: 1,
                paddingVertical: 16,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: "#FFFFFF",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Let / Replay
              </Text>
            </RaisedBtn>
          </View>
        </>
      )}

      {setHistory.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {setHistory.map((s, i) => (
            <View
              key={i}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: s.userWon
                  ? (UI.isDark ? "rgba(16,185,129,0.12)" : "#D1FAE5")
                  : (UI.isDark ? "rgba(239,68,68,0.12)" : "#FEE2E2"),
                borderColor: s.userWon
                  ? (UI.isDark ? "rgba(16,185,129,0.3)" : "#6EE7B7")
                  : (UI.isDark ? "rgba(239,68,68,0.3)" : "#FECACA"),
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: s.userWon ? homeAccent : awayAccent,
                }}
              >
                S{i + 1}: {s.userGames}–{s.oppGames}
                {s.tb ? " TB" : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default TennisScoringPanelMobile;

/** Black flip-card digits with silver binder rings. */
function TennisFlipDigits({ value = 0, digitColor = "#FFFFFF", compact = false }) {
  const digits = String(Math.max(0, Math.min(99, Number(value) || 0))).padStart(2, "0").split("");
  const tileW = compact ? 34 : 42;
  const tileH = compact ? 48 : 60;
  const fontSize = compact ? 32 : 42;
  const ring = compact ? 8 : 10;

  return (
    <View style={{ flexDirection: "row", gap: compact ? 5 : 7 }}>
      {digits.map((d, i) => (
        <View key={`${i}-${d}`} style={{ alignItems: "center" }}>
          <View
            style={{
              flexDirection: "row",
              gap: tileW * 0.28,
              zIndex: 2,
              marginBottom: -ring * 0.55,
            }}
          >
            {[0, 1].map((r) => (
              <View
                key={r}
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: "#E5E7EB",
                  borderWidth: 1.5,
                  borderColor: "#9CA3AF",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 1,
                  elevation: 2,
                }}
              />
            ))}
          </View>
          <View
            style={{
              width: tileW,
              height: tileH,
              backgroundColor: "#111827",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#1F2937",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 3,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.scoreDisplay,
                fontSize,
                lineHeight: fontSize + 2,
                color: digitColor,
                fontVariant: ["tabular-nums"],
                includeFontPadding: false,
                textAlign: "center",
              }}
            >
              {d}
            </Text>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 3,
                right: 3,
                top: "50%",
                height: 1,
                marginTop: -0.5,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function getTennisSetsWon(sport, isHome) {
  const fromScore = isHome
    ? Number(sport?.score?.home ?? sport?.result?.homeSetsWon ?? 0)
    : Number(sport?.score?.away ?? sport?.result?.awaySetsWon ?? 0);
  if (fromScore > 0) return fromScore;
  return (sport?.sets || []).filter((s) => s?.winner === (isHome ? "home" : "away")).length;
}

function getTennisLiveGames(sport, isHome) {
  const games = sport?.currentGameScore || {};
  return isHome ? Number(games.home || 0) : Number(games.away || 0);
}

/** Flip-tile scoreboard — lime left / white right (sets won). */
export function TennisScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
  gameTime,
  isLive = false,
  isScheduled = false,
  gameOver = false,
  isOwner = false,
  isUpdating = false,
  onPauseResume,
  onStartGame,
  onEndGame,
  compact = false,
  periodLabel = "Set 1",
}) {
  const UI = useGameScoringTheme();
  const userIsHome = userSide !== "away";
  const userSets = getTennisSetsWon(sport, userIsHome);
  const oppSets = getTennisSetsWon(sport, !userIsHome);
  const userGames = getTennisLiveGames(sport, userIsHome);
  const oppGames = getTennisLiveGames(sport, !userIsHome);
  const userName = userIsHome ? (teamNames?.home || "Home") : (teamNames?.away || "Away");
  const oppName = userIsHome ? (teamNames?.away || "Away") : (teamNames?.home || "Home");
  const nameStyle = {
    color: UI.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  };

  return (
    <View
      style={{
        backgroundColor: UI.card,
        borderRadius: 16,
        marginHorizontal: compact ? 0 : 8,
        marginVertical: compact ? 0 : 8,
        paddingVertical: compact ? 12 : 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: UI.isDark ? UI.border : "#CBD5E1",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: UI.isDark ? 0.22 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{userName}</Text>
          <TennisFlipDigits value={userSets} digitColor="#D4FF00" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {userGames}
          </Text>
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 8, minWidth: 72 }}>
          <Image
            source={TENNIS_BALL_3D}
            style={{
              width: compact ? 34 : 44,
              height: compact ? 34 : 44,
              marginBottom: 4,
            }}
            resizeMode="contain"
          />
          <Text style={{ color: UI.muted, fontSize: 11, fontWeight: "800", marginBottom: 8 }}>
            {periodLabel}
          </Text>
          {isScheduled && isOwner && onStartGame ? (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{
                backgroundColor: "#16A34A",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderBottomWidth: 3,
                borderBottomColor: "#166534",
                opacity: isUpdating ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>▶ Start</Text>
            </TouchableOpacity>
          ) : null}
          {isLive && isOwner && !gameOver ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {onPauseResume ? (
                <TouchableOpacity
                  onPress={onPauseResume}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.warningBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.warningBorder,
                    borderBottomWidth: 3,
                    borderBottomColor: UI.warningBorder,
                  }}
                >
                  <Ionicons name={gameTime?.isRunning ? "pause" : "play"} size={16} color={UI.warningStrong} />
                </TouchableOpacity>
              ) : null}
              {onEndGame ? (
                <TouchableOpacity
                  onPress={onEndGame}
                  style={{
                    paddingHorizontal: 10,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: UI.isDark ? "rgba(239,68,68,0.28)" : UI.dangerBg,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: UI.isDark ? "rgba(252,165,165,0.45)" : "#FECACA",
                    borderBottomWidth: 3,
                    borderBottomColor: UI.isDark ? "rgba(185,28,28,0.8)" : "#FECACA",
                  }}
                >
                  <Text style={{ color: UI.dangerText, fontWeight: "800", fontSize: 10 }}>END</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {!isOwner && isScheduled ? (
            <Text style={{ color: UI.muted, fontSize: 10 }}>Waiting</Text>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={nameStyle} numberOfLines={1}>{oppName}</Text>
          <TennisFlipDigits value={oppSets} digitColor="#FFFFFF" compact={compact} />
          <Text style={{ color: UI.muted, fontSize: 10, fontWeight: "700", marginTop: 8 }}>
            Games {oppGames}
          </Text>
        </View>
      </View>
    </View>
  );
}
