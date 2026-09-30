import React, { useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

/** Same loader as app bootstrap (`Loading` / load_balls). */
export default function TournamentCricketLoader({
  message,
  backgroundColor = "transparent",
  messageColor,
}) {
  const [lottieFailed, setLottieFailed] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {lottieFailed ? (
        <ActivityIndicator size="large" color="#9AEA62" />
      ) : (
        <LottieView
          source={require("@/app/animations/load_balls.json")}
          autoPlay
          loop
          style={styles.lottie}
          onAnimationFailure={() => setLottieFailed(true)}
        />
      )}
      {message ? (
        <Text style={[styles.message, messageColor ? { color: messageColor } : null]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 220,
    height: 220,
  },
  message: {
    marginTop: 12,
    color: "#64748B",
    fontWeight: "600",
    fontSize: 13,
  },
});
