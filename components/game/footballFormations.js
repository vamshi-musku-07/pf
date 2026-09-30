/**
 * Football formations with pitch slot coordinates.
 *
 * Slot coords: x = 0–100 (left → right), y = 0–100 (own goal → attack).
 * Each slot lists preferred position tokens (highest match wins).
 */

export const FORMATION_PRESETS = {
  "4-4-2": [4, 4, 2],
  "4-3-3": [4, 3, 3],
  "4-2-3-1": [4, 2, 3, 1],
  "3-5-2": [3, 5, 2],
  "3-4-3": [3, 4, 3],
  "5-3-2": [5, 3, 2],
  "4-5-1": [4, 5, 1],
  "4-1-4-1": [4, 1, 4, 1],
  "3-4-2-1": [3, 4, 2, 1],
};

/** @type {Record<string, Array<{ key: string, code: string, x: number, y: number, prefs: string[] }>>} */
export const FORMATION_SLOTS = {
  "4-3-3": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LB", code: "LB", x: 10, y: 28, prefs: ["lb", "lwb", "left back", "left-back", "left full"] },
    { key: "LCB", code: "CB", x: 34, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "central defender", "defender"] },
    { key: "RCB", code: "CB", x: 66, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "central defender", "defender"] },
    { key: "RB", code: "RB", x: 90, y: 28, prefs: ["rb", "rwb", "right back", "right-back", "right full"] },
    { key: "LCM", code: "CM", x: 28, y: 48, prefs: ["lcm", "cm", "lm", "midfielder", "central mid", "mid"] },
    { key: "CDM", code: "CDM", x: 50, y: 44, prefs: ["cdm", "dm", "holding", "defensive mid", "anchor", "cm", "midfielder"] },
    { key: "RCM", code: "CM", x: 72, y: 48, prefs: ["rcm", "cm", "rm", "midfielder", "central mid", "mid"] },
    { key: "LW", code: "LW", x: 16, y: 72, prefs: ["lw", "lm", "left wing", "winger", "forward", "attacker"] },
    { key: "ST", code: "ST", x: 50, y: 82, prefs: ["st", "cf", "striker", "centre forward", "center forward", "forward", "attacker"] },
    { key: "RW", code: "RW", x: 84, y: 72, prefs: ["rw", "rm", "right wing", "winger", "forward", "attacker"] },
  ],
  "4-4-2": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LB", code: "LB", x: 10, y: 28, prefs: ["lb", "lwb", "left back", "left-back"] },
    { key: "LCB", code: "CB", x: 34, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 66, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "RB", code: "RB", x: 90, y: 28, prefs: ["rb", "rwb", "right back", "right-back"] },
    { key: "LM", code: "LM", x: 12, y: 52, prefs: ["lm", "lw", "left mid", "winger", "midfielder"] },
    { key: "LCM", code: "CM", x: 38, y: 48, prefs: ["lcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "RCM", code: "CM", x: 62, y: 48, prefs: ["rcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "RM", code: "RM", x: 88, y: 52, prefs: ["rm", "rw", "right mid", "winger", "midfielder"] },
    { key: "LST", code: "ST", x: 38, y: 80, prefs: ["st", "cf", "ss", "striker", "forward", "attacker"] },
    { key: "RST", code: "ST", x: 62, y: 80, prefs: ["st", "cf", "ss", "striker", "forward", "attacker"] },
  ],
  "4-2-3-1": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LB", code: "LB", x: 10, y: 26, prefs: ["lb", "lwb", "left back", "left-back"] },
    { key: "LCB", code: "CB", x: 34, y: 22, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 66, y: 22, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "RB", code: "RB", x: 90, y: 26, prefs: ["rb", "rwb", "right back", "right-back"] },
    { key: "LDM", code: "CDM", x: 36, y: 42, prefs: ["cdm", "ldm", "dm", "holding", "defensive mid", "cm"] },
    { key: "RDM", code: "CDM", x: 64, y: 42, prefs: ["cdm", "rdm", "dm", "holding", "defensive mid", "cm"] },
    { key: "LAM", code: "CAM", x: 18, y: 62, prefs: ["lam", "lw", "lm", "cam", "attacking mid", "winger"] },
    { key: "CAM", code: "CAM", x: 50, y: 60, prefs: ["cam", "am", "attacking mid", "ss", "cm"] },
    { key: "RAM", code: "CAM", x: 82, y: 62, prefs: ["ram", "rw", "rm", "cam", "attacking mid", "winger"] },
    { key: "ST", code: "ST", x: 50, y: 84, prefs: ["st", "cf", "striker", "forward", "attacker"] },
  ],
  "3-5-2": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LCB", code: "CB", x: 24, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "CB", code: "CB", x: 50, y: 20, prefs: ["cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 76, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "LWB", code: "LWB", x: 8, y: 48, prefs: ["lwb", "lb", "lm", "lw", "wing back", "left back"] },
    { key: "LCM", code: "CM", x: 32, y: 46, prefs: ["lcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "CDM", code: "CDM", x: 50, y: 40, prefs: ["cdm", "dm", "holding", "defensive mid", "cm"] },
    { key: "RCM", code: "CM", x: 68, y: 46, prefs: ["rcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "RWB", code: "RWB", x: 92, y: 48, prefs: ["rwb", "rb", "rm", "rw", "wing back", "right back"] },
    { key: "LST", code: "ST", x: 38, y: 78, prefs: ["st", "cf", "ss", "cam", "striker", "forward"] },
    { key: "RST", code: "ST", x: 62, y: 78, prefs: ["st", "cf", "ss", "cam", "striker", "forward"] },
  ],
  "3-4-3": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LCB", code: "CB", x: 24, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "CB", code: "CB", x: 50, y: 20, prefs: ["cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 76, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "LM", code: "LM", x: 10, y: 48, prefs: ["lm", "lwb", "lw", "lb", "left mid", "winger"] },
    { key: "LCM", code: "CM", x: 38, y: 44, prefs: ["lcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "RCM", code: "CM", x: 62, y: 44, prefs: ["rcm", "cm", "cdm", "midfielder", "mid"] },
    { key: "RM", code: "RM", x: 90, y: 48, prefs: ["rm", "rwb", "rw", "rb", "right mid", "winger"] },
    { key: "LW", code: "LW", x: 18, y: 74, prefs: ["lw", "lm", "left wing", "winger", "forward"] },
    { key: "ST", code: "ST", x: 50, y: 84, prefs: ["st", "cf", "striker", "forward", "attacker"] },
    { key: "RW", code: "RW", x: 82, y: 74, prefs: ["rw", "rm", "right wing", "winger", "forward"] },
  ],
  "5-3-2": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LWB", code: "LWB", x: 6, y: 32, prefs: ["lwb", "lb", "lm", "wing back", "left back"] },
    { key: "LCB", code: "CB", x: 28, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "CB", code: "CB", x: 50, y: 20, prefs: ["cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 72, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "RWB", code: "RWB", x: 94, y: 32, prefs: ["rwb", "rb", "rm", "wing back", "right back"] },
    { key: "LCM", code: "CM", x: 28, y: 50, prefs: ["lcm", "cm", "lm", "midfielder", "mid"] },
    { key: "CDM", code: "CDM", x: 50, y: 46, prefs: ["cdm", "dm", "cm", "holding", "midfielder"] },
    { key: "RCM", code: "CM", x: 72, y: 50, prefs: ["rcm", "cm", "rm", "midfielder", "mid"] },
    { key: "LST", code: "ST", x: 38, y: 78, prefs: ["st", "cf", "ss", "striker", "forward"] },
    { key: "RST", code: "ST", x: 62, y: 78, prefs: ["st", "cf", "ss", "striker", "forward"] },
  ],
  "4-5-1": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LB", code: "LB", x: 10, y: 28, prefs: ["lb", "lwb", "left back"] },
    { key: "LCB", code: "CB", x: 34, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 66, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "RB", code: "RB", x: 90, y: 28, prefs: ["rb", "rwb", "right back"] },
    { key: "LM", code: "LM", x: 10, y: 54, prefs: ["lm", "lw", "left mid", "winger"] },
    { key: "LCM", code: "CM", x: 32, y: 48, prefs: ["lcm", "cm", "midfielder", "mid"] },
    { key: "CDM", code: "CDM", x: 50, y: 44, prefs: ["cdm", "dm", "holding", "cm", "midfielder"] },
    { key: "RCM", code: "CM", x: 68, y: 48, prefs: ["rcm", "cm", "midfielder", "mid"] },
    { key: "RM", code: "RM", x: 90, y: 54, prefs: ["rm", "rw", "right mid", "winger"] },
    { key: "ST", code: "ST", x: 50, y: 82, prefs: ["st", "cf", "striker", "forward", "attacker"] },
  ],
  "4-1-4-1": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LB", code: "LB", x: 10, y: 26, prefs: ["lb", "lwb", "left back"] },
    { key: "LCB", code: "CB", x: 34, y: 22, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 66, y: 22, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "RB", code: "RB", x: 90, y: 26, prefs: ["rb", "rwb", "right back"] },
    { key: "CDM", code: "CDM", x: 50, y: 40, prefs: ["cdm", "dm", "holding", "defensive mid", "cm"] },
    { key: "LM", code: "LM", x: 12, y: 58, prefs: ["lm", "lw", "left mid", "winger"] },
    { key: "LCM", code: "CM", x: 36, y: 56, prefs: ["lcm", "cm", "cam", "midfielder"] },
    { key: "RCM", code: "CM", x: 64, y: 56, prefs: ["rcm", "cm", "cam", "midfielder"] },
    { key: "RM", code: "RM", x: 88, y: 58, prefs: ["rm", "rw", "right mid", "winger"] },
    { key: "ST", code: "ST", x: 50, y: 84, prefs: ["st", "cf", "striker", "forward", "attacker"] },
  ],
  "3-4-2-1": [
    { key: "GK", code: "GK", x: 50, y: 6, prefs: ["gk", "goalkeeper", "goal keeper", "keeper", "g"] },
    { key: "LCB", code: "CB", x: 24, y: 24, prefs: ["lcb", "cb", "centre back", "center back", "defender"] },
    { key: "CB", code: "CB", x: 50, y: 20, prefs: ["cb", "centre back", "center back", "defender"] },
    { key: "RCB", code: "CB", x: 76, y: 24, prefs: ["rcb", "cb", "centre back", "center back", "defender"] },
    { key: "LM", code: "LM", x: 10, y: 46, prefs: ["lm", "lwb", "lw", "lb", "left mid"] },
    { key: "LCM", code: "CM", x: 38, y: 42, prefs: ["lcm", "cm", "cdm", "midfielder"] },
    { key: "RCM", code: "CM", x: 62, y: 42, prefs: ["rcm", "cm", "cdm", "midfielder"] },
    { key: "RM", code: "RM", x: 90, y: 46, prefs: ["rm", "rwb", "rw", "rb", "right mid"] },
    { key: "LS", code: "SS", x: 34, y: 66, prefs: ["ss", "cam", "lw", "st", "attacking mid", "forward"] },
    { key: "RS", code: "SS", x: 66, y: 66, prefs: ["ss", "cam", "rw", "st", "attacking mid", "forward"] },
    { key: "ST", code: "ST", x: 50, y: 84, prefs: ["st", "cf", "striker", "forward", "attacker"] },
  ],
};

const ROLE_FALLBACK = {
  gk: ["gk", "goalkeeper", "keeper"],
};

export const FORMATION_OPTIONS = Object.keys(FORMATION_SLOTS);

/** Standard football positions for roster add/edit (stored as code on player.position). */
export const FOOTBALL_PLAYER_POSITIONS = [
  { code: "GK", label: "Goalkeeper" },
  { code: "LB", label: "Left Back" },
  { code: "CB", label: "Centre Back" },
  { code: "RB", label: "Right Back" },
  { code: "LWB", label: "Left Wing Back" },
  { code: "RWB", label: "Right Wing Back" },
  { code: "CDM", label: "Defensive Mid" },
  { code: "CM", label: "Central Mid" },
  { code: "CAM", label: "Attacking Mid" },
  { code: "LM", label: "Left Mid" },
  { code: "RM", label: "Right Mid" },
  { code: "LW", label: "Left Wing" },
  { code: "RW", label: "Right Wing" },
  { code: "CF", label: "Centre Forward" },
  { code: "ST", label: "Striker" },
];

export const FOOTBALL_POSITION_CODES = FOOTBALL_PLAYER_POSITIONS.map((p) => p.code);

/** Map free-text / legacy labels onto standard codes for the picker. */
export const normalizeFootballPositionCode = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  if (FOOTBALL_POSITION_CODES.includes(upper)) return upper;
  const pos = value.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
  if (/\b(gk|goal\s*keeper|goalkeeper|keeper)\b/.test(pos) || pos === "g") return "GK";
  if (/\blwb\b|left wing.?back/.test(pos)) return "LWB";
  if (/\brwb\b|right wing.?back/.test(pos)) return "RWB";
  if (/\blb\b|left back|left.?back/.test(pos)) return "LB";
  if (/\brb\b|right back|right.?back/.test(pos)) return "RB";
  if (/\bcdm\b|defensive mid|holding/.test(pos)) return "CDM";
  if (/\bcam\b|attacking mid/.test(pos)) return "CAM";
  if (/\blm\b|left mid/.test(pos)) return "LM";
  if (/\brm\b|right mid/.test(pos)) return "RM";
  if (/\blw\b|left wing/.test(pos)) return "LW";
  if (/\brw\b|right wing/.test(pos)) return "RW";
  if (/\bcf\b|centre forward|center forward/.test(pos)) return "CF";
  if (/\bst\b|striker/.test(pos)) return "ST";
  if (/\bcm\b|central mid|midfielder|mid\b/.test(pos)) return "CM";
  if (/\bcb\b|centre back|center back|central defender|defender/.test(pos)) return "CB";
  if (/\bforward|attacker\b/.test(pos)) return "ST";
  return value;
};

