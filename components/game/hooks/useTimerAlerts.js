import { useRef, useCallback } from "react";
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { showToast } from "@/context/ToastContext";

// Vibration patterns [pause_ms, vibrate_ms, ...]
const PATTERN_MEDIUM = Platform.OS === "ios" ? [0, 400] : [0, 300, 80, 200];
const PATTERN_LIGHT  = [0, 120];

export function useTimerAlerts() {
  const playCommentaryRef = useRef(null);

  // Allow GameScreen to inject the commentary player
  const setCommentaryPlayer = useCallback((fn) => {
    playCommentaryRef.current = fn;
  }, []);

  const speakText = useCallback((text) => {
    const play = playCommentaryRef.current;
    if (play) {
      // Use AI commentary voice (ElevenLabs → TTS fallback)
      play(null, text);
    } else {
      // Direct TTS fallback if commentary player not injected
      if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.1;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
          return;
        } catch {}
      }
      Speech.stop();
      Speech.speak(text, { rate: 1.1, pitch: 1.0 });
    }
  }, []);

  // ── PAUSE: vibration + toast + AI voice ────────────────────────────────
  const alertPause = useCallback((teamName = "") => {
    // Haptics first — lowest latency
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Vibration.vibrate(PATTERN_MEDIUM);

    // Toast
    const line2 = teamName ? `\nPaused by ${teamName}` : "";
    showToast(`⏸ Match Paused${line2}`, "warning", "top");

    // AI voice
    const voiceText = teamName ? `Match paused by ${teamName}` : "Match paused";
    speakText(voiceText);
  }, [speakText]);

  // ── RESUME: light vibration + toast + AI voice ─────────────────────────
  const alertResume = useCallback((byTeam = "") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Vibration.vibrate(PATTERN_LIGHT);

    const label = byTeam ? `▶ Match Resumed\nby ${byTeam}` : "▶ Match Resumed";
    showToast(label, "success", "top");

    // AI voice
    const voiceText = byTeam ? `Match resumed by ${byTeam}` : "Match resumed";
    speakText(voiceText);
  }, [speakText]);

  // ── BASKETBALL MANUAL CLOCK CONTROL ───────────────────────────────────
  // Basketball clock stops are game moments, not team-attributed events.
  // These lines are used in regular games and tournament fixtures alike.
  const alertBasketballPause = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Vibration.vibrate(PATTERN_MEDIUM);
    showToast(
      "🏀 Play Stopped\nThe whistle sounds — both sides reset",
      "warning",
      "top",
    );
    speakText(
      "The whistle sounds and the clock stops. Both teams regroup before the next possession.",
    );
  }, [speakText]);

  const alertBasketballResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Vibration.vibrate(PATTERN_LIGHT);
    showToast(
      "🏀 Ball Back in Play\nThe clock is running — here we go!",
      "success",
      "top",
    );
    speakText(
      "We're back! The ball is live, the clock is moving, and the next possession begins.",
    );
  }, [speakText]);

  // ── BASKETBALL QUARTER END ─────────────────────────────────────────────
  // Voice commentary comes from the quarter_transition game event. This alert
  // deliberately handles only haptics/toast so two voices never talk at once.
  const alertQuarterEnd = useCallback((quarter = 1) => {
    const q = Math.max(1, Number(quarter) || 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Vibration.vibrate(PATTERN_MEDIUM);
    showToast(
      `🏀 Quarter ${q} Complete\nThe horn sounds — teams head to the break`,
      "success",
      "top",
    );
  }, []);

  return {
    alertPause,
    alertResume,
    alertBasketballPause,
    alertBasketballResume,
    alertQuarterEnd,
    setCommentaryPlayer,
  };
}
