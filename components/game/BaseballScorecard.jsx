import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useGameScoringTheme } from "@/constants/gameScoringTheme";
import { formatInningStatus } from "@/lib/baseballLineScore";

const NAME_COL_W = 108;
const STAT_COL_W = 40;
const RATE_COL_W = 48;
const HEADER_H = 36;
const ROW_H = 52;
const TOTAL_H = 44;

const BATTING_COLS = [
  { key: "ab", label: "AB", kind: "count" },
  { key: "r", label: "R", kind: "count" },
  { key: "h", label: "H", kind: "count" },
  { key: "rbi", label: "RBI", kind: "count" },
  { key: "hr", label: "HR", kind: "count" },
  { key: "bb", label: "BB", kind: "count" },
  { key: "k", label: "K", kind: "count" },
  { key: "avg", label: "AVG", kind: "rate" },
  { key: "obp", label: "OBP", kind: "rate" },
  { key: "slg", label: "SLG", kind: "rate" },
  { key: "ops", label: "OPS", kind: "rate" },
];

const PITCHING_COLS = [
  { key: "ip", label: "IP", kind: "ip" },
  { key: "h", label: "H", kind: "count" },
  { key: "r", label: "R", kind: "count" },
  { key: "er", label: "ER", kind: "count" },
  { key: "bb", label: "BB", kind: "count" },
  { key: "k", label: "K", kind: "count" },
  { key: "hr", label: "HR", kind: "count" },
  { key: "pitches", label: "P", kind: "count" },
];

const FIELDING_COLS = [
  { key: "po", label: "PO", kind: "count" },
  { key: "a", label: "A", kind: "count" },
  { key: "e", label: "E", kind: "count" },
  { key: "dp", label: "DP", kind: "count" },
];

const LEGEND_ITEMS = {
  batting: [
    { abbr: "AB", meaning: "At bats" },
    { abbr: "R", meaning: "Runs" },
    { abbr: "H", meaning: "Hits" },
    { abbr: "RBI", meaning: "Runs batted in" },
    { abbr: "HR", meaning: "Home runs" },
    { abbr: "BB", meaning: "Walks" },
    { abbr: "K", meaning: "Strikeouts" },
    { abbr: "AVG", meaning: "Batting average" },
    { abbr: "OBP", meaning: "On-base percentage" },
    { abbr: "SLG", meaning: "Slugging percentage" },
    { abbr: "OPS", meaning: "On-base + slugging" },
  ],
  pitching: [
    { abbr: "IP", meaning: "Innings pitched" },
    { abbr: "H", meaning: "Hits allowed" },
    { abbr: "R", meaning: "Runs allowed" },
    { abbr: "ER", meaning: "Earned runs" },
    { abbr: "BB", meaning: "Walks allowed" },
    { abbr: "K", meaning: "Strikeouts" },
    { abbr: "HR", meaning: "Home runs allowed" },
    { abbr: "P", meaning: "Total pitches" },
  ],
  fielding: [
    { abbr: "PO", meaning: "Putouts" },
    { abbr: "A", meaning: "Assists" },
    { abbr: "E", meaning: "Errors" },
    { abbr: "DP", meaning: "Double plays" },
  ],
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatRate(value) {
  const n = num(value);
  if (!Number.isFinite(n)) return ".000";
  const clamped = Math.max(0, n);
  const text = clamped.toFixed(3);
  return text.startsWith("0") ? text.slice(1) : text;
}

function formatIp(value) {
  const n = num(value);
  if (!n) return "0.0";
  return n.toFixed(1);
}

function shortName(player, fallback = "Unknown") {
  if (!player) return fallback;
  const first = String(player.firstName || "").trim();
  const last = String(player.lastName || "").trim();
  if (first && last) return `${first[0]}. ${last}`;
  if (last) return last;
  if (first) return first;
  return (
    player.name ||
    player.fullName ||
    player.displayName ||
    fallback
  );
}

function initials(player) {
  const first = String(player?.firstName || "").trim();
  const last = String(player?.lastName || "").trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  const name = String(player?.name || player?.displayName || "?").trim();
  return name.slice(0, 2).toUpperCase() || "?";
}

function computeBattingRates(b = {}) {
  const ab = num(b.atBats);
  const h = num(b.hits);
  const bb = num(b.walks);
  const hbp = num(b.hitByPitch);
  const sf = num(b.sacrificeFlies);
  const tb = num(b.totalBases);
  const avg = ab > 0 ? h / ab : 0;
  const obpDen = ab + bb + hbp + sf;
  const obp = obpDen > 0 ? (h + bb + hbp) / obpDen : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const ops = obp + slg;
  return {
    avg: num(b.battingAverage) || avg,
    obp: num(b.onBasePercentage) || obp,
    slg: num(b.sluggingPercentage) || slg,
    ops: num(b.ops) || ops,
  };
}

function battingRowFromStats(b = {}) {
  const rates = computeBattingRates(b);
  return {
    ab: num(b.atBats),
    r: num(b.runs),
    h: num(b.hits),
    rbi: num(b.rbi),
    hr: num(b.homeRuns),
    bb: num(b.walks),
    k: num(b.strikeouts),
    avg: rates.avg,
    obp: rates.obp,
    slg: rates.slg,
    ops: rates.ops,
  };
}

function pitchingRowFromStats(p = {}) {
  return {
    ip: num(p.inningsPitched),
    h: num(p.hitsAllowed),
    // Schema tracks earned runs; use ER for R until runsAllowed is populated server-side.
    r: num(p.runsAllowed) || num(p.earnedRuns),
    er: num(p.earnedRuns),
    bb: num(p.walksAllowed),
    k: num(p.strikeouts),
    hr: num(p.homeRunsAllowed),
    pitches: num(p.totalPitches),
  };
}

function fieldingRowFromStats(f = {}) {
  return {
    po: num(f.putouts),
    a: num(f.assists),
    e: num(f.errors),
    dp: num(f.doublePlays),
  };
}

function Avatar({ uri, label, size = 48, UI, badgeUri }) {
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      {uri ? (
        <Image
          source={{ uri, width: size * 2, height: size * 2 }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: UI.isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: UI.border,
          }}
        >
          <Text style={{ color: UI.text, fontWeight: "800", fontSize: size * 0.32 }}>
            {label}
          </Text>
        </View>
      )}
      {badgeUri ? (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: size * 0.18,
            backgroundColor: UI.card,
            borderWidth: 1.5,
            borderColor: UI.isDark ? "#111" : "#fff",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: badgeUri, width: 48, height: 48 }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      ) : null}
    </View>
  );
}

