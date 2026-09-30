jest.mock("@/lib/hockeyTombstones", () => ({
  logHockeyCardDebug: jest.fn(),
}));

import {
  applyOptimisticHockeyUndo,
  applyOptimisticHockeyUpdate,
  deriveHockeyClientGame,
  findCommittedHockeyServerEventIndex,
  getHockeyEventContentFingerprint,
  getHockeyEventLooseFingerprint,
  getHockeyReplaySeedLineups,
  pruneCommittedHockeyPendingActions,
  replayPendingHockeyActions,
} from "@/components/game/hooks/hockeyState";

const buildGame = (sportOverrides = {}) => {
  const homeField = Array.from({ length: 11 }, (_, i) => `home-p${i + 1}`);
  const homeBench = ["home-p12"];
  return {
    base: {
      sport: "Hockey",
      teamId: "home-team",
      opponentTeamId: "away-team",
    },
    sport: {
      score: { home: 0, away: 0 },
      currentQuarter: 1,
      quarterTime: "15:00",
      periodTime: "15:00",
      cards: { home: { green: 0, yellow: 0, red: 0 }, away: { green: 0, yellow: 0, red: 0 } },
      lineups: {
        home: { onFieldPlayerIds: homeField, benchPlayerIds: homeBench },
        away: { onFieldPlayerIds: [], benchPlayerIds: [] },
      },
      initialLineups: {
        home: { onFieldPlayerIds: homeField, benchPlayerIds: homeBench },
        away: { onFieldPlayerIds: [], benchPlayerIds: [] },
      },
      activeSuspensions: [],
      events: [],
      matchFormat: { structureType: "quarters", periodCount: 4, periodDurationMinutes: 15 },
      ...sportOverrides,
    },
  };
};

const cardEvent = (eventType, playerId, issuedAt) => ({
  eventType,
  teamId: "home-team",
  teamSide: "home",
  playerId,
  quarter: 1,
  gameTime: "14:00",
  suspensionStartedAt: issuedAt,
});

const goalEvent = (overrides = {}) => ({
  eventType: "goal",
  teamId: "home-team",
  teamSide: "home",
  playerId: "home-p1",
  quarter: 1,
  gameTime: "14:00",
  ...overrides,
});

describe("hockeyState cards and undo", () => {
  test("green card moves player to bench instead of removing from both lists", () => {
    const game = buildGame();
    const issuedAt = new Date().toISOString();
    const next = applyOptimisticHockeyUpdate(game, cardEvent("green_card", "home-p1", issuedAt), {
      savedLineups: getHockeyReplaySeedLineups(game.sport, []),
    });

    const lineup = next.sport.lineups.home;
    expect(lineup.onFieldPlayerIds).not.toContain("home-p1");
    expect(lineup.benchPlayerIds).toContain("home-p1");
    expect(next.sport.activeSuspensions.filter((s) => s.isActive)).toHaveLength(1);
  });

  test("undo removes only the latest card when earlier cards are tombstoned", () => {
    const now = Date.now();
    const t1 = new Date(now - 3000).toISOString();
    const t2 = new Date(now - 2000).toISOString();
    const t3 = new Date(now - 1000).toISOString();
    const seed = getHockeyReplaySeedLineups(buildGame().sport, []);

    let game = buildGame();
    game = applyOptimisticHockeyUpdate(game, cardEvent("yellow_card", "home-p2", t1), { savedLineups: seed });
    game = applyOptimisticHockeyUpdate(game, cardEvent("green_card", "home-p3", t2), { savedLineups: seed });
    game = applyOptimisticHockeyUpdate(game, cardEvent("red_card", "home-p4", t3), { savedLineups: seed });

    expect(game.sport.activeSuspensions.filter((s) => s.isActive)).toHaveLength(3);

    const tombstones = new Set();
    const { nextGame, removedEvent } = applyOptimisticHockeyUndo(game, {
      teamSide: "home",
      savedLineups: seed,
      suppressedFingerprints: tombstones,
    });

    expect(removedEvent?.eventType).toBe("red_card");
    tombstones.add(getHockeyEventLooseFingerprint(removedEvent));

    const derived = deriveHockeyClientGame(
      { ...game, sport: { ...game.sport, events: game.sport.events } },
      tombstones,
    );

    const active = derived.sport.activeSuspensions.filter((s) => s.isActive);
    expect(active).toHaveLength(2);
    expect(active.map((s) => s.cardType).sort()).toEqual(["green_card", "yellow_card"]);

    const pendingReplay = replayPendingHockeyActions(derived, [{ id: "undo-1", type: "undo", teamSide: "home" }], {
      savedLineups: seed,
      suppressedFingerprints: tombstones,
    });
    expect(pendingReplay.sport.activeSuspensions.filter((s) => s.isActive)).toHaveLength(2);
    expect(nextGame.sport.activeSuspensions.filter((s) => s.isActive)).toHaveLength(2);
  });

  test("undo restores carded player to on-field when card is removed", () => {
    const issuedAt = new Date().toISOString();
    const seed = getHockeyReplaySeedLineups(buildGame().sport, []);
    let game = buildGame();
    game = applyOptimisticHockeyUpdate(game, cardEvent("yellow_card", "home-p1", issuedAt), { savedLineups: seed });

    const { nextGame } = applyOptimisticHockeyUndo(game, { teamSide: "home", savedLineups: seed });
    expect(nextGame.sport.lineups.home.onFieldPlayerIds).toContain("home-p1");
    expect(nextGame.sport.activeSuspensions.filter((s) => s.isActive)).toHaveLength(0);
  });
});

