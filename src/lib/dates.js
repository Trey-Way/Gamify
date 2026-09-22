export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtClock(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export function fmtDateTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Local-calendar day key, e.g. "2026-8-22" (month is 0-based, matching Date).
export function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
