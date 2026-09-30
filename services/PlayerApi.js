import createApiService from "@/lib/apiService";
import { PLAYER_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const playerApi = createApiService(PLAYER_API_URL);

const parseFetchPayload = async (response) => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

/**
 * React Native multipart uploads must use fetch (not axios) and must NOT set
 * Content-Type manually — the runtime adds the boundary. Team/profile uploads
 * already follow this pattern; player create/update now match it.
 */
const sendMultipartPlayerRequest = async ({ path, method, body, fallbackMessage }) => {
  const token = await getAccessToken();
  const response = await fetch(`${PLAYER_API_URL}${path}`, {
    method,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body,
  });

  const payload = await parseFetchPayload(response);

  if (!response.ok) {
    const error = new Error(payload?.message || fallbackMessage);
    error.response = { data: payload, status: response.status };
    throw error;
  }

  return payload;
};

export const getUserInvitationsAPI = () => {
  return playerApi.get("/user/invitations").then((response) => response.data);
};

export const getNotificationInboxAPI = (limit = 50) => {
  return playerApi
    .get("/notifications/inbox", { params: { limit } })
    .then((response) => response.data);
};

export const acceptInvitationAPI = (token, email) => {
  return playerApi
    .post("/invitations/accept", { token, email })
    .then((response) => response.data);
};

export const createTeamJoinLinkAPI = (teamId) => {
  return playerApi
    .post(`/team/${teamId}/join-link`)
    .then((response) => response.data);
};

export const validateTeamJoinLinkAPI = (token) => {
  return playerApi
    .get(`/join-links/${encodeURIComponent(token)}`)
    .then((response) => response.data);
};

export const acceptTeamJoinLinkAPI = (token, data) => {
  if (data instanceof FormData) {
    return sendMultipartPlayerRequest({
      path: `/join-links/${encodeURIComponent(token)}/accept`,
      method: "POST",
      body: data,
      fallbackMessage: "Failed to accept join link",
    });
  }
  return playerApi
    .post(`/join-links/${encodeURIComponent(token)}/accept`, data)
    .then((response) => response.data);
};

export const checkJerseyNumberAPI = (teamId, jerseyNumber, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return playerApi
    .get(`/team/${teamId}/jersey/${jerseyNumber}/availability${qs ? `?${qs}` : ""}`)
    .then((response) => response.data);
};

export const dismissInvitationAPI = (invitationId) => {
  return playerApi
    .delete(`/user/invitations/${invitationId}`)
    .then((response) => response.data);
};

export const validateInvitationAPI = (token, email) => {
  return playerApi
    .get(`/invitations/validate?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
    .then((response) => response.data);
};

export const createPlayerAPI = (playerData) => {
  if (playerData instanceof FormData) {
    return sendMultipartPlayerRequest({
      path: "/createplayer",
      method: "POST",
      body: playerData,
      fallbackMessage: "Failed to create player",
    });
  }
  return playerApi
    .post("/createplayer", playerData)
    .then((response) => response.data);
};

export const getPlayersByTeamAPI = (teamId) => {
  return playerApi
    .get(`/team/${teamId}`)
    .then((response) => response.data);
};

export const deletePlayerAPI = (playerId) =>
  playerApi.delete(`/${playerId}`).then((response) => response.data);

export const updatePlayerAPI = (playerId, data) => {
  if (data instanceof FormData) {
    return sendMultipartPlayerRequest({
      path: `/${playerId}`,
      method: "PUT",
      body: data,
      fallbackMessage: "Failed to update player",
    });
  }
  return playerApi.put(`/${playerId}`, data).then((response) => response.data);
};

export const checkIsManagerAPI = (teamId) =>
  playerApi.get(`/check-manager/${teamId}`).then((response) => response.data);
