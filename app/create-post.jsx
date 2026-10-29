import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { showToast } from "@/context/ToastContext";
import { goBackTo } from "@/lib/navigationBack";
import { createCommunityPostAPI } from "@/services/CommunityPostApi";
import { unlockBadges } from "@/lib/achievementsStore";
import { pingStreakAPI } from "@/services/StreakApi";
import { recordStreakActivity } from "@/lib/streakStore";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { useCommunityPostTheme } from "@/lib/communityPostTheme";
import { usePostTagOptions } from "@/hooks/usePostTagOptions";
import {
  getActiveTrigger,
  replaceTriggerRange,
  SUGGESTED_HASHTAGS,
  filterMentionSuggestions,
  filterHashtagSuggestions,
  countTagsInContent,
  MAX_MENTIONS_PER_POST,
  MAX_HASHTAGS_PER_POST,
} from "@/lib/postTags";
import PostTagChips from "@/components/community/PostTagChips";

const MAX_MEDIA = 12;
const SCREEN_W = Dimensions.get("window").width;
const PREVIEW_SIZE = Math.min(168, SCREEN_W * 0.42);

const ALIGN_CYCLE = ["left", "center", "right"];
const ALIGN_ICON = {
  left: "format-align-left",
  center: "format-align-center",
  right: "format-align-right",
};

function usePostColors() {
  const T = useCommunityPostTheme();
  return {
    T,
    BG: T.bg,
    SURFACE: T.surfaceAlt,
    SURFACE_ALT: T.inputBg,
    GREEN: T.green,
    TEXT: T.text,
    MUTED: T.muted,
    PUBLISH_DIM: T.publishDim,
    BORDER: T.border,
    ON_GREEN: T.onGreen,
  };
}

