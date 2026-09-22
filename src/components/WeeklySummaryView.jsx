import { useMemo, useState } from "react";
import { useUi, MONO, SERIF } from "./theme.js";
import { Panel, SectionLabel, Chip, Hint } from "./ui.jsx";
import { addDays, currentStreak } from "../lib/outcomes.js";
import { weekStart, weeklySummary, mostFailed, CONSISTENCY_WEIGHTS } from "../lib/summary.js";

const FAIL_WINDOWS = [["week", "This week"], ["month", "Last 4 weeks"], ["all", "All time"]];

function StatTile({ label, value, sub, icon }) {
    const { colors } = useUi();
    return (
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{icon} {label}</div>
            <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: colors.text, lineHeight: 1.1 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: colors.textDim, marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

// Per-day succeeded/failed bars. Status colors carry state, always paired
// with a ✓/✗ icon and the count as text so color is never the only cue.
function DayStrip({ days }) {
    const { colors } = useUi();
    const max = Math.max(1, ...days.map((d) => Math.max(d.succeeded, d.failed)));
    const barH = (n) => (n === 0 ? 0 : Math.max(4, Math.round((n / max) * 56)));
    const bar = (n, color) => (
        <div style={{ width: 10, height: barH(n), background: color, borderRadius: "4px 4px 0 0" }} />
    );
    return (
        <div>
            <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: colors.textDim, marginBottom: 10 }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: colors.accent, marginRight: 5 }} />✓ Succeeded</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: colors.danger, marginRight: 5 }} />✗ Failed</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {days.map((d) => {
                    const date = new Date(d.start);
                    const title = `${date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${d.succeeded} succeeded, ${d.failed} failed, ${d.completions} completed`;
                    return (
                        <div key={d.start} title={title} style={{ textAlign: "center", padding: "4px 0", borderRadius: 8 }}>
                            <div style={{ height: 58, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, borderBottom: `1px solid ${colors.border}` }}>
                                {bar(d.succeeded, colors.accent)}
                                {bar(d.failed, colors.danger)}
                            </div>
                            <div style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>{date.toLocaleDateString(undefined, { weekday: "short" })}</div>
                            <div style={{ fontSize: 10, color: colors.textDim, fontFamily: MONO }}>✓{d.succeeded} ✗{d.failed}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function WeeklySummaryView({ tasks, now }) {
    const { colors } = useUi();
    const [offset, setOffset] = useState(0); // weeks back from the current one
    const [failWindow, setFailWindow] = useState("month");

    const start = addDays(weekStart(now), -7 * offset);
    const summary = useMemo(() => weeklySummary(tasks, start, now), [tasks, start, now]);
    const streak = currentStreak(tasks, now);
    const since = failWindow === "week" ? start : failWindow === "month" ? addDays(weekStart(now), -21) : 0;
    const failedList = useMemo(() => mostFailed(tasks, now, { since }), [tasks, now, since]);

    const rangeLabel = `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(addDays(start, 6)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const navBtn = { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", color: colors.text };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button className="ql-btn" aria-label="Previous week" style={navBtn} onClick={() => setOffset((o) => o + 1)}>‹</button>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{offset === 0 ? "This week" : offset === 1 ? "Last week" : `${offset} weeks ago`}</div>
                    <div style={{ fontSize: 11.5, color: colors.textDim }}>{rangeLabel}</div>
                </div>
                <button className="ql-btn" aria-label="Next week" style={{ ...navBtn, opacity: offset === 0 ? 0.4 : 1 }} disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>›</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
                <StatTile icon="✓" label="Succeeded" value={summary.succeeded} sub={summary.pending ? `${summary.pending} still in progress` : "done on time"} />
                <StatTile icon="✗" label="Failed" value={summary.failed} sub="missed or finished late" />
                <StatTile icon="◎" label="Consistency" value={summary.consistency === null ? "–" : `${summary.consistency}`} sub={summary.consistency === null ? "no data yet" : `/ 100 · active ${summary.activeDays} of ${summary.daysElapsed} days`} />
                <StatTile icon="★" label="XP earned" value={summary.xp} sub={offset === 0 ? `🔥 ${streak.count}-day streak${streak.doneToday ? "" : " (not yet today)"}` : null} />
            </div>

            <Panel style={{ marginBottom: 12 }}>
                <SectionLabel>Day by day</SectionLabel>
                <DayStrip days={summary.days} />
            </Panel>

            <Panel style={{ marginBottom: 12 }}>
                <SectionLabel>Most often failed</SectionLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {FAIL_WINDOWS.map(([id, label]) => (
                        <Chip key={id} selected={failWindow === id} onClick={() => setFailWindow(id)} style={{ padding: "5px 10px", fontSize: 11.5 }}>{label}</Chip>
                    ))}
                </div>
                {failedList.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No failed quests in this window. 🎉</div>}
                {failedList.map((g, i) => (
                    <div key={g.text + i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: i < failedList.length - 1 ? `1px solid ${colors.border}` : "none", fontSize: 13.5 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{g.text}</span>
                        <span style={{ fontFamily: MONO, fontSize: 12, color: colors.textDim, whiteSpace: "nowrap" }}>✗ {g.failed} of {g.total}</span>
                    </div>
                ))}
            </Panel>

            <Hint style={{ fontSize: 11.5 }}>
                A quest succeeds if it's completed by its due time, or by the end of the day it was added when it has no due
                date. Consistency is {CONSISTENCY_WEIGHTS.onTime * 100}% on-time rate + {CONSISTENCY_WEIGHTS.activeDays * 100}% share of days
                this week with at least one completed quest.
            </Hint>
        </div>
    );
}
