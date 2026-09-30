import { useState, useRef, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer, AudioModule } from "expo-audio";
import { setCommentaryPrefsForGame } from "@/lib/commentaryPrefsStore";
import { subscribeCommentaryPlayback } from "@/lib/commentaryPlaybackBus";

export function useCommentary(gameId) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [commentaryMode, setCommentaryMode] = useState("broadcast"); // broadcast | simple
  const [commentaryLanguage, setCommentaryLanguage] = useState("en"); // en | hi | hinglish
  const voiceEnabledRef = useRef(true);
  const commentaryModeRef = useRef("broadcast");
  const commentaryLanguageRef = useRef("en");
  const commentarySoundRef = useRef(null);
  const lastPlayedRef = useRef({ key: "", ts: 0 });

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { commentaryModeRef.current = commentaryMode; }, [commentaryMode]);
  useEffect(() => { commentaryLanguageRef.current = commentaryLanguage; }, [commentaryLanguage]);

  useEffect(() => {
    if (!gameId) return;
    setCommentaryPrefsForGame(gameId, {
      mode: commentaryMode,
      language: commentaryLanguage,
      voiceEnabled,
    });
  }, [gameId, commentaryMode, commentaryLanguage, voiceEnabled]);

  const stopCommentary = useCallback(() => {
    try {
      if (commentarySoundRef.current) {
        commentarySoundRef.current.pause();
        commentarySoundRef.current.remove();
        commentarySoundRef.current = null;
      }
    } catch {}
    if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    Speech.stop();
  }, []);

  const playCommentaryAudio = useCallback(async (audioBuffer, commentaryText) => {
    if (!voiceEnabledRef.current) return;

    const dedupeKey = String(commentaryText || "").slice(0, 120);
    const now = Date.now();
    if (
      dedupeKey
      && dedupeKey === lastPlayedRef.current.key
      && now - lastPlayedRef.current.ts < 4000
    ) {
      return;
    }
    if (dedupeKey) lastPlayedRef.current = { key: dedupeKey, ts: now };

    // Stop any currently playing commentary
    try {
      if (commentarySoundRef.current) {
        commentarySoundRef.current.pause();
        commentarySoundRef.current.remove();
        commentarySoundRef.current = null;
      }
    } catch {}

    // Try ElevenLabs MP3
    if (audioBuffer) {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const tmpPath = `${FileSystem.cacheDirectory}commentary_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(tmpPath, audioBuffer, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const player = createAudioPlayer({ uri: tmpPath });
        player.volume = 1.0;
        player.play();
        commentarySoundRef.current = player;
        const sub = player.addListener("playbackStatusUpdate", (status) => {
          if (!status.playing && status.currentTime > 0) {
            sub.remove();
            player.remove();
            FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
            commentarySoundRef.current = null;
          }
        });
        return;
      } catch (err) {
        // Include the first stack frame so we know exactly which line broke
        // (AudioModule.setAudioModeAsync, FileSystem.writeAsStringAsync, player.play, etc.)
        console.warn(
          "[Commentary] MP3 playback failed, falling back to TTS:",
          err.message,
          err.stack?.split("\n")[1]?.trim() ?? "",
        );
      }
    }

    // Fallback: TTS
    if (commentaryText) {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(commentaryText);
          utterance.rate = 1.1;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
          return;
        } catch {}
      }
      Speech.stop();
      Speech.speak(commentaryText, { rate: 1.1, pitch: 1.0 });
    }
  }, []);

  // Batch HTTP path — scorer hears commentary even if socket joins late.
  useEffect(() => {
    if (!gameId) return undefined;
    return subscribeCommentaryPlayback(({ gameId: gid, commentary, audioData }) => {
      if (gid && String(gid) !== String(gameId)) return;
      if (!voiceEnabledRef.current || !commentary) return;
      const audioBuffer = audioData?.success ? audioData?.audioBuffer : null;
      playCommentaryAudio(audioBuffer, commentary);
    });
  }, [gameId, playCommentaryAudio]);

  return {
    voiceEnabled,
    setVoiceEnabled,
    voiceEnabledRef,
    commentaryMode,
    setCommentaryMode,
    commentaryLanguage,
    setCommentaryLanguage,
    commentarySoundRef,
    playCommentaryAudio,
    stopCommentary,
  };
}
