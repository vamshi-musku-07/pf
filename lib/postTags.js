/**
 * Client-side mention / hashtag helpers for community posts.
 * Instagram / Threads style: tags live in the caption, not as side chips.
 */

export const MENTION_TOKEN_RE = /(?:^|[\s([{])(@[a-zA-Z0-9_.]{2,40})\b/g;
export const HASHTAG_TOKEN_RE = /(?:^|[\s([{])(#[a-zA-Z0-9_]{2,40})\b/g;

/** Min characters after @ / # before suggestions appear (production UX). */
export const SUGGEST_MIN_CHARS = 1;
export const SUGGEST_MAX_RESULTS = 5;
export const MAX_MENTIONS_PER_POST = 10;
export const MAX_HASHTAGS_PER_POST = 15;

/** Split content into plain / mention / hashtag segments for rich rendering. */
export function tokenizePostContent(content = "") {
  const text = String(content || "");
  if (!text) return [];

  const hits = [];
  const pushHits = (re, type) => {
    const r = new RegExp(re.source, re.flags);
    let m;
    while ((m = r.exec(text)) !== null) {
      const token = m[1];
      const start = m.index + (m[0].length - token.length);
      hits.push({ type, start, end: start + token.length, value: token });
    }
  };
  pushHits(MENTION_TOKEN_RE, "mention");
  pushHits(HASHTAG_TOKEN_RE, "hashtag");
  hits.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  hits.forEach((hit) => {
    if (hit.start < cursor) return;
    if (hit.start > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, hit.start) });
    }
    segments.push({ type: hit.type, value: hit.value });
    cursor = hit.end;
  });
  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }
  return segments;
}

/**
 * Instagram-style: when collapsed, hide a trailing run of only @/# tokens
 * so 20 hashtags don't dominate the feed card.
 */
export function collapseCaptionForPreview(content = "", { maxChars = 140 } = {}) {
  const text = String(content || "").trim();
  if (!text) return { preview: "", truncated: false, hiddenTagCount: 0 };

  // Find start of trailing tag-only block (mentions/hashtags + whitespace)
  const trailing = text.match(/(?:(?:^|\s)([@#][a-zA-Z0-9_.]{1,40}))+\s*$/);
  let main = text;
  let hiddenTagCount = 0;
  if (trailing && trailing.index > 0) {
    const tagBlock = trailing[0];
    const tagMatches = tagBlock.match(/[@#][a-zA-Z0-9_.]{1,40}/g) || [];
    if (tagMatches.length >= 2) {
      main = text.slice(0, trailing.index).trimEnd();
      hiddenTagCount = tagMatches.length;
    }
  }

  if (main.length <= maxChars) {
    return {
      preview: main,
      truncated: hiddenTagCount > 0 || main.length < text.length,
      hiddenTagCount,
      full: text,
    };
  }

  const cut = main.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const preview = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return {
    preview,
    truncated: true,
    hiddenTagCount,
    full: text,
  };
}

export function getActiveTrigger(text = "", cursor = 0) {
  const before = String(text).slice(0, cursor);
  const match = before.match(/(^|[\s([{])([@#])([a-zA-Z0-9_.]{0,40})$/);
  if (!match) return null;
  return {
    trigger: match[2],
    query: match[3] || "",
    start: cursor - (match[3]?.length || 0) - 1,
  };
}

export function replaceTriggerRange(text, start, cursor, insertion) {
  const before = String(text).slice(0, start);
  const after = String(text).slice(cursor);
  const needsSpace = after.length === 0 || !/^\s/.test(after);
  return `${before}${insertion}${needsSpace ? " " : ""}${after}`;
}

/** Prefix-first ranking for @ search (never dump full roster on bare @). */
export function filterMentionSuggestions(people = [], query = "", limit = SUGGEST_MAX_RESULTS) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < SUGGEST_MIN_CHARS) return [];

  const scored = [];
  for (const p of people) {
    const username = String(p.username || "").toLowerCase();
    const display = String(p.displayName || "").toLowerCase();
    let score = 0;
    if (username.startsWith(q)) score = 3;
    else if (display.startsWith(q)) score = 2;
    else if (username.includes(q) || display.includes(q)) score = 1;
    else continue;
    scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score || a.p.username.localeCompare(b.p.username));
  return scored.slice(0, limit).map((x) => x.p);
}

export function filterHashtagSuggestions(tags = [], query = "", limit = SUGGEST_MAX_RESULTS) {
  const q = String(query || "").trim().toLowerCase().replace(/^#/, "");
  if (q.length < SUGGEST_MIN_CHARS) return [];
  const scored = [];
  for (const raw of tags) {
    const h = String(raw || "").toLowerCase().replace(/^#/, "");
    if (!h) continue;
    let score = 0;
    if (h.startsWith(q)) score = 2;
    else if (h.includes(q)) score = 1;
    else continue;
    scored.push({ h, score });
  }
  scored.sort((a, b) => b.score - a.score || a.h.localeCompare(b.h));
  return scored.slice(0, limit).map((x) => x.h);
}

export function countTagsInContent(content = "") {
  const text = String(content || "");
  const mentions = text.match(/@[a-zA-Z0-9_.]{2,40}/g) || [];
  const hashtags = text.match(/#[a-zA-Z0-9_]{2,40}/g) || [];
  return {
    mentionCount: new Set(mentions.map((m) => m.toLowerCase())).size,
    hashtagCount: new Set(hashtags.map((h) => h.toLowerCase())).size,
  };
}

export const SUGGESTED_HASHTAGS = [
  "cricket",
  "football",
  "hockey",
  "badminton",
  "tournament",
  "practice",
  "matchday",
  "teamwork",
  "training",
  "highlights",
];
