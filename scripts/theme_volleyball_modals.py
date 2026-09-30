#!/usr/bin/env python3
"""Theme volleyball lineup + substitution modals."""
from pathlib import Path

FILES = [
    Path(r"C:\pff\play_flash_application\app\components\game\volleyball\VolleyballLineupSetup.jsx"),
    Path(r"C:\pff\play_flash_application\app\components\game\volleyball\VolleyballSubstitution.jsx"),
]

IMPORT = 'import { useGameScoringTheme } from "@/constants/gameScoringTheme";\n'

for path in FILES:
    text = path.read_text(encoding="utf-8")
    if "useGameScoringTheme" not in text:
        # after last import from react-native / ionicons
        if 'from "@expo/vector-icons";\n' in text:
            text = text.replace(
                'from "@expo/vector-icons";\n',
                'from "@expo/vector-icons";\n' + IMPORT,
            )
        else:
            text = text.replace(
                '} from "react-native";\n',
                '} from "react-native";\n' + IMPORT,
                1,
            )

    # Inject UI near start of main exported functions
    for sig in [
        "function VolleyballLineupSetup({\n  players = [],\n  existingLineup = [],\n  teamName = \"Team\",\n  side = \"home\",\n  onConfirm,\n  onCancel,\n  visible = false,\n}) {\n",
        "function VolleyballSubstitutionModal({\n",
        "function VolleyballLiberoModal({\n",
    ]:
        if sig in text and "useGameScoringTheme()" not in text[text.find(sig):text.find(sig)+400]:
            # Find the opening brace block and insert after {
            idx = text.find(sig)
            if idx >= 0:
                insert_at = idx + len(sig)
                hook = (
                    "  const UI = useGameScoringTheme();\n"
                    "  const homeAccent = UI.isDark ? \"#4ade80\" : \"#15803D\";\n"
                    "  const awayAccent = UI.isDark ? \"#f87171\" : \"#DC2626\";\n"
                    "  const warnAccent = UI.isDark ? \"#facc15\" : \"#B45309\";\n"
                    "  const softCard = UI.isDark ? \"rgba(255,255,255,0.05)\" : UI.cardElevated;\n"
                    "  const softBorder = UI.isDark ? \"rgba(255,255,255,0.1)\" : UI.border;\n"
                    "  const sheetBg = UI.isDark ? \"#1a1d2e\" : UI.card;\n"
                    "  const overlayBg = UI.isDark ? \"rgba(0,0,0,0.95)\" : \"rgba(15,23,42,0.45)\";\n"
                )
                # For Substitution, functions may have different param lists - handle generically below
                pass

    # Generic: after each function Volleyball*({ ... }) { that doesn't yet have UI nearby
    import re
    def inject_hook(match):
        block = match.group(0)
        if "useGameScoringTheme()" in block:
            return block
        return block + (
            "\n  const UI = useGameScoringTheme();\n"
            "  const homeAccent = UI.isDark ? \"#4ade80\" : \"#15803D\";\n"
            "  const awayAccent = UI.isDark ? \"#f87171\" : \"#DC2626\";\n"
            "  const warnAccent = UI.isDark ? \"#facc15\" : \"#B45309\";\n"
            "  const softCard = UI.isDark ? \"rgba(255,255,255,0.05)\" : UI.cardElevated;\n"
            "  const softBorder = UI.isDark ? \"rgba(255,255,255,0.1)\" : UI.border;\n"
            "  const sheetBg = UI.isDark ? \"#1a1d2e\" : UI.card;\n"
            "  const overlayBg = UI.isDark ? \"rgba(0,0,0,0.92)\" : \"rgba(15,23,42,0.45)\";\n"
        )

    text2 = re.sub(
        r"function Volleyball(?:LineupSetup|SubstitutionModal|LiberoModal)\([^)]*\) \{",
        inject_hook,
        text,
        flags=re.S,
    )
    # The above with [^)]* fails for multiline params. Use a simpler multiline approach.
    text2 = text
    for name in ("VolleyballLineupSetup", "VolleyballSubstitutionModal", "VolleyballLiberoModal"):
        m = re.search(rf"function {name}\(", text2)
        if not m:
            continue
        brace = text2.find("{", m.start())
        # only inject if not already present in next 300 chars
        window = text2[brace:brace+350]
        if "useGameScoringTheme()" in window:
            continue
        insert = (
            "\n  const UI = useGameScoringTheme();\n"
            "  const homeAccent = UI.isDark ? \"#4ade80\" : \"#15803D\";\n"
            "  const awayAccent = UI.isDark ? \"#f87171\" : \"#DC2626\";\n"
            "  const warnAccent = UI.isDark ? \"#facc15\" : \"#B45309\";\n"
            "  const softCard = UI.isDark ? \"rgba(255,255,255,0.05)\" : UI.cardElevated;\n"
            "  const softBorder = UI.isDark ? \"rgba(255,255,255,0.1)\" : UI.border;\n"
            "  const sheetBg = UI.isDark ? \"#1a1d2e\" : UI.card;\n"
            "  const overlayBg = UI.isDark ? \"rgba(0,0,0,0.95)\" : \"rgba(15,23,42,0.45)\";\n"
        )
        text2 = text2[: brace + 1] + insert + text2[brace + 1 :]

    text = text2

    reps = [
        ('backgroundColor: "rgba(0,0,0,0.95)"', "backgroundColor: overlayBg"),
        ('backgroundColor: "rgba(0,0,0,0.92)"', "backgroundColor: overlayBg"),
        ('backgroundColor: "#1a1d2e"', "backgroundColor: sheetBg"),
        ('borderBottomColor: "rgba(255,255,255,0.08)"', "borderBottomColor: softBorder"),
        ('borderTopColor: "rgba(255,255,255,0.1)"', "borderTopColor: softBorder"),
        ('borderBottomColor: "rgba(255,255,255,0.05)"', "borderBottomColor: softBorder"),
        ('backgroundColor: "rgba(255,255,255,0.05)"', "backgroundColor: softCard"),
        ('backgroundColor: "rgba(255,255,255,0.1)"', "backgroundColor: softCard"),
        ('backgroundColor: "rgba(255,255,255,0.08)"', "backgroundColor: softCard"),
        ('borderColor: "rgba(255,255,255,0.1)"', "borderColor: softBorder"),
        ('color: "#fff"', "color: UI.text"),
        ('color: "#9CA3AF"', "color: UI.muted"),
        ('color: "#D1D5DB"', "color: UI.isDark ? \"#D1D5DB\" : UI.text"),
        ('color: "#4ade80"', "color: homeAccent"),
        ('color: "#f87171"', "color: awayAccent"),
        ('color: "#facc15"', "color: warnAccent"),
        ('borderColor: "#facc15"', "borderColor: warnAccent"),
        ('borderColor: "#4ade80"', "borderColor: homeAccent"),
        ('borderColor: "#f87171"', "borderColor: awayAccent"),
        ('color="#9CA3AF"', "color={UI.muted}"),
    ]
    for a, b in reps:
        text = text.replace(a, b)

    # Restore white on solid purple L badge / selected states that need white on colored bg
    text = text.replace(
        '<Text style={{ color: UI.text, fontSize: 11, fontWeight: "800" }}>L</Text>',
        '<Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>L</Text>',
    )
    text = text.replace(
        '<Text style={{ color: UI.text, fontSize: 12, fontWeight: "800" }}>L</Text>',
        '<Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>L</Text>',
    )

    path.write_text(text, encoding="utf-8")
    print("updated", path.name, "hooks", text.count("useGameScoringTheme()"))
