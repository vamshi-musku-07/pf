import { Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

  
// ---- Shared constants ----
export const quickCreateLogos = [
  { id: 1, name: "Eagle", source: require("../../../assets/team-logos/boxer.webp") },
  { id: 2, name: "Shark", source: require("../../../assets/team-logos/female-lion.webp") },
  { id: 3, name: "Tiger", source: require("../../../assets/team-logos/hyna.webp") },
  { id: 4, name: "Wolf", source: require("../../../assets/team-logos/ice-monster.webp") },
  { id: 5, name: "Bear", source: require("../../../assets/team-logos/ice-tiger.webp") },
  { id: 6, name: "Dragon", source: require("../../../assets/team-logos/white-dog.webp") },
  { id: 7, name: "Phoenix", source: require("../../../assets/team-logos/yellow-dog.webp") },
  { id: 8, name: "Panther", source: require("../../../assets/team-logos/wolf1.webp") },
  { id: 9, name: "Donkey", source: require("../../../assets/team-logos/donkey.webp") },
  { id: 10, name: "Mascot", source: require("../../../assets/team-logos/mascot-skunk.webp") },
];

export const logoUrlMap = {
  1: "/team-logos/boxer.webp",
  2: "/team-logos/female-lion.webp",
  3: "/team-logos/hyna.webp",
  4: "/team-logos/ice-monster.webp",
  5: "/team-logos/ice-tiger.webp",
  6: "/team-logos/white-dog.webp",
  7: "/team-logos/yellow-dog.webp",
  8: "/team-logos/wolf1.webp",
  9: "/team-logos/donkey.webp",
  10: "/team-logos/mascot-skunk.webp",
};

export const logoRequireMap = {
  "/team-logos/boxer.webp": require("../../../assets/team-logos/boxer.webp"),
  "/team-logos/female-lion.webp": require("../../../assets/team-logos/female-lion.webp"),
  "/team-logos/hyna.webp": require("../../../assets/team-logos/hyna.webp"),
  "/team-logos/ice-monster.webp": require("../../../assets/team-logos/ice-monster.webp"),
  "/team-logos/ice-tiger.webp": require("../../../assets/team-logos/ice-tiger.webp"),
  "/team-logos/white-dog.webp": require("../../../assets/team-logos/white-dog.webp"),
  "/team-logos/yellow-dog.webp": require("../../../assets/team-logos/yellow-dog.webp"),
  "/team-logos/wolf1.webp": require("../../../assets/team-logos/wolf1.webp"),
  "/team-logos/donkey.webp": require("../../../assets/team-logos/donkey.webp"),
  "/team-logos/mascot-skunk.webp": require("../../../assets/team-logos/mascot-skunk.webp"),
  "/team-logos/mascot-skunk.png": require("../../../assets/team-logos/mascot-skunk.webp"),
};

export const roleBadge = {
  player: { bg: "#DCFCE7", text: "#166534", label: "Player" },
  manager: { bg: "#DBEAFE", text: "#1E40AF", label: "Manager" },
  spectator: { bg: "#FEF3C7", text: "#92400E", label: "Spectator" },
};

export const statusBadge = {
  pending: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
  confirmed: { bg: "#DCFCE7", text: "#166534", label: "Confirmed" },
  declined: { bg: "#FEE2E2", text: "#991B1B", label: "Declined" },
};

export const ASSIGNMENT_OPTIONS = [
  { value: "attendance-clock", label: "Attendance Clock", icon: "time-outline" },
  { value: "field-prep", label: "Field Prep", icon: "construct-outline" },
  { value: "photographer", label: "Photographer", icon: "camera-outline" },
  { value: "sanitizer", label: "Sanitizer", icon: "medkit-outline" },
  { value: "score-keeper", label: "Score Keeper", icon: "podium-outline" },
  { value: "snacks", label: "Snacks", icon: "fast-food-outline" },
  { value: "temp-checker", label: "Temp Checker", icon: "thermometer-outline" },
  { value: "water", label: "Water", icon: "water-outline" },
  { value: "custom", label: "Custom", icon: "create-outline" },
];

/** Cricket match-day duty templates (shown when team sport is Cricket). */
export const CRICKET_ASSIGNMENT_OPTIONS = [
  { value: "scorer", label: "Scorer", icon: "podium-outline" },
  { value: "umpire", label: "Umpire", icon: "flag-outline" },
  { value: "drinks", label: "Drinks Duty", icon: "water-outline" },
  { value: "field-prep", label: "Pitch / Field Prep", icon: "construct-outline" },
  { value: "photographer", label: "Photographer", icon: "camera-outline" },
  { value: "score-keeper", label: "Backup Scorer", icon: "tablet-portrait-outline" },
  { value: "snacks", label: "Tea / Snacks", icon: "fast-food-outline" },
  { value: "custom", label: "Custom", icon: "create-outline" },
];

export const getAssignmentOptionsForSport = (sport) =>
  String(sport || "").toLowerCase() === "cricket" ? CRICKET_ASSIGNMENT_OPTIONS : ASSIGNMENT_OPTIONS;

// ---- Helpers ----
export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ---- Shared tiny components ----
export function PlayerAvatar({ player, size = 48 }) {
  // Priority: player's own auth profile picture → coach-set image → initials
  const imageUri = player.profilePicture || player.playerimage || null;
  if (imageUri)
    return (
      <ExpoImage
        source={{ uri: imageUri, width: size, height: size }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        cachePolicy="memory-disk"
        contentFit="cover"
        decodeFormat="rgb"
      />
    );
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-gray-200 items-center justify-center"
    >
      <Text
        className="text-gray-500 font-bold"
        style={{ fontSize: size * 0.3 }}
      >
        {(player.firstName || "?")[0]}
        {(player.lastName || "")[0]}
      </Text>
    </View>
  );
}

export function InfoItem({ icon, label, value }) {
  return (
    <View className="flex-row items-center gap-2 w-1/2 mb-2">
      <Ionicons name={icon} size={15} color="#9CA3AF" />
      <Text className="text-gray-500 text-xs">{label}:</Text>
      <Text
        className="text-gray-800 text-xs font-semibold flex-1"
        numberOfLines={1}
      >
        {value || "\u2014"}
      </Text>
    </View>
  );
}

export function Badge({ text, bg, color }) {
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: bg }}>
      <Text style={{ color }} className="text-xs font-semibold">
        {text}
      </Text>
    </View>
  );
}

