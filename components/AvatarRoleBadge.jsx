import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { getRoleById } from "@/lib/roleBadges";

/**
 * Small role sticker tucked on the bottom-right of an avatar.
 * Renders nothing when roleId is missing/invalid.
 */
export default function AvatarRoleBadge({
  roleId,
  size,
  avatarSize = 46,
  bordered = false,
  borderColor = "#FFFFFF",
  style,
}) {
  const role = getRoleById(roleId);
  if (!role) return null;

  const computed = Math.round(avatarSize * 0.3);
  const badgeSize = size != null ? size : Math.max(14, Math.min(18, computed));
  const offset = Math.max(-3, Math.round(-badgeSize * 0.12));
  const borderW = bordered ? 2 : 0;
  const outer = badgeSize + borderW * 2;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          right: offset,
          bottom: offset,
          width: outer,
          height: outer,
          zIndex: 5,
          elevation: 5,
          ...(bordered
            ? {
                borderRadius: outer / 2,
                borderWidth: borderW,
                borderColor,
                backgroundColor: borderColor,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }
            : null),
        },
        style,
      ]}
    >
      <Image
        source={role.image}
        style={{ width: badgeSize, height: badgeSize }}
        contentFit="contain"
      />
    </View>
  );
}
