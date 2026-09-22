import { describe, it, expect } from "vitest";
import { heuristicGrade, CATS } from "../grading.js";

describe("heuristicGrade", () => {
    it("scores chores low and work/school high", () => {
        const chore = heuristicGrade("Do the dishes");
        const work = heuristicGrade("Finish history essay");
        expect(chore.category).toBe("mundane");
        expect(work.category).toBe("work");
        expect(work.exp).toBeGreaterThan(chore.exp);
    });

    it("prefers the longest keyword", () => {
        expect(heuristicGrade("empty the dishwasher").reason).toContain("dishwasher");
    });

    it("falls back to a personal estimate inside the category range", () => {
        const g = heuristicGrade("zzz");
        expect(g.category).toBe("personal");
        expect(g.exp).toBeGreaterThanOrEqual(CATS.personal.range[0]);
    });
});
