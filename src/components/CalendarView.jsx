import { useMemo, useState } from "react";
import { useUi } from "./theme.js";
import { dayKey } from "../lib/dates.js";

export default function CalendarView({ tasks }) {
    const { colors } = useUi();
    const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
    const [calSelected, setCalSelected] = useState(null);

    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();
    const tasksByDay = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            const k = dayKey(t.createdAt);
            map[k] = map[k] || [];
            map[k].push(t);
            if (t.done && t.completedAt && dayKey(t.completedAt) !== k) {
                const k2 = dayKey(t.completedAt);
                map[k2] = map[k2] || [];
                map[k2].push(t);
            }
        });
        return map;
    }, [tasks]);

    const navBtn = { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", color: colors.text };

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
                    const has = tasksByDay[k];
                    const selected = calSelected === k;
                    return (
                        <button key={day} className="ql-btn" onClick={() => setCalSelected(selected ? null : k)}
                            style={{ aspectRatio: "1", borderRadius: 8, border: `1px solid ${selected ? colors.accent : colors.border}`, background: has ? colors.panel2 : colors.panel, color: colors.text, fontSize: 12.5, position: "relative" }}>
                            {day}
                            {has && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: colors.accent }} />}
                        </button>
                    );
                })}
            </div>
            {calSelected && (
                <div style={{ marginTop: 16 }}>
                    {(tasksByDay[calSelected] || []).map((t) => (
                        <div key={t.id + (t.done ? "-c" : "")} style={{ padding: "8px 10px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                            {t.text} {t.done ? <span style={{ color: colors.textDim }}>(completed)</span> : <span style={{ color: colors.textDim }}>(open)</span>}
                        </div>
                    ))}
                    {!(tasksByDay[calSelected] || []).length && <div style={{ color: colors.textDim, fontSize: 13 }}>Nothing on this day.</div>}
                </div>
            )}
        </div>
    );
}
