import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // keyed by teamId so each team's player list is cached independently
  playersByTeam: {},
  isLoading: false,
  isCreating: false,
  error: null,
  successMessage: null,
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchPlayersStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchPlayersSuccess: (state, action) => {
      // action.payload: { teamId, players }
      state.isLoading = false;
      state.playersByTeam[action.payload.teamId] = action.payload.players;
      state.error = null;
    },
    fetchPlayersFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createPlayerStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createPlayerSuccess: (state, action) => {
      // action.payload: { teamId, player }
      state.isCreating = false;
      const { teamId, player } = action.payload;
      if (state.playersByTeam[teamId]) {
        state.playersByTeam[teamId] = [...state.playersByTeam[teamId], player];
      }
      state.successMessage = "Player added successfully";
      state.error = null;
    },
    createPlayerFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- UPDATE ---------------
    // ==================================
    updatePlayerInTeam: (state, action) => {
      // action.payload: { teamId, player }
      const { teamId, player } = action.payload;
      if (state.playersByTeam[teamId]) {
        state.playersByTeam[teamId] = state.playersByTeam[teamId].map((p) =>
          p._id === player._id ? player : p
        );
      }
    },

    // ==================================
    // ----------- REMOVE ---------------
    // ==================================
    removePlayerFromTeam: (state, action) => {
      // action.payload: { teamId, playerId }
      const { teamId, playerId } = action.payload;
      if (state.playersByTeam[teamId]) {
        state.playersByTeam[teamId] = state.playersByTeam[teamId].filter(
          (p) => p._id !== playerId
        );
      }
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
  fetchPlayersStart, fetchPlayersSuccess, fetchPlayersFailure,
  createPlayerStart, createPlayerSuccess, createPlayerFailure,
  updatePlayerInTeam,
  removePlayerFromTeam,
  clearError, clearSuccessMessage,
} = playerSlice.actions;

export default playerSlice.reducer;
