import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export const AUTH_GREEN = "#9AEA62";
export const AUTH_GREEN_TEXT = "#4D7C0F";
export const AUTH_LINK = "#4A61DD";
export const AUTH_DARK = "#1C1C1E";
export const AUTH_INPUT_BG = "#F3F4F6";
export const AUTH_SHEET_RADIUS = 36;

const COPY = {
  signIn: {
    title: "Login",
    subtitle: "Welcome back! Please login your account",
    primaryLabel: "Login",
    footerPrefix: "Don't have an account?",
    footerAction: "Sign up",
  },
  signUp: {
    title: "Sign up",
    subtitle: "Create your PlayFlash account to get started",
    primaryLabel: "Sign up",
    footerPrefix: "Already have an account?",
    footerAction: "Login",
  },
};

const AUTH_SPORT_SLIDES = [
  {
    key: "cricket",
    source: require("@/assets/images/auth-sport-cricket.png"),
  },
  {
    key: "football",
    source: require("@/assets/images/auth-sport-football.png"),
  },
  {
    key: "volleyball",
    source: require("@/assets/images/auth-sport-volleyball.png"),
  },
  {
    key: "tennis",
    source: require("@/assets/images/auth-sport-tennis.png"),
  },
  {
    key: "basketball",
    source: require("@/assets/images/auth-sport-basketball.png"),
  },
  {
    key: "hockey",
    source: require("@/assets/images/auth-sport-hockey.png"),
  },
  {
    key: "badminton",
    source: require("@/assets/images/auth-sport-badminton.png"),
  },

];

const AUTH_SPORT_LOOP_COPIES = 5;
const AUTH_SPORT_AUTO_INTERVAL_MS = 5000;

export function AuthHeroBanner({ height = 300 }) {
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const draggingRef = useRef(false);
  const cardWidth = Math.min(132, Math.max(108, width * 0.33));
  const cardHeight = Math.max(190, height - 48);
  const gap = 6;
  const snapInterval = cardWidth + gap;
  const baseCount = AUTH_SPORT_SLIDES.length;
  const middleCopy = Math.floor(AUTH_SPORT_LOOP_COPIES / 2);
  const startIndex = middleCopy * baseCount;

  const loopSlides = useMemo(() => {
    const slides = [];
    for (let copy = 0; copy < AUTH_SPORT_LOOP_COPIES; copy += 1) {
      AUTH_SPORT_SLIDES.forEach((slide, baseIndex) => {
        slides.push({
          ...slide,
          key: `${copy}-${slide.key}`,
          baseIndex,
        });
      });
    }
    return slides;
  }, []);

  const jumpToMiddleCopy = (index) => {
    const baseIndex = ((index % baseCount) + baseCount) % baseCount;
    const targetIndex = middleCopy * baseCount + baseIndex;
    indexRef.current = targetIndex;
    if (targetIndex === index) return;
    const offset = targetIndex * snapInterval;
    listRef.current?.scrollToOffset({ offset, animated: false });
    scrollX.setValue(offset);
  };

  const scrollToIndex = (index, animated = true) => {
    const offset = index * snapInterval;
    indexRef.current = index;
    listRef.current?.scrollToOffset({ offset, animated });
    if (!animated) scrollX.setValue(offset);
  };

  useEffect(() => {
    indexRef.current = startIndex;
    const offset = startIndex * snapInterval;
    scrollX.setValue(offset);
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [scrollX, snapInterval, startIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (draggingRef.current) return;
      const nextIndex = indexRef.current + 1;
      // Stay ahead of the last copy edge; normalize after settle
      if (nextIndex >= loopSlides.length - baseCount) {
        const baseIndex = ((indexRef.current % baseCount) + baseCount) % baseCount;
        const resetIndex = middleCopy * baseCount + baseIndex;
        scrollToIndex(resetIndex, false);
        requestAnimationFrame(() => {
          scrollToIndex(resetIndex + 1, true);
        });
        return;
      }
      scrollToIndex(nextIndex, true);
    }, AUTH_SPORT_AUTO_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [baseCount, loopSlides.length, middleCopy, snapInterval]);

  return (
    <View
      style={{
        width: "100%",
        height,
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "transparent",
      }}
    >
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={loopSlides}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        initialScrollIndex={startIndex}
        contentContainerStyle={{
          alignItems: "center",
          paddingHorizontal: (width - cardWidth) / 2,
        }}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          draggingRef.current = false;
          const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
          jumpToMiddleCopy(index);
        }}
        onScrollEndDrag={(event) => {
          const velocity = event.nativeEvent.velocity?.x ?? 0;
          if (Math.abs(velocity) < 0.05) {
            draggingRef.current = false;
            const index = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
            jumpToMiddleCopy(index);
          }
        }}
        renderItem={({ item, index }) => {
          const center = index * snapInterval;
          const inputRange = [center - snapInterval, center, center + snapInterval];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.84, 1.08, 0.84],
            extrapolate: "clamp",
          });
          const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [14, 0, 14],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.68, 1, 0.68],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              style={{
                width: cardWidth,
                height: cardHeight,
                marginRight: gap,
                borderRadius: 28,
                overflow: "hidden",
                opacity,
                transform: [{ translateY }, { scale }],
                shadowColor: "#111827",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Image
                source={item.source}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

export function AuthSheetHeader({ mode }) {
  const copy = COPY[mode] || COPY.signIn;
  return (
    <View style={{ alignItems: "center", marginBottom: 22, paddingTop: 8 }}>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: "#111827",
          letterSpacing: -0.4,
          marginBottom: 8,
        }}
      >
        {copy.title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: "#9CA3AF",
          textAlign: "center",
          paddingHorizontal: 12,
        }}
      >
        {copy.subtitle}
      </Text>
    </View>
  );
}

