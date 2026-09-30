// Pure helpers for Phase 3 admin features (edit, co-admins, scheduling,
// super over). No React / RN imports so Node can unit-test them directly.

const num = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Build the PUT /tournaments/:id payload from the edit form state.
 * Only whitelisted fields are sent; blank strings clear optional text fields.
 */
const buildEditTournamentPayload = (form = {}, tournament = {}) => {
  const sport = String(tournament.sport || "").toLowerCase();
  const isFootball = sport === "football";
  const isVolleyball = sport === "volleyball";
  const isBaseball = sport === "baseball";
  const isBasketball = sport === "basketball";
  const payload = {
    name: String(form.name || "").trim(),
    season: String(form.season || "").trim(),
    description: String(form.description || "").trim(),
    venue: String(form.venue || "").trim(),
    config: {
      thirdPlace: !!form.thirdPlace,
      ...(isVolleyball
        ? {
            matchFormat: String(form.matchFormat || tournament.config?.matchFormat || "best_of_5"),
            totalSets: num(form.totalSets, tournament.config?.totalSets || 5) === 3 ? 3 : 5,
            setPoints: num(form.setPoints, tournament.config?.setPoints || 25),
            decidingSetPoints: num(form.decidingSetPoints, tournament.config?.decidingSetPoints || 15),
            winByTwo: form.winByTwo !== false && form.winByTwo !== "false",
            pointsWinStraight: num(form.pointsWinStraight, tournament.config?.pointsWinStraight ?? 3),
            pointsWinClose: num(form.pointsWinClose, tournament.config?.pointsWinClose ?? 2),
            pointsLossClose: num(form.pointsLossClose, tournament.config?.pointsLossClose ?? 1),
            pointsLossStraight: num(form.pointsLossStraight, tournament.config?.pointsLossStraight ?? 0),
            pointsNoResult: num(form.pointsNoResult, tournament.config?.pointsNoResult ?? 0),
            pointsWin: num(form.pointsWinStraight, tournament.config?.pointsWinStraight ?? 3),
            pointsTie: 0,
            pointsLoss: num(form.pointsLossStraight, tournament.config?.pointsLossStraight ?? 0),
          }
        : isBaseball
          ? {
              scheduledInnings: Math.max(1, num(form.scheduledInnings, tournament.config?.scheduledInnings || 7)),
              extraInnings: String(form.extraInnings || tournament.config?.extraInnings || "unlimited"),
              extraInningsMax: Math.max(
                0,
                num(form.extraInningsMax, tournament.config?.extraInningsMax || 0),
              ),
              allowPoolTies: form.allowPoolTies !== false && form.allowPoolTies !== "false",
              mercyRuleEnabled: form.mercyRuleEnabled !== false && form.mercyRuleEnabled !== "false",
              mercyRules: Array.isArray(form.mercyRules)
                ? form.mercyRules
                : tournament.config?.mercyRules || [
                    { afterInning: 5, leadRuns: 10 },
                    { afterInning: 7, leadRuns: 8 },
                  ],
              timeLimitMinutes: Math.max(
                0,
                num(form.timeLimitMinutes, tournament.config?.timeLimitMinutes || 0),
              ),
              pointsWin: 1,
              pointsTie: 0.5,
              pointsLoss: 0,
              pointsNoResult: 0,
              superOver: false,
            }
          : isBasketball
            ? {
                matchFormat: "basketball",
                totalQuarters: 4,
                quarterMinutes: Math.max(1, num(form.quarterMinutes, tournament.config?.quarterMinutes || 10)),
                overtimeMinutes: Math.max(1, num(form.overtimeMinutes, tournament.config?.overtimeMinutes || 5)),
                shotClockSeconds: Math.max(1, num(form.shotClockSeconds, tournament.config?.shotClockSeconds || 24)),
                pointsWin: 2,
                pointsTie: 0,
                pointsLoss: 0,
                pointsNoResult: 0,
                superOver: false,
              }
          : {
              pointsWin: num(form.pointsWin, isFootball ? 3 : 2),
              pointsTie: num(form.pointsTie, 1),
              pointsNoResult: num(form.pointsNoResult, isFootball ? 0 : 1),
              ...(isFootball
                ? {
                    extraTime: !!form.extraTime,
                    penaltyShootout: !!form.penaltyShootout,
                  }
                : {
                    superOver: !!form.superOver,
                  }),
            }),
    },
  };
  if (form.startDate) payload.startDate = new Date(form.startDate).toISOString();
  if (form.endDate) payload.endDate = new Date(form.endDate).toISOString();

  const qpd = num(form.qualifiersPerDivision, 0);
  const divisionCount = Math.max(1, (tournament.divisions || []).length || 1);
  const canSetQualifiers =
    tournament.format === "hybrid" &&
    divisionCount > 1 &&
    !tournament.playoffsGenerated &&
    qpd > 0;
  if (canSetQualifiers) {
    payload.config.qualifiersPerDivision = qpd;
    payload.config.playoffSeeding = "per_division";
    payload.config.playoffTeams = divisionCount * qpd;
  }

  return payload;
};

