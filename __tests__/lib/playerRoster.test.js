import { describe, expect, test } from "@jest/globals";
import {
  extractPlayersFromApiResponse,
  isExternalLiveSpectator,
  isUserEmailOnRoster,
  isUserLinkedToRoster,
  mergeRosterLists,
  normalizeTeamId,
  playersForTeamId,
  rostersForGame,
} from "@/lib/playerRoster";

describe("playerRoster", () => {
  test("normalizeTeamId handles populated objects", () => {
    expect(normalizeTeamId({ _id: "abc123" })).toBe("abc123");
    expect(normalizeTeamId(" team1 ")).toBe("team1");
  });

  test("extractPlayersFromApiResponse reads nested data", () => {
    const players = [{ id: "p1", firstName: "A" }];
    expect(extractPlayersFromApiResponse({ success: true, data: players })).toEqual(players);
    expect(extractPlayersFromApiResponse(players)).toEqual(players);
  });

  test("mergeRosterLists prefers later entries and normalizes ids", () => {
    const merged = mergeRosterLists(
      [{ id: "p1", firstName: "Seed" }],
      [{ _id: "p1", firstName: "API", lastName: "Player" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].firstName).toBe("API");
    expect(merged[0].id).toBe("p1");
    expect(merged[0]._id).toBe("p1");
  });

  test("playersForTeamId matches by player.teamId", () => {
    const list = [
      { id: "p1", teamId: "team-a", firstName: "A" },
      { id: "p2", teamId: "team-b", firstName: "B" },
    ];
    expect(playersForTeamId(list, "team-a")).toHaveLength(1);
    expect(playersForTeamId(list, "team-b")[0].firstName).toBe("B");
  });

  test("rostersForGame maps team ids to home/away with teamId fallback", () => {
    const mapped = rostersForGame(
      { teamId: "home1", opponentTeamId: "away1" },
      {
        wrongKey: [{ id: "h1", teamId: "home1" }],
        away1: [{ id: "a1", teamId: "away1" }],
      },
    );
    expect(mapped.home).toHaveLength(1);
    expect(mapped.away).toHaveLength(1);
  });

  test("isUserEmailOnRoster matches player and parent emails", () => {
    const roster = [
      { email: "Player@team.com" },
      { parentEmail: "parent@team.com" },
    ];
    expect(isUserEmailOnRoster("player@team.com", roster)).toBe(true);
    expect(isUserEmailOnRoster("parent@team.com", roster)).toBe(true);
    expect(isUserEmailOnRoster("stranger@x.com", roster)).toBe(false);
  });

  test("isExternalLiveSpectator limits tabs for outside viewers only", () => {
    const roster = [{ email: "player@team.com", userId: "u1" }];
    expect(
      isExternalLiveSpectator({
        isSpectate: true,
        isOwner: false,
        user: { email: "fan@x.com" },
        players: roster,
      }),
    ).toBe(true);
    expect(
      isExternalLiveSpectator({
        isSpectate: true,
        isOwner: false,
        user: { email: "player@team.com" },
        players: roster,
      }),
    ).toBe(false);
    expect(
      isExternalLiveSpectator({
        isSpectate: true,
        isOwner: true,
        user: { email: "fan@x.com" },
        players: roster,
      }),
    ).toBe(false);
  });
});
