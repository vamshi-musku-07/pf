import { useState, useCallback } from "react";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getMyTournamentInvitesAPI } from "@/services/TournamentApi";

let cache = { data: [], fetchedAt: 0, hasValue: false };
const TTL_MS = 15000;
let inflight = null;

export const useTournamentInvites = () => {
  const { isSignedIn } = useBackendAuth();
  const [invites, setInvites] = useState(() => cache.data);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvites = useCallback(async ({ force = false } = {}) => {
    if (!isSignedIn) {
      setInvites([]);
      return [];
    }
    if (!force && cache.hasValue && Date.now() - cache.fetchedAt < TTL_MS) {
      setInvites(cache.data);
      return cache.data;
    }
    if (inflight) return inflight;

    setIsLoading(true);
    setError(null);
    inflight = getMyTournamentInvitesAPI()
      .then((res) => {
        const list = res?.data || [];
        cache = { data: list, fetchedAt: Date.now(), hasValue: true };
        setInvites(list);
        return list;
      })
      .catch((err) => {
        setError(err);
        throw err;
      })
      .finally(() => {
        setIsLoading(false);
        inflight = null;
      });
    return inflight;
  }, [isSignedIn]);

  return { invites, isLoading, error, fetchInvites };
};
