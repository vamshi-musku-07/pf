import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import {
  buildTennisScorecard,
  formatTennisDiff,
} from "./tennis/tennisScorecard";

const COL = {
  team: { flex: 1.4, minWidth: 88 },
  set: { width: 36 },
  num: { width: 44 },
};

function Cell({ children, style, align = "center" }) {
  return (
    <View style={[{ justifyContent: "center", alignItems: align === "left" ? "flex-start" : "center" }, style]}>
      {children}
    </View>
  );
}

function ComparisonBar({ leftValue, rightValue, leftColor, rightColor, trackColor }) {
  const l = Math.max(0, Number(leftValue) || 0);
  const r = Math.max(0, Number(rightValue) || 0);
  const total = l + r;
  // Use flex shares instead of % width — RN % inside flex:1 parents often paints 0 width.
  const leftShare = total > 0 ? l / total : 0;
  const rightShare = total > 0 ? r / total : 0;
  const leftFlex = total === 0 ? 0 : Math.max(leftShare, l > 0 ? 0.1 : 0.0001);
  const rightFlex = total === 0 ? 0 : Math.max(rightShare, r > 0 ? 0.1 : 0.0001);

  return (
    <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8, gap: 3 }}>
      <View
        style={{
          flex: 1,
          height: 6,
          backgroundColor: trackColor,
          borderRadius: 3,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
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
      <View
        style={{
          flex: 1,
          height: 6,
          backgroundColor: trackColor,
          borderRadius: 3,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
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

/**
 * Volleyball-style set table + SofaScore stats.
 * Left/right always match the top scoreboard (your team · opponent).
 */
export function TennisScorecardMobile({
  currentGame,
  teamNames = { home: "Home", away: "Away" },
  userSide = "home",
}) {
  const UI = useGameScoringTheme();
  const [setFilter, setSetFilter] = useState("all");
  const sport = currentGame?.sport || {};
  const base = currentGame?.base || {};

  const card = useMemo(
    () =>
      buildTennisScorecard(
        sport,
        teamNames,
        base,
        setFilter === "all" ? "all" : Number(setFilter),
        userSide,
      ),
    [sport, teamNames, base, setFilter, userSide],
  );

  const headerMuted = {
    color: UI.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  };
  const cellText = {
    color: UI.text,
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  };
  const softCard = UI.isDark ? "rgba(255,255,255,0.04)" : UI.cardElevated;
  const softBorder = UI.isDark ? "rgba(255,255,255,0.08)" : UI.border;
  const leftAccent = UI.isDark ? "#4ade80" : "#15803D";
  const rightAccent = UI.isDark ? "#A78BFA" : "#6D28D9";
  const liveAmber = UI.isDark ? "#facc15" : "#B45309";
  const trackColor = UI.isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";

  if (!card.matchStarted && card.setColumns.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ color: UI.muted, fontSize: 14, fontWeight: "700" }}>No statistics yet</Text>
        <Text style={{ color: UI.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>
          Score points to build the set table and match statistics.
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
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: softBorder,
            backgroundColor: softCard,
          }}
        >
          <Cell style={COL.team} align="left">
            <Text style={headerMuted}>Team</Text>
          </Cell>
          {card.setColumns.map((col) => (
            <Cell key={col.setNumber} style={COL.set}>
              <Text style={{ ...headerMuted, color: col.live ? liveAmber : UI.muted }}>
                {col.label}
              </Text>
            </Cell>
          ))}
          <Cell style={COL.num}>
            <Text style={headerMuted}>P</Text>
          </Cell>
          <Cell style={COL.num}>
            <Text style={headerMuted}>Diff</Text>
          </Cell>
          <Cell style={COL.num}>
            <Text style={headerMuted}>PTS</Text>
          </Cell>
        </View>

        {card.rows.map((row, idx) => {
          const isLeft = idx === 0;
          return (
            <View
              key={row.side}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderBottomWidth: idx === card.rows.length - 1 ? 0 : 1,
                borderBottomColor: softBorder,
                backgroundColor: isLeft
                  ? (UI.isDark ? "rgba(74,222,128,0.06)" : "#F0FDF4")
                  : "transparent",
              }}
            >
              <Cell style={COL.team} align="left">
                <Text style={{ color: UI.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                  {row.name}
                </Text>
              </Cell>
              {row.sets.map((s) => (
                <Cell key={`${row.side}-${s.setNumber}`} style={COL.set}>
                  <Text
                    style={{
                      ...cellText,
                      fontSize: 15,
                      color: s.won ? leftAccent : s.live ? liveAmber : UI.text,
                      fontWeight: s.won || s.live ? "900" : "700",
                    }}
                  >
                    {s.score}
                  </Text>
                </Cell>
              ))}
              <Cell style={COL.num}>
                <Text style={cellText}>{row.P}</Text>
              </Cell>
              <Cell style={COL.num}>
                <Text
                  style={{
                    ...cellText,
                    color: row.Diff > 0 ? leftAccent : row.Diff < 0 ? (UI.isDark ? "#f87171" : "#DC2626") : UI.text,
                  }}
                >
                  {formatTennisDiff(row.Diff)}
                </Text>
              </Cell>
              <Cell style={COL.num}>
                <Text style={{ ...cellText, fontSize: 16, color: leftAccent }}>{row.PTS}</Text>
              </Cell>
            </View>
          );
        })}
      </View>

      <Text style={{ color: UI.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 2 }}>
        P = games won · Diff = game difference · PTS = sets won
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {card.stats.setOptions.map((opt) => {
          const active = String(setFilter) === String(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setSetFilter(opt.id)}
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

export default TennisScorecardMobile;
