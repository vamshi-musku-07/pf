import { getUserInvitationsAPI, getNotificationInboxAPI } from "@/services/PlayerApi";
import { getTeamsAPI } from "@/services/TeamApi";
import { getUnreadCountAPI } from "@/services/MessageApi";
import { getMyEventsAPI } from "@/services/EventApi";
import { getMyAssignmentsAPI } from "@/services/AssignmentApi";
import { getPushInboxItems } from "@/lib/pushInboxStore";
import { invitationParamsFromRecord } from "@/lib/openTeamInvitation";
import { isTricountPushNotification, mergeTricountInboxItems } from "@/lib/tricountNotifications";
import { buildCommunityInboxNotifications } from "@/lib/communityNotifications";

const TEAM_SCAN_LIMIT = 10;
const UNREAD_CONCURRENCY = 5;

export const parseUnreadCount = (payload) => {
  if (payload == null) return 0;
  if (typeof payload === "number") return payload;
  if (typeof payload.data?.unreadCount === "number") return payload.data.unreadCount;
  if (typeof payload.unreadCount === "number") return payload.unreadCount;
  if (typeof payload.count === "number") return payload.count;
  return 0;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const settledValue = (settled) =>
  settled?.status === "fulfilled" ? settled.value : null;

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await worker(items[i], i);
      } catch {
        results[i] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

const buildInvitationNotifs = (invites) =>
  safeArray(invites)
    .filter((inv) => !inv.isAccepted && !inv.isDismissed)
    .map((inv) => ({
      id: `inv_${inv.invitationId || inv._id}`,
      type: "invitation",
      icon: "mail-outline",
      iconBg: "#DBEAFE",
      iconColor: "#1E40AF",
      title: "Team Invitation",
      body: `You've been invited to join ${inv.teamName || "a team"} as ${inv.role || inv.playerRole || "player"}.`,
      time: inv.createdAt || inv.sentAt,
      route: "/invitation-rsvp",
      params: invitationParamsFromRecord(inv),
    }));

const mergeOwnedAndMemberTeams = (ownedRes, invites) => {
  const map = new Map();
  const owned = ownedRes?.data || ownedRes?.teams || [];
  for (const t of safeArray(owned)) if (t?._id) map.set(t._id, t);
  for (const inv of safeArray(invites)) {
    if (inv?.isAccepted && inv?.teamId && !map.has(inv.teamId)) {
      map.set(inv.teamId, { _id: inv.teamId, teamName: inv.teamName || inv.teamId });
    }
  }
  return Array.from(map.values());
};

const buildEventNotifs = (eventsRes, myId) => {
  const myEvents = eventsRes?.events || eventsRes?.data || [];
  return safeArray(myEvents).flatMap((ev) => {
    const others = safeArray(ev.participants).filter(
      (p) => p.userId && p.userId !== myId,
    );
    if (others.length === 0) return [];
    return [{
      id: `event_${ev._id}`,
      type: "event",
      icon: "people-outline",
      iconBg: "#FEF3C7",
      iconColor: "#92400E",
      title: `${others.length} joined your event`,
      body: ev.title,
      time: ev.updatedAt,
      route: "/events",
    }];
  });
};

const buildAssignmentNotifs = (assignmentsRes) => {
  const pending = assignmentsRes?.data || [];
  return safeArray(pending).map((a) => ({
    id: `assignment_${a._id}`,
    type: "assignment",
    icon: "clipboard-outline",
    iconBg: "#FEF3C7",
    iconColor: "#92400E",
    title: `Assignment: ${a.assignment}`,
    body: a.assignedTeamName
      ? `Pending assignment in ${a.assignedTeamName}`
      : "You have a pending assignment",
    time: a.createdAt,
    route: "/team/[teamId]",
    params: { teamId: a.teamId, initialTab: "ASSIGNMENTS" },
  }));
};

const buildTricountNotifs = (inboxRes, localItems) => {
  const serverItems = (inboxRes?.notifications || inboxRes?.data || []).filter(
    (item) => isTricountPushNotification(item?.data),
  );
  const localTricount = safeArray(localItems).filter((item) =>
    isTricountPushNotification(item?.data),
  );
  return mergeTricountInboxItems(serverItems, localTricount);
};

const buildCommunityNotifs = (inboxRes, localItems) => {
  const serverItems = inboxRes?.notifications || inboxRes?.data || [];
  return buildCommunityInboxNotifications([
    ...safeArray(serverItems),
    ...safeArray(localItems),
  ]);
};

/**
 * Build a merged notifications feed.
 *
 * All independent network calls run in parallel via Promise.allSettled, and
 * the invitations endpoint is fetched once and reused for both the invitation
 * cards and member-team discovery. Per-team unread fetches are bounded by a
 * concurrency pool so we never open dozens of parallel sockets.
 */
export const buildNotificationsFeed = async (backendUser) => {
  const myId = backendUser?.id || backendUser?._id;

  // Top-level parallel fan-out.
  const [
    invitesSettled,
    teamsSettled,
    eventsSettled,
    assignmentsSettled,
    inboxSettled,
    localInboxSettled,
  ] = await Promise.allSettled([
    getUserInvitationsAPI(),
    getTeamsAPI(),
    getMyEventsAPI(),
    getMyAssignmentsAPI(),
    getNotificationInboxAPI(),
    getPushInboxItems(backendUser),
  ]);

  const invitesRes = settledValue(invitesSettled);
  const invites = invitesRes?.data || [];
  const ownedRes = settledValue(teamsSettled);
  const eventsRes = settledValue(eventsSettled);
  const assignmentsRes = settledValue(assignmentsSettled);
  const inboxRes = settledValue(inboxSettled);
  const localInbox = settledValue(localInboxSettled) || [];

  // Build sections that don't need a second network round-trip immediately.
  const invitationNotifs = buildInvitationNotifs(invites);
  const eventNotifs = buildEventNotifs(eventsRes, myId);
  const assignmentNotifs = buildAssignmentNotifs(assignmentsRes);
  const tricountNotifs = buildTricountNotifs(inboxRes, localInbox);
  const communityNotifs = buildCommunityNotifs(inboxRes, localInbox);

  // Unread message counts — bounded concurrency pool.
  const allTeams = mergeOwnedAndMemberTeams(ownedRes, invites);
  const teamsToCheck = allTeams.slice(0, TEAM_SCAN_LIMIT);
  const unreadResults = await mapPool(teamsToCheck, UNREAD_CONCURRENCY, async (t) => {
    try {
      const res = await getUnreadCountAPI(t._id);
      return { team: t, count: parseUnreadCount(res) };
    } catch {
      return { team: t, count: 0 };
    }
  });
  const messageNotifs = unreadResults
    .filter((r) => r && r.count > 0)
    .map((r) => ({
      id: `msg_${r.team._id}`,
      type: "message",
      icon: "chatbubble-outline",
      iconBg: "#F0FDF4",
      iconColor: "#15803D",
      title: `${r.count} unread message${r.count > 1 ? "s" : ""}`,
      body: `In ${r.team.teamName}`,
      time: null,
      route: "/team/[teamId]",
      params: { teamId: r.team._id, initialTab: "MESSAGES" },
    }));

  const notifs = [
    ...invitationNotifs,
    ...messageNotifs,
    ...eventNotifs,
    ...assignmentNotifs,
    ...tricountNotifs,
    ...communityNotifs,
  ];

  notifs.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return new Date(b.time) - new Date(a.time);
  });

  return notifs;
};
