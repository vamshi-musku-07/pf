import { useState, useCallback } from "react";
import {
  getMyAvailabilityAPI,
  updateMyAvailabilityAPI,
  getTeamAvailabilityAPI,
  bulkUpdateAvailabilityAPI,
  getPlayerAvailabilityAPI,
  getEventsWithAvailabilityAPI,
  setEventAvailabilityAPI,
  getAllMyAvailabilitiesAPI,
  getTeamAllAvailabilitiesAPI,
} from "@/services/AvailabilityApi";

export default function useAvailability(teamId = null) {
  const [myAvailability, setMyAvailability] = useState(null);
  const [teamAvailability, setTeamAvailability] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMyAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyAvailabilityAPI();
      setMyAvailability(data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllMyAvailabilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllMyAvailabilitiesAPI();
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateMyAvailability = useCallback(
    async (availability, eventType = "game") => {
      setError(null);
      try {
        const data = await updateMyAvailabilityAPI(availability, eventType, teamId);
        setMyAvailability(data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const fetchTeamAvailability = useCallback(
    async (eventType = "game") => {
      if (!teamId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTeamAvailabilityAPI(teamId, eventType);
        setTeamAvailability(data.availability || data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const fetchTeamAllAvailabilities = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTeamAllAvailabilitiesAPI(teamId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const bulkUpdate = useCallback(
    async (updates) => {
      if (!teamId) return;
      setError(null);
      try {
        const data = await bulkUpdateAvailabilityAPI(teamId, updates);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const fetchPlayerAvailability = useCallback(async (playerId) => {
    try {
      const data = await getPlayerAvailabilityAPI(playerId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, []);

  const fetchEventsWithAvailability = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await getEventsWithAvailabilityAPI(teamId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, [teamId]);

  const setEventAvailability = useCallback(async (eventId, availability) => {
    setError(null);
    try {
      const data = await setEventAvailabilityAPI(eventId, availability);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  return {
    myAvailability,
    teamAvailability,
    isLoading,
    error,
    fetchMyAvailability,
    fetchAllMyAvailabilities,
    updateMyAvailability,
    fetchTeamAvailability,
    fetchTeamAllAvailabilities,
    bulkUpdate,
    fetchPlayerAvailability,
    fetchEventsWithAvailability,
    setEventAvailability,
  };
}
