// Pure helpers for the "Applied" join-request inbox on the tournaments list.

const STATUS_META = {
  pending: {
    label: "Awaiting review",
    shortLabel: "Pending",
    icon: "hourglass-outline",
    accent: "#F59E0B",
    chipBg: "#FFF7ED",
    chipText: "#C2410C",
  },
  approved: {
    label: "Accepted",
    shortLabel: "Accepted",
    icon: "checkmark-circle-outline",
    accent: "#22C55E",
    chipBg: "#F0FDF4",
    chipText: "#15803D",
  },
  rejected: {
    label: "Declined",
    shortLabel: "Declined",
    icon: "close-circle-outline",
    accent: "#EF4444",
    chipBg: "#FEF2F2",
    chipText: "#DC2626",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "Cancelled",
    icon: "ban-outline",
    accent: "#94A3B8",
    chipBg: "#F8FAFC",
    chipText: "#475569",
  },
};

const getAppliedStatusMeta = (status = "pending") =>
  STATUS_META[status] || STATUS_META.pending;

const formatAppliedWhen = (iso) => {
  if (!iso) return "Recently";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Recently";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
};

const summarizeAppliedRequests = (requests = []) => {
  const list = Array.isArray(requests) ? requests : [];
  return {
    total: list.length,
    pending: list.filter((r) => r.status === "pending").length,
    approved: list.filter((r) => r.status === "approved").length,
    rejected: list.filter((r) => r.status === "rejected").length,
  };
};

const appliedRequestSubtitle = (request = {}) => {
  const team = request.teamName || "Your team";
  const when = formatAppliedWhen(request.createdAt);
  const parts = [`Team ${team}`, `Applied ${when}`];
  if (request.message) parts.push(`“${String(request.message).slice(0, 48)}${request.message.length > 48 ? "…" : ""}”`);
  return parts.join(" · ");
};

const tournamentStubFromRequest = (request = {}) => ({
  _id: request.tournamentId,
  name: request.tournamentName,
  sport: request.tournamentSport,
  shareCode: request.shareCode,
});

const normalizeListTab = (tab) => {
  if (tab === "browse" || tab === "applied") return tab;
  return "mine";
};

module.exports = {
  STATUS_META,
  getAppliedStatusMeta,
  formatAppliedWhen,
  summarizeAppliedRequests,
  appliedRequestSubtitle,
  tournamentStubFromRequest,
  normalizeListTab,
};
