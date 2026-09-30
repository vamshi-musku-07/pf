import { getReactionByKey } from "@/constants/messageReactions";

export const groupMessageReactions = (reactions = [], currentUserId) => {
  const grouped = new Map();

  for (const reaction of reactions) {
    if (!reaction?.key) continue;
    const existing = grouped.get(reaction.key) || {
      key: reaction.key,
      count: 0,
      mine: false,
      users: [],
    };
    existing.count += 1;
    if (currentUserId && String(reaction.userId) === String(currentUserId)) {
      existing.mine = true;
    }
    if (reaction.userName) {
      existing.users.push(reaction.userName);
    }
    grouped.set(reaction.key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
};

export const getReactionMeta = (key) => getReactionByKey(key);

/** Compact display: 2–9 as-is, 10–99 as "10+", 100+ as "99+" (never show 100000). */
export const formatReactionCount = (count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) return null;
  if (n < 10) return String(n);
  if (n < 100) return "10+";
  return "99+";
};
