import { useState, useCallback } from "react";
import {
  createAssignmentAPI,
  getAssignmentsByTeamIdAPI,
  getAssignmentsByEventIdAPI,
  updateAssignmentAPI,
  deleteAssignmentAPI,
  respondToAssignmentAPI,
} from "@/services/AssignmentApi";

export default function useAssignments(teamId = null) {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssignments = useCallback(
    async (eventType = null) => {
      if (!teamId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAssignmentsByTeamIdAPI(teamId, eventType);
        setAssignments(data.assignments || data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const fetchByEvent = useCallback(async (eventId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAssignmentsByEventIdAPI(eventId);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAssignment = useCallback(async (assignmentData) => {
    setError(null);
    try {
      const data = await createAssignmentAPI(assignmentData);
      setAssignments((prev) => [...prev, data.assignment || data]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateAssignment = useCallback(async (assignmentId, updateData) => {
    setError(null);
    try {
      const data = await updateAssignmentAPI(assignmentId, updateData);
      setAssignments((prev) =>
        prev.map((a) =>
          (a._id || a.id) === assignmentId ? data.assignment || data : a
        )
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      await deleteAssignmentAPI(assignmentId);
      setAssignments((prev) =>
        prev.filter((a) => (a._id || a.id) !== assignmentId)
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const respondToAssignment = useCallback(async (assignmentId, responseData) => {
    setError(null);
    try {
      const data = await respondToAssignmentAPI(assignmentId, responseData);
      setAssignments((prev) =>
        prev.map((a) =>
          (a._id || a.id) === assignmentId ? data.assignment || data : a
        )
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  return {
    assignments,
    isLoading,
    error,
    fetchAssignments,
    fetchByEvent,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    respondToAssignment,
  };
}
