import createApiService from "@/lib/apiService";
import { GAME_API_URL } from "@/config/api";

const tournamentApi = createApiService(GAME_API_URL);

// ==================== Tournaments CRUD ====================
export const createTournamentAPI = (data) =>
  tournamentApi.post("/tournaments", data).then((r) => r.data);

export const getMyTournamentsAPI = (teamIds = [], memberTeamIds = []) => {
  const owned = (teamIds || []).filter(Boolean).map(String);
  const member = (memberTeamIds || []).filter(Boolean).map(String);
  const params = new URLSearchParams();
  if (owned.length) params.set("teamIds", owned.join(","));
  if (member.length) params.set("memberTeamIds", member.join(","));
  const query = params.toString() ? `?${params.toString()}` : "";
  return tournamentApi.get(`/tournaments${query}`).then((r) => r.data);
};

export const getTournamentsForTeamAPI = (teamId) =>
  tournamentApi.get(`/tournaments/teams/${teamId}`).then((r) => r.data);

// ==================== Divisions ====================
export const getTournamentDivisionsAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/${id}/divisions${query}`).then((r) => r.data);
};

export const createTournamentDivisionAPI = (id, data) =>
  tournamentApi.post(`/tournaments/${id}/divisions`, data).then((r) => r.data);

export const updateTournamentDivisionAPI = (id, divisionId, data) =>
  tournamentApi.put(`/tournaments/${id}/divisions/${divisionId}`, data).then((r) => r.data);

export const deleteTournamentDivisionAPI = (id, divisionId, reassignTo) =>
  tournamentApi
    .delete(`/tournaments/${id}/divisions/${divisionId}`, { data: { reassignTo } })
    .then((r) => r.data);

export const assignTeamDivisionAPI = (id, teamId, divisionId) =>
  tournamentApi
    .put(`/tournaments/${id}/teams/${teamId}/division`, { divisionId })
    .then((r) => r.data);

export const assignDivisionTeamsAPI = (id, divisionId, teamIds) =>
  tournamentApi
    .put(`/tournaments/${id}/divisions/${divisionId}/teams`, { teamIds })
    .then((r) => r.data);

export const getTournamentByIdAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/${id}${query}`).then((r) => r.data);
};

export const updateTournamentAPI = (id, data) =>
  tournamentApi.put(`/tournaments/${id}`, data).then((r) => r.data);

export const deleteTournamentAPI = (id) =>
  tournamentApi.delete(`/tournaments/${id}`).then((r) => r.data);

// ==================== League admins ====================
export const addTournamentAdminAPI = (id, userId) =>
  tournamentApi.post(`/tournaments/${id}/admins`, { userId }).then((r) => r.data);

export const removeTournamentAdminAPI = (id, adminId) =>
  tournamentApi.delete(`/tournaments/${id}/admins/${adminId}`).then((r) => r.data);

// ==================== Team enrollment ====================
export const enrollTeamsAPI = (id, teamIds, divisionId) =>
  tournamentApi
    .post(`/tournaments/${id}/teams`, { teamIds, divisionId })
    .then((r) => r.data);

export const removeTournamentTeamAPI = (id, teamId) =>
  tournamentApi.delete(`/tournaments/${id}/teams/${teamId}`).then((r) => r.data);

// ==================== Team invitations ====================
export const inviteTeamsToTournamentAPI = (id, teamIds, message) =>
  tournamentApi
    .post(`/tournaments/${id}/invites`, { teamIds, message })
    .then((r) => r.data);

export const getTournamentInvitesAPI = (id) =>
  tournamentApi.get(`/tournaments/${id}/invites`).then((r) => r.data);

export const cancelTournamentInviteAPI = (id, teamId) =>
  tournamentApi.delete(`/tournaments/${id}/invites/${teamId}`).then((r) => r.data);

export const getMyTournamentInvitesAPI = () =>
  tournamentApi.get("/tournaments/invites/mine").then((r) => r.data);

export const getTournamentInviteByIdAPI = (inviteId) =>
  tournamentApi.get(`/tournaments/invites/${inviteId}`).then((r) => r.data);

export const acceptTournamentInviteAPI = (inviteId) =>
  tournamentApi.post(`/tournaments/invites/${inviteId}/accept`).then((r) => r.data);

export const declineTournamentInviteAPI = (inviteId) =>
  tournamentApi.post(`/tournaments/invites/${inviteId}/decline`).then((r) => r.data);

// ==================== Join requests ====================
export const createTournamentJoinRequestAPI = (id, teamId, message) =>
  tournamentApi
    .post(`/tournaments/${id}/join-requests`, { teamId, message })
    .then((r) => r.data);

export const getTournamentJoinRequestsAPI = (id, status = "pending") => {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return tournamentApi.get(`/tournaments/${id}/join-requests${query}`).then((r) => r.data);
};

