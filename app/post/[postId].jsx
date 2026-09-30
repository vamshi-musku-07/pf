import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Share,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { showToast } from "@/context/ToastContext";
import { goBackTo } from "@/lib/navigationBack";
import { recordStreakActivity } from "@/lib/streakStore";
import { pingStreakAPI } from "@/services/StreakApi";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import {
  getCommunityPostAPI,
  listCommunityCommentsAPI,
  createCommunityCommentAPI,
  updateCommunityCommentAPI,
  deleteCommunityCommentAPI,
  toggleCommunityPostLikeAPI,
  toggleCommunityCommentLikeAPI,
} from "@/services/CommunityPostApi";
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

const SCREEN_W = Dimensions.get("window").width;
const MEDIA_W = Math.round(SCREEN_W * 0.72);
const MEDIA_H = Math.round(MEDIA_W * 1.2);
const AVATAR = 36;
const KUDOS_AVATAR = 22;
const DEFAULT_AVATAR = require("../../assets/images/default_profile.webp");

function usePostColors() {
  const T = useCommunityPostTheme();
  return {
    T,
    BG: T.bg,
    SURFACE: T.surface,
    TEXT: T.text,
    MUTED: T.muted,
    GREEN: T.green,
    THREAD_LINE: T.threadLine,
    BORDER: T.border,
    MENU_BG: T.menuBg,
    INPUT_BG: T.inputBg,
    DANGER: T.danger,
    ON_GREEN: T.onGreen,
    SKELETON: T.skeleton,
  };
}

const patchCommentTree = (nodes, commentId, updater) =>
  nodes.map((n) => {
    if (String(n._id) === String(commentId)) return updater(n);
    if (n.replies?.length) {
      return { ...n, replies: patchCommentTree(n.replies, commentId, updater) };
    }
    return n;
  });

const appendCommentToTree = (nodes, parentId, comment) => {
  if (!parentId) return [...nodes, comment];
  return nodes.map((n) => {
    if (String(n._id) === String(parentId)) {
      return {
        ...n,
        replyCount: (n.replyCount || 0) + 1,
        replies: [...(n.replies || []), comment],
      };
    }
    if (n.replies?.length) {
      return { ...n, replies: appendCommentToTree(n.replies, parentId, comment) };
    }
    return n;
  });
};

const replaceCommentInTree = (nodes, tempId, realComment) =>
  nodes.map((n) => {
    if (String(n._id) === String(tempId)) return { ...realComment, replies: n.replies || [] };
    if (n.replies?.length) {
      return { ...n, replies: replaceCommentInTree(n.replies, tempId, realComment) };
    }
    return n;
  });

const removeCommentFromTree = (nodes, commentId) =>
  nodes
    .filter((n) => String(n._id) !== String(commentId))
    .map((n) => {
      const replies = n.replies?.length ? removeCommentFromTree(n.replies, commentId) : [];
      const removedDirect = (n.replies || []).some((r) => String(r._id) === String(commentId));
      return {
        ...n,
        replies,
        replyCount: removedDirect ? Math.max(0, (n.replyCount || 0) - 1) : n.replyCount || 0,
      };
    });

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
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const isVideoMedia = (m) => {
  if (!m) return false;
  if (m.type === "video") return true;
  const mime = String(m.mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(String(m.url || ""));
};

function KudosSummaryRow({
  likedByMe,
  likeCount,
  recentLikers = [],
  commentCount = 0,
  allowComments = true,
}) {
  const { T, BG, SURFACE, TEXT, MUTED, GREEN, THREAD_LINE, BORDER, MENU_BG, INPUT_BG, DANGER, ON_GREEN, SKELETON } = usePostColors();

  const label = formatKudosLabel({ likedByMe, likeCount });
  const stack = (recentLikers || []).slice(0, 3);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginTop: 14,
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
                  borderColor: SURFACE,
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
        <Text style={{ color: TEXT, fontSize: 13 }}>
          {commentCount} comment{commentCount === 1 ? "" : "s"}
        </Text>
      ) : (
        <Text style={{ color: MUTED, fontSize: 13 }}>Comments off</Text>
      )}
    </View>
  );
}

