import createApiService from "@/lib/apiService";
import { TRICOUNT_API_URL } from "@/config/api";

const tricountApi = createApiService(TRICOUNT_API_URL);

// Groups
export const createGroupAPI = (data) =>
  tricountApi.post("/groups", data).then((r) => r.data);

export const getMyGroupsAPI = () =>
  tricountApi.get("/groups").then((r) => r.data);

export const getGroupByIdAPI = (id) =>
  tricountApi.get(`/groups/${id}`).then((r) => r.data);

export const updateGroupAPI = (id, data) =>
  tricountApi.put(`/groups/${id}`, data).then((r) => r.data);

export const deleteGroupAPI = (id) =>
  tricountApi.delete(`/groups/${id}`).then((r) => r.data);

// Share
export const joinGroupByShareAPI = (shareId) =>
  tricountApi.get(`/share/${encodeURIComponent(String(shareId || "").trim())}`).then((r) => r.data);

// Members
export const addMemberAPI = (groupId, data) =>
  tricountApi.post(`/groups/${groupId}/members`, data).then((r) => r.data);

export const removeMemberAPI = (groupId, memberId) =>
  tricountApi.delete(`/groups/${groupId}/members/${memberId}`).then((r) => r.data);

// Expenses
export const addExpenseAPI = (groupId, data) =>
  tricountApi.post(`/groups/${groupId}/expenses`, data).then((r) => r.data);

export const editExpenseAPI = (groupId, expenseId, data) =>
  tricountApi.put(`/groups/${groupId}/expenses/${expenseId}`, data).then((r) => r.data);

export const deleteExpenseAPI = (groupId, expenseId) =>
  tricountApi.delete(`/groups/${groupId}/expenses/${expenseId}`).then((r) => r.data);

// Settlements
export const addSettlementAPI = (groupId, data) =>
  tricountApi.post(`/groups/${groupId}/settlements`, data).then((r) => r.data);

// Favorite
export const toggleFavoriteAPI = (groupId) =>
  tricountApi.patch(`/groups/${groupId}/favorite`).then((r) => r.data);

// Archive (per-user toggle)
export const toggleArchiveAPI = (groupId) =>
  tricountApi.patch(`/groups/${groupId}/archive`).then((r) => r.data);

// Receipt OCR
export const scanReceiptAPI = (imageBase64, mimeType, mode) =>
  tricountApi.post("/scan-receipt", { imageBase64, mimeType, ...(mode ? { mode } : {}) }).then((r) => r.data);

// Expense receipt images
export const addReceiptImageAPI = (groupId, expenseId, file, mimeType) =>
  tricountApi.post(`/groups/${groupId}/expenses/${expenseId}/images`, { file, mimeType }).then((r) => r.data);

export const deleteReceiptImageAPI = (groupId, expenseId, imageId) =>
  tricountApi.delete(`/groups/${groupId}/expenses/${expenseId}/images/${imageId}`).then((r) => r.data);
