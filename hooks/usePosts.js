import { useState, useCallback } from "react";
import {
  createPostAPI,
  getTeamPostsAPI,
  getPostAPI,
  deletePostAPI,
  toggleLikeAPI,
  addCommentAPI,
  deleteCommentAPI,
  toggleCommentLikeAPI,
} from "@/services/PostApi";

export default function usePosts(teamId = null) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, hasMore: true });

  const fetchPosts = useCallback(
    async (page = 1, limit = 10) => {
      if (!teamId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTeamPostsAPI(teamId, page, limit);
        const newPosts = data.posts || data;
        if (page === 1) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }
        setPagination({
          page,
          hasMore: newPosts.length === limit,
        });
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [teamId]
  );

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || isLoading) return;
    return fetchPosts(pagination.page + 1);
  }, [pagination, isLoading, fetchPosts]);

  const createPost = useCallback(async (postData) => {
    setError(null);
    try {
      const data = await createPostAPI(postData);
      setPosts((prev) => [data.post || data, ...prev]);
      return data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deletePost = useCallback(
    async (postId) => {
      if (!teamId) return;
      try {
        await deletePostAPI(teamId, postId);
        setPosts((prev) => prev.filter((p) => (p._id || p.id) !== postId));
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const toggleLike = useCallback(
    async (postId) => {
      if (!teamId) return;
      try {
        const data = await toggleLikeAPI(teamId, postId);
        setPosts((prev) =>
          prev.map((p) =>
            (p._id || p.id) === postId ? { ...p, ...data.post, likes: data.likes ?? p.likes } : p
          )
        );
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const addComment = useCallback(
    async (postId, content) => {
      if (!teamId) return;
      try {
        const data = await addCommentAPI(teamId, postId, content);
        setPosts((prev) =>
          prev.map((p) =>
            (p._id || p.id) === postId
              ? { ...p, comments: data.comments || [...(p.comments || []), data.comment || data] }
              : p
          )
        );
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const deleteComment = useCallback(
    async (postId, commentId) => {
      if (!teamId) return;
      try {
        await deleteCommentAPI(teamId, postId, commentId);
        setPosts((prev) =>
          prev.map((p) =>
            (p._id || p.id) === postId
              ? { ...p, comments: (p.comments || []).filter((c) => (c._id || c.id) !== commentId) }
              : p
          )
        );
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  const toggleCommentLike = useCallback(
    async (postId, commentId) => {
      if (!teamId) return;
      try {
        const data = await toggleCommentLikeAPI(teamId, postId, commentId);
        return data;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        throw err;
      }
    },
    [teamId]
  );

  return {
    posts,
    isLoading,
    error,
    pagination,
    fetchPosts,
    loadMore,
    createPost,
    deletePost,
    toggleLike,
    addComment,
    deleteComment,
    toggleCommentLike,
  };
}
