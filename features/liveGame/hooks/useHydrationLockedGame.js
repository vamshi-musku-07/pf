// Returns the game object that Live<Sport> wrappers must render from.
//
// Rule (per user spec, do not relax):
//   - Before hydration (derivedGame === null && fallback exists): use fallback.
//   - The moment derivedGame becomes non-null: lock onto it forever.
//   - After hydration: NEVER fall back to the prop (`rest.currentGame`).
//     This prevents flicker caused by parent-screen polling/socket pushes
//     overwriting parent state while the local-first queue holds newer data.
//
// Returns `{ game, hasHydrated }`.

import { useRef } from "react";

export function useHydrationLockedGame(derivedGame, fallback) {
  const hasHydratedRef = useRef(false);
  if (derivedGame) hasHydratedRef.current = true;

  if (hasHydratedRef.current) {
    // Locked onto live state, but keep fallback if derived is briefly null
    // (avoids volleyball lineup-setup replacing the scoring panel).
    return { game: derivedGame || fallback || null, hasHydrated: true };
  }
  // Pre-hydration: fallback is allowed (and necessary to render anything).
  return { game: fallback || null, hasHydrated: false };
}
