"""Bulk-theme BaseballScoringPanel dark-only surfaces → useGameScoringTheme tokens."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "components" / "game" / "BaseballScoringPanel.jsx"
text = path.read_text(encoding="utf-8")

if "useGameScoringTheme" not in text:
    text = text.replace(
        'import BaseballSubstitutionModal from "./BaseballSubstitutionModal";',
        'import BaseballSubstitutionModal from "./BaseballSubstitutionModal";\n'
        'import { useGameScoringTheme } from "@/constants/gameScoringTheme";',
    )

if "const UI = useGameScoringTheme()" not in text:
    text = text.replace(
        "}) {\n  const [pendingEvent, setPendingEvent] = useState(null);",
        "}) {\n  const UI = useGameScoringTheme();\n"
        "  const homeAccent = UI.isDark ? \"#4ade80\" : \"#15803D\";\n"
        "  const awayAccent = UI.isDark ? \"#f87171\" : \"#DC2626\";\n"
        "  const [pendingEvent, setPendingEvent] = useState(null);",
        1,
    )

repls = [
    ('backgroundColor: "rgba(255,255,255,0.03)"', "backgroundColor: UI.card"),
    ('backgroundColor: "rgba(255,255,255,0.04)"', "backgroundColor: UI.card"),
    ('backgroundColor: "rgba(255,255,255,0.05)"', "backgroundColor: UI.cardElevated"),
    ('backgroundColor: "rgba(255,255,255,0.06)"', "backgroundColor: UI.cardElevated"),
    ('backgroundColor: "rgba(255,255,255,0.1)"', "backgroundColor: UI.cardElevated"),
    ('borderColor: "rgba(255,255,255,0.06)"', "borderColor: UI.border"),
    ('borderColor: "rgba(255,255,255,0.08)"', "borderColor: UI.border"),
    ('borderColor: "rgba(255,255,255,0.1)"', "borderColor: UI.border"),
    ('borderColor: "rgba(255,255,255,0.25)"', "borderColor: UI.border"),
    (
        'backgroundColor: "rgba(0,0,0,0.3)"',
        'backgroundColor: UI.isDark ? "rgba(0,0,0,0.3)" : UI.cardElevated',
    ),
    (
        'backgroundColor: "rgba(0,0,0,0.4)"',
        'backgroundColor: UI.isDark ? "rgba(0,0,0,0.4)" : UI.cardElevated',
    ),
    ('color: "#9CA3AF"', "color: UI.muted"),
    ('color: "#9Ca3AF"', "color: UI.muted"),
    ('color: "#6B7280"', "color: UI.muted"),
    ('color: "#6b7280"', "color: UI.muted"),
    ('color: "#4B5563"', "color: UI.textMuted"),
    ('color: "#4b5563"', "color: UI.textMuted"),
    ('color: "#374151"', "color: UI.textMuted"),
    ('color: "#dfe1f9"', "color: UI.text"),
    ('color: "#d1d5db"', "color: UI.text"),
    ('color: "#D1D5DB"', "color: UI.text"),
    # empty diamond / inactive count indicators
    (': "rgba(255,255,255,0.15)"', ': (UI.isDark ? "rgba(255,255,255,0.15)" : UI.border)'),
    (': "rgba(255,255,255,0.05)"', ': (UI.isDark ? "rgba(255,255,255,0.05)" : UI.cardElevated)'),
    (': "rgba(255,255,255,0.1)"', ': (UI.isDark ? "rgba(255,255,255,0.1)" : UI.border)'),
]

total = 0
for old, new in repls:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        total += n
        print(f"{n:3d}  {old[:70]}")

# Body text that used white on dark cards — keep #fff / "white" on solid green/blue CTAs
body_white = [
    ('style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}', 'style={{ fontSize: 14, fontWeight: "700", color: UI.text }}'),
    ('style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}', 'style={{ fontSize: 13, fontWeight: "600", color: UI.text }}'),
    ('style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}', 'style={{ fontSize: 12, fontWeight: "600", color: UI.text }}'),
    ('style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}', 'style={{ fontSize: 11, fontWeight: "700", color: UI.text }}'),
    ('style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}', 'style={{ fontSize: 10, fontWeight: "800", color: UI.text }}'),
    ('style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}', 'style={{ fontSize: 16, fontWeight: "800", color: UI.text }}'),
    ('color: "#fff", fontSize: 14, fontWeight: "800"', 'color: UI.text, fontSize: 14, fontWeight: "800"'),
    ('color: "#fff", fontWeight: "700", marginTop: 12', 'color: UI.text, fontWeight: "700", marginTop: 12'),
    ('<Text style={{ fontSize: 9, color: "#fff" }}>Team</Text>', '<Text style={{ fontSize: 9, color: UI.text }}>Team</Text>'),
]

for old, new in body_white:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        total += n
        print(f"{n:3d}  body {old[:55]}")

# Accent readability in light mode for common neon greens/reds used as text
accent_repls = [
    ('color: "#4ade80"', "color: homeAccent"),
    ('color: "#f87171"', "color: awayAccent"),
    ('color: "#86efac"', 'color: UI.isDark ? "#86efac" : "#BBF7D0"'),
    ('color: "#facc15"', 'color: UI.isDark ? "#facc15" : "#B45309"'),
    ('color: "#60a5fa"', 'color: UI.isDark ? "#60a5fa" : "#2563EB"'),
]

for old, new in accent_repls:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        total += n
        print(f"{n:3d}  accent {old}")

path.write_text(text, encoding="utf-8")
print("total", total)
print("UI hook", "const UI = useGameScoringTheme()" in text)
