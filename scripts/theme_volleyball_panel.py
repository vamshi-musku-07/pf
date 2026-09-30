#!/usr/bin/env python3
"""Theme VolleyballScoringPanel.jsx for light+dark via useGameScoringTheme."""
from pathlib import Path

PATH = Path(r"C:\pff\play_flash_application\app\components\game\VolleyballScoringPanel.jsx")
text = PATH.read_text(encoding="utf-8")

if "useGameScoringTheme" not in text:
    text = text.replace(
        'import { VolleyballSubstitutionModal, VolleyballLiberoModal } from "./volleyball/VolleyballSubstitution";\n',
        'import { VolleyballSubstitutionModal, VolleyballLiberoModal } from "./volleyball/VolleyballSubstitution";\n'
        'import { useGameScoringTheme } from "@/constants/gameScoringTheme";\n',
    )

needle = "  onEndGame,\n}) {\n  const sportData = currentGame?.sport || {};"
if "useGameScoringTheme()" not in text:
    text = text.replace(
        needle,
        "  onEndGame,\n}) {\n"
        "  const UI = useGameScoringTheme();\n"
        "  const homeAccent = UI.isDark ? \"#4ade80\" : \"#15803D\";\n"
        "  const awayAccent = UI.isDark ? \"#f87171\" : \"#DC2626\";\n"
        "  const warnAccent = UI.isDark ? \"#facc15\" : \"#B45309\";\n"
        "  const softCard = UI.isDark ? \"rgba(255,255,255,0.03)\" : UI.cardElevated;\n"
        "  const softBorder = UI.isDark ? \"rgba(255,255,255,0.06)\" : UI.border;\n"
        "  const actionBg = UI.isDark ? \"#1f2937\" : UI.cardElevated;\n"
        "  const actionBorder = UI.isDark ? \"rgba(255,255,255,0.1)\" : UI.border;\n"
        "  const actionText = UI.isDark ? \"#D1D5DB\" : UI.text;\n"
        "  const modalSheet = UI.isDark ? \"#1a1d2e\" : UI.card;\n"
        "  const sportData = currentGame?.sport || {};",
    )

text = text.replace(
    '''        <View style={{ backgroundColor: "rgba(234,179,8,0.08)", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "rgba(234,179,8,0.2)", alignItems: "center" }}>
          <Ionicons name="people-outline" size={36} color="#facc15" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 4 }}>
            Set Up Starting Lineups
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", marginBottom: 16 }}>
            Choose 6 starters, assign positions, pick first server, and optionally set a libero for each team.
          </Text>''',
    '''        <View style={{ backgroundColor: UI.warningBg, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: UI.warningBorder, alignItems: "center" }}>
          <Ionicons name="people-outline" size={36} color={warnAccent} />
          <Text style={{ color: UI.text, fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 4 }}>
            Set Up Starting Lineups
          </Text>
          <Text style={{ color: UI.muted, fontSize: 12, textAlign: "center", marginBottom: 16 }}>
            Choose 6 starters, assign positions, pick first server, and optionally set a libero for each team.
          </Text>''',
)

text = text.replace(
    '            <Text style={{ color: "#6B7280", fontSize: 11 }}>Skip → score without lineup</Text>',
    '            <Text style={{ color: UI.muted, fontSize: 11 }}>Skip → score without lineup</Text>',
)

text = text.replace(
    '            color: isMatchPoint ? "#f87171" : isSetPoint ? "#facc15" : "#c084fc",',
    '            color: isMatchPoint ? awayAccent : isSetPoint ? warnAccent : (UI.isDark ? "#c084fc" : "#7E22CE"),',
)

replacements = [
    ('backgroundColor: "rgba(255,255,255,0.03)"', "backgroundColor: softCard"),
    ('backgroundColor: "rgba(255,255,255,0.02)"', "backgroundColor: softCard"),
    ('borderColor: "rgba(255,255,255,0.06)"', "borderColor: softBorder"),
    ('borderColor: "rgba(255,255,255,0.1)"', "borderColor: actionBorder"),
    ('color: "#9CA3AF"', "color: UI.muted"),
    ('color: "#6B7280"', "color: UI.muted"),
    ('color: "#4B5563"', "color: UI.textMuted"),
    ('color: "#D1D5DB"', "color: actionText"),
    ('color: "#4ade80"', "color: homeAccent"),
    ('color: "#f87171"', "color: awayAccent"),
    ('color: "#facc15"', "color: warnAccent"),
    ('color: "#86efac"', "color: homeAccent"),
    ('color: "#fca5a5"', "color: awayAccent"),
    ('backgroundColor: "#1f2937"', "backgroundColor: actionBg"),
    ('backgroundColor: "#1a1d2e"', "backgroundColor: modalSheet"),
    ('color: "#fff"', "color: UI.text"),
    ('color: "#c084fc"', 'color: UI.isDark ? "#c084fc" : "#7E22CE"'),
    ('teamColor="#4ade80"', "teamColor={homeAccent}"),
    ('teamColor="#f87171"', "teamColor={awayAccent}"),
]

for old, new in replacements:
    text = text.replace(old, new)

# Restore white text on colored chips / badges / CTAs
text = text.replace(
    '      <Text style={{ color: UI.text, fontSize: small ? 10 : 11, fontWeight: "700", textAlign: "center" }}>\n        {label}\n      </Text>',
    '      <Text style={{ color: "#fff", fontSize: small ? 10 : 11, fontWeight: "700", textAlign: "center" }}>\n        {label}\n      </Text>',
)
text = text.replace(
    '<Text style={{ color: UI.text, fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>',
    '<Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}>{badge.label}</Text>',
)
text = text.replace(
    'color: userServing ? UI.text : homeAccent',
    'color: userServing ? "#fff" : homeAccent',
)
text = text.replace(
    'color: !userServing && servingTeam ? UI.text : awayAccent',
    'color: !userServing && servingTeam ? "#fff" : awayAccent',
)
text = text.replace(
    '<Text style={{ color: UI.text, fontSize: 14, fontWeight: "800" }}>SET UP OPPONENT LINEUP</Text>',
    '<Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>SET UP OPPONENT LINEUP</Text>',
)

text = text.replace(
    'backgroundColor: "rgba(234,179,8,0.08)"',
    "backgroundColor: UI.warningBg",
)
text = text.replace(
    'borderColor: "rgba(234,179,8,0.2)"',
    "borderColor: UI.warningBorder",
)
text = text.replace(
    'color: "rgba(74,222,128,0.8)"',
    "color: homeAccent",
)
text = text.replace('color="#D1D5DB"', "color={actionText}")
text = text.replace('color="#f87171"', "color={awayAccent}")

PATH.write_text(text, encoding="utf-8")
print("Updated", PATH)
print("hook", "useGameScoringTheme()" in text)
print("UI.text", text.count("UI.text"))
print("softCard", text.count("softCard"))
