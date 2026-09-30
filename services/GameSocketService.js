import { io } from "socket.io-client";
import { AUTH_API_URL, GAME_WS_URL } from "@/config/api";
import { getAccessToken, getRefreshToken, setAccessToken } from "@/lib/tokenStorage";
import { willJwtExpireWithin } from "@/lib/jwt";
import axios from "axios";

let socket = null;
let healthInterval = null;

const isTokenExpiredOrExpiring = (token) =>
  willJwtExpireWithin(token, 60, { treatMissingExpAsExpired: true });

const refreshAccessToken = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const response = await axios.post(
    `${AUTH_API_URL}/refresh`,
    { refreshToken },
    { timeout: 15000 }
  );

  const { accessToken } = response.data;
  if (!accessToken) throw new Error("No access token from refresh");

  await setAccessToken(accessToken);
  return accessToken;
};

export const initializeGameSocket = async () => {
  let token = await getAccessToken();

  if (!token || isTokenExpiredOrExpiring(token)) {
    try {
      token = await refreshAccessToken();
    } catch {
      return null;
    }
  }

  if (!token) return null;

  // Reuse an existing connection — disconnecting breaks other screens (GameScreen + Live tab).
  if (socket?.connected) {
    socket.auth = { token };
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  try {
    socket = io(GAME_WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
    });

    socket.on("connect", () => {
      healthInterval = setInterval(() => {
        if (socket?.connected) socket.emit("ping", Date.now());
      }, 30000);
    });

    socket.on("disconnect", (reason) => {
      if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
      }
      if (reason === "io server disconnect") {
        setTimeout(() => socket?.connect(), 1000);
      }
    });

    socket.on("connect_error", (error) => {
      if (error.message?.includes("auth") || error.message?.includes("401")) {
        refreshAccessToken()
          .then((newToken) => {
            if (newToken && socket) {
              socket.auth.token = newToken;
              socket.connect();
            }
          })
          .catch(() => {});
      }
    });

    return socket;
  } catch {
    return null;
  }
};

export const disconnectGameSocket = () => {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const joinGameRoom = (gameId) => {
  if (!gameId) return;
  const gid = String(gameId);

  const emitJoin = () => {
    if (socket?.connected) socket.emit("join-game", gid);
  };

  if (socket?.connected) {
    emitJoin();
    return;
  }

  initializeGameSocket().then(() => {
    if (socket?.connected) {
      emitJoin();
      return;
    }
    socket?.once?.("connect", emitJoin);
    socket?.connect?.();
  });
};

export const leaveGameRoom = (gameId) => {
  if (socket?.connected) socket.emit("leave-game", gameId);
};

// Socket event senders
export const sendScoreUpdate = (gameId, team, score, eventType = null, playerId = null) => {
  if (socket?.connected) {
    socket.emit("update-score", { gameId, team, score, eventType, playerId });
  }
};

export const sendGameTimeUpdate = (gameId, timeData) => {
  if (socket?.connected) {
    socket.emit("update-game-time", { gameId, ...timeData });
  }
};

// Chess annotation socket events
export const sendChessAnnotation = (gameId, arrows, highlights, targetColor) => {
  if (socket?.connected) {
    socket.emit("chess-draw-annotation", { gameId, arrows, highlights, targetColor });
  }
};

export const sendChessClearAnnotations = (gameId) => {
  if (socket?.connected) {
    socket.emit("chess-clear-annotations", { gameId });
  }
};

export const onChessAnnotationUpdate = (callback) => {
  if (socket) {
    socket.on("chess-annotation-update", callback);
    return () => socket.off("chess-annotation-update", callback);
  }
  return () => {};
};

// Socket event listeners
export const onGameUpdate = (callback) => {
  if (socket) {
    socket.on("game-update", callback);
    return () => socket.off("game-update", callback);
  }
  return () => {};
};

export const onScoreUpdate = (callback) => {
  if (socket) {
    socket.on("score-update", callback);
    return () => socket.off("score-update", callback);
  }
  return () => {};
};

export const onGameEvent = (callback) => {
  if (socket) {
    socket.on("game-event", callback);
    return () => socket.off("game-event", callback);
  }
  return () => {};
};

export const onGameEnded = (callback) => {
  if (socket) {
    socket.on("game-ended", callback);
    return () => socket.off("game-ended", callback);
  }
  return () => {};
};

export const onCommentaryUpdate = (callback) => {
  if (socket) {
    socket.on("commentary-update", callback);
    return () => socket.off("commentary-update", callback);
  }
  return () => {};
};

export const onSocketReconnect = (callback) => {
  if (socket?.io) {
    socket.io.on("reconnect", callback);
    return () => socket.io.off("reconnect", callback);
  }
  return () => {};
};

// Status utilities
export const getSocket = () => socket;
export const isSocketConnected = () => socket?.connected ?? false;
export const getConnectionStatus = () =>
  !socket ? "disconnected" : socket.connected ? "connected" : "disconnected";
