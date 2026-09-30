import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

let openSwipeableRef = null;

const closeOtherSwipeables = (current) => {
  if (openSwipeableRef && openSwipeableRef !== current) {
    openSwipeableRef.close();
  }
  openSwipeableRef = current;
};

function ReplyAction({ dragX, side }) {
  const scale = dragX.interpolate({
    inputRange: side === "left" ? [0, 72] : [-72, 0],
    outputRange: side === "left" ? [0.35, 1] : [1, 0.35],
    extrapolate: "clamp",
  });
  const opacity = dragX.interpolate({
    inputRange: side === "left" ? [0, 28, 72] : [-72, -28, 0],
    outputRange: side === "left" ? [0, 0.65, 1] : [1, 0.65, 0],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.actionWrap,
        side === "right" ? styles.actionWrapRight : styles.actionWrapLeft,
      ]}
    >
      <Animated.View style={[styles.actionIcon, { opacity, transform: [{ scale }] }]}>
        <View style={styles.iconCircle}>
          <Ionicons
            name="arrow-undo"
            size={22}
            color="#081126"
            style={side === "right" ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * WhatsApp-style swipe to reply.
 * Incoming messages: swipe right. Outgoing messages: swipe left.
 */
export default function SwipeToReply({ children, onReply, isMe = false, enabled = true }) {
  const swipeRef = useRef(null);

  if (!enabled) {
    return children;
  }

  const handleWillOpen = () => {
    closeOtherSwipeables(swipeRef.current);
  };

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onReply?.();
    requestAnimationFrame(() => {
      swipeRef.current?.close();
      if (openSwipeableRef === swipeRef.current) {
        openSwipeableRef = null;
      }
    });
  };

  const commonProps = {
    ref: swipeRef,
    friction: 2,
    overshootFriction: 8,
    onSwipeableWillOpen: handleWillOpen,
    onSwipeableOpen: handleOpen,
    activeOffsetX: [-18, 18],
    failOffsetY: [-12, 12],
    containerStyle: styles.container,
    childrenContainerStyle: styles.childrenContainer,
  };

  if (isMe) {
    return (
      <Swipeable
        {...commonProps}
        renderRightActions={(progress, dragX) => (
          <ReplyAction dragX={dragX} side="right" />
        )}
        rightThreshold={52}
        overshootRight={false}
      >
        {children}
      </Swipeable>
    );
  }

  return (
    <Swipeable
      {...commonProps}
      renderLeftActions={(progress, dragX) => (
        <ReplyAction dragX={dragX} side="left" />
      )}
      leftThreshold={52}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "visible",
  },
  childrenContainer: {
    overflow: "visible",
  },
  actionWrap: {
    justifyContent: "center",
    width: 68,
  },
  actionWrapLeft: {
    alignItems: "flex-start",
    paddingLeft: 4,
  },
  actionWrapRight: {
    alignItems: "flex-end",
    paddingRight: 4,
  },
  actionIcon: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F8E0",
    alignItems: "center",
    justifyContent: "center",
  },
});
