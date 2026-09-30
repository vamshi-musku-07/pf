import createApiService from "@/lib/apiService";
import { EVENT_API_URL } from "@/config/api";

const eventApi = createApiService(EVENT_API_URL);

// Event CRUD
export const createEventAPI = (eventData) =>
  eventApi.post("/", eventData).then((r) => r.data);

export const getEventsAPI = (params = {}) =>
  eventApi.get("/", { params }).then((r) => r.data);

export const getMyEventsAPI = () =>
  eventApi.get("/my-events").then((r) => r.data);

export const getJoinedEventsAPI = () =>
  eventApi.get("/joined-events").then((r) => r.data);

export const getEventByIdAPI = (eventId) =>
  eventApi.get(`/${eventId}`).then((r) => r.data);

export const updateEventAPI = (eventId, updateData) =>
  eventApi.put(`/${eventId}`, updateData).then((r) => r.data);

export const deleteEventAPI = (eventId) =>
  eventApi.delete(`/${eventId}`).then((r) => r.data);

// Participant (RSVP)
export const joinEventAPI = (eventId, name) =>
  eventApi.post(`/${eventId}/join`, { name }).then((r) => r.data);

export const leaveEventAPI = (eventId) =>
  eventApi.post(`/${eventId}/leave`).then((r) => r.data);

// Signup slots
export const addSignupSlotAPI = (eventId, slotData) =>
  eventApi.post(`/${eventId}/slots`, slotData).then((r) => r.data);

export const removeSignupSlotAPI = (eventId, slotId) =>
  eventApi.delete(`/${eventId}/slots/${slotId}`).then((r) => r.data);

export const signUpForSlotAPI = (eventId, slotId, name) =>
  eventApi.post(`/${eventId}/slots/${slotId}/signup`, { name }).then((r) => r.data);

export const withdrawFromSlotAPI = (eventId, slotId) =>
  eventApi.post(`/${eventId}/slots/${slotId}/withdraw`).then((r) => r.data);

// Polls
export const addPollAPI = (eventId, pollData) =>
  eventApi.post(`/${eventId}/polls`, pollData).then((r) => r.data);

export const removePollAPI = (eventId, pollId) =>
  eventApi.delete(`/${eventId}/polls/${pollId}`).then((r) => r.data);

export const voteOnPollAPI = (eventId, pollId, optionIndex) =>
  eventApi.post(`/${eventId}/polls/${pollId}/vote`, { optionIndex }).then((r) => r.data);

// Comments
export const addEventCommentAPI = (eventId, commentData) =>
  eventApi.post(`/${eventId}/comments`, commentData).then((r) => r.data);

export const deleteEventCommentAPI = (eventId, commentId) =>
  eventApi.delete(`/${eventId}/comments/${commentId}`).then((r) => r.data);

// Share
export const getEventByShareIdAPI = (shareId) =>
  eventApi.get(`/share/${shareId}`, { isPublic: true }).then((r) => r.data);

// Nearby Events
export const getNearbyEventsAPI = (params) =>
  eventApi.get("/nearby", { params }).then((r) => r.data);

// Photos
export const addEventPhotoAPI = (eventId, file, mimeType, caption) =>
  eventApi.post(`/${eventId}/photos`, { file, mimeType, caption }).then((r) => r.data);

export const deleteEventPhotoAPI = (eventId, photoId) =>
  eventApi.delete(`/${eventId}/photos/${photoId}`).then((r) => r.data);

// Announcements
export const addAnnouncementAPI = (eventId, data) =>
  eventApi.post(`/${eventId}/announcements`, data).then((r) => r.data);

export const deleteAnnouncementAPI = (eventId, announcementId) =>
  eventApi.delete(`/${eventId}/announcements/${announcementId}`).then((r) => r.data);

// Recap
export const postRecapAPI = (eventId, data) =>
  eventApi.put(`/${eventId}/recap`, data).then((r) => r.data);
