/** Lightweight pub/sub so syncWorker can trigger commentary without importing React hooks. */
const listeners = new Set();

export const subscribeCommentaryPlayback = (handler) => {
  listeners.add(handler);
  return () => listeners.delete(handler);
};

export const emitCommentaryPlayback = (payload) => {
  listeners.forEach((handler) => {
    try {
      handler(payload);
    } catch {
      /* ignore listener errors */
    }
  });
};
