import { useState, useCallback } from "react";
import {
  createGroupAPI,
  getMyGroupsAPI,
  getGroupByIdAPI,
  updateGroupAPI,
  deleteGroupAPI,
  joinGroupByShareAPI,
  addMemberAPI,
  removeMemberAPI,
  addExpenseAPI,
  editExpenseAPI,
  deleteExpenseAPI,
  addSettlementAPI,
  toggleFavoriteAPI,
} from "@/services/TriCountApi";

export default function useTricount() {
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyGroupsAPI();
      setGroups(data.groups || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchGroupById = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGroupByIdAPI(id);
      setCurrentGroup(data.group || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (groupData) => {
    setError(null);
    try {
      const data = await createGroupAPI(groupData);
      setGroups((prev) => [data.group || data, ...prev]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateGroup = useCallback(async (id, updateData) => {
    setError(null);
    try {
      const data = await updateGroupAPI(id, updateData);
      const updated = data.group || data;
      setGroups((prev) => prev.map((g) => ((g._id || g.id) === id ? updated : g)));
      setCurrentGroup(updated);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteGroup = useCallback(async (id) => {
    try {
      await deleteGroupAPI(id);
      setGroups((prev) => prev.filter((g) => (g._id || g.id) !== id));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const joinByShare = useCallback(async (shareId) => {
    setError(null);
    try {
      const data = await joinGroupByShareAPI(shareId);
      setCurrentGroup(data.group || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addMember = useCallback(async (groupId, memberData) => {
    try {
      const data = await addMemberAPI(groupId, memberData);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const removeMember = useCallback(async (groupId, memberId) => {
    try {
      const data = await removeMemberAPI(groupId, memberId);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addExpense = useCallback(async (groupId, expenseData) => {
    try {
      const data = await addExpenseAPI(groupId, expenseData);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const editExpense = useCallback(async (groupId, expenseId, expenseData) => {
    try {
      const data = await editExpenseAPI(groupId, expenseId, expenseData);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteExpense = useCallback(async (groupId, expenseId) => {
    try {
      const data = await deleteExpenseAPI(groupId, expenseId);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addSettlement = useCallback(async (groupId, settlementData) => {
    try {
      const data = await addSettlementAPI(groupId, settlementData);
      if (data.group) setCurrentGroup(data.group);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const toggleFavorite = useCallback(async (groupId) => {
    try {
      const data = await toggleFavoriteAPI(groupId);
      setGroups((prev) =>
        prev.map((g) =>
          (g._id || g.id) === groupId ? { ...g, isFavorite: !g.isFavorite } : g
        )
      );
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  return {
    groups,
    currentGroup,
    isLoading,
    error,
    fetchGroups,
    fetchGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    joinByShare,
    addMember,
    removeMember,
    addExpense,
    editExpense,
    deleteExpense,
    addSettlement,
    toggleFavorite,
    setCurrentGroup,
  };
}
