import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  pendingRegistration: null,
  isPasswordResetOTPVerified: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // ==================================
    // ----------- Register -------------
    // ==================================
    registerStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    registerSuccess: (state, action) => {
      state.isLoading = false;
      state.pendingRegistration = action.payload;
      state.error = null;
    },
    registerFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- OTP ------------------
    // ==================================
    verifyOtpStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    verifyOtpSuccess: (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.pendingRegistration = null;
      state.error = null;
    },
    verifyOtpFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- Login ----------------
    // ==================================
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // -------- Google login ------------
    // ==================================
    googleLoginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    googleLoginSuccess: (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
    },
    googleLoginFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // -------- Forgot password ---------
    // ==================================
    forgotPasswordStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    forgotPasswordSuccess: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    forgotPasswordFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ------ Reset password OTP --------
    // ==================================
    verifyPasswordResetOtpStart: (state) => {
      state.isLoading = true;
      state.error = null;
      state.isPasswordResetOTPVerified = false;
    },
    verifyPasswordResetOtpSuccess: (state) => {
      state.isLoading = false;
      state.isPasswordResetOTPVerified = true;
      state.error = null;
    },
    verifyPasswordResetOtpFailure: (state, action) => {
      state.isLoading = false;
      state.isPasswordResetOTPVerified = false;
      state.error = action.payload;
    },
    clearPasswordResetOTPVerification: (state) => {
      state.isPasswordResetOTPVerified = false;
    },

    // ==================================
    // ------ Reset password ------------
    // ==================================
    resetPasswordStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    resetPasswordSuccess: (state) => {
      state.isLoading = false;
      state.isPasswordResetOTPVerified = false;
      state.error = null;
    },
    resetPasswordFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- Logout ---------------
    // ==================================
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.pendingRegistration = null;
      state.isPasswordResetOTPVerified = false;
      state.error = null;
    },

    // ==================================
    // -------- Update user -------------
    // ==================================
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
    },

    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  registerStart, registerSuccess, registerFailure,
  verifyOtpStart, verifyOtpSuccess, verifyOtpFailure,
  loginStart, loginSuccess, loginFailure,
  googleLoginStart, googleLoginSuccess, googleLoginFailure,
  forgotPasswordStart, forgotPasswordSuccess, forgotPasswordFailure,
  verifyPasswordResetOtpStart, verifyPasswordResetOtpSuccess, verifyPasswordResetOtpFailure,
  clearPasswordResetOTPVerification,
  resetPasswordStart, resetPasswordSuccess, resetPasswordFailure,
  logout,
  updateUser,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
