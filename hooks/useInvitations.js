import { useState, useCallback, useEffect } from "react";
import { useBackendAuth } from "@/context/BackendAuthContext";
import {
  getUserInvitationsAPI,
  acceptInvitationAPI,
  dismissInvitationAPI,
} from "@/services/PlayerApi";

const INVITATIONS_CACHE_TTL_MS = 15000;

let invitationsCache = {
  data: [],
  fetchedAt: 0,
  hasValue: false,
};

let invitationsRequest = null;
let dismissedInvitationIds = new Set();

const getInvitationId = (invitation) =>
  String(invitation?.invitationId || invitation?._id || invitation?.playerId || "");

const filterDismissedInvitations = (data = []) => {
  if (dismissedInvitationIds.size === 0) return data;
  return data.filter((invitation) => !dismissedInvitationIds.has(getInvitationId(invitation)));
};

const hasFreshCache = () => {
  if (!invitationsCache.hasValue) return false;
  return Date.now() - invitationsCache.fetchedAt < INVITATIONS_CACHE_TTL_MS;
};

const setInvitationsCache = (data) => {
  const visibleData = filterDismissedInvitations(data);
  invitationsCache = {
    data: visibleData,
    fetchedAt: Date.now(),
    hasValue: true,
  };
  return visibleData;
};

const clearInvitationsCache = () => {
  invitationsCache = {
    data: [],
    fetchedAt: 0,
    hasValue: false,
  };
  invitationsRequest = null;
  dismissedInvitationIds = new Set();
};

export const useInvitations = () => {
  const { isSignedIn } = useBackendAuth();
  const [invitations, setInvitations] = useState(() => invitationsCache.data);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) {
      setInvitations([]);
      setIsLoading(false);
      setError(null);
      clearInvitationsCache();
    }
  }, [isSignedIn]);

  const fetchInvitations = useCallback(async (options = {}) => {
    const force = options?.force === true;

    if (!isSignedIn) {
      clearInvitationsCache();
      setInvitations([]);
      return [];
    }

    if (!force && hasFreshCache()) {
      setInvitations(invitationsCache.data);
      setIsLoading(false);
      return invitationsCache.data;
    }

    if (!force && invitationsRequest) {
      setIsLoading(!invitationsCache.hasValue);
      try {
        const data = filterDismissedInvitations(await invitationsRequest);
        setInvitations(data);
        return data;
      } catch (err) {
        setError(
          err.response?.data?.message || err.message || "Failed to fetch invitations"
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(!invitationsCache.hasValue);
    setError(null);

    invitationsRequest = getUserInvitationsAPI()
      .then((result) => {
        const data = result.data || [];
        return setInvitationsCache(data);
      })
      .finally(() => {
        invitationsRequest = null;
      });

    try {
      const data = filterDismissedInvitations(await invitationsRequest);
      setInvitations(data);
      return data;
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to fetch invitations"
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const acceptInvitation = useCallback(
    async (token, email) => {
      try {
        const result = await acceptInvitationAPI(token, email);
        await fetchInvitations({ force: true });
        return result;
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || "Failed to accept invitation";
        throw new Error(msg);
      }
    },
    [fetchInvitations]
  );

  const dismissInvitation = useCallback(
    async (invitationId) => {
      try {
        await dismissInvitationAPI(invitationId);
        dismissedInvitationIds.add(String(invitationId));
        setInvitations((prev) => {
          const dismissedInvitationId = String(invitationId);
          const nextInvitations = prev.filter(
            (invitation) => getInvitationId(invitation) !== dismissedInvitationId
          );
          setInvitationsCache(nextInvitations);
          return nextInvitations;
        });
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || "Failed to dismiss invitation";
        throw new Error(msg);
      }
    },
    []
  );

  return {
    invitations,
    isLoading,
    error,
    fetchInvitations,
    acceptInvitation,
    dismissInvitation,
  };
};
