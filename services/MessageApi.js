import createApiService from "@/lib/apiService";
import { MESSAGE_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const messageApi = createApiService(MESSAGE_API_URL);

const parseUploadResponse = async (response) => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

// Core endpoints
export const getTeamMessagesAPI = (teamId, params = {}) =>
  messageApi.get(`/team/${teamId}`, { params }).then((r) => r.data);

export const getUnreadCountAPI = (teamId) =>
  messageApi.get(`/team/${teamId}/unread`).then((r) => r.data);

export const searchMessagesAPI = (teamId, searchQuery, params = {}) =>
  messageApi
    .get(`/team/${teamId}/search`, { params: { ...params, query: searchQuery } })
    .then((r) => r.data);

export const getMessageAPI = (messageId) =>
  messageApi.get(`/${messageId}`).then((r) => r.data);

export const createMessageAPI = (messageData) =>
  messageApi.post("/", messageData).then((r) => r.data);

/** RN multipart must use fetch — axios often fails on Android for file uploads. */
export const uploadMediaAPI = async (formData) => {
  const token = await getAccessToken();
  const response = await fetch(`${MESSAGE_API_URL}/upload-media`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const payload = await parseUploadResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.message || "Failed to upload media");
    error.response = { data: payload, status: response.status };
    throw error;
  }
  return payload;
};

export const deleteMessageAPI = (messageId) =>
  messageApi.delete(`/${messageId}`).then((r) => r.data);

export const updateMessageAPI = (messageId, data) =>
  messageApi.patch(`/${messageId}`, data).then((r) => r.data);

// Additional endpoints
export const markAsReadAPI = (messageId, userId) =>
  messageApi.post(`/${messageId}/read`, { userId }).then((r) => r.data);

export const toggleMessageReactionAPI = (messageId, key) =>
  messageApi.post(`/${messageId}/reactions`, { key }).then((r) => r.data);

export const getRecentMessagesAPI = (params = {}) =>
  messageApi.get("/recent", { params }).then((r) => r.data);

export const getMessagesBySenderAPI = (senderId, params = {}) =>
  messageApi.get(`/sender/${senderId}`, { params }).then((r) => r.data);

export const markMultipleAsReadAPI = (messageIds, userId) =>
  messageApi.post("/bulk-read", { messageIds, userId }).then((r) => r.data);

export const restoreMessageAPI = (messageId) =>
  messageApi.post(`/${messageId}/restore`).then((r) => r.data);

export const getMessageStatsAPI = (teamId, params = {}) =>
  messageApi.get(`/team/${teamId}/stats`, { params }).then((r) => r.data);
