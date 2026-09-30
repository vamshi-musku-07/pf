import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { showLocalNotification } from "@/services/PushNotificationService";
import * as SystemUI from "expo-system-ui";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import {
  getMyGroupsAPI,
  createGroupAPI,
  getGroupByIdAPI,
  updateGroupAPI,
  addReceiptImageAPI,
  deleteReceiptImageAPI,
  addExpenseAPI,
  editExpenseAPI,
  deleteExpenseAPI,
  addSettlementAPI,
  addMemberAPI,
  removeMemberAPI,
  toggleFavoriteAPI,
  toggleArchiveAPI,
  deleteGroupAPI,
  joinGroupByShareAPI,
  scanReceiptAPI,
} from "@/services/TriCountApi";
import { useBackendAuth } from "@/context/BackendAuthContext";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import { createGroupShareLink, shareTricountGroupInvite } from "@/lib/shareLinks";
import { goBackTo, getBackToParam, BACK_TO_HOME } from "@/lib/navigationBack";
import useKeyboardInset from "@/hooks/useKeyboardInset";

const CATEGORIES = [
  { value: "travel", label: "Travel", icon: "airplane-outline" },
  { value: "housing", label: "Housing", icon: "home-outline" },
  { value: "food", label: "Food", icon: "restaurant-outline" },
  { value: "entertainment", label: "Entertainment", icon: "film-outline" },
  { value: "shopping", label: "Shopping", icon: "bag-outline" },
  { value: "couple", label: "Couple", icon: "heart-outline" },
  { value: "project", label: "Project", icon: "clipboard-outline" },
  { value: "general", label: "General", icon: "cube-outline" },
];

const LEGACY_EXPENSE_CATEGORY_MAP = {
  transport: "travel",
  accommodation: "housing",
  utilities: "general",
};

/** Map UI / legacy values to API expense category (matches tricount-service validation). */
const normalizeExpenseCategory = (category) => {
  const raw = String(category || "").toLowerCase().trim();
  if (!raw) return "general";
  if (LEGACY_EXPENSE_CATEGORY_MAP[raw]) return LEGACY_EXPENSE_CATEGORY_MAP[raw];
  if (CATEGORIES.some((c) => c.value === raw) || raw === "other") return raw;
  return "general";
};

const defaultExpenseCategoryForGroup = (groupCategory) =>
  normalizeExpenseCategory(groupCategory || "general");

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR"];
const INPUT_PLACEHOLDER_COLOR = "#6B7280";
const CREATE_GROUP_INPUT_STYLE = {
  backgroundColor: "#F3F4F6",
  borderRadius: 12,
  padding: 14,
  fontSize: 15,
  color: "#111827",
  borderWidth: 1,
  borderColor: "#E5E7EB",
};

/** Enough height for all split rows; cap so modal still scrolls on small screens. */
const splitListMaxHeight = (memberCount) =>
  Math.min(Math.max((memberCount || 1) * 48 + 16, 96), 320);

const EXPENSE_FILTER_CATEGORIES = [
  { value: "all", label: "All" },
  ...CATEGORIES,
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS = {
  travel: "#889ec2",
  housing: "#aa9acf",
  food: "#F59E0B",
  entertainment: "#f19d9d",
  shopping: "#EC4899",
  couple: "#F43F5E",
  other: "#6B7280",
  general: "#8a96ad",
  project: "#10B981",
};

const formatCurrency = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toFixed(2)}`;
  }
};

const matchesExpenseSearch = (expense, query) => {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const description = (expense.description || "").toLowerCase();
  const amount = String(expense.amount ?? "");
  const notes = (expense.notes || "").toLowerCase();
  return tokens.every((token) => description.includes(token) || amount.includes(token) || notes.includes(token));
};

/** Match saved category or keywords in description/notes (e.g. "travelling" → Travel tab). */
const CATEGORY_FILTER_KEYWORDS = {
  travel: ["travel", "travelling", "traveling", "trip", "flight", "hotel", "taxi", "uber", "cab"],
  housing: ["housing", "rent", "mortgage", "airbnb", "apartment", "lease"],
  food: ["food", "restaurant", "meal", "lunch", "dinner", "breakfast", "grocery", "cafe", "coffee"],
  entertainment: ["entertainment", "movie", "cinema", "concert", "game", "party", "netflix"],
  shopping: ["shopping", "shop", "store", "amazon", "mall", "clothes"],
  couple: ["couple", "date", "gift", "anniversary"],
  project: ["project", "office", "work", "client"],
  general: ["general", "misc", "other"],
};

const matchesExpenseCategoryFilter = (expense, filter) => {
  if (filter === "all") return true;

  const category = normalizeExpenseCategory(expense.category);
  const text = `${expense.description || expense.title || ""} ${expense.notes || ""}`.toLowerCase();

  if (category === filter) return true;

  const keywords = CATEGORY_FILTER_KEYWORDS[filter];
  if (keywords?.some((word) => text.includes(word))) return true;

  if (filter === "other") {
    const matchedElsewhere = Object.entries(CATEGORY_FILTER_KEYWORDS).some(([key, words]) => {
      if (key === "other" || key === "general") return false;
      return category === key || words.some((word) => text.includes(word));
    });
    return !matchedElsewhere;
  }

  return false;
};

const inferExpenseCategoryFromText = (description = "", notes = "") => {
  const text = `${description} ${notes}`.toLowerCase();
  for (const [key, words] of Object.entries(CATEGORY_FILTER_KEYWORDS)) {
    if (key === "general" || key === "other") continue;
    if (words.some((word) => text.includes(word))) return key;
  }
  return "general";
};

const sumTrackedByCurrency = (groupsList) => {
  const totals = {};
  groupsList.forEach((group) => {
    const currency = group.currency || "USD";
    const groupTotal = group.totalExpenses
      ?? (group.expenses || []).reduce((sum, expense) => sum + (expense.amount || 0), 0);
    totals[currency] = (totals[currency] || 0) + groupTotal;
  });
  return totals;
};

const formatTrackedTotals = (totalsByCurrency) => {
  const entries = Object.entries(totalsByCurrency);
  if (!entries.length) return "—";
  if (entries.length === 1) {
    const [currency, amount] = entries[0];
    return formatCurrency(amount, currency);
  }
  return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ");
};

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();

  // Compare calendar day boundaries in local time.
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((startOfNow - startOfDate) / 86400000);

  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.ceil(diff / 7)}w ago`;
  return date.toLocaleDateString();
};

const humanizeValidationLine = (line) => {
  const text = String(line || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower.includes("paidbyuserid")) return "Select who paid for this expense.";
  if (lower.includes("description")) return "Add a description for this expense.";
  if (lower.includes("amount")) return "Enter a valid expense amount.";
  if (lower.includes("split")) return text;
  return text.replace(/^"([^"]+)"\s/, (_, field) => `${field}: `);
};

const getErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const joined = data.errors
      .map((e) => humanizeValidationLine(typeof e === "string" ? e : e?.message || e?.msg))
      .filter(Boolean)
      .join("\n");
    if (joined) return joined;
  }
  if (typeof data?.message === "string" && data.message.trim() && data.message !== "Validation error") {
    return data.message.trim();
  }
  if (typeof err?.message === "string" && err.message.trim() && err.message.toLowerCase() !== "error") {
    return err.message.trim();
  }
  return fallback;
};

const getExpenseValidationIssue = (form, currency = "USD") => {
  if (!form.description?.trim()) {
    return {
      title: "Description required",
      message: "Add a short description (e.g. groceries, dinner, taxi).",
    };
  }
  if (!String(form.amount ?? "").trim()) {
    return {
      title: "Amount required",
      message: `Enter how much was spent (${currency}).`,
    };
  }
  const totalAmount = parseFloat(form.amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return {
      title: "Invalid amount",
      message: "Enter a valid number greater than zero.",
    };
  }
  if (!form.paidByUserId) {
    return {
      title: "Who paid?",
      message: 'Tap a member under "Paid by" — choose who paid for this expense.',
    };
  }
  return null;
};

const showExpenseValidationAlert = (issue) => {
  if (issue) Alert.alert(issue.title, issue.message);
};

const { height: WINDOW_HEIGHT } = Dimensions.get("window");
const EXPENSE_MODAL_MAX_HEIGHT = Math.round(WINDOW_HEIGHT * 0.9);
const EXPENSE_SHEET_HEADER_HEIGHT = 88;
const EXPENSE_SHEET_FOOTER_HEIGHT = 84;
const CREATE_GROUP_MODAL_MAX_HEIGHT = Math.round(WINDOW_HEIGHT * 0.88);
const CREATE_GROUP_SHEET_HEADER_HEIGHT = 56;
const CREATE_GROUP_SHEET_FOOTER_HEIGHT = 88;

const getCreateGroupSheetLayout = (keyboardInset, bottomInset = 0, topInset = 0) => {
  const footerHeight = CREATE_GROUP_SHEET_FOOTER_HEIGHT + bottomInset;
  const sheetMaxHeight = Math.max(
    280,
    Math.min(CREATE_GROUP_MODAL_MAX_HEIGHT, WINDOW_HEIGHT - topInset - Math.max(keyboardInset, bottomInset) - 16),
  );
  const scrollMaxHeight = Math.max(
    120,
    sheetMaxHeight - CREATE_GROUP_SHEET_HEADER_HEIGHT - footerHeight - 16,
  );
  return { sheetMaxHeight, scrollMaxHeight };
};

const getExpenseSheetLayout = (keyboardInset, bottomInset = 0, topInset = 0) => {
  const footerHeight = EXPENSE_SHEET_FOOTER_HEIGHT + bottomInset;
  const sheetMaxHeight = Math.max(
    320,
    Math.min(EXPENSE_MODAL_MAX_HEIGHT, WINDOW_HEIGHT - topInset - Math.max(keyboardInset, bottomInset) - 16),
  );
  const scrollMaxHeight = Math.max(
    180,
    sheetMaxHeight - EXPENSE_SHEET_HEADER_HEIGHT - footerHeight - 16,
  );
  return { sheetMaxHeight, scrollMaxHeight };
};

const sanitizeSharesInput = (text) => String(text ?? "").replace(/\D/g, "").slice(0, 4);

const getSharesSplitDisplayValue = (sharesMap, userId) => {
  const raw = sharesMap?.[userId];
  if (raw === undefined || raw === null || raw === "") return "";
  return String(raw);
};

const scrollToFieldY = (scrollRef, yOffset, delayMs = Platform.OS === "ios" ? 320 : 150) => {
  setTimeout(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, yOffset - 100),
      animated: true,
    });
  }, delayMs);
};

/**
 * Expense sheet overlay (same window as screen — keyboard resize works on all Android devices).
 * Not RN Modal: Modal uses a separate window where keyboard height is often wrong (Poco/MIUI).
 */
function ExpenseModalFrame({
  visible,
  onRequestClose,
  onDismiss,
  keyboardPad,
  bottomInset = 0,
  sheetMaxHeight,
  scrollMaxHeight,
  keyboardOpen,
  scrollRef,
  header,
  footer,
  children,
}) {
  const footerBottomPad = Math.max(12, bottomInset + 12);
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onRequestClose]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 24,
      }}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboardPad, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onDismiss} />
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: sheetMaxHeight,
            width: "100%",
            overflow: "hidden",
          }}
        >
          {header}
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: scrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={keyboardOpen}
            nestedScrollEnabled
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: footerBottomPad,
              borderTopWidth: 1,
              borderTopColor: "#F3F4F6",
              backgroundColor: "#fff",
              flexShrink: 0,
            }}
          >
            {footer}
          </View>
        </View>
      </View>
    </View>
  );
}

const TRICOUNT_SHARE_ID_PATTERN = /^[a-f0-9]{12}$/i;

const extractTricountShareIdFromPath = (pathname) => {
  const segments = String(pathname || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const shareIndex = segments.findIndex((segment) => segment.toLowerCase() === "share");
  const shareId = shareIndex >= 0 ? segments[shareIndex + 1] : "";
  if (TRICOUNT_SHARE_ID_PATTERN.test(shareId)) return shareId;

  const joinIndex = segments.findIndex((segment) => segment.toLowerCase() === "join");
  if (joinIndex >= 0 && segments[joinIndex + 1]?.toLowerCase() === "tricount") {
    const joinShareId = segments[joinIndex + 2] || "";
    if (TRICOUNT_SHARE_ID_PATTERN.test(joinShareId)) return joinShareId;
  }

  return "";
};

const extractTricountShareId = (input) => {
  if (typeof input !== "string") return "";

  const trimmed = input.trim();
  if (!trimmed) return "";

  if (TRICOUNT_SHARE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const contextualMatch = trimmed.match(
    /(?:shareId=|\/join\/tricount\/|\/share\/|invite\s+code[:\s]+)([a-f0-9]{12})(?![a-f0-9])/i
  );
  if (contextualMatch?.[1] && TRICOUNT_SHARE_ID_PATTERN.test(contextualMatch[1])) {
    return contextualMatch[1];
  }

  try {
    const url = new URL(trimmed);
    const queryShareId = (url.searchParams.get("shareId") || "").trim();
    if (TRICOUNT_SHARE_ID_PATTERN.test(queryShareId)) {
      return queryShareId;
    }

    return extractTricountShareIdFromPath(url.pathname);
  } catch {
    return "";
  }
};

const INVALID_TRICOUNT_SHARE_MESSAGE = "This is not a valid split-bill invite.";

// ============ Skeleton Card ============
function SkeletonCard() {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim, backgroundColor: "#EEC08C", borderRadius: 28, overflow: "hidden", marginBottom: 14 }}>
      <View style={{ padding: 16 }}>
        {/* Receipt + category row */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 72, height: 28, backgroundColor: "#1F2937", borderRadius: 8 }} />
          <View style={{ width: 60, height: 28, backgroundColor: "#d4a96a", borderRadius: 8 }} />
        </View>
        {/* Divider */}
        <View style={{ height: 2, backgroundColor: "#c49050", borderRadius: 1, marginBottom: 12 }} />
        {/* Title placeholder */}
        <View style={{ width: "60%", height: 14, backgroundColor: "#c49050", borderRadius: 6, marginBottom: 8 }} />
        <View style={{ width: "40%", height: 32, backgroundColor: "#1F2937", borderRadius: 8, marginBottom: 12 }} />
        {/* Amount placeholder */}
        <View style={{ width: "30%", height: 12, backgroundColor: "#c49050", borderRadius: 6, marginBottom: 6 }} />
        <View style={{ width: "55%", height: 36, backgroundColor: "#1F2937", borderRadius: 8, marginBottom: 12 }} />
        {/* Bottom strip */}
        <View style={{ height: 44, backgroundColor: "#1F2937", borderRadius: 12 }} />
      </View>
    </Animated.View>
  );
}

