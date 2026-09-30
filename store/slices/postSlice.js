import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  posts: [],
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
  },
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: null,
  successMessage: null,
};

const postSlice = createSlice({
  name: "posts",
  initialState,
  reducers: {
    // ==================================
    // ----------- FETCH ----------------
    // ==================================
    fetchPostsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchPostsSuccess: (state, action) => {
      // action.payload: { posts, pagination }
      state.isLoading = false;
      state.posts = action.payload.posts;
      state.pagination = action.payload.pagination || state.pagination;
      state.error = null;
    },
    fetchPostsFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Append next page (infinite scroll)
    fetchMorePostsSuccess: (state, action) => {
      state.isLoading = false;
      state.posts = [...state.posts, ...action.payload.posts];
      state.pagination = action.payload.pagination || state.pagination;
      state.error = null;
    },

    // ==================================
    // ----------- CREATE ---------------
    // ==================================
    createPostStart: (state) => {
      state.isCreating = true;
      state.error = null;
      state.successMessage = null;
    },
    createPostSuccess: (state, action) => {
      state.isCreating = false;
      state.posts = [action.payload, ...state.posts];
      state.successMessage = "Post created successfully";
      state.error = null;
    },
    createPostFailure: (state, action) => {
      state.isCreating = false;
      state.error = action.payload;
    },

    // ==================================
    // ----------- DELETE ---------------
    // ==================================
    deletePostStart: (state) => {
      state.isDeleting = true;
      state.error = null;
      state.successMessage = null;
    },
    deletePostSuccess: (state, action) => {
      state.isDeleting = false;
      state.posts = state.posts.filter((p) => p._id !== action.payload);
      state.successMessage = "Post deleted successfully";
      state.error = null;
    },
    deletePostFailure: (state, action) => {
      state.isDeleting = false;
      state.error = action.payload;
    },

    clearPosts: (state) => {
      state.posts = [];
      state.pagination = { page: 1, totalPages: 1, total: 0 };
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
  },
});

export const {
  fetchPostsStart, fetchPostsSuccess, fetchPostsFailure,
  fetchMorePostsSuccess,
  createPostStart, createPostSuccess, createPostFailure,
  deletePostStart, deletePostSuccess, deletePostFailure,
  clearPosts, clearError, clearSuccessMessage,
} = postSlice.actions;

export default postSlice.reducer;
