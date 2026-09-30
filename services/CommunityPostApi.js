import createApiService from "@/lib/apiService";
import { COMMUNITY_POST_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";
import {
  compressImageForUpload,
  resolveUploadUri,
} from "@/lib/postMediaUpload";
import * as FileSystem from "expo-file-system/legacy";

const communityPostApi = createApiService(COMMUNITY_POST_API_URL);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
 * RN Android: axios + FormData often fails with a bogus "Network Error".
 * Use fetch and do not set Content-Type (runtime adds multipart boundary).
 */
const requestWithFetch = async ({ method = "POST", path = "/", body, isJson }) => {
  const token = await getAccessToken();
  const base = COMMUNITY_POST_API_URL.replace(/\/+$/, "");
  const uploadUrl = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  let response;
  try {
    response = await fetch(uploadUrl, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(isJson ? { "Content-Type": "application/json" } : {}),
      },
      body: isJson ? JSON.stringify(body) : body,
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
        ? `Cannot reach posts API (${host}). Check Wi‑Fi IP and that post-service is running on :3009.`
        : error?.message || "Network request failed",
    );
    err.cause = error;
    throw err;
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const err = new Error(data?.message || "Request failed");
    err.response = { data, status: response.status };
    throw err;
  }
  return data;
};

const postWithFetch = async ({ body, isJson }) =>
  requestWithFetch({ method: "POST", path: "/", body, isJson });

const buildMediaUploadPayload = async ({
  media = [],
  baseFields = {},
  keepMedia = null,
  asFormData = false,
}) => {
  if (!asFormData) {
    const images = [];
    for (const item of media) {
      const compressed = await compressImageForUpload(item.uri);
      const info = await FileSystem.getInfoAsync(compressed.uri);
      if (info.size && info.size > MAX_IMAGE_BYTES) {
        throw new Error("Image is too large after compression. Try another photo.");
      }
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      images.push({ file: base64, mimetype: compressed.mimeType });
    }
    return {
      isJson: true,
      body: {
        ...baseFields,
        ...(keepMedia != null ? { keepMedia } : {}),
        ...(images.length ? { images } : {}),
      },
    };
  }

  const formData = new FormData();
  Object.entries(baseFields).forEach(([key, val]) => {
    if (val == null) return;
    if (typeof val === "boolean") {
      formData.append(key, val ? "true" : "false");
      return;
    }
    if (typeof val === "object") {
      formData.append(key, JSON.stringify(val));
      return;
    }
    formData.append(key, String(val));
  });
  if (keepMedia != null) {
    formData.append("keepMedia", JSON.stringify(keepMedia));
  }

  for (let i = 0; i < media.length; i += 1) {
    const item = media[i];
    if (item.type === "video") {
      const mimeType = item.mimeType || "video/mp4";
      const readableUri = await resolveUploadUri(item.uri, mimeType);
      formData.append("video", {
        uri: readableUri,
        type: mimeType.startsWith("video/") ? mimeType : "video/mp4",
        name: item.name || `video-${Date.now()}-${i}.mp4`,
      });
    } else {
      const compressed = await compressImageForUpload(item.uri);
      formData.append("image", {
        uri: compressed.uri,
        type: "image/jpeg",
        name: item.name?.replace(/\.\w+$/, ".jpg") || `image-${Date.now()}-${i}.jpg`,
      });
    }
  }

  return { isJson: false, body: formData };
};

export const listCommunityPostsAPI = (params = {}) =>
  communityPostApi.get("/", { params }).then((r) => r.data);

const followApiBase = COMMUNITY_POST_API_URL.replace(/\/posts\/?$/, "/follows");
const communityFollowApi = createApiService(followApiBase);

export const listFollowsAPI = (params = {}) =>
  communityFollowApi.get("/", { params }).then((r) => r.data);

export const followTargetAPI = (targetType, targetId) =>
  communityFollowApi.post(`/${targetType}/${targetId}`).then((r) => r.data);

export const unfollowTargetAPI = (targetType, targetId) =>
  communityFollowApi.delete(`/${targetType}/${targetId}`).then((r) => r.data);

/** Batch follow status — targets: "user:id,team:id2" */
export const getFollowStatusAPI = (targets) =>
  communityFollowApi.get("/status", { params: { targets } }).then((r) => r.data);

