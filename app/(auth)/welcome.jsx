import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { createVideoPlayer, VideoView } from "expo-video";
import { StatusBar } from "expo-status-bar";
import { getAuthRedirectParams } from "@/lib/authRedirect";
import SlideToGetStarted from "@/components/SlideToGetStarted";

// Optimized for mobile (~4 MB, 720p). Original was ~53 MB at 4K.
const onboardingVideo = require("../../assets/videos/onboarding-optimized.mp4");
const onboardingPoster = require("../../assets/images/welcome2.jpg");

function OnboardingBackgroundVideo() {
  const [player, setPlayer] = useState(null);
  const [showPoster, setShowPoster] = useState(true);
  const playerRef = useRef(null);

  useEffect(() => {
    const p = createVideoPlayer(onboardingVideo);
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.bufferOptions = {
      preferredForwardBufferDuration: 1,
      minBufferForPlayback: 0.1,
    };

    playerRef.current = p;
    setPlayer(p);
    p.play();

    const playingSub = p.addListener("playingChange", ({ isPlaying }) => {
      if (isPlaying) setShowPoster(false);
    });

    const statusSub = p.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setShowPoster(false);
    });

    return () => {
      playingSub.remove();
      statusSub.remove();
      setPlayer(null);
      setShowPoster(true);
      playerRef.current = null;
      requestAnimationFrame(() => {
        try {
          p.pause();
          p.release();
        } catch {
          /* player may already be released during fast refresh */
        }
      });
    };
  }, []);

  return (
    <View style={styles.videoWrap} pointerEvents="none">
      {showPoster ? (
        <Image
          source={onboardingPoster}
          style={styles.video}
          resizeMode="cover"
        />
      ) : null}
      {player ? (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      ) : null}
    </View>
  );
}

const WelcomeScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const authRedirectParams = getAuthRedirectParams(params.redirect);
  const [sliderKey, setSliderKey] = useState(0);

  // Remount slider whenever this screen is focused so the ball resets
  useFocusEffect(
    useCallback(() => {
      setSliderKey((k) => k + 1);
    }, []),
  );

  const goSignUp = () =>
    router.push({
      pathname: "/(auth)/sign-up",
      params: authRedirectParams,
    });

  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <OnboardingBackgroundVideo />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)", "#000000"]}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1.2 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <Image
          source={require("../../assets/logos/applogo-hero.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.bottomContent}>
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.title}>Welcome to</Text>
            <Text style={styles.subtitle}>The Ultimate Player's Arena</Text>
          </View>

          <SlideToGetStarted
            key={sliderKey}
            label="Get Started"
            onComplete={goSignUp}
            trackColor="#9AEA62"
            labelColor="#0B1324"
            thumbIconColor="#15803D"
          />

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: "/(auth)/sign-in",
                params: authRedirectParams,
              })
            }
          >
            <Text style={styles.secondaryBtnText}>Already have an account</Text>
          </TouchableOpacity>

          <View style={styles.legalWrap}>
            <Text style={styles.legalText}>
              By continuing you agree to the{" "}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  router.push({
                    pathname: "/data-protection",
                    params: { backTo: "/(auth)/welcome" },
                  })
                }
              >
                Privacy Policy
              </Text>
              {" "}and{" "}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  router.push({
                    pathname: "/terms-of-use",
                    params: { backTo: "/(auth)/welcome" },
                  })
                }
              >
                Terms of Use
              </Text>
              .
            </Text>
            <Text style={styles.legalSubtext}>
              Children under 13 years old may not create an account.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  logo: {
    width: 0,
    height: 0,
    marginTop: 8,
    marginLeft: 4,
  },
  bottomContent: {
    paddingBottom: 16,
  },
  title: {
    color: "white",
    fontSize: 48,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "left",
    marginBottom: 1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "left",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  secondaryBtn: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "white",
  },
  secondaryBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
  },
  legalWrap: {
    marginTop: 18,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  legalText: {
    color: "rgba(226, 232, 240, 0.82)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "500",
  },
  legalLink: {
    color: "#9AEA62",
    fontWeight: "700",
  },
  legalSubtext: {
    marginTop: 6,
    color: "rgba(226, 232, 240, 0.72)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "500",
  },
});

export default WelcomeScreen;
