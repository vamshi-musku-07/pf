import createApiService from "@/lib/apiService";
import { LIVE_STREAM_API_URL } from "@/config/api";

const liveStreamApi = createApiService(LIVE_STREAM_API_URL);

// Broadcaster: start a stream for a room, returns Agora publisher token
export const createStreamAPI = (room, teamId) =>
  liveStreamApi.post("/create-stream", { room, teamId }).then((r) => r.data);

// Viewer: get Agora subscriber token for an active room
export const getStreamAPI = (room) =>
  liveStreamApi.get(`/stream/${encodeURIComponent(room)}`).then((r) => r.data);

// Viewer: resolve active stream by team (room-agnostic), then get subscriber token
export const getActiveTeamStreamAPI = (teamId) =>
  liveStreamApi.get(`/stream/team/${encodeURIComponent(teamId)}`).then((r) => r.data);

// Refresh an expiring token (role: "publisher" | "subscriber")
export const refreshStreamTokenAPI = (room, role) =>
  liveStreamApi.post("/refresh-token", { room, role }).then((r) => r.data);

// Broadcaster: close the room
export const endStreamAPI = (room) =>
  liveStreamApi.delete(`/end-stream/${encodeURIComponent(room)}`).then((r) => r.data);

// Viewer presence: send heartbeat (also acts as join on first call)
export const viewerHeartbeatAPI = (room) =>
  liveStreamApi
    .post(`/stream/${encodeURIComponent(room)}/viewer/heartbeat`)
    .then((r) => r.data);

// Viewer presence: explicit leave (best-effort on stream exit)
export const viewerLeaveAPI = (room) =>
  liveStreamApi
    .post(`/stream/${encodeURIComponent(room)}/viewer/leave`)
    .then((r) => r.data);

// Live viewer count + whether the room already has a broadcaster
export const getStreamStatusAPI = (room) =>
  liveStreamApi
    .get(`/stream/${encodeURIComponent(room)}/viewer-count`)
    .then((r) => r.data);

export const getViewerCountAPI = getStreamStatusAPI;
