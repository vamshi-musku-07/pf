import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { showToast } from "@/context/ToastContext";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import {
  getTournamentInviteByIdAPI,
  acceptTournamentInviteAPI,
  declineTournamentInviteAPI,
} from "@/services/TournamentApi";

const { height: SCREEN_H } = Dimensions.get("window");

const FORMAT_LABEL = {
  round_robin: "Round Robin",
  knockout: "Knockout",
  hybrid: "League + Playoffs",
};

const formatShortDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const formatDateRange = (start, end) => {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || null;
};

const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

function StatCard({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color="#BAF072" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color="#BAF072" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function TournamentInviteSheet({
  visible,
  inviteId,
  onClose,
  onAccepted,
  backTo = "/(tabs)/invitations",
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const bottomPad = Math.max(insets.bottom, 16) + (keyboardInset > 0 ? keyboardInset : 0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinedTournamentId, setJoinedTournamentId] = useState(null);

  const invite = data?.invite;
  const tournament = data?.tournament;

  const sheetMaxHeight = Math.min(SCREEN_H * 0.92, SCREEN_H - Math.max(insets.top, 12) - 8);

  const fetchDetail = useCallback(async () => {
    if (!inviteId) return;
    setLoading(true);
    try {
      const res = await getTournamentInviteByIdAPI(inviteId);
      setData(res?.data || null);
    } catch {
      showToast("Could not load invitation", "error");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [inviteId, onClose]);

  useEffect(() => {
    if (!visible || !inviteId) return;
    setJoinedTournamentId(null);
    fetchDetail();
  }, [visible, inviteId, fetchDetail]);

  const handleAccept = () => {
    Alert.alert(
      "Join tournament?",
      `Enroll "${invite?.teamName}" in ${invite?.tournamentName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await acceptTournamentInviteAPI(inviteId);
              const tid = res?.data?.tournament?._id || invite?.tournamentId;
              showToast(res?.message || "Joined tournament", "success");
              setJoinedTournamentId(tid || null);
              onAccepted?.(tid);
            } catch (error) {
              showToast(error?.response?.data?.error || "Failed to accept", "error");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleDecline = () => {
    Alert.alert("Decline invitation?", "The tournament admin will be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await declineTournamentInviteAPI(inviteId);
            showToast("Invitation declined", "success");
            onClose?.();
          } catch (error) {
            showToast(error?.response?.data?.error || "Failed to decline", "error");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openTournament = () => {
    const tid = joinedTournamentId || invite?.tournamentId;
    if (!tid) return;
    onClose?.();
    router.push({ pathname: `/tournament/${tid}`, params: { backTo } });
  };

  const format = FORMAT_LABEL[invite?.tournamentFormat] || invite?.tournamentFormat;
  const overs = invite?.tournamentConfig?.totalOvers;
  const matchFmt = invite?.tournamentConfig?.matchFormat;
  const teamCount = tournament?.teams?.length ?? 0;
  const divisionCount = (tournament?.divisions || []).length;
  const dateRange = formatDateRange(invite?.startDate, invite?.endDate);
  const expiryDays = daysUntil(invite?.expiresAt);
  const matchStyle =
    matchFmt && overs ? `${matchFmt} · ${overs} overs` : matchFmt || (overs ? `${overs} overs` : null);

  const enrolledPreview = useMemo(
    () => (tournament?.teams || []).slice(0, 10),
    [tournament?.teams],
  );

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { maxHeight: sheetMaxHeight, marginBottom: 0 }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 80, alignItems: "center", backgroundColor: "#0B1324" }}>
              <ActivityIndicator size="large" color="#BAF072" />
              <Text style={{ color: "#94A3B8", marginTop: 12, fontWeight: "600" }}>Loading invitation…</Text>
            </View>
          ) : !invite ? (
            <View style={{ padding: 40, alignItems: "center", paddingBottom: bottomPad }}>
              <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
              <Text style={{ marginTop: 12, fontWeight: "700", color: "#374151" }}>Invitation not found</Text>
            </View>
          ) : joinedTournamentId || invite.status === "accepted" ? (
            <View style={{ paddingBottom: bottomPad }}>
              <View style={styles.successHeader}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={52} color="#BAF072" />
                </View>
                <Text style={styles.successTitle}>You're in!</Text>
                <Text style={styles.successSubtitle}>
                  {invite.teamName} is enrolled in {invite.tournamentName}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                <TouchableOpacity onPress={openTournament} style={styles.primaryBtn}>
                  <Ionicons name="trophy" size={18} color="#BAF072" />
                  <Text style={styles.primaryBtnText}>View Tournament</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={styles.badgeRow}>
                      <View style={styles.badge}>
                        <Ionicons name="mail-open-outline" size={12} color="#BAF072" />
                        <Text style={styles.badgeText}>TOURNAMENT INVITE</Text>
                      </View>
                      {invite.tournamentSport ? (
                        <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                          <Text style={[styles.badgeText, { color: "#E2E8F0" }]}>
                            {invite.tournamentSport}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.title}>{invite.tournamentName}</Text>
                    <Text style={styles.subtitle}>
                      {[format, matchStyle].filter(Boolean).join(" · ") || "Tournament"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.statsGrid}>
                  <StatCard icon="people" label="Teams enrolled" value={`${teamCount}`} />
                  <StatCard
                    icon="git-branch-outline"
                    label={
                      String(tournament?.sport || "").toLowerCase() === "football" ? "Groups" : "Divisions"
                    }
                    value={divisionCount > 1 ? `${divisionCount}` : "1"}
                  />
                  <StatCard icon="trophy-outline" label="Format" value={format} />
                  <StatCard icon="timer-outline" label="Match" value={matchStyle} />
                </View>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 12 }}
              >
                <View style={styles.teamCard}>
                  <Text style={styles.sectionEyebrow}>YOUR TEAM</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={styles.teamAvatar}>
                      <Text style={{ color: "#BAF072", fontWeight: "900", fontSize: 18 }}>
                        {(invite.teamName || "T").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{invite.teamName}</Text>
                      <Text style={styles.teamHint}>Accept to enroll this squad</Text>
                    </View>
                    <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
                  </View>
                </View>

                {invite.message ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.sectionEyebrow}>MESSAGE FROM ORGANIZER</Text>
                    <View style={styles.messageCard}>
                      <Text style={styles.messageText}>"{invite.message}"</Text>
                    </View>
                  </View>
                ) : null}

                {invite.tournamentDescription ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={styles.sectionEyebrow}>ABOUT</Text>
                    <Text style={styles.description}>{invite.tournamentDescription}</Text>
                  </View>
                ) : null}

                <Text style={[styles.sectionEyebrow, { marginBottom: 8 }]}>TOURNAMENT DETAILS</Text>
                <DetailRow icon="calendar-outline" label="Dates" value={dateRange} />
                <DetailRow icon="snow-outline" label="Season" value={invite.season} />
                <DetailRow icon="location-outline" label="Venue" value={invite.venue} />
                <DetailRow
                  icon="hourglass-outline"
                  label="Invite expires"
                  value={
                    invite.expiresAt
                      ? `${new Date(invite.expiresAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}${expiryDays != null ? ` · ${expiryDays} day${expiryDays === 1 ? "" : "s"} left` : ""}`
                      : undefined
                  }
                />

                {enrolledPreview.length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionEyebrow}>
                      ENROLLED TEAMS ({teamCount})
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {enrolledPreview.map((t) => (
                        <View key={t.teamId} style={styles.teamChip}>
                          <Text style={styles.teamChipText}>{t.teamName}</Text>
                        </View>
                      ))}
                      {teamCount > enrolledPreview.length ? (
                        <View style={[styles.teamChip, { backgroundColor: "#E2E8F0" }]}>
                          <Text style={[styles.teamChipText, { color: "#64748B" }]}>
                            +{teamCount - enrolledPreview.length} more
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyTeams}>
                    <Ionicons name="people-outline" size={18} color="#94A3B8" />
                    <Text style={{ color: "#64748B", fontSize: 13, fontWeight: "600", marginLeft: 8 }}>
                      Be among the first teams to join
                    </Text>
                  </View>
                )}
              </ScrollView>

              {invite.status === "pending" ? (
                <View style={[styles.footer, { paddingBottom: bottomPad }]}>
                  <TouchableOpacity
                    onPress={handleAccept}
                    disabled={busy}
                    style={[styles.primaryBtn, { opacity: busy ? 0.7 : 1 }]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#BAF072" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#BAF072" />
                        <Text style={styles.primaryBtnText}>Accept & Join Tournament</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDecline}
                    disabled={busy}
                    style={styles.declineBtn}
                  >
                    <Text style={styles.declineText}>Decline invitation</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPad, alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontWeight: "600" }}>
                    This invitation is {invite.status}
                  </Text>
                  {invite.status === "accepted" && invite.tournamentId ? (
                    <TouchableOpacity onPress={openTournament} style={{ marginTop: 12 }}>
                      <Text style={{ color: "#2563EB", fontWeight: "800" }}>View tournament →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: "#0B1324",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  header: {
    backgroundColor: "#0B1324",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(186,240,114,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: "#BAF072",
    fontSize: 11,
    fontWeight: "800",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(186,240,114,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  teamCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  sectionEyebrow: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  teamAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0B1324",
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B1324",
  },
  teamHint: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  messageCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  messageText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  description: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0B1324",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  detailValue: {
    color: "#0B1324",
    fontSize: 14,
    fontWeight: "700",
  },
  teamChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  teamChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyTeams: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#fff",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#0B1324",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    color: "#BAF072",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#6B7280",
    fontWeight: "700",
  },
  declineBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  declineText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 14,
  },
  successHeader: {
    backgroundColor: "#0B1324",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    alignItems: "center",
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(186,240,114,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  successSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
});
