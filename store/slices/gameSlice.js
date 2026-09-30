import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  games: [],
  currentGame: null,
  activeGameId: null, // the game currently displayed in GameScreen
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  successMessage: null,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchGamesStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchGamesSuccess: (state, action) => {
      state.isLoading = false;
      state.games = action.payload;
      state.error = null;
    },
    fetchGamesFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ---- FETCH SINGLE GAME -----------
    // ==================================
    fetchGameStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchGameSuccess: (state, action) => {
      state.isLoading = false;
      state.currentGame = action.payload;
      // Update in list if already present
      const idx = state.games.findIndex((g) => g._id === action.payload._id);
      if (idx !== -1) {
        state.games[idx] = action.payload;
      }
      state.error = null;
    },
    fetchGameFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createGameStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createGameSuccess: (state, action) => {
      state.isCreating = false;
      state.games = [...state.games, action.payload];
      state.currentGame = action.payload;
      state.successMessage = "Game created successfully";
      state.error = null;
    },
    createGameFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- UPDATE ---------------
    // ==================================
    updateGameStart: (state) => {
      state.isUpdating = true;
      state.error = null;
    },
    updateGameSuccess: (state, action) => {
      state.isUpdating = false;
      state.games = state.games.map((g) =>
        g._id === action.payload._id ? action.payload : g
      );
      if (state.currentGame?._id === action.payload._id) {
        state.currentGame = action.payload;
      }
      state.error = null;
    },
    updateGameFailure: (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    },

    // ==================================
    // -------- ACTIVE GAME -------------
    // ==================================
    setActiveGameId: (state, action) => {
      state.activeGameId = action.payload;
    },
    clearActiveGameId: (state) => {
      state.activeGameId = null;
    },

    // Real-time score update via socket
    updateGameScore: (state, action) => {
      // action.payload: { gameId, scoreData }
      const { gameId, scoreData } = action.payload;
      const game = state.games.find((g) => g._id === gameId);
      if (game) {
        Object.assign(game, scoreData);
      }
      if (state.currentGame?._id === gameId) {
        Object.assign(state.currentGame, scoreData);
      }
    },

    clearCurrentGame: (state) => {
      state.currentGame = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
  },
});

export const {
  fetchGamesStart, fetchGamesSuccess, fetchGamesFailure,
  fetchGameStart, fetchGameSuccess, fetchGameFailure,
  createGameStart, createGameSuccess, createGameFailure,
  updateGameStart, updateGameSuccess, updateGameFailure,
  setActiveGameId, clearActiveGameId,
  updateGameScore,
  clearCurrentGame,
  clearError, clearSuccessMessage,
} = gameSlice.actions;

export default gameSlice.reducer;
