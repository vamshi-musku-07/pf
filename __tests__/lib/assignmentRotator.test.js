import {
  computeFairAssignments,
  normalizeDutyKey,
  getDefaultRotationEvent,
  buildFallbackTeamMessage,
  formatEventLabel,
} from "@/lib/assignmentRotator";

const players = [
  { _id: "p1", firstName: "Alex", lastName: "Singh", userId: "u1" },
  { _id: "p2", firstName: "Ben", lastName: "Kumar", userId: "u2" },
  { _id: "p3", firstName: "Chris", lastName: "Patel", userId: "u3" },
];

const assignmentOptions = [
  { value: "scorer", label: "Scorer" },
  { value: "umpire", label: "Umpire" },
  { value: "drinks", label: "Drinks Duty" },
];

const schedules = [
  { _id: "g1", eventType: "game", date: "2026-06-01T10:00:00Z", opponentName: "Tigers" },
  { _id: "g2", eventType: "game", date: "2026-06-08T10:00:00Z", opponentName: "Lions" },
  { _id: "g3", eventType: "game", date: "2026-06-15T10:00:00Z", opponentName: "Bears" },
  { _id: "g4", eventType: "game", date: "2026-07-20T10:00:00Z", opponentName: "Wolves" },
  { _id: "p1", eventType: "practice", date: "2026-07-10T10:00:00Z", title: "Net session" },
  { _id: "p2", eventType: "practice", date: "2026-07-17T10:00:00Z", title: "Fielding drill" },
  { _id: "p3", eventType: "practice", date: "2026-07-24T10:00:00Z", title: "Bowling practice" },
];

describe("assignmentRotator", () => {
  test("normalizeDutyKey maps labels to option values", () => {
    expect(normalizeDutyKey("Scorer", assignmentOptions)).toBe("scorer");
    expect(normalizeDutyKey("Drinks Duty", assignmentOptions)).toBe("drinks");
  });

  test("picks players with lowest recent duty counts for games", () => {
    const assignments = [
      { eventId: "g3", eventType: "game", assignment: "Scorer", assignedToId: "u1" },
      { eventId: "g2", eventType: "game", assignment: "Scorer", assignedToId: "u1" },
      { eventId: "g1", eventType: "game", assignment: "Scorer", assignedToId: "u2" },
      { eventId: "g3", eventType: "game", assignment: "Umpire", assignedToId: "u2" },
      { eventId: "g2", eventType: "game", assignment: "Drinks Duty", assignedToId: "u3" },
    ];

    const { picks } = computeFairAssignments({
      players,
      assignments,
      schedules,
      assignmentOptions,
      sport: "Cricket",
      eventId: "g4",
      eventType: "game",
      lookbackEvents: 3,
    });

    const scorer = picks.find((p) => p.dutyValue === "scorer");
    expect(scorer.playerId).toBe("u3");
    expect(picks).toHaveLength(3);
  });

  test("uses practice history only when assigning for a practice", () => {
    const assignments = [
      { eventId: "p2", eventType: "practice", assignment: "Scorer", assignedToId: "u1" },
      { eventId: "p1", eventType: "practice", assignment: "Scorer", assignedToId: "u1" },
      { eventId: "g3", eventType: "game", assignment: "Scorer", assignedToId: "u1" },
    ];

    const { picks } = computeFairAssignments({
      players,
      assignments,
      schedules,
      assignmentOptions,
      sport: "Cricket",
      eventId: "p3",
      eventType: "practice",
      lookbackEvents: 3,
    });

    const scorer = picks.find((p) => p.dutyValue === "scorer");
    expect(scorer.playerId).not.toBe("u1");
    expect(scorer.reason).toMatch(/practices/i);
  });

  test("getDefaultRotationEvent prefers next upcoming event of any type", () => {
    const next = getDefaultRotationEvent(schedules);
    expect(next._id).toBe("p1");
  });

  test("formatEventLabel includes event type", () => {
    expect(formatEventLabel(schedules[4])).toMatch(/Practice/);
  });

  test("buildFallbackTeamMessage includes coach name and duties", () => {
    const msg = buildFallbackTeamMessage({
      teamName: "Warriors",
      coachName: "Coach Sam",
      eventTitle: "vs Wolves",
      eventType: "game",
      picks: [{ dutyLabel: "Scorer", playerName: "Alex Singh" }],
    });
    expect(msg).toMatch(/Warriors/);
    expect(msg).toMatch(/Scorer: Alex Singh/);
    expect(msg).toMatch(/Coach Sam/);
  });
});
