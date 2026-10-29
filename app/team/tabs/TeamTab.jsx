import { useState, useEffect, useCallback, useRef } from "react";
import { Image as ExpoImage } from "expo-image";
import { ActivityIndicator, Alert, Dimensions, Image, Keyboard, Modal, Platform, RefreshControl, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { io } from "socket.io-client";
import QRCode from "react-native-qrcode-svg";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { getPlayersByTeamAPI, createPlayerAPI, updatePlayerAPI, deletePlayerAPI, createTeamJoinLinkAPI } from "@/services/PlayerApi";
import { showToast } from "@/context/ToastContext";
import { createTeamJoinLink } from "@/lib/shareLinks";
import { TEAM_EMPTY_ICONS, TEAM_EMPTY_ICON_STYLE } from "@/constants/teamEmptyIcons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { roleBadge, PlayerAvatar, Badge } from "./helpers";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { FOOTBALL_PLAYER_POSITIONS, normalizeFootballPositionCode } from "@/components/game/footballFormations";

/** Soft badge colors on dark surfaces (light keeps helpers.roleBadge). */
const ROLE_BADGE_DARK = {
  player: { bg: "rgba(34,197,94,0.18)", text: "#86EFAC", label: "Player" },
  manager: { bg: "rgba(59,130,246,0.2)", text: "#93C5FD", label: "Manager" },
  spectator: { bg: "rgba(245,158,11,0.18)", text: "#FBBF24", label: "Spectator" },
};

const scrollToFieldY = (scrollRef, yOffset, delayMs = Platform.OS === "ios" ? 320 : 150) => {
  setTimeout(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, yOffset - 80),
      animated: true,
    });
  }, delayMs);
};

// Mirror Split Bill (tricount) New Group sheet sizing so the keyboard behaviour
// and button placement are identical across both flows.
const { height: ADD_PLAYER_WINDOW_HEIGHT } = Dimensions.get("window");
const ADD_PLAYER_MODAL_MAX_HEIGHT = Math.round(ADD_PLAYER_WINDOW_HEIGHT * 0.92);
const ADD_PLAYER_SHEET_HEADER_HEIGHT = 64;
const ADD_PLAYER_SHEET_FOOTER_HEIGHT = 88;
const getAddPlayerSheetLayout = (keyboardInset, bottomInset = 0, topInset = 0) => {
  const footerHeight = ADD_PLAYER_SHEET_FOOTER_HEIGHT + bottomInset;
  const sheetMaxHeight = Math.max(
    320,
    Math.min(
      ADD_PLAYER_MODAL_MAX_HEIGHT,
      ADD_PLAYER_WINDOW_HEIGHT - topInset - Math.max(keyboardInset, bottomInset) - 16,
    ),
  );
  const scrollMaxHeight = Math.max(
    160,
    sheetMaxHeight - ADD_PLAYER_SHEET_HEADER_HEIGHT - footerHeight - 16,
  );
  return { sheetMaxHeight, scrollMaxHeight };
};

const normalizeTeamId = (value) => {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value._id || value.id) return String(value._id || value.id);
    return "";
  }
  return "";
};

const buildPlayerSaveErrors = (error, fallbackMessage = "Failed to save player") => {
  const responseData = error?.response?.data;
  const detailErrors = Array.isArray(responseData?.errors) ? responseData.errors : [];
  const nextErrors = {};

  detailErrors.forEach((detail) => {
    if (!detail?.field || !detail?.message) return;

    const field = detail.field.startsWith("emails.")
      ? "parentEmail"
      : detail.field;

    if (!nextErrors[field]) {
      nextErrors[field] = detail.message;
    }
  });

  const submitMessage =
    detailErrors.find((detail) => detail?.message)?.message ||
    responseData?.message ||
    error?.message ||
    fallbackMessage;

  if (
    !nextErrors.jerseyNumber &&
    ((responseData?.data?.available === false && responseData?.data?.jerseyNumber !== undefined) ||
      (/jersey/i.test(submitMessage) && /(taken|already|duplicate)/i.test(submitMessage)))
  ) {
    nextErrors.jerseyNumber = submitMessage;
  }

  return Object.keys(nextErrors).length > 0
    ? nextErrors
    : { submit: submitMessage };
};

