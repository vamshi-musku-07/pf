/** Telegram-style reactions — animated Noto emoji (WebP) from Google Fonts CDN */
export const NOTO_EMOJI_CDN = "https://fonts.gstatic.com/s/e/notoemoji/latest";

export const MESSAGE_REACTIONS = [
  { key: "thumbsup", codepoint: "1f44d", emoji: "👍", label: "Like" },
  { key: "heart", codepoint: "2764_fe0f", emoji: "❤️", label: "Love" },
  { key: "fire", codepoint: "1f525", emoji: "🔥", label: "Fire" },
  { key: "laugh", codepoint: "1f602", emoji: "😂", label: "Haha" },
  { key: "wow", codepoint: "1f62e", emoji: "😮", label: "Wow" },
  { key: "sad", codepoint: "1f622", emoji: "😢", label: "Sad" },
  { key: "party", codepoint: "1f389", emoji: "🎉", label: "Party" },
  { key: "clap", codepoint: "1f44f", emoji: "👏", label: "Clap" },
];

/** Legacy keys saved before animated-emoji switch */
export const LEGACY_REACTION_ALIASES = {
  cheers: "party",
  confetti: "party",
  wave: "clap",
  coin: "party",
  hi: "wow",
  clap_legacy: "clap",
};

export const MESSAGE_REACTION_MAP = Object.fromEntries(
  MESSAGE_REACTIONS.map((reaction) => [reaction.key, reaction]),
);

export const DEFAULT_QUICK_REACTION_KEY = "thumbsup";

export const getAnimatedEmojiUri = (codepoint) =>
  `${NOTO_EMOJI_CDN}/${codepoint}/512.webp`;

export const resolveReactionKey = (key) => {
  if (MESSAGE_REACTION_MAP[key]) return key;
  const alias = LEGACY_REACTION_ALIASES[key];
  if (alias && MESSAGE_REACTION_MAP[alias]) return alias;
  return key;
};

export const getReactionByKey = (key) => {
  const resolved = resolveReactionKey(key);
  return MESSAGE_REACTION_MAP[resolved] || null;
};