const canEditQualifiersPerDivision = (tournament = {}) =>
  tournament.format === "hybrid" &&
  (tournament.divisions || []).length > 1 &&
  !tournament.playoffsGenerated;

const validateEditTournamentForm = (form = {}) => {
  if (!String(form.name || "").trim()) return "Enter a tournament name";
  if (form.startDate && form.endDate) {
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) return "End date must be on or after the start date";
  }
  return null;
};

/** Owner + co-admins as display rows; profiles keyed by userId. */
const buildAdminRows = (tournament = {}, profiles = {}) => {
  const rows = [];
  const seen = new Set();
  const push = (userId, isOwner) => {
    const uid = userId != null ? String(userId) : "";
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    const profile = profiles[uid] || {};
    rows.push({
      userId: uid,
      isOwner,
      name: profile.fullname || profile.username || profile.email || `User ${uid.slice(-4)}`,
      email: profile.email || "",
    });
  };
  push(tournament.createdBy, true);
  for (const adminId of tournament.admins || []) push(adminId, false);
  return rows;
};

/** Merge a date-only pick with a time-only pick into one Date. */
const combineDateAndTime = (datePart, timePart) => {
  const base = datePart ? new Date(datePart) : new Date();
  const time = timePart ? new Date(timePart) : null;
  const merged = new Date(base);
  if (time) {
    merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
  }
  return merged;
};

const buildScheduleFixturePayload = ({ date, time, venue } = {}) => {
  const payload = {};
  if (date) payload.scheduledAt = combineDateAndTime(date, time).toISOString();
  if (venue !== undefined) payload.venue = String(venue || "").trim();
  return payload;
};

/** Whether the super-over option applies to this fixture. */
const canUseSuperOver = (fixture, tournament) => {
  if (!fixture || fixture.stage === "league") return false;
  const sport = String(tournament?.sport || "").toLowerCase();
  if (sport === "football" || sport === "volleyball" || sport === "baseball" || sport === "basketball") return false;
  return tournament?.config?.superOver !== false;
};

const canUsePenalties = (fixture, tournament) => {
  if (!fixture || fixture.stage === "league") return false;
  if (String(tournament?.sport || "").toLowerCase() !== "football") return false;
  return tournament?.config?.penaltyShootout !== false;
};

/**
 * Multi-select Move to division is available only before fixtures,
 * for non-knockout formats with 2+ divisions, when a bulk handler is wired.
 */
const canBulkMoveTeams = (tournament = {}, { hasBulkHandler = true } = {}) => {
  if (!hasBulkHandler) return false;
  if (tournament.fixturesGenerated) return false;
  if (tournament.format === "knockout") return false;
  return (tournament.divisions || []).length > 1;
};

module.exports = {
  buildEditTournamentPayload,
  validateEditTournamentForm,
  buildAdminRows,
  combineDateAndTime,
  buildScheduleFixturePayload,
  canUseSuperOver,
  canUsePenalties,
  canEditQualifiersPerDivision,
  canBulkMoveTeams,
};
