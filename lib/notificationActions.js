import { dismissInvitationAPI } from "@/services/PlayerApi";
import { getTeamMessagesAPI, markMultipleAsReadAPI } from "@/services/MessageApi";

const getMessageList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.data?.messages)) return payload.data.messages;
  return [];
};

const isUnreadForUser = (message, userId) => {
  const readBy = message?.readBy || [];
  return !readBy.some((entry) => String(entry.userId) === String(userId));
};

export const markTeamMessagesRead = async (teamId, userId) => {
  if (!teamId || !userId) return;
  try {
    const payload = await getTeamMessagesAPI(teamId, { limit: 100 });
    const messages = getMessageList(payload);
    const unreadIds = messages
      .filter((message) => isUnreadForUser(message, userId))
      .map((message) => message._id || message.id)
      .filter(Boolean);
    if (unreadIds.length) {
      await markMultipleAsReadAPI(unreadIds, userId);
    }
  } catch (err) {
    console.warn("[notificationActions] markTeamMessagesRead failed:", err?.message);
  }
};

export const dismissInvitationNotification = async (notificationId) => {
  const invitationId = String(notificationId).replace(/^inv_/, "");
  if (!invitationId) return;
  try {
    await dismissInvitationAPI(invitationId);
  } catch (err) {
    console.warn("[notificationActions] dismiss invitation failed:", err?.message);
  }
};

export const resolveNotificationOnDismiss = async (item, userId) => {
  if (!item?.type) return;
  if (item.type === "invitation") {
    await dismissInvitationNotification(item.id);
    return;
  }
  if (item.type === "message") {
    const teamId = item.params?.teamId || String(item.id).replace(/^msg_/, "");
    await markTeamMessagesRead(teamId, userId);
  }
};

export const resolveNotificationOnOpen = async (item, userId) => {
  if (item?.type === "message") {
    const teamId = item.params?.teamId || String(item.id).replace(/^msg_/, "");
    await markTeamMessagesRead(teamId, userId);
  }
};
