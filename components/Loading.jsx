import React, { useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

const Loading = ({ backgroundColor = "#f8f9fa" }) => {
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 220,
    height: 220,
  },
});

export default Loading;
