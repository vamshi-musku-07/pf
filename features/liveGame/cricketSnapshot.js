import { reconcileCricketTotalsFromEvents } from "../../components/game/hooks/cricketState";

export function withCricketReconciledSnapshot(snapshot) {
  if (!snapshot?.base || snapshot.base.sport !== "Cricket" || !snapshot.sport) {
    return snapshot;
  }
  return reconcileCricketTotalsFromEvents(snapshot);
}
