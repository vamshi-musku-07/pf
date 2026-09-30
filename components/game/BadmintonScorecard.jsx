import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { buildBadmintonScorecard } from "./badminton/badmintonScorecard";

function ComparisonBar({ leftValue, rightValue, leftColor, rightColor, trackColor }) {
  const l = Math.max(0, Number(leftValue) || 0);
  const r = Math.max(0, Number(rightValue) || 0);
  const total = l + r;
  const leftShare = total > 0 ? l / total : 0;
  const rightShare = total > 0 ? r / total : 0;
  const leftFlex = total === 0 ? 0 : Math.max(leftShare, l > 0 ? 0.1 : 0.0001);
  const rightFlex = total === 0 ? 0 : Math.max(rightShare, r > 0 ? 0.1 : 0.0001);

  return (
    <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8, gap: 3 }}>
      <View style={{ flex: 1, height: 6, backgroundColor: trackColor, borderRadius: 3, overflow: "hidden", flexDirection: "row" }}>
        <View style={{ flex: Math.max(1 - leftFlex, 0.0001) }} />
        <View
          style={{
            flex: Math.max(leftFlex, 0.0001),
            height: 6,
            backgroundColor: l > 0 ? leftColor : "transparent",
            borderRadius: 3,
            minWidth: l > 0 ? 6 : 0,
          }}
        />
      </View>
      <View style={{ flex: 1, height: 6, backgroundColor: trackColor, borderRadius: 3, overflow: "hidden", flexDirection: "row" }}>
        <View
          style={{
            flex: Math.max(rightFlex, 0.0001),
            height: 6,
            backgroundColor: r > 0 ? rightColor : "transparent",
            borderRadius: 3,
            minWidth: r > 0 ? 6 : 0,
          }}
        />
        <View style={{ flex: Math.max(1 - rightFlex, 0.0001) }} />
      </View>
    </View>
  );
}

