// Canonical event type catalogue. Keep these stable — they are wire format.
// Prefix by sport (TT_, CR_, TN_, BD_, ...) so the registry can route quickly.

export const TT = {
  POINT: "TT_POINT",                 // payload: { side: "home"|"away", reason?: string }
  UNFORCED_ERROR: "TT_UNFORCED_ERROR", // payload: { side }
  SERVE_ACE: "TT_SERVE_ACE",         // payload: { side }
  SERVE_ERROR: "TT_SERVE_ERROR",     // payload: { side }
  TIMEOUT: "TT_TIMEOUT",             // payload: { side }
  UNDO: "TT_UNDO",                   // payload: {}
};

// Each non-TT sport uses a single "legacy passthrough" event type whose
// payload.body is the same legacy event shape (`{ eventType, teamSide,
// teamId, playerId, ... }`) already used by `addGameEvent`. The client
// reducer delegates to the existing `applyOptimistic<Sport>Update` helper,
// and the server's batch endpoint runs the same per-sport preprocessing
// pipeline. This lets us migrate sports without touching their scoring
// rules or the legacy single-event endpoint.

export const LEGACY = {
  TENNIS: "LEGACY_TENNIS",
  BADMINTON: "LEGACY_BADMINTON",
  VOLLEYBALL: "LEGACY_VOLLEYBALL",
  PICKLEBALL: "LEGACY_PICKLEBALL",
  CRICKET: "LEGACY_CRICKET",
  RUGBY: "LEGACY_RUGBY",
  BASEBALL: "LEGACY_BASEBALL",
  BASKETBALL: "LEGACY_BASKETBALL",
  FOOTBALL: "LEGACY_FOOTBALL",
};

export const ALL_EVENT_TYPES = Object.freeze({ TT, LEGACY });
