import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { getPlayersByTeamAPI } from "@/services/PlayerApi";
import { getUsersByIdsAPI } from "@/services/AuthApi";
import { extractPlayersFromApiResponse } from "@/lib/playerRoster";
import { formatOwnerLabel, formatTeamCode, formatTeamMetaLine } from "@/components/tournament/teamInviteSearch";
import { TournamentTeamLogo } from "@/features/tournament/helpers";
import PlayerNameAvatar from "./PlayerNameAvatar";

const displayPlayerName = (p) => {
  const fromParts = [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  return p?.fullname || p?.name || p?.playerName || p?.username || "Player";
};

const displayPlayerImage = (p) =>
  p?.profilePicture || p?.playerimage || p?.profileImage || p?.avatar || p?.photo || null;

const rosterForJoinPreview = (list = []) =>
  (Array.isArray(list) ? list : []).filter(
    (p) => p && p.isActive !== false && p.role !== "spectator",
  );

export default function JoinRequestDetailSheet({
  request,
  visible,
  busy,
  actionType = null,
  onClose,
  onApprove,
  onReject,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState(null);
  const [creator, setCreator] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || !request?.teamId) {
      setTeam(null);
      setCreator(null);
      setMembers([]);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [teamRes, playersRes] = await Promise.all([
          getTeamByIdAPI(request.teamId),
          getPlayersByTeamAPI(request.teamId),
        ]);
        if (cancelled) return;

        const teamData = teamRes?.data || teamRes?.team || teamRes || null;
        setTeam(teamData);

        const rawPlayers = extractPlayersFromApiResponse(playersRes);
        setMembers(rosterForJoinPreview(rawPlayers));

        const ownerId =
          request.teamOwnerId ||
          request.requestedBy ||
          teamData?.createdBy ||
          null;
        if (ownerId) {
          try {
            const usersRes = await getUsersByIdsAPI([String(ownerId)]);
            if (cancelled) return;
            const payload = usersRes?.data || usersRes || {};
            let profile = null;
            if (Array.isArray(payload)) {
              profile =
                payload.find((u) => String(u._id || u.id || u.userId) === String(ownerId)) || null;
            } else if (payload && typeof payload === "object") {
              profile = payload[String(ownerId)] || null;
            }
            setCreator(profile);
          } catch {
            if (!cancelled) setCreator(null);
          }
        }

        const memberUserIds = [
          ...new Set(
            rosterForJoinPreview(rawPlayers)
              .map((p) => (p?.userId != null ? String(p.userId) : ""))
              .filter(Boolean),
          ),
        ];
        if (memberUserIds.length) {
          try {
            const usersRes = await getUsersByIdsAPI(memberUserIds);
            if (cancelled) return;
            const payload = usersRes?.data || usersRes || {};
            const map = Array.isArray(payload)
              ? Object.fromEntries(
                  payload.map((u) => [String(u._id || u.id || u.userId), u]),
                )
              : payload;
            setMembers(
              rosterForJoinPreview(rawPlayers).map((p) => {
                const uid = p?.userId != null ? String(p.userId) : "";
                const profile = uid ? map[uid] : null;
                if (!profile) return p;
                return {
                  ...p,
                  profilePicture:
                    p.profilePicture ||
                    p.playerimage ||
                    profile.profileImage ||
                    profile.avatar ||
                    profile.photoURL ||
                    null,
                  fullname: p.fullname || profile.fullname || profile.username,
                };
              }),
            );
          } catch {
            // roster names/images from player-service are enough
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || "Failed to load team");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, request?.teamId, request?.teamOwnerId, request?.requestedBy]);

  if (!request) return null;

  const logo = request.teamLogo || team?.teamlogo || team?.teamLogo || team?.logo;
  const name = request.teamName || team?.teamName || "Team";
  const creatorName =
    formatOwnerLabel(creator) ||
    (request.teamOwnerId ? `User ${String(request.teamOwnerId).slice(-4)}` : "Unknown");
  const meta = formatTeamMetaLine(team || {});
  const code = formatTeamCode(request.teamId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: isDark ? T.overlay : "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: isDark ? T.surface : "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: "85%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <TournamentTeamLogo teamLogo={logo} teamName={name} size={52} />
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324" }}>{name}</Text>
              {meta ? (
                <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 4 }}>{meta}</Text>
              ) : null}
              <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 4, fontWeight: "600" }}>
                Code {code}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={isDark ? T.iconMuted : "#64748B"} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={isDark ? "#BAF072" : "#0B1324"} />
              <Text style={{ marginTop: 10, color: isDark ? T.textDim : "#6B7280", fontWeight: "600" }}>Loading team…</Text>
            </View>
          ) : error ? (
            <Text style={{ color: isDark ? T.dangerText : "#DC2626", fontSize: 13, paddingVertical: 16 }}>{error}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginBottom: 8 }}>
                TEAM CREATOR
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                  borderRadius: 12,
                  marginBottom: 16,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: isDark ? T.border : "transparent",
                }}
              >
                <PlayerNameAvatar
                  name={creatorName}
                  profileImage={creator?.profileImage || creator?.avatar || creator?.photoURL}
                  size={40}
                  isDark={isDark}
                  T={T}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? T.text : "#0B1324" }}>{creatorName}</Text>
                  {creator?.email ? (
                    <Text style={{ fontSize: 12, color: isDark ? T.textDim : "#6B7280", marginTop: 2 }}>{creator.email}</Text>
                  ) : null}
                </View>
              </View>

              <Text style={{ fontSize: 12, fontWeight: "800", color: isDark ? T.textDim : "#64748B", marginBottom: 8 }}>
                MEMBERS ({members.length})
              </Text>
              {members.length === 0 ? (
                <Text style={{ color: isDark ? T.textMuted : "#9CA3AF", fontSize: 13, marginBottom: 12 }}>
                  No active members on this roster yet.
                </Text>
              ) : (
                members.map((p) => {
                  const playerName = displayPlayerName(p);
                  const roleLabel =
                    p.role && String(p.role).trim()
                      ? String(p.role).trim()
                      : "player";
                  return (
                    <View
                      key={String(p._id || p.id || playerName)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? T.border : "#F1F5F9",
                      }}
                    >
                      <PlayerNameAvatar
                        name={playerName}
                        profileImage={displayPlayerImage(p)}
                        size={34}
                        isDark={isDark}
                        T={T}
                      />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? T.text : "#0B1324" }}>
                          {playerName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: isDark ? T.textMuted : "#9CA3AF",
                            marginTop: 2,
                            textTransform: "capitalize",
                          }}
                        >
                          {roleLabel}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => onReject?.(request)}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? "rgba(248,113,113,0.35)" : "#FECACA",
                backgroundColor: isDark ? T.dangerBg : "transparent",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                opacity: busy && actionType !== "reject" ? 0.45 : 1,
              }}
            >
              {actionType === "reject" ? (
                <ActivityIndicator color={isDark ? "#F87171" : "#DC2626"} />
              ) : (
                <Text style={{ fontWeight: "800", color: isDark ? "#F87171" : "#DC2626" }}>Reject</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onApprove?.(request)}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                backgroundColor: "#0B1324",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                opacity: busy && actionType !== "approve" ? 0.45 : 1,
                ...(isDark && { borderWidth: 1, borderColor: T.border }),
              }}
            >
              {actionType === "approve" ? (
                <ActivityIndicator color="#BAF072" />
              ) : (
                <Text style={{ fontWeight: "800", color: "#BAF072" }}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
