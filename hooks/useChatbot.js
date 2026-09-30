import { useState, useCallback, useRef } from "react";
import { sendChatMessageAPI, clearChatAPI } from "@/services/ChatbotApi";

export default function useChatbot(getContext) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const sessionIdRef = useRef(null);

  const sendMessage = useCallback(async (message) => {
    setIsLoading(true);
    setError(null);

    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const context = typeof getContext === "function" ? getContext() : undefined;
      const data = await sendChatMessageAPI(message, sessionIdRef.current, context);
      if (data?.data?.sessionId) sessionIdRef.current = data.data.sessionId;

      const reply =
        data?.data?.reply ||
        data?.reply ||
        "Sorry, I couldn't understand that. Please try again.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [getContext]);

  const clearChat = useCallback(async () => {
    try {
      if (sessionIdRef.current) {
        await clearChatAPI(sessionIdRef.current);
      }
      setMessages([]);
      sessionIdRef.current = null;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };
}