export const getMyTournamentJoinRequestsAPI = () =>
  tournamentApi.get("/tournaments/join-requests/mine").then((r) => r.data);

export const approveTournamentJoinRequestAPI = (id, requestId) =>
  tournamentApi
    .post(`/tournaments/${id}/join-requests/${requestId}/approve`)
    .then((r) => r.data);

export const rejectTournamentJoinRequestAPI = (id, requestId) =>
  tournamentApi
    .post(`/tournaments/${id}/join-requests/${requestId}/reject`)
    .then((r) => r.data);

// ==================== Fixtures & bracket ====================
export const generateFixturesAPI = (id) =>
  tournamentApi.post(`/tournaments/${id}/fixtures/generate`).then((r) => r.data);

export const createTournamentFixtureAPI = (id, data) =>
  tournamentApi.post(`/tournaments/${id}/fixtures`, data).then((r) => r.data);

export const deleteTournamentFixtureAPI = (id, fixtureId) =>
  tournamentApi.delete(`/tournaments/${id}/fixtures/${fixtureId}`).then((r) => r.data);

export const publishLeagueFixturesAPI = (id) =>
  tournamentApi.post(`/tournaments/${id}/fixtures/publish`).then((r) => r.data);

export const fillDivisionRoundRobinAPI = (id, divisionId) =>
  tournamentApi
    .post(`/tournaments/${id}/fixtures/fill-round-robin`, divisionId ? { divisionId } : {})
    .then((r) => r.data);

export const getKnockoutRemainingAPI = (id) =>
  tournamentApi.get(`/tournaments/${id}/fixtures/knockout-remaining`).then((r) => r.data);

export const publishKnockoutRoundAPI = (id, data) =>
  tournamentApi.post(`/tournaments/${id}/fixtures/knockout-round`, data).then((r) => r.data);

export const previewScheduleNotifyAPI = (id) =>
  tournamentApi.get(`/tournaments/${id}/schedule/notify-preview`).then((r) => r.data);

export const notifyCoachesScheduleAPI = (id, data) =>
  tournamentApi.post(`/tournaments/${id}/schedule/notify-coaches`, data).then((r) => r.data);

export const generatePlayoffsAPI = (id) =>
  tournamentApi.post(`/tournaments/${id}/playoffs/generate`).then((r) => r.data);

export const previewPlayoffsAPI = (id) =>
  tournamentApi.get(`/tournaments/${id}/playoffs/preview`).then((r) => r.data);

export const getFixturesAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/${id}/fixtures${query}`).then((r) => r.data);
};

export const updateFixtureAPI = (id, fixtureId, data) =>
  tournamentApi
    .put(`/tournaments/${id}/fixtures/${fixtureId}`, data)
    .then((r) => r.data);

export const createFixtureGameAPI = (id, fixtureId) =>
  tournamentApi
    .post(`/tournaments/${id}/fixtures/${fixtureId}/game`)
    .then((r) => r.data);

export const setFixtureResultAPI = (id, fixtureId, data) =>
  tournamentApi
    .post(`/tournaments/${id}/fixtures/${fixtureId}/result`, data)
    .then((r) => r.data);

// ==================== Standings ====================
export const getStandingsAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/${id}/standings${query}`).then((r) => r.data);
};

export const recalcStandingsAPI = (id) =>
  tournamentApi.post(`/tournaments/${id}/standings/recalc`).then((r) => r.data);

// ==================== Player leaderboard ====================
export const getTournamentLeaderboardAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/${id}/leaderboard${query}`).then((r) => r.data);
};

export const recalcTournamentLeaderboardAPI = (id, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.post(`/tournaments/${id}/leaderboard/recalc${query}`).then((r) => r.data);
};

// ==================== Public (shareable) ====================
export const getPublicTournamentAPI = (code, divisionId) => {
  const query = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : "";
  return tournamentApi.get(`/tournaments/public/${code}${query}`).then((r) => r.data);
};

export const browsePublicTournamentsAPI = (params = {}) => {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.sport) search.set("sport", params.sport);
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString() ? `?${search.toString()}` : "";
  return tournamentApi.get(`/tournaments/public${query}`, { isPublic: true }).then((r) => r.data);
};

export const browsePublicSportsAPI = () =>
  tournamentApi.get("/tournaments/public/sports", { isPublic: true }).then((r) => r.data);

export const getPublicTournamentFeedAPI = (params = {}) => {
  const search = new URLSearchParams();
  if (params.sport) search.set("sport", params.sport);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString() ? `?${search.toString()}` : "";
  return tournamentApi.get(`/tournaments/public/feed${query}`, { isPublic: true }).then((r) => r.data);
};
