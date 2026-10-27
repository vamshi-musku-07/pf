import createApiService from "@/lib/apiService";
import { AUTH_API_URL } from "@/config/api";
import { getRefreshToken } from "@/lib/tokenStorage";

const authApi = createApiService(AUTH_API_URL);

export const googleLoginAPI = (idToken) => {
  return authApi
    .post("/google", { idToken }, { isPublic: true })
    .then((response) => response.data);
};

export const appleLoginAPI = ({ identityToken, nonce, fullName }) => {
  return authApi
    .post("/apple", { identityToken, nonce, fullName }, { isPublic: true })
    .then((response) => response.data);
};

export const loginAPI = (email, password) => {
  return authApi
    .post("/login", { email, password }, { isPublic: true })
    .then((response) => response.data);
};

export const registerAPI = (username, email, password) => {
  return authApi
    .post("/register", { username, email, password }, { isPublic: true })
    .then((response) => response.data);
};

export const verifyOTPAPI = (email, otp) => {
  return authApi
    .post("/verify-otp", { email, otp }, { isPublic: true })
    .then((response) => response.data);
};

export const resendOTPAPI = (email) => {
  return authApi
    .post("/resend-otp", { email }, { isPublic: true })
    .then((response) => response.data);
};

export const forgotPasswordAPI = (email) => {
  return authApi
    .post("/forgot-password", { email }, { isPublic: true })
    .then((response) => response.data);
};

export const verifyPasswordResetOTPAPI = (email, otp) => {
  return authApi
    .post("/verify-password-reset-otp", { email, otp }, { isPublic: true })
    .then((response) => response.data);
};

export const resetPasswordAPI = (email, otp, password, confirmPassword) => {
  return authApi
    .post("/reset-password", { email, token: otp, password, confirmPassword }, { isPublic: true })
    .then((response) => response.data);
};

export const logoutAPI = async () => {
  const refreshToken = await getRefreshToken();
  return authApi
    .post("/logout", { refreshToken: refreshToken || undefined })
    .then((response) => response.data);
};

export const refreshTokenAPI = (refreshToken) => {
  return authApi
    .post("/refresh", { refreshToken }, { isPublic: true })
    .then((response) => response.data);
};

export const deleteAccountAPI = () =>
  authApi
    .post("/delete-account", { confirm: true })
    .then((response) => response.data);

export const getUsersByIdsAPI = (userIds) =>
  authApi
    .post("/users/batch", { userIds })
    // Backend wraps the id→profile map as { success, data }. Unwrap to the map,
    // while staying compatible if a raw map is ever returned directly.
    .then((response) => response.data?.data ?? response.data ?? {});

export const getUserByEmailAPI = (email) =>
  authApi
    .get(`/user/email/${encodeURIComponent(email)}`)
    .then((response) => response.data);
