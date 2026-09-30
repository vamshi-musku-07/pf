import { createContext, useContext, useRef } from "react";

const LiveStreamContext = createContext(null);

export function useLiveStream() {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) throw new Error("useLiveStream must be inside LiveStreamProvider");
  return ctx;
}

const noop = () => {};

export function LiveStreamProvider({ children }) {
  const engineRef = useRef(null);

  return (
    <LiveStreamContext.Provider
      value={{
        streamState: null,
        engineRef,
        startStream: noop,
        minimize: noop,
        maximize: noop,
        endStream: noop,
        toggleMute: noop,
        switchCamera: noop,
      }}
    >
      {children}
    </LiveStreamContext.Provider>
  );
}
