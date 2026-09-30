import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Global notification badge count shown on the bell icon
  notificationCount: 0,
  // Whether the app is actively loading at root level
  isAppLoading: false,
  // Toast / snackbar message
  toast: null, // { message: string, type: 'success' | 'error' | 'info' }
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setNotificationCount: (state, action) => {
      state.notificationCount = action.payload;
    },
    incrementNotificationCount: (state) => {
      state.notificationCount += 1;
    },
    resetNotificationCount: (state) => {
      state.notificationCount = 0;
    },

    setAppLoading: (state, action) => {
      state.isAppLoading = action.payload;
    },

    showToast: (state, action) => {
      // action.payload: { message, type }
      state.toast = action.payload;
    },
    clearToast: (state) => {
      state.toast = null;
    },
  },
});

export const {
  setNotificationCount,
  incrementNotificationCount,
  resetNotificationCount,
  setAppLoading,
  showToast,
  clearToast,
} = uiSlice.actions;

export default uiSlice.reducer;
