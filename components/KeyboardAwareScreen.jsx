import { Platform, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useKeyboardInset from "@/hooks/useKeyboardInset";

/**
 * Scrollable screen that keeps focused inputs above the keyboard.
 * Uses react-native-keyboard-controller's KeyboardAwareScrollView so
 * Android OEMs (and iOS) scroll the active field into view reliably.
 */
export default function KeyboardAwareScreen({
  children,
  backgroundColor = "#FFFFFF",
  edges = ["top", "bottom"],
  centerWhenIdle = true,
  horizontalPadding = 16,
  contentContainerStyle,
  scrollViewProps = {},
  /** Extra gap between focused input and keyboard top */
  bottomOffset = 24,
  /**
   * "none" keeps the keyboard open while scrolling (best for forms).
   * Default: none — avoids the common "scroll closes keyboard" issue.
   */
  keyboardDismissMode = "none",
}) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();

  const padTop = edges.includes("top") ? insets.top : 0;
  const padBottom =
    keyboardInset > 0
      ? 28
      : edges.includes("bottom")
        ? Math.max(insets.bottom, 24)
        : 24;

  const {
    contentContainerStyle: scrollContentStyle,
    keyboardDismissMode: scrollDismissMode,
    ...restScrollProps
  } = scrollViewProps;

  return (
    <View style={{ flex: 1, backgroundColor, paddingTop: padTop }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingHorizontal: horizontalPadding,
            paddingTop: 8,
            paddingBottom: padBottom,
          },
          centerWhenIdle && keyboardInset === 0 ? { justifyContent: "center" } : null,
          contentContainerStyle,
          scrollContentStyle,
        ]}
        bottomOffset={bottomOffset + (Platform.OS === "ios" ? insets.bottom : 0)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={scrollDismissMode ?? keyboardDismissMode}
        showsVerticalScrollIndicator={false}
        {...restScrollProps}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}
