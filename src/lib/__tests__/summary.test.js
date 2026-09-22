import { describe, it, expect } from "vitest";
import { deadlineOf, taskOutcome, currentStreak, isOverdue } from "../outcomes.js";
import { weekStart, weeklySummary, mostFailed } from "../summary.js";

// Local-time helper: Monday 2026-09-21 is the week under test.
const at = (day, h = 12, m = 0) => new Date(2026, 8, day, h, m).getTime();
let n = 0;
const task = (over) => ({ id: String(n++), text: "task", exp: 10, category: "personal", done: false, pending: false, createdAt: at(21, 9), completedAt: null, ...over });

describe("outcomes", () => {
    it("uses end of creation day when there's no due date", () => {
        expect(deadlineOf(task({ createdAt: at(21, 9) }))).toBe(new Date(2026, 8, 21, 23, 59, 59, 999).getTime());
    });

    it("classifies succeeded, late, open-past-due and pending", () => {
        const now = at(22, 12);
        expect(taskOutcome(task({ done: true, completedAt: at(21, 20) }), now)).toBe("succeeded");
        expect(taskOutcome(task({ done: true, completedAt: at(22, 8) }), now)).toBe("failed");
        expect(taskOutcome(task({}), now)).toBe("failed");
        expect(taskOutcome(task({ dueAt: at(25) }), now)).toBe("pending");
        expect(isOverdue(task({}), now)).toBe(true);
        expect(isOverdue(task({ dueAt: at(25) }), now)).toBe(false);
    });

    it("counts a streak through yesterday and flags if today is done", () => {
        const tasks = [19, 20, 21].map((d) => task({ done: true, completedAt: at(d, 10) }));
        expect(currentStreak(tasks, at(22, 9))).toEqual({ count: 3, doneToday: false });
        tasks.push(task({ done: true, completedAt: at(22, 8) }));
        expect(currentStreak(tasks, at(22, 9))).toEqual({ count: 4, doneToday: true });
        expect(currentStreak(tasks, at(24, 9)).count).toBe(0);
    });
});

describe("weeklySummary", () => {
    it("starts weeks on Monday", () => {
        expect(weekStart(at(27, 18))).toBe(new Date(2026, 8, 21).getTime());
        expect(weekStart(at(21, 0))).toBe(new Date(2026, 8, 21).getTime());
    });

    it("counts outcomes, xp and consistency for the week", () => {
        const now = at(23, 12); // Wednesday: 3 days elapsed
        const tasks = [
            task({ createdAt: at(21, 9), done: true, completedAt: at(21, 10), exp: 40 }), // Mon ok
            task({ createdAt: at(22, 9), done: true, completedAt: at(22, 10), exp: 10 }), // Tue ok
            task({ createdAt: at(22, 9) }),                                               // Tue failed (open)
            task({ createdAt: at(23, 9) }),                                               // Wed pending
            task({ createdAt: at(14, 9), done: true, completedAt: at(14, 10) }),          // last week
        ];
        const s = weeklySummary(tasks, weekStart(now), now);
        expect(s).toMatchObject({ succeeded: 2, failed: 1, pending: 1, xp: 50, activeDays: 2, daysElapsed: 3 });
        // 0.6 * 2/3 + 0.4 * 2/3 = 66.7
        expect(s.consistency).toBe(67);
        expect(s.days[1]).toMatchObject({ succeeded: 1, failed: 1 });
    });

    it("has no score for an empty week", () => {
        expect(weeklySummary([], weekStart(at(23)), at(23)).consistency).toBeNull();
    });
});

describe("mostFailed", () => {
    it("groups repeats by normalized text and ranks by failures", () => {
        const now = at(27);
        const tasks = [
            task({ text: "Go to the gym", createdAt: at(21) }),
            task({ text: "go to the gym!", createdAt: at(22) }),
            task({ text: "Go to the gym", createdAt: at(23), done: true, completedAt: at(23, 13) }),
            task({ text: "Read", createdAt: at(21) }),
            task({ text: "Dishes", createdAt: at(21), done: true, completedAt: at(21, 13) }),
        ];
        const list = mostFailed(tasks, now);
        expect(list.map((g) => [g.failed, g.total])).toEqual([[2, 3], [1, 1]]);
        expect(list[0].text).toBe("Go to the gym");
    });
});
