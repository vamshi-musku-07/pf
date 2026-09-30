# Live Scoring Architecture — Local-First, Event-Sourced, Batched Sync

This is the production-grade scoring architecture used by `play_flash_application`.
It mirrors the patterns used by GameChanger / Hudl / TeamSnap: a coach's tap is
**never** blocked on the network, and the server is **never** allowed to regress
the UI with a stale snapshot.

---

## The one rule that fixes everything

```
UI state = serverState  +  reduce(pendingEvents)
```

The UI **never** reads `serverState` directly. It reads a derived value that
re-applies every still-pending local event on top of the latest server snapshot.

Because pending events stay in the queue until the server acknowledges them by
`clientSeq`, an old REST poll or socket push **cannot** roll the score back —
the not-yet-acked taps simply replay on top.

---

## Folder layout

```
app/
├─ features/liveGame/
│  ├─ events/
│  │  ├─ eventTypes.js        # TT.POINT, TT.SERVE_ACE, ...
│  │  └─ createEvent.js       # event factory (optimisticId, ts, status)
│  ├─ reducers/
│  │  ├─ index.js             # registry: type -> applyEvent(state, evt)
│  │  └─ tableTennis.js       # pure per-sport reducers
│  ├─ sync/
│  │  ├─ syncWorker.js        # debounced batched POSTs + retries
│  │  └─ backoff.js
│  ├─ transport/
│  │  ├─ httpClient.js        # POST /games/:id/events:batch
│  │  └─ socketClient.js      # version-guarded server pushes
│  ├─ hooks/
│  │  └─ useLiveGame.js       # one-stop hook for sport panels
│  ├─ liveGameSlice.js        # Redux Toolkit slice
│  └─ selectors.js            # selectDerivedGame (memoized)
├─ store/
│  ├─ index.js                # added persisted `liveGame` reducer + syncMiddleware
│  └─ middleware/
│     └─ syncMiddleware.js    # kicks worker on every enqueueEvent
├─ utils/
│  └─ deviceId.js             # stable per-install id (for idempotency)
└─ components/game/
   └─ LiveTableTennisScoringPanel.jsx   # drop-in wrapper

game-service/
├─ models/
│  ├─ base-game.model.js      # + `version` field
│  └─ game-event.model.js     # append-only event log
├─ services/
│  └─ eventApplier.js         # pure per-sport reducers (server-side mirror)
├─ controllers/
│  └─ events-batch.controller.js
└─ routes/
   └─ game.routes.js          # POST /games/:id/events:batch
```

---

## Data flow

```
       ┌────────────────────────────────────────────────────────────┐
       │  Component                                                  │
       │   const { derivedGame, dispatchEvent } = useLiveGame(gameId)│
       │   onPress = () => dispatchEvent({ type: TT.POINT, ... })    │
       └────────────────────────────────────────────────────────────┘
                              │
                              ▼
       ┌────────────────────────────────────────────────────────────┐
       │  liveGameSlice.enqueueEvent                                 │
       │   - assigns monotonic clientSeq                             │
       │   - appends to pendingEvents[]                              │
       └────────────────────────────────────────────────────────────┘
                              │
            (selector recomputes derivedGame ← instant UI update)
                              │
                              ▼
       ┌────────────────────────────────────────────────────────────┐
       │  syncMiddleware → kickSyncWorker(gameId)                    │
       │   - debounces 120ms                                         │
       │   - batches up to 25 events                                 │
       │   - POST /games/:id/events:batch                            │
       └────────────────────────────────────────────────────────────┘
                              │
                              ▼
       ┌────────────────────────────────────────────────────────────┐
       │  Server                                                     │
       │   - dedupe by (deviceId, clientSeq) via unique index        │
       │   - apply each event → bump baseGame.version by +1          │
       │   - persist GameEvent log + sportGame + baseGame            │
       │   - broadcast { type: "batch_applied", version, game }      │
       └────────────────────────────────────────────────────────────┘
                              │
                              ▼
       ┌────────────────────────────────────────────────────────────┐
       │  Client receives ack                                        │
       │   - ackBatch: drop applied events from queue, set new       │
       │     serverState + serverVersion (version-guarded)           │
       │   - derivedGame recomputes from the new serverState + any   │
       │     still-pending events (taps that landed during flight)   │
       └────────────────────────────────────────────────────────────┘
```

---

## Why scores used to flicker — and why they can't now

**Before.** `useGameData` polled GET `/games/:id` every 10s and called
`setCurrentGame(game)` with whatever it got. If the user tapped at second 9.9
and the polled response (from second 0) came back at second 10.1, it overwrote
the optimistic score. Then the next sync request came back with the correct
score. UI: optimistic → old → correct = flicker.

**Now.** Three independent guards make that impossible:

1. **Version monotonicity** — `applyServerPush` and `ackBatch` drop any payload
   whose `version <= currentVersion`. Old polls can't beat newer state.
