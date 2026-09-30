from pathlib import Path

path = Path(__file__).resolve().parents[1] / "components" / "game" / "BasketballScoringPanel.jsx"
text = path.read_text(encoding="utf-8")

if "useGameScoringTheme" not in text:
    text = text.replace(
        'import { sanitizeGameEvents } from "@/lib/gameModel";',
        'import { sanitizeGameEvents } from "@/lib/gameModel";\n'
        'import { useGameScoringTheme } from "@/constants/gameScoringTheme";',
    )

if "const UI = useGameScoringTheme()" not in text:
    text = text.replace(
        "}) {\n  const [pendingEvent, setPendingEvent] = useState(null);",
        "}) {\n  const UI = useGameScoringTheme();\n  const [pendingEvent, setPendingEvent] = useState(null);",
        1,
    )

repls = [
    ('backgroundColor: "rgba(255,255,255,0.03)"', "backgroundColor: UI.card"),
    ('backgroundColor: "rgba(255,255,255,0.04)"', "backgroundColor: UI.card"),
    ('backgroundColor: "rgba(255,255,255,0.05)"', "backgroundColor: UI.cardElevated"),
    ('backgroundColor: "rgba(255,255,255,0.1)"', "backgroundColor: UI.cardElevated"),
    ('borderColor: "rgba(255,255,255,0.08)"', "borderColor: UI.border"),
    ('borderColor: "rgba(255,255,255,0.06)"', "borderColor: UI.border"),
    ('borderColor: "rgba(255,255,255,0.1)"', "borderColor: UI.border"),
    ('borderLeftColor: "rgba(255,255,255,0.1)"', "borderLeftColor: UI.border"),
    (
        'backgroundColor: "rgba(0,0,0,0.4)"',
        'backgroundColor: UI.isDark ? "rgba(0,0,0,0.4)" : UI.cardElevated',
    ),
    (
        'backgroundColor: "rgba(0,0,0,0.3)"',
        'backgroundColor: UI.isDark ? "rgba(0,0,0,0.3)" : UI.cardElevated',
    ),
    ('backgroundColor: "rgba(17,24,39,0.45)"', "backgroundColor: UI.cardElevated"),
    ('color: "#D1D5DB"', "color: UI.text"),
    ('color: "#9CA3AF"', "color: UI.muted"),
    ('color: "#6B7280"', "color: UI.muted"),
    ('color: "#4B5563"', "color: UI.textMuted"),
]

total = 0
for old, new in repls:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        total += n
        print(f"{n:3d}  {old}")

# Theme white text that is NOT on solid colored badges/buttons.
# Keep "#fff" on badge labels and solid accent buttons; convert common body text cases.
body_white_patterns = [
    # Player names / section body text in cards
    ('style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}', 'style={{ fontSize: 11, fontWeight: "700", color: UI.text }}'),
    ('style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}', 'style={{ fontSize: 10, fontWeight: "800", color: UI.text }}'),
    ('style={{ fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"], color: "#fff" }}', 'style={{ fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"], color: UI.text }}'),
    ('color: "#fff", fontSize: 14, fontWeight: "800"', "color: UI.text, fontSize: 14, fontWeight: \"800\""),
    ('color: "#fff", fontSize: 9, fontWeight: "600"', "color: UI.text, fontSize: 9, fontWeight: \"600\""),
]
for old, new in body_white_patterns:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        total += n
        print(f"{n:3d}  body-white {old[:40]}")

path.write_text(text, encoding="utf-8")
print("total", total)
print("UI hook", "const UI = useGameScoringTheme()" in text)
