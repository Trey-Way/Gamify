import { useUi, SERIF } from "./theme.js";
import { Hint } from "./ui.jsx";
import { THEMES } from "../lib/themes.js";

export default function CustomizationView({ theme, onSetTheme }) {
    const { colors } = useUi();
    return (
        <div>
            <Hint style={{ marginBottom: 16 }}>Pick a color profile for the whole app.</Hint>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {Object.entries(THEMES).map(([key, t]) => {
                    const selected = theme === key;
                    return (
                        <button key={key} className="ql-btn" onClick={() => onSetTheme(key)}
                            style={{ textAlign: "left", padding: 14, borderRadius: 12, border: `2px solid ${selected ? t.colors.accent : colors.border}`, background: t.colors.bg }}>
                            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.accent, display: "inline-block" }} />
                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.amber, display: "inline-block" }} />
                                <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.panel2, border: `1px solid ${t.colors.border}`, display: "inline-block" }} />
                            </div>
                            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: t.colors.text, marginBottom: 3 }}>{t.label}</div>
                            <div style={{ fontSize: 11, color: t.colors.textDim }}>{selected ? "Active" : t.isDark ? "Dark" : "Light"}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
