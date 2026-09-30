import createApiService from "@/lib/apiService";
import { SCHEDULE_API_URL } from "@/config/api";

const scheduleApi = createApiService(SCHEDULE_API_URL);

export const createScheduleAPI = (scheduleData) =>
  scheduleApi.post("/createschedule", scheduleData).then((r) => r.data);

export const getSchedulesByTeamAPI = (teamId, { refresh = false } = {}) =>
  scheduleApi
    .get(`/getSchedules/${teamId}`, { params: refresh ? { refresh: "true" } : {} })
    .then((r) => r.data);

export const updateScheduleAPI = (scheduleId, updateData) =>
  scheduleApi.put(`/updateschedule/${scheduleId}`, updateData).then((r) => r.data);

export const deleteScheduleAPI = (scheduleId) =>
  scheduleApi.delete(`/deleteschedule/${scheduleId}`).then((r) => r.data);
