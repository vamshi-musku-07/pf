import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  assignments: [],
  myAssignments: [], // assignments assigned to the current user
  currentAssignment: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isResponding: false,
  error: null,
  successMessage: null,
};

const assignmentSlice = createSlice({
  name: "assignments",
  initialState,
  reducers: {
    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createAssignmentStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createAssignmentSuccess: (state, action) => {
      state.isCreating = false;
      state.assignments = [...state.assignments, action.payload];
      state.successMessage = "Assignment created successfully";
      state.error = null;
    },
    createAssignmentFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ------ GET BY TEAM ID ------------
    // ==================================
    getTeamAssignmentsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    getTeamAssignmentsSuccess: (state, action) => {
      state.isLoading = false;
      state.assignments = action.payload;
      state.error = null;
    },
    getTeamAssignmentsFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ------ GET MY ASSIGNMENTS --------
    // ==================================
    getMyAssignmentsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    getMyAssignmentsSuccess: (state, action) => {
      state.isLoading = false;
      state.myAssignments = action.payload;
      state.error = null;
    },
    getMyAssignmentsFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- UPDATE ---------------
    // ==================================
    updateAssignmentStart: (state) => {
      state.isUpdating = true;
      state.error = null;
      state.successMessage = null;
    },
    updateAssignmentSuccess: (state, action) => {
      state.isUpdating = false;
      state.assignments = state.assignments.map((a) =>
        a._id === action.payload._id ? action.payload : a
      );
      if (state.currentAssignment?._id === action.payload._id) {
        state.currentAssignment = action.payload;
      }
      state.successMessage = "Assignment updated successfully";
      state.error = null;
    },
    updateAssignmentFailure: (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- DELETE ---------------
    // ==================================
    deleteAssignmentStart: (state) => {
      state.isDeleting = true;
      state.error = null;
      state.successMessage = null;
    },
    deleteAssignmentSuccess: (state, action) => {
      state.isDeleting = false;
      state.assignments = state.assignments.filter((a) => a._id !== action.payload);
      if (state.currentAssignment?._id === action.payload) {
        state.currentAssignment = null;
      }
      state.successMessage = "Assignment deleted successfully";
      state.error = null;
    },
    deleteAssignmentFailure: (state, action) => {
      state.isDeleting = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- RESPOND --------------
    // ==================================
    respondAssignmentStart: (state) => {
      state.isResponding = true;
      state.error = null;
      state.successMessage = null;
    },
    respondAssignmentSuccess: (state, action) => {
      state.isResponding = false;
      state.assignments = state.assignments.map((a) =>
        a._id === action.payload._id ? action.payload : a
      );
      if (state.currentAssignment?._id === action.payload._id) {
        state.currentAssignment = action.payload;
      }
      state.successMessage = `Assignment ${action.payload.status} successfully`;
      state.error = null;
    },
    respondAssignmentFailure: (state, action) => {
      state.isResponding = false;
      state.error = action.payload;
    },

    // ==================================
    // --------- REAL-TIME --------------
    // ==================================
    // Called when socket emits assignment:new
    addIncomingAssignment: (state, action) => {
      const exists = state.assignments.some((a) => a._id === action.payload._id);
      if (!exists) {
        state.assignments = [...state.assignments, action.payload];
      }
      // Also add to myAssignments if it belongs to the current user (caller decides)
    },

    clearCurrentAssignment: (state) => {
      state.currentAssignment = null;
    },
    clearAllAssignments: (state) => {
      state.assignments = [];
      state.currentAssignment = null;
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
  createAssignmentStart, createAssignmentSuccess, createAssignmentFailure,
  getTeamAssignmentsStart, getTeamAssignmentsSuccess, getTeamAssignmentsFailure,
  getMyAssignmentsStart, getMyAssignmentsSuccess, getMyAssignmentsFailure,
  updateAssignmentStart, updateAssignmentSuccess, updateAssignmentFailure,
  deleteAssignmentStart, deleteAssignmentSuccess, deleteAssignmentFailure,
  respondAssignmentStart, respondAssignmentSuccess, respondAssignmentFailure,
  addIncomingAssignment,
  clearCurrentAssignment, clearAllAssignments,
  clearError, clearSuccessMessage,
} = assignmentSlice.actions;

export default assignmentSlice.reducer;
