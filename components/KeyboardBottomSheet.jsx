import { useEffect, useRef } from "react";
import {
  BackHandler,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useKeyboardInset from "@/hooks/useKeyboardInset";

const WINDOW_HEIGHT = Dimensions.get("window").height;

export const scrollSheetToField = (scrollRef, yOffset, delayMs = Platform.OS === "ios" ? 320 : 150) => {
  setTimeout(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, (yOffset || 0) - 100),
      animated: true,
    });
  }, delayMs);
};

/**
 * Bottom sheet that stays above the keyboard (overlay — not RN Modal, for Android keyboard metrics).
 */
export default function KeyboardBottomSheet({
  visible,
  onClose,
  children,
  footer,
  scrollRef: externalScrollRef,
  contentPadding = 24,
  maxHeightRatio = 0.94,
  backdropColor = "rgba(2,6,23,0.45)",
  sheetBackgroundColor = "#fff",
  footerBorderColor = "#F3F4F6",
}) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const internalScrollRef = useRef(null);
  const scrollRef = externalScrollRef || internalScrollRef;
  const keyboardPad = Math.max(keyboardInset, insets.bottom);
  const sheetMaxHeight = Math.max(
    280,
    Math.min(WINDOW_HEIGHT * maxHeightRatio, WINDOW_HEIGHT - insets.top - keyboardPad - 16),
  );

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 24,
      }}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboardPad, backgroundColor: backdropColor }}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessible={false}
        />
        <View
          pointerEvents="box-none"
          style={{
            backgroundColor: sheetBackgroundColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: sheetMaxHeight,
            overflow: "hidden",
          }}
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
            showsVerticalScrollIndicator={keyboardInset > 0}
            contentContainerStyle={{
              padding: contentPadding,
              paddingBottom: footer ? 12 : Math.max(insets.bottom, 20),
            }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                paddingHorizontal: contentPadding,
                paddingTop: 12,
                paddingBottom: 12,
                borderTopWidth: 1,
                borderTopColor: footerBorderColor,
                backgroundColor: sheetBackgroundColor,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
