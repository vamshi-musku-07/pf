import createApiService from "@/lib/apiService";
import { TEAM_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const teamApi = createApiService(TEAM_API_URL);

const parseFetchPayload = async (response) => {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

const sendMultipartTeamRequest = async ({ path, method, body, fallbackMessage }) => {
  const token = await getAccessToken();
  const response = await fetch(`${TEAM_API_URL}${path}`, {
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
    error.response = { data: payload };
    throw error;
  }

  return payload;
};

export const createTeamAPI = (teamData) => {
  if (teamData instanceof FormData) {
    return sendMultipartTeamRequest({
      path: "/createteam",
      method: "POST",
      body: teamData,
      fallbackMessage: "Failed to create team",
    });
  }

  return teamApi
    .post("/createteam", teamData)
    .then((response) => response.data);
};

export const getTeamsAPI = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return teamApi.get(`/getteams${qs ? `?${qs}` : ""}`).then((response) => response.data);
};

export const getTeamByIdAPI = (teamId) => {
  return teamApi.get(`/getteam/${teamId}`).then((response) => response.data);
};

export const updateTeamAPI = (teamId, updateData) => {
  if (updateData instanceof FormData) {
    return sendMultipartTeamRequest({
      path: `/updateteam/${teamId}`,
      method: "PUT",
      body: updateData,
      fallbackMessage: "Failed to update team",
    });
  }

  return teamApi
    .put(`/updateteam/${teamId}`, updateData)
    .then((response) => response.data);
};

export const deleteTeamAPI = (teamId) => {
  return teamApi
    .delete(`/deleteteam/${teamId}`)
    .then((response) => response.data);
};

export const checkTeamOwnerAPI = (teamId) => {
  return teamApi
    .get(`/check-owner/${teamId}`)
    .then((response) => response.data);
};

export const addOpponentsAPI = (teamId, opponentId) => {
  return teamApi
    .post("/add-opponents", { teamId, opponentId })
    .then((response) => response.data);
};

export const deleteOpponentAPI = (teamId, opponentId) => {
  return teamApi
    .delete(`/delete-opponent/${teamId}/${opponentId}`)
    .then((response) => response.data);
};

export const getOpponentsAPI = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return teamApi
    .get(`/getopponents${qs ? `?${qs}` : ""}`)
    .then((response) => response.data);
};

export const getStoredOpponentAPI = (opponentId) => {
  return teamApi
    .get(`/opponent/${opponentId}`)
    .then((response) => response.data);
};
