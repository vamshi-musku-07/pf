import React from "react";
import TournamentListCard from "@/components/tournament/TournamentListCard";
import {
  getAppliedStatusMeta,
  formatAppliedWhen,
} from "@/features/tournament/appliedConfig";

const DARK_CHIP = {
  pending: { chipBg: "rgba(245,158,11,0.18)", chipText: "#FBBF24" },
  approved: { chipBg: "rgba(34,197,94,0.16)", chipText: "#4ADE80" },
  rejected: { chipBg: "rgba(239,68,68,0.16)", chipText: "#F87171" },
  cancelled: { chipBg: "rgba(148,163,184,0.16)", chipText: "#A1A1AA" },
};

export default function AppliedRequestCard({ request, onPress, isDark = false, T }) {
  const meta = getAppliedStatusMeta(request?.status);
  const when = formatAppliedWhen(request?.createdAt);
  const teamName = request?.teamName || "Your team";
  const darkChip = DARK_CHIP[request?.status] || DARK_CHIP.pending;
  const chipBg = isDark ? darkChip.chipBg : meta.chipBg;
  const chipText = isDark ? darkChip.chipText : meta.chipText;
  const sportLabel = String(request?.tournamentSport || request?.sport || "").trim();

  return (
    <TournamentListCard
      title={request?.tournamentName || "Tournament"}
      subtitle={[sportLabel || null, teamName, `Applied ${when}`].filter(Boolean).join(" · ")}
      sport={request?.tournamentSport || request?.sport}
      chipLabel={meta.shortLabel}
      chipBg={chipBg}
      chipText={chipText}
      onPress={onPress}
      isDark={isDark}
      T={T}
    />
  );
}
