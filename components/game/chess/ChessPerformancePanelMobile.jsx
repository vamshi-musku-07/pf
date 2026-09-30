import { useMemo } from "react";
import { Text, View } from "react-native";
import { getPieceSymbolFromName } from "@/lib/chessUtils";

function StatBlock({ label, value, accent = "#f8fafc", subtext = null }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "48%",
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        padding: 12,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent,
          fontSize: 24,
          fontWeight: "900",
          marginTop: 8,
        }}
      >
        {value}
      </Text>
      {subtext ? (
        <Text style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>
          {subtext}
        </Text>
      ) : null}
    </View>
  );
}

function ChessPerformancePanelMobile({
  playerStats = {},
  gameHistory = [],
  playerColor = "white",
  playerName = "Player",
}) {
  const stats = useMemo(() => {
    const piecesCaptured = {
      pawns: playerStats.pawnsCapt ?? playerStats.piecesCaptured?.pawns ?? 0,
      knights: playerStats.knightsCapt ?? playerStats.piecesCaptured?.knights ?? 0,
      bishops: playerStats.bishopsCapt ?? playerStats.piecesCaptured?.bishops ?? 0,
      rooks: playerStats.rooksCapt ?? playerStats.piecesCaptured?.rooks ?? 0,
      queens: playerStats.queensCapt ?? playerStats.piecesCaptured?.queens ?? 0,
    };

    const totalCaptures = Object.values(piecesCaptured).reduce(
      (sum, value) => sum + value,
      0,
    );

    return {
      totalMoves: playerStats.totalMoves || 0,
      captures: playerStats.captures ?? totalCaptures,
      checks: playerStats.checks ?? playerStats.checksGiven ?? 0,
      castled: Boolean(playerStats.castled),
      promotions: playerStats.promotions || 0,
      enPassantCaptures:
        playerStats.enPassantCaptures ?? playerStats.enPassant ?? 0,
      totalTimeSpent: playerStats.totalTimeSpent || 0,
      avgTimePerMove:
        playerStats.avgTimePerMove ??
        playerStats.averageTimePerMove ??
        0,
      longestMove:
        playerStats.longestMove ?? playerStats.slowestMove ?? 0,
      piecesCaptured,
    };
  }, [playerStats]);

  const record = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;

    gameHistory.forEach((game) => {
      const result = game?.gameResult;
      if (result === "1/2-1/2") {
        draws += 1;
      } else if (result === "1-0") {
        if (playerColor === "white") wins += 1;
        else losses += 1;
      } else if (result === "0-1") {
        if (playerColor === "black") wins += 1;
        else losses += 1;
      }
    });

    const total = wins + losses + draws;
    return {
      wins,
      losses,
      draws,
      total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    };
  }, [gameHistory, playerColor]);

  const accuracy = useMemo(() => {
    if (stats.totalMoves === 0) return 0;
    const signal =
      stats.captures + stats.checks + stats.promotions * 4 + (stats.castled ? 3 : 0);
    return Math.min(99, Math.max(42, Math.round(50 + (signal / stats.totalMoves) * 22)));
  }, [stats]);

  const colorChipStyle =
    playerColor === "white"
      ? { backgroundColor: "#ffffff", borderColor: "#e2e8f0" }
      : { backgroundColor: "#111827", borderColor: "#64748b" };

  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: "rgba(15,23,42,0.6)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 16,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1,
              marginRight: 10,
              ...colorChipStyle,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#f8fafc", fontSize: 18, fontWeight: "900" }}>
              {playerName}
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              {playerColor === "white" ? "White" : "Black"} side
            </Text>
          </View>
        </View>

        <View
          style={{
            borderRadius: 999,
            backgroundColor: "rgba(154,234,98,0.15)",
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: "#9AEA62", fontSize: 12, fontWeight: "800" }}>
            {accuracy}% accuracy
          </Text>
        </View>
      </View>

      {record.total > 0 ? (
        <View style={{ flexDirection: "row", marginBottom: 14 }}>
          <StatBlock label="Wins" value={record.wins} accent="#4ade80" />
          <View style={{ width: 10 }} />
          <StatBlock label="Losses" value={record.losses} accent="#f87171" />
          <View style={{ width: 10 }} />
          <StatBlock label="Draws" value={record.draws} accent="#cbd5e1" />
          <View style={{ width: 10 }} />
          <StatBlock label="Win Rate" value={`${record.winRate}%`} accent="#60a5fa" />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <StatBlock label="Moves" value={stats.totalMoves} />
        <StatBlock label="Captures" value={stats.captures} accent="#fbbf24" />
        <StatBlock label="Checks" value={stats.checks} accent="#f97316" />
        <StatBlock label="Castled" value={stats.castled ? "Yes" : "No"} accent={stats.castled ? "#4ade80" : "#94a3b8"} />
        <StatBlock label="Promotions" value={stats.promotions} accent="#a78bfa" />
        <StatBlock label="En Passant" value={stats.enPassantCaptures} accent="#60a5fa" />
      </View>

      <View
        style={{
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
          padding: 14,
          marginTop: 4,
        }}
      >
        <Text
          style={{
            color: "#94a3b8",
            fontSize: 11,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 10,
          }}
        >
          Captures Breakdown
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {[
            { piece: "pawn", count: stats.piecesCaptured.pawns },
            { piece: "knight", count: stats.piecesCaptured.knights },
            { piece: "bishop", count: stats.piecesCaptured.bishops },
            { piece: "rook", count: stats.piecesCaptured.rooks },
            { piece: "queen", count: stats.piecesCaptured.queens },
          ].map((item) => (
            <View
              key={item.piece}
              style={{
                width: "18%",
                borderRadius: 12,
                backgroundColor: "rgba(15,23,42,0.45)",
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 24 }}>
                {getPieceSymbolFromName(item.piece, "black")}
              </Text>
              <Text
                style={{
                  color: "#f8fafc",
                  fontSize: 12,
                  fontWeight: "800",
                  marginTop: 6,
                }}
              >
                {item.count}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {(stats.avgTimePerMove || stats.longestMove) ? (
        <View
          style={{
            flexDirection: "row",
            marginTop: 14,
          }}
        >
          <StatBlock
            label="Avg / Move"
            value={`${Math.round(stats.avgTimePerMove || 0)}s`}
            accent="#60a5fa"
          />
          <View style={{ width: 10 }} />
          <StatBlock
            label="Longest"
            value={`${Math.round(stats.longestMove || 0)}s`}
            accent="#f97316"
          />
          <View style={{ width: 10 }} />
          <StatBlock
            label="Total Time"
            value={`${Math.round(stats.totalTimeSpent || 0)}s`}
            accent="#c4b5fd"
          />
        </View>
      ) : null}
    </View>
  );
}

export default ChessPerformancePanelMobile;
