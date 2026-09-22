import { describe, it, expect } from "vitest";
import { xpToNext, levelInfo, rankFor, nextRank, RANKS, timerBonusFor, TIMER_BONUS_CAP } from "../xp.js";

describe("xp curve", () => {
    it("makes level 100 about 50% harder than level 1", () => {
        expect(xpToNext(1)).toBe(100);
        expect(xpToNext(100)).toBe(150);
    });

    it("walks levels using the per-level requirement", () => {
        expect(levelInfo(0)).toEqual({ level: 1, into: 0, need: 100 });
        expect(levelInfo(99).level).toBe(1);
        expect(levelInfo(100)).toEqual({ level: 2, into: 0, need: xpToNext(2) });
        expect(levelInfo(-50).level).toBe(1);
    });
});

describe("ranks", () => {
    it("starts at Novice and tops out at Elite", () => {
        expect(rankFor(1).name).toBe("Novice");
        expect(rankFor(9).name).toBe("Novice");
        expect(rankFor(10).name).toBe("Apprentice");
        expect(rankFor(100).name).toBe("Elite");
        expect(RANKS.at(-1).name).toBe("Elite");
    });

    it("reports the next rank until the top", () => {
        expect(nextRank(1).name).toBe("Apprentice");
        expect(nextRank(95)).toBeNull();
    });
});

describe("timer bonus", () => {
    it("gives +1 per 5 minutes up to the cap", () => {
        expect(timerBonusFor(0)).toBe(0);
        expect(timerBonusFor(5 * 60)).toBe(1);
        expect(timerBonusFor(24 * 60)).toBe(4);
        expect(timerBonusFor(10 * 3600)).toBe(TIMER_BONUS_CAP);
    });
});
