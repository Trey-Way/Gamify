import { useState } from "react";
import { useUi, MONO } from "./theme.js";
import { CATS } from "../lib/grading.js";
import { TIMER_BONUS_CAP, timerBonusFor } from "../lib/xp.js";
import { fmtClock, fmtDateTime } from "../lib/dates.js";

export default function QuestsView({ tasks, activeTimer, now, onAdd, onComplete, onStopTimer, onCancelTimer, onRemove }) {
    const { colors, dark, catColor } = useUi();
    const [input, setInput] = useState("");
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    function submit(startTimer) {
        const text = input.trim();
        if (!text) return;
        setInput("");
        setAddMenuOpen(false);
        onAdd(text, { startTimer });
    }

    return (
        <>
            <div style={{ display: "flex", gap: 8, marginBottom: 22, position: "relative" }}>
                <input
                    value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(false)}
                    placeholder="What needs doing? e.g. 'Finish history essay draft'"
                    style={{ flex: 1, minWidth: 0, padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 14, outline: "none" }}
                />
                <div style={{ display: "flex" }}>
                    <button className="ql-btn" onClick={() => submit(false)}
                        style={{ padding: "0 18px", borderRadius: "10px 0 0 10px", border: "none", background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 14 }}>Add</button>
                    <button className="ql-btn" onClick={() => setAddMenuOpen((o) => !o)} aria-label="Add options"
                        style={{ padding: "0 10px", borderRadius: "0 10px 10px 0", border: "none", borderLeft: `1px solid ${dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)"}`, background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 11 }}>▾</button>
                </div>
                {addMenuOpen && (
                    <div onMouseLeave={() => setAddMenuOpen(false)}
                        style={{ position: "absolute", top: 46, right: 0, zIndex: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", minWidth: 210, overflow: "hidden" }}>
                        <button className="ql-btn" onClick={() => submit(false)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", color: colors.text, fontSize: 13 }}>
                            Add normally
                        </button>
                        <button className="ql-btn" disabled={!!activeTimer} onClick={() => submit(true)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderTop: `1px solid ${colors.border}`, color: activeTimer ? colors.textDim : colors.text, fontSize: 13, opacity: activeTimer ? 0.5 : 1 }}>
                            ⏱ Add &amp; start focus stopwatch
                            <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>+1 xp per 5 focused min, capped at +{TIMER_BONUS_CAP}</div>
                        </button>
                    </div>
                )}
            </div>

            {tasks.length === 0 && <div style={{ color: colors.textDim, fontSize: 13.5, padding: "10px 2px" }}>No open quests. Add one above to start earning xp.</div>}
            {tasks.map((t) => {
                const isTiming = activeTimer && activeTimer.taskId === t.id;
                const elapsed = isTiming ? Math.max(0, Math.floor((now - activeTimer.startedAt) / 1000)) : 0;
                const projectedBonus = isTiming ? timerBonusFor(elapsed) : 0;
                return (
                    <div key={t.id} className="ql-task" style={{ display: "flex", alignItems: "center", gap: 12, background: colors.panel, border: `1px solid ${isTiming ? colors.accent : colors.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                        {isTiming ? (
                            <button className="ql-btn" onClick={() => onStopTimer(t.id)} disabled={t.pending} aria-label="Stop timer and complete"
                                style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${colors.accent}`, background: t.pending ? "transparent" : colors.accent, flexShrink: 0, opacity: t.pending ? 0.4 : 1 }} />
                        ) : (
                            <button className="ql-btn" onClick={() => onComplete(t.id)} disabled={t.pending} aria-label="Complete task"
                                style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${t.pending ? colors.border : colors.accent}`, background: "transparent", flexShrink: 0, opacity: t.pending ? 0.4 : 1 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, marginBottom: 2, overflowWrap: "anywhere" }}>{t.text}</div>
                            <div style={{ fontSize: 11.5, color: t.pending ? colors.textDim : catColor(t.category) }}>
                                {t.pending ? "Grading…" : `${CATS[t.category]?.label || "Task"} · ${t.reason}`}
                            </div>
                            {isTiming ? (
                                <div style={{ fontSize: 11, color: colors.accent, marginTop: 3, fontFamily: MONO }}>
                                    ⏱ {fmtClock(elapsed)} running · +{projectedBonus} bonus so far
                                </div>
                            ) : (
                                <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>Added {fmtDateTime(t.createdAt)}</div>
                            )}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: t.pending ? colors.textDim : colors.amber, minWidth: 44, textAlign: "right" }}>
                            {t.pending ? "…" : `+${t.exp}${isTiming ? `+${projectedBonus}` : ""}`}
                        </div>
                        {isTiming ? (
                            <button className="ql-btn" onClick={onCancelTimer} aria-label="Cancel timer" style={{ background: "transparent", color: colors.textDim, fontSize: 10.5, padding: "0 2px", whiteSpace: "nowrap" }}>cancel timer</button>
                        ) : (
                            <button className="ql-btn" onClick={() => onRemove(t.id)} aria-label="Remove task" style={{ background: "transparent", color: colors.textDim, fontSize: 16, padding: "0 2px" }}>×</button>
                        )}
                    </div>
                );
            })}
        </>
    );
}
