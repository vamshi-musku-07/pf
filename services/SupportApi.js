import createApiService from "@/lib/apiService";
import { SUPPORT_API_URL, SUPPORT_WS_URL } from "@/config/api";
import { getAccessToken } from "@/lib/tokenStorage";

const SUPPORT_BASE_PATH = "/api/v1/support";

const buildSupportApiBaseUrl = (httpValue, socketValue) => {
  // Prefer explicit HTTP API URL; WS host is only a fallback for REST base URL.
  const candidate = String(httpValue || socketValue || "").trim();

  if (!candidate) return SUPPORT_BASE_PATH;

  try {
    const url = new URL(candidate);
    // Convert websocket protocols to HTTP equivalents; preserve https
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    // Leave https: / http: as-is
    url.pathname = SUPPORT_BASE_PATH;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    const trimmed = candidate.replace(/\/$/, "");
    if (trimmed.endsWith(SUPPORT_BASE_PATH)) return trimmed;
    return `${trimmed}${SUPPORT_BASE_PATH}`;
  }
};

const supportApiBaseUrl = buildSupportApiBaseUrl(SUPPORT_API_URL, SUPPORT_WS_URL);
const supportApi = createApiService(supportApiBaseUrl);

// ─── User ────────────────────────────────────────────────────────────────────
export const createTicketAPI = (data) =>
  supportApi.post("/tickets", data).then((r) => r.data);

export const getMyTicketsAPI = (params = {}) =>
  supportApi.get("/tickets", { params }).then((r) => r.data);

export const getTicketByIdAPI = (id) =>
  supportApi.get(`/tickets/${id}`).then((r) => r.data);

export const getTicketMessagesAPI = (id, params = {}) =>
  supportApi.get(`/tickets/${id}/messages`, { params }).then((r) => r.data);

export const sendTicketMessageAPI = (id, data) =>
  supportApi.post(`/tickets/${id}/messages`, data).then((r) => r.data);

export const closeTicketAPI = (id) =>
  supportApi.post(`/tickets/${id}/close`).then((r) => r.data);

export const uploadImageAPI = async (ticketId, imageUri, mimeType = "image/jpeg") => {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    type: mimeType,
    name: `image-${Date.now()}.${mimeType.split("/")[1] || "jpg"}`,
  });
  const res = await fetch(`${supportApiBaseUrl}/upload/${ticketId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type — fetch sets it with the correct multipart boundary
    },
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json(); // { url, filename }
};