export function EventIcon({ type, size = 32 }) {
  const config = {
    game: { bg: "#DCFCE7", color: "#166534", icon: "trophy-outline" },
    practice: { bg: "#DBEAFE", color: "#1E40AF", icon: "fitness-outline" },
    other: { bg: "#FEF3C7", color: "#92400E", icon: "calendar-outline" },
  };
  const c = config[type] || config.other;
  return (
    <View
      className="rounded-lg items-center justify-center"
      style={{ width: size, height: size, backgroundColor: c.bg }}
    >
      <Ionicons name={c.icon} size={size * 0.5} color={c.color} />
    </View>
  );
}

export function EventRow({ event, isLast }) {
  return (
    <View
      className="flex-row items-center gap-3 py-3"
      style={
        isLast ? {} : { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }
      }
    >
      <EventIcon type={event.eventType} />
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 capitalize">
          {event.title || event.eventType || "Event"}
        </Text>
        <Text className="text-gray-500 text-xs">
          {formatDate(event.date || event.startDate)}
          {event.time ? ` \u2022 ${event.time}` : ""}
        </Text>
      </View>
      {event.location && (
        <Text className="text-gray-400 text-xs max-w-[80px]" numberOfLines={1}>
          {event.location}
        </Text>
      )}
    </View>
  );
}

export function GameScoreRow({ game, teamName, isDark = false }) {
  const nameColor = isDark ? "#F5F5F7" : undefined;
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className="font-bold text-gray-900 flex-1"
        style={nameColor ? { color: nameColor } : undefined}
        numberOfLines={1}
      >
        {game.base?.team1Name || teamName}
      </Text>
      <Text
        className="text-xl font-black text-gray-900 mx-3"
        style={nameColor ? { color: nameColor } : undefined}
      >
        {game.base?.score?.team1 ?? "-"} : {game.base?.score?.team2 ?? "-"}
      </Text>
      <Text
        className="font-bold text-gray-900 flex-1 text-right"
        style={nameColor ? { color: nameColor } : undefined}
        numberOfLines={1}
      >
        {game.base?.team2Name || "Opponent"}
      </Text>
    </View>
  );
}

export function StatCard({ label, value, color }) {
  return (
    <View className="flex-1 bg-white rounded-xl p-4 shadow-sm items-center">
      <Text className="text-2xl font-black" style={{ color }}>
        {value}
      </Text>
      <Text className="text-gray-500 text-xs font-semibold mt-1">{label}</Text>
    </View>
  );
}

export function LegendDot({ color, label, isDark = false }) {
  return (
    <View className="flex-row items-center gap-1">
      <View
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Text
        className="text-gray-500 text-xs"
        style={isDark ? { color: "#A1A1AA" } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

// Required by Expo Router — this file lives inside app/ but is a shared util, not a screen.
// The default export satisfies the router without rendering anything navigable.
export default function HelperModule() { return null; }
