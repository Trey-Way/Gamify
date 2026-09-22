import { describe, it, expect } from "vitest";
import { screenTimePenalty, totalAdjustment, collectAdjustments } from "../xpAdjustments.js";

describe("xp adjustments", () => {
    it("docks 1 xp per 2 minutes over the free 30", () => {
        expect(screenTimePenalty(20)).toBe(0);
        expect(screenTimePenalty(30)).toBe(0);
        expect(screenTimePenalty(90)).toBe(30);
    });

    it("sums every source's adjustments", () => {
        const state = { screenTimeLog: [{ id: "a", minutes: 90, penalty: 30, at: 1 }, { id: "b", minutes: 40, penalty: 5, at: 2 }] };
        expect(totalAdjustment(state)).toBe(-35);
        expect(collectAdjustments(state)[0]).toMatchObject({ source: "screen-time-manual", xp: -30 });
        expect(totalAdjustment({})).toBe(0);
    });
});