function SkeletonBox({ width, height, style }) {
  const { T, BG, SURFACE, SURFACE_ALT, GREEN, TEXT, MUTED, PUBLISH_DIM, BORDER, ON_GREEN } = usePostColors();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 14,
          backgroundColor: SURFACE_ALT,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

function MediaPreviewCard({ item, onRemove }) {
  const { T, BG, SURFACE, SURFACE_ALT, GREEN, TEXT, MUTED, PUBLISH_DIM, BORDER, ON_GREEN } = usePostColors();
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={{ width: PREVIEW_SIZE, marginRight: 12 }}>
      <View
        style={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: BORDER,
        }}
      >
        {!loaded ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
            <SkeletonBox width={PREVIEW_SIZE} height={PREVIEW_SIZE} style={{ borderRadius: 14 }} />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={GREEN} size="small" />
            </View>
          </View>
        ) : null}

        <Image
          source={{ uri: item.uri }}
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />

        {item.type === "video" ? (
          <View
            style={{
              position: "absolute",
              left: 8,
              bottom: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: T.mediaOverlay,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Ionicons name="play" size={12} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Video</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: T.mediaOverlay,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function CreatePostScreen() {
  const { T, BG, SURFACE, SURFACE_ALT, GREEN, TEXT, MUTED, PUBLISH_DIM, BORDER, ON_GREEN } = usePostColors();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const { backendUser, isSignedIn } = useBackendAuth();

  const [content, setContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [textAlign, setTextAlign] = useState("left");
  const [media, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [mentions, setMentions] = useState([]);
  const [taggedTeams, setTaggedTeams] = useState([]);
  const [taggedTournaments, setTaggedTournaments] = useState([]);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pickerMode, setPickerMode] = useState(null); // 'team' | 'tournament' | null
  const inputRef = useRef(null);

  const { people, teams, tournaments } = usePostTagOptions(isSignedIn);

  const activeTrigger = useMemo(
    () => getActiveTrigger(content, selection.start),
    [content, selection.start],
  );

  const mentionSuggestions = useMemo(() => {
    if (!activeTrigger || activeTrigger.trigger !== "@") return [];
    return filterMentionSuggestions(people, activeTrigger.query);
  }, [activeTrigger, people]);

  const hashtagSuggestions = useMemo(() => {
    if (!activeTrigger || activeTrigger.trigger !== "#") return [];
    return filterHashtagSuggestions(SUGGESTED_HASHTAGS, activeTrigger.query);
  }, [activeTrigger]);

  const canPublish = useMemo(
    () => Boolean(content.trim() || media.length) && !pickingMedia,
    [content, media.length, pickingMedia],
  );

  const toolbarPadBottom = keyboardInset > 0 ? 10 : Math.max(insets.bottom, 10);
  const showMediaSection = media.length > 0 || pickingMedia;

  const cycleAlign = () => {
    const idx = ALIGN_CYCLE.indexOf(textAlign);
    setTextAlign(ALIGN_CYCLE[(idx + 1) % ALIGN_CYCLE.length]);
  };

  const pickMedia = async () => {
    try {
      const allowed = await ensurePhotoLibraryAccess();
      if (!allowed) {
        showToast("Allow photo library access to attach media", "warning");
        return;
      }

      const remaining = MAX_MEDIA - media.length;
      if (remaining <= 0) {
        showToast(`You can add up to ${MAX_MEDIA} files`, "warning");
        return;
      }

      setPickingMedia(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        allowsEditing: false,
        quality: 0.55,
        videoMaxDuration: 120,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const next = result.assets.map((asset, index) => {
        const mime = (asset.mimeType || asset.type || "").toLowerCase();
        const isVideo = mime.includes("video") || asset.type === "video";
        return {
          id: `${asset.assetId || asset.uri}-${Date.now()}-${index}`,
          uri: asset.uri,
          mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          type: isVideo ? "video" : "image",
          name:
            asset.fileName ||
            `${isVideo ? "video" : "image"}-${Date.now()}-${index}.${isVideo ? "mp4" : "jpg"}`,
        };
      });

      setMedia((prev) => [...prev, ...next].slice(0, MAX_MEDIA));
    } catch {
      showToast("Could not open gallery", "error");
    } finally {
      setPickingMedia(false);
    }
  };

  const removeMedia = (id) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const insertMention = (person) => {
    if (!activeTrigger) return;
    const next = replaceTriggerRange(
      content,
      activeTrigger.start,
      selection.start,
      `@${person.username}`,
    );
    setContent(next);
    setMentions((prev) => {
      if (prev.some((m) => m.userId === person.userId)) return prev;
      return [...prev, { userId: person.userId, username: person.username }];
    });
    const cursor = activeTrigger.start + person.username.length + 2;
    setSelection({ start: cursor, end: cursor });
  };

  const insertHashtag = (tag) => {
    if (!activeTrigger) return;
    const next = replaceTriggerRange(
      content,
      activeTrigger.start,
      selection.start,
      `#${tag}`,
    );
    setContent(next);
    const cursor = activeTrigger.start + tag.length + 2;
    setSelection({ start: cursor, end: cursor });
  };

  const insertAtCursor = (snippet) => {
    const start = selection.start ?? content.length;
    const end = selection.end ?? start;
    const next = `${content.slice(0, start)}${snippet}${content.slice(end)}`;
    setContent(next);
    const cursor = start + snippet.length;
    setSelection({ start: cursor, end: cursor });
  };

  const toggleTeamTag = (team) => {
    setTaggedTeams((prev) => {
      if (prev.some((t) => t.teamId === team.teamId)) {
        return prev.filter((t) => t.teamId !== team.teamId);
      }
      return [...prev, team].slice(0, 8);
    });
  };

  const toggleTournamentTag = (tournament) => {
    setTaggedTournaments((prev) => {
      if (prev.some((t) => t.tournamentId === tournament.tournamentId)) {
        return prev.filter((t) => t.tournamentId !== tournament.tournamentId);
      }
      return [...prev, tournament].slice(0, 8);
    });
  };

  const submit = async () => {
    if (!isSignedIn) {
      showToast("Sign in to post", "warning");
      return;
    }
    if (!canPublish || submitting) return;

    setSubmitting(true);
    try {
      const { mentionCount, hashtagCount } = countTagsInContent(content);
      if (mentionCount > MAX_MENTIONS_PER_POST) {
        showToast(`You can mention up to ${MAX_MENTIONS_PER_POST} people`, "warning");
        setSubmitting(false);
        return;
      }
      if (hashtagCount > MAX_HASHTAGS_PER_POST) {
        showToast(`You can use up to ${MAX_HASHTAGS_PER_POST} hashtags`, "warning");
        setSubmitting(false);
        return;
      }

      await createCommunityPostAPI({
        content: content.trim(),
        authorName: backendUser?.username || backendUser?.fullname || backendUser?.name || "",
        authorAvatar:
          backendUser?.profilePicture ||
          backendUser?.profileImage ||
          backendUser?.avatar ||
          "",
        allowComments,
        textAlign,
        media,
        mentions: mentions.slice(0, MAX_MENTIONS_PER_POST),
        taggedTeams,
        taggedTournaments,
      });
      try {
        await unlockBadges("first_post");
      } catch {
        // non-blocking
      }
      try {
        await recordStreakActivity();
        await pingStreakAPI("create_post");
      } catch {
        // non-blocking — server also records via post-service
      }
      showToast("Post published", "success");
      router.replace({ pathname: "/posts", params: { backTo: backTo || "/(tabs)" } });
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || "Failed to publish", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG, marginBottom: keyboardInset }}>
      <StatusBar barStyle={T.statusBar} backgroundColor={BG} />
      <View style={{ paddingTop: insets.top, backgroundColor: BG }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, "/posts")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={TEXT} />
          </TouchableOpacity>

          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: "700",
              color: TEXT,
              marginHorizontal: 8,
            }}
          >
            Add Post
          </Text>

          <TouchableOpacity
            onPress={submit}
            disabled={!canPublish || submitting}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ minWidth: 78, alignItems: "flex-end" }}
          >
            {submitting ? (
              <ActivityIndicator color={GREEN} size="small" />
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                  color: canPublish ? GREEN : PUBLISH_DIM,
                }}
              >
                PUBLISH
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <TextInput
          ref={inputRef}
          value={content}
          onChangeText={setContent}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="What's going on?"
          placeholderTextColor={MUTED}
          multiline
          autoFocus
          maxLength={5000}
          textAlign={textAlign}
          style={{
            minHeight: showMediaSection ? 120 : 200,
            maxHeight: showMediaSection ? 180 : undefined,
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: 12,
            fontSize: 17,
            lineHeight: 24,
            color: TEXT,
            textAlignVertical: "top",
          }}
        />

        {(mentionSuggestions.length > 0 || hashtagSuggestions.length > 0) && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: BORDER,
              backgroundColor: SURFACE,
              overflow: "hidden",
              maxHeight: 220,
            }}
          >
            {mentionSuggestions.map((p) => (
              <TouchableOpacity
                key={p.userId}
                onPress={() => insertMention(p)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                }}
              >
                <Text style={{ color: TEXT, fontWeight: "600" }}>@{p.username}</Text>
                {p.displayName && p.displayName !== p.username ? (
                  <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
            {hashtagSuggestions.map((h) => (
              <TouchableOpacity
                key={h}
                onPress={() => insertHashtag(h)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                }}
              >
                <Text style={{ color: TEXT, fontWeight: "600" }}>#{h}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTrigger?.trigger === "@" &&
        (activeTrigger.query || "").length === 0 ? (
          <Text
            style={{
              color: MUTED,
              fontSize: 12,
              paddingHorizontal: 18,
              marginBottom: 8,
            }}
          >
            Keep typing a name to find someone…
          </Text>
        ) : null}

        {(taggedTeams.length > 0 || taggedTournaments.length > 0) && (
          <PostTagChips
            taggedTeams={taggedTeams}
            taggedTournaments={taggedTournaments}
            colors={{
              chipBg: SURFACE,
              chipBorder: BORDER,
              chipText: TEXT,
              accent: GREEN,
            }}
            onPressTeam={(t) => toggleTeamTag(t)}
            onPressTournament={(t) => toggleTournamentTag(t)}
          />
        )}

        {showMediaSection ? (
          <View style={{ marginTop: 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "700" }}>
                {pickingMedia && !media.length
                  ? "Loading media…"
                  : `${media.length} selected`}
              </Text>
              {media.length > 0 && !pickingMedia ? (
                <TouchableOpacity onPress={() => setMedia([])} hitSlop={8}>
                  <Text style={{ color: GREEN, fontSize: 13, fontWeight: "600" }}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            >
              {pickingMedia
                ? Array.from({ length: Math.min(4, Math.max(2, MAX_MEDIA - media.length)) }).map(
                    (_, i) => (
                      <View key={`sk-${i}`} style={{ marginRight: 12, width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
                        <SkeletonBox width={PREVIEW_SIZE} height={PREVIEW_SIZE} />
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ActivityIndicator color={GREEN} size="small" />
                        </View>
                      </View>
                    ),
                  )
                : null}

              {media.map((item) => (
                <MediaPreviewCard key={item.id} item={item} onRemove={removeMedia} />
              ))}

              {!pickingMedia && media.length < MAX_MEDIA ? (
                <TouchableOpacity
                  onPress={pickMedia}
                  activeOpacity={0.85}
                  style={{
                    width: PREVIEW_SIZE,
                    height: PREVIEW_SIZE,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: T.borderStrong,
                    borderStyle: "dashed",
                    backgroundColor: SURFACE,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <MaterialIcons name="add-photo-alternate" size={28} color={GREEN} />
                  <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600" }}>Add more</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: toolbarPadBottom,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          backgroundColor: BG,
        }}
      >
        <TouchableOpacity
          onPress={() => setAllowComments((v) => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          activeOpacity={0.8}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 3,
              backgroundColor: allowComments ? GREEN : "transparent",
              borderWidth: allowComments ? 0 : 2,
              borderColor: GREEN,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {allowComments ? <Ionicons name="checkmark" size={16} color={ON_GREEN} /> : null}
          </View>
          <Text style={{ color: TEXT, fontSize: 15, fontWeight: "500" }}>Allow Comments</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <TouchableOpacity
            onPress={() => insertAtCursor("@")}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Text style={{ color: GREEN, fontSize: 18, fontWeight: "800" }}>@</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => insertAtCursor("#")}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Text style={{ color: GREEN, fontSize: 18, fontWeight: "800" }}>#</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPickerMode("team")}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons name="people-outline" size={22} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPickerMode("tournament")}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons name="trophy-outline" size={21} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleAlign} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name={ALIGN_ICON[textAlign]} size={24} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickMedia}
            disabled={pickingMedia}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {pickingMedia ? (
              <ActivityIndicator color={GREEN} size="small" />
            ) : (
              <MaterialIcons name="photo-library" size={24} color={GREEN} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={Boolean(pickerMode)}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerMode(null)}
      >
        <Pressable
          onPress={() => setPickerMode(null)}
          style={{
            flex: 1,
            backgroundColor: T.overlay,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              maxHeight: "62%",
              backgroundColor: BG,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderWidth: 1,
              borderColor: BORDER,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View
              style={{
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: TEXT, fontSize: 17, fontWeight: "800" }}>
                {pickerMode === "team" ? "Tag a team" : "Tag a tournament"}
              </Text>
              <TouchableOpacity onPress={() => setPickerMode(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerMode === "team" ? teams : tournaments}
              keyExtractor={(item) =>
                pickerMode === "team" ? item.teamId : item.tournamentId
              }
              ListEmptyComponent={
                <Text
                  style={{
                    color: MUTED,
                    textAlign: "center",
                    paddingVertical: 28,
                    paddingHorizontal: 24,
                  }}
                >
                  {pickerMode === "team"
                    ? "No teams yet — create or join a team first."
                    : "No tournaments found for your teams."}
                </Text>
              }
              renderItem={({ item }) => {
                const selected =
                  pickerMode === "team"
                    ? taggedTeams.some((t) => t.teamId === item.teamId)
                    : taggedTournaments.some(
                        (t) => t.tournamentId === item.tournamentId,
                      );
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (pickerMode === "team") toggleTeamTag(item);
                      else toggleTournamentTag(item);
                    }}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTopWidth: 1,
                      borderTopColor: BORDER,
                    }}
                  >
                    <Text style={{ color: TEXT, fontSize: 15, fontWeight: "600", flex: 1 }}>
                      {pickerMode === "team" ? item.teamName : item.tournamentName}
                    </Text>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={selected ? GREEN : MUTED}
                    />
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => setPickerMode(null)}
              style={{
                marginHorizontal: 18,
                marginTop: 10,
                height: 44,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: GREEN,
              }}
            >
              <Text style={{ color: ON_GREEN, fontWeight: "800" }}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
