import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";

export default function PlayerNameAvatar({ name, profileImage, size = 32, isDark = false, T }) {
  const initial = (String(name || "?").trim()[0] || "?").toUpperCase();

  if (profileImage) {
    return (
      <Image
        source={{ uri: profileImage }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isDark ? T?.surfaceAlt || "#1E1E24" : "#E2E8F0",
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? T?.border || "#2A2A2E" : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: isDark ? T?.textDim || "#A1A1AA" : "#64748B",
          fontWeight: "800",
          fontSize: size * 0.38,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
