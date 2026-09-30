import { useState, useCallback } from "react";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  getTeamsAPI,
  createTeamAPI,
  updateTeamAPI,
  deleteTeamAPI,
} from "@/services/TeamApi";

export const useTeams = () => {
  const { isSignedIn } = useBackendAuth();
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTeams = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getTeamsAPI();
      setTeams(result.data || result.teams || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to fetch teams");
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const createTeam = useCallback(
    async (teamData) => {
      setError(null);
      try {
        const result = await createTeamAPI(teamData);
        await fetchTeams();
        return result;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Failed to create team";
        setError(msg);
        throw err;
      }
    },
    [fetchTeams]
  );

  const updateTeam = useCallback(
    async (teamId, updateData) => {
      setError(null);
      try {
        const result = await updateTeamAPI(teamId, updateData);
        await fetchTeams();
        return result;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Failed to update team";
        setError(msg);
        throw err;
      }
    },
    [fetchTeams]
  );

  const deleteTeam = useCallback(
    async (teamId) => {
      setError(null);
      try {
        const result = await deleteTeamAPI(teamId);
        setTeams((prev) => prev.filter((t) => t._id !== teamId));
        return result;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Failed to delete team";
        setError(msg);
        throw err;
      }
    },
    []
  );

  return {
    teams,
    isLoading,
    error,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
  };
};