export const normalizePos = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");

export const playerIdOf = (player) => String(player?._id || player?.id || player?.playerId || "");

export const parseFormation = (raw) => {
  const key = String(raw || "4-3-3").trim();
  if (FORMATION_SLOTS[key]) {
    return { label: key, rows: FORMATION_PRESETS[key] || [], slots: FORMATION_SLOTS[key] };
  }
  return { label: "4-3-3", rows: FORMATION_PRESETS["4-3-3"], slots: FORMATION_SLOTS["4-3-3"] };
};

export const isGoalkeeperPlayer = (player) => {
  if (player?.isGoalkeeper) return true;
  const pos = normalizePos(player?.position);
  return /\b(gk|goal\s*keeper|goalkeeper|keeper)\b/.test(pos) || pos === "g";
};

const scorePlayerForSlot = (player, slot) => {
  if (!player || !slot) return -1;
  const pos = normalizePos(player.position);
  const storedKey = normalizePos(player.slotKey || player.formationSlot || "");
  let score = 0;

  if (storedKey && (storedKey === normalizePos(slot.key) || storedKey === normalizePos(slot.code))) {
    score += 100;
  }

  if (isGoalkeeperPlayer(player)) {
    return slot.code === "GK" ? 90 : -50;
  }
  if (slot.code === "GK") {
    return pos && ROLE_FALLBACK.gk.some((t) => pos.includes(t)) ? 80 : -40;
  }

  if (!pos) return 1;

  for (let i = 0; i < slot.prefs.length; i += 1) {
    const pref = slot.prefs[i];
    if (pos === pref || pos.includes(pref) || pref.includes(pos)) {
      score += 40 - i * 2;
      break;
    }
  }

  if (/^l/i.test(slot.key) && /\b(left|l[wbrcm]|lw|lb|lm|lam)\b/.test(pos)) score += 8;
  if (/^r/i.test(slot.key) && /\b(right|r[wbrcm]|rw|rb|rm|ram)\b/.test(pos)) score += 8;

  return score;
};

