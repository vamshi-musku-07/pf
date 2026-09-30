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
import RugbySubstitutionModal from "./RugbySubstitutionModal";

const fmtTime = (m, s) =>
  `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

const pName = (p) => {
  const f = (p?.firstName || "").trim();
  const l = (p?.lastName || "").trim();
  return l ? `${f} ${l}`.trim() : f || "Player";
};

/** 3D raised look — keeps face `bg` / `border`; only adds depth rim + shadow. */
function raised3d(deep, extra = {}) {
  return {
    borderBottomWidth: 4,
    borderBottomColor: deep,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 3,
    elevation: 5,
    ...extra,
  };
}

const RUGBY_ON_FIELD_MAX = 15;

/** Starting XV vs bench before any subs (kick-off preview only). */
export function getRugbyStartingSquads(sport, players, side, homeTeamId, awayTeamId) {
  const teamPlayers = (players?.[side] || []).filter((p) => p && p.role !== "manager");
  const lineup = sport?.[side === "home" ? "homeLineup" : "awayLineup"] || [];
  const lineupIds = new Set(lineup.map((entry) => String(entry?.playerId || "")));

  const onField = [];
  const onBench = [];

  teamPlayers.forEach((p, index) => {
    const id = String(p._id || p.id || "");
    const entry = {
      id,
      name: pName(p),
      jerseyNumber: p.jerseyNumber,
      position: lineup.find((l) => String(l.playerId) === id)?.position || "",
    };
    const isBench = lineupIds.size > 0 ? !lineupIds.has(id) : index >= 15;
    if (isBench) onBench.push(entry);
    else onField.push(entry);
  });

  return { onField, onBench, teamId: side === "home" ? homeTeamId : awayTeamId };
}

export function buildRugbyKickoffLineupDraft(sport, players, homeTeamId, awayTeamId) {
  const toIds = (side) =>
    getRugbyStartingSquads(sport, players, side, homeTeamId, awayTeamId).onField.map((p) => p.id);
  return {
    home: { onFieldIds: toIds("home") },
    away: { onFieldIds: toIds("away") },
  };
}

function squadsFromDraft(draft, side, players, sport, homeTeamId, awayTeamId) {
  const roster = (players?.[side] || []).filter((p) => p && p.role !== "manager");
  const onFieldSet = new Set((draft?.[side]?.onFieldIds || []).map(String));
  const lineup = sport?.[side === "home" ? "homeLineup" : "awayLineup"] || [];

  const onField = [];
  const onBench = [];

  roster.forEach((p, index) => {
    const id = String(p._id || p.id || "");
    if (!id) return;
    const entry = {
      id,
      name: pName(p),
      jerseyNumber: p.jerseyNumber,
      position: lineup.find((l) => String(l.playerId) === id)?.position || p?.position || "",
    };
    if (onFieldSet.has(id)) onField.push(entry);
    else onBench.push(entry);
  });

  onField.sort((a, b) => {
    const ai = draft[side].onFieldIds.indexOf(a.id);
    const bi = draft[side].onFieldIds.indexOf(b.id);
    return ai - bi;
  });

  return { onField, onBench };
}

function RugbyLineupListRow({ player, actionLabel, actionIcon, onAction, actionDisabled }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
      }}
    >
      <Text style={{ width: 28, fontSize: 12, fontWeight: "900", color: "#9CA3AF" }}>
        {player.jerseyNumber != null && player.jerseyNumber !== "" ? player.jerseyNumber : "—"}
      </Text>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#dfe1f9" }} numberOfLines={1}>
        {player.name}
      </Text>
      <TouchableOpacity
        onPress={onAction}
        disabled={actionDisabled}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: actionDisabled ? "rgba(255,255,255,0.04)" : "rgba(71,254,183,0.12)",
          borderWidth: 1,
          borderColor: actionDisabled ? "rgba(255,255,255,0.06)" : "rgba(71,254,183,0.3)",
          opacity: actionDisabled ? 0.45 : 1,
        }}
      >
        <Ionicons name={actionIcon} size={14} color={actionDisabled ? "#6B7280" : "#47feb7"} />
        <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: "800", color: actionDisabled ? "#6B7280" : "#6ee7b7" }}>
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function RugbyLineupSetupModal({
  visible,
  onClose,
  sport,
  players,
  teamNames,
  homeTeamId,
  awayTeamId,
  manageableSides = ["home", "away"],
  onLineupChange,
}) {
  const sides = useMemo(
    () => ["home", "away"].filter((side) => manageableSides.includes(side)),
    [manageableSides],
  );

  const [draft, setDraft] = useState(() =>
    buildRugbyKickoffLineupDraft(sport, players, homeTeamId, awayTeamId),
  );
  const [activeSide, setActiveSide] = useState(sides[0] || "home");
  const wasVisibleRef = useRef(false);

  // Reset only when the modal opens — not when lineup saves refetch sport data.
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setDraft(buildRugbyKickoffLineupDraft(sport, players, homeTeamId, awayTeamId));
      setActiveSide(sides[0] || "home");
    }
    wasVisibleRef.current = visible;
  }, [visible, sport, players, homeTeamId, awayTeamId, sides]);

  useEffect(() => {
    if (!sides.includes(activeSide)) {
      setActiveSide(sides[0] || "home");
    }
  }, [activeSide, sides]);

  const moveToBench = useCallback(
    (side, playerId) => {
      setDraft((prev) => {
        const ids = (prev[side]?.onFieldIds || [])
          .map(String)
          .filter((id) => id && id !== String(playerId));
        onLineupChange?.(side, ids);
        return { ...prev, [side]: { onFieldIds: ids } };
      });
    },
    [onLineupChange],
  );

  const moveToField = useCallback(
    (side, playerId) => {
      setDraft((prev) => {
        const current = (prev[side]?.onFieldIds || []).map(String).filter(Boolean);
        if (current.length >= RUGBY_ON_FIELD_MAX) return prev;
        if (current.includes(String(playerId))) return prev;
        const ids = [...current, String(playerId)];
        onLineupChange?.(side, ids);
        return { ...prev, [side]: { onFieldIds: ids } };
      });
    },
    [onLineupChange],
  );

  if (!visible) return null;

  const squads = squadsFromDraft(draft, activeSide, players, sport, homeTeamId, awayTeamId);
  const fieldFull = squads.onField.length >= RUGBY_ON_FIELD_MAX;
  const teamLabel = activeSide === "home" ? teamNames?.home || "Home" : teamNames?.away || "Away";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: "#1a1d2e",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "88%",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <View style={{ padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>Who is on the pitch?</Text>
                <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6, lineHeight: 18 }}>
                  Choose up to {RUGBY_ON_FIELD_MAX} starters. Everyone else stays as a substitute.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {sides.length > 1 ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                {sides.map((side) => {
                  const selected = activeSide === side;
                  const label = side === "home" ? teamNames?.home || "Home" : teamNames?.away || "Away";
                  return (
                    <TouchableOpacity
                      key={side}
                      onPress={() => setActiveSide(side)}
                      style={{
                        flex: 1,
                        paddingVertical: 11,
                        borderRadius: 10,
                        alignItems: "center",
                        backgroundColor: selected ? (side === "home" ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.15)") : "#111423",
                        borderWidth: 1,
                        borderColor: selected ? (side === "home" ? "rgba(52,211,153,0.4)" : "rgba(99,102,241,0.4)") : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "900", color: selected ? (side === "home" ? "#34d399" : "#a5b4fc") : "#9CA3AF" }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#47feb7", marginTop: 14 }}>{teamLabel}</Text>
            )}
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={{ padding: 16, gap: 16 }}>
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: "rgba(52,211,153,0.35)",
                  backgroundColor: "rgba(52,211,153,0.06)",
                  overflow: "hidden",
                }}
              >
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(52,211,153,0.12)" }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#34d399" }}>
                    On the pitch ({squads.onField.length}/{RUGBY_ON_FIELD_MAX})
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    These players start the match
                  </Text>
                </View>
                {squads.onField.length > 0 ? (
                  squads.onField.map((player) => (
                    <RugbyLineupListRow
                      key={`field-${player.id}`}
                      player={player}
                      actionLabel="To subs"
                      actionIcon="arrow-down"
                      onAction={() => moveToBench(activeSide, player.id)}
                    />
                  ))
                ) : (
                  <Text style={{ padding: 16, fontSize: 12, color: "#6B7280", textAlign: "center" }}>
                    No starters yet. Add players from the substitutes list below.
                  </Text>
                )}
              </View>

              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                  backgroundColor: "#111423",
                  overflow: "hidden",
                }}
              >
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#dfe1f9" }}>
                    Substitutes ({squads.onBench.length})
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    Tap To pitch to add a starter
                    {fieldFull ? " — pitch is full" : ""}
                  </Text>
                </View>
                {squads.onBench.length > 0 ? (
                  squads.onBench.map((player) => (
                    <RugbyLineupListRow
                      key={`bench-${player.id}`}
                      player={player}
                      actionLabel="To pitch"
                      actionIcon="arrow-up"
                      actionDisabled={fieldFull}
                      onAction={() => moveToField(activeSide, player.id)}
                    />
                  ))
                ) : (
                  <Text style={{ padding: 16, fontSize: 12, color: "#6B7280", textAlign: "center" }}>
                    All squad players are on the pitch.
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={{ padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: "#47feb7",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#0f172a" }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function RugbyScoreboardCard({
  sport = {},
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  displayOnly = false,
  isUpdating,
  gameOver,
  isScheduled = false,
  isOwner = false,
  onPauseResume,
  onEndGame,
  onStartGame,
}) {
  const homeScore   = sport?.homeScore ?? 0;
  const awayScore   = sport?.awayScore ?? 0;
  const homeTries   = sport?.homeTries ?? 0;
  const awayTries   = sport?.awayTries ?? 0;
  const homeConv    = sport?.homeConversions ?? 0;
  const awayConv    = sport?.awayConversions ?? 0;
  const homePen     = sport?.homePenaltyGoals ?? 0;
  const awayPen     = sport?.awayPenaltyGoals ?? 0;
  const homeDG      = sport?.homeDropGoals ?? 0;
  const awayDG      = sport?.awayDropGoals ?? 0;
  const homePenC    = sport?.matchStats?.penalties_conceded?.home ?? 0;
  const awayPenC    = sport?.matchStats?.penalties_conceded?.away ?? 0;
  const homeYC      = sport?.matchStats?.yellow_cards?.home ?? 0;
  const awayYC      = sport?.matchStats?.yellow_cards?.away ?? 0;
  const homeRC      = sport?.matchStats?.red_cards?.home ?? 0;
  const awayRC      = sport?.matchStats?.red_cards?.away ?? 0;
  const currentHalf = sport?.currentHalf ?? 1;
  const halfLabel   = currentHalf === 1 ? "1ST" : currentHalf === 2 ? "2ND" : currentHalf === 3 ? "ET1" : "ET2";

  // Active sin-bin players — cards with a sinBinUntil timestamp still in the future
  const now = Date.now();
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasSinBin = (sport?.cards || []).some(
      (c) => c?.cardType === "yellow" && c?.sinBinUntil && new Date(c.sinBinUntil).getTime() > now
    );
    if (!hasSinBin) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sport?.cards]);

  const activeSinBin = (sport?.cards || []).filter(
    (c) => c?.cardType === "yellow" && c?.sinBinUntil && new Date(c.sinBinUntil).getTime() > Date.now()
  );

  const hasCards = homeYC > 0 || awayYC > 0 || homeRC > 0 || awayRC > 0;

  return (
    <View style={{ backgroundColor: "#1a1d2e", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(71,254,183,0.15)", overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", backgroundColor: "#47feb7" }} />
      <View style={{ position: "absolute", top: 0, right: 0, width: 3, height: "100%", backgroundColor: "#b8c3ff" }} />

      {/* Team names + half */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#47feb7", maxWidth: "30%" }} numberOfLines={1}>
          {teamNames.home}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 4, color: "#9CA3AF", textTransform: "uppercase" }}>
          {halfLabel} HALF
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#b8c3ff", maxWidth: "30%", textAlign: "right" }} numberOfLines={1}>
          {teamNames.away}
        </Text>
      </View>

      {/* Scores + clock */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 56, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 64, minWidth: 70, textAlign: "center" }}>
          {String(homeScore).padStart(2, "0")}
        </Text>

        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#0d101f", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
            <Text style={{ fontSize: 28, fontWeight: "900", fontFamily: "monospace", letterSpacing: 4, color: "#47feb7" }}>
              {fmtTime(gameTime?.minutes ?? 0, gameTime?.seconds ?? 0)}
            </Text>
          </View>
          {isScheduled && isOwner && (
            <TouchableOpacity
              onPress={onStartGame}
              disabled={isUpdating}
              style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, opacity: isUpdating ? 0.5 : 1 }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>▶ Start Game</Text>
            </TouchableOpacity>
          )}
          {!isScheduled && !displayOnly && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={onPauseResume}
                disabled={gameOver || isUpdating}
                style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, backgroundColor: "rgba(71,254,183,0.1)", borderWidth: 1, borderColor: "rgba(71,254,183,0.3)" }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: "#47feb7", letterSpacing: 1, textTransform: "uppercase" }}>
                  {gameTime?.isRunning ? "Pause" : "Resume"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (gameTime?.isRunning && onPauseResume) onPauseResume();
                  onEndGame();
                }}
                disabled={gameOver}
                style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4, backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: "#f87171", letterSpacing: 1, textTransform: "uppercase" }}>End</Text>
              </TouchableOpacity>
            </View>
          )}
          {isScheduled && !isOwner && (
            <Text style={{ color: "#6B7280", fontSize: 10 }}>⏳ Waiting for coach</Text>
          )}
        </View>

        <Text style={{ fontSize: 56, fontWeight: "900", color: "#dfe1f9", letterSpacing: -2, lineHeight: 64, minWidth: 70, textAlign: "center" }}>
          {String(awayScore).padStart(2, "0")}
        </Text>
      </View>

      {/* Stat bar: Tries · Conversions · Penalty Goals */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
        {[
          { label: "T",    home: homeTries, away: awayTries },
          { label: "C",    home: homeConv,  away: awayConv },
          { label: "PG",   home: homePen,   away: awayPen },
          { label: "DG",   home: homeDG,    away: awayDG },
          { label: "PEN",  home: homePenC,  away: awayPenC },
        ].map(stat => (
          <View key={stat.label} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{stat.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#dfe1f9" }}>
              <Text style={{ color: "#47feb7" }}>{stat.home}</Text>
              <Text style={{ color: "#6B7280" }}> – </Text>
              <Text style={{ color: "#b8c3ff" }}>{stat.away}</Text>
            </Text>
          </View>
        ))}
      </View>

      {/* Card indicators — yellow and red cards per team */}
      {hasCards && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          {/* Home cards */}
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            {homeYC > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <View style={{ width: 9, height: 13, backgroundColor: "#eab308", borderRadius: 2 }} />
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#fde047" }}>×{homeYC}</Text>
              </View>
            )}
            {homeRC > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <View style={{ width: 9, height: 13, backgroundColor: "#ef4444", borderRadius: 2 }} />
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#f87171" }}>×{homeRC}</Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 8, color: "#6B7280", fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>CARDS</Text>

          {/* Away cards */}
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            {awayYC > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#fde047" }}>×{awayYC}</Text>
                <View style={{ width: 9, height: 13, backgroundColor: "#eab308", borderRadius: 2 }} />
              </View>
            )}
            {awayRC > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#f87171" }}>×{awayRC}</Text>
                <View style={{ width: 9, height: 13, backgroundColor: "#ef4444", borderRadius: 2 }} />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Active sin-bin timers */}
      {activeSinBin.length > 0 && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(234,179,8,0.2)", gap: 4 }}>
          {activeSinBin.map((card, idx) => {
            const remaining = Math.max(0, Math.ceil((new Date(card.sinBinUntil).getTime() - Date.now()) / 1000));
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            return (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 11, backgroundColor: "#eab308", borderRadius: 1 }} />
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#fde047", flex: 1 }} numberOfLines={1}>
                  Sin Bin
                </Text>
                <Text style={{ fontSize: 10, fontWeight: "900", color: "#eab308", fontFamily: "monospace" }}>
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function RugbyPossessionBar({
  currentGame,
  teamNames,
  players = { home: [], away: [] },
  onEvent,
  onLineupChange,
  manageableSides = ["home", "away"],
  disabled,
}) {
  const [showLineupSetup, setShowLineupSetup] = useState(false);
  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const isLive = base?.status === "live";
  const homeTeamId = base?.teamId;
  const awayTeamId = base?.opponentTeamId;
  const possessionTeamId = sport?.possessionTeam || null;
  const homeName = teamNames?.home || "Home";
  const awayName = teamNames?.away || "Away";
  const canEditLineup = typeof onLineupChange === "function" && manageableSides.length > 0;

  const possessionLabel = possessionTeamId === homeTeamId ? homeName
    : possessionTeamId === awayTeamId ? awayName : null;
  const defendingLabel = possessionTeamId === homeTeamId ? awayName
    : possessionTeamId === awayTeamId ? homeName : null;

  const handleSwap = () => {
    if (disabled) return;
    const newSide = possessionTeamId === homeTeamId ? "away" : "home";
    onEvent("possession_change", newSide, undefined);
  };

  if (!isLive) return null;

  if (!possessionLabel && !disabled) {
    return (
      <>
        <Modal visible transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <View
              style={{
                backgroundColor: "#1a1d2e",
                borderRadius: 20,
                width: "100%",
                maxWidth: 380,
                padding: 24,
                borderWidth: 1,
                borderColor: "rgba(71,254,183,0.25)",
              }}
            >
              <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🏉</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 }}>
                Who kicks off?
              </Text>
              <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
                Select the team that starts with the ball.
              </Text>

              <TouchableOpacity
                onPress={() => onEvent("possession_change", "home")}
                style={{
                  paddingVertical: 18,
                  marginBottom: 12,
                  backgroundColor: "rgba(52,211,153,0.15)",
                  borderRadius: 14,
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: "#34d399",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#34d399" }}>{homeName}</Text>
                <Text style={{ fontSize: 12, color: "#6ee7b7", marginTop: 4 }}>Kicks off</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onEvent("possession_change", "away")}
                style={{
                  paddingVertical: 18,
                  backgroundColor: "rgba(99,102,241,0.15)",
                  borderRadius: 14,
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: "#818cf8",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#a5b4fc" }}>{awayName}</Text>
                <Text style={{ fontSize: 12, color: "#c7d2fe", marginTop: 4 }}>Kicks off</Text>
              </TouchableOpacity>

              {canEditLineup ? (
                <TouchableOpacity
                  onPress={() => setShowLineupSetup(true)}
                  style={{
                    marginTop: 20,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#9CA3AF" }}>
                    Need to change who is on the pitch?
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#47feb7", marginTop: 4 }}>
                    Edit starting players
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>

        {canEditLineup ? (
          <RugbyLineupSetupModal
            visible={showLineupSetup}
            onClose={() => setShowLineupSetup(false)}
            sport={sport}
            players={players}
            teamNames={teamNames}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            manageableSides={manageableSides}
            onLineupChange={onLineupChange}
          />
        ) : null}
      </>
    );
  }

  if (!possessionLabel) return null;

  return (
    <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#2a2d40", backgroundColor: "#131627" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(16,185,129,0.1)", borderRightWidth: 1, borderRightColor: "#2a2d40" }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399" }} />
          <View>
            <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 4, color: "rgba(52,211,153,0.7)" }}>POSSESSION</Text>
            <Text style={{ fontSize: 13, fontWeight: "900", color: "#6ee7b7", textTransform: "uppercase", letterSpacing: 2 }}>{possessionLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSwap} disabled={disabled} style={{ paddingHorizontal: 12, paddingVertical: 12, opacity: disabled ? 0.4 : 1 }}>
          <Ionicons name="swap-horizontal" size={20} color="#6B7280" />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(239,68,68,0.05)" }}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: 4, color: "rgba(248,113,113,0.5)" }}>DEFENDING</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 2 }}>{defendingLabel}</Text>
          </View>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(248,113,113,0.4)" }} />
        </View>
      </View>
    </View>
  );
}

function RugbyScoringPanelMobile({
  currentGame,
  players = { home: [], away: [] },
  teamNames = { home: "Home", away: "Away" },
  gameTime,
  isUpdating,
  onEvent,
  onSubstitution,
  gameOver,
  displayOnly = false,
  isScoringTab = false,
  userSide = "home",
  onEndGame,
  onPauseResume,
  onStartGame,
  isScheduled = false,
  isOwner = false,
  hideScoreboard = false,
  isSelfOwnedOpponent = false,
}) {
  const [showConversionPrompt, setShowConversionPrompt] = useState(false);
  const [conversionSide, setConversionSide] = useState(null);
  const conversionTimerRef = useRef(null);

  // ── Sin-bin tick: forces a re-render every second while sin bins are active ──
  // The actual sin-bin data is derived from derivedGame.sport.cards (canonical).
  const [, setSinBinTick] = useState(0);

  // ── Player selection ───────────────────────────────────────────────────────
  const [pendingEvent, setPendingEvent] = useState(null);
  // pendingEvent shape: { eventType, side, afterTry? }

  // ── Substitution modal ────────────────────────────────────────────────────
  const [showSubstitution, setShowSubstitution] = useState(false);

  const sport = currentGame?.sport;
  const base = currentGame?.base;
  const isLive = base?.status === "live";
  const userIsHome = userSide === "home";

  const homeTeamId = base?.teamId;
  const awayTeamId = base?.opponentTeamId;
  const possessionTeamId = sport?.possessionTeam || null;
  const activeSide = isSelfOwnedOpponent
    ? (
        possessionTeamId === homeTeamId
          ? "home"
          : possessionTeamId === awayTeamId
            ? "away"
            : userSide
      )
    : userSide;

  const homeScore = sport?.homeScore || 0;
  const awayScore = sport?.awayScore || 0;
  const homeTries = sport?.homeTries || 0;
  const awayTries = sport?.awayTries || 0;
  const currentHalf = sport?.currentHalf || 1;

  const disabled = gameOver;
  const homeName = teamNames.home;
  const awayName = teamNames.away;
  const possessionLabel =
    possessionTeamId === homeTeamId
      ? homeName
      : possessionTeamId === awayTeamId
        ? awayName
        : null;
  const defendingLabel =
    possessionTeamId === homeTeamId
      ? awayName
      : possessionTeamId === awayTeamId
        ? homeName
        : null;
  const activeTeamName = activeSide === "home" ? homeName : awayName;
  const controlledTeamName = userSide === "home" ? homeName : awayName;

  const allEvents = (sport?.events || []).filter(
    (e) => e != null && typeof e === "object",
  );

  // Stable key for the sin-bin interval (changes only when yellow cards are added/removed/expired).
  // Using a string key avoids triggering the effect on every derivedGame reference change.
  const sinBinKey = (sport?.cards || [])
    .filter(c => c?.cardType === "yellow" && c?.sinBinUntil)
    .map(c => `${c.playerId}:${c.sinBinUntil}`)
    .join(",");

  // Start a 1-second interval while any player is serving a sin bin.
  // The interval simply bumps a counter so React re-renders and recomputes
  // activeSinBin with a fresh Date.now().
  useEffect(() => {
    if (!sinBinKey) return;
    const id = setInterval(() => setSinBinTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [sinBinKey]);

  // All players flat list (memoized for sin-bin derivation below)
  const allPlayersList = useMemo(
    () => [...(players?.home || []), ...(players?.away || [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players?.home, players?.away]
  );

  // Active sin bin entries derived purely from derivedGame.sport.cards.
  // This is the canonical source — instant on optimistic dispatch, correct on undo.
  const activeSinBin = (sport?.cards || [])
    .filter(c => c?.cardType === "yellow" && c?.sinBinUntil && new Date(c.sinBinUntil).getTime() > Date.now())
    .map(c => {
      const remaining = Math.max(0, new Date(c.sinBinUntil).getTime() - Date.now());
      const p = allPlayersList.find(pl => String(pl._id || pl.id) === String(c.playerId));
      const teamSide = String(c.teamId) === String(homeTeamId) ? "home" : "away";
      return {
        id: `${c.playerId}-${String(c.timestamp || "")}`,
        playerId: c.playerId,
        playerName: p ? (`${p.firstName || ""} ${p.lastName || ""}`).trim() || "Player" : "Player",
        teamSide,
        remaining,
      };
    });

  useEffect(() => {
    if (showConversionPrompt) {
      conversionTimerRef.current = setTimeout(() => {
        setShowConversionPrompt(false);
        setConversionSide(null);
      }, 30000);
    }
    return () => clearTimeout(conversionTimerRef.current);
  }, [showConversionPrompt]);

  const getRepPlayer = (side) => {
    const tp = players?.[side] || [];
    return tp[0]?._id || tp[0]?.id || undefined;
  };

  // Players list excluding managers
  const getTeamPlayers = (side) =>
    (players?.[side] || []).filter((p) => p && p.role !== "manager");

  const getPlayerStatus = (playerId, side) => {
    const teamId = side === "home" ? homeTeamId : awayTeamId;
    const pid = String(playerId);

    const redCarded = (sport?.cards || []).some(
      c => String(c.playerId) === pid && c.cardType === "red"
    );
    if (redCarded) return "red_card";

    // Sin bin: time-gated by sinBinUntil from derivedGame.sport.cards (canonical).
    // Date.now() is fresh because sinBinTick forces re-render every second.
    const isSinBinned = (sport?.cards || []).some(
      c => String(c.playerId) === pid &&
           c.cardType === "yellow" &&
           c.sinBinUntil &&
           new Date(c.sinBinUntil).getTime() > Date.now()
    );
    if (isSinBinned) return "sin_bin";

    const teamSubs = (sport?.substitutions || []).filter(
      s => String(s.teamId) === String(teamId)
    );
    const subbedOut = teamSubs.some(s => String(s.playerOut) === pid);
    const subbedIn = teamSubs.some(s => String(s.playerIn) === pid);
    if (subbedOut && !subbedIn) return "substituted";

    const lineup = sport?.[side === "home" ? "homeLineup" : "awayLineup"] || [];
    const lineupIds = new Set(lineup.map(l => String(l.playerId)));

    if (lineupIds.size > 0) {
      if (!lineupIds.has(pid) && !subbedIn) return "bench";
    } else {
      const teamPlayers = (players?.[side] || []).filter(p => p && p.role !== "manager");
      const playerIndex = teamPlayers.findIndex(p => String(p._id || p.id) === pid);
      if (playerIndex >= 15 && !subbedIn) return "bench";
    }

    return "active";
  };

  // Submit the pending event with the chosen player.
  // Pass the playerId as-is: a real ID string, or null when the user skipped.
  // null signals the handler to use team name in AI commentary.
  const submitEvent = (playerId) => {
    if (!pendingEvent) return;
    const { eventType, side, afterTry } = pendingEvent;
    setPendingEvent(null);
    onEvent(eventType, side, playerId);
    if (afterTry) {
      setConversionSide(side);
      setShowConversionPrompt(true);
    }
    // Note: yellow_card sin bin is derived from derivedGame.sport.cards.
    // The sinBinUntil timestamp is included in the event payload by LiveRugbyScoringPanel
    // so applyOptimisticRugbyUpdate adds the card immediately — no local timer state needed.
  };

  // Open player picker instead of firing directly
  const handleEventPress = (eventType, side, opts = {}) => {
    if (disabled) return;
    setPendingEvent({ eventType, side, ...opts });
  };

  const handleTryScored = () => {
    if (disabled) return;
    handleEventPress("try", activeSide, { afterTry: true });
  };

  const handleConversionKick = (success) => {
    setShowConversionPrompt(false);
    if (!disabled) {
      handleEventPress(
        success ? "conversion" : "conversion_missed",
        conversionSide || activeSide,
      );
    }
    setConversionSide(null);
  };

  const handleSwapPossession = () => {
    if (disabled) return;
    const newSide = possessionTeamId === homeTeamId ? "away" : "home";
    onEvent("possession_change", newSide, undefined);
  };

  const getSubstitutionData = () => {
    const side = activeSide;
    const teamPlayers = (players?.[side] || []).filter(p => p && p.role !== "manager");
    const lineup = sport?.[side === "home" ? "homeLineup" : "awayLineup"] || [];
    const teamId = side === "home" ? homeTeamId : awayTeamId;
    const teamSubs = (sport?.substitutions || []).filter(
      s => String(s.teamId) === String(teamId)
    );

    const activeLineup = teamPlayers
      .filter(p => getPlayerStatus(p._id || p.id, side) === "active")
      .map(p => ({
        id: p._id || p.id,
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        jerseyNumber: p.jerseyNumber,
        position: lineup.find(l => String(l.playerId) === String(p._id || p.id))?.position || "",
      }));

    const bench = teamPlayers
      .filter(p => getPlayerStatus(p._id || p.id, side) === "bench")
      .map(p => ({
        id: p._id || p.id,
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        jerseyNumber: p.jerseyNumber,
      }));

    return {
      lineup: activeLineup,
      bench,
      teamName: side === "home" ? homeName : awayName,
      subsUsed: teamSubs.length,
      subsRemaining: 8 - teamSubs.length,
    };
  };

  const getEventBadge = (type) => {
    const map = {
      try: { label: "+5", bg: "#059669" },
      maul_try: { label: "+5", bg: "#059669" },
      penalty_try: { label: "+7", bg: "#dc2626" },
      conversion: { label: "+2", bg: "#3b82f6" },
      conversion_missed: { label: "×", bg: "#6B7280" },
      penalty_goal: { label: "+3", bg: "#6366f1" },
      drop_goal: { label: "+3", bg: "#0891b2" },
      yellow_card: { label: "YC", bg: "#eab308" },
      red_card: { label: "RC", bg: "#dc2626" },
      scrum: { label: "SC", bg: "#ea580c" },
      lineout: { label: "LO", bg: "#0891b2" },
      foul: { label: "PEN", bg: "#b91c1c" },
      penalty_conceded: { label: "PEN", bg: "#b91c1c" },
    };
    return map[type] || { label: "•", bg: "#4B5563" };
  };

  const getEventCount = (sideId, type) =>
    allEvents.filter(
      (e) =>
        String(e.teamId) === String(sideId) &&
        (e.eventType === type || e.action === type),
    ).length;

  const getPlayerShort = (playerId) => {
    if (!playerId) return "—";
    const all = [...(players?.home || []), ...(players?.away || [])];
    const p = all.find((pl) => String(pl._id || pl.id) === String(playerId));
    return p ? `${p.firstName?.[0] || ""}. ${p.lastName || ""}` : "Team";
  };

  // ── displayOnly / Scorecard: Match Stats Board + Events Log ──
  if (displayOnly && !isScoringTab) {
    return (
      <View style={{ width: "100%" }}>
        {/* Match Stats Board */}
        <View
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(16,185,129,0.2)",
            backgroundColor: "#0a2e1a",
            marginBottom: 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: "rgba(16,185,129,0.15)",
              borderBottomWidth: 1,
              borderBottomColor: "rgba(16,185,129,0.1)",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: 4,
                color: "#34d399",
              }}
            >
              MATCH STATS
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 3,
                color: "rgba(16,185,129,0.5)",
              }}
            >
              HALF {currentHalf <= 2 ? (currentHalf === 1 ? "1st" : "2nd") : `ET${currentHalf - 2}`}
            </Text>
          </View>
          {/* Column Headers */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 4,
              paddingVertical: 6,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.04)",
            }}
          >
            <Text
              style={{
                flex: 1.5,
                fontSize: 9,
                fontWeight: "700",
                color: "#6B7280",
                paddingLeft: 16,
              }}
            >
              TEAM
            </Text>
            <Text
              style={{
                width: 30,
                fontSize: 9,
                fontWeight: "700",
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              TRY
            </Text>
            <Text
              style={{
                width: 40,
                fontSize: 9,
                fontWeight: "700",
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              CONV
            </Text>
            <Text
              style={{
                width: 30,
                fontSize: 9,
                fontWeight: "700",
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              PEN
            </Text>
            <Text
              style={{
                width: 40,
                fontSize: 9,
                fontWeight: "700",
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              DROP
            </Text>
            <Text
              style={{
                width: 42,
                fontSize: 9,
                fontWeight: "700",
                color: "#ca8a04",
                textAlign: "center",
              }}
            >
              TOT
            </Text>
          </View>
          {/* Team rows */}
          {[
            {
              name: homeName,
              id: homeTeamId,
              tries: homeTries,
              score: homeScore,
            },
            {
              name: awayName,
              id: awayTeamId,
              tries: awayTries,
              score: awayScore,
            },
          ].map((team, idx) => {
            const isUser =
              (String(team.id) === String(homeTeamId) && userIsHome) ||
              (String(team.id) === String(awayTeamId) && !userIsHome);
            const conv = getEventCount(team.id, "conversion");
            const pen = getEventCount(team.id, "penalty_goal");
            const drop = getEventCount(team.id, "drop_goal");
            return (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 4,
                  borderBottomWidth: idx === 0 ? 1 : 0,
                  borderBottomColor: "rgba(255,255,255,0.04)",
                }}
              >
                <View
                  style={{
                    flex: 1.5,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: 10,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: isUser ? "#fff" : "#9CA3AF",
                    }}
                    numberOfLines={1}
                  >
                    {team.name}
                  </Text>
                </View>
                <Text
                  style={{
                    width: 30,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#34d399",
                  }}
                >
                  {team.tries || 0}
                </Text>
                <Text
                  style={{
                    width: 40,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#9CA3AF",
                  }}
                >
                  {conv || 0}
                </Text>
                <Text
                  style={{
                    width: 30,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#9CA3AF",
                  }}
                >
                  {pen || 0}
                </Text>
                <Text
                  style={{
                    width: 40,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#9CA3AF",
                  }}
                >
                  {drop || 0}
                </Text>
                <Text
                  style={{
                    width: 42,
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: "900",
                    color: isUser ? "#34d399" : "#f87171",
                  }}
                >
                  {team.score}
                </Text>
              </View>
            );
          })}
          {/* Footer */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "rgba(0,0,0,0.25)",
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.04)",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(16,185,129,0.1)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: "rgba(52,211,153,0.7)",
                }}
              >
                🏉 Rugby
              </Text>
            </View>
            {isLive ? (
              <View
                style={{
                  backgroundColor: "rgba(16,185,129,0.1)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#34d399",
                  }}
                />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "900",
                    letterSpacing: 3,
                    color: "#34d399",
                    textTransform: "uppercase",
                  }}
                >
                  LIVE
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "900",
                    letterSpacing: 3,
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                  }}
                >
                  SCHEDULED
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Event Log */}
        {allEvents.length > 0 && (
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 1,
                  backgroundColor: "rgba(107,114,128,0.5)",
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 4,
                  color: "#9CA3AF",
                }}
              >
                Match Events
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: "rgba(255,255,255,0.05)",
                }}
              />
            </View>
            <View style={{ gap: 6 }}>
              {allEvents
                .slice(-10)
                .reverse()
                .map((e, i) => {
                  if (!e) return null;
                  const badge = getEventBadge(e.eventType || e.action);
                  const eIsHome = String(e.teamId) === String(homeTeamId);
                  const eIsUser = userIsHome ? eIsHome : !eIsHome;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: eIsUser
                          ? "rgba(5,150,105,0.05)"
                          : "rgba(239,68,68,0.05)",
                        borderWidth: 1,
                        borderColor: eIsUser
                          ? "rgba(5,150,105,0.1)"
                          : "rgba(239,68,68,0.1)",
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 20,
                          borderRadius: 4,
                          backgroundColor: badge.bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "700",
                            color: "#fff",
                          }}
                        >
                          {badge.label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: "#D1D5DB",
                          fontWeight: "600",
                          fontSize: 11,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {getPlayerShort(e?.playerId)}
                      </Text>
                      <Text
                        style={{
                          color: "#6B7280",
                          fontSize: 9,
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: 2,
                        }}
                      >
                        {(e.eventType || e.action || "").replace(/_/g, " ")}
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

  // ── Scoring Tab / Main Scoring Panel ──
  return (
    <View style={{ width: "100%" }}>
      {/* ═══ SCOREBOARD ═══ */}
      {!hideScoreboard && (
        <View style={{ marginBottom: 16 }}>
          <RugbyScoreboardCard
            sport={sport}
            teamNames={teamNames}
            gameTime={gameTime}
            displayOnly={displayOnly}
            isUpdating={isUpdating}
            gameOver={gameOver}
            isScheduled={isScheduled}
            isOwner={isOwner}
            onPauseResume={onPauseResume}
            onEndGame={onEndGame}
            onStartGame={onStartGame}
          />
        </View>
      )}

      {/* ═══ ON-FIELD PLAYER COUNT ═══ */}
      {/* {isLive && !displayOnly && (() => {
        const homeOnField = getTeamPlayers("home").filter(p => getPlayerStatus(p._id || p.id, "home") === "active").length;
        const awayOnField = getTeamPlayers("away").filter(p => getPlayerStatus(p._id || p.id, "away") === "active").length;
        if (homeOnField >= 15 && awayOnField >= 15) return null;
        return (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 4 }}>
            {[
              { label: homeName, count: homeOnField, side: "home" },
              { label: awayName, count: awayOnField, side: "away" },
            ].filter(t => t.count < 15).map(t => (
              <View key={t.side} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.count <= 13 ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Ionicons name="people" size={12} color={t.count <= 13 ? "#f87171" : "#facc15"} />
                <Text style={{ fontSize: 10, fontWeight: "800", color: t.count <= 13 ? "#f87171" : "#facc15" }}>
                  {t.label}: {t.count}/15
                </Text>
              </View>
            ))}
          </View>
        );
      })()} */}

      {/* ═══ SIN BIN TIMERS ═══ */}
      {activeSinBin.length > 0 && (
        <View style={{ marginBottom: 12, gap: 6 }}>
          {activeSinBin.map(timer => {
            const mins = Math.floor(timer.remaining / 60000);
            const secs = Math.floor((timer.remaining % 60000) / 1000);
            const pct = Math.max(0, timer.remaining / 600000);
            return (
              <View key={timer.id} style={{ backgroundColor: "rgba(234,179,8,0.1)", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "rgba(234,179,8,0.25)" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 14, height: 20, borderRadius: 2, backgroundColor: "#facc15" }} />
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#facc15" }}>SIN BIN</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#d1d5db" }}>{timer.playerName}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "900", fontFamily: "monospace", color: "#facc15" }}>
                    {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                  </Text>
                </View>
                <View style={{ height: 3, backgroundColor: "rgba(234,179,8,0.15)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${pct * 100}%`, backgroundColor: "#facc15", borderRadius: 2 }} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ═══ SCORING CONTROLS ═══ */}
      {isLive && !displayOnly && (
        <>

          {/* ── Player selection modal — floats above scroll position ── */}
          {pendingEvent && (() => {
            const { eventType, side } = pendingEvent;
            const teamPlayers = getTeamPlayers(side);
            const availablePlayers = [];
            const unavailablePlayers = [];
            teamPlayers.forEach(p => {
              const status = getPlayerStatus(p._id || p.id, side);
              if (status === "active") availablePlayers.push(p);
              else if (status !== "bench") unavailablePlayers.push({ ...p, _status: status });
            });
            const teamName = side === "home" ? homeName : awayName;
            const EVENT_LABELS = {
              try: "Try Scorer", conversion: "Conversion Kicker",
              conversion_missed: "Conversion Kicker", penalty_goal: "Penalty Kicker",
              drop_goal: "Drop Goal Scorer",
              yellow_card: "Yellow Card — Player",
              red_card: "Red Card — Player", penalty_conceded: "Penalty — Player",
              scrum: "Scrum — Player", lineout: "Lineout — Player",
              substitution: "Substitution — Player",
            };
            const label = EVENT_LABELS[eventType] || eventType.replace(/_/g, " ");
            return (
              <Modal visible transparent animationType="slide" onRequestClose={() => setPendingEvent(null)}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setPendingEvent(null)}
                  style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
                >
                  <TouchableOpacity activeOpacity={1}>
                    <View style={{ backgroundColor: "#1a1d2e", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: "rgba(71,254,183,0.2)" }}>
                      {/* Handle bar */}
                      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 16 }} />

                      {/* Header */}
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <View>
                          <Text style={{ fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 3, color: "#47feb7" }}>{teamName}</Text>
                          <Text style={{ fontSize: 15, fontWeight: "900", color: "#dfe1f9", textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>{label}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setPendingEvent(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={24} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      {/* Player grid */}
                      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 }}>
                          {availablePlayers.length > 0 ? availablePlayers.map((p) => (
                            <TouchableOpacity
                              key={p._id || p.id}
                              onPress={() => submitEvent(p._id || p.id)}
                              style={{ backgroundColor: "rgba(71,254,183,0.08)", borderWidth: 1, borderColor: "rgba(71,254,183,0.2)", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, width: "47%" }}
                            >
                              <Text style={{ color: "#dfe1f9", fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                                {p.jerseyNumber ? <Text style={{ color: "#47feb7" }}>#{p.jerseyNumber} </Text> : null}
                                {p.firstName} {p.lastName?.[0] ? `${p.lastName[0]}.` : ""}
                              </Text>
                            </TouchableOpacity>
                          )) : unavailablePlayers.length === 0 ? (
                            <Text style={{ color: "#6B7280", fontSize: 13, padding: 8 }}>No players listed for this team</Text>
                          ) : null}
                          {unavailablePlayers.map((p) => {
                            const statusLabel = p._status === "sin_bin" ? "SIN BIN" : p._status === "red_card" ? "RED CARD" : "SUBBED OFF";
                            const statusColor = p._status === "sin_bin" ? "#facc15" : p._status === "red_card" ? "#ef4444" : "#6B7280";
                            return (
                              <View
                                key={p._id || p.id}
                                style={{ backgroundColor: `${statusColor}11`, borderWidth: 1, borderColor: `${statusColor}22`, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, width: "47%", opacity: 0.5 }}
                              >
                                <Text style={{ color: statusColor, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                                  {p.jerseyNumber ? <Text>#{p.jerseyNumber} </Text> : null}
                                  {p.firstName} {p.lastName?.[0] ? `${p.lastName[0]}.` : ""}
                                </Text>
                                <Text style={{ color: statusColor, fontSize: 9, fontWeight: "600", marginTop: 2 }}>{statusLabel}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>

                      {/* Skip */}
                      <TouchableOpacity
                        onPress={() => submitEvent(null)}
                        style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                      >
                        <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 13 }}>Skip — use team name in commentary</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            );
          })()}

          {/* Conversion Prompt */}
          {showConversionPrompt ? (
            <View
              style={{
                backgroundColor: "rgba(49,52,70,0.8)",
                borderRadius: 12,
                padding: 24,
                borderLeftWidth: 4,
                borderLeftColor: "#47FEB7",
                marginBottom: 16,
              }}
            >
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 3,
                    color: "#dfe1f9",
                    marginTop: 4,
                  }}
                >
                  TRY SCORED!
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#bacbbf",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {activeTeamName} — Conversion Attempt?
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  onPress={() => handleConversionKick(true)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 20,
                    backgroundColor: "#01e19d",
                    borderRadius: 12,
                    alignItems: "center",
                    opacity: disabled ? 0.5 : 1,
                    borderWidth: 1,
                    borderColor: "#00c489",
                    ...raised3d("#009968"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: "#005e3f",
                    }}
                  >
                    ✓ CONVERTED (+2)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleConversionKick(false)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 20,
                    backgroundColor: "#26293b",
                    borderRadius: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(59,74,65,0.2)",
                    opacity: disabled ? 0.5 : 1,
                    ...raised3d("#1a1c2a"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      color: "#bacbbf",
                    }}
                  >
                    ✗ MISSED
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  clearTimeout(conversionTimerRef.current);
                  conversionTimerRef.current = setTimeout(() => {
                    setShowConversionPrompt(false);
                    setConversionSide(null);
                  }, 30000);
                }}
                style={{ marginTop: 10, alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7280" }}>Still kicking... (extend timer)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ROW 1: TRY +5 | PENALTY TRY +7 */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleTryScored}
                disabled={disabled}
                style={{
                  flex: 2,
                  paddingVertical: 32,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#47feb7",
                  opacity: disabled ? 0.5 : 1,
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.4)",
                  ...raised3d("#00b87a"),
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 4,
                    color: "black",
                    marginBottom: 2,
                  }}
                >
                  TRY
                </Text>
                <Text
                  style={{ fontSize: 54, fontWeight: "900", color: "#1f2937" }}
                >
                  +5
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => !disabled && onEvent("penalty_try", activeSide, null)}
                disabled={disabled}
                style={{
                  flex: 1,
                  paddingVertical: 32,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#1a1d30",
                  opacity: disabled ? 0.5 : 1,
                  borderWidth: 1,
                  borderColor: "rgba(239,68,68,0.3)",
                  ...raised3d("#0f1120"),
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "#f87171",
                    marginBottom: 2,
                  }}
                >
                  PENALTY
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    color: "#f87171",
                    marginBottom: 4,
                  }}
                >
                  TRY
                </Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "900", color: "#D1D5DB" }}
                >
                  +7
                </Text>
              </TouchableOpacity>
              </View>

              {/* ROW 2: PENALTY +3 | DROP GOAL +3 */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => handleEventPress("penalty_goal", activeSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 24,
                    backgroundColor: "#1a1d30",
                    borderRadius: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(55,65,81,0.4)",
                    opacity: disabled ? 0.5 : 1,
                    ...raised3d("#0f1120"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      color: "#9CA3AF",
                      marginBottom: 2,
                    }}
                  >
                    PENALTY
                  </Text>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color: "#D1D5DB",
                    }}
                  >
                    +3
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleEventPress("drop_goal", activeSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 24,
                    backgroundColor: "#1a1d30",
                    borderRadius: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(55,65,81,0.4)",
                    opacity: disabled ? 0.5 : 1,
                    ...raised3d("#0f1120"),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      color: "#9CA3AF",
                      marginBottom: 2,
                    }}
                  >
                    DROP GOAL
                  </Text>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color: "#D1D5DB",
                    }}
                  >
                    +3
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ROW 3: YELLOW CARD | RED CARD */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => handleEventPress("yellow_card", activeSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    backgroundColor: "#facc15",
                    borderRadius: 5,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor: "rgba(234,179,8,0.25)",
                    opacity: disabled ? 0.5 : 1,
                    ...raised3d("#ca8a04"),
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 11,
                      borderRadius: 2,
                      backgroundColor: "#facc15",
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      color: "#f1f0ed",
                    }}
                  >
                    YELLOW CARD
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleEventPress("red_card", activeSide)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    backgroundColor: "#f34040",
                    borderRadius: 5,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor: "rgba(239,68,68,0.25)",
                    opacity: disabled ? 0.5 : 1,
                    ...raised3d("#b91c1c"),
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 11,
                      borderRadius: 2,
                      backgroundColor: "#f34040",
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      color: "#efe4e4",
                    }}
                  >
                    RED CARD
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── MATCH EVENTS label ── */}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 4,
                  color: "#6B7280",
                  marginBottom: 12,
                }}
              >
                MATCH EVENTS
              </Text>

              {/* ROW 4: FOUL | SCRUM | LINEOUT | SUB */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                {[
                  { type: "penalty_conceded", label: "PENALTY", icon: "flag-outline" },
                  { type: "scrum", label: "SCRUM", icon: "ellipse-outline" },
                  { type: "lineout", label: "LINEOUT", icon: "build-outline" },
                  { type: "substitution", label: "SUB", icon: "swap-horizontal-outline", useSub: true },
                ].map((btn) => (
                  <TouchableOpacity
                    key={btn.type}
                    onPress={() => {
                      if (disabled) return;
                      if (btn.useSub && onSubstitution) {
                        const teamId = activeSide === "home" ? homeTeamId : awayTeamId;
                        const teamSubs = (sport?.substitutions || []).filter(
                          s => String(s.teamId) === String(teamId)
                        );
                        if (teamSubs.length >= 8) {
                          Alert.alert("Substitution Limit", "Maximum 8 substitutions already used for this team.");
                          return;
                        }
                        setShowSubstitution(true);
                      } else {
                        handleEventPress(btn.type, activeSide);
                      }
                    }}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      backgroundColor: "#1a1d30",
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor: "#2a2d40",
                      opacity: disabled ? 0.5 : 1,
                      ...raised3d("#0f1120"),
                    }}
                  >
                    <Ionicons name={btn.icon} size={20} color="#9CA3AF" />
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 2,
                        color: "#9CA3AF",
                      }}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ROW 5: HALF-TIME */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                {currentHalf === 1 ? (
                  <TouchableOpacity
                    onPress={() =>
                      !disabled && onEvent("second_half", activeSide)
                    }
                    disabled={disabled}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      backgroundColor: "#ffdacb",
                      borderRadius: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255,218,203,0.2)",
                      opacity: disabled ? 0.5 : 1,
                      ...raised3d("#f0a890"),
                    }}
                  >
                    <Text style={{ fontSize: 16, color: "#ffdacb" }}>⏸</Text>
                    <View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 3,
                          color: "#151211",
                          textAlign: "center",
                        }}
                      >
                        HALF-TIME
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 3,
                          color: "#130f0d",
                          textAlign: "center",
                        }}
                      >
                        BREAK
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : currentHalf === 2 ? (
                  <TouchableOpacity
                    onPress={() =>
                      !disabled && onEvent("extra_time", activeSide)
                    }
                    disabled={disabled}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      backgroundColor: "#ffdacb",
                      borderRadius: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255,218,203,0.2)",
                      opacity: disabled ? 0.5 : 1,
                      ...raised3d("#f0a890"),
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: 3,
                          color: "#151211",
                          textAlign: "center",
                        }}
                      >
                        2ND HALF
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: "#6B7280",
                          textAlign: "center",
                          marginTop: 2,
                        }}
                      >
                        Tap for Extra Time
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : currentHalf === 3 ? (
                  <TouchableOpacity
                    onPress={() =>
                      !disabled && onEvent("extra_time_2", activeSide)
                    }
                    disabled={disabled}
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      backgroundColor: "#ffdacb",
                      borderRadius: 5,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255,218,203,0.2)",
                      opacity: disabled ? 0.5 : 1,
                      ...raised3d("#f0a890"),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "900",
                        textTransform: "uppercase",
                        letterSpacing: 3,
                        color: "#151211",
                      }}
                    >
                      ET1
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#6B7280",
                        textAlign: "center",
                        marginTop: 2,
                      }}
                    >
                      Tap for ET2
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      backgroundColor: "#ffdacb",
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(42,45,64,0.5)",
                      ...raised3d("#f0a890"),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 3,
                        color: "#060707",
                      }}
                    >
                      ET2
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* End Game */}
          {/* <View style={{ alignItems: "center", marginTop: 4 }}>
            <TouchableOpacity
              onPress={onEndGame}
              style={{
                backgroundColor: "#ef4444",
                paddingHorizontal: 24,
                paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                End Game
              </Text>
            </TouchableOpacity>
          </View> */}
        </>
      )}

      {/* Not Live State */}
      {!isLive && !gameOver && (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 32,
            backgroundColor: "#171a2c",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(59,74,65,0.2)",
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🏉</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#b8c3ff",
            }}
          >
            Waiting for Match to Start
          </Text>
          <Text
            style={{
              color: "#bacbbf",
              fontSize: 11,
              marginTop: 8,
              opacity: 0.8,
            }}
          >
            Scoring controls will be activated once the game is live.
          </Text>
        </View>
      )}

      {/* Game Over State */}
      {gameOver && (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 32,
            backgroundColor: "#171a2c",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(55,65,81,0.3)",
          }}
        >
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🏆</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 3,
              color: "#9CA3AF",
            }}
          >
            Match Ended
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              marginTop: 12,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: "#6B7280",
                  textTransform: "uppercase",
                }}
              >
                {homeName}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>
                {homeScore}
              </Text>
            </View>
            <Text style={{ color: "#4B5563" }}>—</Text>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: "#6B7280",
                  textTransform: "uppercase",
                }}
              >
                {awayName}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>
                {awayScore}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══ SUBSTITUTION MODAL ═══ */}
      {showSubstitution && (() => {
        const subData = getSubstitutionData();
        return (
          <RugbySubstitutionModal
            visible={showSubstitution}
            lineup={subData.lineup}
            benchPlayers={subData.bench}
            teamName={`${subData.teamName} (${subData.subsRemaining} subs remaining)`}
            onConfirm={(data) => {
              setShowSubstitution(false);
              if (onSubstitution) onSubstitution({ ...data, teamSide: activeSide });
            }}
            onCancel={() => setShowSubstitution(false)}
          />
        );
      })()}
    </View>
  );
}


export default RugbyScoringPanelMobile;
