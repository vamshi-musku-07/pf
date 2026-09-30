import { applyFootballLineupSwap } from "../../../../components/game/hooks/footballState";

describe("applyFootballLineupSwap", () => {
  test("incoming player inherits vacated pitch slot", () => {
    const sport = {
      homeLineup: [
        {
          playerId: "out-1",
          position: "LB",
          slotKey: "LB",
          isSubstitute: false,
          substitutionMinute: null,
          isGoalkeeper: false,
        },
        {
          playerId: "in-1",
          position: "ST",
          slotKey: null,
          isSubstitute: true,
          substitutionMinute: null,
          isGoalkeeper: false,
        },
      ],
      substitutions: [],
      currentMinute: 62,
      currentPeriod: 2,
    };

    const ok = applyFootballLineupSwap(sport, "home", "out-1", "in-1", {
      minute: 62,
      period: 2,
      teamId: "team-a",
    });

    expect(ok).toBe(true);
    const outPlayer = sport.homeLineup.find((p) => p.playerId === "out-1");
    const inPlayer = sport.homeLineup.find((p) => p.playerId === "in-1");
    expect(outPlayer.substitutionMinute).toBe(62);
    expect(inPlayer.isSubstitute).toBe(false);
    expect(inPlayer.position).toBe("LB");
    expect(inPlayer.slotKey).toBe("LB");
    expect(inPlayer.isGoalkeeper).toBe(false);
  });
});
