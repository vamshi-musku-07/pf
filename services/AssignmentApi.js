import createApiService from "@/lib/apiService";
import { ASSIGNMENT_API_URL } from "@/config/api";

const assignmentApi = createApiService(ASSIGNMENT_API_URL);

export const createAssignmentAPI = (assignmentData) =>
  assignmentApi.post("/assignments", assignmentData).then((r) => r.data);

export const getAssignmentsByTeamIdAPI = (teamId, eventType = null) => {
  const url = eventType
    ? `/team/${teamId}/assignments?eventType=${eventType}`
    : `/team/${teamId}/assignments`;
  return assignmentApi.get(url).then((r) => r.data);
};

export const getAssignmentsByEventIdAPI = (eventId) =>
  assignmentApi.get(`/event/${eventId}/assignments`).then((r) => r.data);

export const updateAssignmentAPI = (assignmentId, updateData) =>
  assignmentApi.put(`/assignments/${assignmentId}`, updateData).then((r) => r.data);

export const deleteAssignmentAPI = (assignmentId, teamId) =>
  assignmentApi.delete(`/assignments/${assignmentId}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`).then((r) => r.data);

export const respondToAssignmentAPI = (assignmentId, responseData) =>
  assignmentApi.put(`/assignments/${assignmentId}/respond`, responseData).then((r) => r.data);

export const getUserAssignmentsAPI = (teamId, email) =>
  assignmentApi.get(`/user-assignments?teamId=${encodeURIComponent(teamId)}&email=${encodeURIComponent(email)}`).then((r) => r.data);

export const getMyAssignmentsAPI = () =>
  assignmentApi.get("/my-assignments").then((r) => r.data);