describe("hockeyState score reconcile dedup", () => {
  test("content fingerprints ignore optimistic id vs server timestamp", () => {
    const optimistic = goalEvent({ _optimisticId: "hockey-1-1" });
    const server = goalEvent({ timestamp: "2026-08-11T04:00:00.000Z" });
    expect(getHockeyEventContentFingerprint(optimistic)).toBe(
      getHockeyEventContentFingerprint(server),
    );
    expect(getHockeyEventLooseFingerprint(optimistic)).not.toBe(
      getHockeyEventLooseFingerprint(server),
    );
  });

  test("pending goal already on server via clientEventId does not overshoot", () => {
    const seed = getHockeyReplaySeedLineups(buildGame().sport, []);
    const serverGoal = goalEvent({
      clientEventId: "hockey-123-1",
      timestamp: "2026-08-11T04:00:00.000Z",
    });
    let serverGame = buildGame();
    serverGame = applyOptimisticHockeyUpdate(serverGame, serverGoal, { savedLineups: seed });
    expect(serverGame.sport.score.home).toBe(1);

    const pendingGoal = goalEvent({
      _optimisticId: "hockey-123-1",
      clientEventId: "hockey-123-1",
    });
    const reconciled = replayPendingHockeyActions(
      serverGame,
      [{
        id: "hockey-123-1",
        type: "event",
        payload: pendingGoal,
        baselineEventCount: 0,
      }],
      { savedLineups: seed },
    );

    expect(reconciled.sport.score.home).toBe(1);
  });

  test("new goal at frozen clock is not mistaken for the previous goal", () => {
    const seed = getHockeyReplaySeedLineups(buildGame().sport, []);
    const existingGoal = goalEvent({
      clientEventId: "hockey-old",
      timestamp: "2026-08-11T03:59:00.000Z",
    });
    let serverGame = buildGame();
    serverGame = applyOptimisticHockeyUpdate(serverGame, existingGoal, { savedLineups: seed });
    expect(serverGame.sport.score.home).toBe(1);

    // Stale hydrate: server still only has the first goal.
    const pendingNewGoal = goalEvent({
      _optimisticId: "hockey-new",
      clientEventId: "hockey-new",
    });
    const whileInFlight = replayPendingHockeyActions(
      serverGame,
      [{
        id: "hockey-new",
        type: "event",
        payload: pendingNewGoal,
        baselineEventCount: 1,
      }],
      { savedLineups: seed },
    );
    expect(whileInFlight.sport.score.home).toBe(2);

    // Must NOT prune the in-flight goal just because content matches the older one.
    const kept = pruneCommittedHockeyPendingActions(
      [{
        id: "hockey-new",
        type: "event",
        payload: pendingNewGoal,
        baselineEventCount: 1,
      }],
      serverGame.sport.events,
    );
    expect(kept.map((a) => a.id)).toEqual(["hockey-new"]);

    // After commit, server has both goals (second carries clientEventId).
    let committed = applyOptimisticHockeyUpdate(
      serverGame,
      goalEvent({
        clientEventId: "hockey-new",
        timestamp: "2026-08-11T04:00:00.000Z",
      }),
      { savedLineups: seed },
    );
    expect(committed.sport.score.home).toBe(2);

    const afterCommit = replayPendingHockeyActions(
      committed,
      [{
        id: "hockey-new",
        type: "event",
        payload: pendingNewGoal,
        baselineEventCount: 1,
      }],
      { savedLineups: seed },
    );
    expect(afterCommit.sport.score.home).toBe(2);
    expect(pruneCommittedHockeyPendingActions(
      [{
        id: "hockey-new",
        type: "event",
        payload: pendingNewGoal,
        baselineEventCount: 1,
      }],
      committed.sport.events,
    )).toEqual([]);
  });

  test("findCommittedHockeyServerEventIndex prefers clientEventId over content", () => {
    const serverEvents = [
      goalEvent({ clientEventId: "a", timestamp: "t1" }),
      goalEvent({ clientEventId: "b", timestamp: "t2" }),
    ];
    const action = {
      id: "b",
      type: "event",
      baselineEventCount: 0,
      payload: goalEvent({ clientEventId: "b", _optimisticId: "b" }),
    };
    expect(findCommittedHockeyServerEventIndex(action, serverEvents)).toBe(1);
  });

  test("shot on target does not double-apply on reconcile", () => {
    const seed = getHockeyReplaySeedLineups(buildGame().sport, []);
    const serverShot = {
      eventType: "shot_missed",
      teamId: "home-team",
      teamSide: "home",
      playerId: "home-p1",
      quarter: 1,
      gameTime: "13:20",
      clientEventId: "hockey-shot-1",
      timestamp: "2026-08-11T04:00:01.000Z",
    };
    let serverGame = buildGame();
    serverGame = applyOptimisticHockeyUpdate(serverGame, serverShot, { savedLineups: seed });
    const before = serverGame.sport.events.filter((e) => e.eventType === "shot_missed").length;

    const pendingShot = {
      ...serverShot,
      _optimisticId: "hockey-shot-1",
      timestamp: undefined,
    };
    const reconciled = replayPendingHockeyActions(
      serverGame,
      [{
        id: "hockey-shot-1",
        type: "event",
        payload: pendingShot,
        baselineEventCount: 0,
      }],
      { savedLineups: seed },
    );

    expect(reconciled.sport.events.filter((e) => e.eventType === "shot_missed")).toHaveLength(before);
  });
});
