import createApiService from "@/lib/apiService";
import { AVAILABILITY_API_URL } from "@/config/api";

const api = createApiService(AVAILABILITY_API_URL);

// Personal availability
export const updateMyAvailabilityAPI = (availability, eventType = "game", teamId = null) => {
  const body = { availability, eventType };
  if (teamId) body.teamId = teamId;
  return api.put("/me", body).then((r) => r.data);
};

export const getMyAvailabilityAPI = () =>
  api.get("/me").then((r) => r.data);

export const getAllMyAvailabilitiesAPI = () =>
  api.get("/me/all").then((r) => r.data);

// Team availability
export const getTeamAvailabilityAPI = (teamId, eventType = "game") =>
  api.get(`/teams/${teamId}?eventType=${eventType}`).then((r) => r.data);

export const getTeamAllAvailabilitiesAPI = (teamId) =>
  api.get(`/teams/${teamId}/all`).then((r) => r.data);

export const bulkUpdateAvailabilityAPI = (teamId, updates) =>
  api.put(`/teams/${teamId}/bulk`, { updates }).then((r) => r.data);

// Player availability (admin/coach)
export const getPlayerAvailabilityAPI = (playerId) =>
  api.get(`/players/${playerId}`).then((r) => r.data);

// Event availability
export const getEventsWithAvailabilityAPI = (teamId) =>
  api.get(`/teams/${teamId}/events`).then((r) => r.data);

export const setEventAvailabilityAPI = (eventId, availability) =>
  api.put(`/events/${eventId}`, { availability }).then((r) => r.data);
