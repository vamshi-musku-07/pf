import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // All availability records for the viewed team
  availability: [],
  // Current user's own availability (for quick access)
  myAvailability: null,
  lastUpdated: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  successMessage: null,
};

const availabilitySlice = createSlice({
  name: "availability",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchAvailabilityStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchAvailabilitySuccess: (state, action) => {
      state.isLoading = false;
      state.availability = action.payload;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },
    fetchAvailabilityFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // -------- SET / UPDATE ------------
    // ==================================
    submitAvailabilityStart: (state) => {
      state.isSubmitting = true;
      state.error = null;
      state.successMessage = null;
    },
    submitAvailabilitySuccess: (state, action) => {
      state.isSubmitting = false;
      state.myAvailability = action.payload;
      // Update in the full list too
      const idx = state.availability.findIndex(
        (a) => a._id === action.payload._id || a.userId === action.payload.userId
      );
      if (idx !== -1) {
        state.availability[idx] = action.payload;
      } else {
        state.availability = [...state.availability, action.payload];
      }
      state.successMessage = "Availability updated";
      state.error = null;
    },
    submitAvailabilityFailure: (state, action) => {
      state.isSubmitting = false;
      state.error = action.payload;
    },

    setMyAvailability: (state, action) => {
      state.myAvailability = action.payload;
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
  fetchAvailabilityStart, fetchAvailabilitySuccess, fetchAvailabilityFailure,
  submitAvailabilityStart, submitAvailabilitySuccess, submitAvailabilityFailure,
  setMyAvailability,
  clearError, clearSuccessMessage,
} = availabilitySlice.actions;

export default availabilitySlice.reducer;
