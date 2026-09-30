import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

export default function MarqueeText({
  children,
  style,
  containerStyle,
  speed = 40,
  delay = 1500,
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const animation = useRef(null);

  useEffect(() => {
    if (animation.current) {
      animation.current.stop();
      translateX.setValue(0);
    }
    if (!containerWidth || !textWidth || textWidth <= containerWidth) return;

    const distance = textWidth - containerWidth;
    const duration = (distance / speed) * 1000;

    animation.current = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.current.start();
    return () => animation.current?.stop();
  }, [textWidth, containerWidth]);

  return (
    <View
      style={[{ overflow: "hidden", flexDirection: "row" }, containerStyle]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{ transform: [{ translateX }] }}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        <Text style={style} numberOfLines={1}>
          {children}
        </Text>
      </Animated.View>
    </View>
  );
}
