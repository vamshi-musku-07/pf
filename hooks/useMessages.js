import { useState, useCallback } from "react";
import { parseUnreadCount } from "@/lib/notificationsFeed";
import {
  getTeamMessagesAPI,
  createMessageAPI,
  deleteMessageAPI,
  markAsReadAPI,
  markMultipleAsReadAPI,
  searchMessagesAPI,
  getUnreadCountAPI,
  uploadMediaAPI,
} from "@/services/MessageApi";

export default function useMessages(teamId = null) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(
    async (params = {}) => {
      if (!teamId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTeamMessagesAPI(teamId, params);
        setMessages(data.messages || data);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const sendMessage = useCallback(async (messageData) => {
    setError(null);
    try {
      const data = await createMessageAPI(messageData);
      setMessages((prev) => [...prev, data.message || data]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const removeMessage = useCallback(async (messageId) => {
    try {
      await deleteMessageAPI(messageId);
      setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const markRead = useCallback(async (messageId, userId) => {
    try {
      await markAsReadAPI(messageId, userId);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, []);

  const markBulkRead = useCallback(async (messageIds, userId) => {
    try {
      await markMultipleAsReadAPI(messageIds, userId);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, []);

  const search = useCallback(
    async (query, params = {}) => {
      if (!teamId) return;
      setIsLoading(true);
      try {
        const data = await searchMessagesAPI(teamId, query, params);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await getUnreadCountAPI(teamId);
      setUnreadCount(parseUnreadCount(data));
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, [teamId]);

  const uploadMedia = useCallback(async (formData) => {
    try {
      const data = await uploadMediaAPI(formData);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  return {
    messages,
    unreadCount,
    isLoading,
    error,
    fetchMessages,
    sendMessage,
    removeMessage,
    markRead,
    markBulkRead,
    search,
    fetchUnreadCount,
    uploadMedia,
  };
}
