/* ---------- Task outcomes ---------- */
// A task's deadline is its optional due date. Tasks without one are daily
// quests: they're due by the end of the day they were created.
// - succeeded: completed on or before the deadline
// - failed:    deadline passed while still open, or completed late
// - pending:   still open and the deadline hasn't passed
export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
export function endOfDay(ts) {
    const d = new Date(ts);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}
export function addDays(ts, n) {
    const d = new Date(ts);
    d.setDate(d.getDate() + n);
    return d.getTime();
}

export function deadlineOf(task) {
    return task.dueAt || endOfDay(task.createdAt);
}

export function taskOutcome(task, now) {
    const deadline = deadlineOf(task);
    if (task.done) return task.completedAt <= deadline ? "succeeded" : "failed";
    return now > deadline ? "failed" : "pending";
}

export function isOverdue(task, now) {
    return !task.done && now > deadlineOf(task);
}

// Consecutive days (ending today, or yesterday if nothing is done yet today)
// with at least one completed quest.
export function currentStreak(tasks, now) {
    const days = new Set(tasks.filter((t) => t.done && t.completedAt).map((t) => startOfDay(t.completedAt)));
    const today = startOfDay(now);
    const doneToday = days.has(today);
    let cursor = doneToday ? today : addDays(today, -1);
    let count = 0;
    while (days.has(cursor)) {
        count += 1;
        cursor = addDays(cursor, -1);
    }
    return { count, doneToday };
}
