import { describe, it, expect } from "vitest";
import { buildPushSnapshot } from "../push.js";

describe("buildPushSnapshot", () => {
    it("sends open quests by deadline and only recent completions", () => {
        const now = new Date(2026, 8, 22, 12).getTime();
        const day = 24 * 3600 * 1000;
        const tasks = [
            { id: "a", text: "Later", exp: 10, done: false, createdAt: now, dueAt: now + 3 * day },
            { id: "b", text: "Today", exp: 20, done: false, createdAt: now, dueAt: null, category: "work", reason: "secret" },
            { id: "c", text: "Grading", done: false, pending: true, createdAt: now },
            { id: "d", text: "Recent", exp: 5, done: true, createdAt: now - day, completedAt: now - day },
            { id: "e", text: "Ancient", exp: 5, done: true, createdAt: now - 90 * day, completedAt: now - 90 * day },
        ];
        const s = buildPushSnapshot(tasks, now);
        expect(s.openTasks).toEqual([
            { text: "Today", exp: 20, dueAt: null, createdAt: now },
            { text: "Later", exp: 10, dueAt: now + 3 * day, createdAt: now },
        ]);
        expect(s.completions).toEqual([{ at: now - day, exp: 5 }]);
    });
});