function TeamLogo({ uri, name, size = 28, UI }) {
  if (uri) {
    return (
      <Image
        source={{ uri, width: size * 2, height: size * 2 }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  const letter = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: UI.isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: UI.text, fontWeight: "900", fontSize: size * 0.4 }}>{letter}</Text>
    </View>
  );
}

function formatCell(col, value) {
  if (col.kind === "rate") return formatRate(value);
  if (col.kind === "ip") return formatIp(value);
  return String(num(value));
}

function StatsTable({ rows, columns, UI, emptyLabel, legend }) {
  const totals = useMemo(() => {
    const out = {};
    for (const col of columns) {
      if (col.kind === "rate") {
        out[col.key] = null;
        continue;
      }
      out[col.key] = rows.reduce((sum, row) => sum + num(row.stats?.[col.key]), 0);
    }
    return out;
  }, [rows, columns]);

  if (!rows.length) {
    return (
      <View style={{ paddingVertical: 28, alignItems: "center" }}>
        {legend}
        <Text style={{ color: UI.muted, fontSize: 13, fontWeight: "600", marginTop: 12 }}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ width: NAME_COL_W }}>
        <View
          style={{
            height: HEADER_H,
            justifyContent: "center",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: UI.border,
            paddingRight: 6,
          }}
        >
          {legend}
        </View>
        {rows.map((row) => (
          <View
            key={row.id}
            style={{
              height: ROW_H,
              justifyContent: "center",
              paddingRight: 8,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: UI.border,
            }}
          >
            <Text style={{ color: UI.text, fontWeight: "700", fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={{ color: UI.muted, fontSize: 11, lineHeight: 14, marginTop: 2 }} numberOfLines={1}>
              {row.position || "—"}
            </Text>
          </View>
        ))}
        <View style={{ height: TOTAL_H, justifyContent: "center" }}>
          <Text style={{ color: UI.text, fontWeight: "800", fontSize: 13 }}>Total</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View>
          <View
            style={{
              flexDirection: "row",
              height: HEADER_H,
              alignItems: "center",
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: UI.border,
            }}
          >
            {columns.map((col) => (
              <Text
                key={col.key}
                style={{
                  width: col.kind === "rate" ? RATE_COL_W : STAT_COL_W,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: "700",
                  color: UI.muted,
                  letterSpacing: 0.3,
                }}
              >
                {col.label}
              </Text>
            ))}
          </View>
          {rows.map((row) => (
            <View
              key={row.id}
              style={{
                flexDirection: "row",
                height: ROW_H,
                alignItems: "center",
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: UI.border,
              }}
            >
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={{
                    width: col.kind === "rate" ? RATE_COL_W : STAT_COL_W,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "600",
                    color: UI.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatCell(col, row.stats?.[col.key])}
                </Text>
              ))}
            </View>
          ))}
          <View style={{ flexDirection: "row", height: TOTAL_H, alignItems: "center" }}>
            {columns.map((col) => {
              const text =
                col.kind === "rate"
                  ? "—"
                  : col.kind === "ip"
                    ? formatIp(totals[col.key])
                    : String(num(totals[col.key]));
              return (
                <Text
                  key={col.key}
                  style={{
                    width: col.kind === "rate" ? RATE_COL_W : STAT_COL_W,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "800",
                    color: UI.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {text}
                </Text>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TopPerformersView({ performers, teamLogos, UI, showBoxScoreLink = false, onOpenBoxScore }) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      <Text
        style={{
          color: UI.text,
          fontSize: 18,
          fontWeight: "800",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        Top performers
      </Text>

      {!performers.length ? (
        <View
          style={{
            backgroundColor: UI.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: UI.border,
            padding: 24,
            alignItems: "center",
            marginBottom: showBoxScoreLink ? 16 : 0,
          }}
        >
          <Text style={{ color: UI.muted, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            No batting stats yet. Score some at-bats to see top performers.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 10 }}
          style={{ marginBottom: showBoxScoreLink ? 16 : 0 }}
        >
          {performers.map((p) => (
            <View
              key={p.id}
              style={{
                width: 148,
                backgroundColor: UI.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: UI.border,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Avatar
                uri={p.avatar}
                label={initials(p.player)}
                size={56}
                UI={UI}
                badgeUri={p.side === "home" ? teamLogos.home : teamLogos.away}
              />
              <Text
                style={{
                  color: UI.text,
                  fontWeight: "800",
                  fontSize: 13,
                  marginTop: 10,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {p.name}
              </Text>
              <Text style={{ color: UI.muted, fontSize: 12, marginTop: 2 }}>
                {p.hits}-{p.ab}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 10, width: "100%" }}>
                {[
                  { label: "HR", value: p.hr },
                  { label: "RBI", value: p.rbi },
                  { label: "R", value: p.r },
                ].map((m) => (
                  <View
                    key={m.label}
                    style={{
                      flex: 1,
                      backgroundColor: UI.cardElevated,
                      borderRadius: 8,
                      paddingVertical: 6,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: UI.muted, fontSize: 9, fontWeight: "700" }}>{m.label}</Text>
                    <Text style={{ color: UI.text, fontSize: 15, fontWeight: "800", marginTop: 2 }}>
                      {m.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {showBoxScoreLink && onOpenBoxScore ? (
        <TouchableOpacity onPress={onOpenBoxScore} style={{ alignSelf: "center", paddingVertical: 8 }}>
          <Text
            style={{
              color: UI.isDark ? "#93C5FD" : "#2563EB",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            Box score {"\u203A"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function BoxScoreView({
  UI,
  teamNames,
  teamLogos,
  homeScore,
  awayScore,
  statusLabel,
  selectedSide,
  onSelectSide,
  category,
  onSelectCategory,
  onOpenLegend,
  battingRows,
  pitchingRows,
  fieldingRows,
}) {
  const columns =
    category === "pitching" ? PITCHING_COLS : category === "fielding" ? FIELDING_COLS : BATTING_COLS;
  const rows =
    category === "pitching"
      ? pitchingRows
      : category === "fielding"
        ? fieldingRows
        : battingRows;
  const emptyLabel =
    category === "pitching"
      ? "No pitching stats yet"
      : category === "fielding"
        ? "No fielding stats yet"
        : "No batting stats yet";

  const pillActiveBg = UI.isDark ? "#FFFFFF" : "#111827";
  const pillActiveText = UI.isDark ? "#111827" : "#FFFFFF";
  const pillIdleText = UI.text;

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, justifyContent: "center" }}>
        <View style={{ flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 12 }}>
          <TeamLogo uri={teamLogos.home} name={teamNames.home} size={32} UI={UI} />
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: UI.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
              {homeScore} - {awayScore}
            </Text>
            <Text style={{ color: UI.muted, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
              {statusLabel}
            </Text>
          </View>
          <TeamLogo uri={teamLogos.away} name={teamNames.away} size={32} UI={UI} />
        </View>
      </View>

      {/* Team toggle */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: UI.cardElevated,
          borderRadius: 14,
          padding: 4,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: UI.border,
        }}
      >
        {["home", "away"].map((side) => {
          const active = selectedSide === side;
          return (
            <TouchableOpacity
              key={side}
              onPress={() => onSelectSide(side)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 10,
                borderRadius: 11,
                backgroundColor: active
                  ? UI.isDark
                    ? "rgba(255,255,255,0.92)"
                    : "#FFFFFF"
                  : "transparent",
              }}
            >
              <TeamLogo
                uri={side === "home" ? teamLogos.home : teamLogos.away}
                name={side === "home" ? teamNames.home : teamNames.away}
                size={26}
                UI={UI}
              />
              <Text
                style={{
                  color: active ? "#111827" : UI.muted,
                  fontWeight: "800",
                  fontSize: 12,
                  maxWidth: 90,
                }}
                numberOfLines={1}
              >
                {side === "home" ? teamNames.home : teamNames.away}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category pills */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {[
          { key: "batting", label: "Batting" },
          { key: "pitching", label: "Pitching" },
          { key: "fielding", label: "Fielding" },
        ].map((tab) => {
          const active = category === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelectCategory(tab.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? pillActiveBg : "transparent",
                borderWidth: active ? 0 : 1,
                borderColor: UI.border,
              }}
            >
              <Text
                style={{
                  color: active ? pillActiveText : pillIdleText,
                  fontWeight: "800",
                  fontSize: 13,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend + table card */}
      <View
        style={{
          backgroundColor: UI.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: UI.border,
          paddingTop: 4,
          paddingBottom: 4,
          paddingHorizontal: 8,
          overflow: "hidden",
        }}
      >
        <StatsTable
          rows={rows}
          columns={columns}
          UI={UI}
          emptyLabel={emptyLabel}
          legend={
            <TouchableOpacity
              onPress={onOpenLegend}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={{ color: UI.muted, fontSize: 12, fontWeight: "700" }}>Legend</Text>
              <Ionicons
                name="information-circle"
                size={15}
                color={UI.isDark ? "#A78BFA" : "#6366F1"}
              />
            </TouchableOpacity>
          }
        />
      </View>
    </View>
  );
}

export function BaseballScorecardMobile({ currentGame, players, teamNames }) {
  const UI = useGameScoringTheme();
  const [selectedSide, setSelectedSide] = useState("home");
  const [category, setCategory] = useState("batting");
  const [legendOpen, setLegendOpen] = useState(false);

  const sport = currentGame?.sport || {};
  const base = currentGame?.base || {};
  const homeId = String(base?.teamId || "");
  const awayId = String(base?.opponentTeamId || "");

  const teamLogos = useMemo(
    () => ({
      home: base?.teamLogo || null,
      away: base?.opponentTeamLogo || null,
    }),
    [base?.teamLogo, base?.opponentTeamLogo],
  );

  const names = {
    home: teamNames?.home || "Home",
    away: teamNames?.away || "Away",
  };

  const homeScore = num(sport?.score?.home);
  const awayScore = num(sport?.score?.away);

  const statusLabel = useMemo(() => {
    const status = String(sport?.matchStatus || base?.status || "").toLowerCase();
    if (status === "final" || status === "completed" || status === "finished") return "Finished";
    if (status === "in_progress" || status === "live") {
      return formatInningStatus({
        currentInning: sport?.currentInning,
        scheduledInnings: sport?.rules?.scheduledInnings,
        inningHalf: sport?.inningHalf,
      });
    }
    if (status === "scheduled") return "Scheduled";
    return status ? status.replace(/_/g, " ") : "Game";
  }, [
    sport?.matchStatus,
    sport?.inningHalf,
    sport?.currentInning,
    sport?.rules?.scheduledInnings,
    base?.status,
  ]);

  const playerIndex = useMemo(() => {
    const map = new Map();
    for (const side of ["home", "away"]) {
      for (const p of players?.[side] || []) {
        const id = String(p.id || p._id || "");
        if (id) map.set(id, { ...p, _side: side });
      }
    }
    return map;
  }, [players]);

  const statsByPlayer = useMemo(() => {
    const map = new Map();
    for (const s of sport?.playerStats || []) {
      if (!s?.playerId) continue;
      map.set(String(s.playerId), s);
    }
    return map;
  }, [sport?.playerStats]);

  const buildSideRows = useMemo(() => {
    return (side, mode) => {
      const lineup = side === "home" ? sport?.homeLineup || [] : sport?.awayLineup || [];
      const teamId = side === "home" ? homeId : awayId;
      const seen = new Set();
      const rows = [];

      const makeRow = (playerId, positionHint) => {
        const pid = String(playerId || "");
        if (!pid || seen.has(pid)) return null;
        const roster = playerIndex.get(pid);
        const stats = statsByPlayer.get(pid);
        const batting = battingRowFromStats(stats?.batting);
        const pitching = pitchingRowFromStats(stats?.pitching);
        const fielding = fieldingRowFromStats(stats?.fielding);
        const player = roster || {
          firstName: stats?.firstName,
          lastName: stats?.lastName,
          name: stats?.name,
        };
        return {
          id: pid,
          name: shortName(player),
          position: positionHint || stats?.position || roster?.position || "—",
          player,
          avatar: roster?.profilePicture || roster?.playerimage || null,
          stats: mode === "pitching" ? pitching : mode === "fielding" ? fielding : batting,
          batting,
          pitching,
          fielding,
          side,
          teamId,
          _stats: stats,
        };
      };

      const push = (playerId, positionHint) => {
        const row = makeRow(playerId, positionHint);
        if (!row) return;
        seen.add(row.id);
        rows.push(row);
      };

      const sortedLineup = [...lineup].sort(
        (a, b) => num(a.battingOrder) - num(b.battingOrder),
      );
      for (const entry of sortedLineup) {
        push(entry.playerId, entry.position);
      }

      for (const [pid, stats] of statsByPlayer.entries()) {
        if (seen.has(pid)) continue;
        const sid = String(stats.teamId || "");
        if (teamId && sid && sid !== teamId) continue;
        if (!sid) {
          const roster = playerIndex.get(pid);
          if (!roster || roster._side !== side) continue;
        }
        push(pid, stats.position);
      }

      if (mode === "batting") {
        return rows.filter((r) => {
          const inLineup = lineup.some((e) => String(e.playerId) === r.id);
          const b = r.batting;
          const hasBat =
            b.ab > 0 ||
            b.h > 0 ||
            b.bb > 0 ||
            b.hr > 0 ||
            num(r._stats?.batting?.plateAppearances) > 0;
          return inLineup || hasBat;
        });
      }

      if (mode === "pitching") {
        return rows.filter((r) => {
          const pos = String(r.position || "").toUpperCase();
          const p = r.pitching;
          return (
            pos === "P" ||
            p.pitches > 0 ||
            p.ip > 0 ||
            p.k > 0 ||
            p.bb > 0 ||
            p.h > 0 ||
            p.er > 0
          );
        });
      }

      return rows.filter((r) => {
        const inLineup = lineup.some((e) => String(e.playerId) === r.id);
        const f = r.fielding;
        const hasField = f.po > 0 || f.a > 0 || f.e > 0 || f.dp > 0;
        const pos = String(r.position || "").toUpperCase();
        return (inLineup && pos !== "DH") || hasField;
      });
    };
  }, [sport?.homeLineup, sport?.awayLineup, homeId, awayId, playerIndex, statsByPlayer]);

  const battingRows = useMemo(
    () => buildSideRows(selectedSide, "batting"),
    [buildSideRows, selectedSide],
  );
  const pitchingRows = useMemo(
    () => buildSideRows(selectedSide, "pitching"),
    [buildSideRows, selectedSide],
  );
  const fieldingRows = useMemo(
    () => buildSideRows(selectedSide, "fielding"),
    [buildSideRows, selectedSide],
  );

  const legendItems = LEGEND_ITEMS[category] || LEGEND_ITEMS.batting;

  return (
    <View>
      <BoxScoreView
        UI={UI}
        teamNames={names}
        teamLogos={teamLogos}
        homeScore={homeScore}
        awayScore={awayScore}
        statusLabel={statusLabel}
        selectedSide={selectedSide}
        onSelectSide={setSelectedSide}
        category={category}
        onSelectCategory={setCategory}
        onOpenLegend={() => setLegendOpen(true)}
        battingRows={battingRows}
        pitchingRows={pitchingRows}
        fieldingRows={fieldingRows}
      />

      <Modal
        visible={legendOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLegendOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setLegendOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              backgroundColor: UI.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: UI.border,
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800" }}>
                {category.charAt(0).toUpperCase() + category.slice(1)} legend
              </Text>
              <TouchableOpacity onPress={() => setLegendOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={UI.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {legendItems.map((item) => (
                <View
                  key={item.abbr}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: UI.border,
                  }}
                >
                  <Text style={{ width: 48, color: UI.text, fontWeight: "800", fontSize: 13 }}>
                    {item.abbr}
                  </Text>
                  <Text style={{ flex: 1, color: UI.muted, fontSize: 13 }}>{item.meaning}</Text>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** Top performers strip for the Scoring tab. */
export function BaseballTopPerformers({ currentGame, players, teamNames }) {
  const UI = useGameScoringTheme();
  const sport = currentGame?.sport || {};
  const base = currentGame?.base || {};

  const teamLogos = useMemo(
    () => ({
      home: base?.teamLogo || null,
      away: base?.opponentTeamLogo || null,
    }),
    [base?.teamLogo, base?.opponentTeamLogo],
  );

  const playerIndex = useMemo(() => {
    const map = new Map();
    for (const side of ["home", "away"]) {
      for (const p of players?.[side] || []) {
        const id = String(p.id || p._id || "");
        if (id) map.set(id, { ...p, _side: side });
      }
    }
    return map;
  }, [players]);

  const performers = useMemo(() => {
    const homeId = String(base?.teamId || "");
    const awayId = String(base?.opponentTeamId || "");
    const statsByPlayer = new Map();
    for (const s of sport?.playerStats || []) {
      if (!s?.playerId) continue;
      statsByPlayer.set(String(s.playerId), s);
    }

    const collect = (side) => {
      const teamId = side === "home" ? homeId : awayId;
      const lineup = side === "home" ? sport?.homeLineup || [] : sport?.awayLineup || [];
      const seen = new Set();
      const out = [];

      const add = (playerId, positionHint) => {
        const pid = String(playerId || "");
        if (!pid || seen.has(pid)) return;
        seen.add(pid);
        const roster = playerIndex.get(pid);
        const stats = statsByPlayer.get(pid);
        const batting = battingRowFromStats(stats?.batting);
        if (
          batting.ab <= 0 &&
          batting.h <= 0 &&
          batting.hr <= 0 &&
          batting.rbi <= 0 &&
          batting.r <= 0 &&
          num(stats?.batting?.plateAppearances) <= 0
        ) {
          return;
        }
        const player = roster || {
          firstName: stats?.firstName,
          lastName: stats?.lastName,
          name: stats?.name,
        };
        out.push({
          id: pid,
          name: shortName(player),
          player,
          avatar: roster?.profilePicture || roster?.playerimage || null,
          side,
          ab: batting.ab,
          hits: batting.h,
          hr: batting.hr,
          rbi: batting.rbi,
          r: batting.r,
          score: batting.hr * 100 + batting.rbi * 10 + batting.h * 3 + batting.r,
          position: positionHint,
          teamId,
        });
      };

      for (const entry of lineup) add(entry.playerId, entry.position);
      for (const [pid, stats] of statsByPlayer.entries()) {
        if (seen.has(pid)) continue;
        const sid = String(stats.teamId || "");
        if (teamId && sid && sid !== teamId) continue;
        if (!sid) {
          const roster = playerIndex.get(pid);
          if (!roster || roster._side !== side) continue;
        }
        add(pid, stats.position);
      }
      return out;
    };

    return [...collect("home"), ...collect("away")]
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [sport?.playerStats, sport?.homeLineup, sport?.awayLineup, base?.teamId, base?.opponentTeamId, playerIndex]);

  return (
    <TopPerformersView
      performers={performers}
      teamLogos={teamLogos}
      UI={UI}
      showBoxScoreLink={false}
    />
  );
}

export default BaseballScorecardMobile;
