import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

function VolleyballScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  isUpdating,
  onScore,
  gameOver,
  displayOnly = false,
  userSide = "home",
  onEndGame,
}) {
  const sportData = currentGame?.sport || {};
  const base = currentGame?.base || {};
  const homeId = String(base?.teamId || "");
  const userIsHome = userSide === "home";
  const opponentSide = userIsHome ? "away" : "home";

  // Current set data
  const currentSet = sportData?.currentSet || 1;
  const totalSets = sportData?.totalSets || 5;
  const sets = sportData?.sets || [];
  const currentSetD = sets[currentSet - 1] || {};

  const userSetScore = currentSetD[userIsHome ? "homeScore" : "awayScore"] ?? 0;
  const opponentSetScore =
    currentSetD[userIsHome ? "awayScore" : "homeScore"] ?? 0;

  // Past set wins
  const pastSets = sets.filter((s) => s.winner);
  const userSetWins = pastSets.filter(
    (s) =>
      (userIsHome ? s.homeScore : s.awayScore) >
      (userIsHome ? s.awayScore : s.homeScore),
  ).length;
  const opponentSetWins = pastSets.filter(
    (s) =>
      (userIsHome ? s.awayScore : s.homeScore) >
      (userIsHome ? s.homeScore : s.awayScore),
  ).length;

  // Serving team
  const servingTeamId = sportData?.servingTeam;
  const servingTeam = servingTeamId
    ? String(servingTeamId) === homeId
      ? "home"
      : "away"
    : null;
  const userServing = servingTeam === userSide;

  // Team names
  const userTeamName = userIsHome ? teamNames?.home : teamNames?.away;
  const opponentTeamName = userIsHome ? teamNames?.away : teamNames?.home;

  const disabled = isUpdating || gameOver;

  // Recent events for this set
  const setEvents = useMemo(() => {
    return (sportData?.events || [])
      .filter(Boolean)
      .filter((e) => Number(e.setNumber) === currentSet)
      .slice(-8)
      .reverse();
  }, [sportData?.events, currentSet]);

  // Event badge helper
  const getEventBadge = (type) => {
    switch (type) {
      case "point":
        return { label: "●", bg: "#16a34a" };
      case "serve_ace":
        return { label: "A", bg: "#eab308" };
      case "attack_kill":
        return { label: "K", bg: "#f97316" };
      case "block_point":
        return { label: "B", bg: "#2563eb" };
      case "serve_error":
        return { label: "SE", bg: "#b91c1c" };
      case "attack_error":
        return { label: "AE", bg: "#dc2626" };
      case "fault":
        return { label: "F", bg: "#ef4444" };
      case "side_out":
        return { label: "SO", bg: "#9333ea" };
      case "timeout":
        return { label: "T", bg: "#ca8a04" };
      case "substitution":
        return { label: "S", bg: "#4f46e5" };
      default:
        return { label: "•", bg: "#4B5563" };
    }
  };

  // Active player helper (most actions this set)
  const getActivePlayer = (teamSide) => {
    const isHomeTeam = teamSide === "home";
    const teamEvents = setEvents.filter((e) => {
      if (!e) return false;
      const eTeamIsHome = String(e.teamId) === homeId;
      return isHomeTeam ? eTeamIsHome : !eTeamIsHome;
    });
    const count = {};
    teamEvents.forEach((e) => {
      if (e?.playerId) count[e.playerId] = (count[e.playerId] || 0) + 1;
    });
    const topId = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topId) return null;
    const all = [...(players?.home || []), ...(players?.away || [])];
    const p = all.find((pl) => String(pl._id || pl.id) === String(topId));
    return p ? `${p.firstName} ${p.lastName}` : null;
  };

  const userActivePlayer = getActivePlayer(userSide);
  const opponentActivePlayer = getActivePlayer(opponentSide);

  return (
    <View style={{ gap: 12 }}>
      {/* ═══ YOUR TEAM — Score + Serving ═══ */}
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          minHeight: 120,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {userTeamName}
          </Text>
          <View
            style={{
              backgroundColor: userServing
                ? "rgba(234,179,8,0.2)"
                : "rgba(255,255,255,0.05)",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: userServing ? "#facc15" : "#6B7280",
              }}
            >
              {userServing ? "🏐 Serving" : "Receiving"}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
          >
            <Text style={{ fontSize: 48, fontWeight: "900", color: "#4ade80" }}>
              {userSetScore}
            </Text>
            <Text style={{ fontSize: 18, color: "#6B7280" }}>
              / {opponentSetScore}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>
              Sets Won
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>
              {userSetWins}
            </Text>
          </View>
        </View>
        {userActivePlayer && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#facc15", fontSize: 12 }}>★</Text>
            <Text
              style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
              numberOfLines={1}
            >
              {userActivePlayer}
            </Text>
            <Text style={{ color: "#4B5563", fontSize: 10 }}>
              active this set
            </Text>
          </View>
        )}
      </View>

      {/* ═══ OPPONENT TEAM ═══ */}
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          minHeight: 120,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {opponentTeamName}
          </Text>
          <View
            style={{
              backgroundColor:
                !userServing && servingTeam
                  ? "rgba(234,179,8,0.2)"
                  : "rgba(255,255,255,0.05)",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: !userServing && servingTeam ? "#facc15" : "#6B7280",
              }}
            >
              {!userServing && servingTeam ? "🏐 Serving" : "Receiving"}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 36, fontWeight: "900", color: "#f87171" }}>
            {opponentSetScore}
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>
              Sets Won
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>
              {opponentSetWins}
            </Text>
          </View>
        </View>
        {opponentActivePlayer && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#f87171", fontSize: 12 }}>★</Text>
            <Text
              style={{ color: "#D1D5DB", fontWeight: "600", fontSize: 13 }}
              numberOfLines={1}
            >
              {opponentActivePlayer}
            </Text>
          </View>
        )}
      </View>

      {/* ═══ RALLY LOG ═══ */}
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          minHeight: 72,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Set {currentSet} · Rally Log
          </Text>
          <Text style={{ fontSize: 10, color: "#6B7280" }}>
            {currentSet === totalSets
              ? "Deciding Set → 15 pts"
              : "First to 25 pts"}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            minHeight: 32,
          }}
        >
          {setEvents.length === 0 ? (
            <Text
              style={{ color: "#4B5563", fontSize: 11, fontStyle: "italic" }}
            >
              No events yet
            </Text>
          ) : (
            setEvents.filter(Boolean).map((e, i) => {
              if (!e) return null;
              const badge = getEventBadge(e.eventType);
              const eIsHome = String(e.teamId) === homeId;
              const eIsUser = userIsHome ? eIsHome : !eIsHome;
              return (
                <View
                  key={i}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: badge.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: eIsUser ? 1 : 0.5,
                    borderWidth: eIsUser ? 0 : 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}
                  >
                    {badge.label}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ═══ MAIN SCORING — Rally buttons ═══ */}
      {!displayOnly && (
        <View style={{ borderRadius: 12, padding: 8 }}>
          <Text
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: "800",
              color: "rgba(74,222,128,0.8)",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            Which team won the rally?
          </Text>

          {/* Big +1 buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            {/* User team +1 */}
            <TouchableOpacity
              onPress={() => onScore("point", userSide)}
              disabled={disabled}
              style={{
                flex: 1,
                borderRadius: 4,
                paddingVertical: 40,
                alignItems: "center",
                backgroundColor: userServing
                  ? "#16a34a"
                  : "rgba(22,163,74,0.2)",
                borderWidth: 2,
                borderColor: userServing ? "#4ade80" : "rgba(34,197,94,0.3)",
                opacity: disabled ? 0.4 : 1,
                ...(userServing
                  ? {
                      shadowColor: "#4ade80",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                    }
                  : {}),
              }}
            >
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "900",
                  color: userServing ? "#fff" : "#86efac",
                  marginBottom: 4,
                }}
              >
                +1
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: userServing ? "#fff" : "#86efac",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
                numberOfLines={1}
              >
                {userTeamName}
              </Text>
            </TouchableOpacity>

            {/* Opponent team +1 */}
            <TouchableOpacity
              onPress={() => onScore("point", opponentSide)}
              disabled={disabled}
              style={{
                flex: 1,
                borderRadius: 4,
                paddingVertical: 40,
                alignItems: "center",
                backgroundColor:
                  !userServing && servingTeam
                    ? "#16a34a"
                    : "rgba(239,68,68,0.2)",
                borderWidth: 2,
                borderColor:
                  !userServing && servingTeam
                    ? "#4ade80"
                    : "rgba(239,68,68,0.3)",
                opacity: disabled ? 0.4 : 1,
                ...(!userServing && servingTeam
                  ? {
                      shadowColor: "#4ade80",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                    }
                  : {}),
              }}
            >
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "900",
                  color: !userServing && servingTeam ? "#fff" : "#fca5a5",
                  marginBottom: 4,
                }}
              >
                +1
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: !userServing && servingTeam ? "#fff" : "#fca5a5",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
                numberOfLines={1}
              >
                {opponentTeamName}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
              marginBottom: 16,
            }}
          />

          {/* Optional Scoring Tags */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: "700",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Optional Scoring Tags
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* User side tags */}
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onScore("attack_kill", userSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#fb923c",
                    borderWidth: 2,
                    borderColor: "rgba(249,115,22,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#f9f5f3",
                    }}
                  >
                    KILL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onScore("block_point", userSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#60a5fa",
                    borderWidth: 2,
                    borderColor: "rgba(59,130,246,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#eceef1",
                    }}
                  >
                    BLOCK
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onScore("serve_ace", userSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#facc15",
                    borderWidth: 2,
                    borderColor: "rgba(234,179,8,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#fdfdfb",
                    }}
                  >
                    ACE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onScore("attack_error", opponentSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#f53e3e",
                    borderWidth: 2,
                    borderColor: "rgba(239,68,68,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: "#f6f3f3",
                      textAlign: "center",
                    }}
                  >
                    OPP{"\n"}ERROR
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Opponent side tags */}
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onScore("attack_kill", opponentSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#fb923c",
                    borderWidth: 2,
                    borderColor: "rgba(249,115,22,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#fefbf9",
                    }}
                  >
                    KILL
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onScore("block_point", opponentSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#60a5fa",
                    borderWidth: 2,
                    borderColor: "rgba(59,130,246,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#f7f8f9",
                    }}
                  >
                    BLOCK
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => onScore("serve_ace", opponentSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#facc15",
                    borderWidth: 2,
                    borderColor: "rgba(234,179,8,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#fefdf9",
                    }}
                  >
                    ACE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onScore("attack_error", userSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    backgroundColor: "#f53e3e",
                    borderWidth: 2,
                    borderColor: "rgba(239,68,68,0.2)",
                    borderRadius: 4,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: "#fef6f6",
                      textAlign: "center",
                    }}
                  >
                    OPP{"\n"}ERROR
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ═══ GAME MANAGEMENT ═══ */}
      {!displayOnly && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { type: "timeout", label: "Timeout" },
            { type: "substitution", label: "Sub" },
            { type: "challenge", label: "Challenge" },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.type}
              onPress={() => onScore(btn.type, userSide)}
              disabled={disabled}
              style={{
                flex: 1,
                backgroundColor: "#1f2937",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: 4,
                paddingVertical: 12,
                alignItems: "center",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#D1D5DB" }}
              >
                {btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ═══ SET HISTORY ═══ */}
      {pastSets.length > 0 && (
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Set History
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {pastSets.map((s, idx) => {
              const uScore = userIsHome ? s.homeScore : s.awayScore;
              const oScore = userIsHome ? s.awayScore : s.homeScore;
              const userWon = uScore > oScore;
              return (
                <View
                  key={idx}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    backgroundColor: userWon
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                    borderColor: userWon
                      ? "rgba(34,197,94,0.3)"
                      : "rgba(239,68,68,0.3)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: userWon ? "#4ade80" : "#f87171",
                    }}
                  >
                    Set {idx + 1}: {uScore}–{oScore}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}


export default VolleyballScoringPanelMobile;
