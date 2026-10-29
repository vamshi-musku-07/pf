import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  Modal,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { showToast } from "@/context/ToastContext";
import { goBackTo, BACK_TO_HOME } from "@/lib/navigationBack";
import { recordStreakActivity } from "@/lib/streakStore";
import { pingStreakAPI } from "@/services/StreakApi";
import {
  listCommunityPostsAPI,
  toggleCommunityPostLikeAPI,
  deleteCommunityPostAPI,
  updateCommunityPostAPI,
  followTargetAPI,
  unfollowTargetAPI,
  getFollowStatusAPI,
  hideCommunityContentAPI,
} from "@/services/CommunityPostApi";
import { useFeedAuthorScope } from "@/hooks/useFeedAuthorScope";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import AvatarRoleBadge from "@/components/AvatarRoleBadge";
import { getRoleById } from "@/lib/roleBadges";
import {
  formatKudosLabel,
  buildRecentLikers,
  optimisticRecentLikers,
} from "@/lib/communityKudos";
import { useCommunityPostTheme } from "@/lib/communityPostTheme";
import MediaLightbox from "@/components/community/MediaLightbox";
import PostRichText from "@/components/community/PostRichText";
import PostTagChips from "@/components/community/PostTagChips";
import PostOptionsSheet from "@/components/community/PostOptionsSheet";
import { collapseCaptionForPreview } from "@/lib/postTags";

const MAX_MEDIA = 12;
const EDIT_PREVIEW = 72;
const KUDOS_AVATAR = 22;
const SCREEN_W = Dimensions.get("window").width;
const MEDIA_W = Math.round(SCREEN_W * 0.58);
const MEDIA_H = Math.round(MEDIA_W * 1.35);
const FEED_TABS = [
  { id: "discover", label: "Discover" },
  { id: "following", label: "Following" },
];

const DEFAULT_AVATAR = require("../../assets/images/default_profile.webp");

function usePostColors() {
  const T = useCommunityPostTheme();
  return {
    T,
    BG: T.bg,
    POST_BG: T.surface,
    TEXT: T.text,
    MUTED: T.muted,
    GREEN: T.green,
    AVATAR_BORDER: T.avatarBorder,
    BORDER: T.border,
    SKELETON: T.skeleton,
    MENU_BG: T.menuBg,
    INPUT_BG: T.inputBg,
    DANGER: T.danger,
    ON_GREEN: T.onGreen,
  };
}

function KudosSummaryRow({
likedByMe,
  likeCount,
  recentLikers = [],
  commentCount = 0,
  allowComments = true,
  onPressComments,
}) {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();

  const label = formatKudosLabel({ likedByMe, likeCount });
  const stack = (recentLikers || []).slice(0, 3);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginTop: 12,
        gap: 8,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 }}>
        {likeCount > 0 && stack.length > 0 ? (
          <View style={{ flexDirection: "row", marginRight: 8, paddingLeft: 2 }}>
            {stack.map((liker, index) => (
              <View
                key={String(liker.id || index)}
                style={{
                  marginLeft: index === 0 ? 0 : -8,
                  zIndex: stack.length - index,
                  borderWidth: 1.5,
                  borderColor: BG,
                  borderRadius: KUDOS_AVATAR / 2,
                  overflow: "hidden",
                  width: KUDOS_AVATAR,
                  height: KUDOS_AVATAR,
                  backgroundColor: SKELETON,
                }}
              >
                <Image
                  source={liker.avatar?.trim() ? { uri: liker.avatar } : DEFAULT_AVATAR}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>
        ) : null}
        <Text style={{ color: TEXT, fontSize: 13, flexShrink: 1 }} numberOfLines={2}>
          {label}
        </Text>
      </View>

      {allowComments !== false ? (
        <TouchableOpacity onPress={onPressComments} hitSlop={6}>
          <Text style={{ color: TEXT, fontSize: 13 }}>
            {commentCount} comment{commentCount === 1 ? "" : "s"}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: MUTED, fontSize: 13 }}>Comments off</Text>
      )}
    </View>
  );
}

const resolveAuthorAvatar = (post, profileMap = {}, me = null) => {
  if (post?.authorAvatar && String(post.authorAvatar).trim()) {
    return String(post.authorAvatar).trim();
  }
  const id = String(post?.authorId || "");
  const fromMap =
    profileMap[id]?.profilePicture ||
    profileMap[id]?.profileImage ||
    "";
  if (fromMap) return fromMap;
  const myId = String(me?._id || me?.id || me?.userId || "");
  if (id && myId && id === myId) {
    return me?.profilePicture || me?.profileImage || me?.avatar || "";
  }
  return "";
};

