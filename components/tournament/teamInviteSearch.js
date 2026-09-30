/** Short public code to disambiguate teams with the same name (last 6 of id). */
export const formatTeamCode = (teamId) => {
  const id = String(teamId || "");
  if (id.length < 4) return id.toUpperCase();
  return id.slice(-6).toUpperCase();
};

export const formatOwnerLabel = (profile) => {
  if (!profile) return null;
  const name = profile.fullname || profile.username;
  return name ? String(name).trim() : null;
};

export const formatTeamMetaLine = (team) => {
  const parts = [
    team?.location,
    team?.season,
    team?.ageGroup && team.ageGroup !== "Open" ? team.ageGroup : null,
    team?.teamType,
  ].filter(Boolean);
  return parts.join(" · ");
};

export const hasDuplicateTeamNames = (teams) => {
  const names = (teams || []).map((t) => String(t?.teamName || "").trim().toLowerCase()).filter(Boolean);
  return names.length !== new Set(names).size;
};

export const describeTeamForConfirm = (team, ownerProfile) => {
  const meta = formatTeamMetaLine(team);
  const manager = formatOwnerLabel(ownerProfile);
  const code = formatTeamCode(team._id);
  const bits = [team.teamName];
  if (meta) bits.push(meta);
  if (manager) bits.push(`Manager: ${manager}`);
  bits.push(`Code: ${code}`);
  return bits.join("\n");
};
