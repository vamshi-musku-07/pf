import createApiService from "@/lib/apiService";
import { POST_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const postApi = createApiService(POST_API_URL);

const parseJsonResponse = async (response) => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

/**
 * Create post — images as JSON+base64 (Android-safe), videos as multipart.
 * payload: { kind: "json"|"multipart", body }
 */
export const createPostAPI = async (payload) => {
  const token = await getAccessToken();
  const uploadUrl = `${POST_API_URL.replace(/\/+$/, "")}/`;
  const isJson = payload?.kind === "json";

  let response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(isJson ? { "Content-Type": "application/json" } : {}),
      },
      body: isJson ? JSON.stringify(payload.body) : payload.body,
    });
  } catch (error) {
    const host = (() => {
      try {
        return new URL(uploadUrl).host;
      } catch {
        return uploadUrl;
      }
    })();
    const err = new Error(
      error?.message === "Network request failed"
        ? `Cannot reach post API (${host}). Check EXPO_PUBLIC_POST_API_URL matches your PC IP and auth-service is running.`
        : error?.message || "Network request failed",
    );
    err.cause = error;
    throw err;
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const err = new Error(data?.message || "Failed to create post");
    err.response = { data, status: response.status };
    throw err;
  }
  return data;
};

export const getTeamPostsAPI = (teamId, page = 1, limit = 10) =>
  postApi.get(`/team/${teamId}`, { params: { page, limit } }).then((r) => r.data);

export const getPostAPI = (teamId, postId) =>
  postApi.get(`/team/${teamId}/post/${postId}`).then((r) => r.data);

export const deletePostAPI = (teamId, postId) =>
  postApi.delete(`/team/${teamId}/post/${postId}`).then((r) => r.data);

export const toggleLikeAPI = (teamId, postId) =>
  postApi.post(`/team/${teamId}/post/${postId}/like`).then((r) => r.data);

export const togglePostReactionAPI = (teamId, postId, key) =>
  postApi
    .post(`/team/${teamId}/post/${postId}/reactions`, { key })
    .then((r) => r.data);

export const addCommentAPI = (teamId, postId, content) =>
  postApi.post(`/team/${teamId}/post/${postId}/comments`, { content }).then((r) => r.data);

export const toggleCommentLikeAPI = (teamId, postId, commentId) =>
  postApi.post(`/team/${teamId}/post/${postId}/comments/${commentId}/like`).then((r) => r.data);

export const deleteCommentAPI = (teamId, postId, commentId) =>
  postApi.delete(`/team/${teamId}/post/${postId}/comments/${commentId}`).then((r) => r.data);