function FeedVideoCard({ url, style }) {
  const { T, BG, SURFACE, TEXT, MUTED, GREEN, THREAD_LINE, BORDER, MENU_BG, INPUT_BG, DANGER, ON_GREEN, SKELETON } = usePostColors();

  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(url || "", (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return (
    <View style={[style, { backgroundColor: T.videoBg, overflow: "hidden" }]}>
      <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls={false} />
      <TouchableOpacity
        onPress={() => setMuted((v) => !v)}
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: T.mediaOverlay,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={14} color={TEXT} />
      </TouchableOpacity>
    </View>
  );
}

function ThreadComment({
  comment,
  depth = 0,
  isLast,
  myId,
  menuOpenId,
  onToggleMenu,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
}) {
  const { T, BG, SURFACE, TEXT, MUTED, GREEN, THREAD_LINE, BORDER, MENU_BG, INPUT_BG, DANGER, ON_GREEN, SKELETON } = usePostColors();

  const hasReplies = Array.isArray(comment.replies) && comment.replies.length > 0;
  const indent = Math.min(depth, 5) * 14;
  const avatarUri = comment.authorAvatar?.trim() ? { uri: comment.authorAvatar } : DEFAULT_AVATAR;
  const isOwn = Boolean(myId && String(comment.authorId) === String(myId));
  const menuOpen = String(menuOpenId) === String(comment._id);

  return (
    <View style={{ paddingLeft: indent, zIndex: menuOpen ? 20 : 1 }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ width: AVATAR, alignItems: "center" }}>
          <Image
            source={avatarUri}
            style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: T.surfaceAlt }}
            contentFit="cover"
          />
          {(hasReplies || (!isLast && depth > 0)) && (
            <View
              style={{
                flex: 1,
                width: 2,
                backgroundColor: THREAD_LINE,
                marginTop: 6,
                minHeight: hasReplies ? 12 : 0,
                borderRadius: 1,
              }}
            />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 10, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: TEXT, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
              {comment.authorName || "Player"}
            </Text>
            <Text style={{ color: MUTED, fontSize: 12 }}>{formatRelativeDay(comment.createdAt)}</Text>
            {isOwn && !String(comment._id).startsWith("temp_") ? (
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  onPress={() => onToggleMenu?.(comment._id)}
                  hitSlop={10}
                  style={{
                    width: 28,
                    height: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    backgroundColor: menuOpen ? T.surfaceAlt : "transparent",
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color={MUTED} />
                </TouchableOpacity>
                {menuOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 30,
                      right: 0,
                      minWidth: 132,
                      backgroundColor: MENU_BG,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: BORDER,
                      paddingVertical: 4,
                      elevation: 12,
                      zIndex: 50,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => onEdit?.(comment)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={TEXT} />
                      <Text style={{ color: TEXT, fontWeight: "600", fontSize: 14 }}>Edit</Text>
                    </TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: BORDER, marginHorizontal: 8 }} />
                    <TouchableOpacity
                      onPress={() => onDelete?.(comment)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={DANGER} />
                      <Text style={{ color: DANGER, fontWeight: "600", fontSize: 14 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <Text style={{ color: TEXT, fontSize: 15, lineHeight: 21, marginTop: 4 }}>{comment.content}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 18 }}>
            <TouchableOpacity
              onPress={() => onToggleLike?.(comment)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={16}
                color={comment.likedByMe ? T.likeHeart : MUTED}
              />
              {comment.likeCount > 0 ? (
                <Text style={{ color: MUTED, fontSize: 12 }}>{comment.likeCount}</Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onReply?.(comment)} hitSlop={8}>
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: "600" }}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {hasReplies
        ? comment.replies.map((reply, idx) => (
            <ThreadComment
              key={String(reply._id)}
              comment={reply}
              depth={depth + 1}
              isLast={idx === comment.replies.length - 1}
              myId={myId}
              menuOpenId={menuOpenId}
              onToggleMenu={onToggleMenu}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        : null}
    </View>
  );
}

export default function PostDetailScreen() {
  const { T, BG, SURFACE, TEXT, MUTED, GREEN, THREAD_LINE, BORDER, MENU_BG, INPUT_BG, DANGER, ON_GREEN, SKELETON } = usePostColors();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const params = useLocalSearchParams();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const { backendUser, isSignedIn } = useBackendAuth();
  const inputRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [lightboxItem, setLightboxItem] = useState(null);
  const postLikeInFlight = useRef(false);
  const commentLikeInFlight = useRef(new Set());

  const myId = String(backendUser?._id || backendUser?.id || backendUser?.userId || "");
  const allowComments = post?.allowComments !== false;
  const media = useMemo(() => {
    if (post?.media?.length) return post.media;
    if (post?.imageUrl) return [{ type: "image", url: post.imageUrl }];
    return [];
  }, [post]);

  const closeCommentMenu = useCallback(() => setMenuOpenId(null), []);

  const hydrateAvatar = useCallback(
    async (item) => {
      let next = { ...item };
      try {
        if (item?.authorId) {
          const map = await getUsersByIdsAPI([String(item.authorId)]);
          const profile = map?.[String(item.authorId)] || {};
          if (!next.authorAvatar && profile.profilePicture) {
            next = { ...next, authorAvatar: profile.profilePicture };
          }
          if (profile.profileRole && getRoleById(profile.profileRole)) {
            next = { ...next, authorRole: profile.profileRole };
          }
        }
      } catch {
        // ignore
      }
      if (String(item.authorId) === myId) {
        next = {
          ...next,
          authorAvatar:
            next.authorAvatar ||
            backendUser?.profilePicture ||
            backendUser?.profileImage ||
            "",
          authorRole:
            next.authorRole ||
            (getRoleById(backendUser?.profileRole) ? backendUser.profileRole : null),
        };
      }
      return next;
    },
    [backendUser, myId],
  );

  const load = useCallback(
    async ({ soft = false } = {}) => {
      if (!postId) return;
      if (!soft) setLoading(true);
      try {
        const [postRes, commentsRes] = await Promise.all([
          getCommunityPostAPI(postId),
          listCommunityCommentsAPI(postId),
        ]);
        let rawPost = postRes?.data || null;
        if (rawPost) {
          rawPost = await hydrateAvatar(rawPost);
          const likerIds = (rawPost.recentLikerIds || []).map(String).filter(Boolean);
          let profileMap = {};
          if (likerIds.length) {
            try {
              profileMap = (await getUsersByIdsAPI(likerIds)) || {};
            } catch {
              profileMap = {};
            }
          }
          rawPost = {
            ...rawPost,
            recentLikers: buildRecentLikers(
              rawPost.recentLikerIds || [],
              profileMap,
              backendUser,
              myId,
            ),
          };
        }
        setPost(rawPost);
        setComments(commentsRes?.data?.comments || []);
      } catch (error) {
        showToast(error?.response?.data?.message || "Failed to load post", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [postId, hydrateAvatar, backendUser, myId],
  );

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    load();
  }, [isSignedIn, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load({ soft: true });
  };

  const startReply = (comment) => {
    if (!allowComments) {
      showToast("Comments are turned off for this post", "warning");
      return;
    }
    setReplyTo(comment);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const cancelReply = () => setReplyTo(null);

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || sending || !allowComments || !postId) return;

    const parentId = replyTo?._id ? String(replyTo._id) : null;
    const tempId = `temp_${Date.now()}`;
    const myName =
      backendUser?.username || backendUser?.fullname || backendUser?.name || "";
    const optimisticComment = {
      _id: tempId,
      postId,
      parentId,
      depth: replyTo ? (replyTo.depth || 0) + 1 : 0,
      authorId: myId,
      authorName: myName || "Player",
      authorAvatar:
        backendUser?.profilePicture || backendUser?.profileImage || backendUser?.avatar || "",
      content: text,
      replyCount: 0,
      likeCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      replies: [],
      pending: true,
    };

    const prevComments = comments;
    const prevPost = post;
    const prevDraft = draft;
    const prevReplyTo = replyTo;

    // Optimistic UI immediately
    setDraft("");
    setReplyTo(null);
    setComments((tree) => appendCommentToTree(tree, parentId, optimisticComment));
    setPost((p) => (p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const res = await createCommunityCommentAPI(postId, {
        content: text,
        parentId,
        // Never send "You"/"Someone" — server treats those as empty placeholders.
        ...(myName ? { authorName: myName } : {}),
        authorAvatar: optimisticComment.authorAvatar,
      });
      const real = res?.data?.comment;
      if (real?._id) {
        setComments((tree) => replaceCommentInTree(tree, tempId, { ...real, replies: [] }));
      }
      if (res?.data?.commentCount != null) {
        setPost((p) => (p ? { ...p, commentCount: res.data.commentCount } : p));
      }
      recordStreakActivity().catch(() => {});
      pingStreakAPI("comment").catch(() => {});
    } catch (error) {
      setComments(prevComments);
      setPost(prevPost);
      setDraft(prevDraft);
      setReplyTo(prevReplyTo);
      showToast(error?.response?.data?.message || "Failed to post comment", "error");
    } finally {
      setSending(false);
    }
  };

  const onTogglePostLike = async () => {
    if (!post || postLikeInFlight.current) return;
    postLikeInFlight.current = true;

    const wasLiked = Boolean(post.likedByMe);
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, (post.likeCount || 0) + (nextLiked ? 1 : -1));
    const snapshot = post;

    setPost({
      ...post,
      likedByMe: nextLiked,
      likeCount: nextCount,
      recentLikers: optimisticRecentLikers({
        recentLikers: post.recentLikers,
        likedByMe: nextLiked,
        me: backendUser,
        viewerId: myId,
      }),
      recentLikerIds: nextLiked
        ? [myId, ...(post.recentLikerIds || []).filter((x) => String(x) !== myId)].slice(0, 3)
        : (post.recentLikerIds || []).filter((x) => String(x) !== myId),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const actorName =
        backendUser?.username || backendUser?.fullname || backendUser?.name || "";
      const res = await toggleCommunityPostLikeAPI(
        post._id,
        actorName ? { actorName } : {},
      );
      const serverLiked = res?.data?.liked;
      const serverCount = res?.data?.likeCount;
      const serverPost = res?.data?.post;
      if (nextLiked) {
        recordStreakActivity().catch(() => {});
        pingStreakAPI("post_kudos").catch(() => {});
      }
      setPost((p) => {
        if (!p) return p;
        const likedByMe =
          typeof serverLiked === "boolean" ? serverLiked : p.likedByMe;
        const likeCount =
          typeof serverCount === "number" ? serverCount : p.likeCount;
        const recentLikerIds = serverPost?.recentLikerIds || p.recentLikerIds || [];
        const merged = (recentLikerIds || []).map((lid) => {
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
            recentLikers: merged,
            likedByMe,
            me: backendUser,
            viewerId: myId,
          }),
        };
      });
    } catch {
      setPost(snapshot);
      showToast("Could not update kudos", "error");
    } finally {
      postLikeInFlight.current = false;
    }
  };

  const onToggleCommentLike = async (comment) => {
    const id = String(comment._id);
    if (!id || id.startsWith("temp_") || commentLikeInFlight.current.has(id)) return;
    commentLikeInFlight.current.add(id);

    const wasLiked = Boolean(comment.likedByMe);
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, (comment.likeCount || 0) + (nextLiked ? 1 : -1));

    setComments((tree) =>
      patchCommentTree(tree, id, (n) => ({
        ...n,
        likedByMe: nextLiked,
        likeCount: nextCount,
      })),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const res = await toggleCommunityCommentLikeAPI(postId, comment._id);
      const liked = res?.data?.liked;
      const likeCount = res?.data?.likeCount;
      setComments((tree) =>
        patchCommentTree(tree, id, (n) => ({
          ...n,
          likedByMe: typeof liked === "boolean" ? liked : n.likedByMe,
          likeCount: typeof likeCount === "number" ? likeCount : n.likeCount,
        })),
      );
    } catch {
      setComments((tree) =>
        patchCommentTree(tree, id, (n) => ({
          ...n,
          likedByMe: wasLiked,
          likeCount: comment.likeCount || 0,
        })),
      );
      showToast("Could not update like", "error");
    } finally {
      commentLikeInFlight.current.delete(id);
    }
  };

  const onEditComment = (comment) => {
    closeCommentMenu();
    setEditingComment(comment);
    setEditText(comment.content || "");
  };

  const saveCommentEdit = async () => {
    if (!editingComment?._id || editSaving) return;
    const next = editText.trim();
    if (!next) {
      showToast("Comment cannot be empty", "warning");
      return;
    }
    const id = String(editingComment._id);
    const prev = editingComment.content || "";
    setEditSaving(true);
    setComments((tree) => patchCommentTree(tree, id, (n) => ({ ...n, content: next })));
    setEditingComment(null);
    setEditText("");
    try {
      const res = await updateCommunityCommentAPI(postId, id, { content: next });
      const updated = res?.data?.comment;
      if (updated?.content != null) {
        setComments((tree) =>
          patchCommentTree(tree, id, (n) => ({ ...n, content: updated.content })),
        );
      }
      showToast("Comment updated", "success");
    } catch (error) {
      setComments((tree) => patchCommentTree(tree, id, (n) => ({ ...n, content: prev })));
      showToast(error?.response?.data?.message || "Failed to update comment", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const onDeleteComment = (comment) => {
    closeCommentMenu();
    Alert.alert("Delete comment?", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const id = String(comment._id);
          const snapshot = comments;
          const prevPost = post;
          setComments((tree) => removeCommentFromTree(tree, id));
          setPost((p) =>
            p ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) } : p,
          );
          try {
            await deleteCommunityCommentAPI(postId, id);
            showToast("Comment deleted", "success");
          } catch (error) {
            setComments(snapshot);
            setPost(prevPost);
            showToast(error?.response?.data?.message || "Failed to delete", "error");
          }
        },
      },
    ]);
  };

  const composerPad = keyboardInset > 0 ? 10 : Math.max(insets.bottom, 10);

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: TEXT, fontWeight: "700" }}>Sign in to view this post</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG, marginBottom: keyboardInset, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <TouchableOpacity
          onPress={() => goBackTo(router, backTo, "/posts")}
          hitSlop={10}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GREEN} />
        </View>
      ) : !post ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: MUTED }}>Post not found</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <FlatList
            data={comments}
            keyExtractor={(item) => String(item._id)}
            removeClippedSubviews={false}
            onScrollBeginDrag={closeCommentMenu}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={GREEN}
                colors={[GREEN]}
              />
            }
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            ListHeaderComponent={
              <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      marginRight: 2,
                      marginBottom: 2,
                      position: "relative",
                      overflow: "visible",
                    }}
                  >
                    <Image
                      source={post.authorAvatar?.trim() ? { uri: post.authorAvatar } : DEFAULT_AVATAR}
                      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.surfaceAlt }}
                      contentFit="cover"
                    />
                    <AvatarRoleBadge
                      roleId={post.authorRole}
                      size={15}
                      bordered
                      style={{ right: -4, bottom: -4 }}
                    />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: TEXT, fontWeight: "700", fontSize: 16 }}>
                      {post.authorName || "Player"}
                    </Text>
                    <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
                      {formatRelativeDay(post.createdAt)}
                    </Text>
                  </View>
                </View>

                {post.content ? (
                  <PostRichText
                    content={post.content}
                    style={{
                      color: TEXT,
                      fontSize: 17,
                      lineHeight: 24,
                      paddingHorizontal: 16,
                      marginTop: 12,
                      textAlign: post.textAlign || "left",
                      fontWeight: "400",
                    }}
                    mentionStyle={{
                      color: T.bg === "#000000" ? "#7DD3FC" : "#2563EB",
                      fontWeight: "600",
                    }}
                    hashtagStyle={{
                      color: T.bg === "#000000" ? "#7DD3FC" : "#2563EB",
                      fontWeight: "600",
                    }}
                    onPressMention={(username) => {
                      const hit = (post.mentions || []).find(
                        (m) =>
                          String(m.username || "").toLowerCase() ===
                          String(username || "").toLowerCase(),
                      );
                      if (hit?.userId) {
                        router.push({
                          pathname: `/user/${hit.userId}`,
                          params: {
                            backTo: `/post/${post._id}`,
                            name: hit.username || username,
                          },
                        });
                      }
                    }}
                  />
                ) : null}

                {(post.taggedTeams?.length > 0 || post.taggedTournaments?.length > 0) && (
                <PostTagChips
                  taggedTeams={post.taggedTeams}
                  taggedTournaments={post.taggedTournaments}
                  colors={{
                    chipBg: T.surfaceAlt,
                    chipBorder: BORDER,
                    chipText: TEXT,
                    accent: GREEN,
                  }}
                  onPressTeam={(t) => {
                    if (t?.teamId) {
                      router.push({
                        pathname: `/team/${t.teamId}`,
                        params: { backTo: `/post/${post._id}` },
                      });
                    }
                  }}
                  onPressTournament={(t) => {
                    if (t?.tournamentId) {
                      router.push({
                        pathname: `/tournament/${t.tournamentId}`,
                        params: { backTo: `/post/${post._id}` },
                      });
                    }
                  }}
                />
                )}

                {media.length > 0 ? (
                  <FlatList
                    horizontal
                    data={media}
                    keyExtractor={(_, i) => `m-${i}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 14 }}
                    renderItem={({ item: m }) => {
                      const video = isVideoMedia(m);
                      const open = () =>
                        setLightboxItem({
                          url: m.url,
                          type: video ? "video" : "image",
                          mimeType: m.mimeType,
                        });
                      return video ? (
                        <TouchableOpacity activeOpacity={0.92} onPress={open}>
                          <FeedVideoCard
                            url={m.url}
                            style={{ width: MEDIA_W, height: MEDIA_H, borderRadius: 14 }}
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity activeOpacity={0.92} onPress={open}>
                          <Image
                            source={{ uri: m.url }}
                            style={{
                              width: MEDIA_W,
                              height: MEDIA_H,
                              borderRadius: 14,
                              backgroundColor: SKELETON,
                            }}
                            contentFit="cover"
                          />
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : null}

                <KudosSummaryRow
                  likedByMe={post.likedByMe}
                  likeCount={post.likeCount || 0}
                  recentLikers={post.recentLikers}
                  commentCount={post.commentCount || 0}
                  allowComments={allowComments}
                />

                <View style={{ flexDirection: "row", paddingHorizontal: 8, marginTop: 6 }}>
                  <TouchableOpacity
                    onPress={onTogglePostLike}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}
                  >
                    <Ionicons
                      name={post.likedByMe ? "thumbs-up" : "thumbs-up-outline"}
                      size={22}
                      color={post.likedByMe ? GREEN : TEXT}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!allowComments) {
                        showToast("Comments are turned off for this post", "warning");
                        return;
                      }
                      inputRef.current?.focus();
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      paddingVertical: 12,
                      opacity: allowComments ? 1 : 0.35,
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={21} color={TEXT} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Share.share({ message: post.content || "Check out this post on PlayFlash" })
                    }
                    style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}
                  >
                    <Ionicons name="share-social-outline" size={22} color={TEXT} />
                  </TouchableOpacity>
                </View>

                <Text
                  style={{
                    color: TEXT,
                    fontWeight: "800",
                    fontSize: 15,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 4,
                  }}
                >
                  Replies
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 28 }}>
                <Ionicons name="chatbubbles-outline" size={36} color={T.iconDim} />
                <Text style={{ color: MUTED, marginTop: 10, textAlign: "center", lineHeight: 20 }}>
                  {allowComments
                    ? "No replies yet. Start the conversation."
                    : "Comments are turned off for this post."}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <ThreadComment
                comment={item}
                depth={0}
                isLast={index === comments.length - 1}
                myId={myId}
                menuOpenId={menuOpenId}
                onToggleMenu={(id) =>
                  setMenuOpenId((cur) => (String(cur) === String(id) ? null : id))
                }
                onReply={startReply}
                onToggleLike={onToggleCommentLike}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
              />
            )}
          />

          {allowComments ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: BORDER,
                backgroundColor: BG,
                paddingBottom: composerPad,
                paddingTop: 8,
                paddingHorizontal: 12,
              }}
            >
              {replyTo ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: MUTED, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    Replying to{" "}
                    <Text style={{ color: GREEN, fontWeight: "700" }}>
                      {replyTo.authorName || "Player"}
                    </Text>
                  </Text>
                  <TouchableOpacity onPress={cancelReply} hitSlop={8}>
                    <Ionicons name="close" size={18} color={MUTED} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                <Image
                  source={
                    backendUser?.profilePicture || backendUser?.profileImage
                      ? { uri: backendUser.profilePicture || backendUser.profileImage }
                      : DEFAULT_AVATAR
                  }
                  style={{ width: 34, height: 34, borderRadius: 17, marginBottom: 4 }}
                  contentFit="cover"
                />
                <View
                  style={{
                    flex: 1,
                    minHeight: 42,
                    maxHeight: 120,
                    borderRadius: 22,
                    backgroundColor: SURFACE,
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === "ios" ? 10 : 4,
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    ref={inputRef}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                    placeholderTextColor={T.placeholder}
                    multiline
                    style={{ color: TEXT, fontSize: 15, maxHeight: 100 }}
                  />
                </View>
                <TouchableOpacity
                  onPress={submitComment}
                  disabled={!draft.trim() || sending}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: draft.trim() ? GREEN : T.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 2,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? (
                    <ActivityIndicator color={ON_GREEN} size="small" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color={draft.trim() ? ON_GREEN : MUTED} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: BORDER,
                paddingVertical: 14,
                paddingBottom: Math.max(insets.bottom, 14),
                alignItems: "center",
              }}
            >
              <Text style={{ color: MUTED, fontSize: 13 }}>Comments are disabled on this post</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={Boolean(editingComment)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingComment(null)}
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
            onPress={() => !editSaving && setEditingComment(null)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              backgroundColor: SURFACE,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 16,
            }}
          >
            <Text style={{ color: TEXT, fontSize: 17, fontWeight: "800", marginBottom: 12 }}>
              Edit comment
            </Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Edit your comment…"
              placeholderTextColor={T.placeholder}
              style={{
                minHeight: 100,
                maxHeight: 180,
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
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setEditingComment(null)}
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
                onPress={saveCommentEdit}
                disabled={editSaving}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: GREEN,
                  opacity: editSaving ? 0.7 : 1,
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

      <MediaLightbox
        visible={Boolean(lightboxItem)}
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
      />
    </View>
  );
}
