import { dayKey } from "./dates.js";

/* ---------- Badges ---------- */
// Badge tracking is independent of XP category - it scans completed task
// text for goal-area keywords, so e.g. "study for exam" counts toward
// Studying even though its XP category is "work". Six areas cover almost
// every keyword in the grading table above.
export const BADGE_KEYWORDS = {
    fitness: ["workout", "exercise", "gym", "run", "jog", "walk", "yoga", "stretch", "lift", "cardio", "hike", "bike", "swim", "sport", "training", "push up", "pushup", "squat"],
    studying: ["study", "homework", "exam", "essay", "assignment", "class", "read", "thesis", "research", "quiz", "lecture", "notes", "review", "course", "test", "flashcard"],
    work: ["work", "meeting", "report", "project", "deadline", "client", "email", "presentation", "shift", "task", "boss", "submit", "invoice", "call", "interview", "spreadsheet", "resume", "job application", "coding", "code review", "bug", "budget", "taxes"],
    chores: ["chores", "dishes", "laundry", "trash", "recycling", "clean", "vacuum", "sweep", "mop", "groceries", "dust", "tidy", "declutter", "organize", "mow", "water plants", "bills", "iron"],
    selfcare: ["meditate", "journal", "self care", "cook", "meal prep", "hobby", "call mom", "call friend", "relax", "nap", "sleep early", "therapy", "rest"],
    majorgoals: ["marathon", "certification", "thesis", "launch", "degree", "publish", "start business", "move out", "goal", "milestone", "quit"],
};
export const BADGE_LABELS = { fitness: "Fitness", studying: "Studying", work: "Work", chores: "Chores", selfcare: "Self-Care", majorgoals: "Major Goals" };
const BADGE_COUNT_NAMES = {
    fitness: ["First Rep", "Warming Up", "Getting Stronger", "Iron Habit", "Gym Regular", "Fitness Fanatic"],
    studying: ["First Study Session", "Note Taker", "Diligent Student", "Bookworm", "Scholar", "Honor Roll"],
    work: ["First Task Done", "Getting Things Done", "Reliable", "Workhorse", "Go-Getter", "Top Performer"],
    chores: ["First Chore", "Tidying Up", "Housekeeper", "Neat Freak", "Domestic Pro", "Spotless"],
    selfcare: ["First Check-In", "Taking a Breath", "Self-Care Streak", "Balanced", "Recharged", "Mindful Master"],
    majorgoals: ["First Milestone", "Big Mover", "Goal Getter", "Achiever", "Trailblazer", "Legend"],
};
const BADGE_COUNT_THRESHOLDS = [1, 3, 5, 10, 20, 30];
const BADGE_STREAK_THRESHOLDS = [3, 7];

function badgeMatchesCategory(text, category) {
    const t = text.toLowerCase();
    return BADGE_KEYWORDS[category].some((w) => t.includes(w));
}

export function longestStreak(dayKeys) {
    if (dayKeys.length === 0) return 0;
    const uniqueSorted = Array.from(new Set(dayKeys)).sort();
    const asDates = uniqueSorted.map((k) => {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m, d).getTime();
    });
    let best = 1;
    let cur = 1;
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 1; i < asDates.length; i++) {
        if (asDates[i] - asDates[i - 1] === dayMs) {
            cur += 1;
            best = Math.max(best, cur);
        } else {
            cur = 1;
        }
    }
    return best;
}

export function buildBadges(tasks) {
    const done = tasks.filter((t) => t.done);
    const badges = [];
    Object.keys(BADGE_KEYWORDS).forEach((category) => {
        const matches = done.filter((t) => badgeMatchesCategory(t.text, category));
        const count = matches.length;
        const streak = longestStreak(matches.map((t) => dayKey(t.completedAt || t.createdAt)));
        BADGE_COUNT_THRESHOLDS.forEach((threshold, i) => {
            badges.push({
                id: `${category}-count-${threshold}`,
                category,
                label: BADGE_COUNT_NAMES[category][i],
                description: `Complete ${threshold} ${BADGE_LABELS[category].toLowerCase()} task${threshold > 1 ? "s" : ""}.`,
                earned: count >= threshold,
                progress: Math.min(count, threshold),
                target: threshold,
            });
        });
        BADGE_STREAK_THRESHOLDS.forEach((threshold) => {
            badges.push({
                id: `${category}-streak-${threshold}`,
                category,
                label: `${threshold}-Day ${BADGE_LABELS[category]} Streak`,
                description: `Complete a ${BADGE_LABELS[category].toLowerCase()} task ${threshold} days in a row.`,
                earned: streak >= threshold,
                progress: Math.min(streak, threshold),
                target: threshold,
            });
        });
    });
    return badges;
}
