import { resolveTournamentSportIcon } from "@/lib/tournamentSportIcon";
import { CREATE_TEAM_SPORT_ICONS } from "@/constants/sports";

describe("resolveTournamentSportIcon", () => {
  it("resolves exact sport keys", () => {
    expect(resolveTournamentSportIcon("Football")).toBe(CREATE_TEAM_SPORT_ICONS.Football);
    expect(resolveTournamentSportIcon("Cricket")).toBe(CREATE_TEAM_SPORT_ICONS.Cricket);
  });

  it("resolves case-insensitive and aliases", () => {
    expect(resolveTournamentSportIcon("football")).toBe(CREATE_TEAM_SPORT_ICONS.Football);
    expect(resolveTournamentSportIcon("soccer")).toBe(CREATE_TEAM_SPORT_ICONS.Football);
    expect(resolveTournamentSportIcon("Ice Hockey")).toBe(CREATE_TEAM_SPORT_ICONS.IceHockey);
    expect(resolveTournamentSportIcon("table tennis")).toBe(CREATE_TEAM_SPORT_ICONS.TableTennis);
  });

  it("falls back to cricket when unknown", () => {
    expect(resolveTournamentSportIcon("")).toBe(CREATE_TEAM_SPORT_ICONS.Cricket);
    expect(resolveTournamentSportIcon("UnknownSport")).toBe(CREATE_TEAM_SPORT_ICONS.Cricket);
  });
});