// ============ Receipt Images Component ============
function ReceiptImages({ exp, groupId, currentUserId, isCreator, onUpdate, idToName = {} }) {
  const [uploading, setUploading] = React.useState(false);
  const [viewImage, setViewImage] = React.useState(null);
  const images = exp.receiptImages || [];

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission needed", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await addReceiptImageAPI(groupId, exp._id, base64, asset.mimeType || "image/jpeg");
      onUpdate(res);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to upload image");
    } finally { setUploading(false); }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission needed", "Please allow camera access.");
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await addReceiptImageAPI(groupId, exp._id, base64, asset.mimeType || "image/jpeg");
      onUpdate(res);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to upload image");
    } finally { setUploading(false); }
  };

  const handleDelete = (imageId) => {
    Alert.alert("Delete Image", "Remove this receipt image?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const res = await deleteReceiptImageAPI(groupId, exp._id, imageId);
          onUpdate(res);
        } catch { Alert.alert("Error", "Failed to delete image"); }
      }},
    ]);
  };

  const pickSource = () => {
    Alert.alert("Add Receipt Image", "Choose source", [
      { text: "Camera", onPress: handleCamera },
      { text: "Gallery", onPress: handleUpload },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* Divider */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View className="rounded-r-full" style={{ width: 14, height: 18, backgroundColor: "#050a16", marginLeft: -16 }} />
        <View style={{ flex: 1, borderTopWidth: 2, borderColor: "#050a16", borderStyle: "dashed", marginHorizontal: 4 }} />
        <View className="rounded-l-full" style={{ width: 14, height: 18, backgroundColor: "#050a16", marginRight: -16 }} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: "#475569", fontSize: 10, fontWeight: "700" }}>
          BILL IMAGES {images.length > 0 ? `(${images.length})` : ""}
        </Text>
        <TouchableOpacity onPress={pickSource} disabled={uploading}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1F2937", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
          {uploading ? <ActivityIndicator size={12} color="#9AEA62" /> : <Ionicons name="camera-outline" size={13} color="#9AEA62" />}
          <Text style={{ color: "#9AEA62", fontSize: 11, fontWeight: "700" }}>{uploading ? "Uploading…" : "Add"}</Text>
        </TouchableOpacity>
      </View>

      {images.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {images.map((img) => (
            <View key={img._id} style={{ position: "relative" }}>
              <TouchableOpacity
                onPress={() => setViewImage(img)}
                onLongPress={() => {
                  const canDelete = img.uploadedBy === currentUserId || isCreator;
                  if (canDelete) handleDelete(img._id);
                }}
                delayLongPress={400}
              >
                <Image
                  source={{ uri: img.url }}
                  style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: "#1F2937" }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingVertical: 2, alignItems: "center" }}>
                <Text style={{ color: "white", fontSize: 8, fontWeight: "600" }} numberOfLines={1}>{idToName[img.uploadedBy] || img.uploaderName || "Member"}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {images.length === 0 && (
        <Text style={{ color: "#64748b", fontSize: 11 }}>No bill images yet. Tap "Add" to upload proof of payment.</Text>
      )}

      {/* Fullscreen image viewer */}
      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
          <TouchableOpacity style={{ position: "absolute", inset: 0 }} activeOpacity={1} onPress={() => setViewImage(null)} />
          {viewImage && (
            <>
              <Image
                source={{ uri: viewImage.url }}
                style={{ width: "92%", height: "70%", borderRadius: 14 }}
                resizeMode="contain"
              />
              <View style={{ marginTop: 14, alignItems: "center", gap: 4 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>{idToName[viewImage.uploadedBy] || viewImage.uploaderName || "Member"}</Text>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                  {viewImage.uploadedAt ? new Date(viewImage.uploadedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : ""}
                </Text>
              </View>
              {(viewImage.uploadedBy === currentUserId || isCreator) && (
                <TouchableOpacity
                  onPress={() => { setViewImage(null); handleDelete(viewImage._id); }}
                  style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEE2E2", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={{ color: "#EF4444", fontWeight: "700" }}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setViewImage(null)}
                style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ============ Group Detail Screen ============
function GroupDetail({ group: initialGroup, onBack, currentUsername, backendUser }) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const addExpenseScrollRef = useRef(null);
  const editExpenseScrollRef = useRef(null);
  const addNotesFieldY = useRef(0);
  const editNotesFieldY = useRef(0);
  const [group, setGroup] = useState(initialGroup);
  const [balances, setBalances] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberTargetExpenseId, setAddMemberTargetExpenseId] = useState(null);
  const [showSettle, setShowSettle] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [settling, setSettling] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "",
    amount: "",
    paidByUserId: "",
    splitMethod: "equal",
    splitAmongUserIds: [],
    exactSplits: {},
    percentageSplits: {},
    sharesSplits: {},
    notes: "",
  });
  const [expDate, setExpDate] = useState(new Date());
  const [showExpDatePicker, setShowExpDatePicker] = useState(false);
  const [useCustomDate, setUseCustomDate] = useState(false);

  // Edit expense
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editExpForm, setEditExpForm] = useState({
    description: "",
    amount: "",
    paidByUserId: "",
    splitMethod: "equal",
    splitAmongUserIds: [],
    exactSplits: {},
    percentageSplits: {},
    sharesSplits: {},
    notes: "",
  });
  const [editExpCategory, setEditExpCategory] = useState("other");
  const [editExpDate, setEditExpDate] = useState(new Date());
  const [showEditExpDatePicker, setShowEditExpDatePicker] = useState(false);
  const [editingExp, setEditingExp] = useState(false);

  const expenseModalActive = showAddExpense || showEditExpense;
  const expenseModalKeyboardHeight = expenseModalActive ? keyboardInset : 0;
  const {
    sheetMaxHeight: expenseSheetMaxHeight,
    scrollMaxHeight: expenseScrollMaxHeight,
  } = getExpenseSheetLayout(expenseModalKeyboardHeight, insets.bottom, insets.top);

  // Expense search/filter
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [settleForm, setSettleForm] = useState({ fromUserId: "", toUserId: "", amount: "" });
  const [scanning, setScanning] = useState(false);
  const [expCategory, setExpCategory] = useState("general");
  const [realNames, setRealNames] = useState({});

  // Edit group
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({ name: "", description: "", currency: "USD", category: "general" });
  const [savingEditGroup, setSavingEditGroup] = useState(false);

  // Invite / QR
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const resetExpenseForm = () => {
    setExpForm({
      description: "",
      amount: "",
      paidByUserId: "",
      splitMethod: "equal",
      splitAmongUserIds: [],
      exactSplits: {},
      percentageSplits: {},
      sharesSplits: {},
      notes: "",
    });
    setExpCategory(defaultExpenseCategoryForGroup(group.category));
    setExpDate(new Date());
    setUseCustomDate(false);
    setShowExpDatePicker(false);
  };

  const _processReceiptImage = async (asset) => {
    setScanning(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = asset.mimeType || "image/jpeg";
      const res = await scanReceiptAPI(base64, mimeType);
      const { amount, description, category } = res.data;
      setExpForm((prev) => ({
        ...prev,
        ...(description ? { description } : {}),
        ...(amount ? { amount } : {}),
      }));
      if (category) setExpCategory(normalizeExpenseCategory(category));
      Alert.alert(
        "Receipt Scanned",
        [description && `Merchant: ${description}`, amount && `Amount: ${amount}`].filter(Boolean).join("\n") || "Fields filled from receipt."
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Could not read receipt.";
      Alert.alert("Scan Failed", msg);
    } finally {
      setScanning(false);
    }
  };

  const handleScanReceipt = () => {
    Alert.alert("Scan Receipt", "Choose an option", [
      {
        text: "Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return Alert.alert("Permission needed", "Please allow camera access.");
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
          if (!result.canceled && result.assets?.length) await _processReceiptImage(result.assets[0]);
        },
      },
      {
        text: "Upload from Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return Alert.alert("Permission needed", "Please allow access to your photos.");
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 0.7 });
          if (!result.canceled && result.assets?.length) await _processReceiptImage(result.assets[0]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const isCreator = group.createdBy === (backendUser?._id || backendUser?.id);

  const openEditGroup = () => {
    setEditGroupForm({ name: group.name, description: group.description || "", currency: group.currency || "USD", category: group.category || "general" });
    setShowEditGroup(true);
  };

  const handleEditGroup = async () => {
    if (!editGroupForm.name.trim()) return Alert.alert("Error", "Group name is required");
    setSavingEditGroup(true);
    try {
      const res = await updateGroupAPI(group._id, editGroupForm);
      if (res.group) setGroup(res.group);
      setShowEditGroup(false);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to update group");
    } finally { setSavingEditGroup(false); }
  };

  const openInvite = () => {
    const link = createGroupShareLink(group.shareId);
    setInviteLink(link);
    setShowInvite(true);
  };

  const handleShareLink = async () => {
    try {
      await shareTricountGroupInvite({
        title: group?.name || "Split bill invite",
        groupName: group?.name || "my group",
        shareId: group?.shareId,
      });
    } catch { /* dismissed */ }
  };

  const handleRemoveMember = (member) => {
    const memberId = member.userId || member._id;
    const memberName = member.name;
    Alert.alert("Remove Member", `Remove ${memberName} from this group?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          const res = await removeMemberAPI(group._id, memberId);
          if (res.group) setGroup(res.group);
        } catch (err) {
          Alert.alert("Error", err?.response?.data?.message || "Failed to remove member");
        }
      }},
    ]);
  };

  const applyResponse = (res) => {
    if (res.group)    setGroup(res.group);
    if (res.balances) setBalances(res.balances);
    if (res.debts)    setDebts(res.debts);
  };

  const refreshGroup = async (groupId = group?._id || initialGroup?._id) => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await getGroupByIdAPI(groupId);
      applyResponse(res);
    } catch {} finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await getGroupByIdAPI(group?._id || initialGroup?._id);
      applyResponse(res);
    } catch {} finally { setRefreshing(false); }
  };

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#050a16");
  }, []);

  useEffect(() => {
    if (!initialGroup?._id) return;
    setGroup(initialGroup);
    refreshGroup(initialGroup._id);
  }, [initialGroup?._id]);

  const members = group.members || [];
  const expenses = group.expenses || [];
  const settlements = group.settlements || [];

  // Fetch real usernames from auth-service for all members
  useEffect(() => {
    const realUserIds = (members || [])
      .map((m) => m.userId)
      .filter((uid) => uid && !uid.startsWith("guest_") && !uid.startsWith("member_"));
    if (!realUserIds.length) return;
    getUsersByIdsAPI(realUserIds)
      .then((res) => {
        // API may return { userId: profile } directly or { data: { userId: profile } }
        const profiles = res?.data || res || {};
        if (typeof profiles !== "object" || Array.isArray(profiles)) return;
        const map = {};
        Object.entries(profiles).forEach(([uid, p]) => {
          if (!p || typeof p !== "object") return;
          const name = p.username || p.fullname || p.name;
          if (name) map[uid] = name;
        });
        if (Object.keys(map).length) setRealNames((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, [members.length]);

  // Poll every 12 seconds to pick up new members joining via QR
  useEffect(() => {
    if (!group._id) return;
    const interval = setInterval(() => {
      getGroupByIdAPI(group._id)
        .then((res) => { if (res) applyResponse(res); })
        .catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [group._id]);

  // Maps ANY identifier (userId, _id, both as strings) → member name
  // Resolve the best display name for a userId — real profile name takes priority
  const resolveName = (userId, fallback) => {
    if (userId && realNames[String(userId)]) return realNames[String(userId)];
    return fallback || userId || "Member";
  };

  const idToName = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      const name = resolveName(m.userId, m.name);
      if (m.userId) map[String(m.userId)] = name;
      if (m._id)    map[String(m._id)]    = name;
    });
    return map;
  }, [members, realNames]);

  // Returns the real member ID to use (userId if present, otherwise _id)
  const memberId = (m) => m.userId || m._id || m.name;

  // Resolve any paidBy value → display name
  const resolvePayer = (paidBy) => {
    if (!paidBy) return null;
    if (typeof paidBy === "object") {
      return paidBy.name
        || idToName[String(paidBy.userId || "")]
        || idToName[String(paidBy._id    || "")]
        || null;
    }
    return idToName[String(paidBy)] || paidBy;
  };

  // Resolve splits → [{name, amount|null, percentage|null}]
  const resolveSplits = (splits) => {
    if (!splits?.length) return [];
    return splits
      .map((s) => ({
        name: s.name
          || idToName[String(s.userId || "")]
          || idToName[String(s._id    || "")]
          || null,
        amount:     s.amount     ?? null,
        percentage: s.percentage ?? null,
      }))
      .filter((s) => s.name);
  };

  const calcBalances = () => {
    const balMap = {};
    members.forEach((m) => { balMap[m.name] = 0; });

    expenses.forEach((exp) => {
      const total = exp.amount || 0;
      const payerName = resolvePayer(exp?.paidBy);

      // Credit the payer — they are owed this amount
      if (payerName && payerName in balMap) {
        balMap[payerName] += total;
      }

      const resolved = resolveSplits(exp.splits);
      const legacy = exp?.splitAmong || [];

      if (resolved.length > 0) {
        const hasExact = resolved.some((s) => s.amount !== null && s.amount !== undefined);
        const hasPercent = !hasExact && resolved.some((s) => s.percentage !== null);

        if (hasExact) {
          // Exact amounts provided per split
          resolved.forEach(({ name, amount }) => {
            if (name in balMap) balMap[name] -= amount || 0;
          });
        } else if (hasPercent) {
          resolved.forEach(({ name, percentage }) => {
            if (name in balMap) balMap[name] -= (total * (percentage || 0)) / 100;
          });
        } else {
          // Equal split — divide evenly
          const share = total / resolved.length;
          resolved.forEach(({ name }) => {
            if (name in balMap) balMap[name] -= share;
          });
        }
      } else if (legacy.length > 0) {
        // Legacy string-array format
        const share = total / legacy.length;
        legacy.forEach((name) => {
          if (name in balMap) balMap[name] -= share;
        });
      }
    });

    // Apply recorded settlements
    settlements.forEach((s) => {
      const from = s.fromName || s.from;
      const to = s.toName || s.to;
      if (from in balMap) balMap[from] += s.amount || 0;
      if (to in balMap) balMap[to] -= s.amount || 0;
    });

    return balMap;
  };

  const buildSplitsFromForm = (form, selectedUserIds, totalAmount) => {
    let splitMethod = form.splitMethod;
    let splits = [];

    if (splitMethod === "equal") {
      splits = selectedUserIds.map((uid) => ({ userId: uid }));
    } else if (splitMethod === "exact") {
      splits = selectedUserIds.map((uid) => ({
        userId: uid,
        amount: parseFloat(form.exactSplits[uid] || "0"),
      }));
      if (splits.some((s) => !Number.isFinite(s.amount) || s.amount < 0)) {
        return { error: "All exact split values must be valid amounts" };
      }
      const sumExact = splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(sumExact - totalAmount) > 0.02) {
        return { error: `Exact split total must match expense amount (${totalAmount.toFixed(2)})` };
      }
    } else if (splitMethod === "percentage") {
      splits = selectedUserIds.map((uid) => ({
        userId: uid,
        percentage: parseFloat(form.percentageSplits[uid] || "0"),
      }));
      if (splits.some((s) => !Number.isFinite(s.percentage) || s.percentage < 0)) {
        return { error: "All percentage values must be valid numbers" };
      }
      const pctTotal = splits.reduce((sum, s) => sum + s.percentage, 0);
      if (Math.abs(pctTotal - 100) > 0.5) {
        return { error: "Percentages must add up to 100" };
      }
    } else if (splitMethod === "shares") {
      const rawShares = selectedUserIds.map((uid) => ({
        userId: uid,
        shares: parseInt(form.sharesSplits[uid] || "1", 10) || 1,
      }));
      const totalShares = rawShares.reduce((s, r) => s + r.shares, 0);
      splits = rawShares.map((r) => ({
        userId: r.userId,
        amount: Math.round((r.shares / totalShares) * totalAmount * 100) / 100,
      }));
      splitMethod = "exact";
    }

    return { splitMethod, splits };
  };

  const handleAddExpense = async () => {
    const validationIssue = getExpenseValidationIssue(expForm, group.currency);
    if (validationIssue) {
      showExpenseValidationAlert(validationIssue);
      return;
    }

    const totalAmount = parseFloat(expForm.amount);

    const selectedUserIds = expForm.splitAmongUserIds.length > 0
      ? expForm.splitAmongUserIds
      : members.map(memberId);

    if (selectedUserIds.length === 0) {
      Alert.alert("Split required", "Add at least one member to split this expense.");
      return;
    }

    const result = buildSplitsFromForm(expForm, selectedUserIds, totalAmount);
    if (result.error) {
      Alert.alert("Check the split", result.error);
      return;
    }

    setAddingExpense(true);
    try {
      const res = await addExpenseAPI(group._id, {
        description: expForm.description.trim(),
        amount: totalAmount,
        paidByUserId: expForm.paidByUserId,
        splitMethod: result.splitMethod,
        splits: result.splits,
        category: normalizeExpenseCategory(
          expCategory === "other"
            ? inferExpenseCategoryFromText(expForm.description, expForm.notes)
            : expCategory,
        ),
        notes: expForm.notes.trim() || undefined,
        date: useCustomDate ? expDate.toISOString() : undefined,
      });
      applyResponse(res);
      setShowAddExpense(false);
      resetExpenseForm();
      showLocalNotification({
        title: "Expense Added",
        body: `${expForm.description.trim()} · ${formatCurrency(totalAmount, group.currency)}`,
        channelId: "groups",
      }).catch(() => {});
    } catch (err) {
      Alert.alert("Could not add expense", getErrorMessage(err, "Something went wrong. Please try again."));
    } finally { setAddingExpense(false); }
  };

  const openEditExpense = (exp) => {
    const selectedIds = (exp.splits || []).map((s) => s.userId).filter(Boolean);
    const exactMap = {};
    const pctMap = {};
    const sharesMap = {};
    if (exp.splitMethod === "exact") {
      (exp.splits || []).forEach((s) => { if (s.userId) exactMap[s.userId] = String(s.amount || ""); });
    } else if (exp.splitMethod === "percentage") {
      (exp.splits || []).forEach((s) => { if (s.userId) pctMap[s.userId] = String(s.percentage || ""); });
    } else if (exp.splitMethod === "shares") {
      (exp.splits || []).forEach((s) => {
        if (s.userId && s.shares != null) sharesMap[s.userId] = String(s.shares);
      });
    }
    setEditExpForm({
      description: exp.description || "",
      amount: String(exp.amount || ""),
      paidByUserId: exp.paidBy?.userId || exp.paidBy || "",
      splitMethod: exp.splitMethod || "equal",
      splitAmongUserIds: selectedIds,
      exactSplits: exactMap,
      percentageSplits: pctMap,
      sharesSplits: sharesMap,
      notes: exp.notes || "",
    });
    setEditExpCategory(normalizeExpenseCategory(exp.category || group.category));
    const dateVal = exp.expenseDate || exp.createdAt;
    setEditExpDate(dateVal ? new Date(dateVal) : new Date());
    setEditingExpense(exp);
    setShowEditExpense(true);
  };

  const handleEditExpense = async () => {
    const validationIssue = getExpenseValidationIssue(editExpForm, group.currency);
    if (validationIssue) {
      showExpenseValidationAlert(validationIssue);
      return;
    }
    const totalAmount = parseFloat(editExpForm.amount);
    const selectedUserIds = editExpForm.splitAmongUserIds.length > 0
      ? editExpForm.splitAmongUserIds
      : members.map(memberId);
    if (selectedUserIds.length === 0) {
      Alert.alert("Split required", "Add at least one member to split this expense.");
      return;
    }
    const result = buildSplitsFromForm(editExpForm, selectedUserIds, totalAmount);
    if (result.error) {
      Alert.alert("Check the split", result.error);
      return;
    }

    setEditingExp(true);
    try {
      const res = await editExpenseAPI(group._id, editingExpense._id, {
        description: editExpForm.description.trim(),
        amount: totalAmount,
        paidByUserId: editExpForm.paidByUserId,
        splitMethod: result.splitMethod,
        splits: result.splits,
        category: normalizeExpenseCategory(editExpCategory),
        notes: editExpForm.notes.trim() || undefined,
        date: editExpDate.toISOString(),
      });
      applyResponse(res);
      setShowEditExpense(false);
      setEditingExpense(null);
    } catch (err) {
      Alert.alert("Could not update expense", getErrorMessage(err, "Something went wrong. Please try again."));
    } finally { setEditingExp(false); }
  };

  const handleAddMember = async () => {
    if (!memberName.trim()) return;
    setAddingMember(true);
    try {
      // Step 1: add member to the group
      const memberRes = await addMemberAPI(group._id, { name: memberName.trim(), email: memberEmail.trim() || undefined });
      applyResponse(memberRes);

      // Step 2: if triggered from an expense card, re-split that expense to include the new member
      if (addMemberTargetExpenseId && memberRes.group) {
        const updatedGroup = memberRes.group;
        const targetExp = updatedGroup.expenses?.find((e) => String(e._id) === String(addMemberTargetExpenseId));
        const newMember = updatedGroup.members?.find((m) => m.name === memberName.trim());

        if (targetExp && newMember) {
          const existingUserIds = (targetExp.splits || []).map((s) => s.userId);
          const allUserIds = [...new Set([...existingUserIds, newMember.userId])];

          const editRes = await editExpenseAPI(group._id, addMemberTargetExpenseId, {
            splitMethod: "equal",
            splits: allUserIds.map((uid) => ({ userId: uid })),
            amount: targetExp.amount,
            paidByUserId: targetExp.paidBy?.userId,
          });
          applyResponse(editRes);
        }
      }

      setShowAddMember(false);
      setMemberName("");
      setMemberEmail("");
      setAddMemberTargetExpenseId(null);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to add member");
    } finally { setAddingMember(false); }
  };

  const handleSettle = async () => {
    if (!settleForm.fromUserId || !settleForm.toUserId || !settleForm.amount) {
      Alert.alert("Error", "All settlement fields are required"); return;
    }
    setSettling(true);
    try {
      const amount = parseFloat(settleForm.amount);
      const fromName = idToName[settleForm.fromUserId] || settleForm.fromUserId;
      const toName = idToName[settleForm.toUserId] || settleForm.toUserId;
      const res = await addSettlementAPI(group._id, {
        fromUserId: settleForm.fromUserId,
        toUserId: settleForm.toUserId,
        amount,
      });
      applyResponse(res);
      setShowSettle(false);
      setSettleForm({ fromUserId: "", toUserId: "", amount: "" });
      showLocalNotification({
        title: "Settlement Recorded",
        body: `${fromName} paid ${toName} · ${formatCurrency(amount, group.currency)}`,
        channelId: "groups",
      }).catch(() => {});
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to record settlement"));
    } finally { setSettling(false); }
  };

  const handleDeleteExpense = (expId) => {
    Alert.alert("Delete Expense", "Delete this expense?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const res = await deleteExpenseAPI(group._id, expId);
          applyResponse(res);
        } catch { Alert.alert("Error", "Failed to delete expense"); }
      }}
    ]);
  };

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const categoryColor = CATEGORY_COLORS[group.category] || "#6B7280";

  // Shared modal styles
  const modalSheetBottomPad = Math.max(40, insets.bottom + 24);
  const modalSheet = {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: modalSheetBottomPad,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  };
  const modalHandle = { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 20 };
  const modalTitle = { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 18 };
  const modalLabel = { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 };
  const modalInput = { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16, color: "#111827", borderWidth: 1, borderColor: "#E5E7EB" };
  const modalButtons = { flexDirection: "row", gap: 12, marginTop: 4 };
  const modalCancelBtn = { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 14, alignItems: "center" };
  const modalCancelText = { fontWeight: "600", color: "#6B7280", fontSize: 15 };
  const modalConfirmBtn = { flex: 1, backgroundColor: "#081126", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 48, shadowColor: "#081126", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 };
  const modalConfirmText = { fontWeight: "700", color: "#9AEA62", fontSize: 15 };

  return (
    <View style={{ flex: 1, backgroundColor: "#050a16" }}>
      {/* Header */}
      <View style={{ backgroundColor: "#050a16", paddingHorizontal: 16, paddingVertical: 14 }}>
        {/* Top row — same as main page */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={onBack}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="arrow-back" size={20} color="#EFC18F" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: "#EFC18F", fontWeight: "600", fontSize: 20 }}>Flash's</Text>
              <Text style={{ color: "#EFC18F", fontWeight: "800", fontSize: 30, lineHeight: 34 }}>Bill Splitter</Text>
            </View>
          </View>

          <View style={{ alignItems: "center", gap: 6 }}>
            <Image
              source={{
                uri: backendUser?.profilePicture ||
                  `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(backendUser?.username || backendUser?.email || "user")}&size=80&backgroundColor=b6e3f4`,
              }}
              style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#EFC18F", backgroundColor: "#1F2937" }}
            />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
              {backendUser?.fullname || backendUser?.username || backendUser?.email?.split("@")[0] || "You"}
            </Text>
          </View>
        </View>

        {/* Group info strip */}
        <View style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15, flex: 1 }} numberOfLines={1}>{group.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: categoryColor + "33", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: categoryColor, fontWeight: "700", fontSize: 13 }}>{formatCurrency(totalExpenses, group.currency)}</Text>
              </View>
              <TouchableOpacity onPress={openInvite} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(154,234,98,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="qr-code-outline" size={16} color="#9AEA62" />
              </TouchableOpacity>
              {isCreator && (
                <TouchableOpacity onPress={openEditGroup} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {/* Members avatars + add button */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {members.slice(0, 5).map((m, index) => (
              <TouchableOpacity
                key={m._id || m.name || index}
                onLongPress={() => isCreator && handleRemoveMember(m)}
                delayLongPress={400}
                style={{ marginLeft: index === 0 ? 0 : -10 }}
              >
                <Image
                  source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(m.name || "user")}&size=60&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf` }}
                  style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#050a16", backgroundColor: "#1e293b" }}
                />
              </TouchableOpacity>
            ))}
            {members.length > 5 && (
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
                marginLeft: -10, borderWidth: 2, borderColor: "#050a16",
              }}>
                <Text style={{ color: "#9AEA62", fontSize: 10, fontWeight: "700" }}>+{members.length - 5}</Text>
              </View>
            )}
            {/* Add member */}
            <TouchableOpacity
              onPress={() => { setAddMemberTargetExpenseId(null); setShowAddMember(true); }}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: "#9AEA62", alignItems: "center", justifyContent: "center",
                marginLeft: members.length === 0 ? 0 : -10,
                borderWidth: 2, borderColor: "#050a16",
              }}
            >
              <Ionicons name="add" size={18} color="#081126" />
            </TouchableOpacity>
            <Text style={{ color: "#64748b", fontSize: 12, marginLeft: 10 }}>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", marginTop: 10, gap: 6 }}>
          {[{ key: "expenses", label: "Expenses" }, { key: "balances", label: "Balances" }, { key: "activity", label: "Activity" }].map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: activeTab === t.key ? "#9AEA62" : "rgba(255,255,255,0.1)", alignItems: "center" }}
            >
              <Text style={{ color: activeTab === t.key ? "#081126" : "#9CA3AF", fontWeight: "600", fontSize: 12 }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1, backgroundColor: "#050a16" }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#9AEA62"]} tintColor="#9AEA62" />}>
        {activeTab === "expenses" && (
          <>
            <TouchableOpacity
              onPress={() => {
                resetExpenseForm();
                setExpCategory(defaultExpenseCategoryForGroup(group.category));
                setShowAddExpense(true);
              }}
              style={{ backgroundColor: "#9AEA62", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ color: "#081126", fontWeight: "700", fontSize: 15 }}>+ Add Expense</Text>
            </TouchableOpacity>

            {/* Expense search */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "#1e293b", marginBottom: 10 }}>
              <Ionicons name="search-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                value={expenseSearch}
                onChangeText={setExpenseSearch}
                placeholder="Search expenses..."
                placeholderTextColor="#475569"
                style={{ flex: 1, color: "#f1f5f9", fontSize: 13 }}
                autoCapitalize="none"
              />
              {expenseSearch.length > 0 && (
                <TouchableOpacity onPress={() => setExpenseSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#475569" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="always" style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
                {EXPENSE_FILTER_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setExpenseCategoryFilter(c.value)}
                    activeOpacity={0.7}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: expenseCategoryFilter === c.value ? "#9AEA62" : "#1e293b" }}
                  >
                    <Text style={{ color: expenseCategoryFilter === c.value ? "#081126" : "#9CA3AF", fontWeight: "600", fontSize: 12 }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <LottieView
                  source={require("@/app/animations/coin.json")}
                  autoPlay
                  loop
                  style={{ width: 120, height: 120 }}
                />
              </View>
            ) : expenses.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="receipt-outline" size={48} color="#374151" />
                <Text style={{ color: "#6B7280", marginTop: 10 }}>No expenses yet</Text>
              </View>
            ) : (() => {
              const visibleExpenses = expenses.filter((exp) => {
                const matchSearch = matchesExpenseSearch(exp, expenseSearch);
                const matchCat = matchesExpenseCategoryFilter(exp, expenseCategoryFilter);
                return matchSearch && matchCat;
              });
              if (visibleExpenses.length === 0) {
                return (
                  <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    <Ionicons name="filter-outline" size={40} color="#374151" />
                    <Text style={{ color: "#9CA3AF", marginTop: 10, textAlign: "center", paddingHorizontal: 16 }}>
                      No expenses match this filter. Try &quot;All&quot; or another category.
                    </Text>
                  </View>
                );
              }
              return visibleExpenses.map((exp) => (
                <View key={exp._id} style={{ backgroundColor: "#EEC08C", borderRadius: 28, borderWidth: 1, overflow: "hidden", marginBottom: 14 }}>
                  {/* Action buttons row — Edit + Delete */}
                  {(isCreator || exp.createdBy === (backendUser?._id || backendUser?.id)) && (
                    <View style={{ position: "absolute", top: 12, right: 12, zIndex: 10, flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => openEditExpense(exp)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="pencil-outline" size={15} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(exp._id)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ padding: 16 }}>
                    {/* Receipt label */}
                    <Text style={{ backgroundColor: "#1F2937", color: "white", alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, fontSize: 12, fontWeight: "700", marginBottom: 12 }}>Receipt</Text>

                    {/* Dashed divider with cutouts */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      <View className="rounded-r-full" style={{ width: 14, height: 18 ,backgroundColor: "#050a16", marginLeft: -16 }} />
                      <View style={{ flex: 1, borderTopWidth: 2, borderColor: "#050a16", borderStyle: "dashed", marginHorizontal: 4 }} />
                      <View className="rounded-l-full" style={{ width: 14, height: 18, backgroundColor: "#050a16", marginRight: -16 }} />
                    </View>

                    {/* Description */}
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ color: "#475569", fontSize: 10, fontWeight: "600", marginBottom: 2 }}>Description</Text>
                      <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 20 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {exp.description}
                      </Text>
                    </View>

                    {/* Amount */}
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ color: "#475569", fontSize: 10, fontWeight: "600", marginBottom: 2 }}>Amount</Text>
                      <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 28 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {formatCurrency(exp.amount, group.currency)}
                      </Text>
                    </View>

                    {/* Paid by + date */}
                    <View style={{ backgroundColor: "#1F2937", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Image
                          source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(resolvePayer(exp?.paidBy) || "user")}&size=60&backgroundColor=b6e3f4,c0aede,d1d4f9` }}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#374151" }}
                        />
                        <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Paid by <Text style={{ color: "#9AEA62", fontWeight: "700" }}>{resolvePayer(exp?.paidBy)}</Text></Text>
                      </View>
                      <Text style={{ color: "#6B7280", fontSize: 11 }}>{formatDate(exp.expenseDate || exp.createdAt)}</Text>
                    </View>

                    {/* Notes */}
                    {!!exp.notes && (
                      <View style={{ marginTop: 10, backgroundColor: "#f8f0e0", borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: "#d4a56a" }}>
                        <Text style={{ color: "#475569", fontSize: 10, fontWeight: "700", marginBottom: 3 }}>NOTE</Text>
                        <Text style={{ color: "#374151", fontSize: 13 }}>{exp.notes}</Text>
                      </View>
                    )}

                    {(() => {
                      const splitMembers = exp?.splits?.length > 0
                        ? exp.splits.map((s) => ({ name: idToName[s.userId] || s.name, userId: s.userId })).filter((m) => m.name)
                        : (exp?.splitAmong || []).map((name) => ({ name, userId: null }));
                      if (splitMembers.length === 0) return null;
                      return (
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ color: "#475569", fontSize: 10, fontWeight: "700", marginBottom: 8 }}>SPLIT BETWEEN</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                            {splitMembers.map((sm, i) => (
                              <TouchableOpacity
                                key={i}
                                onLongPress={() => {
                                  if (!isCreator) return;
                                  const member = members.find((m) => (m.userId || m._id) === sm.userId) || { name: sm.name, userId: sm.userId };
                                  handleRemoveMember(member);
                                }}
                                delayLongPress={400}
                                style={{ alignItems: "center", gap: 4 }}
                              >
                                <Image
                                  source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(sm.name)}&size=60&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf` }}
                                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#1F2937", backgroundColor: "#374151" }}
                                />
                                <Text style={{ color: "#0F172A", fontSize: 10, fontWeight: "600", maxWidth: 48, textAlign: "center" }} numberOfLines={1}>{sm.name}</Text>
                              </TouchableOpacity>
                            ))}
                            {/* Add member to this expense */}
                            <View style={{ alignItems: "center", gap: 4 }}>
                              <TouchableOpacity
                                onPress={() => {
                                  setAddMemberTargetExpenseId(exp._id);
                                  setShowAddMember(true);
                                }}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#9AEA62", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1F2937" }}
                              >
                                <Ionicons name="add" size={20} color="#081126" />
                              </TouchableOpacity>
                              <Text style={{ color: "#0F172A", fontSize: 10, fontWeight: "600" }}>Add</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    {/* ── Receipt Images ── */}
                    <ReceiptImages
                      exp={exp}
                      groupId={group._id}
                      currentUserId={backendUser?._id || backendUser?.id}
                      isCreator={isCreator}
                      onUpdate={(res) => { if (res.group) setGroup(res.group); if (res.balances) setBalances(res.balances); }}
                      idToName={idToName}
                    />
                  </View>
                </View>
              ));
            })()}
          </>
        )}

        {activeTab === "balances" && (
          <>
            <TouchableOpacity
              onPress={() => setShowSettle(true)}
              style={{ backgroundColor: "#9AEA62", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 20 }}
            >
              <Text style={{ color: "#081126", fontWeight: "700", fontSize: 15 }}>Record Settlement</Text>
            </TouchableOpacity>

            {balances.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="scale-outline" size={48} color="#374151" />
                <Text style={{ color: "#6B7280", marginTop: 10 }}>No expenses yet</Text>
              </View>
            ) : (
              <>
                {/* Who owes / is owed */}
                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>NET BALANCES</Text>
                {balances.map((b) => {
                  const bName = resolveName(b.userId, b.name);
                  return (
                  <View key={b.userId} style={{ backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#1e293b" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Image
                        source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(bName)}&size=60&backgroundColor=b6e3f4,c0aede,d1d4f9` }}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#1e293b" }}
                      />
                      <View>
                        <Text style={{ fontWeight: "700", color: "#f1f5f9", fontSize: 15 }}>{bName}</Text>
                        <Text style={{ fontSize: 12, color: b.balance >= 0 ? "#9AEA62" : "#EF4444", fontWeight: "600", marginTop: 2 }}>
                          {b.balance > 0.01
                            ? `gets back ${formatCurrency(b.balance, group.currency)}`
                            : b.balance < -0.01
                            ? `owes ${formatCurrency(Math.abs(b.balance), group.currency)}`
                            : "settled up ✓"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: b.balance >= 0 ? "rgba(154,234,98,0.15)" : "rgba(239,68,68,0.15)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                      <Text style={{ fontWeight: "800", fontSize: 15, color: b.balance >= 0 ? "#9AEA62" : "#EF4444" }}>
                        {b.balance >= 0 ? "+" : ""}{formatCurrency(b.balance, group.currency)}
                      </Text>
                    </View>
                  </View>
                )})}

                {/* Who should pay whom */}
                {debts.length > 0 && (
                  <>
                    <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 10 }}>SETTLE UP</Text>
                    {debts.map((d, i) => {
                      const fromName = resolveName(d.fromUserId, d.fromName);
                      const toName = resolveName(d.toUserId, d.toName);
                      return (
                      <View key={i} style={{ backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#1e293b" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          {/* From */}
                          <View style={{ alignItems: "center", gap: 4 }}>
                            <Image
                              source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(fromName)}&size=60&backgroundColor=ffd5dc,ffdfbf` }}
                              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#1e293b" }}
                            />
                            <Text style={{ color: "#f1f5f9", fontSize: 12, fontWeight: "600" }}>{fromName}</Text>
                            <Text style={{ color: "#EF4444", fontSize: 10 }}>pays</Text>
                          </View>

                          {/* Arrow + amount */}
                          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                            <Text style={{ color: "#9AEA62", fontWeight: "800", fontSize: 18 }}>
                              {formatCurrency(d.amount, group.currency)}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <View style={{ flex: 1, height: 1.5, backgroundColor: "#334155" }} />
                              <Ionicons name="arrow-forward" size={16} color="#9AEA62" />
                              <View style={{ flex: 1, height: 1.5, backgroundColor: "#334155" }} />
                            </View>
                          </View>

                          {/* To */}
                          <View style={{ alignItems: "center", gap: 4 }}>
                            <Image
                              source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(toName)}&size=60&backgroundColor=b6e3f4,c0aede` }}
                              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#1e293b" }}
                            />
                            <Text style={{ color: "#f1f5f9", fontSize: 12, fontWeight: "600" }}>{toName}</Text>
                            <Text style={{ color: "#9AEA62", fontSize: 10 }}>receives</Text>
                          </View>
                        </View>
                      </View>
                    )})}
                  </>
                )}

                {debts.length === 0 && balances.length > 0 && (
                  <View style={{ backgroundColor: "rgba(154,234,98,0.1)", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(154,234,98,0.3)" }}>
                    <Ionicons name="checkmark-circle" size={32} color="#9AEA62" />
                    <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 15, marginTop: 8 }}>All settled up!</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "activity" && (() => {
          const activityItems = [];
          expenses.forEach((exp) => {
            activityItems.push({
              id: `exp_${exp._id}`,
              icon: "receipt-outline",
              iconColor: "#F59E0B",
              iconBg: "rgba(245,158,11,0.15)",
              title: exp.description,
              subtitle: `${formatCurrency(exp.amount, group.currency)} · paid by ${resolvePayer(exp?.paidBy) || "someone"}`,
              time: exp.expenseDate || exp.createdAt,
              type: "expense",
              category: exp.category,
            });
          });
          settlements.forEach((s, i) => {
            const fromN = resolveName(s.fromUserId, s.fromName || s.from);
            const toN = resolveName(s.toUserId, s.toName || s.to);
            activityItems.push({
              id: `set_${i}_${s.createdAt || i}`,
              icon: "checkmark-circle-outline",
              iconColor: "#9AEA62",
              iconBg: "rgba(154,234,98,0.15)",
              title: `${fromN} paid ${toN}`,
              subtitle: formatCurrency(s.amount, group.currency),
              time: s.createdAt,
              type: "settlement",
            });
          });
          activityItems.sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return new Date(b.time) - new Date(a.time);
          });

          if (activityItems.length === 0) {
            return (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="time-outline" size={48} color="#374151" />
                <Text style={{ color: "#6B7280", marginTop: 10 }}>No activity yet</Text>
              </View>
            );
          }

          return activityItems.map((item) => (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#1e293b" }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: item.iconBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{item.subtitle}</Text>
                {item.category && item.category !== "other" && (
                  <View style={{ marginTop: 4, alignSelf: "flex-start", backgroundColor: (CATEGORY_COLORS[item.category] || "#6B7280") + "33", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ color: CATEGORY_COLORS[item.category] || "#6B7280", fontSize: 10, fontWeight: "700" }}>{item.category}</Text>
                  </View>
                )}
              </View>
              {item.time && (
                <Text style={{ color: "#475569", fontSize: 11, flexShrink: 0 }}>{formatDate(item.time)}</Text>
              )}
            </View>
          ));
        })()}

      </ScrollView>

      {/* Add Expense Modal */}
      <ExpenseModalFrame
        visible={showAddExpense}
        onRequestClose={() => { setShowAddExpense(false); resetExpenseForm(); }}
        onDismiss={() => { setShowAddExpense(false); resetExpenseForm(); }}
        keyboardPad={expenseModalKeyboardHeight}
        bottomInset={insets.bottom}
        sheetMaxHeight={expenseSheetMaxHeight}
        scrollMaxHeight={expenseScrollMaxHeight}
        keyboardOpen={expenseModalKeyboardHeight > 0}
        scrollRef={addExpenseScrollRef}
        header={(
          <View style={{ paddingHorizontal: 24, paddingTop: 12, flexShrink: 0 }}>
            <View style={modalHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={[modalTitle, { marginBottom: 0 }]}>Add Expense</Text>
              {/* <TouchableOpacity
                onPress={handleScanReceipt}
                disabled={scanning}
                style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#9AEA62", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
              >
                {scanning ? (
                  <ActivityIndicator size={14} color="#9AEA62" />
                ) : (
                  <Ionicons name="scan-outline" size={15} color="#166534" />
                )}
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#166534" }}>
                  {scanning ? "Scanning…" : "Scan Receipt"}
                </Text>
              </TouchableOpacity> */}
            </View>
          </View>
        )}
        footer={(
          <View style={modalButtons}>
            <TouchableOpacity onPress={() => { setShowAddExpense(false); resetExpenseForm(); }} style={modalCancelBtn}>
              <Text style={modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddExpense} disabled={addingExpense} style={[modalConfirmBtn, { opacity: addingExpense ? 0.6 : 1 }]}>
              {addingExpense ? <ActivityIndicator color="#9AEA62" size="small" /> : <Text style={modalConfirmText}>Add expense</Text>}
            </TouchableOpacity>
          </View>
        )}
      >
            {(() => {
              const selectedUserIds = expForm.splitAmongUserIds.length > 0 ? expForm.splitAmongUserIds : members.map(memberId);
              const pctTotal = selectedUserIds.reduce((sum, id) => sum + parseFloat(expForm.percentageSplits[id] || "0"), 0);
              const exactTotal = selectedUserIds.reduce((sum, id) => sum + parseFloat(expForm.exactSplits[id] || "0"), 0);
              return (
                <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#BBF7D0" }}>
                  <Text style={{ color: "#166534", fontWeight: "700", fontSize: 12 }}>
                    Split preview: {selectedUserIds.length} member(s)
                    {expForm.splitMethod === "percentage" ? ` • ${pctTotal.toFixed(1)}%` : ""}
                    {expForm.splitMethod === "exact" ? ` • ${group.currency} ${exactTotal.toFixed(2)}` : ""}
                  </Text>
                </View>
              );
            })()}

            <Text style={modalLabel}>DESCRIPTION *</Text>
            <TextInput
              value={expForm.description}
              onChangeText={(v) => setExpForm({ ...expForm, description: v })}
              style={modalInput}
              placeholder="What for?"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={modalLabel}>AMOUNT *</Text>
            <TextInput
              value={expForm.amount}
              onChangeText={(v) => setExpForm({ ...expForm, amount: v })}
              style={modalInput}
              placeholder={`Amount (${group.currency})`}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />

            <Text style={modalLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
                {[...CATEGORIES, { value: "other", label: "Other" }].map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setExpCategory(c.value)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: expCategory === c.value ? "#081126" : "#F3F4F6" }}
                  >
                    <Text style={{ color: expCategory === c.value ? "#9AEA62" : "#374151", fontWeight: "600", fontSize: 13 }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>PAID BY *</Text>
            {!expForm.paidByUserId && (
              <Text style={{ color: "#B45309", fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                Tap who paid for this expense
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => (
                  <TouchableOpacity key={memberId(m)} onPress={() => setExpForm({ ...expForm, paidByUserId: memberId(m) })}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: expForm.paidByUserId === memberId(m) ? "#081126" : "#F3F4F6", borderWidth: expForm.paidByUserId === memberId(m) ? 0 : 1, borderColor: "#E5E7EB" }}>
                    <Text style={{ color: expForm.paidByUserId === memberId(m) ? "#9AEA62" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>SPLIT AMONG</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => {
                  const sel = expForm.splitAmongUserIds.includes(memberId(m));
                  return (
                    <TouchableOpacity key={memberId(m)} onPress={() => setExpForm((prev) => ({
                      ...prev,
                      splitAmongUserIds: sel ? prev.splitAmongUserIds.filter((id) => id !== memberId(m)) : [...prev.splitAmongUserIds, memberId(m)]
                    }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? "#9AEA62" : "#F3F4F6" }}>
                      <Text style={{ color: sel ? "#081126" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setExpForm((prev) => ({ ...prev, splitAmongUserIds: members.map(memberId) }))} style={{ backgroundColor: "#E5E7EB", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: "#374151", fontSize: 12, fontWeight: "600" }}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpForm((prev) => ({ ...prev, splitAmongUserIds: [] }))} style={{ backgroundColor: "#E5E7EB", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: "#374151", fontSize: 12, fontWeight: "600" }}>Auto (all)</Text>
              </TouchableOpacity>
            </View>

            <Text style={modalLabel}>SPLIT TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[{ key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percentage", label: "%" }, { key: "shares", label: "Shares" }].map((m) => (
                  <TouchableOpacity key={m.key} onPress={() => setExpForm((prev) => ({ ...prev, splitMethod: m.key }))}
                    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: expForm.splitMethod === m.key ? "#081126" : "#F3F4F6" }}>
                    <Text style={{ color: expForm.splitMethod === m.key ? "#9AEA62" : "#374151", fontWeight: "700" }}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {expForm.splitMethod === "percentage" && (
              <TouchableOpacity onPress={() => {
                const selected = expForm.splitAmongUserIds.length > 0 ? expForm.splitAmongUserIds : members.map(memberId);
                if (!selected.length) return;
                const base = Math.floor((100 / selected.length) * 100) / 100;
                const rem = Math.round((100 - base * selected.length) * 100) / 100;
                const map = {};
                selected.forEach((id, i) => { map[id] = String(i === 0 ? base + rem : base); });
                setExpForm((prev) => ({ ...prev, percentageSplits: { ...prev.percentageSplits, ...map } }));
              }} style={{ backgroundColor: "#F0FDF4", borderRadius: 10, paddingVertical: 9, alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#BBF7D0" }}>
                <Text style={{ color: "#166534", fontWeight: "700", fontSize: 12 }}>Auto distribute equally</Text>
              </TouchableOpacity>
            )}

            {expForm.splitMethod !== "equal" && (() => {
              const splitUids = expForm.splitAmongUserIds.length > 0 ? expForm.splitAmongUserIds : members.map(memberId);
              const listMaxH = splitListMaxHeight(splitUids.length);
              return (
              <View style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 10, marginBottom: 14, maxHeight: listMaxH, borderWidth: 1, borderColor: "#E5E7EB" }}>
                {splitUids.length > 4 && (
                  <Text style={{ color: "#6B7280", fontSize: 11, marginBottom: 6 }}>Scroll to see all members</Text>
                )}
                <ScrollView showsVerticalScrollIndicator={splitUids.length > 4} nestedScrollEnabled>
                  {splitUids.map((uid) => {
                    const member = members.find((m) => memberId(m) === uid);
                    if (!member) return null;
                    const isShares = expForm.splitMethod === "shares";
                    const stateKey = expForm.splitMethod === "exact" ? "exactSplits" : expForm.splitMethod === "percentage" ? "percentageSplits" : "sharesSplits";
                    const value = isShares
                      ? getSharesSplitDisplayValue(expForm.sharesSplits, uid)
                      : expForm.splitMethod === "exact"
                        ? expForm.exactSplits[uid] || ""
                        : expForm.percentageSplits[uid] || "";
                    return (
                      <View key={uid} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                        <Text style={{ flex: 1, color: "#111827", fontWeight: "600" }}>{idToName[uid] || member.name}</Text>
                        <View style={{ width: 110, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 8 }}>
                          <Text style={{ color: "#9CA3AF", marginRight: 4 }}>{expForm.splitMethod === "exact" ? group.currency : expForm.splitMethod === "percentage" ? "%" : "×"}</Text>
                          <TextInput
                            value={String(value)}
                            onChangeText={(v) => {
                              const next = isShares ? sanitizeSharesInput(v) : v;
                              setExpForm((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [uid]: next } }));
                            }}
                            placeholder={isShares ? "1" : expForm.splitMethod === "exact" ? "0.00" : "0"}
                            placeholderTextColor="#9CA3AF"
                            keyboardType={isShares ? "number-pad" : "decimal-pad"}
                            selectTextOnFocus={isShares}
                            style={{ flex: 1, paddingVertical: 8, color: "#111827" }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
              );
            })()}

            {/* Date */}
            <Text style={modalLabel}>EXPENSE DATE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => setUseCustomDate((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: useCustomDate ? "#081126" : "#F3F4F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
              >
                <Ionicons name={useCustomDate ? "calendar" : "calendar-outline"} size={15} color={useCustomDate ? "#9AEA62" : "#374151"} />
                <Text style={{ color: useCustomDate ? "#9AEA62" : "#374151", fontWeight: "600", fontSize: 13 }}>
                  {useCustomDate ? expDate.toLocaleDateString() : "Today"}
                </Text>
              </TouchableOpacity>
              {useCustomDate && (
                <TouchableOpacity onPress={() => setShowExpDatePicker(true)}
                  style={{ backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>Change</Text>
                </TouchableOpacity>
              )}
            </View>
            {showExpDatePicker && (
              <DateTimePicker
                value={expDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(e, d) => {
                  setShowExpDatePicker(Platform.OS === "ios");
                  if (e.type !== "dismissed" && d) { setExpDate(d); setUseCustomDate(true); }
                }}
              />
            )}

            {/* Notes */}
            <View
              onLayout={(e) => {
                addNotesFieldY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={modalLabel}>NOTES (optional)</Text>
              <TextInput
                value={expForm.notes}
                onChangeText={(v) => setExpForm((prev) => ({ ...prev, notes: v }))}
                onFocus={() => scrollToFieldY(addExpenseScrollRef, addNotesFieldY.current)}
                style={[modalInput, { height: 70, textAlignVertical: "top", marginBottom: 0 }]}
                placeholder="Any extra details..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>
      </ExpenseModalFrame>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} transparent animationType="slide" hardwareAccelerated onRequestClose={() => { setShowAddMember(false); setMemberName(""); setAddMemberTargetExpenseId(null); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => { setShowAddMember(false); setMemberName(""); setAddMemberTargetExpenseId(null); }} />
          <KeyboardAvoidingView style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
          <View style={modalSheet}>
            <View style={modalHandle} />
            <Text style={modalTitle}>Add Member</Text>
            {addMemberTargetExpenseId && (
              <View style={{ backgroundColor: "#FFF7ED", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: "#FED7AA" }}>
                <Text style={{ color: "#C2410C", fontSize: 12, fontWeight: "600" }}>This member will be added to the selected expense and the split will be recalculated equally.</Text>
              </View>
            )}
            <Text style={modalLabel}>NAME *</Text>
            <TextInput value={memberName} onChangeText={setMemberName}
              style={modalInput} placeholder="Enter member name" placeholderTextColor="#9CA3AF" autoFocus />
            <Text style={modalLabel}>EMAIL (optional — sends them a notification)</Text>
            <TextInput value={memberEmail} onChangeText={setMemberEmail}
              style={modalInput} placeholder="member@email.com" placeholderTextColor="#9CA3AF"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <View style={modalButtons}>
              <TouchableOpacity onPress={() => { setShowAddMember(false); setMemberName(""); setAddMemberTargetExpenseId(null); }} style={modalCancelBtn}>
                <Text style={modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddMember} disabled={addingMember} style={[modalConfirmBtn, { opacity: addingMember ? 0.6 : 1 }]}>
                {addingMember ? <ActivityIndicator color="#081126" size="small" /> : <Text style={modalConfirmText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <ExpenseModalFrame
        visible={showEditExpense}
        onRequestClose={() => { setShowEditExpense(false); setEditingExpense(null); }}
        onDismiss={() => { setShowEditExpense(false); setEditingExpense(null); }}
        keyboardPad={expenseModalKeyboardHeight}
        bottomInset={insets.bottom}
        sheetMaxHeight={expenseSheetMaxHeight}
        scrollMaxHeight={expenseScrollMaxHeight}
        keyboardOpen={expenseModalKeyboardHeight > 0}
        scrollRef={editExpenseScrollRef}
        header={(
          <View style={{ paddingHorizontal: 24, paddingTop: 12, flexShrink: 0 }}>
            <View style={modalHandle} />
            <Text style={[modalTitle, { marginBottom: 12 }]}>Edit Expense</Text>
          </View>
        )}
        footer={(
          <View style={modalButtons}>
            <TouchableOpacity onPress={() => { setShowEditExpense(false); setEditingExpense(null); }} style={modalCancelBtn}>
              <Text style={modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditExpense} disabled={editingExp} style={[modalConfirmBtn, { opacity: editingExp ? 0.6 : 1 }]}>
              {editingExp ? <ActivityIndicator color="#081126" size="small" /> : <Text style={modalConfirmText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      >
            <Text style={modalLabel}>DESCRIPTION *</Text>
            <TextInput
              value={editExpForm.description}
              onChangeText={(v) => setEditExpForm((p) => ({ ...p, description: v }))}
              style={modalInput}
              placeholder="What for?"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={modalLabel}>AMOUNT *</Text>
            <TextInput
              value={editExpForm.amount}
              onChangeText={(v) => setEditExpForm((p) => ({ ...p, amount: v }))}
              style={modalInput}
              placeholder={`Amount (${group.currency})`}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />

            <Text style={modalLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
                {[...CATEGORIES, { value: "other", label: "Other" }].map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setEditExpCategory(c.value)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: editExpCategory === c.value ? "#081126" : "#F3F4F6" }}
                  >
                    <Text style={{ color: editExpCategory === c.value ? "#9AEA62" : "#374151", fontWeight: "600", fontSize: 13 }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>PAID BY *</Text>
            {!editExpForm.paidByUserId && (
              <Text style={{ color: "#B45309", fontSize: 12, marginBottom: 8, marginTop: -4 }}>
                Tap who paid for this expense
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => (
                  <TouchableOpacity key={memberId(m)} onPress={() => setEditExpForm((p) => ({ ...p, paidByUserId: memberId(m) }))}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: editExpForm.paidByUserId === memberId(m) ? "#081126" : "#F3F4F6", borderWidth: editExpForm.paidByUserId === memberId(m) ? 0 : 1, borderColor: "#E5E7EB" }}>
                    <Text style={{ color: editExpForm.paidByUserId === memberId(m) ? "#9AEA62" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>SPLIT AMONG</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => {
                  const sel = editExpForm.splitAmongUserIds.includes(memberId(m));
                  return (
                    <TouchableOpacity key={memberId(m)} onPress={() => setEditExpForm((prev) => ({
                      ...prev,
                      splitAmongUserIds: sel ? prev.splitAmongUserIds.filter((id) => id !== memberId(m)) : [...prev.splitAmongUserIds, memberId(m)]
                    }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? "#9AEA62" : "#F3F4F6" }}>
                      <Text style={{ color: sel ? "#081126" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={modalLabel}>SPLIT TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[{ key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percentage", label: "%" }, { key: "shares", label: "Shares" }].map((m) => (
                  <TouchableOpacity key={m.key} onPress={() => setEditExpForm((p) => ({ ...p, splitMethod: m.key }))}
                    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: editExpForm.splitMethod === m.key ? "#081126" : "#F3F4F6" }}>
                    <Text style={{ color: editExpForm.splitMethod === m.key ? "#9AEA62" : "#374151", fontWeight: "700" }}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {editExpForm.splitMethod !== "equal" && (() => {
              const splitUids = editExpForm.splitAmongUserIds.length > 0 ? editExpForm.splitAmongUserIds : members.map(memberId);
              const listMaxH = splitListMaxHeight(splitUids.length);
              return (
              <View style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 10, marginBottom: 14, maxHeight: listMaxH, borderWidth: 1, borderColor: "#E5E7EB" }}>
                {splitUids.length > 4 && (
                  <Text style={{ color: "#6B7280", fontSize: 11, marginBottom: 6 }}>Scroll to see all members</Text>
                )}
                <ScrollView showsVerticalScrollIndicator={splitUids.length > 4} nestedScrollEnabled>
                  {splitUids.map((uid) => {
                    const member = members.find((m) => memberId(m) === uid);
                    if (!member) return null;
                    const isShares = editExpForm.splitMethod === "shares";
                    const stateKey = editExpForm.splitMethod === "exact" ? "exactSplits" : editExpForm.splitMethod === "percentage" ? "percentageSplits" : "sharesSplits";
                    const value = isShares
                      ? getSharesSplitDisplayValue(editExpForm.sharesSplits, uid)
                      : editExpForm[stateKey][uid] || "";
                    return (
                      <View key={uid} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                        <Text style={{ flex: 1, color: "#111827", fontWeight: "600" }}>{idToName[uid] || member.name}</Text>
                        <View style={{ width: 110, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 8 }}>
                          <Text style={{ color: "#9CA3AF", marginRight: 4 }}>{editExpForm.splitMethod === "exact" ? group.currency : editExpForm.splitMethod === "percentage" ? "%" : "×"}</Text>
                          <TextInput
                            value={String(value)}
                            onChangeText={(v) => {
                              const next = isShares ? sanitizeSharesInput(v) : v;
                              setEditExpForm((prev) => ({ ...prev, [stateKey]: { ...prev[stateKey], [uid]: next } }));
                            }}
                            placeholder={isShares ? "1" : "0"}
                            placeholderTextColor="#9CA3AF"
                            keyboardType={isShares ? "number-pad" : "decimal-pad"}
                            selectTextOnFocus={isShares}
                            style={{ flex: 1, paddingVertical: 8, color: "#111827" }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
              );
            })()}

            {/* Date */}
            <Text style={modalLabel}>EXPENSE DATE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => setShowEditExpDatePicker(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                <Ionicons name="calendar-outline" size={15} color="#374151" />
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>{editExpDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
            {showEditExpDatePicker && (
              <DateTimePicker
                value={editExpDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(e, d) => {
                  setShowEditExpDatePicker(Platform.OS === "ios");
                  if (e.type !== "dismissed" && d) setEditExpDate(d);
                }}
              />
            )}

            {/* Notes */}
            <View
              onLayout={(e) => {
                editNotesFieldY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={modalLabel}>NOTES (optional)</Text>
              <TextInput
                value={editExpForm.notes}
                onChangeText={(v) => setEditExpForm((p) => ({ ...p, notes: v }))}
                onFocus={() => scrollToFieldY(editExpenseScrollRef, editNotesFieldY.current)}
                style={[modalInput, { height: 70, textAlignVertical: "top", marginBottom: 0 }]}
                placeholder="Any extra details..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>
      </ExpenseModalFrame>

      {/* Settlement Modal */}
      <Modal visible={showSettle} transparent animationType="slide" hardwareAccelerated onRequestClose={() => setShowSettle(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setShowSettle(false)} />
          <KeyboardAvoidingView style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
          <View style={modalSheet}>
            <View style={modalHandle} />
            <Text style={modalTitle}>Record Settlement</Text>

            <Text style={modalLabel}>FROM (who pays)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => (
                  <TouchableOpacity key={memberId(m)} onPress={() => setSettleForm({ ...settleForm, fromUserId: memberId(m) })}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: settleForm.fromUserId === memberId(m) ? "#EF4444" : "#F3F4F6" }}>
                    <Text style={{ color: settleForm.fromUserId === memberId(m) ? "white" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>TO (who receives)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => (
                  <TouchableOpacity key={memberId(m)} onPress={() => setSettleForm({ ...settleForm, toUserId: memberId(m) })}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: settleForm.toUserId === memberId(m) ? "#10B981" : "#F3F4F6" }}>
                    <Text style={{ color: settleForm.toUserId === memberId(m) ? "white" : "#374151", fontWeight: "600" }}>{idToName[memberId(m)] || m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>AMOUNT</Text>
            <TextInput value={settleForm.amount} onChangeText={(v) => setSettleForm({ ...settleForm, amount: v })}
              style={modalInput} placeholder={`Amount (${group.currency})`} placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />

            <View style={modalButtons}>
              <TouchableOpacity onPress={() => setShowSettle(false)} style={modalCancelBtn}>
                <Text style={modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSettle} disabled={settling} style={[modalConfirmBtn, { opacity: settling ? 0.6 : 1 }]}>
                {settling ? <ActivityIndicator color="#081126" size="small" /> : <Text style={modalConfirmText}>Record</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Edit Group Modal ── */}
      <Modal visible={showEditGroup} transparent animationType="slide" hardwareAccelerated onRequestClose={() => setShowEditGroup(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={{ position: "absolute", inset: 0, flex: 1 }} activeOpacity={1} onPress={() => setShowEditGroup(false)} />
          <KeyboardAvoidingView style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
          <View style={modalSheet}>
            <View style={modalHandle} />
            <Text style={modalTitle}>Edit Group</Text>

            <Text style={modalLabel}>GROUP NAME *</Text>
            <TextInput value={editGroupForm.name} onChangeText={(v) => setEditGroupForm((p) => ({ ...p, name: v }))}
              style={modalInput} placeholder="Group name" placeholderTextColor="#9CA3AF" />

            <Text style={modalLabel}>DESCRIPTION</Text>
            <TextInput value={editGroupForm.description} onChangeText={(v) => setEditGroupForm((p) => ({ ...p, description: v }))}
              style={[modalInput, { height: 80, textAlignVertical: "top" }]} placeholder="Optional description" placeholderTextColor="#9CA3AF" multiline />

            <Text style={modalLabel}>CURRENCY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setEditGroupForm((p) => ({ ...p, currency: c }))}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: editGroupForm.currency === c ? "#081126" : "#F3F4F6" }}>
                    <Text style={{ color: editGroupForm.currency === c ? "#9AEA62" : "#374151", fontWeight: "600" }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={modalLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.value} onPress={() => setEditGroupForm((p) => ({ ...p, category: c.value }))}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: editGroupForm.category === c.value ? "#081126" : "#F3F4F6" }}>
                    <Text style={{ color: editGroupForm.category === c.value ? "#9AEA62" : "#374151", fontWeight: "600" }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={modalButtons}>
              <TouchableOpacity onPress={() => setShowEditGroup(false)} style={modalCancelBtn}>
                <Text style={modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditGroup} disabled={savingEditGroup} style={[modalConfirmBtn, { opacity: savingEditGroup ? 0.6 : 1 }]}>
                {savingEditGroup ? <ActivityIndicator color="#9AEA62" size="small" /> : <Text style={modalConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Invite / QR Modal ── */}
      <Modal visible={showInvite} transparent animationType="slide" hardwareAccelerated onRequestClose={() => setShowInvite(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={{ position: "absolute", inset: 0, flex: 1 }} activeOpacity={1} onPress={() => setShowInvite(false)} />
          <View style={[modalSheet, { position: "absolute", left: 0, right: 0, bottom: 0 }]}>
            <View style={modalHandle} />
            <Text style={modalTitle}>Invite to Group</Text>

            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
                {inviteLink ? <QRCode value={inviteLink} size={180} /> : null}
              </View>
              <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 10, textAlign: "center" }}>Scan to join <Text style={{ fontWeight: "700", color: "#111827" }}>{group.name}</Text></Text>
            </View>

            <View style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: "#E5E7EB" }}>
              <Text style={{ color: "#374151", fontSize: 12, fontFamily: "monospace" }} numberOfLines={2}>{inviteLink}</Text>
            </View>

            <View style={modalButtons}>
              <TouchableOpacity onPress={() => setShowInvite(false)} style={modalCancelBtn}>
                <Text style={modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareLink} style={modalConfirmBtn}>
                <Text style={modalConfirmText}>Share Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ============ Main TriCount Page ============
export default function TricountPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backTo = getBackToParam(params);
  const { backendUser, isSignedIn } = useBackendAuth();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const createGroupScrollRef = useRef(null);
  const createGroupMemberNameY = useRef(0);
  const createGroupMemberEmailY = useRef(0);
  const rawShareId = Array.isArray(params.shareId) ? params.shareId[0] : params.shareId;
  const shareIdParam = extractTricountShareId(rawShareId);
  const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const groupIdParam = rawGroupId ? String(rawGroupId).trim() : "";
  const rawPrefill = Array.isArray(params.prefill) ? params.prefill[0] : params.prefill;
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const createModalKeyboardInset = showCreate ? keyboardInset : 0;
  const createGroupFooterBottomPad = Math.max(16, insets.bottom + 16);
  const {
    sheetMaxHeight: createGroupSheetMaxHeight,
    scrollMaxHeight: createGroupScrollMaxHeight,
  } = getCreateGroupSheetLayout(createModalKeyboardInset, insets.bottom, insets.top);
  const fabBottomOffset = insets.bottom + 20;
  const listBottomPadding = insets.bottom + 88;

  const openCreateGroupModal = useCallback(() => {
    Keyboard.dismiss();
    setShowCreate(true);
  }, []);

  const closeCreateGroupModal = useCallback(() => {
    Keyboard.dismiss();
    setShowCreate(false);
  }, []);

  const [creating, setCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", currency: "USD", category: "general", members: [] });
  const [memberInput, setMemberInput] = useState("");
  const [memberEmailInput, setMemberEmailInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const searchDebounceRef = useRef(null);
  const handledShareIdRef = useRef("");
  const handledGroupIdRef = useRef("");
  const scanLockRef = useRef(false);

  // Join by QR / link
  const [showJoin, setShowJoin] = useState(false);
  const [joinTab, setJoinTab] = useState("scan"); // "scan" | "upload" | "link"
  const [joinUrl, setJoinUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const resetJoinScanner = useCallback(() => {
    scanLockRef.current = false;
    setScanned(false);
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const data = await getMyGroupsAPI();
      const list = data.groups || data.data || [];
      const sorted = [...list].sort((a, b) => {
        const aFav = a?.isFavorite ? 1 : 0;
        const bFav = b?.isFavorite ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;

        const aTime = new Date(a?.lastActivity || a?.updatedAt || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.lastActivity || b?.updatedAt || b?.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setGroups(sorted);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchGroups();
  }, [fetchGroups, isSignedIn]);

  useEffect(() => {
    if (!groupIdParam || !isSignedIn) return;

    const openGroup = async () => {
      const fromList = groups.find((g) => String(g._id) === groupIdParam);
      if (fromList) {
        setSelectedGroup(fromList);
        handledGroupIdRef.current = groupIdParam;
        return;
      }

      if (handledGroupIdRef.current === groupIdParam && selectedGroup) return;

      try {
        const data = await getGroupByIdAPI(groupIdParam);
        const group = data.group || data.data || data;
        if (group?._id) {
          setSelectedGroup(group);
          setGroups((prev) => {
            const exists = prev.some((g) => String(g._id) === String(group._id));
            return exists ? prev : [group, ...prev];
          });
        }
      } catch {
        Alert.alert("Group not found", "This split bill group may have been removed.");
      } finally {
        handledGroupIdRef.current = groupIdParam;
      }
    };

    void openGroup();
  }, [groupIdParam, groups, isSignedIn]);

  // Pre-fill group creation from event "Split Costs" deeplink
  useEffect(() => {
    if (!rawPrefill) return;
    try {
      const prefill = JSON.parse(rawPrefill);
      if (prefill.name) {
        const raw = Array.isArray(prefill.members) ? prefill.members : [];
        const seen = new Set();
        const uniqueMembers = [];
        for (const m of raw) {
          const key = String(m.userId || m.email || m.name || "").trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          uniqueMembers.push(m);
        }
        setNewGroup((prev) => ({
          ...prev,
          name: prefill.name,
          members: uniqueMembers,
        }));
        openCreateGroupModal();
      }
    } catch {}
  }, [rawPrefill, openCreateGroupModal]);

  useEffect(() => { SystemUI.setBackgroundColorAsync("#050a16"); }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery]);

  const filteredGroups = useMemo(() => {
    const active = groups.filter((g) => showArchived ? g.isArchived : !g.isArchived);
    if (!debouncedQuery) return active;
    const q = debouncedQuery.toLowerCase();
    return active.filter(
      (g) =>
        g.name?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q)
    );
  }, [groups, debouncedQuery, showArchived]);

  const archivedCount = useMemo(() => groups.filter((g) => g.isArchived).length, [groups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!newGroup.name.trim()) return Alert.alert("Error", "Group name is required");
    setCreating(true);
    try {
      const creatorName = backendUser?.username || backendUser?.name || backendUser?.email || "User";

      const data = await createGroupAPI({
        ...newGroup,
        creatorName,
        members: newGroup.members.map((m) => ({
          userId: m.userId ? String(m.userId) : "",
          name: m.name,
          email: m.email || "",
        })),
      });
      setGroups((prev) => [data.group || data.data || data, ...prev]);
      closeCreateGroupModal();
      setNewGroup({ name: "", description: "", currency: "USD", category: "general", members: [] });
      setMemberInput("");
      setMemberEmailInput("");
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to create group"));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleFavorite = async (groupId) => {
    try {
      await toggleFavoriteAPI(groupId);
      fetchGroups();
    } catch {}
  };

  const joinGroup = useCallback(async (shareId) => {
    if (!shareId) {
      return Alert.alert("Invalid Invite", INVALID_TRICOUNT_SHARE_MESSAGE);
    }

    setJoining(true);
    try {
      const data = await joinGroupByShareAPI(shareId);
      const joined = data?.group || data?.data || data;
      if (!joined?._id) throw new Error("Group unavailable");
      setShowJoin(false);
      setJoinUrl("");
      resetJoinScanner();
      await fetchGroups();
      setSelectedGroup(joined);
    } catch (err) {
      Alert.alert("Failed to Join", getErrorMessage(err, "Invalid or expired invite link."));
    } finally { setJoining(false); }
  }, [fetchGroups, resetJoinScanner]);

  const handleQRScanned = useCallback(({ data }) => {
    if (scanLockRef.current || scanned || joining) return;

    scanLockRef.current = true;
    setScanned(true);

    const shareId = extractTricountShareId(data);
    if (!shareId) {
      Alert.alert("Invalid QR Code", INVALID_TRICOUNT_SHARE_MESSAGE);
      return;
    }

    joinGroup(shareId);
  }, [joinGroup, joining, scanned]);

  const handleUploadQR = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission needed", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 0.9 });
    if (result.canceled || !result.assets?.length) return;
    setJoining(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await scanReceiptAPI(base64, result.assets[0].mimeType || "image/jpeg", "barcode");
      const barcodeValue = res?.data?.barcode;
      if (!barcodeValue) return Alert.alert("Not found", "No QR code detected in image.");

      const shareId = extractTricountShareId(barcodeValue);
      if (!shareId) {
        return Alert.alert("Invalid QR Code", INVALID_TRICOUNT_SHARE_MESSAGE);
      }

      await joinGroup(shareId);
    } catch {
      Alert.alert("Error", "Could not read QR code from image.");
    } finally { setJoining(false); }
  };

  const handleDeleteGroup = (groupId) => {
    Alert.alert("Delete Group", "Delete this group and all its data?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteGroupAPI(groupId);
          setGroups((prev) => prev.filter((g) => g._id !== groupId));
        } catch { Alert.alert("Error", "Failed to delete group"); }
      }}
    ]);
  };

  const handleArchiveGroup = async (group) => {
    const isArchived = group.isArchived;
    const action = isArchived ? "Unarchive" : "Archive";
    Alert.alert(`${action} Group`, `${action} "${group.name}"? ${isArchived ? "It will reappear in your active groups." : "You can unarchive it later."}`, [
      { text: "Cancel", style: "cancel" },
      { text: action, onPress: async () => {
        try {
          await toggleArchiveAPI(group._id);
          fetchGroups();
        } catch { Alert.alert("Error", `Failed to ${action.toLowerCase()} group`); }
      }}
    ]);
  };

  const handleShareGroup = async (group) => {
    if (!group?.shareId) {
      Alert.alert("Error", "This group cannot be shared right now.");
      return;
    }

    try {
      await shareTricountGroupInvite({
        title: group.name,
        groupName: group.name,
        shareId: group.shareId,
      });
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "Failed to share group"));
    }
  };

  const addMemberToForm = () => {
    const name = memberInput.trim();
    const email = memberEmailInput.trim();
    if (!name) return;
    if (newGroup.members.some((m) => m.name === name)) return;
    setNewGroup((prev) => ({ ...prev, members: [...prev.members, { name, email }] }));
    setMemberInput("");
    setMemberEmailInput("");
  };

  const trackedTotalsByCurrency = useMemo(
    () => sumTrackedByCurrency(groups.filter((g) => !g.isArchived)),
    [groups],
  );
  const trackedTotalsLabel = useMemo(
    () => formatTrackedTotals(trackedTotalsByCurrency),
    [trackedTotalsByCurrency],
  );

  useEffect(() => {
    if (!isSignedIn || !shareIdParam || handledShareIdRef.current === shareIdParam) {
      return;
    }

    handledShareIdRef.current = shareIdParam;

    (async () => {
      try {
        const data = await joinGroupByShareAPI(shareIdParam);
        const joinedGroup = data?.group || data?.data || data;

        if (!joinedGroup?._id) {
          throw new Error("Shared group is unavailable");
        }

        setSelectedGroup(joinedGroup);
        await fetchGroups();
      } catch (err) {
        Alert.alert(
          "Invite Error",
          getErrorMessage(err, "This split-bill invite is no longer available."),
        );
      }
    })();
  }, [fetchGroups, isSignedIn, shareIdParam]);

  if (selectedGroup) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050a16" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <GroupDetail
          group={selectedGroup}
          onBack={() => { setSelectedGroup(null); fetchGroups(); }}
          currentUsername={backendUser?.username || backendUser?.email}
          backendUser={backendUser}
        />
      </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050a16" }}>
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(139,92,246,0.55)",
          "rgba(139,92,246,0.22)",
          "rgba(139,92,246,0)",
        ]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 190 }}
      />
      {/* Header */}
      {/* <View style={{ backgroundColor: "#050a16", paddingHorizontal: 16, paddingVertical: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>Split Bill</Text>
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Share expenses with your team</Text>
          </View>
          <TouchableOpacity onPress={openCreateGroupModal}
            style={{ backgroundColor: "#9AEA62", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}>
            <Text style={{ color: "#081126", fontWeight: "700", fontSize: 13 }}>+ Group</Text>
          </TouchableOpacity>
        </View>

        {groups.length > 0 && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
              <Text style={{ color: "#9CA3AF", fontSize: 11 }}>GROUPS</Text>
              <Text className="font-extrabold" style={{ color: "white", fontWeight: "700", fontSize: 26, marginTop: 2 }}>{groups.length}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
              <Text style={{ color: "#9CA3AF", fontSize: 11 }}>TOTAL TRACKED</Text>
              <Text className="font-extrabold" style={{ color: "#9AEA62", fontWeight: "700", fontSize: 26, marginTop: 2 }}>
                ${totalSpent.toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View> */}


      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => goBackTo(router, backTo, BACK_TO_HOME)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={20} color="#EFC18F" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: "#EFC18F", fontWeight: "600", fontSize: 20 }}>Flash's</Text>
            <Text style={{ color: "#EFC18F", fontWeight: "800", fontSize: 30, lineHeight: 34 }}>Bill Splitter</Text>
          </View>
        </View>

        <View style={{ alignItems: "center", gap: 6 }}>
          <Image
            source={{
              uri: backendUser?.profilePicture ||
                `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(backendUser?.username || backendUser?.email || "user")}&size=80&backgroundColor=b6e3f4`,
            }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 2,
              borderColor: "#EFC18F",
              backgroundColor: "#1F2937",
            }}
          />
          <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
            {backendUser?.fullname || backendUser?.username || backendUser?.email?.split("@")[0] || "You"}
          </Text>
        </View>
      </View>

      {/* Join Group Banner */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => { setJoinTab("scan"); resetJoinScanner(); setJoinUrl(""); setShowJoin(true); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(154,234,98,0.1)", borderWidth: 1, borderColor: "rgba(154,234,98,0.3)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#9AEA62", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="qr-code-outline" size={20} color="#081126" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 14 }}>Join a Group</Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 1 }}>Scan QR code, upload image, or paste link</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9AEA62" />
        </TouchableOpacity>
      </View>

      {/* Global balance summary */}
      {groups.filter((g) => !g.isArchived).length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: "#0f172a", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1e293b" }}>
            <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "700" }}>GROUPS</Text>
            <Text style={{ color: "#f1f5f9", fontWeight: "800", fontSize: 24, marginTop: 2 }}>{groups.filter((g) => !g.isArchived).length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#0f172a", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1e293b" }}>
            <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "700" }}>TOTAL TRACKED</Text>
            <Text style={{ color: "#9AEA62", fontWeight: "800", fontSize: 20, marginTop: 2 }} numberOfLines={2}>
              {trackedTotalsLabel}
            </Text>
          </View>
        </View>
      )}

      {/* Search bar + archive toggle */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: "#1e293b" }}>
            <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 10 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search groups..."
              placeholderTextColor="#475569"
              style={{ flex: 1, color: "#f1f5f9", fontSize: 14 }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
          {archivedCount > 0 && (
            <TouchableOpacity
              onPress={() => setShowArchived((v) => !v)}
              style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: showArchived ? "#9AEA62" : "#0f172a", borderWidth: 1, borderColor: showArchived ? "#9AEA62" : "#1e293b", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="archive-outline" size={20} color={showArchived ? "#081126" : "#64748b"} />
            </TouchableOpacity>
          )}
        </View>
        {showArchived && (
          <Text style={{ color: "#9AEA62", fontSize: 12, fontWeight: "600", marginTop: 6 }}>Showing archived groups ({archivedCount})</Text>
        )}
      </View>

      {/* Groups List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LottieView
            source={require("@/app/animations/coin.json")}
            autoPlay
            loop
            style={{ width: 140, height: 140 }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item._id || item.id}
          style={{ backgroundColor: "#050a16" }}
          contentContainerStyle={{ padding: 16, paddingBottom: listBottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#9AEA62"]} tintColor="#9AEA62" />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name={debouncedQuery ? "search-outline" : "wallet-outline"} size={56} color="#374151" />
              <Text style={{ color: "#9CA3AF", fontSize: 16, fontWeight: "600", marginTop: 12 }}>
                {debouncedQuery ? `No results for "${debouncedQuery}"` : "No groups yet"}
              </Text>
              {!debouncedQuery && (
                <>
                  <Text style={{ color: "#4B5563", fontSize: 13, marginTop: 6, textAlign: "center" }}>Create a group to start splitting expenses</Text>
                  <TouchableOpacity onPress={openCreateGroupModal}
                    style={{ marginTop: 16, backgroundColor: "#9AEA62", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }}>
                    <Text style={{ color: "#081126", fontWeight: "700" }}>Create First Group</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
          renderItem={({ item: g }) => {
            const color = CATEGORY_COLORS[g.category] || "#6B7280";
            const total = g.totalExpenses || (g.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
            const memberCount = g.memberCount || (g.members || []).length;
            const expenseCount = g.expenseCount || (g.expenses || []).length;
            const catInfo = CATEGORIES.find((c) => c.value === g.category);
            return (
              <View className="rounded-2xl overflow-hidden" style={{ marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={() => setSelectedGroup(g)}
                  activeOpacity={1}
                  style={{
                    backgroundColor: "#EEC08C",
                    borderRadius: 28,
                    borderWidth: 1,
                    overflow: "hidden",
                  }}
                >
                  {/* Archive + Delete — only group creator */}
                  {g.createdBy === (backendUser?._id || backendUser?.id) && (
                    <View style={{ position: "absolute", top: 12, right: 12, zIndex: 10, flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleArchiveGroup(g)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: g.isArchived ? "#D1FAE5" : "#FEF3C7", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name={g.isArchived ? "archive" : "archive-outline"} size={15} color={g.isArchived ? "#059669" : "#D97706"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteGroup(g._id)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ padding: 16 }}>
                    {/* Receipt + category — left aligned */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Text style={{ backgroundColor: "#1F2937", color: "white", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, fontSize: 12, fontWeight: "700" }}>Receipt</Text>
                      <View style={{ backgroundColor: color + "1F", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ color: "#111827", fontSize: 12, fontWeight: "700" }}>{catInfo?.label || g.category}</Text>
                      </View>
                    </View>

                    {/* Dashed divider with cutouts */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      <View className="rounded-r-full" style={{ width: 14, height: 18, backgroundColor: "#050a16", marginLeft: -16 }} />
                      <View style={{ flex: 1, borderTopWidth: 2, borderColor: "#050a16", borderStyle: "dashed", marginHorizontal: 4 }} />
                      <View className="rounded-l-full" style={{ width: 16, height: 18,  backgroundColor: "#050a16", marginRight: -16 }} />
                    </View>

                    {/* Title row */}
                    <View style={{ width: "100%", marginBottom: 10 }}>
                      <Text style={{ color: "#475569", fontSize: 11, fontWeight: "600", marginBottom: 2 }}>Title</Text>
                      <Text
                        style={{ fontWeight: "800", color: "#0F172A", fontSize: 24 }}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {g.name}
                      </Text>
                    </View>

                    {/* Amount row */}
                    <View style={{ width: "100%", marginBottom: 4 }}>
                      <Text style={{ color: "#475569", fontSize: 11, fontWeight: "600", marginBottom: 2 }}>Total Bill</Text>
                      <Text
                        style={{ fontWeight: "800", color: "#0F172A", fontSize: 32 }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {formatCurrency(total, g.currency)}
                      </Text>
                    </View>

                    {g.description && (
                      <Text style={{ color: "#475569", fontSize: 12, marginTop: 4, width: "100%" }} numberOfLines={2}>{g.description}</Text>
                    )}


                    <View className="bg-gray-800 rounded-xl w-full my-5 flex-row items-center" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {(g.members || []).slice(0, 5).map((member, index) => (
                          <Image
                            key={member._id || member.name || index}
                            source={{ uri: `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(member.name || "user")}&size=80&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf` }}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              borderWidth: 2,
                              borderColor: "#1F2937",
                              marginLeft: index === 0 ? 0 : -12,
                              backgroundColor: "#374151",
                            }}
                          />
                        ))}
                        {(g.members || []).length > 5 && (
                          <View style={{
                            width: 38, height: 38, borderRadius: 19,
                            backgroundColor: "#374151", alignItems: "center", justifyContent: "center",
                            marginLeft: -12, borderWidth: 2, borderColor: "#1F2937",
                          }}>
                            <Text style={{ color: "#9AEA62", fontSize: 11, fontWeight: "700" }}>+{(g.members || []).length - 5}</Text>
                          </View>
                        )}
                        {/* Add member + circle */}
                        <TouchableOpacity
                          onPress={() => setSelectedGroup(g)}
                          style={{
                            width: 38, height: 38, borderRadius: 19,
                            backgroundColor: "#9AEA62", alignItems: "center", justifyContent: "center",
                            marginLeft: -12, borderWidth: 2, borderColor: "#1F2937",
                          }}
                        >
                          <Ionicons name="add" size={20} color="#081126" />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ color: "#9CA3AF", fontSize: 12, marginLeft: 10 }}>
                        {(g.members || []).length} member{(g.members || []).length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* FAB — create group */}
      {!showCreate && !showJoin ? (
        <TouchableOpacity
          onPress={openCreateGroupModal}
          style={{
            position: "absolute",
            bottom: fabBottomOffset,
            right: 20,
            backgroundColor: "#9AEA62",
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#9AEA62",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
            zIndex: 10,
          }}
        >
          <Ionicons name="add" size={28} color="#081126" />
        </TouchableOpacity>
      ) : null}

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" transparent hardwareAccelerated onRequestClose={closeCreateGroupModal}>
        <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: createModalKeyboardInset, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeCreateGroupModal} />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: createGroupSheetMaxHeight,
              width: "100%",
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, flexShrink: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>New Group</Text>
                <TouchableOpacity onPress={closeCreateGroupModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={createGroupScrollRef}
              style={{ maxHeight: createGroupScrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={createModalKeyboardInset > 0}
              nestedScrollEnabled
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
            >
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>GROUP NAME *</Text>
              <TextInput value={newGroup.name} onChangeText={(v) => setNewGroup({ ...newGroup, name: v })}
                style={{ ...CREATE_GROUP_INPUT_STYLE, marginBottom: 14 }}
                placeholder="e.g. Team Trip 2025"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>DESCRIPTION</Text>
              <TextInput value={newGroup.description} onChangeText={(v) => setNewGroup({ ...newGroup, description: v })}
                style={{ ...CREATE_GROUP_INPUT_STYLE, marginBottom: 14 }}
                placeholder="Optional description"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR} />

              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity key={c.value} onPress={() => setNewGroup({ ...newGroup, category: c.value })}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: newGroup.category === c.value ? "#081126" : "#F3F4F6" }}>
                      <Text style={{ color: newGroup.category === c.value ? "#9AEA62" : "#6B7280", fontWeight: "600", fontSize: 13 }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>CURRENCY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity key={c} onPress={() => setNewGroup({ ...newGroup, currency: c })}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: newGroup.currency === c ? "#081126" : "#F3F4F6" }}>
                      <Text style={{ color: newGroup.currency === c ? "#9AEA62" : "#6B7280", fontWeight: "600" }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>ADD MEMBERS</Text>
              <View
                onLayout={(e) => { createGroupMemberNameY.current = e.nativeEvent.layout.y; }}
              >
                <TextInput value={memberInput} onChangeText={setMemberInput}
                  style={{ ...CREATE_GROUP_INPUT_STYLE, padding: 12, fontSize: 14, marginBottom: 8 }}
                  placeholder="Member name *"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  returnKeyType="next"
                  onFocus={() => scrollToFieldY(createGroupScrollRef, createGroupMemberNameY.current)} />
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}
                onLayout={(e) => { createGroupMemberEmailY.current = e.nativeEvent.layout.y; }}
              >
                <TextInput value={memberEmailInput} onChangeText={setMemberEmailInput}
                  style={{ flex: 1, ...CREATE_GROUP_INPUT_STYLE, padding: 12, fontSize: 14 }}
                  placeholder="Email (optional — notifies them)"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  onSubmitEditing={addMemberToForm}
                  onFocus={() => scrollToFieldY(createGroupScrollRef, createGroupMemberEmailY.current)} />
                <TouchableOpacity onPress={addMemberToForm}
                  style={{ backgroundColor: "#081126", borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="add" size={22} color="#9AEA62" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {newGroup.members.map((m) => (
                  <View key={m.name} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#081126", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6 }}>
                    <View>
                      <Text style={{ color: "#9AEA62", fontWeight: "600", fontSize: 13 }}>{m.name}</Text>
                      {m.email ? <Text style={{ color: "#64748b", fontSize: 10 }}>{m.email}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => setNewGroup((prev) => ({ ...prev, members: prev.members.filter((x) => x.name !== m.name) }))}>
                      <Ionicons name="close-circle" size={16} color="#9AEA62" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: createGroupFooterBottomPad,
                borderTopWidth: 1,
                borderTopColor: "#F3F4F6",
                backgroundColor: "#fff",
                flexShrink: 0,
              }}
            >
              <TouchableOpacity onPress={handleCreate} disabled={creating}
                style={{ backgroundColor: "#081126", borderRadius: 14, paddingVertical: 15, alignItems: "center", opacity: creating ? 0.6 : 1 }}>
                {creating ? <ActivityIndicator color="#9AEA62" /> : <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 16 }}>Create Group</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Join Group Modal ── */}
      <Modal visible={showJoin} animationType="slide" transparent hardwareAccelerated onRequestClose={() => { setShowJoin(false); resetJoinScanner(); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", paddingBottom: keyboardInset }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => { setShowJoin(false); resetJoinScanner(); }} />

          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#0f172a", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: keyboardInset > 0 ? 16 : 40 }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
            <Text style={{ color: "white", fontWeight: "800", fontSize: 20, paddingHorizontal: 24, marginBottom: 16 }}>Join a Group</Text>

            {/* Tabs */}
            <View style={{ flexDirection: "row", marginHorizontal: 24, marginBottom: 20, backgroundColor: "#1e293b", borderRadius: 12, padding: 4 }}>
              {[{ key: "scan", icon: "qr-code-outline", label: "Scan" }, { key: "upload", icon: "image-outline", label: "Upload" }, { key: "link", icon: "link-outline", label: "Link" }].map((t) => (
                <TouchableOpacity key={t.key} onPress={() => { setJoinTab(t.key); resetJoinScanner(); }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: joinTab === t.key ? "#9AEA62" : "transparent" }}>
                  <Ionicons name={t.icon} size={15} color={joinTab === t.key ? "#081126" : "#64748b"} />
                  <Text style={{ color: joinTab === t.key ? "#081126" : "#64748b", fontWeight: "700", fontSize: 13 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Scan Tab */}
            {joinTab === "scan" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20 }}>
                {!cameraPermission?.granted ? (
                  <View style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
                    <Ionicons name="camera-outline" size={52} color="#64748b" />
                    <Text style={{ color: "#94a3b8", textAlign: "center", fontSize: 14 }}>Camera permission needed{"\n"}to scan QR codes</Text>
                    <TouchableOpacity onPress={requestCameraPermission}
                      style={{ backgroundColor: "#9AEA62", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                      <Text style={{ color: "#081126", fontWeight: "700", fontSize: 14 }}>Allow Camera</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ borderRadius: 20, overflow: "hidden" }}>
                    <CameraView
                      style={{ width: "100%", aspectRatio: 1 }}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={scanned ? undefined : handleQRScanned}
                    />
                    {/* Corner viewfinder */}
                    <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
                      {["tl", "tr", "bl", "br"].map((corner) => (
                        <View key={corner} style={{
                          position: "absolute",
                          width: 28, height: 28,
                          borderColor: "#9AEA62", borderWidth: 3,
                          ...(corner.includes("t") ? { top: "25%", borderBottomWidth: 0 } : { bottom: "25%", borderTopWidth: 0 }),
                          ...(corner.includes("l") ? { left: "25%", borderRightWidth: 0, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 } : { right: "25%", borderLeftWidth: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4 }),
                        }} />
                      ))}
                      <Text style={{ color: "white", marginTop: "60%", fontWeight: "600", fontSize: 13, textShadowColor: "black", textShadowRadius: 4 }}>
                        {joining ? "Joining…" : "Align QR code in frame"}
                      </Text>
                    </View>
                    {joining && (
                      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <ActivityIndicator size="large" color="#9AEA62" />
                        <Text style={{ color: "white", fontWeight: "600" }}>Joining group…</Text>
                      </View>
                    )}
                    {/* Retry button after failed scan */}
                    {scanned && !joining && (
                      <TouchableOpacity
                        onPress={resetJoinScanner}
                        style={{ position: "absolute", bottom: 16, alignSelf: "center", backgroundColor: "#9AEA62", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: "#081126", fontWeight: "700" }}>Tap to scan again</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Upload Tab */}
            {joinTab === "upload" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20, alignItems: "center", gap: 16 }}>
                <View style={{ width: "100%", borderWidth: 2, borderColor: "#1e293b", borderStyle: "dashed", borderRadius: 16, paddingVertical: 40, alignItems: "center", gap: 10 }}>
                  <Ionicons name="image-outline" size={48} color="#64748b" />
                  <Text style={{ color: "#94a3b8", textAlign: "center", fontSize: 14 }}>Upload a screenshot or photo{"\n"}containing the QR code</Text>
                </View>
                <TouchableOpacity onPress={handleUploadQR} disabled={joining}
                  style={{ width: "100%", backgroundColor: "#9AEA62", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: joining ? 0.6 : 1 }}>
                  {joining ? <ActivityIndicator color="#081126" /> : <Text style={{ color: "#081126", fontWeight: "700", fontSize: 15 }}>Choose Image</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Link Tab */}
            {joinTab === "link" && (
              <View style={{ marginHorizontal: 24, marginBottom: 20, gap: 12 }}>
                <Text style={{ color: "#94a3b8", fontSize: 13 }}>Paste a PlayFlash invite link or share code</Text>
                <TextInput
                  value={joinUrl}
                  onChangeText={setJoinUrl}
                  placeholder="Invite code or playflash:// link"
                  placeholderTextColor="#475569"
                  style={{ backgroundColor: "#1e293b", borderRadius: 12, padding: 14, color: "white", fontSize: 14, borderWidth: 1, borderColor: "#334155" }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => joinGroup(extractTricountShareId(joinUrl))}
                  disabled={!joinUrl.trim() || joining}
                  style={{ backgroundColor: "#9AEA62", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: (!joinUrl.trim() || joining) ? 0.5 : 1 }}
                >
                  {joining ? <ActivityIndicator color="#081126" /> : <Text style={{ color: "#081126", fontWeight: "700", fontSize: 15 }}>Join Group</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </View>
  );
}