const resolveAuthorRole = (post, profileMap = {}, me = null) => {
  const id = String(post?.authorId || "");
  const fromMap = profileMap[id]?.profileRole;
  if (fromMap && getRoleById(fromMap)) return fromMap;
  const myId = String(me?._id || me?.id || me?.userId || "");
  if (id && myId && id === myId && me?.profileRole && getRoleById(me.profileRole)) {
    return me.profileRole;
  }
  return null;
};

const isVideoMedia = (m) => {
  if (!m) return false;
  if (m.type === "video") return true;
  const mime = String(m.mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  const url = String(m.url || "").toLowerCase();
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
};

const formatDuration = (seconds) => {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatRelativeDay = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday - startThat) / 86400000);
  if (diffDays === 0) {
    const time = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Today at ${time}`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function FeedSkeleton() {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();

  return (
    <View style={{ paddingTop: 8 }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            marginHorizontal: 12,
            marginBottom: 12,
            paddingVertical: 16,
            borderRadius: 16,
            backgroundColor: POST_BG,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: SKELETON }} />
            <View style={{ marginLeft: 12, flex: 1, gap: 8 }}>
              <View style={{ width: 120, height: 12, borderRadius: 4, backgroundColor: SKELETON }} />
              <View style={{ width: 64, height: 10, borderRadius: 4, backgroundColor: SKELETON }} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 14 }}>
            <View style={{ width: "88%", height: 18, borderRadius: 4, backgroundColor: SKELETON }} />
            <View style={{ width: "70%", height: 12, borderRadius: 4, backgroundColor: SKELETON }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
            <View style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 16, backgroundColor: SKELETON, marginRight: 10 }} />
            <View style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 16, backgroundColor: SKELETON }} />
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function FeedImageCard({ url, style, onPress }) {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();

  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[style, { backgroundColor: SKELETON, overflow: "hidden" }]}
    >
      {!loaded ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
            backgroundColor: SKELETON,
          }}
        >
          <ActivityIndicator color={GREEN} />
        </View>
      ) : null}
      <Image
        source={{ uri: url }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        recyclingKey={url}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </TouchableOpacity>
  );
}

function FeedVideoCard({ url, style, onPress }) {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();

  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const player = useVideoPlayer(url || "", (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!url) return undefined;
    player.muted = muted;
  }, [muted, player, url]);

  useEffect(() => {
    if (!url) return undefined;
    const status = player.addListener("statusChange", ({ status: s, error }) => {
      if (s === "readyToPlay") {
        setReady(true);
        setDuration(player.duration || 0);
      }
      if (s === "error" || error) setFailed(true);
    });
    return () => status.remove();
  }, [player, url]);

  if (failed) {
    return (
      <View style={[style, { backgroundColor: SKELETON, alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="videocam-off-outline" size={28} color={MUTED} />
        <Text style={{ color: MUTED, marginTop: 8, fontSize: 12 }}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[style, { backgroundColor: T.videoBg, overflow: "hidden" }]}
    >
      {!ready ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            backgroundColor: SKELETON,
          }}
        >
          <ActivityIndicator color={GREEN} />
        </View>
      ) : null}

      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={false}
      />

      <View
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          backgroundColor: T.overlay,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ color: TEXT, fontSize: 11, fontWeight: "700" }}>
          {formatDuration(duration)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={(e) => {
          e?.stopPropagation?.();
          setMuted((v) => !v);
        }}
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: T.mediaOverlay,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 3,
        }}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color={TEXT} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function MediaCarousel({ media, postId }) {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();
  const [lightboxItem, setLightboxItem] = useState(null);

  if (!media?.length) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={MEDIA_W + 10}
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 16 }}
        style={{ marginTop: 14 }}
      >
        {media.map((m, idx) => {
          const video = isVideoMedia(m);
          const cardStyle = {
            width: MEDIA_W,
            height: MEDIA_H,
            borderRadius: 16,
            marginRight: idx === media.length - 1 ? 0 : 10,
          };
          const open = () =>
            setLightboxItem({
              url: m.url,
              type: video ? "video" : "image",
              mimeType: m.mimeType,
            });
          return video ? (
            <FeedVideoCard
              key={`${postId}-m-${idx}`}
              url={m.url}
              style={cardStyle}
              onPress={open}
            />
          ) : (
            <FeedImageCard
              key={`${postId}-m-${idx}`}
              url={m.url}
              style={cardStyle}
              onPress={open}
            />
          );
        })}
      </ScrollView>
      <MediaLightbox
        visible={Boolean(lightboxItem)}
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
      />
    </>
  );
}

function FeedTabBar({ activeTab, onChange }) {
  const { TEXT, MUTED, BORDER } = usePostColors();

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 12,
        marginBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}
    >
      {FEED_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: active ? TEXT : "transparent",
              marginBottom: -1,
            }}
          >
            <Text
              style={{
                color: active ? TEXT : MUTED,
                fontWeight: active ? "700" : "500",
                fontSize: 15,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FeedPostCard({
  item,
  isOwn,
  onPressAuthor,
  onToggleKudos,
  onDelete,
  onEdit,
  onOpenComments,
  onOpenOptions,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}) {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const media = useMemo(() => {
    if (item.media?.length) return item.media;
    if (item.imageUrl) return [{ type: "image", url: item.imageUrl }];
    return [];
  }, [item.media, item.imageUrl]);

  const caption = String(item.content || "").trim();
  const collapsed = useMemo(
    () => collapseCaptionForPreview(caption, { maxChars: 160 }),
    [caption],
  );
  const shownCaption = expanded ? caption : collapsed.preview;
  const showMore = !expanded && (collapsed.truncated || collapsed.hiddenTagCount > 0);

  // Instagram-like link accent (works on light + dark)
  const linkColor = T.bg === "#000000" ? "#7DD3FC" : "#2563EB";

  const likeCount = item.likeCount || 0;
  const liked = Boolean(item.likedByMe);
  const commentCount = item.commentCount || 0;

  const onShare = async () => {
    try {
      await Share.share({
        message: caption || "Check out this post on PlayFlash",
      });
    } catch {
      // user cancelled
    }
  };

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 12,
        paddingTop: 16,
        paddingBottom: 8,
        borderRadius: 16,
        backgroundColor: POST_BG,
        borderWidth: 1,
        borderColor: BORDER,
        overflow: "visible",
        zIndex: menuOpen ? 20 : 1,
        shadowColor: T.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, zIndex: 2 }}>
        <TouchableOpacity
          onPress={() => onPressAuthor?.(item)}
          activeOpacity={0.75}
          style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <View
            style={{
              width: 43,
              height: 43,
              marginRight: 2,
              marginBottom: 2,
              position: "relative",
              overflow: "visible",
            }}
          >
            <View
              style={{
                width: 43,
                height: 43,
                borderRadius: 23,
                borderWidth: 1,
                borderColor: AVATAR_BORDER,
                overflow: "hidden",
                backgroundColor: SKELETON,
              }}
            >
              <Image
                source={
                  item.authorAvatar && String(item.authorAvatar).trim()
                    ? { uri: item.authorAvatar }
                    : DEFAULT_AVATAR
                }
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
            <AvatarRoleBadge
              roleId={item.authorRole}
              size={16}
              bordered
              style={{ right: -4, bottom: -4 }}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: TEXT, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
              {item.authorName || "Player"}
            </Text>
            <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
              {formatRelativeDay(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        {isOwn ? (
          <View style={{ position: "relative" }}>
            <TouchableOpacity
              onPress={() => onToggleMenu?.(item._id)}
              hitSlop={12}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: menuOpen ? T.surfaceAlt : "transparent",
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={TEXT} />
            </TouchableOpacity>

            {menuOpen ? (
              <View
                style={{
                  position: "absolute",
                  top: 40,
                  right: 0,
                  minWidth: 148,
                  backgroundColor: MENU_BG,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: BORDER,
                  paddingVertical: 6,
                  shadowColor: T.shadow,
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 8,
                  zIndex: 50,
                }}
              >
                <TouchableOpacity
                  onPress={() => onEdit?.(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="create-outline" size={18} color={TEXT} />
                  <Text style={{ color: TEXT, fontSize: 15, fontWeight: "600" }}>Edit</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER, marginHorizontal: 10 }} />
                <TouchableOpacity
                  onPress={() => onDelete?.(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={18} color={DANGER} />
                  <Text style={{ color: DANGER, fontSize: 15, fontWeight: "600" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onOpenOptions?.(item)}
            hitSlop={12}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={TEXT} />
          </TouchableOpacity>
        )}
      </View>

      {/* Title + body */}
      {caption ? (
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <PostRichText
            content={shownCaption}
            style={{
              color: TEXT,
              fontSize: 15,
              lineHeight: 22,
              textAlign: item.textAlign || "left",
              fontWeight: "400",
            }}
            mentionStyle={{ color: linkColor, fontWeight: "600" }}
            hashtagStyle={{ color: linkColor, fontWeight: "600" }}
            onPressMention={(username) => {
              const hit = (item.mentions || []).find(
                (m) =>
                  String(m.username || "").toLowerCase() ===
                  String(username || "").toLowerCase(),
              );
              if (hit?.userId) {
                router.push({
                  pathname: `/user/${hit.userId}`,
                  params: { backTo: "/posts", name: hit.username || username },
                });
              }
            }}
          />
          {showMore ? (
            <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={8}>
              <Text style={{ color: MUTED, fontSize: 15, marginTop: 2, fontWeight: "500" }}>
                more
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {(item.taggedTeams?.length > 0 || item.taggedTournaments?.length > 0) && (
        <PostTagChips
          taggedTeams={item.taggedTeams}
          taggedTournaments={item.taggedTournaments}
          colors={{
            chipBg: T.surfaceAlt,
            chipBorder: BORDER,
            chipText: TEXT,
            accent: GREEN,
          }}
          onPressTeam={(t) => {
            if (t?.teamId) {
              router.push({ pathname: `/team/${t.teamId}`, params: { backTo: "/posts" } });
            }
          }}
          onPressTournament={(t) => {
            if (t?.tournamentId) {
              router.push({
                pathname: `/tournament/${t.tournamentId}`,
                params: { backTo: "/posts" },
              });
            }
          }}
        />
      )}

      <MediaCarousel media={media} postId={item._id} />

      {/* Counts */}
      <KudosSummaryRow
        likedByMe={liked}
        likeCount={likeCount}
        recentLikers={item.recentLikers}
        commentCount={commentCount}
        allowComments={item.allowComments !== false}
        onPressComments={() => onOpenComments?.(item)}
      />

      {/* Actions */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          marginTop: 10,
          paddingTop: 6,
        }}
      >
        <TouchableOpacity
          onPress={() => onToggleKudos?.(item)}
          style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}
          hitSlop={6}
        >
          <Ionicons
            name={liked ? "thumbs-up" : "thumbs-up-outline"}
            size={24}
            color={liked ? GREEN : TEXT}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (item.allowComments === false) {
              showToast("Comments are turned off for this post", "warning");
              return;
            }
            onOpenComments?.(item);
          }}
          disabled={item.allowComments === false}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: 10,
            opacity: item.allowComments === false ? 0.35 : 1,
          }}
          hitSlop={6}
        >
          <Ionicons
            name="chatbubble-outline"
            size={23}
            color={item.allowComments === false ? MUTED : TEXT}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShare}
          style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}
          hitSlop={6}
        >
          <Ionicons name="share-social-outline" size={24} color={TEXT} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PostsScreen() {
  const { T, BG, POST_BG, TEXT, MUTED, GREEN, AVATAR_BORDER, BORDER, SKELETON, MENU_BG, INPUT_BG, DANGER, ON_GREEN } = usePostColors();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const { backendUser, isSignedIn } = useBackendAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedTab, setFeedTab] = useState("discover");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [optionsPost, setOptionsPost] = useState(null);
  const [followingMap, setFollowingMap] = useState({});
  const [followBusy, setFollowBusy] = useState(false);
  const [hideBusy, setHideBusy] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMedia, setEditMedia] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editPicking, setEditPicking] = useState(false);
  const kudosInFlight = useRef(new Set());
  const loadSeqRef = useRef(0);
  const lastDiscoverLoadRef = useRef(0);

  const myId = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");
  const { followedCount, ready: scopeReady, refreshScope } =
    useFeedAuthorScope(isSignedIn);

  const closeMenu = useCallback(() => setMenuOpenId(null), []);

  const mediaFromPost = (post) => {
    const list =
      post?.media?.length > 0
        ? post.media
        : post?.imageUrl
          ? [{ type: "image", url: post.imageUrl }]
          : [];
    return list.map((m, i) => ({
      id: `existing-${m.url || i}`,
      url: m.url,
      type: m.type === "video" ? "video" : "image",
      mimeType: m.mimeType || (m.type === "video" ? "video/mp4" : "image/jpeg"),
      isExisting: true,
    }));
  };

  const loadPosts = useCallback(async ({ soft = false, tab = feedTab } = {}) => {
    const seq = ++loadSeqRef.current;
    if (!soft) setLoading(true);
    try {
      // Following with zero follows → empty feed (do not fall back to global)
      if (tab === "following" && followedCount === 0) {
        if (seq !== loadSeqRef.current) return;
        setPosts([]);
        return;
      }

      const params = { page: 1, limit: 30, feed: tab };

      const res = await listCommunityPostsAPI(params);
      if (seq !== loadSeqRef.current) return;

      let items = res?.data || [];
      // Newest posts first (safety if server order drifts)
      items = [...items].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );

      const authorIds = [
        ...new Set(items.map((p) => String(p.authorId || "")).filter(Boolean)),
      ];
      const likerIds = [
        ...new Set(
          items.flatMap((p) => (p.recentLikerIds || []).map(String)).filter(Boolean),
        ),
      ];
      const batchIds = [...new Set([...authorIds, ...likerIds])];
      let profileMap = {};
      if (batchIds.length) {
        try {
          profileMap = (await getUsersByIdsAPI(batchIds)) || {};
        } catch {
          profileMap = {};
        }
      }
      if (seq !== loadSeqRef.current) return;

      const myIdLocal = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");

      items = items.map((p) => ({
        ...p,
        authorName:
          p.authorName ||
          profileMap[String(p.authorId)]?.username ||
          profileMap[String(p.authorId)]?.fullname ||
          "Player",
        authorAvatar: resolveAuthorAvatar(p, profileMap, backendUser),
        authorRole: resolveAuthorRole(p, profileMap, backendUser),
        recentLikers: buildRecentLikers(
          p.recentLikerIds || [],
          profileMap,
          backendUser,
          myIdLocal,
        ),
      }));

      // Batch follow status for other authors (for Follow Options sheet)
      const otherAuthorIds = [
        ...new Set(
          items
            .map((p) => String(p.authorId || ""))
            .filter((id) => id && id !== myIdLocal),
        ),
      ];
      if (otherAuthorIds.length) {
        try {
          const targets = otherAuthorIds.map((id) => `user:${id}`).join(",");
          const statusRes = await getFollowStatusAPI(targets);
          const data = statusRes?.data || statusRes || {};
          setFollowingMap((prev) => {
            const next = { ...prev };
            otherAuthorIds.forEach((id) => {
              next[id] = Boolean(data[`user:${id}`]);
            });
            return next;
          });
        } catch {
          // keep existing map
        }
      }

      setPosts(items);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      showToast(error?.response?.data?.message || "Failed to load posts", "error");
      setPosts([]);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [backendUser, feedTab, followedCount]);

  // Discover / default: load once per tab focus — do not wait on follow-scope
  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) {
        setLoading(false);
        setPosts([]);
        return;
      }
      if (feedTab === "following") return;
      const now = Date.now();
      // Guard Strict Mode / rapid remount double-invoke
      if (now - lastDiscoverLoadRef.current < 400) return;
      lastDiscoverLoadRef.current = now;
      loadPosts({ tab: feedTab });
    }, [isSignedIn, feedTab, loadPosts]),
  );

  // Following: wait until follow list is ready, then load (or show empty)
  const followingKeyRef = useRef("");
  useEffect(() => {
    if (!isSignedIn || feedTab !== "following" || !scopeReady) return;
    const key = `follows:${followedCount}`;
    if (followingKeyRef.current === key) return;
    followingKeyRef.current = key;
    setPosts([]);
    loadPosts({ tab: "following" });
  }, [isSignedIn, feedTab, scopeReady, followedCount, loadPosts]);

  // Clear previous tab bleed when switching feeds
  useEffect(() => {
    setPosts([]);
    setLoading(true);
    if (feedTab === "discover" && isSignedIn) {
      loadPosts({ tab: "discover" });
    }
  }, [feedTab]); // eslint-disable-line react-hooks/exhaustive-deps — intentional tab-switch reset

  useEffect(() => {
    if (feedTab !== "following") followingKeyRef.current = "";
  }, [feedTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (feedTab === "following") {
      await refreshScope();
    }
    await loadPosts({ soft: true });
  };

  const onToggleKudos = async (post) => {
    if (!post?._id) return;
    const id = String(post._id);
    if (kudosInFlight.current.has(id)) return;
    kudosInFlight.current.add(id);

    const wasLiked = Boolean(post.likedByMe);
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, (post.likeCount || 0) + (nextLiked ? 1 : -1));

    // Optimistic UI first
    setPosts((list) =>
      list.map((p) =>
        String(p._id) === id
          ? {
              ...p,
              likedByMe: nextLiked,
              likeCount: nextCount,
              recentLikers: optimisticRecentLikers({
                recentLikers: p.recentLikers,
                likedByMe: nextLiked,
                me: backendUser,
                viewerId: myId,
              }),
              recentLikerIds: nextLiked
                ? [myId, ...(p.recentLikerIds || []).filter((x) => String(x) !== myId)].slice(
                    0,
                    3,
                  )
                : (p.recentLikerIds || []).filter((x) => String(x) !== myId),
            }
          : p,
      ),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const actorName =
        backendUser?.username || backendUser?.fullname || backendUser?.name || "";
      const res = await toggleCommunityPostLikeAPI(
        id,
        actorName ? { actorName } : {},
      );
      const serverLiked = res?.data?.liked;
      const serverCount = res?.data?.likeCount;
      const next = res?.data?.post;
      if (nextLiked) {
        recordStreakActivity().catch(() => {});
        pingStreakAPI("post_kudos").catch(() => {});
      }
      setPosts((list) =>
        list.map((p) => {
          if (String(p._id) !== id) return p;
          const likedByMe =
            typeof serverLiked === "boolean" ? serverLiked : next?.likedByMe ?? p.likedByMe;
          const likeCount =
            typeof serverCount === "number" ? serverCount : next?.likeCount ?? p.likeCount;
          const recentLikerIds = next?.recentLikerIds || p.recentLikerIds || [];
          const mergedLikers = (recentLikerIds || []).map((lid) => {
            const found = (p.recentLikers || []).find((x) => String(x.id) === String(lid));
            if (found) return found;
            if (String(lid) === myId) {
              return {
                id: myId,
                avatar:
                  backendUser?.profilePicture ||
                  backendUser?.profileImage ||
                  backendUser?.avatar ||
                  "",
                name: "You",
              };
            }
            return { id: String(lid), avatar: "", name: "" };
          });
          return {
            ...p,
            likedByMe,
            likeCount,
            recentLikerIds,
            recentLikers: optimisticRecentLikers({
              recentLikers: mergedLikers,
              likedByMe,
              me: backendUser,
              viewerId: myId,
            }),
          };
        }),
      );
    } catch (error) {
      // Rollback
      setPosts((list) =>
        list.map((p) =>
          String(p._id) === id
            ? {
                ...p,
                likedByMe: wasLiked,
                likeCount: post.likeCount || 0,
                recentLikers: post.recentLikers,
                recentLikerIds: post.recentLikerIds,
              }
            : p,
        ),
      );
      showToast(error?.response?.data?.message || "Could not update kudos", "error");
    } finally {
      kudosInFlight.current.delete(id);
    }
  };

  const onDelete = (post) => {
    closeMenu();
    Alert.alert("Delete post?", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const id = String(post._id);
          const snapshot = posts;
          setPosts((list) => list.filter((p) => String(p._id) !== id));
          try {
            await deleteCommunityPostAPI(post._id);
            showToast("Post deleted", "success");
          } catch (error) {
            setPosts(snapshot);
            showToast(error?.response?.data?.message || "Failed to delete", "error");
          }
        },
      },
    ]);
  };

  const onEdit = (post) => {
    closeMenu();
    setEditingPost(post);
    setEditText(post.content || "");
    setEditMedia(mediaFromPost(post));
  };

  const onOpenOptions = useCallback((post) => {
    closeMenu();
    setOptionsPost(post);
  }, [closeMenu]);

  const closeOptions = useCallback(() => {
    if (followBusy || hideBusy) return;
    setOptionsPost(null);
  }, [followBusy, hideBusy]);

  const onToggleFollowFromSheet = useCallback(async () => {
    const authorId = String(optionsPost?.authorId || "");
    if (!authorId || followBusy) return;
    const currentlyFollowing = Boolean(followingMap[authorId]);
    setFollowBusy(true);
    try {
      if (currentlyFollowing) {
        await unfollowTargetAPI("user", authorId);
        setFollowingMap((prev) => ({ ...prev, [authorId]: false }));
        showToast(`Unfollowed ${optionsPost?.authorName || "player"}`, "success");
      } else {
        await followTargetAPI("user", authorId);
        setFollowingMap((prev) => ({ ...prev, [authorId]: true }));
        showToast(`Following ${optionsPost?.authorName || "player"}`, "success");
      }
      await refreshScope();
      setOptionsPost(null);
    } catch (error) {
      showToast(error?.response?.data?.message || "Could not update follow", "error");
    } finally {
      setFollowBusy(false);
    }
  }, [optionsPost, followBusy, followingMap, refreshScope]);

  const onHideWithReason = useCallback(
    async (reasonId) => {
      const post = optionsPost;
      if (!post?._id || hideBusy) return;
      const postId = String(post._id);
      const authorId = String(post.authorId || "");
      setHideBusy(true);
      try {
        if (reasonId === "not_interested_athlete" && authorId) {
          await hideCommunityContentAPI({
            targetType: "author",
            targetId: authorId,
            reason: reasonId,
            sourcePostId: postId,
          });
          setPosts((list) =>
            list.filter((p) => String(p.authorId) !== authorId),
          );
          setFollowingMap((prev) => ({ ...prev, [authorId]: false }));
          await refreshScope();
          showToast("Got it — we'll show fewer posts from this player", "success");
        } else {
          await hideCommunityContentAPI({
            targetType: "post",
            targetId: postId,
            reason: reasonId || "none",
            sourcePostId: postId,
          });
          setPosts((list) => list.filter((p) => String(p._id) !== postId));
          showToast("Post hidden from your feed", "success");
        }
        setOptionsPost(null);
      } catch (error) {
        showToast(error?.response?.data?.message || "Could not hide post", "error");
      } finally {
        setHideBusy(false);
      }
    },
    [optionsPost, hideBusy, refreshScope],
  );

  const closeEdit = () => {
    if (editSaving) return;
    setEditingPost(null);
    setEditText("");
    setEditMedia([]);
    setEditPicking(false);
  };

  const removeEditMedia = (id) => {
    setEditMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const pickEditMedia = async () => {
    try {
      const allowed = await ensurePhotoLibraryAccess();
      if (!allowed) {
        showToast("Allow photo library access to attach media", "warning");
        return;
      }
      const remaining = MAX_MEDIA - editMedia.length;
      if (remaining <= 0) {
        showToast(`You can add up to ${MAX_MEDIA} files`, "warning");
        return;
      }

      setEditPicking(true);
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
          id: `new-${asset.assetId || asset.uri}-${Date.now()}-${index}`,
          uri: asset.uri,
          mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          type: isVideo ? "video" : "image",
          name:
            asset.fileName ||
            `${isVideo ? "video" : "image"}-${Date.now()}-${index}.${isVideo ? "mp4" : "jpg"}`,
          isExisting: false,
        };
      });

      setEditMedia((prev) => [...prev, ...next].slice(0, MAX_MEDIA));
    } catch {
      showToast("Could not open gallery", "error");
    } finally {
      setEditPicking(false);
    }
  };

  const saveEdit = async () => {
    if (!editingPost?._id || editSaving || editPicking) return;
    const nextContent = editText.trim();
    if (!nextContent && !editMedia.length) {
      showToast("Write something or add media", "warning");
      return;
    }

    const id = String(editingPost._id);
    const snapshot = {
      content: editingPost.content || "",
      media: editingPost.media,
      imageUrl: editingPost.imageUrl,
    };
    const keepMedia = editMedia.filter((m) => m.isExisting && m.url).map((m) => m.url);
    const newMedia = editMedia.filter((m) => !m.isExisting && m.uri);
    const optimisticMedia = editMedia.map((m) =>
      m.isExisting
        ? { type: m.type, url: m.url, mimeType: m.mimeType }
        : { type: m.type, url: m.uri, mimeType: m.mimeType },
    );

    setEditSaving(true);
    setPosts((list) =>
      list.map((p) =>
        String(p._id) === id
          ? {
              ...p,
              content: nextContent,
              media: optimisticMedia,
              imageUrl: optimisticMedia.find((m) => m.type === "image")?.url || null,
            }
          : p,
      ),
    );
    setEditingPost(null);
    setEditText("");
    setEditMedia([]);
    setEditPicking(false);

    try {
      const res = await updateCommunityPostAPI(id, {
        content: nextContent,
        keepMedia,
        media: newMedia,
      });
      const updated = res?.data;
      if (updated?._id) {
        setPosts((list) =>
          list.map((p) =>
            String(p._id) === id
              ? {
                  ...p,
                  content: updated.content ?? nextContent,
                  textAlign: updated.textAlign || p.textAlign,
                  allowComments:
                    typeof updated.allowComments === "boolean"
                      ? updated.allowComments
                      : p.allowComments,
                  media: updated.media || [],
                  imageUrl: updated.imageUrl || null,
                }
              : p,
          ),
        );
      }
      showToast("Post updated", "success");
    } catch (error) {
      setPosts((list) =>
        list.map((p) =>
          String(p._id) === id
            ? {
                ...p,
                content: snapshot.content,
                media: snapshot.media,
                imageUrl: snapshot.imageUrl,
              }
            : p,
        ),
      );
      showToast(error?.response?.data?.message || error?.message || "Failed to update post", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const openCreate = () =>
    router.push({ pathname: "/create-post", params: { backTo: "/posts" } });

  const myAvatar =
    backendUser?.profilePicture ||
    backendUser?.profileImage ||
    backendUser?.avatar ||
    "";

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
          hitSlop={10}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: "/notifications", params: { backTo: "/posts" } })
            }
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: T.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="notifications-outline" size={20} color={TEXT} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.navigate("/(tabs)/settings")}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: GREEN,
              backgroundColor: SKELETON,
            }}
          >
            <Image
              source={myAvatar ? { uri: myAvatar } : DEFAULT_AVATAR}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </TouchableOpacity>
        </View>
      </View>

      {!isSignedIn ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="people-outline" size={48} color={T.iconDim} />
          <Text style={{ marginTop: 12, fontWeight: "800", color: TEXT, fontSize: 17 }}>
            Sign in to view the feed
          </Text>
        </View>
      ) : (
        <>
          <FeedTabBar activeTab={feedTab} onChange={setFeedTab} />
          {loading ? (
            <FeedSkeleton />
          ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item._id)}
          removeClippedSubviews={false}
          windowSize={5}
          maxToRenderPerBatch={4}
          initialNumToRender={3}
          onScrollBeginDrag={closeMenu}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 96,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 72, paddingHorizontal: 32 }}>
              <Ionicons
                name={feedTab === "discover" ? "compass-outline" : "people-outline"}
                size={48}
                color={T.iconDim}
              />
              <Text style={{ marginTop: 14, fontSize: 18, fontWeight: "800", color: TEXT }}>
                {feedTab === "discover" ? "No posts yet" : "Your feed is quiet"}
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  textAlign: "center",
                  color: MUTED,
                  lineHeight: 20,
                }}
              >
                {feedTab === "discover"
                  ? "Be the first to share something — tap + to create a post."
                  : "Follow players and coaches to see their posts here. Tap + to share your own."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const authorId = String(item.authorId || "");
            return (
            <FeedPostCard
              item={item}
              isOwn={Boolean(myId && authorId === myId)}
              onPressAuthor={(post) => {
                const id = String(post?.authorId || "");
                if (!id) return;
                if (myId && id === myId) {
                  router.navigate("/(tabs)/settings");
                  return;
                }
                router.push({
                  pathname: `/user/${id}`,
                  params: {
                    backTo: "/posts",
                    name: post?.authorName || "",
                    avatar: post?.authorAvatar || "",
                  },
                });
              }}
              onToggleKudos={onToggleKudos}
              onDelete={onDelete}
              onEdit={onEdit}
              onOpenOptions={onOpenOptions}
              menuOpen={String(menuOpenId) === String(item._id)}
              onToggleMenu={(id) =>
                setMenuOpenId((cur) => (String(cur) === String(id) ? null : id))
              }
              onCloseMenu={closeMenu}
              onOpenComments={(post) =>
                router.push({
                  pathname: `/post/${String(post._id)}`,
                  params: { backTo: "/posts" },
                })
              }
            />
            );
          }}
        />
          )}
        </>
      )}

      <Modal
        visible={Boolean(editingPost)}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: T.overlay,
            justifyContent: "center",
            paddingHorizontal: 18,
          }}
        >
          <Pressable
            onPress={closeEdit}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            style={{
              backgroundColor: POST_BG,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 16,
              maxHeight: "88%",
            }}
          >
            <Text style={{ color: TEXT, fontSize: 17, fontWeight: "800", marginBottom: 12 }}>
              Edit post
            </Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="What's going on?"
              placeholderTextColor={T.placeholder}
              style={{
                minHeight: 100,
                maxHeight: 160,
                color: TEXT,
                fontSize: 16,
                lineHeight: 22,
                textAlignVertical: "top",
                backgroundColor: INPUT_BG,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: BORDER,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: "600" }}>
                Media · {editMedia.length}/{MAX_MEDIA}
              </Text>
              <TouchableOpacity
                onPress={pickEditMedia}
                disabled={editPicking || editMedia.length >= MAX_MEDIA}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: T.surfaceAlt,
                  opacity: editPicking || editMedia.length >= MAX_MEDIA ? 0.5 : 1,
                }}
              >
                {editPicking ? (
                  <ActivityIndicator size="small" color={GREEN} />
                ) : (
                  <Ionicons name="images-outline" size={16} color={GREEN} />
                )}
                <Text style={{ color: GREEN, fontWeight: "700", fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {editMedia.map((item) => (
                <View key={item.id} style={{ position: "relative" }}>
                  <Image
                    source={{ uri: item.url || item.uri }}
                    style={{
                      width: EDIT_PREVIEW,
                      height: EDIT_PREVIEW,
                      borderRadius: 10,
                      backgroundColor: INPUT_BG,
                    }}
                    contentFit="cover"
                  />
                  {item.type === "video" ? (
                    <View
                      style={{
                        position: "absolute",
                        left: 6,
                        bottom: 6,
                        backgroundColor: T.mediaOverlay,
                        borderRadius: 10,
                        padding: 3,
                      }}
                    >
                      <Ionicons name="play" size={12} color="#fff" />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => removeEditMedia(item.id)}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: T.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: BORDER,
                    }}
                  >
                    <Ionicons name="close" size={14} color={TEXT} />
                  </TouchableOpacity>
                </View>
              ))}
              {!editMedia.length ? (
                <TouchableOpacity
                  onPress={pickEditMedia}
                  style={{
                    width: EDIT_PREVIEW,
                    height: EDIT_PREVIEW,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: T.borderStrong,
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: INPUT_BG,
                  }}
                >
                  <Ionicons name="add" size={28} color={MUTED} />
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={closeEdit}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: T.surfaceAlt,
                }}
              >
                <Text style={{ color: MUTED, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={editSaving || editPicking}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: GREEN,
                  opacity: editSaving || editPicking ? 0.7 : 1,
                }}
              >
                {editSaving ? (
                  <ActivityIndicator color={ON_GREEN} />
                ) : (
                  <Text style={{ color: ON_GREEN, fontWeight: "800" }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isSignedIn ? (
        <TouchableOpacity
          onPress={openCreate}
          activeOpacity={0.9}
          style={{
            position: "absolute",
            right: 18,
            bottom: Math.max(insets.bottom, 12) + 18,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: GREEN,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: GREEN,
            shadowOpacity: 0.45,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={32} color={ON_GREEN} />
        </TouchableOpacity>
      ) : null}

      <PostOptionsSheet
        visible={Boolean(optionsPost)}
        post={optionsPost}
        isFollowing={Boolean(
          optionsPost?.authorId && followingMap[String(optionsPost.authorId)],
        )}
        followBusy={followBusy}
        hideBusy={hideBusy}
        onClose={closeOptions}
        onToggleFollow={onToggleFollowFromSheet}
        onHideWithReason={onHideWithReason}
      />
    </View>
  );
}
