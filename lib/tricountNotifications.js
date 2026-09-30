const TRICOUNT_PUSH_TYPES = new Set([
  "group_added",
  "expense_added",
  "expense_updated",
  "settlement_received",
  "settlement_recorded",
  "group_settled",
  "member_added",
  "receipt_added",
]);

export const isTricountPushNotification = (data = {}) => {
  if (!data || typeof data !== "object") return false;
  if (data.groupId) return true;
  if (data.channelId === "groups") return true;
  return TRICOUNT_PUSH_TYPES.has(String(data.type || ""));
};

const iconForType = (type) => {
  switch (type) {
    case "expense_added":
    case "expense_updated":
      return { icon: "cash-outline", iconBg: "#ECFDF5", iconColor: "#047857" };
    case "settlement_received":
    case "settlement_recorded":
      return { icon: "checkmark-circle-outline", iconBg: "#EFF6FF", iconColor: "#1D4ED8" };
    case "group_settled":
      return { icon: "trophy-outline", iconBg: "#FEF3C7", iconColor: "#92400E" };
    case "group_added":
    case "member_added":
      return { icon: "people-outline", iconBg: "#EDE9FE", iconColor: "#6D28D9" };
    default:
      return { icon: "wallet-outline", iconBg: "#F0FDF4", iconColor: "#15803D" };
  }
};

/** Stable key so server + local copies of the same push count once. */
export const getTricountInboxDedupeKey = (item) => {
  const data = item?.data || {};
  const type = String(data.type || "tricount");
  const groupId = String(data.groupId || "");
  const title = String(item?.title || "").trim();

  if (!title && !groupId) return "";

  if (type === "group_added" || type === "member_added" || type === "group_settled") {
    return `${type}:${groupId}`;
  }

  return `${type}:${groupId}:${title}`;
};

export const inboxItemToTricountNotification = (item) => {
  const data = item?.data || {};
  const type = String(data.type || "tricount");
  const groupId = data.groupId ? String(data.groupId) : "";
  const visuals = iconForType(type);
  const dedupeKey = getTricountInboxDedupeKey(item);

  return {
    id: dedupeKey ? `tricount_${dedupeKey}` : item.id || `tricount_${type}_${groupId}_${item.createdAt}`,
    type: "tricount",
    ...visuals,
    title: item.title,
    body: item.body || "",
    time: item.createdAt,
    route: "/tricount",
    params: groupId ? { groupId } : {},
  };
};

export const mergeTricountInboxItems = (serverItems = [], localItems = []) => {
  const map = new Map();

  const addItem = (item, preferOverwrite) => {
    if (!item?.title) return;
    const dedupeKey = getTricountInboxDedupeKey(item);
    if (!dedupeKey) return;

    const mapped = inboxItemToTricountNotification(item);
    if (!map.has(dedupeKey) || preferOverwrite) {
      map.set(dedupeKey, mapped);
    }
  };

  for (const item of serverItems) addItem(item, true);
  for (const item of localItems) addItem(item, false);

  return Array.from(map.values());
};
