export const CATS = {
    mundane: { label: "Mundane", range: [5, 15] },
    personal: { label: "Personal", range: [15, 30] },
    work: { label: "Work / School", range: [35, 70] },
    epic: { label: "Major goal", range: [60, 100] },
};

/* ---------- Keyword-based no-AI grading ---------- */
// Reliable, deterministic: same word -> same xp, every time. Longest keyword
// match wins so multi-word phrases beat single words. 60+ keywords tracked,
// covering everyday to-do list phrasing, not just the original core set.
export const KEYWORD_XP_TABLE = [
    // mundane (5-15)
    { word: "chores", category: "mundane", exp: 10 },
    { word: "dishes", category: "mundane", exp: 8 },
    { word: "dishwasher", category: "mundane", exp: 8 },
    { word: "laundry", category: "mundane", exp: 8 },
    { word: "trash", category: "mundane", exp: 6 },
    { word: "recycling", category: "mundane", exp: 6 },
    { word: "clean", category: "mundane", exp: 10 },
    { word: "vacuum", category: "mundane", exp: 8 },
    { word: "sweep", category: "mundane", exp: 6 },
    { word: "mop", category: "mundane", exp: 7 },
    { word: "groceries", category: "mundane", exp: 12 },
    { word: "grocery shopping", category: "mundane", exp: 12 },
    { word: "dust", category: "mundane", exp: 6 },
    { word: "tidy", category: "mundane", exp: 8 },
    { word: "declutter", category: "mundane", exp: 10 },
    { word: "organize", category: "mundane", exp: 9 },
    { word: "shower", category: "mundane", exp: 5 },
    { word: "iron clothes", category: "mundane", exp: 8 },
    { word: "mow", category: "mundane", exp: 12 },
    { word: "water plants", category: "mundane", exp: 5 },
    { word: "pay bills", category: "mundane", exp: 12 },
    { word: "bills", category: "mundane", exp: 10 },
    // personal (15-30)
    { word: "workout", category: "personal", exp: 25 },
    { word: "exercise", category: "personal", exp: 25 },
    { word: "gym", category: "personal", exp: 25 },
    { word: "run", category: "personal", exp: 20 },
    { word: "jog", category: "personal", exp: 20 },
    { word: "yoga", category: "personal", exp: 20 },
    { word: "stretch", category: "personal", exp: 12 },
    { word: "meditate", category: "personal", exp: 15 },
    { word: "journal", category: "personal", exp: 15 },
    { word: "self care", category: "personal", exp: 20 },
    { word: "cook", category: "personal", exp: 18 },
    { word: "meal prep", category: "personal", exp: 20 },
    { word: "walk", category: "personal", exp: 15 },
    { word: "hike", category: "personal", exp: 22 },
    { word: "read", category: "personal", exp: 15 },
    { word: "hobby", category: "personal", exp: 15 },
    { word: "call mom", category: "personal", exp: 15 },
    { word: "call friend", category: "personal", exp: 12 },
    { word: "practice", category: "personal", exp: 18 },
    { word: "sleep early", category: "personal", exp: 10 },
    // work / school (35-70)
    { word: "study", category: "work", exp: 40 },
    { word: "homework", category: "work", exp: 40 },
    { word: "exam", category: "work", exp: 55 },
    { word: "quiz", category: "work", exp: 35 },
    { word: "project", category: "work", exp: 50 },
    { word: "meeting", category: "work", exp: 45 },
    { word: "report", category: "work", exp: 45 },
    { word: "assignment", category: "work", exp: 45 },
    { word: "essay", category: "work", exp: 45 },
    { word: "presentation", category: "work", exp: 50 },
    { word: "shift", category: "work", exp: 40 },
    { word: "class", category: "work", exp: 35 },
    { word: "deadline", category: "work", exp: 55 },
    { word: "email", category: "work", exp: 30 },
    { word: "resume", category: "work", exp: 45 },
    { word: "job application", category: "work", exp: 50 },
    { word: "interview", category: "work", exp: 50 },
    { word: "invoice", category: "work", exp: 40 },
    { word: "budget", category: "work", exp: 35 },
    { word: "taxes", category: "work", exp: 45 },
    { word: "spreadsheet", category: "work", exp: 35 },
    { word: "coding", category: "work", exp: 40 },
    { word: "code review", category: "work", exp: 40 },
    { word: "bug fix", category: "work", exp: 40 },
    // epic (60-100)
    { word: "marathon", category: "epic", exp: 80 },
    { word: "certification", category: "epic", exp: 90 },
    { word: "thesis", category: "epic", exp: 85 },
    { word: "launch", category: "epic", exp: 90 },
    { word: "degree", category: "epic", exp: 100 },
    { word: "publish", category: "epic", exp: 85 },
    { word: "start business", category: "epic", exp: 90 },
    { word: "move out", category: "epic", exp: 75 },
].sort((a, b) => b.word.length - a.word.length); // longest word first so "dishwasher" beats "dishes"

export function heuristicGrade(text) {
    const t = text.toLowerCase();
    const hit = KEYWORD_XP_TABLE.find((k) => t.includes(k.word));
    if (hit) {
        return { category: hit.category, exp: hit.exp, reason: `Keyword match: "${hit.word}" (no AI).` };
    }
    // No keyword matched - fall back to a rough length-based personal estimate.
    const [lo, hi] = CATS.personal.range;
    const lengthBoost = Math.min(10, Math.floor(text.length / 20));
    const exp = Math.min(100, Math.round(lo + Math.random() * (hi - lo) + lengthBoost));
    return { category: "personal", exp, reason: "No keyword matched - rough estimate (no AI)." };
}
