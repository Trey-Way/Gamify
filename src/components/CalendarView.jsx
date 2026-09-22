import { useMemo, useState } from "react";
import { useUi, MONO } from "./theme.js";
import { dayKey } from "../lib/dates.js";

function fmtExact(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function monthOf(ts) {
    const d = new Date(ts);
    return { y: d.getFullYear(), m: d.getMonth() };
}

// Month grid showing quests (added / due / completed) and notes per day.
// Notes are always stamped with the exact moment they're saved, so they
// land on today regardless of which day is selected.
export default function CalendarView({ tasks, notes, now, onAddNote, onDeleteNote }) {
    const { colors, dark } = useUi();
    const [calMonth, setCalMonth] = useState(() => monthOf(Date.now()));
    const [calSelected, setCalSelected] = useState(() => dayKey(Date.now()));
    const [draft, setDraft] = useState("");

    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();
    const todayKey = dayKey(now);

    const tasksByDay = useMemo(() => {
        const map = {};
        const push = (ts, task, kind) => {
            const k = dayKey(ts);
            (map[k] = map[k] || []).push({ task, kind, ts });
        };
        tasks.forEach((t) => {
            push(t.createdAt, t, "added");
            if (t.dueAt) push(t.dueAt, t, "due");
            if (t.done && t.completedAt) push(t.completedAt, t, "completed");
        });
        Object.values(map).forEach((list) => list.sort((a, b) => a.ts - b.ts));
        return map;
    }, [tasks]);

    const notesByDay = useMemo(() => {
        const map = {};
        notes.forEach((n) => { const k = dayKey(n.createdAt); (map[k] = map[k] || []).push(n); });
        Object.values(map).forEach((list) => list.sort((a, b) => a.createdAt - b.createdAt));
        return map;
    }, [notes]);

    function saveNote() {
        const text = draft.trim();
        if (!text) return;
        const createdAt = Date.now();
        onAddNote(text, createdAt);
        setDraft("");
        setCalMonth(monthOf(createdAt));
        setCalSelected(dayKey(createdAt));
    }

    const navBtn = { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", color: colors.text };
    const dayTasks = tasksByDay[calSelected] || [];
    const dayNotes = notesByDay[calSelected] || [];
    const kindColor = { added: colors.textDim, due: colors.amber, completed: colors.accent };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button className="ql-btn" aria-label="Previous month" style={navBtn}
                    onClick={() => setCalMonth((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })}>‹</button>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{new Date(calMonth.y, calMonth.m).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                <button className="ql-btn" aria-label="Next month" style={navBtn}
                    onClick={() => setCalMonth((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: colors.textDim }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const k = `${calMonth.y}-${calMonth.m}-${day}`;
                    const hasTasks = !!tasksByDay[k];
                    const hasNotes = !!notesByDay[k];
                    const selected = calSelected === k;
                    return (
                        <button key={day} className="ql-btn" onClick={() => setCalSelected(k)} aria-label={`Day ${day}${hasTasks ? ", has quests" : ""}${hasNotes ? ", has notes" : ""}`}
                            style={{ aspectRatio: "1", borderRadius: 8, border: `1px solid ${selected ? colors.accent : colors.border}`, background: hasTasks || hasNotes ? colors.panel2 : colors.panel, color: colors.text, fontSize: 12.5, fontWeight: k === todayKey ? 700 : 400, position: "relative" }}>
                            {day}
                            <span style={{ position: "absolute", bottom: 4, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3 }}>
                                {hasTasks && <span style={{ width: 4, height: 4, borderRadius: "50%", background: colors.accent }} />}
                                {hasNotes && <span style={{ width: 4, height: 4, borderRadius: 1, background: colors.amber }} />}
                            </span>
                        </button>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: colors.textDim, margin: "8px 2px 0" }}>
                <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: colors.accent, marginRight: 5 }} />Quests</span>
                <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 1, background: colors.amber, marginRight: 5 }} />Notes</span>
            </div>

            <div style={{ marginTop: 16, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12 }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a note… it's saved with the exact time you save it."
                    style={{ width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 13.5, marginBottom: 8 }} />
                <button className="ql-btn" onClick={saveNote} disabled={!draft.trim()}
                    style={{ padding: "8px 14px", borderRadius: 8, background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 13, opacity: draft.trim() ? 1 : 0.5 }}>Save note</button>
            </div>

            {calSelected && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {(() => { const [y, m, d] = calSelected.split("-").map(Number); return new Date(y, m, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); })()}
                    </div>
                    {dayNotes.map((n) => (
                        <div key={n.id} style={{ padding: "8px 10px", background: colors.panel, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.amber}`, borderRadius: 8, marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <time dateTime={new Date(n.createdAt).toISOString()} style={{ fontSize: 11, color: colors.textDim, fontFamily: MONO }}>📝 {fmtExact(n.createdAt)}</time>
                                <button className="ql-btn" aria-label="Delete note" onClick={() => window.confirm("Delete this note?") && onDeleteNote(n.id)}
                                    style={{ background: "transparent", color: colors.textDim, fontSize: 15, padding: "0 2px" }}>×</button>
                            </div>
                            <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 2 }}>{n.text}</div>
                        </div>
                    ))}
                    {dayTasks.map(({ task, kind, ts }) => (
                        <div key={task.id + kind} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                            <span style={{ overflowWrap: "anywhere" }}>{task.text}</span>
                            <span style={{ fontSize: 11, color: kindColor[kind], whiteSpace: "nowrap" }}>
                                {kind} {new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </span>
                        </div>
                    ))}
                    {!dayTasks.length && !dayNotes.length && <div style={{ color: colors.textDim, fontSize: 13 }}>Nothing on this day.</div>}
                </div>
            )}
        </div>
    );
}
