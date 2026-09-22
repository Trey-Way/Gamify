import { addDays, startOfDay, deadlineOf, taskOutcome } from "./outcomes.js";

/* ---------- Weekly summary ---------- */
// Weeks run Monday 00:00 → next Monday 00:00, local time.
export function weekStart(ts) {
    const d = new Date(startOfDay(ts));
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    return addDays(d.getTime(), -dow);
}

// Consistency blends two things, so neither "added nothing, failed nothing"
// nor "one big day" scores well:
//   60% on-time rate  = succeeded / (succeeded + failed)
//   40% active days   = days with ≥1 completion / days elapsed this week
export const CONSISTENCY_WEIGHTS = { onTime: 0.6, activeDays: 0.4 };

export function weeklySummary(tasks, start, now) {
    const end = addDays(start, 7);
    const days = Array.from({ length: 7 }, (_, i) => ({ start: addDays(start, i), succeeded: 0, failed: 0, completions: 0 }));
    const dayIndex = (ts) => days.findIndex((d, i) => ts >= d.start && ts < (days[i + 1]?.start ?? end));

    let succeeded = 0, failed = 0, pending = 0, xp = 0;
    for (const t of tasks) {
        if (t.pending) continue;
        const deadline = deadlineOf(t);
        if (deadline >= start && deadline < end) {
            const outcome = taskOutcome(t, now);
            const i = dayIndex(deadline);
            if (outcome === "succeeded") { succeeded++; days[i].succeeded++; }
            else if (outcome === "failed") { failed++; days[i].failed++; }
            else pending++;
        }
        if (t.done && t.completedAt >= start && t.completedAt < end) {
            xp += t.exp || 0;
            days[dayIndex(t.completedAt)].completions++;
        }
    }

    const daysElapsed = now < start ? 0 : Math.min(7, Math.floor((Math.min(now, end - 1) - start) / (24 * 3600 * 1000)) + 1);
    const activeDays = days.filter((d) => d.completions > 0).length;
    const resolved = succeeded + failed;
    let consistency = null;
    if (daysElapsed > 0 && (resolved > 0 || activeDays > 0)) {
        const onTime = resolved > 0 ? succeeded / resolved : 0;
        const active = activeDays / daysElapsed;
        consistency = Math.round(100 * (CONSISTENCY_WEIGHTS.onTime * onTime + CONSISTENCY_WEIGHTS.activeDays * active));
    }
    return { start, end, succeeded, failed, pending, xp, activeDays, daysElapsed, consistency, days };
}

export function normalizeTaskText(text) {
    return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

// Quests failed most often, grouping repeats of the same task text.
// Pass `since` to limit the window (by deadline).
export function mostFailed(tasks, now, { since = 0, limit = 5 } = {}) {
    const groups = new Map();
    for (const t of tasks) {
        if (t.pending || deadlineOf(t) < since) continue;
        const outcome = taskOutcome(t, now);
        if (outcome === "pending") continue;
        const key = normalizeTaskText(t.text);
        if (!key) continue;
        const g = groups.get(key) || { text: t.text, failed: 0, total: 0, lastAt: 0 };
        g.total++;
        if (outcome === "failed") g.failed++;
        if (t.createdAt > g.lastAt) { g.lastAt = t.createdAt; g.text = t.text; }
        groups.set(key, g);
    }
    return [...groups.values()]
        .filter((g) => g.failed > 0)
        .sort((a, b) => b.failed - a.failed || b.failed / b.total - a.failed / a.total || b.lastAt - a.lastAt)
        .slice(0, limit);
}
