import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { PrimaryButton, SectionCard, sortDivisions, getDivisionName, TournamentTeamLogo, divisionCopy, formatDivisionDisplayName } from "@/features/tournament/helpers";
import NextStageCard from "./NextStageCard";
import { canBulkMoveTeams as canBulkMoveTeamsGuard } from "@/features/tournament/manageConfig";

const MAX_DIVISIONS = 12;

export default function ManageTab({
  tournament,
  tournamentId,
  fixtures,
  standingsByDivision,
  pendingInvites,
  joinRequests = [],
  busy,
  joinRequestAction = null,
  isOwner,
  onEditTournament,
  onManageAdmins,
  onInvite,
  onAddMyTeam,
  onCancelInvite,
  onRemoveTeam,
  onMoveTeam,
  onBulkMoveTeams,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onViewJoinRequest,
  onCreateDivision,
  onRenameDivision,
  onDeleteDivision,
  onGenerateFixtures,
  onBuildFixtures,
  onSetKnockoutRound,
  onGenerateNextStage,
  onOpenBracket,
  onNotifyCoaches,
  onDelete,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const canChangeTeams = !tournament.fixturesGenerated;
  const divisions = sortDivisions(tournament.divisions);
  const showDivisionAdmin = tournament.format !== "knockout";
  const hasMultipleDivisions = divisions.length > 1;
  const canAddDivision = canChangeTeams && divisions.length < MAX_DIVISIONS;
  const sport = tournament?.sport;
  const copy = divisionCopy(sport);
  const canBulkMove = canBulkMoveTeamsGuard(tournament, { hasBulkHandler: !!onBulkMoveTeams });

  const teams = tournament.teams || [];
  const [selectedIds, setSelectedIds] = useState([]);

  const matchFixtures = useMemo(
    () => (fixtures || []).filter((fixture) => fixture && fixture.status !== "bye"),
    [fixtures],
  );
  const canNotifyCoaches = matchFixtures.length > 0 && !!onNotifyCoaches;

  useEffect(() => {
    setSelectedIds([]);
  }, [tournament?._id, tournament?.fixturesGenerated, teams.length]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const allSelected = teams.length > 0 && selectedIds.length === teams.length;

  const toggleTeam = (teamId) => {
    const id = String(teamId);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(teams.map((t) => String(t.teamId)));
  };

  const coAdminCount = (tournament.admins || []).length;
  const pendingJoinRequests = (joinRequests || []).filter((r) => r.status === "pending");

  const titleColor = isDark ? T.text : "#0B1324";
  const muted = isDark ? T.textMuted : "#9CA3AF";
  const dim = isDark ? T.textDim : "#6B7280";
  const rowBorder = isDark ? T.borderSubtle : "#F1F5F9";
  const linkColor = isDark ? "#93C5FD" : "#2563EB";
  const approveColor = isDark ? "#4ADE80" : "#16A34A";
  const rejectColor = isDark ? "#F87171" : "#DC2626";
  const successText = isDark ? "#4ADE80" : "#166534";

  const settingRow = (icon, title, subtitle, onPress) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: rowBorder,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: isDark ? T.surfaceAlt : "#F1F5F9",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={17} color={titleColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: titleColor }}>{title}</Text>
        <Text style={{ fontSize: 11, color: muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? T.iconMuted : "#94A3B8"} />
    </TouchableOpacity>
  );

  return (
    <View>
      <SectionCard title="Tournament settings" isDark={isDark} T={T}>
        {settingRow(
          "create-outline",
          "Edit tournament",
          "Name, dates, venue, points and tie-breakers",
          onEditTournament,
        )}
        {settingRow(
          "people-outline",
          "League admins",
          coAdminCount > 0
            ? `Owner + ${coAdminCount} co-admin${coAdminCount === 1 ? "" : "s"}`
            : isOwner
              ? "Add co-admins to help run the league"
              : "View league admins",
          onManageAdmins,
        )}
      </SectionCard>

      {showDivisionAdmin ? (
        <SectionCard
          title={`${copy.plural} (${divisions.length})`}
          isDark={isDark}
          T={T}
          actions={
            canAddDivision
              ? [{ label: "+ Add", onPress: onCreateDivision }]
              : null
          }
        >
          {divisions.map((div) => (
            <View
              key={div.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: rowBorder,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: titleColor }}>
                  {formatDivisionDisplayName(div, sport)}
                </Text>
                <Text style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                  {(div.teamIds || []).length} team{(div.teamIds || []).length === 1 ? "" : "s"}
                </Text>
              </View>
              {canChangeTeams ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <TouchableOpacity onPress={() => onRenameDivision(div)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil-outline" size={18} color={linkColor} />
                  </TouchableOpacity>
                  {divisions.length > 1 ? (
                    <TouchableOpacity onPress={() => onDeleteDivision(div)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={rejectColor} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
          {canChangeTeams ? (
            <Text style={{ color: muted, fontSize: 12, marginTop: 10, lineHeight: 17 }}>
              {hasMultipleDivisions
                ? `Select teams below and Move them into ${copy.pluralLower} before generating fixtures.`
                : `Add more ${copy.pluralLower} to split teams, or keep a single league table.`}
            </Text>
          ) : null}
        </SectionCard>
      ) : null}

      {canChangeTeams && (onApproveJoinRequest || onRejectJoinRequest) ? (
        <SectionCard title={`Join requests (${pendingJoinRequests.length})`} isDark={isDark} T={T}>
          {pendingJoinRequests.length === 0 ? (
            <Text style={{ color: muted, fontSize: 13 }}>
              No pending requests. Teams can request to join from the public tournament page.
            </Text>
          ) : (
            pendingJoinRequests.map((req) => {
              const reqId = String(req._id || "");
              const actionBusy =
                joinRequestAction && String(joinRequestAction.id) === reqId
                  ? joinRequestAction.type
                  : null;
              const rowBusy = busy || !!joinRequestAction;
              return (
                <View
                  key={req._id || `${req.teamId}-${req.createdAt}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: rowBorder,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => onViewJoinRequest?.(req)}
                    activeOpacity={0.75}
                    disabled={rowBusy}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 8, opacity: rowBusy ? 0.7 : 1 }}
                  >
                    <TournamentTeamLogo
                      teamLogo={req.teamLogo}
                      teamName={req.teamName}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: titleColor }}>{req.teamName}</Text>
                      <Text style={{ fontSize: 11, color: linkColor, marginTop: 2, fontWeight: "600" }}>
                        View creator & members
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? T.iconMuted : "#94A3B8"} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 110, justifyContent: "flex-end" }}>
                    <TouchableOpacity
                      disabled={rowBusy}
                      onPress={() => onApproveJoinRequest?.(req)}
                      style={{ minWidth: 58, alignItems: "center", justifyContent: "center", minHeight: 22 }}
                    >
                      {actionBusy === "approve" ? (
                        <ActivityIndicator size="small" color={approveColor} />
                      ) : (
                        <Text style={{ color: approveColor, fontWeight: "700", fontSize: 12, opacity: rowBusy ? 0.45 : 1 }}>
                          Approve
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={rowBusy}
                      onPress={() => onRejectJoinRequest?.(req)}
                      style={{ minWidth: 48, alignItems: "center", justifyContent: "center", minHeight: 22 }}
                    >
                      {actionBusy === "reject" ? (
                        <ActivityIndicator size="small" color={rejectColor} />
                      ) : (
                        <Text style={{ color: rejectColor, fontWeight: "700", fontSize: 12, opacity: rowBusy ? 0.45 : 1 }}>
                          Reject
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Teams (${teams.length})`}
        isDark={isDark}
        T={T}
        actions={
          canChangeTeams
            ? [
                { label: "+ Invite", onPress: onInvite },
                { label: "+ My team", onPress: onAddMyTeam },
              ]
            : null
        }
      >
        {teams.length === 0 && (
          <Text style={{ color: muted, fontSize: 13 }}>No teams enrolled yet. Invite teams to join.</Text>
        )}

        {canBulkMove && teams.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: rowBorder,
            }}
          >
            <TouchableOpacity
              onPress={toggleSelectAll}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name={allSelected ? "checkbox" : "square-outline"}
                size={20}
                color={allSelected ? "#22C55E" : isDark ? T.iconMuted : "#94A3B8"}
              />
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#64748B" }}>
                {allSelected ? "Clear all" : "Select all"}
              </Text>
            </TouchableOpacity>
            {selectedIds.length > 0 ? (
              <TouchableOpacity
                disabled={busy}
                onPress={() => {
                  onBulkMoveTeams?.(selectedIds);
                  setSelectedIds([]);
                }}
                style={{
                  backgroundColor: "#0B1324",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  opacity: busy ? 0.6 : 1,
                  ...(isDark && { borderWidth: 1, borderColor: T.border }),
                }}
              >
                <Text style={{ color: "#BAF072", fontWeight: "800", fontSize: 12 }}>
                  Move {selectedIds.length}…
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: 11, color: muted, fontWeight: "600" }}>Multi-select to move</Text>
            )}
          </View>
        ) : null}

        {teams.map((t) => {
          const tid = String(t.teamId);
          const selected = selectedSet.has(tid);
          return (
            <View
              key={t.teamId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: rowBorder,
              }}
            >
              {canBulkMove ? (
                <TouchableOpacity
                  onPress={() => toggleTeam(tid)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={{ marginRight: 10 }}
                >
                  <Ionicons
                    name={selected ? "checkbox" : "square-outline"}
                    size={22}
                    color={selected ? "#22C55E" : isDark ? T.iconMuted : "#CBD5E1"}
                  />
                </TouchableOpacity>
              ) : null}
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: titleColor }}>{t.teamName}</Text>
                {showDivisionAdmin && hasMultipleDivisions ? (
                  <Text style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                    {getDivisionName(divisions, t.divisionId, sport)}
                  </Text>
                ) : null}
              </View>
              {canChangeTeams ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {showDivisionAdmin && hasMultipleDivisions ? (
                    <TouchableOpacity onPress={() => onMoveTeam(t)}>
                      <Text style={{ color: linkColor, fontWeight: "700", fontSize: 12 }}>Move</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => onRemoveTeam(t.teamId)}>
                    <Ionicons name="close-circle" size={20} color={isDark ? "#F87171" : "#EF4444"} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </SectionCard>

      {canChangeTeams && (
        <SectionCard title={`Pending invites (${pendingInvites.length})`} isDark={isDark} T={T}>
          {pendingInvites.length === 0 ? (
            <Text style={{ color: muted, fontSize: 13 }}>No pending invitations.</Text>
          ) : (
            pendingInvites.map((inv) => (
              <View
                key={inv._id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: rowBorder,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: titleColor }}>{inv.teamName}</Text>
                  <Text style={{ fontSize: 11, color: muted, marginTop: 2 }}>Awaiting response</Text>
                </View>
                <TouchableOpacity onPress={() => onCancelInvite(inv.teamId, inv.teamName)}>
                  <Text style={{ color: rejectColor, fontWeight: "700", fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </SectionCard>
      )}

      <SectionCard title="Fixtures" isDark={isDark} T={T}>
        {!tournament.fixturesGenerated ? (
          <>
            <Text style={{ color: dim, fontSize: 13, marginBottom: 12 }}>
              {tournament.format === "knockout"
                ? "Pair teams for the first knockout round. With an odd count, assign a bye."
                : `Fill a full round-robin per ${copy.singularLower} (recommended for large groups), or add custom matches. Leftover teams in one match still play in others — league is not knockout.`}
            </Text>
            <PrimaryButton
              label={
                tournament.format === "knockout"
                  ? "Set knockout round"
                  : "Build league fixtures"
              }
              onPress={
                tournament.format === "knockout"
                  ? onSetKnockoutRound || onBuildFixtures
                  : onBuildFixtures || onGenerateFixtures
              }
              disabled={busy || teams.length < 2}
              busy={busy}
              isDark={isDark}
              T={T}
            />
            {canNotifyCoaches ? (
              <TouchableOpacity
                onPress={onNotifyCoaches}
                disabled={busy}
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? T.border : "#CBD5E1",
                  backgroundColor: isDark ? T.surfaceAlt : "#FFFFFF",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Ionicons name="mail-outline" size={16} color={titleColor} />
                <Text style={{ color: titleColor, fontWeight: "800", marginLeft: 8 }}>
                  Intimate coaches
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <Text style={{ color: successText, fontSize: 13, fontWeight: "600" }}>
              Fixtures published ({fixtures.length} matches).
            </Text>
            {canNotifyCoaches ? (
              <TouchableOpacity
                onPress={onNotifyCoaches}
                disabled={busy}
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#0B1324",
                  opacity: busy ? 0.6 : 1,
                  ...(isDark && { borderWidth: 1, borderColor: T.border }),
                }}
              >
                <Ionicons name="mail-outline" size={16} color="#BAF072" />
                <Text style={{ color: "#BAF072", fontWeight: "800", marginLeft: 8 }}>
                  Intimate coaches
                </Text>
              </TouchableOpacity>
            ) : null}
            {tournament.format === "knockout" || tournament.format === "hybrid" ? (
              <TouchableOpacity
                onPress={onSetKnockoutRound}
                disabled={busy}
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#0B1324",
                  opacity: busy ? 0.6 : 1,
                  ...(isDark && { borderWidth: 1, borderColor: T.border }),
                }}
              >
                <Ionicons name="git-branch-outline" size={16} color="#BAF072" />
                <Text style={{ color: "#BAF072", fontWeight: "800", marginLeft: 8 }}>
                  Set next knockout round
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </SectionCard>

      <NextStageCard
        tournament={tournament}
        tournamentId={tournamentId || tournament._id || tournament.id}
        fixtures={fixtures}
        standingsByDivision={standingsByDivision}
        busy={busy}
        onGenerateNextStage={onSetKnockoutRound || onGenerateNextStage}
        onOpenBracket={onOpenBracket}
        nextStageLabel="Set knockout round"
      />

      <SectionCard title="Danger zone" isDark={isDark} T={T}>
        <TouchableOpacity
          onPress={onDelete}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? "rgba(248,113,113,0.45)" : "#FCA5A5",
            backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "transparent",
          }}
        >
          <Ionicons name="trash-outline" size={18} color={rejectColor} />
          <Text style={{ color: rejectColor, fontWeight: "700", marginLeft: 8 }}>Delete tournament</Text>
        </TouchableOpacity>
      </SectionCard>
    </View>
  );
}