export const getFollowCountsAPI = (userId) =>
  communityFollowApi.get(`/counts/${userId}`).then((r) => r.data);

const hideApiBase = COMMUNITY_POST_API_URL.replace(/\/posts\/?$/, "/hides");
const communityHideApi = createApiService(hideApiBase);

/** Hide a post or author from feeds. reason: not_useful | not_interested_sport | not_interested_athlete | none */
export const hideCommunityContentAPI = ({
  targetType,
  targetId,
  reason = "none",
  sourcePostId = "",
} = {}) =>
  communityHideApi
    .post("/", { targetType, targetId, reason, sourcePostId })
    .then((r) => r.data);

export const listCommunityHidesAPI = () =>
  communityHideApi.get("/").then((r) => r.data);

export const getCommunityPostAPI = (postId) =>
  communityPostApi.get(`/${postId}`).then((r) => r.data);

export const createCommunityPostAPI = async ({
  content = "",
  authorName = "",
  authorAvatar = "",
  allowComments = true,
  textAlign = "left",
  media = [],
  mentions = [],
  taggedTeams = [],
  taggedTournaments = [],
} = {}) => {
  const baseFields = {
    content: content || "",
    authorName: authorName || "",
    authorAvatar: authorAvatar || "",
    allowComments,
    textAlign: textAlign || "left",
    mentions,
    taggedTeams,
    taggedTournaments,
  };

  if (!media?.length) {
    return communityPostApi.post("/", baseFields).then((r) => r.data);
  }

  const hasVideo = media.some((m) => m.type === "video");

  // Images-only: compress then JSON + base64 (Android-safe, smaller payloads).
  if (!hasVideo) {
    const payload = await buildMediaUploadPayload({
      media,
      baseFields,
      asFormData: false,
    });
    return postWithFetch(payload);
  }

  // Videos (or mixed): multipart via fetch — never axios.
  const payload = await buildMediaUploadPayload({
    media,
    baseFields,
    asFormData: true,
  });
  return postWithFetch(payload);
};

export const deleteCommunityPostAPI = (postId) =>
  communityPostApi.delete(`/${postId}`).then((r) => r.data);

export const updateCommunityPostAPI = async (
  postId,
  {
    content,
    textAlign,
    allowComments,
    keepMedia = null,
    media = [],
  } = {},
) => {
  const baseFields = {};
  if (content !== undefined) baseFields.content = content || "";
  if (textAlign !== undefined) baseFields.textAlign = textAlign || "left";
  if (allowComments !== undefined) {
    baseFields.allowComments = allowComments;
  }

  const newMedia = Array.isArray(media) ? media.filter((m) => m?.uri && !m?.url) : [];
  const mediaTouched = keepMedia != null || newMedia.length > 0;

  if (!mediaTouched) {
    return communityPostApi.patch(`/${postId}`, baseFields).then((r) => r.data);
  }

  const hasVideo = newMedia.some((m) => m.type === "video");
  const payload = await buildMediaUploadPayload({
    media: newMedia,
    baseFields,
    keepMedia: keepMedia == null ? [] : keepMedia,
    asFormData: hasVideo,
  });

  return requestWithFetch({
    method: "PATCH",
    path: `/${postId}`,
    ...payload,
  });
};

export const toggleCommunityPostLikeAPI = (postId, body = {}) =>
  communityPostApi.post(`/${postId}/like`, body).then((r) => r.data);

export const listCommunityCommentsAPI = (postId) =>
  communityPostApi.get(`/${postId}/comments`).then((r) => r.data);

export const createCommunityCommentAPI = (postId, body) =>
  communityPostApi.post(`/${postId}/comments`, body).then((r) => r.data);

export const toggleCommunityCommentLikeAPI = (postId, commentId) =>
  communityPostApi.post(`/${postId}/comments/${commentId}/like`).then((r) => r.data);

export const deleteCommunityCommentAPI = (postId, commentId) =>
  communityPostApi.delete(`/${postId}/comments/${commentId}`).then((r) => r.data);

export const updateCommunityCommentAPI = (postId, commentId, body) =>
  communityPostApi.patch(`/${postId}/comments/${commentId}`, body).then((r) => r.data);
