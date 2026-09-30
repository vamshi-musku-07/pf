import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { buildNotificationsFeed } from "@/lib/notificationsFeed";
import { subscribeNotificationBadge } from "@/lib/notificationBadge";
import {
  filterNotificationsByStore,
  getNotificationUserId,
} from "@/lib/notificationsStore";
import { useBackendAuth } from "@/context/BackendAuthContext";

const NotificationBadgeContext = createContext({ unreadCount: 0, refresh: () => {} });

export function NotificationBadgeProvider({ children }) {
  const { backendUser, isSignedIn } = useBackendAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = getNotificationUserId(backendUser);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const feed = await buildNotificationsFeed(backendUser);
      const { unreadCount: count } = await filterNotificationsByStore(feed, userId);
      setUnreadCount(count);
    } catch {
      // keep previous count on transient failures
    }
  }, [isSignedIn, backendUser, userId]);

  useEffect(() => subscribeNotificationBadge(refresh), [refresh]);

  useEffect(() => {
    if (isSignedIn) refresh();
    else setUnreadCount(0);
  }, [isSignedIn, refresh]);

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export const useNotificationBadge = () => useContext(NotificationBadgeContext);
