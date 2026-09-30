import createApiService from "@/lib/apiService";
import { CHATBOT_API_URL } from "@/config/api";

const chatbotApi = createApiService(CHATBOT_API_URL);

export const sendChatMessageAPI = (message, sessionId, context) =>
  chatbotApi
    .post("/chat", { message, sessionId, context })
    .then((r) => r.data);

export const clearChatAPI = (sessionId) =>
  chatbotApi.post("/clear", { sessionId }).then((r) => r.data);

export const generateAssignmentMessageAPI = (payload) =>
  chatbotApi.post("/assignment-message", payload).then((r) => r.data);

export const generateTournamentExplainerAPI = (payload) =>
  chatbotApi.post("/tournament-explainer", payload).then((r) => r.data);
