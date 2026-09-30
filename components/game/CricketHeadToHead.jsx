import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTeamMatchHistoryAPI } from "@/services/GameApi";

const RESULT_STYLE_LIGHT = {
  win: { label: "W", bg: "#DCFCE7", color: "#166534" },
  loss: { label: "L", bg: "#FEE2E2", color: "#991B1B" },
  tie: { label: "T", bg: "#F3F4F6", color: "#6B7280" },
  unknown: { label: "-", bg: "#F3F4F6", color: "#9CA3AF" },
};

const RESULT_STYLE_DARK = {
  win: { label: "W", bg: "rgba(34,197,94,0.22)", color: "#86EFAC" },
  loss: { label: "L", bg: "rgba(239,68,68,0.2)", color: "#FCA5A5" },
  tie: { label: "T", bg: "#1E1E24", color: "#A1A1AA" },
  unknown: { label: "-", bg: "#1E1E24", color: "#71717A" },
};

const styleFor = (result, isDark) =>
  (isDark ? RESULT_STYLE_DARK : RESULT_STYLE_LIGHT)[result] ||
  (isDark ? RESULT_STYLE_DARK : RESULT_STYLE_LIGHT).unknown;

function FormDot({ result, index, isDark }) {
  const s = styleFor(result, isDark);
  return (
    <View
      key={index}
      className="w-6 h-6 rounded-full items-center justify-center"
      style={{ backgroundColor: s.bg }}
    >
      <Text className="text-[11px] font-black" style={{ color: s.color }}>
        {s.label}
      </Text>
    </View>
  );
}

function RecordStat({ label, value, color, isDark }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xl font-black" style={{ color }}>
        {value}
      </Text>
      <Text
        className="text-gray-400 text-[10px] font-semibold mt-0.5"
        style={isDark ? { color: "#71717A" } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

export default function CricketHeadToHead({
  teamId,
  opponentTeamId,
  sport,
  opponentName,
  isDark = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!teamId || !opponentTeamId || !sport) {
      setData(null);
      return undefined;
    }

    let cancelled = false;
    const reqId = reqRef.current + 1;
    reqRef.current = reqId;
    setLoading(true);

    (async () => {
      try {
        const res = await getTeamMatchHistoryAPI(teamId, opponentTeamId, sport);
        const payload = res?.data || res;
        if (!cancelled && reqRef.current === reqId) setData(payload || null);
      } catch {
        if (!cancelled && reqRef.current === reqId) setData(null);
      } finally {
        if (!cancelled && reqRef.current === reqId) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId, opponentTeamId, sport]);

  if (loading) {
    return (
      <View className="mb-4">
        <Text
          className="text-gray-500 text-xs font-bold mb-2"
          style={isDark ? { color: "#71717A" } : undefined}
        >
          HEAD-TO-HEAD
        </Text>
        <View
          className={isDark ? "rounded-xl p-6 items-center" : "bg-white rounded-xl p-6 items-center shadow-sm"}
          style={
            isDark
              ? {
                  backgroundColor: "#16161A",
                  borderWidth: 1,
                  borderColor: "#2A2A2E",
                }
              : undefined
          }
        >
          <ActivityIndicator size="small" color={isDark ? "#9AEA62" : "#081126"} />
        </View>
      </View>
    );
  }

  const h2h = data?.headToHead;
  const games = Array.isArray(data?.games) ? data.games : [];
  const recentForm = Array.isArray(data?.recentForm) ? data.recentForm : [];

  if (!h2h) return null;

  const dividerColor = isDark ? "#2A2A2E" : undefined;

  return (
    <View className="mb-4">
      <Text
        className="text-gray-500 text-xs font-bold mb-2"
        style={isDark ? { color: "#71717A" } : undefined}
      >
        HEAD-TO-HEAD
      </Text>
      <View
        className={isDark ? "rounded-xl p-4" : "bg-white rounded-xl p-4 shadow-sm"}
        style={
          isDark
            ? {
                backgroundColor: "#16161A",
                borderWidth: 1,
                borderColor: "#2A2A2E",
              }
            : undefined
        }
      >
        {h2h.totalGames === 0 ? (
          <View className="items-center py-2">
            <Ionicons name="time-outline" size={22} color={isDark ? "#3F3F46" : "#D1D5DB"} />
            <Text
              className="text-gray-400 text-xs mt-1"
              style={isDark ? { color: "#71717A" } : undefined}
            >
              No previous meetings{opponentName ? ` with ${opponentName}` : ""}
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center">
              <RecordStat
                label="Played"
                value={h2h.totalGames}
                color={isDark ? "#F5F5F7" : "#081126"}
                isDark={isDark}
              />
              <View
                className="w-px h-8 bg-gray-100"
                style={dividerColor ? { backgroundColor: dividerColor } : undefined}
              />
              <RecordStat label="Won" value={h2h.wins} color="#16A34A" isDark={isDark} />
              <View
                className="w-px h-8 bg-gray-100"
                style={dividerColor ? { backgroundColor: dividerColor } : undefined}
              />
              <RecordStat label="Lost" value={h2h.losses} color="#DC2626" isDark={isDark} />
              <View
                className="w-px h-8 bg-gray-100"
                style={dividerColor ? { backgroundColor: dividerColor } : undefined}
              />
              <RecordStat
                label="Tied"
                value={h2h.ties}
                color={isDark ? "#A1A1AA" : "#6B7280"}
                isDark={isDark}
              />
              <View
                className="w-px h-8 bg-gray-100"
                style={dividerColor ? { backgroundColor: dividerColor } : undefined}
              />
              <RecordStat
                label="Win %"
                value={`${h2h.winPercentage ?? 0}%`}
                color="#2563EB"
                isDark={isDark}
              />
            </View>

            {recentForm.length > 0 && (
              <View className="flex-row items-center gap-1.5 mt-4">
                <Text
                  className="text-gray-400 text-[11px] font-semibold mr-1"
                  style={isDark ? { color: "#71717A" } : undefined}
                >
                  Recent
                </Text>
                {recentForm.map((r, i) => (
                  <FormDot key={i} result={r} index={i} isDark={isDark} />
                ))}
              </View>
            )}

            {games.length > 0 && (
              <View
                className={
                  isDark
                    ? "mt-3 pt-3"
                    : "mt-3 pt-3 border-t border-gray-100"
                }
                style={
                  isDark
                    ? { borderTopWidth: 1, borderTopColor: "#27272A" }
                    : undefined
                }
              >
                {games.slice(0, 5).map((g, idx) => {
                  const s = styleFor(g.result, isDark);
                  return (
                    <View
                      key={g.gameId || idx}
                      className="flex-row items-center py-1.5"
                    >
                      <View
                        className="w-5 h-5 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: s.bg }}
                      >
                        <Text
                          className="text-[10px] font-black"
                          style={{ color: s.color }}
                        >
                          {s.label}
                        </Text>
                      </View>
                      <Text
                        className="text-gray-900 font-bold text-xs"
                        style={isDark ? { color: "#F5F5F7" } : undefined}
                      >
                        {g.teamAScore} - {g.teamBScore}
                      </Text>
                      <View className="flex-1" />
                      <Text
                        className="text-gray-400 text-[11px]"
                        style={isDark ? { color: "#71717A" } : undefined}
                      >
                        {formatDate(g.date)}
                        {g.venue ? ` · ${g.venue}` : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
