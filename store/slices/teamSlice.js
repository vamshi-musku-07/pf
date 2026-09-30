import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  teams: [],
  selectedTeam: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  successMessage: null,
};

const teamSlice = createSlice({
  name: "team",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchTeamsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchTeamsSuccess: (state, action) => {
      state.isLoading = false;
      state.teams = action.payload;
      state.error = null;
    },
    fetchTeamsFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createTeamStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createTeamSuccess: (state, action) => {
      state.isCreating = false;
      state.teams = [...state.teams, action.payload];
      state.successMessage = "Team created successfully";
      state.error = null;
    },
    createTeamFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- UPDATE ---------------
    // ==================================
    updateTeamStart: (state) => {
      state.isUpdating = true;
      state.error = null;
      state.successMessage = null;
    },
    updateTeamSuccess: (state, action) => {
      state.isUpdating = false;
      state.teams = state.teams.map((t) =>
        t._id === action.payload._id ? action.payload : t
      );
      if (state.selectedTeam?._id === action.payload._id) {
        state.selectedTeam = action.payload;
      }
      state.successMessage = "Team updated successfully";
      state.error = null;
    },
    updateTeamFailure: (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- DELETE ---------------
    // ==================================
    removeTeam: (state, action) => {
      state.teams = state.teams.filter((t) => t._id !== action.payload);
      if (state.selectedTeam?._id === action.payload) {
        state.selectedTeam = null;
      }
    },

    // ==================================
    // --------- SELECTED TEAM ----------
    // ==================================
    setSelectedTeam: (state, action) => {
      state.selectedTeam = action.payload;
    },
    clearSelectedTeam: (state) => {
      state.selectedTeam = null;
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
  fetchTeamsStart, fetchTeamsSuccess, fetchTeamsFailure,
  createTeamStart, createTeamSuccess, createTeamFailure,
  updateTeamStart, updateTeamSuccess, updateTeamFailure,
  removeTeam,
  setSelectedTeam, clearSelectedTeam,
  clearError, clearSuccessMessage,
} = teamSlice.actions;

export default teamSlice.reducer;
