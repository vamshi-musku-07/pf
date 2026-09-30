import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import HockeyScoringPanel from "@/components/game/HockeyScoringPanel";

const teamNames = { home: "Falcons", away: "Rangers" };

const players = {
  home: Array.from({ length: 12 }, (_, index) => ({
    _id: `home-${index + 1}`,
    firstName: `Home${index + 1}`,
    lastName: "Player",
    jerseyNumber: index + 1,
  })),
  away: Array.from({ length: 12 }, (_, index) => ({
    _id: `away-${index + 1}`,
    firstName: `Away${index + 1}`,
    lastName: "Player",
    jerseyNumber: index + 1,
  })),
};

const buildLineup = (side) => ({
  onFieldPlayerIds: players[side].slice(0, 11).map((player) => player._id),
  benchPlayerIds: players[side].slice(11).map((player) => player._id),
});

const buildGame = (sportOverrides = {}) => ({
  base: {
    teamId: "home-team",
    opponentTeamId: "away-team",
    status: "live",
    sport: "Hockey",
  },
  sport: {
    score: { home: 2, away: 1 },
    currentQuarter: 2,
    currentPeriod: 2,
    quarterScores: {
      home: [{ quarter: 1, goals: 1 }, { quarter: 2, goals: 1 }],
      away: [{ quarter: 1, goals: 1 }],
    },
    cards: {
      home: { green: 0, yellow: 1, red: 0 },
      away: { green: 0, yellow: 0, red: 0 },
    },
    penaltyCorners: { home: 1, away: 0 },
    penaltyStrokes: { home: 0, away: 0 },
    lineups: {
      home: buildLineup("home"),
      away: buildLineup("away"),
    },
    activeSuspensions: [],
    events: [],
    matchFormat: { structureType: "quarters", periodCount: 4, periodDurationMinutes: 15 },
    ...sportOverrides,
  },
});

describe("HockeyScoringPanel", () => {
  test("records save as a team event without forcing player attribution", async () => {
    const onEvent = jest.fn();

    render(
      <HockeyScoringPanel
        currentGame={buildGame()}
        teamNames={teamNames}
        players={players}
        gameTime={{ minutes: 8, seconds: 42 }}
        isUpdating={false}
        onEvent={onEvent}
        gameOver={false}
        displayOnly={false}
        isScoringTab={true}
      />,
    );

    fireEvent.press(screen.getByText("Save"));
    fireEvent.press(screen.getByText(teamNames.home));
    fireEvent.press(screen.getByTestId("hockey-save-team-option"));

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith("save", "home", null, {});
    });
  });

  test("shows suspension return status and substitution warning for ineligible bench players", () => {
    const currentGame = buildGame({
      currentQuarter: 1,
      currentPeriod: 1,
      activeSuspensions: [
        {
          playerId: "home-12",
          teamId: "home-team",
          teamSide: "home",
          cardType: "yellow_card",
          durationSeconds: 300,
          startedQuarter: 2,
          startedClockSeconds: 600,
          expiresAtElapsedSeconds: 600,
          isActive: true,
          isPermanent: false,
        },
        {
          playerId: "away-12",
          teamId: "away-team",
          teamSide: "away",
          cardType: "green_card",
          durationSeconds: 120,
          startedQuarter: 1,
          startedClockSeconds: 700,
          expiresAtElapsedSeconds: 120,
          isActive: false,
          isPermanent: false,
          releasedQuarter: 1,
          releasedClockSeconds: 580,
          releasedElapsedSeconds: 320,
          returnedToBench: true,
        },
      ],
    });

    render(
      <HockeyScoringPanel
        currentGame={currentGame}
        teamNames={teamNames}
        players={players}
        gameTime={{ minutes: 14, seconds: 30 }}
        isUpdating={false}
        onEvent={() => {}}
        gameOver={false}
        displayOnly={false}
        isScoringTab={true}
      />,
    );

    expect(screen.getByText("Eligible To Return")).toBeTruthy();
    expect(screen.getByText("Resume OK")).toBeTruthy();

    fireEvent.press(screen.getByText("Substitution"));
    fireEvent.press(screen.getByText(teamNames.home));

    expect(screen.getByText("Bench players still serving cards")).toBeTruthy();
  });

  test("renders period breakdown columns even when only one team has later-period scores", () => {
    render(
      <HockeyScoringPanel
        currentGame={buildGame({
          quarterScores: {
            home: [],
            away: [{ quarter: 2, goals: 1 }],
          },
        })}
        teamNames={teamNames}
        players={players}
        gameTime={{ minutes: 5, seconds: 12 }}
        isUpdating={false}
        onEvent={() => {}}
        gameOver={false}
        displayOnly={true}
        isScoringTab={false}
      />,
    );

    expect(screen.getByText("Quarter Breakdown")).toBeTruthy();
    expect(screen.getByText("Q2")).toBeTruthy();
  });
});
