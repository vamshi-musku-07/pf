import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import BadmintonScoringPanel from "@/components/game/BadmintonScoringPanel";

const teamNames = { home: "Falcons", away: "Shuttlers" };

const players = {
  home: [
    { _id: "h1", firstName: "Ava", lastName: "Home" },
    { _id: "h2", firstName: "Mia", lastName: "Home" },
  ],
  away: [
    { _id: "a1", firstName: "Lia", lastName: "Away" },
    { _id: "a2", firstName: "Zoe", lastName: "Away" },
  ],
};

const buildGame = (sportOverrides = {}) => ({
  base: {
    teamId: "home-team",
    opponentTeamId: "away-team",
    status: "live",
  },
  sport: {
    currentGameNumber: 1,
    games: [],
    score: { home: 11, away: 9 },
    serveState: {
      serviceCourt: "left",
      servingPlayerId: "h1",
      receivingPlayerId: "a1",
      home: { leftPlayerId: "h2", rightPlayerId: "h1" },
      away: { leftPlayerId: "a2", rightPlayerId: "a1" },
    },
    activeBreak: null,
    servingTeam: "home",
    matchStatus: "in_progress",
    matchType: "doubles",
    result: { homeGamesWon: 1, awayGamesWon: 0, winner: null },
    events: [
      { _id: "e1", eventType: "pointWon", teamId: "home-team", gameNumber: 1, playerId: "h1", servingTeam: "home" },
      { _id: "e2", eventType: "smash", teamId: "away-team", gameNumber: 1, playerId: "a1", servingTeam: "away" },
      { _id: "e3", eventType: "service_fault", teamId: "away-team", gameNumber: 1, playerId: "a1", servingTeam: "away" },
      { _id: "e4", eventType: "undo", teamId: "home-team", gameNumber: 1, playerId: "h1" },
    ],
    ...sportOverrides,
  },
});

describe("BadmintonScoringPanel", () => {
  test("auto-assigns the expected player for score taps and one-tap let", () => {
    const onScore = jest.fn();

    render(
      <BadmintonScoringPanel
        currentGame={buildGame()}
        teamNames={teamNames}
        players={players}
        isUpdating={false}
        onScore={onScore}
        gameOver={false}
        displayOnly={false}
        isScoringTab={true}
        userSide="home"
      />,
    );

    fireEvent.press(screen.getByTestId("badminton-score-user"));
    expect(onScore).toHaveBeenNthCalledWith(1, "pointWon", "home", expect.objectContaining({ _id: "h1" }));

    fireEvent.press(screen.getByTestId("badminton-let-button"));
    expect(onScore).toHaveBeenNthCalledWith(2, "let", "home", expect.objectContaining({ _id: "h1" }));
  });

  test("locks scoring and shows interval restart guidance during active breaks", () => {
    const onScore = jest.fn();
    const currentGame = buildGame({
      activeBreak: {
        isActive: true,
        breakType: "between_games",
        endsAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    render(
      <BadmintonScoringPanel
        currentGame={currentGame}
        teamNames={teamNames}
        players={players}
        isUpdating={false}
        onScore={onScore}
        gameOver={false}
        displayOnly={false}
        isScoringTab={true}
        userSide="home"
      />,
    );

    expect(screen.getByTestId("badminton-break-banner")).toBeTruthy();
    expect(screen.getByText(/Restart:/)).toBeTruthy();

    fireEvent.press(screen.getByTestId("badminton-score-user"));
    expect(onScore).not.toHaveBeenCalled();
  });

  test("renders stats, rally timeline, and final match summary", () => {
    render(
      <BadmintonScoringPanel
        currentGame={buildGame({
          matchStatus: "final",
          result: { homeGamesWon: 2, awayGamesWon: 1, winner: "home" },
          games: [
            { gameNumber: 1, homeScore: 21, awayScore: 17 },
            { gameNumber: 2, homeScore: 18, awayScore: 21 },
            { gameNumber: 3, homeScore: 21, awayScore: 19 },
          ],
        })}
        teamNames={teamNames}
        players={players}
        isUpdating={false}
        onScore={() => {}}
        gameOver={true}
        displayOnly={true}
        isScoringTab={false}
        userSide="home"
      />,
    );

    expect(screen.getByTestId("badminton-rally-timeline")).toBeTruthy();
    expect(screen.getByTestId("badminton-stats-summary")).toBeTruthy();
    expect(screen.getByTestId("badminton-match-final-summary")).toBeTruthy();
    expect(screen.getByText(/Winner: Falcons/)).toBeTruthy();
    expect(screen.getByText(/Corrections used: 1/)).toBeTruthy();
  });

  test("does not show a scoreboard lock banner during routine sync updates", () => {
    render(
      <BadmintonScoringPanel
        currentGame={buildGame()}
        teamNames={teamNames}
        players={players}
        isUpdating={true}
        onScore={() => {}}
        gameOver={false}
        displayOnly={false}
        isScoringTab={true}
        userSide="home"
      />,
    );

    expect(screen.queryByTestId("badminton-lock-banner")).toBeNull();
    expect(screen.queryByText(/Syncing the last rally with the server/i)).toBeNull();
  });
});