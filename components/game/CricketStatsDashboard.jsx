import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCricketStatsSummary, getGameId } from "./hooks/cricketStats";
import { getGameByIdAPI } from "@/services/GameApi";
import CricketPlayerCompare from "./CricketPlayerCompare";
import { getAppTheme } from "@/constants/appearanceTheme";

// Cap how many finished games we hydrate so a long history can't fire off
// dozens of requests. The list is already sorted newest-first server-side.
const MAX_HYDRATED_GAMES = 25;

const RANK_COLORS = ["#F59E0B", "#9CA3AF", "#B45309"];

function RecordChip({ label, value, color, isDark, textMuted }) {
  return (
    <View className="flex-1 items-center py-2">
      <Text className="text-2xl font-black" style={{ color }}>
        {value}
      </Text>
      <Text
        className="text-gray-500 text-[11px] font-semibold mt-0.5"
        style={isDark ? { color: textMuted } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

function LeaderRow({ index, name, primary, secondary, isDark, T }) {
  const rankColor = RANK_COLORS[index] || "#D1D5DB";
  return (
    <View
      className={`flex-row items-center py-2 border-b ${isDark ? "" : "border-gray-100"}`}
      style={isDark ? { borderBottomWidth: 1, borderBottomColor: T.borderSubtle } : undefined}
    >
      <View
        className="w-6 h-6 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: `${rankColor}22` }}
      >
        <Text className="text-xs font-black" style={{ color: rankColor }}>
          {index + 1}
        </Text>
      </View>
      <Text
        className="flex-1 text-gray-900 font-semibold text-sm"
        style={isDark ? { color: T.text } : undefined}
        numberOfLines={1}
      >
        {name}
      </Text>
      {secondary ? (
        <Text
          className="text-gray-400 text-xs mr-3"
          style={isDark ? { color: T.textMuted } : undefined}
        >
          {secondary}
        </Text>
      ) : null}
      <Text
        className="text-gray-900 font-black text-sm"
        style={isDark ? { color: T.text } : undefined}
      >
        {primary}
      </Text>
    </View>
  );
}

function Leaderboard({ icon, iconColor, title, rows, isDark, T }) {
  if (!rows || rows.length === 0) return null;
  return (
    <View
      className={`rounded-2xl p-4 mb-3 shadow-sm ${isDark ? "" : "bg-white"}`}
      style={
        isDark
          ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
          : undefined
      }
    >
      <View className="flex-row items-center gap-2 mb-1">
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text
          className="text-gray-900 font-bold text-sm"
          style={isDark ? { color: T.text } : undefined}
        >
          {title}
        </Text>
      </View>
      {rows.map((row, idx) => (
        <LeaderRow
          key={row.playerId || idx}
          index={idx}
          name={row.name}
          primary={row.primary}
          secondary={row.secondary}
          isDark={isDark}
          T={T}
        />
      ))}
    </View>
  );
}

export default function CricketStatsDashboard({ games, teamId, players, isDark = false }) {
  const T = getAppTheme(isDark);
  // The team games list only carries base metadata (no innings / playerStats),
  // so collect the ids of finished cricket games and hydrate their full
  // documents on demand — that's where the stats actually live.
  const finishedIds = useMemo(() => {
    return (Array.isArray(games) ? games : [])
      .filter((g) => {
        const sport = String(g?.base?.sport ?? g?.sport ?? "").toLowerCase();
        const status = String(g?.base?.status ?? g?.status ?? "").toLowerCase();
        return sport === "cricket" && status === "finished";
      })
      .map((g) => getGameId(g))
      .filter(Boolean)
      .map(String)
      .slice(0, MAX_HYDRATED_GAMES);
  }, [games]);

  const idsKey = finishedIds.join(",");
  const cacheRef = useRef(new Map());
  const [fullGames, setFullGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (finishedIds.length === 0) {
      setFullGames([]);
      setLoading(false);
      return undefined;
    }

    const collect = () =>
      finishedIds.map((id) => cacheRef.current.get(id)).filter(Boolean);

    const toFetch = finishedIds.filter((id) => !cacheRef.current.has(id));
    if (toFetch.length === 0) {
      setFullGames(collect());
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    (async () => {
      const results = await Promise.allSettled(
        toFetch.map((id) => getGameByIdAPI(id)),
      );
      results.forEach((res, index) => {
        const id = toFetch[index];
        const full =
          res.status === "fulfilled" ? res.value?.data || res.value : null;
        cacheRef.current.set(id, full?.base ? full : null);
      });
      if (!cancelled) {
        setFullGames(collect());
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const summary = useMemo(
    () => getCricketStatsSummary(fullGames, { teamId, players }),
    [fullGames, teamId, players],
  );

  const cardStyle = isDark
    ? { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }
    : undefined;

  // No finished cricket games yet → render nothing (screen unchanged).
  if (finishedIds.length === 0) return null;

  if (loading && !summary) {
    return (
      <View className="mb-4">
        <Text
          className="text-lg font-bold text-gray-900 mb-3"
          style={isDark ? { color: T.text } : undefined}
        >
          Cricket Stats
        </Text>
        <View
          className={`rounded-2xl p-6 items-center shadow-sm ${isDark ? "" : "bg-white"}`}
          style={cardStyle}
        >
          <ActivityIndicator size="small" color={isDark ? T.refresh : "#081126"} />
          <Text
            className="text-gray-400 text-xs mt-2"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            Loading stats…
          </Text>
        </View>
      </View>
    );
  }

  if (!summary) return null;

  const { record, leaderboards, hasPlayerStats } = summary;

  const runRows = leaderboards.topRunScorers.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    primary: `${p.runs}`,
    secondary: p.balls_faced > 0 ? `SR ${p.strike_rate.toFixed(0)}` : null,
  }));

  const wicketRows = leaderboards.topWicketTakers.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    primary: `${p.wickets}`,
    secondary: p.balls_bowled > 0 ? `Econ ${p.economy.toFixed(1)}` : null,
  }));

  const srRows = leaderboards.bestStrikeRate.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    primary: p.strike_rate.toFixed(1),
    secondary: `${p.runs} (${p.balls_faced})`,
  }));

  const econRows = leaderboards.bestEconomy.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    primary: p.economy.toFixed(2),
    secondary: `${p.overs_bowled} ov`,
  }));

  const comparePlayers = summary.players.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    matches: p.matches,
    runs: p.runs,
    battingAverage: p.batting_average != null ? p.batting_average.toFixed(1) : "—",
    strikeRate: p.strike_rate != null ? p.strike_rate.toFixed(1) : "—",
    wickets: p.wickets,
    economy: p.economy != null ? p.economy.toFixed(2) : "—",
    fours: p.fours,
    sixes: p.sixes,
  }));

  return (
    <View className="mb-4">
      <Text
        className="text-lg font-bold text-gray-900 mb-3"
        style={isDark ? { color: T.text } : undefined}
      >
        Cricket Stats
      </Text>

      {/* Team record */}
      <View
        className={`rounded-2xl p-4 mb-3 shadow-sm ${isDark ? "" : "bg-white"}`}
        style={cardStyle}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <Ionicons name="trophy-outline" size={16} color={isDark ? T.text : "#081126"} />
          <Text
            className="text-gray-900 font-bold text-sm"
            style={isDark ? { color: T.text } : undefined}
          >
            Team Record
          </Text>
          <View className="flex-1" />
          <Text
            className="text-gray-400 text-xs"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            {record.played} match{record.played === 1 ? "" : "es"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mt-1">
          <RecordChip label="Won" value={record.won} color="#16A34A" isDark={isDark} textMuted={T.textMuted} />
          <View className={`w-px h-8 ${isDark ? "" : "bg-gray-100"}`} style={isDark ? { backgroundColor: T.borderSubtle } : undefined} />
          <RecordChip label="Lost" value={record.lost} color="#DC2626" isDark={isDark} textMuted={T.textMuted} />
          <View className={`w-px h-8 ${isDark ? "" : "bg-gray-100"}`} style={isDark ? { backgroundColor: T.borderSubtle } : undefined} />
          <RecordChip label="Tied" value={record.tied} color={isDark ? T.textDim : "#6B7280"} isDark={isDark} textMuted={T.textMuted} />
          <View className={`w-px h-8 ${isDark ? "" : "bg-gray-100"}`} style={isDark ? { backgroundColor: T.borderSubtle } : undefined} />
          <RecordChip
            label="Win %"
            value={`${record.win_pct.toFixed(0)}%`}
            color={isDark ? T.text : "#081126"}
            isDark={isDark}
            textMuted={T.textMuted}
          />
        </View>
      </View>

      {!hasPlayerStats ? (
        <View
          className={`rounded-2xl p-4 mb-3 shadow-sm items-center ${isDark ? "" : "bg-white"}`}
          style={cardStyle}
        >
          <Ionicons name="stats-chart-outline" size={28} color={isDark ? T.textMuted : "#D1D5DB"} />
          <Text
            className="text-gray-400 text-xs mt-2 text-center"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            Player leaderboards will appear once ball-by-ball data is recorded.
          </Text>
        </View>
      ) : (
        <>
          <Leaderboard
            icon="baseball-outline"
            iconColor="#16A34A"
            title="Most Runs"
            rows={runRows}
            isDark={isDark}
            T={T}
          />
          <Leaderboard
            icon="flame-outline"
            iconColor="#DC2626"
            title="Most Wickets"
            rows={wicketRows}
            isDark={isDark}
            T={T}
          />
          <Leaderboard
            icon="flash-outline"
            iconColor="#F59E0B"
            title="Best Strike Rate"
            rows={srRows}
            isDark={isDark}
            T={T}
          />
          <Leaderboard
            icon="shield-checkmark-outline"
            iconColor="#2563EB"
            title="Best Economy"
            rows={econRows}
            isDark={isDark}
            T={T}
          />
          <CricketPlayerCompare aggregatedPlayers={comparePlayers} isDark={isDark} />
        </>
      )}
    </View>
  );
}
