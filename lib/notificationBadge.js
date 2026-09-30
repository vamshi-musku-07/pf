const listeners = new Set();

export const subscribeNotificationBadge = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const refreshNotificationBadge = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
};
