import { appendPushInboxItem } from "@/lib/pushInboxStore";
import { isTricountPushNotification } from "@/lib/tricountNotifications";
import { isCommunityPushNotification } from "@/lib/communityNotifications";
import { normalizeNotificationData } from "@/lib/notificationRouting";
import { refreshNotificationBadge } from "@/lib/notificationBadge";

/**
 * Persist split-bill / community pushes locally, then refresh header badge listeners.
 * Must complete before badge count is recalculated (avoids race with inbox fetch).
 */
export const handleIncomingPushNotification = async (backendUser, notification) => {
  const content = notification?.request?.content || {};
  const data = normalizeNotificationData(content.data || {});

  if (isTricountPushNotification(data) || isCommunityPushNotification(data)) {
    await appendPushInboxItem(backendUser, {
      title: content.title,
      body: content.body,
      data,
    });
  }

  refreshNotificationBadge();
};