function StatRow({
  label,
  leftDisplay,
  rightDisplay,
  leftValue,
  rightValue,
  leftColor,
  rightColor,
  trackColor,
  textColor,
  mutedColor,
}) {
  const leftLeads = Number(leftValue) > Number(rightValue);
  const rightLeads = Number(rightValue) > Number(leftValue);
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            width: 72,
            color: leftLeads ? leftColor : textColor,
            fontSize: 14,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          {leftDisplay}
        </Text>
        <Text style={{ flex: 1, textAlign: "center", color: mutedColor, fontSize: 12, fontWeight: "600" }}>
          {label}
        </Text>
        <Text
          style={{
            width: 72,
            textAlign: "right",
            color: rightLeads ? rightColor : textColor,
            fontSize: 14,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          {rightDisplay}
        </Text>
      </View>
      <ComparisonBar
        leftValue={leftValue}
        rightValue={rightValue}
        leftColor={leftColor}
        rightColor={rightColor}
        trackColor={trackColor}
      />
    </View>
  );
}

function FilterPills({ options, value, onChange, UI, softCard, softBorder }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = String(value) === String(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active
                ? (UI.isDark ? "#F8FAFC" : "#111827")
                : softCard,
              borderWidth: 1,
              borderColor: active ? "transparent" : softBorder,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.5,
                color: active
                  ? (UI.isDark ? "#0B1324" : "#FFFFFF")
                  : UI.text,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Point-by-point expandable game cards (SofaScore-style). */
function GamePointGrid({ game, UI, leftAccent, softBorder }) {
  const [open, setOpen] = useState(true);
  const cellW = 28;

  return (
    <View
      style={{
        backgroundColor: UI.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: softBorder,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800" }}>
          {game.title}
          {game.live ? " · Live" : ""}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={UI.muted} />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderTopColor: softBorder,
            paddingVertical: 12,
            paddingRight: 10,
          }}
        >
          <View
            style={{
              width: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRightWidth: 1,
              borderRightColor: softBorder,
              gap: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: game.leftWon ? leftAccent : UI.text,
                fontSize: 18,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
              }}
            >
              {game.leftFinal}
            </Text>
            <Text
              style={{
                color: !game.leftWon && game.winner ? UI.text : UI.muted,
                fontSize: 18,
                fontWeight: "900",
                fontVariant: ["tabular-nums"],
              }}
            >
              {game.rightFinal}
            </Text>
          </View>

          <View style={{ flex: 1, paddingLeft: 8, flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
            {game.columns.length === 0 ? (
              <Text style={{ color: UI.muted, fontSize: 12, padding: 8 }}>No rallies yet</Text>
            ) : (
              game.columns.map((col, idx) => {
                const isLast = idx === game.columns.length - 1;
                const leftHi = isLast && game.leftWon;
                const rightHi = isLast && !game.leftWon && game.winner;
                return (
                  <View key={`${game.gameNumber}-${idx}`} style={{ width: cellW, alignItems: "center", gap: 10 }}>
                    <Text
                      style={{
                        color: leftHi ? leftAccent : UI.text,
                        fontSize: 13,
                        fontWeight: leftHi || col.leftWonPoint ? "900" : "600",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {col.left}
                    </Text>
                    <Text
                      style={{
                        color: rightHi ? leftAccent : UI.muted,
                        fontSize: 13,
                        fontWeight: rightHi || col.rightWonPoint ? "900" : "600",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {col.right}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Scorecard tab — game summary + expandable point grids. */
export function BadmintonScorecardMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
}) {
  const UI = useGameScoringTheme();
  const sport = currentGame?.sport || {};
  const base = currentGame?.base || {};
  const card = useMemo(
    () => buildBadmintonScorecard(sport, teamNames, base, "all", userSide),
    [sport, teamNames, base, userSide],
  );

  const softBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const leftAccent = UI.isDark ? "#4ade80" : "#15803D";
  const liveAmber = UI.isDark ? "#facc15" : "#B45309";

  if (!card.matchStarted && card.gameColumns.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ color: UI.muted, fontSize: 14, fontWeight: "700" }}>No scorecard yet</Text>
        <Text style={{ color: UI.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>
          Score rallies to build the set table and point-by-point card.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: softBorder,
          overflow: "hidden",
          paddingVertical: 8,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: softBorder }}>
          <View style={{ flex: 1 }} />
          {card.gameColumns.map((col) => (
            <View key={col.gameNumber} style={{ width: 52, alignItems: "center" }}>
              <Text
                style={{
                  color: col.live ? liveAmber : UI.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  textTransform: "uppercase",
                }}
              >
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {card.rows.map((row, idx) => (
          <View
            key={row.side}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              borderBottomWidth: idx === card.rows.length - 1 ? 0 : 1,
              borderBottomColor: softBorder,
              backgroundColor: idx === 0 ? (UI.isDark ? "rgba(74,222,128,0.06)" : "#F0FDF4") : "transparent",
            }}
          >
            <Text style={{ flex: 1, color: UI.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
              {row.name}
            </Text>
            {row.games.map((g) => (
              <View key={`${row.side}-${g.gameNumber}`} style={{ width: 52, alignItems: "center" }}>
                <Text
                  style={{
                    color: g.won ? leftAccent : g.live ? liveAmber : g.empty ? UI.textMuted : UI.text,
                    fontSize: 16,
                    fontWeight: g.won || g.live ? "900" : "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {g.empty ? "—" : g.score}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {card.detailGames.map((game) => (
        <GamePointGrid
          key={game.gameNumber}
          game={game}
          UI={UI}
          leftAccent={leftAccent}
          softBorder={softBorder}
        />
      ))}
    </View>
  );
}

/** Stats tab — ALL / 1ST / 2ND pills + comparison bars. */
export function BadmintonStatsMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
}) {
  const UI = useGameScoringTheme();
  const [gameFilter, setGameFilter] = useState("all");
  const sport = currentGame?.sport || {};
  const base = currentGame?.base || {};

  const card = useMemo(
    () =>
      buildBadmintonScorecard(
        sport,
        teamNames,
        base,
        gameFilter === "all" ? "all" : Number(gameFilter),
        userSide,
      ),
    [sport, teamNames, base, gameFilter, userSide],
  );

  const softBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const softCard = UI.isDark ? "rgba(255,255,255,0.04)" : UI.cardElevated;
  const leftAccent = UI.isDark ? "#4ade80" : "#15803D";
  const rightAccent = UI.isDark ? "#A78BFA" : "#6D28D9";
  const trackColor = UI.isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
  const headerMuted = {
    color: UI.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };

  if (!card.matchStarted) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ color: UI.muted, fontSize: 14, fontWeight: "700" }}>No statistics yet</Text>
        <Text style={{ color: UI.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>
          Score points to build match statistics.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <FilterPills
        options={card.stats.setOptions}
        value={gameFilter}
        onChange={setGameFilter}
        UI={UI}
        softCard={softCard}
        softBorder={softBorder}
      />

      {card.sections.map((section) => (
        <View
          key={section.title}
          style={{
            backgroundColor: UI.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: softBorder,
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 6,
          }}
        >
          <Text style={{ ...headerMuted, textAlign: "center", marginBottom: 4 }}>
            {section.title}
          </Text>
          {section.rows.map((r, i) => (
            <View
              key={r.key}
              style={{
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: softBorder,
              }}
            >
              <StatRow
                label={r.label}
                leftDisplay={String(r.left)}
                rightDisplay={String(r.right)}
                leftValue={r.left}
                rightValue={r.right}
                leftColor={leftAccent}
                rightColor={rightAccent}
                trackColor={trackColor}
                textColor={UI.text}
                mutedColor={UI.muted}
              />
            </View>
          ))}
        </View>
      ))}

      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Text style={{ color: leftAccent, fontSize: 11, fontWeight: "800", flex: 1 }} numberOfLines={1}>
          {card.leftName}
        </Text>
        <Text style={{ color: rightAccent, fontSize: 11, fontWeight: "800", flex: 1, textAlign: "right" }} numberOfLines={1}>
          {card.rightName}
        </Text>
      </View>
    </View>
  );
}

export default BadmintonScorecardMobile;
