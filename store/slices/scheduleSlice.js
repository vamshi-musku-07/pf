import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  schedules: [],
  createdSchedule: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  successMessage: null,
};

const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchSchedulesStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchSchedulesSuccess: (state, action) => {
      state.isLoading = false;
      state.schedules = action.payload;
      state.error = null;
    },
    fetchSchedulesFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createScheduleStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createScheduleSuccess: (state, action) => {
      state.isCreating = false;
      state.schedules = [...state.schedules, action.payload];
      state.createdSchedule = action.payload;
      state.successMessage = "Schedule created successfully";
      state.error = null;
    },
    createScheduleFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- UPDATE ---------------
    // ==================================
    updateScheduleStart: (state) => {
      state.isUpdating = true;
      state.error = null;
      state.successMessage = null;
    },
    updateScheduleSuccess: (state, action) => {
      state.isUpdating = false;
      state.schedules = state.schedules.map((s) =>
        s._id === action.payload._id ? action.payload : s
      );
      state.successMessage = "Schedule updated successfully";
      state.error = null;
    },
    updateScheduleFailure: (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- DELETE ---------------
    // ==================================
    deleteScheduleStart: (state) => {
      state.isDeleting = true;
      state.error = null;
      state.successMessage = null;
    },
    deleteScheduleSuccess: (state, action) => {
      state.isDeleting = false;
      state.schedules = state.schedules.filter((s) => s._id !== action.payload);
      state.successMessage = "Schedule deleted successfully";
      state.error = null;
    },
    deleteScheduleFailure: (state, action) => {
      state.isDeleting = false;
      state.error = action.payload;
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
  fetchSchedulesStart, fetchSchedulesSuccess, fetchSchedulesFailure,
  createScheduleStart, createScheduleSuccess, createScheduleFailure,
  updateScheduleStart, updateScheduleSuccess, updateScheduleFailure,
  deleteScheduleStart, deleteScheduleSuccess, deleteScheduleFailure,
  clearError, clearSuccessMessage,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
