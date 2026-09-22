/* ---------- XP adjustments (hook point) ---------- */
// Everything that changes XP outside of completing quests goes through here,
// so total XP is always: earned from quests + sum of adjustments.
//
// Today the only source is the manual social-media screen-time log. The
// plan is for real phone screen-time data (e.g. from a native companion
// app or an iOS Shortcut that posts Screen Time totals) to be added as
// another source - NOT built yet. To add one:
//   1. store its raw reports in the save (e.g. `deviceScreenTime`), as
//      [{ id, at, minutes, source }] with `minutes` = social-media minutes
//      for that day,
//   2. add an entry to ADJUSTMENT_SOURCES whose `collect` maps them through
//      screenTimePenalty(), and
//   3. make sure a day already covered by a device report isn't also
//      penalised from the manual log (dedupe by calendar day).
// The weekly summary, level card and push snapshot all read totalXp, so
// they pick up new sources automatically.

export const SCREEN_TIME_RULES = { freeMinutes: 30, minutesPerXp: 2 };

// -1 xp per 2 minutes of social media over 30 minutes a day.
export function screenTimePenalty(minutes, rules = SCREEN_TIME_RULES) {
    const overage = Math.max(0, minutes - rules.freeMinutes);
    return Math.round(overage / rules.minutesPerXp);
}

// Each source returns [{ id, source, at, xp, label }]; xp < 0 is a penalty.
export const ADJUSTMENT_SOURCES = [
    {
        id: "screen-time-manual",
        label: "Screen time (logged manually)",
        collect: (state) => (state.screenTimeLog || []).map((l) => ({
            id: l.id, source: "screen-time-manual", at: l.at, xp: -(l.penalty || 0), label: `${l.minutes} min social media`,
        })),
    },
];

export function collectAdjustments(state) {
    return ADJUSTMENT_SOURCES.flatMap((s) => s.collect(state));
}

export function totalAdjustment(state) {
    return collectAdjustments(state).reduce((sum, a) => sum + a.xp, 0);
}
