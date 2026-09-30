import createApiService from "@/lib/apiService";
import { PROFILE_API_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const profileApi = createApiService(PROFILE_API_URL);

const isMultipartPayload = (value) =>
  typeof FormData !== "undefined" &&
  (value instanceof FormData || Array.isArray(value?._parts));

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const buildUploadError = (message, response, data) => {
  const error = new Error(message);
  error.response = {
    status: response.status,
    data,
  };
  return error;
};

export const getProfileAPI = () => {
  return profileApi.get("/").then((response) => response.data);
};

export const updateProfileAPI = (profileData) => {
  return profileApi.put("/", profileData).then((response) => response.data);
};

export const updateProfileFieldAPI = (field, value) => {
  return profileApi
    .put("/field", { field, value })
    .then((response) => response.data);
};

export const uploadProfilePictureAPI = (pictureData, mimetype) => {
  const isMultipart = isMultipartPayload(pictureData);

  if (!isMultipart) {
    return profileApi
      .post("/picture", { file: pictureData, mimetype })
      .then((response) => response.data);
  }

  return getAccessToken().then(async (token) => {
    const uploadUrl = `${PROFILE_API_URL.replace(/\/+$/, "")}/picture`;
    let response;
    try {
      response = await fetch(uploadUrl, {
        method: "POST",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        body: pictureData,
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
          ? `Cannot reach profile API (${host}). If you use Cloudflare quick tunnels, keep that tunnel running or point EXPO_PUBLIC_PROFILE_API_URL at the same host as EXPO_PUBLIC_AUTH_API_URL, then rebuild.`
          : error?.message || "Network request failed",
      );
      err.cause = error;
      throw err;
    }
    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw buildUploadError(
        data?.message || "Failed to upload profile picture",
        response,
        data,
      );
    }

    return data;
  });
};

export const deleteProfilePictureAPI = () => {
  return profileApi.delete("/picture").then((response) => response.data);
};
