import { useUi } from "./theme.js";
import { Hint } from "./ui.jsx";
import { BADGE_LABELS } from "../lib/badges.js";

export default function BadgesView({ badges }) {
    const { colors } = useUi();
    const earnedCount = badges.filter((b) => b.earned).length;
    return (
        <div>
            <Hint style={{ marginBottom: 16 }}>
                Earned by staying consistent - {earnedCount} of {badges.length} unlocked. Badges track
                completed tasks by keyword, separate from XP category, across six goal areas.
            </Hint>
            {Object.keys(BADGE_LABELS).map((category) => (
                <div key={category} style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {BADGE_LABELS[category]}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                        {badges.filter((b) => b.category === category).map((b) => (
                            <div key={b.id} title={b.description}
                                style={{ background: b.earned ? colors.panel2 : colors.panel, border: `1px solid ${b.earned ? colors.accent : colors.border}`, borderRadius: 10, padding: "12px 12px", opacity: b.earned ? 1 : 0.7 }}>
                                <div style={{ fontSize: 20, marginBottom: 4 }}>{b.earned ? "🏅" : "🔒"}</div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: b.earned ? colors.accent : colors.text, marginBottom: 3 }}>{b.label}</div>
                                <div style={{ fontSize: 10.5, color: colors.textDim, marginBottom: 6, lineHeight: 1.4 }}>{b.description}</div>
                                {!b.earned && (
                                    <div style={{ height: 5, borderRadius: 3, background: colors.border, overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${Math.round((b.progress / b.target) * 100)}%`, background: colors.accentDim, borderRadius: 3 }} />
                                    </div>
                                )}
                                {!b.earned && <div style={{ fontSize: 10, color: colors.textDim, marginTop: 3 }}>{b.progress}/{b.target}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
