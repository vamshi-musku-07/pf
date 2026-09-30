import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const DURATION = 3500; // ms a toast stays visible

const VARIANTS = {
  success: { bg: "#166534", icon: "checkmark-circle", iconColor: "#4ade80" },
  error:   { bg: "#991B1B", icon: "alert-circle",     iconColor: "#fca5a5" },
  info:    { bg: "#1E40AF", icon: "information-circle",iconColor: "#93c5fd" },
  warning: { bg: "#92400E", icon: "warning",           iconColor: "#fcd34d" },
};

const ToastContext = createContext(null);

let _toastRef = null;

/**
 * Call showToast from anywhere — no hook needed, no prop drilling.
 *   showToast("Saved!", "success")           // bottom (default)
 *   showToast("Recording saved", "success", "top")  // slides in from top
 */
export function showToast(message, type = "info", position = "bottom") {
  _toastRef?.show(message, type, position);
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const show = useCallback((message, type = "info", position = "bottom") => {
    const id = Date.now().toString();
    const anim = new Animated.Value(0);

    setToasts((prev) => [...prev, { id, message, type, position, anim }]);

    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();

    timers.current[id] = setTimeout(() => dismiss(id, anim), DURATION);
  }, []);

  const dismiss = useCallback((id, anim) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });
  }, []);

  // Expose imperative `show` so the module-level `showToast` can reach it
  _toastRef = { show };

  const topToasts    = toasts.filter((t) => t.position === "top");
  const bottomToasts = toasts.filter((t) => t.position !== "top");

  const renderToast = ({ id, message, type, anim, position }) => {
    const v = VARIANTS[type] || VARIANTS.info;
    const isTop = position === "top";
    return (
      <Animated.View
        key={id}
        style={[
          S.toast,
          { backgroundColor: v.bg },
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isTop ? -40 : 20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name={v.icon} size={18} color={v.iconColor} />
        <Text style={S.text} numberOfLines={3}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={() => dismiss(id, anim)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* Top toasts — slide down from top */}
      {topToasts.length > 0 && (
        <View
          style={[S.container, { top: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          {topToasts.map(renderToast)}
        </View>
      )}

      {/* Bottom toasts — slide up from bottom (default) */}
      {bottomToasts.length > 0 && (
        <View
          style={[S.container, { bottom: insets.bottom + 80 }]}
          pointerEvents="box-none"
        >
          {bottomToasts.map(renderToast)}
        </View>
      )}
    </ToastContext.Provider>
  );
}

/** Hook for components that prefer the hook API over the module-level function */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const S = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
