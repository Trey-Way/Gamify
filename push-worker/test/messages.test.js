import { describe, it, expect } from "vitest";
import { dueKinds, buildMessage, analyze, DEFAULT_PREFS } from "../src/messages.js";

const TZ = "America/New_York"; // UTC-4 in September
const ny = (day, h, m = 0) => Date.UTC(2026, 8, day, h + 4, m);

describe("dueKinds", () => {
    const record = { timeZone: TZ, prefs: DEFAULT_PREFS, sent: {} };
    it("fires each kind inside its window in the user's time zone", () => {
        expect(dueKinds(record, ny(22, 7, 59))).toEqual([]);
        expect(dueKinds(record, ny(22, 8, 0))).toEqual(["morning"]);
        expect(dueKinds(record, ny(22, 8, 59))).toEqual(["morning"]);
        expect(dueKinds(record, ny(22, 9, 0))).toEqual([]);
        expect(dueKinds(record, ny(22, 19, 15))).toEqual(["streak"]);
        expect(dueKinds(record, ny(22, 21, 30))).toEqual(["evening"]);
    });
    it("sends once per local day and respects disabled kinds", () => {
        expect(dueKinds({ ...record, sent: { morning: "2026-09-22" } }, ny(22, 8, 15))).toEqual([]);
        expect(dueKinds({ ...record, sent: { morning: "2026-09-21" } }, ny(22, 8, 15))).toEqual(["morning"]);
        expect(dueKinds({ ...record, prefs: { ...DEFAULT_PREFS, morning: { enabled: false, time: "08:00" } } }, ny(22, 8, 15))).toEqual([]);
    });
});

describe("messages", () => {
    const snapshot = {
        openTasks: [
            { text: "Study for exam", exp: 50, dueAt: ny(22, 17), createdAt: ny(21, 9) },
            { text: "Dishes", exp: 8, dueAt: null, createdAt: ny(22, 7) },
            { text: "Old quest", exp: 20, dueAt: null, createdAt: ny(20, 9) },
            { text: "Essay", exp: 45, dueAt: ny(25, 12), createdAt: ny(21, 9) },
        ],
        completions: [{ at: ny(19, 10), exp: 10 }, { at: ny(20, 22), exp: 10 }, { at: ny(21, 23, 30), exp: 10 }],
    };

    it("computes streak and today's buckets in the user's time zone", () => {
        const a = analyze(snapshot, ny(22, 8), TZ);
        expect(a.streak).toBe(3); // 21:30 NY on the 21st is the 22nd in UTC - must still count as the 21st
        expect(a.doneToday).toBe(false);
        expect(a.dueToday.map((t) => t.text)).toEqual(["Study for exam", "Dishes"]);
        expect(a.overdue.map((t) => t.text)).toEqual(["Old quest"]);
        expect(a.upcoming.map((t) => t.text)).toEqual(["Essay"]);
    });

    it("writes the morning plan, streak-at-risk and evening check-in", () => {
        const morning = buildMessage("morning", snapshot, ny(22, 8), TZ);
        expect(morning.title).toBe("☀️ Today's plan");
        expect(morning.body).toBe("2 quests due today, 1 overdue: Old quest, Study for exam, Dishes. 🔥 3-day streak.");

        const streak = buildMessage("streak", snapshot, ny(22, 19), TZ);
        expect(streak.title).toBe("🔥 3-day streak at risk");
        expect(streak.body).toBe("Finish one quest before midnight to keep it. At risk: Dishes (+8 XP). 2 quests overdue.");

        const done = { ...snapshot, completions: [...snapshot.completions, { at: ny(22, 12), exp: 30 }] };
        expect(buildMessage("streak", done, ny(22, 19), TZ).title).toBe("🔥 4-day streak secured");
        const evening = buildMessage("evening", done, ny(22, 21, 30), TZ);
        expect(evening.body).toMatch(/^Today: 1 quest done, \+30 XP\. 🔥 4-day streak\./);
        expect(evening.url).toBe("./?view=summary");
    });

    it("handles an empty snapshot", () => {
        expect(buildMessage("morning", {}, ny(22, 8), TZ).body).toMatch(/No quests planned/);
        expect(buildMessage("streak", undefined, ny(22, 19), TZ).title).toBe("🔥 Start a streak today");
    });
});
