import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  G,
  Rect,
} from "react-native-svg";

/**
 * Premium silver shield with plus — crisp at small avatar-corner sizes.
 */
export default function ProfileShieldPlus({ size = 28 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        shadowColor: "#0B1324",
        shadowOpacity: 0.28,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1.5 },
        elevation: 4,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="shieldBody" x1="18%" y1="8%" x2="82%" y2="92%">
            <Stop offset="0%" stopColor="#F8FAFC" />
            <Stop offset="28%" stopColor="#E2E8F0" />
            <Stop offset="55%" stopColor="#94A3B8" />
            <Stop offset="78%" stopColor="#CBD5E1" />
            <Stop offset="100%" stopColor="#64748B" />
          </LinearGradient>
          <LinearGradient id="shieldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="45%" stopColor="#94A3B8" />
            <Stop offset="100%" stopColor="#475569" />
          </LinearGradient>
          <LinearGradient id="plusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#F1F5F9" />
          </LinearGradient>
        </Defs>

        {/* Soft ground shadow */}
        <EllipseShadow />

        {/* Outer silver rim */}
        <Path
          d="M32 4.5 C42 4.5 51 7.5 54.5 11.5 C55.5 20 55.5 32 52 43 C47.5 54 38.5 59.5 32 61.5 C25.5 59.5 16.5 54 12 43 C8.5 32 8.5 20 9.5 11.5 C13 7.5 22 4.5 32 4.5 Z"
          fill="url(#shieldEdge)"
        />

        {/* Inner body */}
        <Path
          d="M32 8 C41 8 48.5 10.5 51.2 13.8 C52 21.5 52 32 48.8 42 C44.8 51.5 37 56.5 32 58.2 C27 56.5 19.2 51.5 15.2 42 C12 32 12 21.5 12.8 13.8 C15.5 10.5 23 8 32 8 Z"
          fill="url(#shieldBody)"
        />

        {/* Specular highlight */}
        <Path
          d="M22 14 C26 11.5 38 11.5 42 14 C39 16.5 25 16.5 22 14 Z"
          fill="#FFFFFF"
          opacity={0.55}
        />

        {/* Plus */}
        <G>
          <Rect x="29" y="22" width="6" height="22" rx="2.2" fill="url(#plusGrad)" />
          <Rect x="21" y="30" width="22" height="6" rx="2.2" fill="url(#plusGrad)" />
          <Circle cx="32" cy="33" r="2.2" fill="#FFFFFF" opacity={0.85} />
        </G>
      </Svg>
    </View>
  );
}

function EllipseShadow() {
  return (
    <Path
      d="M18 58 C22 61 42 61 46 58 C42 60.5 22 60.5 18 58 Z"
      fill="#0B1324"
      opacity={0.18}
    />
  );
}
