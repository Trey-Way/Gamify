import { useState } from "react";
import { useUi, MONO } from "../theme.js";
import { Panel, Hint, Chip } from "../ui.jsx";
import { CATS } from "../../lib/grading.js";
import { fmtDateTime } from "../../lib/dates.js";

// Shows how the AI (or the local rules) categorized every quest, and lets
// open quests be re-graded after switching providers.
export default function GuidedHandSettings({ tasks, onRegrade }) {
    const { colors, catColor } = useUi();
    const [filter, setFilter] = useState("all");
    const graded = tasks.filter((t) => !t.pending);
    const shown = filter === "all" ? graded : graded.filter((t) => t.category === filter);
    const counts = Object.fromEntries(Object.keys(CATS).map((c) => [c, graded.filter((t) => t.category === c).length]));

    return (
        <Panel>
            <Hint>
                Every task the AI has judged so far: which category it chose, the XP it gave, why, and which
                engine made the call. Chores earn the least; work and school earn the most.
            </Hint>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6, marginBottom: 14 }}>
                {Object.entries(CATS).map(([id, c]) => (
                    <div key={id} style={{ fontSize: 11.5, padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.border}` }}>
                        <span style={{ color: catColor(id), fontWeight: 600 }}>{c.label}</span>
                        <span style={{ color: colors.textDim, fontFamily: MONO }}> {c.range[0]}–{c.range[1]} xp</span>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <Chip selected={filter === "all"} onClick={() => setFilter("all")} style={{ padding: "5px 10px", fontSize: 11.5 }}>All ({graded.length})</Chip>
                {Object.entries(CATS).map(([id, c]) => (
                    <Chip key={id} selected={filter === id} onClick={() => setFilter(id)} style={{ padding: "5px 10px", fontSize: 11.5 }}>{c.label} ({counts[id]})</Chip>
                ))}
            </div>
            {shown.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No tasks graded yet.</div>}
            <div className="ql-scroll" style={{ maxHeight: 380, overflowY: "auto" }}>
                {shown.map((t) => (
                    <div key={t.id} style={{ padding: "9px 0", borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                            <span style={{ overflowWrap: "anywhere" }}>{t.text}</span>
                            <span style={{ fontFamily: MONO, color: colors.amber, whiteSpace: "nowrap" }}>+{t.exp}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: catColor(t.category), marginTop: 2 }}>
                            {CATS[t.category]?.label} · {t.reason}{t.timeBonus > 0 && ` · +${t.timeBonus} timed bonus`}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                            <span style={{ fontSize: 10.5, color: colors.textDim }}>
                                {t.gradedBy || "Graded before provider tracking"}{t.gradedAt ? ` · ${fmtDateTime(t.gradedAt)}` : ""}
                            </span>
                            {!t.done && (
                                <button className="ql-btn" onClick={() => onRegrade(t.id)}
                                    style={{ background: "transparent", color: colors.accent, fontSize: 11, padding: 0 }}>Re-grade</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}