2. **Idempotent clientSeq** — even if the network retries a batch, the server
   applies each `(deviceId, clientSeq)` exactly once (DB unique index).
3. **Replay on top** — even if a *newer* server snapshot lands while taps are
   still in flight, those taps are still in `pendingEvents` and the selector
   re-applies them, so `derivedGame` cannot regress.

The score literally **cannot** go backwards by design.

---

## Rapid taps + rollback

- 10 fast taps → 10 entries in `pendingEvents`, UI updates instantly each time,
  one POST carries all 10. Server applies them in `clientSeq` order.
- Network error (5xx / offline) → `nackBatch({ fatal: false })` puts events
  back to `queued`, worker reschedules with exponential backoff + jitter.
  UI keeps showing the optimistic value — never a flicker.
- Server reject (4xx illegal event) → `nackBatch({ fatal: true })` removes the
  event from `pendingEvents` and `failedIds` lights up. `derivedGame`
  automatically removes its visual effect. Show a toast: "Couldn't record —
  tap to retry/dismiss." Use `rollbackOptimistic` to dismiss.

---

## Offline support

`liveGameSlice` is in the Redux Persist whitelist (`liveGame` -> AsyncStorage,
`whitelist: ["byGameId"]`). On app start, the persistor's onComplete callback
calls `resumeAllQueues(store)`, which:

1. Resets any leftover `inflight` events back to `queued` (crash recovery).
2. Kicks the sync worker for every game that has pending events.

A coach can score an entire inning on a plane and watch it sync the moment
they hit wifi — with zero data loss and no duplicates (idempotency).

---

## Adding another sport (≈30 min per sport)

1. Add event types to `events/eventTypes.js` (e.g. `CR = { RUN: "CR_RUN", ... }`).
2. Create `reducers/cricket.js` exporting `{ handlers: { CR_RUN: ... } }` —
   pure `(state, evt) => state`.
3. Merge into `reducers/index.js` registry.
4. Add the same handlers to `game-service/services/eventApplier.js`.
5. Wrap the sport's existing panel in a `LiveCricketScoringPanel.jsx` that
   calls `useLiveGame(gameId)` and maps legacy tap callbacks to `dispatchEvent`.

No store wiring, no new controller, no new route — the batch endpoint is
event-type agnostic.

---

## API contract

### `POST /api/games/:gameId/events:batch` (auth required)

Request:
```json
{
  "deviceId": "uuid-from-asyncstorage",
  "sinceVersion": 412,
  "events": [
    { "clientSeq": 87, "type": "TT_POINT", "payload": { "side": "home" }, "ts": 1715000000000 },
    { "clientSeq": 88, "type": "TT_POINT", "payload": { "side": "home" }, "ts": 1715000000130 }
  ]
}
```

Response (200):
```json
{
  "success": true,
  "version": 414,
  "appliedSeqs": [87, 88],
  "rejected": [],
  "state": { "base": { ... }, "sport": { ... }, "version": 414 }
}
```

- **Idempotent**: retrying the same body is safe — already-applied `clientSeq`
  values are reported in `appliedSeqs` without re-mutating state.
- **Atomic per event**: a rejected event does not corrupt sibling events in the
  batch. Each is applied independently in `clientSeq` order.
- **Single broadcast**: emits `batch_applied` once at the end of the batch.

---

## Migration plan

The new architecture lives **alongside** the existing `useGameData` / `useSportHandlers`
plumbing. To migrate a sport:

1. Replace the screen's import:
   ```diff
   - import TableTennisScoringPanel from "@/components/game/TableTennisScoringPanel";
   + import TableTennisScoringPanel from "@/components/game/LiveTableTennisScoringPanel";
   ```
2. Pass `gameId` instead of (or alongside) `currentGame`/`onScore`. The wrapper
   ignores those.
3. Done. Verify zero flicker on rapid taps, airplane mode, kill-and-relaunch.

Repeat per sport. Retire the legacy per-event POST endpoint and the legacy
`useSportHandlers` queue refs only when every sport is migrated.

---

## What makes this "professional"

| Property                          | Mechanism                                       |
| --------------------------------- | ----------------------------------------------- |
| Instant UI                        | `derivedGame` selector, no `await` on UI thread |
| No flicker                        | Version guard + replay on top                   |
| Rapid taps                        | Local queue, 120ms batching window              |
| Offline scoring                   | Redux Persist on `liveGame.byGameId`            |
| Exactly-once server processing    | Unique `(gameId, deviceId, clientSeq)` index    |
| Crash recovery                    | `resumeAllQueues` on rehydrate                  |
| Stale-response protection         | Monotonic `serverVersion` guard                 |
| Scalable broadcast                | Single emit per batch, room-per-gameId          |
| Rollback                          | `nackBatch({ fatal: true })` + `failedIds`      |
| Backpressure                      | Exponential backoff + jitter                    |
