import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Messages keyed by teamId for multi-team support
  messagesByTeam: {},
  // Unread count per teamId
  unreadCounts: {},
  isLoading: false,
  isSending: false,
  error: null,
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchMessagesStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchMessagesSuccess: (state, action) => {
      // action.payload: { teamId, messages }
      state.isLoading = false;
      state.messagesByTeam[action.payload.teamId] = action.payload.messages;
      state.error = null;
    },
    fetchMessagesFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- SEND -----------------
    // ==================================
    sendMessageStart: (state) => {
      state.isSending = true;
      state.error = null;
    },
    sendMessageSuccess: (state, action) => {
      // action.payload: { teamId, message }
      state.isSending = false;
      const { teamId, message } = action.payload;
      if (!state.messagesByTeam[teamId]) {
        state.messagesByTeam[teamId] = [];
      }
      state.messagesByTeam[teamId] = [...state.messagesByTeam[teamId], message];
      state.error = null;
    },
    sendMessageFailure: (state, action) => {
      state.isSending = false;
      state.error = action.payload;
    },

    // ==================================
    // ------ REAL-TIME (socket) --------
    // ==================================
    addIncomingMessage: (state, action) => {
      // action.payload: { teamId, message }
      const { teamId, message } = action.payload;
      if (!state.messagesByTeam[teamId]) {
        state.messagesByTeam[teamId] = [];
      }
      const exists = state.messagesByTeam[teamId].some(
        (m) => m._id === message._id
      );
      if (!exists) {
        state.messagesByTeam[teamId] = [...state.messagesByTeam[teamId], message];
      }
    },

    // ==================================
    // ------- UNREAD COUNTS ------------
    // ==================================
    setUnreadCount: (state, action) => {
      // action.payload: { teamId, count }
      state.unreadCounts[action.payload.teamId] = action.payload.count;
    },
    incrementUnread: (state, action) => {
      // action.payload: teamId
      const teamId = action.payload;
      state.unreadCounts[teamId] = (state.unreadCounts[teamId] || 0) + 1;
    },
    clearUnread: (state, action) => {
      // action.payload: teamId
      state.unreadCounts[action.payload] = 0;
    },

    clearTeamMessages: (state, action) => {
      delete state.messagesByTeam[action.payload];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchMessagesStart, fetchMessagesSuccess, fetchMessagesFailure,
  sendMessageStart, sendMessageSuccess, sendMessageFailure,
  addIncomingMessage,
  setUnreadCount, incrementUnread, clearUnread,
  clearTeamMessages,
  clearError,
} = messageSlice.actions;

export default messageSlice.reducer;
