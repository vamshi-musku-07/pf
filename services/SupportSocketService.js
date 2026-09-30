import { io } from "socket.io-client";
import { AUTH_API_URL, SUPPORT_WS_URL } from "@/config/api";
import { getAccessToken, getRefreshToken, setAccessToken } from "@/lib/tokenStorage";
import { willJwtExpireWithin } from "@/lib/jwt";
import axios from "axios";

let socket = null;
let reconnectTimer = null;
let currentTicketId = null;

// ─── Token helpers ────────────────────────────────────────────────────────────
const isTokenExpiring = (token) =>
  willJwtExpireWithin(token, 60, { treatMissingExpAsExpired: true });

const refreshToken = async () => {
  const refresh = await getRefreshToken();
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post(
    `${AUTH_API_URL}/refresh`,
    { refreshToken: refresh },
    { timeout: 15000 }
  );
  if (!data.accessToken) throw new Error("No access token");
  await setAccessToken(data.accessToken);
  return data.accessToken;
};

// ─── Initialize ───────────────────────────────────────────────────────────────
export const initializeSupportSocket = async () => {
  if (socket?.connected) return socket;
  disconnectSupportSocket();

  let token = await getAccessToken();
  if (!token || isTokenExpiring(token)) {
    try { token = await refreshToken(); } catch { return null; }
  }
  if (!token) return null;

  socket = io(SUPPORT_WS_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    console.log("[SupportSocket] Connected:", socket.id);
    // Rejoin ticket room if we were in one
    if (currentTicketId) {
      socket.emit("ticket:join", { ticketId: currentTicketId });
    }
  });

  socket.on("connect_error", async (err) => {
    console.warn("[SupportSocket] connect_error:", err.message);
    if (err.message === "Authentication failed") {
      try {
        const newToken = await refreshToken();
        socket.auth = { token: newToken };
        socket.connect();
      } catch {
        console.error("[SupportSocket] Token refresh failed");
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[SupportSocket] Disconnected:", reason);
  });

  return socket;
};

// ─── Room management ──────────────────────────────────────────────────────────
export const joinTicketRoom = (ticketId) => {
  currentTicketId = ticketId; // always set so auto-rejoin works on reconnect
  if (socket?.connected) {
    socket.emit("ticket:join", { ticketId });
  }
};

export const leaveTicketRoom = (ticketId) => {
  if (!socket?.connected) return;
  if (currentTicketId === ticketId) currentTicketId = null;
  socket.emit("ticket:leave", { ticketId });
};

// ─── Message events ───────────────────────────────────────────────────────────
export const sendSocketMessage = (ticketId, content, contentType = "text") => {
  if (!socket?.connected) return false;
  socket.emit("message:send", { ticketId, content, contentType });
  return true;
};

export const startTyping = (ticketId) => {
  socket?.connected && socket.emit("typing:start", { ticketId });
};

export const stopTyping = (ticketId) => {
  socket?.connected && socket.emit("typing:stop", { ticketId });
};

export const markTicketRead = (ticketId) => {
  socket?.connected && socket.emit("ticket:read", { ticketId });
};

// ─── Listeners ────────────────────────────────────────────────────────────────
export const onNewMessage = (cb) => {
  socket?.off("message:new");
  socket?.on("message:new", cb);
};

export const onTicketUpdated = (cb) => {
  socket?.off("ticket:updated");
  socket?.on("ticket:updated", cb);
};

export const onTypingUpdate = (cb) => {
  socket?.off("typing:update");
  socket?.on("typing:update", cb);
};

export const onAgentJoined = (cb) => {
  socket?.off("agent:joined");
  socket?.on("agent:joined", cb);
};

export const onSocketError = (cb) => {
  socket?.off("error");
  socket?.on("error", cb);
};

export const removeAllListeners = () => {
  socket?.off("message:new");
  socket?.off("ticket:updated");
  socket?.off("typing:update");
  socket?.off("agent:joined");
  socket?.off("error");
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────
export const disconnectSupportSocket = () => {
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentTicketId = null;
};

export const isSupportSocketConnected = () => socket?.connected ?? false;
