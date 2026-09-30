import { useState, useCallback } from "react";
import {
  createEventAPI,
  getEventsAPI,
  getMyEventsAPI,
  getEventByIdAPI,
  updateEventAPI,
  deleteEventAPI,
  joinEventAPI,
  leaveEventAPI,
  addSignupSlotAPI,
  removeSignupSlotAPI,
  signUpForSlotAPI,
  withdrawFromSlotAPI,
  addPollAPI,
  removePollAPI,
  voteOnPollAPI,
  addEventCommentAPI,
  deleteEventCommentAPI,
  getNearbyEventsAPI,
} from "@/services/EventApi";

export default function useEvents() {
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (params = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEventsAPI(params);
      setEvents(data.events || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMyEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyEventsAPI();
      setMyEvents(data.events || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEventById = useCallback(async (eventId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEventByIdAPI(eventId);
      setCurrentEvent(data.event || data);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (eventData) => {
    setError(null);
    try {
      const data = await createEventAPI(eventData);
      setEvents((prev) => [data.event || data, ...prev]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateEvent = useCallback(async (eventId, updateData) => {
    setError(null);
    try {
      const data = await updateEventAPI(eventId, updateData);
      const updated = data.event || data;
      setEvents((prev) => prev.map((e) => ((e._id || e.id) === eventId ? updated : e)));
      setCurrentEvent(updated);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId) => {
    try {
      await deleteEventAPI(eventId);
      setEvents((prev) => prev.filter((e) => (e._id || e.id) !== eventId));
      setMyEvents((prev) => prev.filter((e) => (e._id || e.id) !== eventId));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const joinEvent = useCallback(async (eventId, name) => {
    try {
      const data = await joinEventAPI(eventId, name);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const leaveEvent = useCallback(async (eventId) => {
    try {
      const data = await leaveEventAPI(eventId);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addSlot = useCallback(async (eventId, slotData) => {
    try {
      const data = await addSignupSlotAPI(eventId, slotData);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const removeSlot = useCallback(async (eventId, slotId) => {
    try {
      const data = await removeSignupSlotAPI(eventId, slotId);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const signUpForSlot = useCallback(async (eventId, slotId, name) => {
    try {
      const data = await signUpForSlotAPI(eventId, slotId, name);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const withdrawFromSlot = useCallback(async (eventId, slotId) => {
    try {
      const data = await withdrawFromSlotAPI(eventId, slotId);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addPoll = useCallback(async (eventId, pollData) => {
    try {
      const data = await addPollAPI(eventId, pollData);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const removePoll = useCallback(async (eventId, pollId) => {
    try {
      const data = await removePollAPI(eventId, pollId);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const votePoll = useCallback(async (eventId, pollId, optionIndex) => {
    try {
      const data = await voteOnPollAPI(eventId, pollId, optionIndex);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const addComment = useCallback(async (eventId, commentData) => {
    try {
      const data = await addEventCommentAPI(eventId, commentData);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteComment = useCallback(async (eventId, commentId) => {
    try {
      const data = await deleteEventCommentAPI(eventId, commentId);
      if (data.event) setCurrentEvent(data.event);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const fetchNearby = useCallback(async (params) => {
    setIsLoading(true);
    try {
      const data = await getNearbyEventsAPI(params);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    events,
    myEvents,
    currentEvent,
    isLoading,
    error,
    fetchEvents,
    fetchMyEvents,
    fetchEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    joinEvent,
    leaveEvent,
    addSlot,
    removeSlot,
    signUpForSlot,
    withdrawFromSlot,
    addPoll,
    removePoll,
    votePoll,
    addComment,
    deleteComment,
    fetchNearby,
    setCurrentEvent,
  };
}
