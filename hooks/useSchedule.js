import { useState, useCallback } from "react";
import {
  createScheduleAPI,
  getSchedulesByTeamAPI,
  updateScheduleAPI,
  deleteScheduleAPI,
} from "@/services/ScheduleApi";

export default function useSchedule(teamId = null) {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSchedulesByTeamAPI(teamId);
      setSchedules(data.schedules || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const createSchedule = useCallback(async (scheduleData) => {
    setError(null);
    try {
      const data = await createScheduleAPI(scheduleData);
      setSchedules((prev) => [...prev, data.schedule || data]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateSchedule = useCallback(async (scheduleId, updateData) => {
    setError(null);
    try {
      const data = await updateScheduleAPI(scheduleId, updateData);
      setSchedules((prev) =>
        prev.map((s) => ((s._id || s.id) === scheduleId ? data.schedule || data : s))
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteSchedule = useCallback(async (scheduleId) => {
    try {
      await deleteScheduleAPI(scheduleId);
      setSchedules((prev) => prev.filter((s) => (s._id || s.id) !== scheduleId));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  return {
    schedules,
    isLoading,
    error,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
