import { View, Text } from "react-native";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

export default function LiveStreamTab() {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: isDark ? T.bg : undefined,
      }}
    >
      <Text style={{ color: isDark ? T.textDim : "#6B7280", textAlign: "center", fontSize: 14 }}>
        Live streaming is available in the PlayFlash mobile app.
      </Text>
    </View>
  );
}
