// Pure helpers for "Mine" tournament list filtering and labels.

const resolveUserId = (user = {}) =>
  String(user.userId || user.id || user._id || "").trim();

const filterMineTournaments = (list = [], userId, ownedTeamIds = [], memberTeamIds = []) => {
  const uid = String(userId || "").trim();
  if (!uid) return [];
  const teamSet = new Set(
    [...(ownedTeamIds || []), ...(memberTeamIds || [])].map(String).filter(Boolean),
  );
  return (Array.isArray(list) ? list : []).filter((t) => {
    if (String(t.createdBy) === uid) return true;
    if ((t.admins || []).some((a) => String(a) === uid)) return true;
    if (
      teamSet.size > 0 &&
      (t.teams || []).some((team) => teamSet.has(String(team.teamId)))
    ) {
      return true;
    }
    return false;
  });
};

const tournamentMineRoleLabel = (tournament = {}, userId, ownedTeamIds = [], memberTeamIds = []) => {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  if (String(tournament.createdBy) === uid) return "Organizing";
  if ((tournament.admins || []).some((a) => String(a) === uid)) return "Co-admin";
  const teamSet = new Set(
    [...(ownedTeamIds || []), ...(memberTeamIds || [])].map(String).filter(Boolean),
  );
  const enrolled = (tournament.teams || []).find((t) => teamSet.has(String(t.teamId)));
  if (enrolled?.teamName) return `Team: ${enrolled.teamName}`;
  if (enrolled) return "Your team";
  return null;
};

module.exports = {
  resolveUserId,
  filterMineTournaments,
  tournamentMineRoleLabel,
};