export function AuthErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FECACA",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: "#DC2626", fontSize: 13, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

export function AuthField({
  icon,
  iconText,
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  rightElement,
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: AUTH_INPUT_BG,
        borderRadius: 999,
        paddingHorizontal: 18,
        height: 54,
        marginBottom: 12,
      }}
    >
      {iconText ? (
        <Text
          style={{
            marginRight: 12,
            fontSize: 18,
            fontWeight: "800",
            color: "#9CA3AF",
            width: 22,
            textAlign: "center",
          }}
        >
          {iconText}
        </Text>
      ) : (
        <Ionicons name={icon} size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        style={{ flex: 1, color: "#111827", fontSize: 15, fontWeight: "500" }}
      />
      {rightElement}
    </View>
  );
}

export function AuthPasswordToggle({ visible, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export function AuthPrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      disabled={disabled || loading}
      style={{
        backgroundColor: AUTH_DARK,
        height: 54,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        opacity: disabled || loading ? 0.65 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function AuthDivider() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
      <Text style={{ color: "#9CA3AF", fontSize: 13, marginHorizontal: 12, fontWeight: "600" }}>
        Or
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
    </View>
  );
}

function GoogleMark({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function AuthSocialButton({
  onPress,
  disabled,
  loading,
  label,
  accessibilityLabel,
  icon,
  backgroundColor,
  textColor,
  borderColor,
  shadow,
  compact = false,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      activeOpacity={0.88}
      disabled={disabled || loading}
      style={{
        ...(compact ? { width: 54 } : { flex: 1 }),
        height: 54,
        borderRadius: 27,
        backgroundColor,
        borderWidth: borderColor ? 1.5 : 0,
        borderColor: borderColor || "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: compact ? 0 : 20,
        opacity: disabled || loading ? 0.65 : 1,
        ...(shadow
          ? Platform.select({
              ios: {
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
              },
              android: { elevation: 3 },
              default: {},
            })
          : {}),
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          <View style={label ? { marginRight: 9 } : null}>{icon}</View>
          {label ? (
            <Text style={{ color: textColor, fontWeight: "700", fontSize: 14, letterSpacing: 0.1 }}>
              {label}
            </Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function AuthSocialRow({ onGoogle, googleLoading, googleAvailable, onComingSoon }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
      <AuthSocialButton
        accessibilityLabel="Continue with Apple"
        onPress={() => onComingSoon?.("Apple")}
        icon={<Ionicons name="logo-apple" size={25} color="#FFFFFF" />}
        backgroundColor="#111111"
        textColor="#FFFFFF"
        compact
      />
      <AuthSocialButton
        accessibilityLabel="Continue with Google"
        onPress={googleAvailable ? onGoogle : () => onComingSoon?.("Google")}
        loading={googleLoading}
        disabled={googleLoading}
        icon={<GoogleMark size={23} />}
        backgroundColor="#FFFFFF"
        textColor="#1F2937"
        borderColor="#E5E7EB"
        shadow
        compact
      />
    </View>
  );
}

/** @deprecated kept for any remaining imports */
export function AuthGoogleButton({ onPress, loading, label = "Continue with Google" }) {
  return (
    <AuthSocialButton
      label={label}
      onPress={onPress}
      loading={loading}
      disabled={loading}
      icon={<GoogleMark size={20} />}
      backgroundColor="#FFFFFF"
      textColor="#1F2937"
      borderColor="#E5E7EB"
      shadow
    />
  );
}

export function AuthLogo() {
  return (
    <View style={{ alignSelf: "center", marginBottom: 10, alignItems: "center" }}>
      <Image
        source={require("@/assets/logos/app_logo.png")}
        style={{ width: 96, height: 60 }}
        resizeMode="contain"
      />
    </View>
  );
}

export function AuthScreenContainer({ children }) {
  return (
    <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", paddingTop: 12, paddingBottom: 8 }}>
      {children}
    </View>
  );
}

export function getAuthPrimaryLabel(mode) {
  return (COPY[mode] || COPY.signIn).primaryLabel;
}

export function getAuthCopy(mode) {
  return COPY[mode] || COPY.signIn;
}

export function AuthFooterLink({ mode, onPress }) {
  const copy = COPY[mode] || COPY.signIn;
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: "center", marginTop: 20 }}>
      <Text style={{ fontSize: 14, color: "#6B7280" }}>
        {copy.footerPrefix}{" "}
        <Text style={{ color: AUTH_LINK, fontWeight: "800" }}>{copy.footerAction}</Text>
      </Text>
    </TouchableOpacity>
  );
}

// Legacy stubs
export function AuthModeTabs() {
  return null;
}
export function AuthHero() {
  return null;
}
export function AuthSectionHeader() {
  return null;
}
