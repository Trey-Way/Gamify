import { useState } from "react";
import { useUi, MONO } from "../theme.js";
import { Panel, Hint, SectionLabel } from "../ui.jsx";
import { CATS, KEYWORD_XP_TABLE } from "../../lib/grading.js";
import { BADGE_KEYWORDS, BADGE_LABELS } from "../../lib/badges.js";

export default function KeywordsSettings() {
    const { colors, catColor } = useUi();
    const [filter, setFilter] = useState("");
    const f = filter.toLowerCase();
    const pill = { fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: colors.panel2, border: `1px solid ${colors.border}`, color: colors.text, fontFamily: MONO };
    return (
        <Panel>
            <Hint>Every word the no-AI grading and badge systems watch for. Search to filter either list.</Hint>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter keywords..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 13, marginBottom: 16 }} />

            <SectionLabel>XP grading keywords ({KEYWORD_XP_TABLE.length})</SectionLabel>
            {Object.keys(CATS).map((cat) => {
                const rows = KEYWORD_XP_TABLE.filter((k) => k.category === cat && k.word.includes(f));
                if (rows.length === 0) return null;
                return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: catColor(cat), marginBottom: 4 }}>{CATS[cat].label}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {rows.map((k) => <span key={k.word} style={pill}>{k.word} <span style={{ color: colors.amber }}>+{k.exp}</span></span>)}
                        </div>
                    </div>
                );
            })}

            <SectionLabel style={{ marginTop: 18 }}>Badge tracking keywords</SectionLabel>
            {Object.keys(BADGE_LABELS).map((cat) => {
                const rows = BADGE_KEYWORDS[cat].filter((w) => w.includes(f));
                if (rows.length === 0) return null;
                return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>{BADGE_LABELS[cat]}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {rows.map((w) => <span key={w} style={pill}>{w}</span>)}
                        </div>
                    </div>
                );
            })}
        </Panel>
    );
}