/**
 * Assign XI players into formation slots (greedy best-match).
 * Returns placements [{ slot, player }] in slot order.
 */
export const assignPlayersToFormation = (onFieldPlayers = [], formationRaw = "4-3-3") => {
  const { label, slots } = parseFormation(formationRaw);
  const pool = [...(onFieldPlayers || [])].filter(Boolean);
  const used = new Set();
  const placements = slots.map((slot) => ({ slot, player: null }));

  const pairs = [];
  for (let si = 0; si < slots.length; si += 1) {
    for (let pi = 0; pi < pool.length; pi += 1) {
      const player = pool[pi];
      const pid = playerIdOf(player);
      if (!pid) continue;
      pairs.push({ si, pi, pid, score: scorePlayerForSlot(player, slots[si]) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  for (const pair of pairs) {
    if (pair.score < 0) continue;
    if (placements[pair.si].player) continue;
    if (used.has(pair.pid)) continue;
    placements[pair.si].player = pool[pair.pi];
    used.add(pair.pid);
  }

  const leftovers = pool.filter((p) => !used.has(playerIdOf(p)));
  leftovers.sort((a, b) => {
    const ja = Number(a?.jerseyNumber ?? a?.number);
    const jb = Number(b?.jerseyNumber ?? b?.number);
    if (Number.isFinite(ja) && Number.isFinite(jb)) return ja - jb;
    return 0;
  });

  for (const place of placements) {
    if (place.player) continue;
    const next = leftovers.shift();
    if (!next) break;
    place.player = next;
    used.add(playerIdOf(next));
  }

  return {
    label,
    slots,
    placements: placements.filter((p) => p.player),
  };
};

/** Stamp each starter with formation slot code/key when saving XI. */
export const applyFormationPositionsToStarters = (starters = [], formationRaw = "4-3-3") => {
  const { placements } = assignPlayersToFormation(starters, formationRaw);
  const byId = new Map(placements.map(({ slot, player }) => [playerIdOf(player), slot]));
  return starters.map((player) => {
    const slot = byId.get(playerIdOf(player));
    if (!slot) return player;
    return {
      ...player,
      position: slot.code,
      slotKey: slot.key,
      isGoalkeeper: slot.code === "GK",
    };
  });
};
