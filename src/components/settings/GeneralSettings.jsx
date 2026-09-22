import { useUi, MONO } from "../theme.js";
import { Panel, SectionLabel, Chip } from "../ui.jsx";
import { RANKS, xpToNext } from "../../lib/xp.js";

export default function GeneralSettings({ themeLabel, soundEnabled, onSetSound, rank }) {
    const { colors } = useUi();
    return (
        <Panel>
            <SectionLabel>Theme</SectionLabel>
            <div style={{ fontSize: 12.5, color: colors.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                Currently <strong style={{ color: colors.accent }}>{themeLabel}</strong>. Color profiles live in
                <strong> Customization</strong> in the menu — open the ☰ menu and pick from four looks.
            </div>
            <SectionLabel>Sound effects</SectionLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {[{ id: true, label: "On" }, { id: false, label: "Off" }].map((opt) => (
                    <Chip key={String(opt.id)} selected={soundEnabled === opt.id} onClick={() => onSetSound(opt.id)} style={{ flex: 1, padding: "8px 0", fontSize: 13 }}>
                        {opt.label}
                    </Chip>
                ))}
            </div>
            <SectionLabel style={{ marginBottom: 6 }}>XP curve</SectionLabel>
            <div style={{ fontSize: 12.5, color: colors.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                Level 1 needs {xpToNext(1)} XP. Level 100 needs {xpToNext(100)} XP — about {Math.round((xpToNext(100) / xpToNext(1) - 1) * 100)}% more than level 1.
            </div>
            <SectionLabel>Ranks</SectionLabel>
            <div>
                {RANKS.map((r, i) => {
                    const upper = RANKS[i + 1] ? RANKS[i + 1].min - 1 : null;
                    const isCurrent = r.name === rank.name;
                    return (
                        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < RANKS.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                            <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? colors.accent : colors.text }}>{isCurrent ? "→ " : ""}{r.name}</span>
                            <span style={{ fontSize: 11.5, color: colors.textDim, fontFamily: MONO }}>Lv {r.min}{upper ? `–${upper}` : "+"}</span>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}