export default function TeamTab({
  team,
  players,
  isOwner,
  isTeamOwner = false,
  teamId,
  onRefresh,
  refreshing = false,
  pullRefresh = null,
  isSelfOwnedOpponent = false,
  opponentTeamId = null,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showJoinShareModal, setShowJoinShareModal] = useState(false);
  const [joinShareLoading, setJoinShareLoading] = useState(false);
  const [joinShareTeamId, setJoinShareTeamId] = useState(null);
  const [joinShareDataByTeam, setJoinShareDataByTeam] = useState({});
  const playerModalScrollRef = useRef(null);
  const emailFieldY = useRef(0);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const joinShareSheetRef = useRef(null);
  const knownMemberIdsRef = useRef(new Set());
  const initialMembersLoadedRef = useRef(false);
  const addPlayerKeyboardInset = showAddModal ? keyboardInset : 0;
  const playerFooterBottomPad = addPlayerKeyboardInset > 0 ? 8 : Math.max(16, insets.bottom + 16);
  const {
    sheetMaxHeight: addPlayerSheetMaxHeight,
    scrollMaxHeight: addPlayerScrollMaxHeight,
  } = getAddPlayerSheetLayout(addPlayerKeyboardInset, insets.bottom, insets.top);

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

  const openModal = () => {
    Keyboard.dismiss();
    setShowAddModal(true);
  };
  const closeModal = () => {
    Keyboard.dismiss();
    setShowAddModal(false);
    setModalSelectedTeamId(null);
  };

  const [editingPlayer, setEditingPlayer] = useState(null);
  const isChessTeam = team?.sport === "Chess";
  const isFootballTeam = String(team?.sport || "").toLowerCase() === "football";

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    position: "",
    jerseyNumber: "",
    chessRating: "",
    preferredColor: "any",
    role: "player",
    parentEmail: "",
    playerImage: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState(null);
  const [addingDummies, setAddingDummies] = useState(false);

  const clearFieldError = useCallback((field) => {
    setFormErrors((prev) => ({
      ...prev,
      [field]: undefined,
      submit: undefined,
    }));
  }, []);

  const _launchPicker = async (launchFn) => {
    try {
      const result = await launchFn();
      if (!result.canceled && result.assets?.length > 0) {
        setForm((prev) => ({ ...prev, playerImage: result.assets[0] }));
      }
    } catch (err) {
      Alert.alert("Image Picker Error", String(err?.message || err));
    }
  };

  const pickPlayerImage = async () => {
    const allowed = await ensurePhotoLibraryAccess();
    if (!allowed) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }
    await _launchPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    );
  };

  const takePlayerPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    await _launchPicker(() =>
      ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    );
  };

  // Dual-team roster state (matching frontend TeamPage.jsx)
  const [activeRoster, setActiveRoster] = useState("myTeam"); // "myTeam" | "opponent"
  const [opponentTeamData, setOpponentTeamData] = useState(null);
  const [opponentPlayers, setOpponentPlayers] = useState([]);
  const [loadingOpponentPlayers, setLoadingOpponentPlayers] = useState(false);
  const [modalSelectedTeamId, setModalSelectedTeamId] = useState(null);
  const opponentFetchedRef = useRef(false);
  // Optimistic own-team additions (shown instantly, cleared when parent re-syncs)
  const [pendingOwnPlayers, setPendingOwnPlayers] = useState([]);
  const prevPlayersRef = useRef(players);
  useEffect(() => {
    if (prevPlayersRef.current === players) return;
    prevPlayersRef.current = players;
    // players prop changed because of a real pull-to-refresh or navigation —
    // the fresh list is now authoritative, clear any optimistic entries.
    setPendingOwnPlayers([]);
  }, [players]);

  // Fetch opponent team data when opponent is present
  const fetchOpponentData = useCallback(async (force = false) => {
    if (!opponentTeamId) return;
    if (opponentFetchedRef.current && !force) return;
    opponentFetchedRef.current = true;
    setLoadingOpponentPlayers(true);
    try {
      const teamResp = await getTeamByIdAPI(opponentTeamId);
      if (teamResp?.data || teamResp?.team) {
        setOpponentTeamData(teamResp.data || teamResp.team || teamResp);
      }
      const playerResp = await getPlayersByTeamAPI(opponentTeamId);
      const pls = playerResp?.data || playerResp?.players || [];
      setOpponentPlayers(Array.isArray(pls) ? pls : []);
    } catch (err) {
      opponentFetchedRef.current = false;
      if (err?.response?.status !== 429) {
        console.warn("Failed to fetch opponent team data:", err?.message);
      }
    } finally {
      setLoadingOpponentPlayers(false);
    }
  }, [opponentTeamId]);

  useEffect(() => {
    if (opponentTeamId) {
      fetchOpponentData();
    }
  }, [opponentTeamId, fetchOpponentData]);

  // Determine which roster to show
  const isShowingOpponent = !!opponentTeamId && activeRoster === "opponent";
  const activeTeamId = isShowingOpponent ? opponentTeamId : teamId;
  const activeTeamData = isShowingOpponent ? opponentTeamData || team : team;
  const ownTeamKey = normalizeTeamId(teamId);
  const opponentTeamKey = normalizeTeamId(opponentTeamId);
  const resolveTeamMeta = useCallback(
    (candidateTeamId) => {
      const candidateTeamKey = normalizeTeamId(candidateTeamId);
      if (candidateTeamKey && candidateTeamKey === opponentTeamKey) {
        return opponentTeamData || null;
      }

      return team || null;
    },
    [opponentTeamData, opponentTeamKey, team],
  );
  const canManageOpponentTeam = isOwner && isSelfOwnedOpponent && !!opponentTeamKey;
  const canManageActiveTeam = isOwner && (!isShowingOpponent || canManageOpponentTeam);
  const canCreateJoinLinkForTeam = useCallback(
    (candidateTeamId) => {
      if (!isTeamOwner) return false;
      const candidateTeamKey = normalizeTeamId(candidateTeamId);
      if (!candidateTeamKey || candidateTeamKey === ownTeamKey) return true;
      return isSelfOwnedOpponent && candidateTeamKey === opponentTeamKey;
    },
    [isTeamOwner, ownTeamKey, isSelfOwnedOpponent, opponentTeamKey],
  );
  const canCreateJoinLinkForActiveTeam = canCreateJoinLinkForTeam(activeTeamId);
  const allMembers = isShowingOpponent
    ? opponentPlayers
    : [...(players || []), ...pendingOwnPlayers];
  const handlePullRefresh = pullRefresh || onRefresh;

  useEffect(() => {
    if (!initialMembersLoadedRef.current && allMembers.length > 0) {
      allMembers.forEach((p) => {
        const id = String(p._id || p.id || "");
        if (id) knownMemberIdsRef.current.add(id);
      });
      initialMembersLoadedRef.current = true;
    }
  }, [allMembers]);

  const canManageTeam = useCallback(
    (candidateTeamId) => {
      if (!isOwner) return false;
      const candidateTeamKey = normalizeTeamId(candidateTeamId);
      if (!candidateTeamKey || candidateTeamKey === ownTeamKey) return true;
      return canManageOpponentTeam && candidateTeamKey === opponentTeamKey;
    },
    [isOwner, ownTeamKey, canManageOpponentTeam, opponentTeamKey],
  );

  const canManagePlayer = useCallback(
    (player) => {
      const playerTeamKey = normalizeTeamId(player?.teamId);
      if (playerTeamKey) return canManageTeam(playerTeamKey);
      return canManageActiveTeam;
    },
    [canManageActiveTeam, canManageTeam],
  );

  // Team options for the Add Player modal team selector
  const teamOptionsForModal =
    isSelfOwnedOpponent && opponentTeamId
      ? [
          { id: teamId, name: team?.teamName || "My Team", isCurrent: true },
          {
            id: opponentTeamId,
            name: opponentTeamData?.teamName || "Opponent Team",
            isCurrent: false,
          },
        ]
      : null;

  const inviteTeamOptions =
    isSelfOwnedOpponent && opponentTeamId
      ? [
          { id: teamId, name: team?.teamName || "My Team", accent: "#9AEA62" },
          {
            id: opponentTeamId,
            name: opponentTeamData?.teamName || "Opponent Team",
            accent: "#60A5FA",
          },
        ]
      : [{ id: teamId, name: team?.teamName || "My Team", accent: "#9AEA62" }];

  const openAdd = () => {
    if (!canManageActiveTeam) {
      Alert.alert("Access denied", "You can only add players to teams you manage.");
      return;
    }

    setEditingPlayer(null);
    setForm({
      firstName: "",
      lastName: "",
      position: "",
      jerseyNumber: "",
      chessRating: "",
      preferredColor: "any",
      role: "player",
      parentEmail: "",
      playerImage: null,
    });
    setFormErrors({});
    setModalSelectedTeamId(activeTeamId);
    openModal();
  };

  const fetchJoinShareData = async (selectedTeamId) => {
    if (!selectedTeamId) return;
    if (!canCreateJoinLinkForTeam(selectedTeamId)) {
      Alert.alert("Access denied", "Only the team owner can create a join link.");
      setShowJoinShareModal(false);
      return;
    }
    if (joinShareDataByTeam[selectedTeamId]?.token) return;

    setJoinShareLoading(true);
    try {
      const result = await createTeamJoinLinkAPI(selectedTeamId);
      const data = result?.data || result;
      setJoinShareDataByTeam((prev) => ({ ...prev, [selectedTeamId]: data }));
    } catch (err) {
      Alert.alert("Unable to create link", err?.response?.data?.message || "Please try again.");
      setShowJoinShareModal(false);
    } finally {
      setJoinShareLoading(false);
    }
  };

  const openJoinShare = async () => {
    const initialTeamId =
      isSelfOwnedOpponent && opponentTeamId ? activeTeamId : teamId;
    if (!initialTeamId) return;
    if (!canCreateJoinLinkForTeam(initialTeamId)) {
      Alert.alert("Access denied", "Only the team owner can create a join link.");
      return;
    }

    setJoinShareTeamId(initialTeamId);
    setShowJoinShareModal(true);
    joinShareSheetRef.current?.expand();
    await fetchJoinShareData(initialTeamId);
  };

  const closeJoinShare = useCallback(() => {
    joinShareSheetRef.current?.close();
  }, []);

  const selectedInviteTeam =
    inviteTeamOptions.find((option) => option.id === joinShareTeamId) ||
    inviteTeamOptions[0] ||
    null;
  const joinShareData = joinShareTeamId ? joinShareDataByTeam[joinShareTeamId] : null;
  const joinShareUrl = createTeamJoinLink(joinShareData?.token);

  const handleShareJoinLink = async () => {
    if (!joinShareUrl) return;
    try {
      await Share.share({
        title: `Join ${selectedInviteTeam?.name || team?.teamName || "my team"}`,
        message: `Join ${selectedInviteTeam?.name || team?.teamName || "my team"} on PlayFlash:\n${joinShareUrl}`,
      });
    } catch {}
  };

  const openEdit = (p) => {
    if (!canManagePlayer(p)) {
      Alert.alert("Access denied", "You can only edit players on teams you manage.");
      return;
    }

    setEditingPlayer(p);
    setForm({
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      position: isFootballTeam
        ? normalizeFootballPositionCode(p.position || "")
        : (p.position || ""),
      jerseyNumber: p.jerseyNumber?.toString() || "",
      chessRating: p.chessRating?.toString() || "",
      preferredColor: p.preferredColor || "any",
      role: p.role || "player",
      parentEmail: p.parentEmail || "",
      playerImage: null,
    });
    setFormErrors({});
    setModalSelectedTeamId(normalizeTeamId(p?.teamId) || normalizeTeamId(activeTeamId));
    openModal();
  };

  const handleSave = async () => {
    const errors = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (form.role === "player" && form.jerseyNumber && (isNaN(Number(form.jerseyNumber)) || Number(form.jerseyNumber) > 99 || Number(form.jerseyNumber) < 0)) {
      errors.jerseyNumber = "Enter a number between 0 and 99";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const targetTeamId = normalizeTeamId(
      editingPlayer
        ? modalSelectedTeamId || activeTeamId
        : isSelfOwnedOpponent && modalSelectedTeamId
          ? modalSelectedTeamId
          : activeTeamId,
    );

    if (editingPlayer && !canManagePlayer(editingPlayer)) {
      setFormErrors({ submit: "You can only edit players on teams you manage." });
      return;
    }

    if (!editingPlayer && !canManageTeam(targetTeamId)) {
      setFormErrors({ submit: "You can only add players to teams you manage." });
      return;
    }

    setFormErrors({});
    setSaving(true);
    try {
      const targetTeamMeta = resolveTeamMeta(targetTeamId);
      let payload;
      if (form.playerImage) {
        const fd = new FormData();
        fd.append("firstName", form.firstName.trim());
        if (form.lastName.trim()) fd.append("lastName", form.lastName.trim());
        if (form.role === "player") {
          if (isChessTeam) {
            if (form.chessRating) fd.append("chessRating", form.chessRating);
            if (form.preferredColor && form.preferredColor !== "any") fd.append("preferredColor", form.preferredColor);
          } else {
            if (form.position.trim()) fd.append("position", form.position.trim());
            if (form.jerseyNumber) fd.append("jerseyNumber", form.jerseyNumber);
          }
        }
        fd.append("role", form.role);
        if (form.parentEmail.trim()) fd.append("parentEmail", form.parentEmail.trim());
        if (!editingPlayer) {
          fd.append("teamId", targetTeamId);
          if (targetTeamMeta?.teamName) fd.append("teamName", targetTeamMeta.teamName);
          if (targetTeamMeta?.sport) fd.append("sport", targetTeamMeta.sport);
          if (targetTeamMeta?.season) fd.append("season", targetTeamMeta.season);
        }
        fd.append("playerimage", {
          uri: form.playerImage.uri,
          type: form.playerImage.mimeType || "image/jpeg",
          name: `player_${Date.now()}.jpg`,
        });
        payload = fd;
      } else {
        payload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          ...(form.role === "player" && isChessTeam
            ? {
                chessRating: form.chessRating ? parseInt(form.chessRating) : undefined,
                preferredColor: form.preferredColor !== "any" ? form.preferredColor : undefined,
              }
            : {
                position: form.role === "player" ? (form.position.trim() || undefined) : undefined,
                jerseyNumber: form.role === "player" && form.jerseyNumber ? parseInt(form.jerseyNumber) : undefined,
              }),
          role: form.role,
          parentEmail: form.parentEmail.trim() || undefined,
          ...(!editingPlayer && {
            teamId: targetTeamId,
            teamName: targetTeamMeta?.teamName || undefined,
            sport: targetTeamMeta?.sport || undefined,
            season: targetTeamMeta?.season || undefined,
          }),
        };
      }

      if (editingPlayer) {
        const playerId = editingPlayer._id || editingPlayer.id;
        await updatePlayerAPI(playerId, payload);
        closeModal();
        setModalSelectedTeamId(null);

        // Optimistically update the player in the correct local list
        const updatedPlayer = { ...editingPlayer, ...payload, ...(form.playerImage ? { playerimage: form.playerImage.uri } : {}) };
        if (targetTeamId === opponentTeamKey) {
          setOpponentPlayers((prev) =>
            prev.map((x) => (x._id || x.id) === playerId ? updatedPlayer : x)
          );
        } else {
          setPendingOwnPlayers((prev) =>
            prev.map((x) => (x._id || x.id) === playerId ? updatedPlayer : x)
          );
        }
      } else {
        const createdResponse = await createPlayerAPI(payload);
        const createdPlayer = createdResponse?.data || null;
        closeModal();
        setModalSelectedTeamId(null);

        // Use the persisted player returned by the API so follow-up actions
        // like delete use a real database id before the next refresh.
        const nextPlayer = createdPlayer || null;

        if (nextPlayer) {
          if (opponentTeamId && targetTeamId === opponentTeamId) {
            setOpponentPlayers((prev) => [...prev, nextPlayer]);
          } else {
            setPendingOwnPlayers((prev) => [...prev, nextPlayer]);
            // Don't call onRefresh() here — fetchAll loads local disk cache first,
            // which overwrites players with the stale list and wipes the optimistic
            // entry before the fresh API response arrives.
            // The persisted player stays visible; the real sync happens on next
            // pull-to-refresh or tab navigation.
          }
        } else {
          onRefresh?.();
        }
      }
    } catch (err) {
      const nextErrors = buildPlayerSaveErrors(err);
      setFormErrors(nextErrors);
      if (nextErrors.submit) {
        showToast(nextErrors.submit, "error", "top");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Testing helper: quickly seed a full XI of dummy players ──
  const DUMMY_PLAYER_NAMES = [
    ["Aarav", "Sharma"],
    ["Rohit", "Verma"],
    ["Virat", "Singh"],
    ["Kane", "Williams"],
    ["Steve", "Smith"],
    ["Jos", "Butler"],
    ["Ben", "Stokes"],
    ["Pat", "Cummins"],
    ["Rashid", "Khan"],
    ["Trent", "Boult"],
    ["Jasprit", "Bumrah"],
  ];

  const handleAddDummyPlayers = async () => {
    if (addingDummies) return;
    const targetTeamId = normalizeTeamId(activeTeamId);
    if (!canManageTeam(targetTeamId)) {
      Alert.alert("Access denied", "You can only add players to teams you manage.");
      return;
    }

    setAddingDummies(true);
    try {
      const targetTeamMeta = resolveTeamMeta(targetTeamId);
      // Avoid jersey-number collisions with existing roster members.
      const usedJerseys = new Set(
        (allMembers || [])
          .map((member) => Number(member?.jerseyNumber))
          .filter((num) => Number.isFinite(num)),
      );
      let nextJersey = 1;
      const created = [];

      for (const [firstName, lastName] of DUMMY_PLAYER_NAMES) {
        while (usedJerseys.has(nextJersey) && nextJersey <= 99) nextJersey += 1;
        const jerseyNumber = nextJersey <= 99 ? nextJersey : undefined;
        if (jerseyNumber != null) {
          usedJerseys.add(jerseyNumber);
          nextJersey += 1;
        }

        const payload = {
          firstName,
          lastName,
          role: "player",
          ...(isChessTeam
            ? { chessRating: 1200 }
            : jerseyNumber != null
              ? { jerseyNumber }
              : {}),
          teamId: targetTeamId,
          teamName: targetTeamMeta?.teamName || undefined,
          sport: targetTeamMeta?.sport || undefined,
          season: targetTeamMeta?.season || undefined,
        };

        try {
          const response = await createPlayerAPI(payload);
          const player = response?.data;
          if (player) created.push(player);
        } catch {
          // Skip individual failures (e.g. jersey clash) and keep going.
        }
      }

      if (created.length > 0) {
        if (opponentTeamId && targetTeamId === opponentTeamKey) {
          setOpponentPlayers((prev) => [...prev, ...created]);
        } else {
          setPendingOwnPlayers((prev) => [...prev, ...created]);
        }
        showToast(`Added ${created.length} test players`, "success", "top");
        if (onRefresh) onRefresh(true);
      } else {
        showToast("Could not add test players", "error", "top");
      }
    } finally {
      setAddingDummies(false);
    }
  };

  const handleDeletePlayer = (p) => {
    if (!canManagePlayer(p)) {
      Alert.alert("Access denied", "You can only remove players from teams you manage.");
      return;
    }

    Alert.alert(
      "Remove Player",
      `Remove ${[p.firstName, p.lastName].filter(Boolean).join(' ') || 'this player'} from the team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const playerId = p._id || p.id;
            try {
              setDeletingPlayerId(playerId);
              const targetTeamId = normalizeTeamId(p?.teamId) || normalizeTeamId(activeTeamId);
              await deletePlayerAPI(playerId);
              // Optimistic remove from local lists
              if (targetTeamId === opponentTeamKey) {
                setOpponentPlayers((prev) => prev.filter((x) => (x._id || x.id) !== playerId));
              } else {
                setPendingOwnPlayers((prev) => prev.filter((x) => (x._id || x.id) !== playerId));
                onRefresh();
              }
            } catch (err) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to remove player");
            } finally {
              setDeletingPlayerId((current) => (current === playerId ? null : current));
            }
          },
        },
      ]
    );
  };

  const renderPlayer = ({ item: p }) => {
    const badgeBase = roleBadge[p.role] || roleBadge.player;
    const badge = isDark
      ? (ROLE_BADGE_DARK[p.role] || ROLE_BADGE_DARK.player)
      : badgeBase;
    const isManager = p.role === "manager";
    const canManageThisPlayer = canManagePlayer(p);
    const playerId = p._id || p.id;
    const isDeletingPlayer = deletingPlayerId === playerId;
    const pid = String(playerId || "");
    const isNew = initialMembersLoadedRef.current && !knownMemberIdsRef.current.has(pid);
    if (isNew) knownMemberIdsRef.current.add(pid);
    const RowWrapper = isNew ? Animated.View : View;
    const enterAnim = isNew ? FadeInUp.duration(220).springify().damping(18) : undefined;
    return (
      <RowWrapper
        entering={enterAnim}
        className={`rounded-xl p-4 mb-3 mx-4 shadow-sm flex-row items-center ${isDark ? "" : "bg-white"}`}
        style={{
          ...(isDark
            ? {
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: T.border,
              }
            : {}),
          ...(isManager ? { borderLeftWidth: 3, borderLeftColor: "#6366F1" } : {}),
        }}
      >
        <PlayerAvatar player={p} size={48} />
        <View className="flex-1 ml-3">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              className="font-bold text-gray-900"
              style={isDark ? { color: T.text } : undefined}
            >
              {p.firstName} {p.lastName}
            </Text>
            {isManager && <Ionicons name="shield-checkmark" size={14} color="#6366F1" />}
          </View>
          <View className="flex-row items-center gap-2 mt-1 flex-wrap">
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: badge.bg, flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              {isManager && <Ionicons name="shield-checkmark" size={10} color={badge.text} />}
              <Text
                style={{ color: badge.text }}
                className="text-xs font-semibold"
              >
                {badge.label}
              </Text>
            </View>
            {isChessTeam ? (
              p.preferredColor ? (
                <Text
                  className="text-gray-500 text-xs capitalize"
                  style={isDark ? { color: T.textDim } : undefined}
                >
                  {p.preferredColor === "white" ? "♔ White" : p.preferredColor === "black" ? "♚ Black" : "Any color"}
                </Text>
              ) : null
            ) : (
              p.position ? (
                <Text
                  className="text-gray-500 text-xs"
                  style={isDark ? { color: T.textDim } : undefined}
                >
                  {p.position}
                </Text>
              ) : null
            )}
            {p.parentEmail ? (
              <Text
                className="text-gray-400 text-xs"
                style={isDark ? { color: T.textMuted } : undefined}
              >
                {p.parentEmail}
              </Text>
            ) : null}
          </View>
        </View>
        {isChessTeam ? (
          p.chessRating ? (
            <View
              className={`px-2 h-10 rounded-xl items-center justify-center ${isDark ? "" : "bg-gray-100"}`}
              style={isDark ? { backgroundColor: T.surfaceAlt } : undefined}
            >
              <Text
                className="font-bold text-gray-700 text-xs"
                style={isDark ? { color: T.textDim } : undefined}
              >
                ELO
              </Text>
              <Text
                className="font-bold text-gray-700 text-xs"
                style={isDark ? { color: T.text } : undefined}
              >
                {p.chessRating}
              </Text>
            </View>
          ) : null
        ) : (
          p.jerseyNumber ? (
            <View
              className={`w-10 h-10 rounded-xl items-center justify-center ${isDark ? "" : "bg-gray-100"}`}
              style={isDark ? { backgroundColor: T.surfaceAlt } : undefined}
            >
              <Text
                className="font-bold text-gray-700"
                style={isDark ? { color: T.text } : undefined}
              >
                #{p.jerseyNumber}
              </Text>
            </View>
          ) : null
        )}
        {canManageThisPlayer && (
          <View className="flex-row items-center gap-1 ml-2">
            <TouchableOpacity
              onPress={() => openEdit(p)}
              disabled={isDeletingPlayer}
              className="p-2 rounded-lg"
              style={{
                backgroundColor: isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF",
                opacity: isDeletingPlayer ? 0.5 : 1,
              }}
            >
              <Ionicons name="create-outline" size={17} color={isDark ? "#93C5FD" : "#2563EB"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeletePlayer(p)}
              disabled={isDeletingPlayer}
              className="p-2 rounded-lg"
              style={{
                backgroundColor: isDark ? T.dangerBg : "#FEF2F2",
                opacity: isDeletingPlayer ? 0.7 : 1,
              }}
            >
              {isDeletingPlayer ? (
                <ActivityIndicator size="small" color={isDark ? T.dangerText : "#EF4444"} />
              ) : (
                <Ionicons name="person-remove-outline" size={17} color={isDark ? T.dangerText : "#EF4444"} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </RowWrapper>
    );
  };

  return (
    <View className="flex-1" {...(isDark ? { style: { backgroundColor: T.bg } } : {})}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View>
          <Text
            className="text-lg font-bold text-gray-900"
            style={isDark ? { color: T.text } : undefined}
          >
            {isShowingOpponent ? "Roster" : "Roster"} (
            {allMembers.length})
          </Text>
          {/* {isShowingOpponent && opponentTeamData?.teamName && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <View
                style={{
                  backgroundColor: "rgba(59,130,246,0.2)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{ fontSize: 10, fontWeight: "500", color: "#60A5FA" }}
                >
                  {opponentTeamData.teamName}
                </Text>
              </View>
              {loadingOpponentPlayers && (
                <ActivityIndicator
                  size="small"
                  color="#60A5FA"
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>
          )} */}
        </View>
        {canManageActiveTeam && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {canCreateJoinLinkForActiveTeam && (
              <TouchableOpacity
                onPress={openJoinShare}
                className="bg-[#9AEA62] px-3 py-3 rounded-sm flex-row items-center gap-1"
              >
                <Ionicons name="share-social-outline" size={16} color="#081126" />
                <Text className="text-[#081126] font-bold text-sm">Invite</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleAddDummyPlayers}
              disabled={addingDummies}
              accessibilityLabel="Add test players"
              className={`px-3 py-3 rounded-sm flex-row items-center ${isDark ? "" : "bg-orange-100"}`}
              style={{
                opacity: addingDummies ? 0.6 : 1,
                ...(isDark ? { backgroundColor: "rgba(194,65,12,0.22)" } : {}),
              }}
            >
              {addingDummies ? (
                <ActivityIndicator size="small" color={isDark ? "#FDBA74" : "#C2410C"} />
              ) : (
                <Ionicons name="flask" size={16} color={isDark ? "#FDBA74" : "#C2410C"} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openAdd}
              className={`px-4 py-3 rounded-sm flex-row items-center gap-1 ${isDark ? "" : "bg-[#081126]"}`}
              style={
                isDark
                  ? {
                      backgroundColor: "#1E1E24",
                      borderWidth: 1,
                      borderColor: "#2A2A2E",
                    }
                  : undefined
              }
            >
              <Ionicons name="person-add" size={16} color={isDark ? "#F5F5F7" : "#9AEA62"} />
              <Text
                className={`font-bold text-sm ${isDark ? "" : "text-[#9AEA62]"}`}
                style={isDark ? { color: "#F5F5F7" } : undefined}
              >
                Add Member
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Dual-team toggle when opponent exists */}
      {opponentTeamId && (
        <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
          <View style={{
            flexDirection: "row",
            backgroundColor: isDark ? "#16161A" : "#ced2d5",
            borderRadius: 18,
            padding: 4,
            borderWidth: 1,
            borderColor: isDark ? "#2A2A2E" : "#E2E8F0",
          }}>
            {/* My Team pill */}
            <TouchableOpacity
              onPress={() => { setActiveRoster("myTeam"); setEditingPlayer(null); }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor:
                  activeRoster === "myTeam"
                    ? (isDark ? "#2A2A2E" : "#081126")
                    : "transparent",
                shadowColor: activeRoster === "myTeam" ? (isDark ? "#000" : "#081126") : "transparent",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: activeRoster === "myTeam" ? (isDark ? 0.35 : 0.22) : 0,
                shadowRadius: 6,
                elevation: activeRoster === "myTeam" ? 4 : 0,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13, fontWeight: "800",
                  color:
                    activeRoster === "myTeam"
                      ? (isDark ? "#F5F5F7" : "#9AEA62")
                      : (isDark ? "#71717A" : "#94A3B8"),
                  flexShrink: 1,
                }}
              >
                {team?.teamName || "My Team"}
              </Text>
            </TouchableOpacity>

            {/* Divider dot */}
            <View style={{ alignSelf: "center", width: 4, height: 4, borderRadius: 2, backgroundColor: isDark ? "#3F3F46" : "#CBD5E1", marginHorizontal: 2 }} />

            {/* Opponent pill */}
            <TouchableOpacity
              onPress={() => { setActiveRoster("opponent"); setEditingPlayer(null); }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor:
                  activeRoster === "opponent"
                    ? (isDark ? "#2A2A2E" : "#081126")
                    : "transparent",
                shadowColor: activeRoster === "opponent" ? (isDark ? "#000" : "#081126") : "transparent",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: activeRoster === "opponent" ? (isDark ? 0.35 : 0.22) : 0,
                shadowRadius: 6,
                elevation: activeRoster === "opponent" ? 4 : 0,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13, fontWeight: "800",
                  color:
                    activeRoster === "opponent"
                      ? (isDark ? "#F5F5F7" : "#9AEA62")
                      : (isDark ? "#71717A" : "#94A3B8"),
                  flexShrink: 1,
                }}
              >
                {opponentTeamData?.teamName || "Opponent"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Team Info */}
      <View className="flex-row items-center gap-2 px-4 mb-2 flex-wrap">
        <Badge
          text={activeTeamData?.sport || team.sport}
          bg={isDark ? "rgba(99,102,241,0.22)" : "#E0E7FF"}
          color={isDark ? "#A5B4FC" : "#3730A3"}
        />
        <Badge
          text={activeTeamData?.teamType || team.teamType}
          bg={isDark ? "rgba(245,158,11,0.18)" : "#FEF3C7"}
          color={isDark ? "#FBBF24" : "#92400E"}
        />
        {(activeTeamData?.ageGroup || team.ageGroup) && (
          <Badge
            text={activeTeamData?.ageGroup || team.ageGroup}
            bg={isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7"}
            color={isDark ? "#86EFAC" : "#166534"}
          />
        )}
        {(activeTeamData?.season || team.season) && (
          <Badge
            text={activeTeamData?.season || team.season}
            bg={isDark ? "rgba(59,130,246,0.2)" : "#DBEAFE"}
            color={isDark ? "#93C5FD" : "#1E40AF"}
          />
        )}
      </View>

      {allMembers.length === 0 ? (
        refreshing ? (
          // Still loading — show spinner instead of misleading "No members yet"
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={isDark ? T.refresh : "#081126"} />
          </View>
        ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={handlePullRefresh}
              colors={["#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        >
          <ExpoImage
            source={TEAM_EMPTY_ICONS.members}
            style={TEAM_EMPTY_ICON_STYLE}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
          <Text
            className="text-gray-400 text-lg mt-2"
            style={isDark ? { color: T.textMuted } : undefined}
          >
            No members yet
          </Text>
          {canManageActiveTeam && (
            <TouchableOpacity
              onPress={openAdd}
              className="mt-4 bg-[#9AEA62] px-6 py-3 rounded-xl"
            >
              <Text className="text-[#081126] font-bold">Add First Member</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        )
      ) : (
        <FlashList
          data={allMembers}
          renderItem={renderPlayer}
          keyExtractor={(item) => String(item._id || item.id)}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
          estimatedItemSize={92}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={handlePullRefresh}
              colors={["#081126"]}
              tintColor={isDark ? T.refresh : "#081126"}
            />
          }
        />
      )}

      {/* Add/Edit Player Modal (matches Split Bill New Group keyboard behavior) */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        hardwareAccelerated
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: addPlayerKeyboardInset, backgroundColor: isDark ? T.overlay : "rgba(8, 17, 38, 0.55)" }}>
          <TouchableOpacity
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={closeModal}
          />
          <View style={{ backgroundColor: isDark ? T.surface : "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: addPlayerSheetMaxHeight, width: "100%", overflow: "hidden", flexDirection: "column" }}>
              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, flexShrink: 0 }}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: isDark ? T.text : "#081126" }}>
                    {editingPlayer ? "Edit Member" : "Add Member"}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 2 }}>
                    {isShowingOpponent ? (opponentTeamData?.teamName || "Opponent Team") : (team?.teamName || "My Team")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeModal}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6", alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={20} color={isDark ? T.textDim : "#374151"} />
                </TouchableOpacity>
              </View>
              </View>

              <ScrollView
                ref={playerModalScrollRef}
                style={{ maxHeight: addPlayerScrollMaxHeight, flexGrow: 0, flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={addPlayerKeyboardInset > 0}
                nestedScrollEnabled
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}
              >
              {/* Player Photo Picker — shown for both add and edit */}
              <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={{ position: "relative" }}>
                    {form.playerImage ? (
                      <ExpoImage
                        source={{ uri: form.playerImage.uri, width: 80, height: 80 }}
                        style={{ width: 80, height: 80, borderRadius: 40 }}
                        contentFit="cover"
                        cachePolicy="none"
                        decodeFormat="rgb"
                      />
                    ) : editingPlayer?.playerimage ? (
                      <ExpoImage
                        source={{ uri: editingPlayer.playerimage, width: 80, height: 80 }}
                        style={{ width: 80, height: 80, borderRadius: 40 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        decodeFormat="rgb"
                      />
                    ) : (
                      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: isDark ? T.border : "#E2E8F0", borderStyle: "dashed" }}>
                        <Ionicons name="person-outline" size={32} color={isDark ? T.textMuted : "#94A3B8"} />
                      </View>
                    )}
                    {form.playerImage && (
                      <TouchableOpacity
                        onPress={() => setForm((prev) => ({ ...prev, playerImage: null }))}
                        style={{ position: "absolute", top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#94A3B8", marginTop: 6, marginBottom: 8 }}>
                    {editingPlayer ? "Change Photo (optional)" : "Player Photo (optional)"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={takePlayerPhoto}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#081126", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                    >
                      <Ionicons name="camera-outline" size={16} color="#9AEA62" />
                      <Text style={{ color: "#9AEA62", fontWeight: "700", fontSize: 12 }}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickPlayerImage}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                    >
                      <Ionicons name="image-outline" size={16} color={isDark ? T.textDim : "#374151"} />
                      <Text style={{ color: isDark ? T.textDim : "#374151", fontWeight: "700", fontSize: 12 }}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>

              {/* Team Selector — shown when both teams are self-owned (matching frontend AddPlayerModel.jsx) */}
              {isSelfOwnedOpponent &&
                teamOptionsForModal &&
                teamOptionsForModal.length > 1 &&
                !editingPlayer && (
                  <View
                    style={{ padding: 12, borderRadius: 8, marginBottom: 12 }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "500",
                        color: isDark ? T.text : "#111827",
                        marginBottom: 8,
                      }}
                    >
                      Adding player to:
                    </Text>
                    <View
                      className={isDark ? "p-1 rounded-xl" : "bg-gray-300 p-1 rounded-xl"}
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        ...(isDark ? { backgroundColor: T.surfaceAlt } : {}),
                      }}
                    >
                      {teamOptionsForModal.map((opt) => (
                        <TouchableOpacity
                          
                          key={opt.id}
                          onPress={() => setModalSelectedTeamId(opt.id)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            alignItems: "center",
                            borderWidth: 1,
                            backgroundColor:
                              modalSelectedTeamId === opt.id
                                ? "#232323"
                                : (isDark ? T.surface : "#ffffff"),
                            borderColor:
                              modalSelectedTeamId === opt.id
                                ? opt.isCurrent
                                  ? "#567342"
                                  : "#d1d6df"
                                : (isDark ? T.border : "#D1D5DB"),
                            ...(modalSelectedTeamId === opt.id
                              ? {
                                  shadowColor: opt.isCurrent
                                    ? "#9AEA62"
                                    : "#3B82F6",
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 4,
                                  elevation: 3,
                                }
                              : {}),
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color:
                                modalSelectedTeamId === opt.id
                                  ? "#eaedf4"
                                  : (isDark ? T.textMuted : "#97999c"),
                            }}
                            numberOfLines={1}
                          >
                            {opt.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

              {formErrors.submit ? (
                <View style={{ backgroundColor: isDark ? T.dangerBg : "#FEE2E2", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <Text style={{ color: isDark ? T.dangerText : "#DC2626", fontSize: 13, textAlign: "center" }}>{formErrors.submit}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text
                    className="text-gray-500 text-xs font-bold mb-1"
                    style={isDark ? { color: T.textMuted } : undefined}
                  >
                    FIRST NAME *
                  </Text>
                  <TextInput
                    value={form.firstName}
                    onChangeText={(v) => {
                      setForm({ ...form, firstName: v });
                      if (formErrors.firstName || formErrors.submit) clearFieldError("firstName");
                    }}
                    placeholder="First name"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 15,
                      color: isDark ? T.text : "#111827",
                      ...(formErrors.firstName ? { borderWidth: 1, borderColor: "#EF4444" } : {}),
                    }}
                  />
                  {formErrors.firstName ? (
                    <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 3, marginLeft: 4 }}>{formErrors.firstName}</Text>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-gray-500 text-xs font-bold mb-1"
                    style={isDark ? { color: T.textMuted } : undefined}
                  >
                    LAST NAME
                  </Text>
                  <TextInput
                    value={form.lastName}
                    onChangeText={(v) => {
                      setForm({ ...form, lastName: v });
                      if (formErrors.lastName || formErrors.submit) clearFieldError("lastName");
                    }}
                    style={{
                      backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 15,
                      color: isDark ? T.text : "#111827",
                      ...(formErrors.lastName ? { borderWidth: 1, borderColor: "#EF4444" } : {}),
                    }}
                    placeholder="Last name (optional)"
                    placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                  />
                  {formErrors.lastName ? (
                    <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 3, marginLeft: 4 }}>{formErrors.lastName}</Text>
                  ) : null}
                </View>
              </View>

              {form.role === "player" && (
                <View className={isFootballTeam ? "mb-3" : "flex-row gap-3 mb-3"}>
                  {isChessTeam ? (
                    <>
                      <View className="flex-1">
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          ELO RATING
                        </Text>
                        <TextInput
                          value={form.chessRating}
                          onChangeText={(v) => setForm({ ...form, chessRating: v })}
                          className={isDark ? "rounded-xl px-4 py-3" : "bg-gray-100 rounded-xl px-4 py-3"}
                          style={isDark ? { backgroundColor: T.inputBg, color: T.text } : { color: "#111827" }}
                          placeholder="e.g. 1200"
                          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          PREFERRED COLOR
                        </Text>
                        <View className="flex-row gap-1">
                          {["white", "black", "any"].map((c) => (
                            <TouchableOpacity
                              key={c}
                              onPress={() => setForm({ ...form, preferredColor: c })}
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                borderRadius: 12,
                                alignItems: "center",
                                backgroundColor: form.preferredColor === c ? "#081126" : (isDark ? T.inputBg : "#F3F4F6"),
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "700", color: form.preferredColor === c ? "#9AEA62" : (isDark ? T.textDim : "#6B7280"), textTransform: "capitalize" }}>
                                {c === "white" ? "♔" : c === "black" ? "♚" : "Any"}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </>
                  ) : isFootballTeam ? (
                    <>
                      <View style={{ marginBottom: 12 }}>
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          POSITION {form.position ? `· ${form.position}` : ""}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {FOOTBALL_PLAYER_POSITIONS.map((opt) => {
                            const active = form.position === opt.code;
                            return (
                              <TouchableOpacity
                                key={opt.code}
                                onPress={() => setForm({ ...form, position: active ? "" : opt.code })}
                                style={{
                                  minWidth: 52,
                                  paddingHorizontal: 10,
                                  paddingVertical: 8,
                                  borderRadius: 10,
                                  alignItems: "center",
                                  backgroundColor: active
                                    ? (isDark ? "rgba(154,234,98,0.18)" : "#081126")
                                    : (isDark ? T.inputBg : "#F3F4F6"),
                                  borderWidth: 1,
                                  borderColor: active
                                    ? (isDark ? "rgba(154,234,98,0.55)" : "#081126")
                                    : "transparent",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "800",
                                    color: active
                                      ? "#9AEA62"
                                      : (isDark ? T.textDim : "#374151"),
                                  }}
                                >
                                  {opt.code}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {form.position ? (
                          <Text style={{ marginTop: 6, fontSize: 11, color: isDark ? T.textMuted : "#6B7280" }}>
                            {FOOTBALL_PLAYER_POSITIONS.find((p) => p.code === form.position)?.label || form.position}
                          </Text>
                        ) : (
                          <Text style={{ marginTop: 6, fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF" }}>
                            Tap a role — used for lineup pitch placement
                          </Text>
                        )}
                      </View>
                      <View style={{ maxWidth: 140 }}>
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          JERSEY #
                        </Text>
                        <TextInput
                          value={form.jerseyNumber}
                          onChangeText={(v) => {
                            setForm({ ...form, jerseyNumber: v });
                            if (formErrors.jerseyNumber || formErrors.submit) clearFieldError("jerseyNumber");
                          }}
                          placeholder="0–99"
                          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                          keyboardType="number-pad"
                          style={{
                            backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            fontSize: 15,
                            color: isDark ? T.text : "#111827",
                            ...(formErrors.jerseyNumber ? { borderWidth: 1, borderColor: "#EF4444" } : {}),
                          }}
                        />
                        {formErrors.jerseyNumber ? (
                          <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 3, marginLeft: 4 }}>{formErrors.jerseyNumber}</Text>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <View className="flex-1">
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          POSITION
                        </Text>
                        <TextInput
                          value={form.position}
                          onChangeText={(v) => setForm({ ...form, position: v })}
                          className={isDark ? "rounded-xl px-4 py-3" : "bg-gray-100 rounded-xl px-4 py-3"}
                          style={isDark ? { backgroundColor: T.inputBg, color: T.text } : { color: "#111827" }}
                          placeholder="Position"
                          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-gray-500 text-xs font-bold mb-1"
                          style={isDark ? { color: T.textMuted } : undefined}
                        >
                          JERSEY #
                        </Text>
                        <TextInput
                          value={form.jerseyNumber}
                          onChangeText={(v) => {
                            setForm({ ...form, jerseyNumber: v });
                            if (formErrors.jerseyNumber || formErrors.submit) clearFieldError("jerseyNumber");
                          }}
                          placeholder="0–99"
                          placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                          keyboardType="number-pad"
                          style={{
                            backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            fontSize: 15,
                            color: isDark ? T.text : "#111827",
                            ...(formErrors.jerseyNumber ? { borderWidth: 1, borderColor: "#EF4444" } : {}),
                          }}
                        />
                        {formErrors.jerseyNumber ? (
                          <Text style={{ color: "#EF4444", fontSize: 11, marginTop: 3, marginLeft: 4 }}>{formErrors.jerseyNumber}</Text>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
              )}

              <View
                onLayout={(e) => {
                  emailFieldY.current = e.nativeEvent.layout.y;
                }}
              >
                <Text
                  className="text-gray-500 text-xs font-bold mb-1"
                  style={isDark ? { color: T.textMuted } : undefined}
                >
                  CONTACT EMAIL
                </Text>
                <TextInput
                  value={form.parentEmail}
                  onChangeText={(v) => {
                    setForm({ ...form, parentEmail: v });
                    if (formErrors.parentEmail || formErrors.submit) clearFieldError("parentEmail");
                  }}
                  onFocus={() => scrollToFieldY(playerModalScrollRef, emailFieldY.current)}
                  style={{
                    backgroundColor: isDark ? T.inputBg : "#F3F4F6",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: isDark ? T.text : "#111827",
                    marginBottom: formErrors.parentEmail ? 4 : 12,
                    ...(formErrors.parentEmail ? { borderWidth: 1, borderColor: "#EF4444" } : {}),
                  }}
                  placeholder="Email"
                  placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {formErrors.parentEmail ? (
                  <Text style={{ color: "#EF4444", fontSize: 11, marginBottom: 12, marginLeft: 4 }}>{formErrors.parentEmail}</Text>
                ) : null}
              </View>

              <Text
                className="text-gray-500 text-xs font-bold mb-2"
                style={isDark ? { color: T.textMuted } : undefined}
              >
                ROLE
              </Text>
              <View className="flex-row gap-2 mb-2">
                {["player", "manager", "spectator"].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setForm({ ...form, role: r })}
                    className="flex-1 py-2.5 rounded-xl items-center"
                    style={{ backgroundColor: form.role === r ? "#081126" : (isDark ? T.inputBg : "#F3F4F6") }}
                  >
                    <Text
                      style={{ color: form.role === r ? "#9AEA62" : (isDark ? T.textDim : "#6B7280") }}
                      className="font-bold capitalize text-sm"
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {form.role === "manager" && (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF", borderRadius: 10, padding: 9, marginBottom: 12, borderWidth: 1, borderColor: isDark ? "rgba(99,102,241,0.35)" : "#C7D2FE" }}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={isDark ? "#A5B4FC" : "#4F46E5"} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: isDark ? "#C7D2FE" : "#3730A3", lineHeight: 16 }}>
                    Full owner access — can start/end games, record scores, schedule events, assign tasks, and go live.
                  </Text>
                </View>
              )}
              {form.role === "spectator" && (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB", borderRadius: 10, padding: 9, marginBottom: 12, borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A" }}>
                  <Ionicons name="eye-outline" size={14} color={isDark ? "#FBBF24" : "#92400E"} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: isDark ? "#FDE68A" : "#78350F", lineHeight: 16 }}>
                    View only — can see team info but cannot edit or score.
                  </Text>
                </View>
              )}
              {form.role === "player" && (
                <View style={{ marginBottom: 4 }} />
              )}
              </ScrollView>

              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 12,
                  paddingBottom: playerFooterBottomPad,
                  borderTopWidth: 1,
                  borderTopColor: isDark ? T.borderSubtle : "#F3F4F6",
                  backgroundColor: isDark ? T.surface : "#fff",
                  flexShrink: 0,
                }}
              >
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  className="bg-[#9AEA62] py-4 rounded-xl items-center"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#081126" />
                  ) : (
                    <Text className="text-[#081126] font-bold text-base">
                      {editingPlayer ? "Update" : "Add Member"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
          </View>
        </View>
      </Modal>

      <BottomSheet
        ref={joinShareSheetRef}
        index={-1}
        snapPoints={["85%"]}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: isDark ? T.surface : "#FFFFFF",
        }}
        handleIndicatorStyle={{ backgroundColor: isDark ? T.border : "#E5E7EB", width: 40 }}
        onChange={(idx) => { if (idx === -1) setShowJoinShareModal(false); }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom + 16, 20), alignItems: "center" }}
        >
            <TouchableOpacity
              onPress={closeJoinShare}
              style={{ position: "absolute", top: 4, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={18} color={isDark ? T.textDim : "#374151"} />
            </TouchableOpacity>

            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#081126", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Ionicons name="qr-code-outline" size={26} color="#9AEA62" />
            </View>
            <Text style={{ color: isDark ? T.text : "#081126", fontSize: 20, fontWeight: "900", textAlign: "center" }}>
              Share Team Join QR
            </Text>
            <Text style={{ color: isDark ? T.textDim : "#6B7280", fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 18 }}>
              Players can scan this and complete their roster details.
            </Text>

            {inviteTeamOptions.length > 1 && (
              <View style={{ width: "100%", marginBottom: 18 }}>
                <Text style={{ color: isDark ? T.textDim : "#374151", fontSize: 12, fontWeight: "800", marginBottom: 8 }}>
                  Invite players to
                </Text>
                <View style={{ flexDirection: "row", backgroundColor: isDark ? T.segmentBg : "#E5E7EB", borderRadius: 14, padding: 4, gap: 8 }}>
                  {inviteTeamOptions.map((option) => {
                    const isSelected = joinShareTeamId === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={async () => {
                          setJoinShareTeamId(option.id);
                          await fetchJoinShareData(option.id);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          alignItems: "center",
                          backgroundColor: isSelected ? "#081126" : (isDark ? T.surface : "#FFFFFF"),
                          borderWidth: 1,
                          borderColor: isSelected ? option.accent : (isDark ? T.border : "#D1D5DB"),
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? option.accent : (isDark ? T.textDim : "#6B7280"),
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {option.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {joinShareLoading ? (
              <View style={{ height: 210, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color={isDark ? T.refresh : "#081126"} />
              </View>
            ) : joinShareUrl ? (
              <>
                <View style={{ width: "100%", backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 }}>
                  <Text style={{ color: isDark ? T.textMuted : "#6B7280", fontSize: 11, fontWeight: "700", marginBottom: 2 }}>
                    Selected team
                  </Text>
                  <Text style={{ color: isDark ? T.text : "#081126", fontSize: 15, fontWeight: "800" }}>
                    {selectedInviteTeam?.name || team?.teamName || "My Team"}
                  </Text>
                </View>
                <View style={{ padding: 14, backgroundColor: isDark ? "#FFFFFF" : "#fff", borderRadius: 16, borderWidth: 1, borderColor: isDark ? T.border : "#E5E7EB" }}>
                  <QRCode value={joinShareUrl} size={190} />
                </View>
                <View style={{ width: "100%", backgroundColor: isDark ? T.surfaceAlt : "#F3F4F6", borderRadius: 12, padding: 12, marginTop: 16 }}>
                  <Text style={{ color: isDark ? T.textDim : "#374151", fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Join link</Text>
                  <Text style={{ color: isDark ? T.textMuted : "#6B7280", fontSize: 12 }} numberOfLines={3}>{joinShareUrl}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleShareJoinLink}
                  style={{ width: "100%", marginTop: 16, backgroundColor: "#9AEA62", borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="share-social-outline" size={18} color="#081126" />
                  <Text style={{ color: "#081126", fontWeight: "800", fontSize: 15 }}>Share Link</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ color: isDark ? T.dangerText : "#EF4444", fontWeight: "700", paddingVertical: 24 }}>Could not create join link.</Text>
            )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// =============================================
// SCHEDULE TAB - Full CRUD
// =============================================
