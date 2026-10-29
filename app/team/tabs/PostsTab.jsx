import { useState, useEffect, useRef, useCallback } from "react";
import { ActivityIndicator, Alert, Animated, Image, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { timeAgo } from "./helpers";
import {
  createPostAPI,
  getTeamPostsAPI,
  togglePostReactionAPI,
  addCommentAPI,
  deletePostAPI,
} from "@/services/PostApi";
import { buildPostUploadPayload } from "@/lib/postMediaUpload";
import { DEFAULT_QUICK_REACTION_KEY } from "@/constants/messageReactions";
import TelegramReactionPicker from "@/components/messages/TelegramReactionPicker";
import MessageReactionsRow from "@/components/messages/MessageReactionsRow";
import ReactionBurstOverlay from "@/components/messages/ReactionBurstOverlay";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Full-screen video player modal ───────────────────────────────────────────
// Separate component so useVideoPlayer hook is always called unconditionally
function VideoPlayerModal({ uri, onClose }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [isPlaying, setIsPlaying]     = useState(true);
  const [isMuted, setIsMuted]         = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const controlsTimer = useRef(null);

  const player = useVideoPlayer(uri || "", (p) => {
    if (uri) { p.loop = false; p.play(); }
  });

  // Player event listeners
  useEffect(() => {
    if (!uri) return;
    const playing = player.addListener("playingChange", ({ isPlaying: p }) => setIsPlaying(p));
    const time    = player.addListener("timeUpdate",    ({ currentTime: t }) => setCurrentTime(t));
    const status  = player.addListener("statusChange",  ({ status: s }) => {
      setIsBuffering(s === "loading");
      if (s === "readyToPlay") setDuration(player.duration ?? 0);
    });
    return () => { playing.remove(); time.remove(); status.remove(); };
  }, [player, uri]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => { resetControlsTimer(); return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }; }, []);

  const togglePlayPause = () => {
    if (isPlaying) player.pause(); else player.play();
    resetControlsTimer();
  };

  const toggleMute = () => { player.muted = !isMuted; setIsMuted(!isMuted); resetControlsTimer(); };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.unlockAsync();
      setIsFullscreen(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    }
    resetControlsTimer();
  };

  const handleClose = async () => {
    player.pause();
    await ScreenOrientation.unlockAsync();
    onClose();
  };

  // Seek bar: track tap/drag position
  const seekBarRef = useRef(null);
  const seekBarWidth = useRef(1);
  const handleSeek = (evt) => {
    if (!duration) return;
    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / seekBarWidth.current));
    player.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
    resetControlsTimer();
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  if (!uri) return null;

  const videoStyle = isLandscape
    ? { flex: 1 }
    : { width: "100%", aspectRatio: 16 / 9 };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>

        {/* Video */}
        <TouchableOpacity activeOpacity={1} style={isLandscape ? { flex: 1 } : {}} onPress={() => { setShowControls((v) => !v); resetControlsTimer(); }}>
          <VideoView
            player={player}
            style={videoStyle}
            contentFit="contain"
            nativeControls={false}
          />

          {/* Buffering spinner */}
          {isBuffering && (
            <View style={{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
        </TouchableOpacity>

        {/* Controls overlay */}
        {showControls && (
          <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "space-between" }} pointerEvents="box-none">

            {/* Top bar */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(239,68,68,0.85)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }} />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>LIVE RECORDING</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Center play/pause */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={togglePlayPause}
              style={{ alignSelf: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="white" style={isPlaying ? {} : { marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Bottom bar */}
            <View style={{ paddingHorizontal: 16, paddingBottom: isLandscape ? 24 : 36 }}>
              {/* Seek bar */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleSeek}
                onLayout={(e) => { seekBarWidth.current = e.nativeEvent.layout.width; }}
                style={{ height: 28, justifyContent: "center", marginBottom: 6 }}
              >
                <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2 }}>
                  <View style={{ height: 4, width: `${progress * 100}%`, backgroundColor: "#9AEA62", borderRadius: 2 }} />
                  {/* Thumb */}
                  <View style={{ position: "absolute", top: -5, left: `${progress * 100}%`, width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff", marginLeft: -7 }} />
                </View>
              </TouchableOpacity>

              {/* Controls row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <TouchableOpacity onPress={togglePlayPause} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleMute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="white" />
                  </TouchableOpacity>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>
                </View>
                <TouchableOpacity onPress={toggleFullscreen} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={isFullscreen ? "contract" : "expand"} size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ImageViewerModal({ uri, onClose }) {
  const insets = useSafeAreaInsets();
  if (!uri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: "absolute",
            top: insets.top + 10,
            right: 16,
            zIndex: 2,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 12,
          }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function PostsSkeleton({ isDark = false }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bone = isDark ? "#2A2A2E" : "#E2E8F0";
  const cardBg = isDark ? "#16161A" : "#fff";
  const B = ({ w, h = 12, r = 6 }) => (
    <Animated.View style={{ opacity: pulse, width: w, height: h, borderRadius: r, backgroundColor: bone }} />
  );
  const CardSkeleton = ({ imgHeight }) => (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 6,
        elevation: isDark ? 0 : 2,
        ...(isDark ? { borderWidth: 1, borderColor: "#2A2A2E" } : {}),
      }}
    >
      <Animated.View style={{ width: "100%", height: imgHeight, backgroundColor: bone, opacity: pulse }} />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <B w={40} h={10} r={5} />
          <B w={30} h={10} r={5} />
        </View>
        <B w={100} h={9} r={5} />
      </View>
    </View>
  );
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        ...(isDark ? { backgroundColor: "#0A0A0C" } : {}),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <B w={120} h={18} r={8} />
        <Animated.View style={{ width: 80, height: 34, borderRadius: 12, backgroundColor: bone, opacity: pulse }} />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <CardSkeleton imgHeight={220} />
          <CardSkeleton imgHeight={280} />
        </View>
        <View style={{ flex: 1 }}>
          <CardSkeleton imgHeight={300} />
          <CardSkeleton imgHeight={200} />
        </View>
      </View>
    </View>
  );
}

export default function PostsTab({
  teamId,
  isSelfOwnedOpponent = false,
  opponentTeamId = null,
  mergeOpponentMedia = false,
  refreshKey = 0,
  canUpload = true,
}) {
  const { backendUser } = useBackendAuth();
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createSheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const renderSheetBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [mediaAspectRatios, setMediaAspectRatios] = useState({});
  const [videoModalUri, setVideoModalUri] = useState(null);
  const [imageModalUri, setImageModalUri] = useState(null);
  const [reactionPickerPost, setReactionPickerPost] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [burstPostId, setBurstPostId] = useState(null);
  const [burstReactionKey, setBurstReactionKey] = useState(null);

  useEffect(
    () => () => {
      setShowCreateModal(false);
      setShowReactionPicker(false);
      createSheetRef.current?.close();
    },
    [],
  );

  const currentUserId = backendUser?.id || backendUser?._id;

  useEffect(() => {
    loadPosts();
  }, [teamId, opponentTeamId, mergeOpponentMedia, isSelfOwnedOpponent]);

  // Re-fetch when a live stream ends (refreshKey bumped by parent after recording is triggered)
  useEffect(() => {
    if (refreshKey > 0) loadPosts(false);
  }, [refreshKey]);

  useEffect(() => {
    posts.forEach((post) => {
      const uri = post?.image;
      if (!uri || mediaAspectRatios[uri]) return;

      Image.getSize(
        uri,
        (width, height) => {
          if (!width || !height) return;
          const ratio = width / height;
          setMediaAspectRatios((prev) => {
            if (prev[uri]) return prev;
            return { ...prev, [uri]: ratio };
          });
        },
        () => {},
      );
    });
  }, [posts, mediaAspectRatios]);

  const loadPosts = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getTeamPostsAPI(teamId);
      let list = (res.data || res.posts || []).map((p) => ({ ...p, _sourceTeamId: teamId }));

      // Merge opponent media for self-owned opponents or tournament/match dual-team view
      if ((isSelfOwnedOpponent || mergeOpponentMedia) && opponentTeamId) {
        try {
          const oppRes = await getTeamPostsAPI(opponentTeamId);
          const oppList = (oppRes.data || oppRes.posts || []).map((p) => ({ ...p, _sourceTeamId: opponentTeamId }));
          const seen = new Set(list.map((p) => p._id));
          for (const p of oppList) {
            if (!seen.has(p._id)) { seen.add(p._id); list.push(p); }
          }
          list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } catch {}
      }

      setPosts(list);
    } catch {
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const onRefreshPosts = async () => {
    setRefreshing(true);
    await loadPosts(false);
    setRefreshing(false);
  };

  const applyPostReactions = useCallback((postId, reactions) => {
    setPosts((prev) =>
      prev.map((p) =>
        String(p._id || p.id || "") === String(postId)
          ? { ...p, reactions: reactions || [] }
          : p,
      ),
    );
  }, []);

  const handleTogglePostReaction = async (post, reactionKey, showBurst = false) => {
    const postId = post?._id || post?.id;
    const sourceTeamId = post?._sourceTeamId || teamId;
    if (!postId) return;

    try {
      const res = await togglePostReactionAPI(sourceTeamId, postId, reactionKey);
      const payload = res?.data || res;
      const reactions = payload?.reactions || [];
      applyPostReactions(postId, reactions);

      if (showBurst && payload?.active !== false) {
        setBurstPostId(String(postId));
        setBurstReactionKey(reactionKey);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
    } catch {
      Alert.alert("Error", "Could not update reaction.");
    }
  };

  const handleLongPressPost = (post) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setReactionPickerPost(post);
    setShowReactionPicker(true);
  };

  const handlePostPress = (post) => {
    if (!post?.image) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setImageModalUri(post.image);
  };

  const handleComment = async (postId, sourceTeamId) => {
    const t = commentText[postId]?.trim();
    if (!t) return;
    try {
      await addCommentAPI(sourceTeamId || teamId, postId, t);
      setCommentText({ ...commentText, [postId]: "" });
      loadPosts(false);
    } catch {}
  };

  const handleDeletePost = (postId, sourceTeamId) => {
    Alert.alert("Delete Post", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingPostId(postId);
          try {
            await deletePostAPI(sourceTeamId || teamId, postId);
            await loadPosts(false);
          } catch (err) {
            Alert.alert("Error", err?.response?.data?.message || "Failed to delete post");
          } finally {
            setDeletingPostId(null);
          }
        },
      },
    ]);
  };

  const pickMedia = async () => {
    try {
      const allowed = await ensurePhotoLibraryAccess();
      if (!allowed) {
        Alert.alert(
          "Permission required",
          "Please allow media library access to upload.",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const isVideo = (asset.mimeType || asset.type || "")
        .toLowerCase()
        .includes("video");

      setSelectedMedia({
        uri: asset.uri,
        mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
        type: isVideo ? "video" : "image",
        name:
          asset.fileName ||
          `${isVideo ? "video" : "image"}-${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
      });
    } catch {
      Alert.alert("Error", "Could not pick media. Try again.");
    }
  };

  const handleCreatePost = async () => {
    if (!selectedMedia) {
      Alert.alert("Media required", "Select an image or video.");
      return;
    }

    setCreatingPost(true);
    try {
      const uploadPayload = await buildPostUploadPayload({
        teamId,
        media: selectedMedia,
      });

      await createPostAPI(uploadPayload);
      createSheetRef.current?.close();
      setShowCreateModal(false);
      setSelectedMedia(null);
      loadPosts();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create post.";
      Alert.alert("Error", msg);
    } finally {
      setCreatingPost(false);
    }
  };

  const getMasonryImageStyle = (post, index) => {
    if (post?.image) {
      const ratio = mediaAspectRatios[post.image];
      if (ratio) {
        return { width: "100%", aspectRatio: ratio };
      }
    }

    const fallbackHeights = [220, 300, 260, 340];
    return {
      width: "100%",
      height: fallbackHeights[index % fallbackHeights.length],
    };
  };

  const leftColumnPosts = posts.filter((_, index) => index % 2 === 0);
  const rightColumnPosts = posts.filter((_, index) => index % 2 !== 0);

  const renderPostCard = (post, index) => {
    const postId = String(post._id || post.id || "");
    const showBurst = burstPostId && postId === burstPostId && burstReactionKey;

    return (
    <View
      key={post._id || post.id || `${index}`}
      className={isDark ? "rounded-xl overflow-hidden mb-3" : "bg-white rounded-xl shadow-sm overflow-hidden mb-3"}
      style={
        isDark
          ? {
              backgroundColor: T.surface,
              borderWidth: 1,
              borderColor: T.border,
            }
          : undefined
      }
    >
      <View style={{ position: "relative" }}>
        {post.image ? (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => handlePostPress(post)}
            onLongPress={() => handleLongPressPost(post)}
            delayLongPress={350}
          >
            <Image
              source={{ uri: post.image }}
              style={getMasonryImageStyle(post, index)}
              resizeMode="cover"
              resizeMethod="resize"
            />
          </TouchableOpacity>
        ) : null}

        {post.video ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setVideoModalUri(post.video)}
            onLongPress={() => handleLongPressPost(post)}
            delayLongPress={350}
            style={{ width: "100%", height: index % 2 === 0 ? 250 : 320, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}>
              <Ionicons name="play" size={30} color="white" style={{ marginLeft: 4 }} />
            </View>
            <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(239,68,68,0.75)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>LIVE RECORDING</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {showBurst ? (
          <ReactionBurstOverlay
            reactionKey={burstReactionKey}
            centered
            size={80}
            onDone={() => {
              setBurstPostId(null);
              setBurstReactionKey(null);
            }}
          />
        ) : null}
      </View>

      <View className="px-3 pt-2">
        <MessageReactionsRow
          reactions={post.reactions}
          currentUserId={currentUserId}
          isDark={isDark}
          onToggle={(key) => handleTogglePostReaction(post, key, true)}
        />
      </View>

      <View className="p-4 pt-2">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => handleLongPressPost(post)}
              className="flex-row items-center gap-1"
            >
              <Ionicons name="happy-outline" size={22} color={isDark ? T.iconMuted : "#6B7280"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setExpandedComments({
                  ...expandedComments,
                  [post._id]: !expandedComments[post._id],
                })
              }
              className="flex-row items-center gap-1 ml-3"
            >
              <Ionicons name="chatbubble-outline" size={20} color={isDark ? T.iconMuted : "#6B7280"} />
              <Text
                className="text-gray-600 text-sm"
                style={isDark ? { color: T.textDim } : undefined}
              >
                {post.comments?.length || 0}
              </Text>
            </TouchableOpacity>
          </View>
          {(post.user?._id === backendUser?.id || post.user?._id === backendUser?._id ||
            post.user === backendUser?.id || post.user === backendUser?._id) && (
            <TouchableOpacity
              onPress={() => handleDeletePost(post._id, post._sourceTeamId)}
              disabled={deletingPostId === post._id}
            >
              {deletingPostId === post._id ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text
          className="text-gray-500 text-xs"
          style={isDark ? { color: T.textMuted } : undefined}
        >
          {post.user?.username || "User"} {"\u2022"}{" "}
          {timeAgo(post.createdAt)}
        </Text>

        {expandedComments[post._id] && (
          <View
            className={isDark ? "mt-3 pt-3" : "mt-3 border-t border-gray-100 pt-3"}
            style={isDark ? { borderTopWidth: 1, borderTopColor: T.borderSubtle } : undefined}
          >
            {(post.comments || []).map((c, i) => (
              <View key={c._id || i} className="mb-2">
                <Text
                  className="text-gray-800 text-sm"
                  style={isDark ? { color: T.text } : undefined}
                >
                  <Text className="font-bold">{c.user?.username || "User"}</Text>{" "}
                  {c.content}
                </Text>
                <Text
                  className="text-gray-400 text-xs"
                  style={isDark ? { color: T.textMuted } : undefined}
                >
                  {timeAgo(c.createdAt)}
                </Text>
              </View>
            ))}
            <View className="flex-row items-center gap-2 mt-2">
              <TextInput
                value={commentText[post._id] || ""}
                onChangeText={(v) =>
                  setCommentText({
                    ...commentText,
                    [post._id]: v,
                  })
                }
                placeholder="Add a comment..."
                placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                className={isDark ? "flex-1 rounded-xl px-3 py-2 text-sm" : "flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm"}
                style={isDark ? { backgroundColor: T.inputBg, color: T.text } : undefined}
              />
              <TouchableOpacity onPress={() => handleComment(post._id, post._sourceTeamId)}>
                <Ionicons name="send" size={18} color={isDark ? T.refresh : "#081126"} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
  };

  if (loading) return <PostsSkeleton isDark={isDark} />;

  return (
    <View className="flex-1" {...(isDark ? { style: { backgroundColor: T.bg } } : {})}>
      <VideoPlayerModal uri={videoModalUri} onClose={() => setVideoModalUri(null)} />
      <ImageViewerModal uri={imageModalUri} onClose={() => setImageModalUri(null)} />
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text
          className="text-lg font-bold text-gray-900"
          style={isDark ? { color: T.text } : undefined}
        >
          Team Gallery
        </Text>
        {canUpload ? (
          <TouchableOpacity
            onPress={() => { setShowCreateModal(true); createSheetRef.current?.expand(); }}
            className={
              isDark
                ? "flex-row items-center gap-1 px-3 py-2 rounded-xl"
                : "flex-row items-center gap-1 bg-[#9AEA62] px-3 py-2 rounded-xl"
            }
            style={
              isDark
                ? { backgroundColor: "#1E1E24", borderWidth: 1, borderColor: "#2A2A2E" }
                : undefined
            }
          >
            <Ionicons name="cloud-upload-outline" size={16} color={isDark ? "#F5F5F7" : "#081126"} />
            <Text
              className={isDark ? "font-bold text-xs" : "text-[#081126] font-bold text-xs"}
              style={isDark ? { color: "#F5F5F7" } : undefined}
            >
              Upload
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {posts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Image
            source={TEAM_EMPTY_ICONS.posts}
            style={TEAM_EMPTY_ICON_STYLE}
            resizeMode="contain"
          />
          <Text
            className="text-gray-400 text-lg mt-2"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            No posts yet
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 20, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefreshPosts}
              colors={[isDark ? T.refresh : "#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          <View className="flex-row items-start" style={{ gap: 12 }}>
            <View style={{ flex: 1 }}>
              {leftColumnPosts.map((post, colIndex) =>
                renderPostCard(post, colIndex * 2),
              )}
            </View>
            <View style={{ flex: 1 }}>
              {rightColumnPosts.map((post, colIndex) =>
                renderPostCard(post, colIndex * 2 + 1),
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {canUpload ? (
        <BottomSheet
          ref={createSheetRef}
          index={-1}
          snapPoints={[400]}
          enableDynamicSizing={false}
          enablePanDownToClose={!creatingPost}
          backdropComponent={renderSheetBackdrop}
          backgroundStyle={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            ...(isDark ? { backgroundColor: T.surface } : {}),
          }}
          handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
          onChange={(idx) => {
            if (idx === -1) {
              setShowCreateModal(false);
              setSelectedMedia(null);
            }
          }}
        >
          <BottomSheetView
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom + 16, 20),
            }}
          >
              <View className="flex-row items-center justify-between mb-4">
                <Text
                  className="text-gray-900 text-lg font-bold"
                  style={isDark ? { color: T.text } : undefined}
                >
                  Upload Media
                </Text>
                <TouchableOpacity
                  onPress={() => createSheetRef.current?.close()}
                >
                  <Ionicons name="close" size={22} color={isDark ? T.textDim : "#6B7280"} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={pickMedia}
                className={
                  isDark
                    ? "rounded-xl px-4 py-3 flex-row items-center justify-center gap-2"
                    : "bg-gray-100 rounded-xl px-4 py-3 flex-row items-center justify-center gap-2"
                }
                style={
                  isDark
                    ? { backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border }
                    : undefined
                }
              >
                <Ionicons name="image-outline" size={18} color={isDark ? T.text : "#374151"} />
                <Text
                  className="text-gray-700 font-semibold"
                  style={isDark ? { color: T.text } : undefined}
                >
                  Choose Image/Video
                </Text>
              </TouchableOpacity>

              {selectedMedia ? (
                <View
                  className={
                    isDark
                      ? "mt-3 rounded-xl p-3"
                      : "mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3"
                  }
                  style={
                    isDark
                      ? {
                          backgroundColor: T.surfaceAlt,
                          borderWidth: 1,
                          borderColor: T.border,
                        }
                      : undefined
                  }
                >
                  {selectedMedia.type === "image" ? (
                    <Image
                      source={{ uri: selectedMedia.uri, width: 360, height: 160 }}
                      className="w-full h-40 rounded-lg"
                      resizeMode="cover"
                      resizeMethod="resize"
                    />
                  ) : (
                    <View
                      className={
                        isDark
                          ? "h-24 items-center justify-center rounded-lg"
                          : "h-24 items-center justify-center bg-gray-200 rounded-lg"
                      }
                      style={isDark ? { backgroundColor: T.inputBg } : undefined}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={28}
                        color={isDark ? T.textDim : "#4B5563"}
                      />
                      <Text
                        className="text-gray-600 text-xs mt-1"
                        style={isDark ? { color: T.textDim } : undefined}
                        numberOfLines={1}
                      >
                        {selectedMedia.name}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={creatingPost}
                className="mt-4 bg-[#081126] rounded-xl py-3 items-center"
                style={{ opacity: creatingPost ? 0.6 : 1 }}
              >
                {creatingPost ? (
                  <ActivityIndicator color="#9AEA62" />
                ) : (
                  <Text className="text-[#9AEA62] font-bold text-base">Post</Text>
                )}
              </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      ) : null}

      <TelegramReactionPicker
        visible={showReactionPicker}
        isDark={isDark}
        onClose={() => {
          setShowReactionPicker(false);
          setReactionPickerPost(null);
        }}
        onSelect={(key) => {
          if (reactionPickerPost) {
            handleTogglePostReaction(reactionPickerPost, key, true);
          }
          setReactionPickerPost(null);
        }}
      />
    </View>
  );
}

// =============================================
// ASSIGNMENTS TAB - Full CRUD + respond
// =============================================
