import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import persistStorage from "./persistStorage";

import authReducer from "./slices/authSlice";
import teamReducer from "./slices/teamSlice";
import playerReducer from "./slices/playerSlice";
import assignmentReducer from "./slices/assignmentSlice";
import scheduleReducer from "./slices/scheduleSlice";
import gameReducer from "./slices/gameSlice";
import messageReducer from "./slices/messageSlice";
import postReducer from "./slices/postSlice";
import availabilityReducer from "./slices/availabilitySlice";
import uiReducer from "./slices/uiSlice";
import liveGameReducer from "../features/liveGame/liveGameSlice";
import { syncMiddleware } from "./middleware/syncMiddleware";
import { resumeAllQueues } from "../features/liveGame/sync/syncWorker";

// ── Per-slice persist configs ────────────────────────────────────────────────
// Only whitelist what is safe to cache offline. Tokens are in SecureStore, not Redux.

const authPersistConfig = {
  key: "auth",
  storage: persistStorage,
  whitelist: ["user", "isAuthenticated"],
};

const teamPersistConfig = {
  key: "team",
  storage: persistStorage,
  whitelist: ["teams", "selectedTeam"],
};

const playerPersistConfig = {
  key: "player",
  storage: persistStorage,
  whitelist: ["playersByTeam"],
};

const assignmentPersistConfig = {
  key: "assignments",
  storage: persistStorage,
  whitelist: ["assignments", "myAssignments"],
};

const schedulePersistConfig = {
  key: "schedule",
  storage: persistStorage,
  whitelist: ["schedules"],
};

const gamePersistConfig = {
  key: "game",
  storage: persistStorage,
  whitelist: ["games", "currentGame"],
};

const postPersistConfig = {
  key: "posts",
  storage: persistStorage,
  whitelist: ["posts", "pagination"],
};

const availabilityPersistConfig = {
  key: "availability",
  storage: persistStorage,
  whitelist: ["myAvailability", "lastUpdated"],
};

// Messages are not persisted — always fresh from server / socket
const messagePersistConfig = {
  key: "message",
  storage: persistStorage,
  whitelist: [],
};

// Live-game scoring: persist the offline event queue + server snapshot per game.
// This is what gives us crash-survival + offline scoring resumption.
const liveGamePersistConfig = {
  key: "liveGame",
  storage: persistStorage,
  whitelist: ["byGameId"],
};

// ── Persisted reducers ───────────────────────────────────────────────────────

const persistedAuth = persistReducer(authPersistConfig, authReducer);
const persistedTeam = persistReducer(teamPersistConfig, teamReducer);
const persistedPlayer = persistReducer(playerPersistConfig, playerReducer);
const persistedAssignment = persistReducer(assignmentPersistConfig, assignmentReducer);
const persistedSchedule = persistReducer(schedulePersistConfig, scheduleReducer);
const persistedGame = persistReducer(gamePersistConfig, gameReducer);
const persistedPost = persistReducer(postPersistConfig, postReducer);
const persistedAvailability = persistReducer(availabilityPersistConfig, availabilityReducer);
const persistedMessage = persistReducer(messagePersistConfig, messageReducer);
const persistedLiveGame = persistReducer(liveGamePersistConfig, liveGameReducer);

// ── Store ────────────────────────────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    auth: persistedAuth,
    team: persistedTeam,
    player: persistedPlayer,
    assignments: persistedAssignment,
    schedule: persistedSchedule,
    game: persistedGame,
    posts: persistedPost,
    availability: persistedAvailability,
    message: persistedMessage,
    liveGame: persistedLiveGame,
    ui: uiReducer, // UI state is intentionally ephemeral, no persistence
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches these non-serializable actions internally
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(syncMiddleware),
  devTools: __DEV__,
});

export const persistor = persistStore(store, null, () => {
  // After rehydration, resume any pending offline events that survived a kill.
  try { resumeAllQueues(store); } catch { /* noop */ }
});

export default store;
