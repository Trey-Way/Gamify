/* ---------- XP curve ---------- */
// Linear growth of 0.5% per level: level 1 needs 100 xp, level 100 needs
// 150 xp - i.e. leveling at 100 is ~50% harder than at 1.
export const BASE_XP = 100;
export function xpToNext(level) {
    return Math.round(BASE_XP * (1 + 0.005 * (level - 1)));
}

export function levelInfo(xp) {
    let level = 1;
    let remaining = Math.max(0, xp);
    while (remaining >= xpToNext(level)) {
        remaining -= xpToNext(level);
        level += 1;
        if (level > 9999) break;
    }
    return { level, into: remaining, need: xpToNext(level) };
}

/* ---------- Rank system ---------- */
// Ranks are level bands. Broad at low levels, narrower near the top so
// climbing from Master to Elite still feels earned.
export const RANKS = [
    { min: 1, name: "Novice" },
    { min: 10, name: "Apprentice" },
    { min: 20, name: "Adept" },
    { min: 35, name: "Expert" },
    { min: 50, name: "Veteran" },
    { min: 70, name: "Master" },
    { min: 90, name: "Elite" },
];
export function rankFor(level) {
    let r = RANKS[0];
    for (const entry of RANKS) if (level >= entry.min) r = entry;
    return r;
}
export function nextRank(level) {
    return RANKS.find((r) => r.min > level) || null;
}

/* ---------- Timer bonus ---------- */
// Small, capped focus bonus: +1 xp per 5 focused minutes, capped at 15 xp
// so a timed mundane task never leapfrogs an untimed work/epic task.
export const TIMER_BONUS_PER_MIN = 1 / 5;
export const TIMER_BONUS_CAP = 15;
export function timerBonusFor(seconds) {
    return Math.min(TIMER_BONUS_CAP, Math.floor((seconds / 60) * TIMER_BONUS_PER_MIN));
}
