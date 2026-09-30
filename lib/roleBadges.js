import AsyncStorage from "@react-native-async-storage/async-storage";

export const ROLE_BADGES = [
  {
    id: "player",
    label: "Player",
    subtitle: "On the pitch",
    image: require("../assets/role-badges/role-player.png"),
  },
  {
    id: "coach",
    label: "Coach",
    subtitle: "Lead the squad",
    image: require("../assets/role-badges/role-coach.png"),
  },
  {
    id: "parent",
    label: "Parent",
    subtitle: "Sideline support",
    image: require("../assets/role-badges/role-parent.png"),
  },
  {
    id: "referee",
    label: "Referee",
    subtitle: "Call the game",
    image: require("../assets/role-badges/role-referee.png"),
  },
  {
    id: "organizer",
    label: "Organizer",
    subtitle: "Run events",
    image: require("../assets/role-badges/role-organizer.png"),
  },
  {
    id: "club_admin",
    label: "Club Admin",
    subtitle: "Manage the club",
    image: require("../assets/role-badges/role-club-admin.png"),
  },
  {
    id: "volunteer",
    label: "Volunteer",
    subtitle: "Help the community",
    image: require("../assets/role-badges/role-volunteer.png"),
  },
  {
    id: "media",
    label: "Media",
    subtitle: "Capture moments",
    image: require("../assets/role-badges/role-media.png"),
  },
  {
    id: "physio",
    label: "Physio",
    subtitle: "Keep athletes ready",
    image: require("../assets/role-badges/role-physio.png"),
  },
  {
    id: "trainer",
    label: "Trainer",
    subtitle: "Build performance",
    image: require("../assets/role-badges/role-trainer.png"),
  },
  {
    id: "fan",
    label: "Fan",
    subtitle: "Cheer the team",
    image: require("../assets/role-badges/role-fan.png"),
  },
  {
    id: "all_rounder",
    label: "All Rounder",
    subtitle: "Wear many hats",
    image: require("../assets/role-badges/role-all-rounder.png"),
  },
];
const STORAGE_KEY = "@playflash/profile_role_badges_v1";

export async function loadSelectedRoleIds() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => ROLE_BADGES.some((b) => b.id === id)) : [];
  } catch {
    return [];
  }
}

export async function saveSelectedRoleIds(ids = []) {
  const clean = [...new Set((ids || []).filter((id) => ROLE_BADGES.some((b) => b.id === id)))];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function getRoleById(id) {
  if (!id) return null;
  return ROLE_BADGES.find((b) => b.id === String(id)) || null;
}

export function rolesFromIds(ids = []) {
  const set = new Set(ids || []);
  return ROLE_BADGES.filter((b) => set.has(b.id));
}
