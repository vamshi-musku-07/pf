import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import IceHockeyScoringPanel from "@/components/game/IceHockeyScoringPanel";

const teamNames = { home: "Falcons", away: "Rangers" };

const players = {
  home: [
    { _id: "h1", firstName: "Home", lastName: "One", position: "C" },
    { _id: "h2", firstName: "Home", lastName: "Two", position: "D" },
    { _id: "hg", firstName: "Home", lastName: "Goalie", position: "Goalie" },
  ],
  away: [
    { _id: "a1", firstName: "Away", lastName: "One", position: "C" },
    { _id: "a2", firstName: "Away", lastName: "Two", position: "D" },
    { _id: "ag", firstName: "Away", lastName: "Goalie", position: "Goalie" },
  ],
};

const buildGame = () => ({
  base: {
    teamId: "home-team",
    opponentTeamId: "away-team",
    status: "live",
    sport: "IceHockey",
  },
  sport: {
    score: { home: 1, away: 0 },
    shots: { home: 4, away: 3 },
    faceoffs: { home: 0, away: 0 },
    hits: { home: 0, away: 0 },
    blockedShots: { home: 0, away: 0 },
    takeaways: { home: 0, away: 0 },
    giveaways: { home: 0, away: 0 },
    penaltyMinutes: { home: 0, away: 0 },
    powerPlays: {
      home: { opportunities: 0, goals: 0 },
      away: { opportunities: 0, goals: 0 },
    },
    currentPeriod: 1,
    events: [],
    activePenalties: [],
    onIce: {
      home: { rosterPlayerIds: ["h1", "h2", "hg"], skaterIds: ["h1", "h2"], goalieId: "hg", goaliePulled: false },
      away: { rosterPlayerIds: ["a1", "a2", "ag"], skaterIds: ["a1", "a2"], goalieId: "ag", goaliePulled: false },
    },
    strength: {
      home: { skaters: 5 },
      away: { skaters: 5 },
      label: "5v5",
    },
  },
});

describe("IceHockeyScoringPanel", () => {
  test("keeps stat controls responsive during an in-flight sync", () => {
    render(
      <IceHockeyScoringPanel
        currentGame={buildGame()}
        players={players}
        teamNames={teamNames}
        gameTime={{ minutes: 12, seconds: 15 }}
        isUpdating={true}
        onEvent={() => {}}
        gameOver={false}
        displayOnly={false}
      />,
    );

    fireEvent.press(screen.getAllByText("Shot")[0]);

    expect(screen.getByText("SHOT ON GOAL")).toBeTruthy();
  });

  test("queues rapid team-only taps without dropping the second tap", async () => {
    const onEvent = jest.fn();

    render(
      <IceHockeyScoringPanel
        currentGame={buildGame()}
        players={players}
        teamNames={teamNames}
        gameTime={{ minutes: 12, seconds: 15 }}
        isUpdating={true}
        onEvent={onEvent}
        gameOver={false}
        displayOnly={false}
      />,
    );

    const homeIcingButton = screen.getAllByText("HOME")[0];
    fireEvent.press(homeIcingButton);
    fireEvent.press(homeIcingButton);

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledTimes(2);
    });
    expect(onEvent).toHaveBeenNthCalledWith(1, "icing", "home", null, {});
    expect(onEvent).toHaveBeenNthCalledWith(2, "icing", "home", null, {});
  });
});
