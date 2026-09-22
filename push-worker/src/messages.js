/* Notification scheduling and copy. Pure functions: everything is computed
 * from the snapshot the app last synced, in the user's own time zone, at
 * the moment of sending - so a snapshot from this morning still gives a
 * correct streak and "at risk" list tonight. */

export const KINDS = ["morning", "streak", "evening"];

export const DEFAULT_PREFS = {
    morning: { enabled: true, time: "08:00" },
    streak: { enabled: true, time: "19:00" },
    evening: { enabled: true, time: "21:30" },
};

// If a cron run is missed, still send within this many minutes of the target.
export const SEND_WINDOW_MIN = 60;

function parts(ts, timeZone) {
    const f = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function localDate(ts, timeZone) {
    return parts(ts, timeZone).date;
}

function prevDate(date) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

function toMinutes(hhmm) {
    const [h, m] = String(hhmm).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

export function isValidTimeZone(tz) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

// Which notification kinds are due for this subscriber right now.
export function dueKinds(record, now) {
    const tz = record.timeZone || "UTC";
    const { date, minutes } = parts(now, tz);
    const prefs = { ...DEFAULT_PREFS, ...(record.prefs || {}) };
    return KINDS.filter((kind) => {
        const p = prefs[kind];
        if (!p?.enabled) return false;
        if (record.sent?.[kind] === date) return false;
        const target = toMinutes(p.time);
        return minutes >= target && minutes < target + SEND_WINDOW_MIN;
    });
}

/* ---------- Snapshot analysis ---------- */

export function analyze(snapshot, now, timeZone) {
    const today = localDate(now, timeZone);
    const completions = snapshot?.completions || [];
    const open = snapshot?.openTasks || [];

    const doneDays = new Set(completions.map((c) => localDate(c.at, timeZone)));
    const doneToday = doneDays.has(today);
    let cursor = doneToday ? today : prevDate(today);
    let streak = 0;
    while (doneDays.has(cursor)) { streak++; cursor = prevDate(cursor); }

    const todays = completions.filter((c) => localDate(c.at, timeZone) === today);
    const deadlineDate = (t) => localDate(t.dueAt || t.createdAt, timeZone);
    const dueToday = open.filter((t) => deadlineDate(t) === today && (!t.dueAt || t.dueAt > now));
    const overdue = open.filter((t) => (t.dueAt ? t.dueAt <= now : deadlineDate(t) < today));
    const upcoming = open.filter((t) => t.dueAt && deadlineDate(t) > today);

    return {
        streak, doneToday,
        completedToday: todays.length,
        xpToday: todays.reduce((s, c) => s + (c.exp || 0), 0),
        dueToday, overdue, upcoming,
    };
}

function list(tasks, max = 3, withXp = false) {
    const names = tasks.slice(0, max).map((t) => (withXp && t.exp ? `${t.text} (+${t.exp} XP)` : t.text));
    if (tasks.length > max) names.push(`+${tasks.length - max} more`);
    return names.join(", ");
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildMessage(kind, snapshot, now, timeZone) {
    const a = analyze(snapshot, now, timeZone);
    const streakLine = a.streak > 0 ? `🔥 ${a.streak}-day streak` : "No streak yet";

    if (kind === "morning") {
        const plan = [...a.overdue, ...a.dueToday];
        const body = plan.length
            ? `${plural(a.dueToday.length, "quest")} due today${a.overdue.length ? `, ${a.overdue.length} overdue` : ""}: ${list(plan)}. ${streakLine}.`
            : a.upcoming.length
                ? `Nothing due today. Next up: ${list(a.upcoming, 2)}. Add a quest to keep your ${a.streak > 0 ? `${a.streak}-day ` : ""}streak going.`
                : `No quests planned yet. Add a few to earn XP today. ${streakLine}.`;
        return { title: "☀️ Today's plan", body, tag: "questlog-morning", url: "./?view=quests" };
    }

    if (kind === "streak") {
        // Only quests still due today are "at risk"; overdue ones have already failed.
        const atRisk = a.dueToday;
        const xpAtRisk = atRisk.reduce((s, t) => s + (t.exp || 0), 0);
        const overdueNote = a.overdue.length ? ` ${plural(a.overdue.length, "quest")} overdue.` : "";
        if (a.doneToday) {
            return {
                title: `🔥 ${a.streak}-day streak secured`,
                body: (atRisk.length
                    ? `Still at risk today: ${list(atRisk, 3, true)} (${xpAtRisk} XP).`
                    : "Nothing left at risk today. Nice work.") + overdueNote,
                tag: "questlog-streak", url: "./?view=quests",
            };
        }
        return {
            title: a.streak > 0 ? `🔥 ${a.streak}-day streak at risk` : "🔥 Start a streak today",
            body: `Finish one quest before midnight${a.streak > 0 ? " to keep it" : ""}.` +
                (atRisk.length ? ` At risk: ${list(atRisk, 3, true)}.` : "") + overdueNote,
            tag: "questlog-streak", url: "./?view=quests",
        };
    }

    // evening
    const open = [...a.overdue, ...a.dueToday];
    const body = a.completedToday
        ? `Today: ${plural(a.completedToday, "quest")} done, +${a.xpToday} XP. ${streakLine}.` +
          (open.length ? ` Still open: ${list(open, 2)}. Finish or reschedule before midnight.` : " All clear.")
        : `Nothing completed yet today.${a.streak > 0 ? ` One quick quest keeps your ${a.streak}-day streak.` : " One quick quest starts a streak."}` +
          (open.length ? ` Open: ${list(open, 2)}.` : "");
    return { title: "🌙 Evening check-in", body, tag: "questlog-evening", url: "./?view=summary" };
}
