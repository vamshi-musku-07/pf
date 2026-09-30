import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ROLE_BADGES, getRoleById } from "@/lib/roleBadges";

const COLS = 4;
const GAP = 10;

/**
 * Inline badge picker for the Edit Profile sheet.
 *
 * Rendered inline (not in a nested Modal) so it stacks correctly inside the
 * edit profile page sheet on iOS.
 *
 * Uses % widths (not window Dimensions) so light/dark borders and modal
 * sheet insets cannot push the 4th column onto the next row.
 */
export default function RoleBadgePicker({
  selectedId = null,
  onSelect,
  saving = false,
  colors,
  isDark = false,
}) {
  const T = colors;
  const current = getRoleById(selectedId);
  const accent = isDark ? "#9AEA62" : "#15803D";
  const halfGap = GAP / 2;

  return (
    <View
      style={{
        backgroundColor: T.surface,
        borderRadius: 12,
        padding: 16,
        // Keep border width identical in both themes so layout never shifts.
        borderWidth: 1,
        borderColor: isDark ? T.border : "transparent",
        marginBottom: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: T.text }}>
            Role badge
          </Text>
          <Text style={{ fontSize: 13, color: T.textDim, marginTop: 3 }}>
            {current
              ? `${current.label} — ${current.subtitle}`
              : "Pick a badge to wear on your avatar"}
          </Text>
        </View>

        {saving ? (
          <ActivityIndicator size="small" color={accent} />
        ) : current ? (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isDark ? "rgba(154,234,98,0.12)" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={current.image}
              style={{ width: 34, height: 34 }}
              contentFit="contain"
            />
          </View>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginTop: 16,
          marginHorizontal: -halfGap,
        }}
      >
        {ROLE_BADGES.map((badge) => {
          const active = selectedId === badge.id;
          return (
            <TouchableOpacity
              key={badge.id}
              activeOpacity={0.82}
              disabled={saving}
              onPress={() => onSelect?.(active ? null : badge.id)}
              accessibilityRole="button"
              accessibilityLabel={`${badge.label} badge`}
              accessibilityState={{ selected: active }}
              style={{
                width: `${100 / COLS}%`,
                paddingHorizontal: halfGap,
                marginBottom: GAP,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active
                    ? isDark
                      ? "rgba(154,234,98,0.14)"
                      : "#ECFDF3"
                    : isDark
                      ? "rgba(255,255,255,0.04)"
                      : "#F8FAFC",
                  borderWidth: 1.5,
                  borderColor: active ? accent : T.borderSubtle,
                }}
              >
                <Image
                  source={badge.image}
                  style={{ width: "68%", height: "68%" }}
                  contentFit="contain"
                />
                {active ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={isDark ? "#0B1324" : "#FFFFFF"}
                    />
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  textAlign: "center",
                  width: "100%",
                  color: active ? accent : T.textDim,
                  fontWeight: active ? "800" : "600",
                }}
              >
                {badge.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {current ? (
        <TouchableOpacity
          onPress={() => onSelect?.(null)}
          disabled={saving}
          style={{ alignSelf: "center", paddingTop: 4 }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: T.textDim }}>
            Remove badge
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
