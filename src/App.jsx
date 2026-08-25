import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ---------- XP curve ---------- */
const BASE_XP = 100;
function xpToNext(level) {
    return Math.round(BASE_XP * (1 + 0.005 * (level - 1)));
}

const CATS = {
    mundane: { label: "Mundane", range: [5, 15] },
    personal: { label: "Personal", range: [15, 30] },
    work: { label: "Work / School", range: [35, 70] },
    epic: { label: "Major goal", range: [60, 100] },
};

/* ---------- Color profiles ---------- */
// Four full themes: Dark and Light are the originals; Ocean and Sunset are
// two extra profiles for variety. Each carries its own category color map
// so quest tags stay legible against its own palette.
const THEMES = {
    dark: {
        label: "Dark", isDark: true,
        colors: { bg: "#12141a", panel: "#1a1d26", panel2: "#20242f", border: "#2c3140", text: "#e8e6df", textDim: "#8b8f9e", accent: "#5ec8a8", accentDim: "#3a8f77", amber: "#e0a940", danger: "#d9614f" },
        catColors: { mundane: "#8b8f9e", personal: "#5ec8a8", work: "#e0836a", epic: "#e0a940" },
    },
    light: {
        label: "Light", isDark: false,
        colors: { bg: "#f4f1ea", panel: "#ffffff", panel2: "#ece7db", border: "#ddd5c2", text: "#26241d", textDim: "#767061", accent: "#1d7a5f", accentDim: "#2f9f7c", amber: "#b5780f", danger: "#b8402f" },
        catColors: { mundane: "#767061", personal: "#1d7a5f", work: "#b5502f", epic: "#b5780f" },
    },
    ocean: {
        label: "Ocean", isDark: true,
        colors: { bg: "#0d1420", panel: "#141d2e", panel2: "#1a2540", border: "#243252", text: "#e5ecf5", textDim: "#7c8aa8", accent: "#4fb8e8", accentDim: "#3486ab", amber: "#e0a940", danger: "#e2685a" },
        catColors: { mundane: "#7c8aa8", personal: "#4fb8e8", work: "#e08a5a", epic: "#e0a940" },
    },
    sunset: {
        label: "Sunset", isDark: false,
        colors: { bg: "#fdf3ec", panel: "#ffffff", panel2: "#f7e3d2", border: "#f0d2b8", text: "#3a2a1f", textDim: "#8a6f5c", accent: "#e0663f", accentDim: "#c9502c", amber: "#c77d1d", danger: "#c23b2f" },
        catColors: { mundane: "#8a6f5c", personal: "#e0663f", work: "#b5502f", epic: "#c77d1d" },
    },
};

/* ---------- AI provider presets ---------- */
// One-click fills for popular OpenAI-compatible endpoints, so connecting a
// custom AI is "pick a name, paste a key" instead of hunting down a URL.
// True "log in with your AI account" OAuth isn't possible from a static
// front-end (it needs a backend to hold the client secret), so this is the
// closest practical shortcut without standing up a server.
const PROVIDER_PRESETS = [
    { name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
    { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
    { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
    { name: "Ollama (local)", endpoint: "http://localhost:11434/v1/chat/completions", model: "llama3.1" },
];

/* ---------- Timer bonus ---------- */
// Small, capped focus bonus: +1 xp per 5 focused minutes, capped at 15 xp
// so a timed mundane task never leapfrogs an untimed work/epic task.
const TIMER_BONUS_PER_MIN = 1 / 5;
const TIMER_BONUS_CAP = 15;
function timerBonusFor(seconds) {
    return Math.min(TIMER_BONUS_CAP, Math.floor((seconds / 60) * TIMER_BONUS_PER_MIN));
}
function fmtClock(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

/* ---------- Rank system ---------- */
// Ranks are level bands. Broad at low levels, narrower near the top so
// climbing from Master to Elite still feels earned.
const RANKS = [
    { min: 1, name: "Novice" },
    { min: 10, name: "Apprentice" },
    { min: 20, name: "Adept" },
    { min: 35, name: "Expert" },
    { min: 50, name: "Veteran" },
    { min: 70, name: "Master" },
    { min: 90, name: "Elite" },
];
function rankFor(level) {
    let r = RANKS[0];
    for (const entry of RANKS) if (level >= entry.min) r = entry;
    return r;
}
function nextRank(level) {
    return RANKS.find((r) => r.min > level) || null;
}

/* ---------- Keyword-based no-AI grading ---------- */
// Reliable, deterministic: same word -> same xp, every time. Longest keyword
// match wins so multi-word phrases beat single words. 60+ keywords tracked,
// covering everyday to-do list phrasing, not just the original core set.
const KEYWORD_XP_TABLE = [
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

function heuristicGrade(text) {
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

async function claudeGrade(text) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 200,
            messages: [
                {
                    role: "user",
                    content:
                        `You grade tasks for a gamified to-do app. Respond with ONLY raw JSON, no markdown fences:\n` +
                        `{"category":"mundane|personal|work|epic","exp":<integer 5-100>,"reason":"<under 12 words>"}\n\n` +
                        `Guidance: mundane chores get low exp (5-15). Personal/self-care/hobby tasks get medium (15-30). Work or school tasks get high (35-70). Rare major life goals get most (60-100). Judge effort, importance and stakes.\n\n` +
                        `Task: "${text}"`,
                },
            ],
        }),
    });
    if (!res.ok) throw new Error("Claude API error " + res.status);
    const data = await res.json();
    const raw = data.content.map((b) => b.text || "").join("").trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!CATS[parsed.category]) parsed.category = "personal";
    parsed.exp = Math.max(1, Math.min(100, Math.round(parsed.exp)));
    return parsed;
}

async function customGrade(text, provider) {
    const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: provider.model || "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content:
                        `Grade this to-do task for a gamified app. Respond with ONLY raw JSON: ` +
                        `{"category":"mundane|personal|work|epic","exp":<integer 5-100>,"reason":"<under 12 words>"}. ` +
                        `mundane=chores(5-15), personal=self-care/hobby(15-30), work=job/school(35-70), epic=major life goal(60-100). Task: "${text}"`,
                },
            ],
        }),
    });
    if (!res.ok) throw new Error("Provider error " + res.status);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || data.content?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!CATS[parsed.category]) parsed.category = "personal";
    parsed.exp = Math.max(1, Math.min(100, Math.round(parsed.exp)));
    return parsed;
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDateTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* ---------- Sound effects ---------- */
// Synthesized with the Web Audio API instead of an external audio file, so
// there's nothing to fetch, no CORS risk once deployed, and no licensing to
// track down - it just works everywhere, offline included.
let sharedAudioCtx = null;
function getAudioCtx() {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume().catch(() => {});
    return sharedAudioCtx;
}
function playTone(freq, delayMs = 0, duration = 140, volume = 0.16) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const startAt = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration / 1000 + 0.02);
}
function playCreateDing() {
    try { playTone(720, 0, 110, 0.12); } catch (e) {}
}
function playCompleteDing() {
    try { playTone(880, 0, 110, 0.14); playTone(1318, 90, 170, 0.14); } catch (e) {}
}

/* ---------- Reliable local save (with a redundant backup copy) ---------- */
// A single localStorage write can be lost to a full quota, a mid-write tab
// close, or Safari's storage eviction. Writing the same payload to a second
// key means a corrupted/missing primary can self-heal from the backup on
// next load instead of silently resetting progress.
const STORAGE_KEY = "questlog-state";
const STORAGE_BACKUP_KEY = "questlog-state-backup";

function loadSavedState() {
    for (const key of [STORAGE_KEY, STORAGE_BACKUP_KEY]) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tasks)) return parsed;
        } catch (e) { /* try the next key */ }
    }
    return null;
}
function saveState(s) {
    try {
        const json = JSON.stringify(s);
        localStorage.setItem(STORAGE_KEY, json);
        localStorage.setItem(STORAGE_BACKUP_KEY, json);
        return true;
    } catch (e) {
        return false;
    }
}
function clearSavedState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_BACKUP_KEY);
    } catch (e) {}
}

/* ---------- Badges ---------- */
// Badge tracking is independent of XP category - it scans completed task
// text for goal-area keywords, so e.g. "study for exam" counts toward
// Studying even though its XP category is "work". Six areas cover almost
// every keyword in the grading table above.
const BADGE_KEYWORDS = {
    fitness: ["workout", "exercise", "gym", "run", "jog", "walk", "yoga", "stretch", "lift", "cardio", "hike", "bike", "swim", "sport", "training", "push up", "pushup", "squat"],
    studying: ["study", "homework", "exam", "essay", "assignment", "class", "read", "thesis", "research", "quiz", "lecture", "notes", "review", "course", "test", "flashcard"],
    work: ["work", "meeting", "report", "project", "deadline", "client", "email", "presentation", "shift", "task", "boss", "submit", "invoice", "call", "interview", "spreadsheet", "resume", "job application", "coding", "code review", "bug", "budget", "taxes"],
    chores: ["chores", "dishes", "laundry", "trash", "recycling", "clean", "vacuum", "sweep", "mop", "groceries", "dust", "tidy", "declutter", "organize", "mow", "water plants", "bills", "iron"],
    selfcare: ["meditate", "journal", "self care", "cook", "meal prep", "hobby", "call mom", "call friend", "relax", "nap", "sleep early", "therapy", "rest"],
    majorgoals: ["marathon", "certification", "thesis", "launch", "degree", "publish", "start business", "move out", "goal", "milestone", "quit"],
};
const BADGE_LABELS = { fitness: "Fitness", studying: "Studying", work: "Work", chores: "Chores", selfcare: "Self-Care", majorgoals: "Major Goals" };
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

function longestStreak(dayKeys) {
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

function buildBadges(tasks) {
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

export default function QuestLog() {
    const [theme, setTheme] = useState("dark");
    const [tasks, setTasks] = useState([]);
    const [input, setInput] = useState("");
    const [view, setView] = useState("quests"); // quests | completed | calendar | settings
    const [menuOpen, setMenuOpen] = useState(false);
    const [aiMode, setAiMode] = useState("builtin");
    const [customProvider, setCustomProvider] = useState({ endpoint: "", apiKey: "", model: "" });
    const [levelUpFlash, setLevelUpFlash] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [screenTimeLog, setScreenTimeLog] = useState([]);
    const [screenTimeInput, setScreenTimeInput] = useState("");
    const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
    const [calSelected, setCalSelected] = useState(null);
    const [settingsSection, setSettingsSection] = useState("general"); // general | ai | guided | screentime | save
    const [activeTimer, setActiveTimer] = useState(null); // { taskId, startedAt }
    const [tick, setTick] = useState(0); // forces re-render each second while a timer runs
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [importStatus, setImportStatus] = useState(null); // { ok, msg } | null
    const [keywordFilter, setKeywordFilter] = useState("");
    const fileInputRef = useRef(null);

    useEffect(() => {
        try {
            const s = loadSavedState();
            if (s) {
                setTasks(s.tasks || []);
                setTheme(s.theme || "dark");
                setAiMode(s.aiMode || "builtin");
                setCustomProvider(s.customProvider || { endpoint: "", apiKey: "", model: "" });
                setScreenTimeLog(s.screenTimeLog || []);
                setActiveTimer(s.activeTimer || null);
                setSoundEnabled(s.soundEnabled !== false);
            }
        } catch (e) { }
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (!activeTimer) return;
        const iv = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(iv);
    }, [activeTimer]);

    useEffect(() => {
        if (!loaded) return;
        const s = { tasks, theme, aiMode, customProvider, screenTimeLog, activeTimer, soundEnabled };
        saveState(s);
    }, [tasks, theme, aiMode, customProvider, screenTimeLog, activeTimer, soundEnabled, loaded]);

    const levelInfo = useCallback((xp) => {
        let level = 1;
        let remaining = Math.max(0, xp);
        while (remaining >= xpToNext(level)) {
            remaining -= xpToNext(level);
            level += 1;
            if (level > 9999) break;
        }
        return { level, into: remaining, need: xpToNext(level) };
    }, []);

    const totalXp = useMemo(() => {
        const earned = tasks.filter((t) => t.done).reduce((s, t) => s + (t.exp || 0), 0);
        const penalty = screenTimeLog.reduce((s, l) => s + l.penalty, 0);
        return Math.max(0, earned - penalty);
    }, [tasks, screenTimeLog]);

    const { level, into, need } = levelInfo(totalXp);
    const pct = Math.min(100, Math.round((into / need) * 100));
    const rank = rankFor(level);
    const nRank = nextRank(level);

    async function addTask(startTimer) {
        const text = input.trim();
        if (!text) return;
        setInput("");
        setAddMenuOpen(false);
        if (soundEnabled) playCreateDing();
        const id = uid();
        const draft = { id, text, exp: null, category: null, reason: "", done: false, pending: true, createdAt: Date.now(), completedAt: null, timeBonus: 0, timedSeconds: 0 };
        setTasks((t) => [draft, ...t]);
        if (startTimer) setActiveTimer({ taskId: id, startedAt: Date.now() });
        try {
            let result;
            if (aiMode === "builtin") result = await claudeGrade(text);
            else if (aiMode === "custom" && customProvider.endpoint) result = await customGrade(text, customProvider);
            else result = heuristicGrade(text);
            setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, ...result, pending: false } : tk)));
        } catch (e) {
            const fb = heuristicGrade(text);
            setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, ...fb, reason: fb.reason + " (AI unavailable)", pending: false } : tk)));
        }
    }

    function completeTask(id, bonus) {
        const task = tasks.find((t) => t.id === id);
        if (!task || task.done || task.pending) return;
        if (soundEnabled) playCompleteDing();
        const timeBonus = bonus || 0;
        const prevLevel = levelInfo(totalXp).level;
        const nextTotal = totalXp + (task.exp || 0) + timeBonus;
        setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, done: true, completedAt: Date.now(), exp: (tk.exp || 0) + timeBonus, timeBonus } : tk)));
        const newLevel = levelInfo(nextTotal).level;
        if (newLevel > prevLevel) {
            setLevelUpFlash(newLevel);
            setTimeout(() => setLevelUpFlash(null), 2200);
        }
    }

    function stopTimerAndComplete(id) {
        if (!activeTimer || activeTimer.taskId !== id) return;
        const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
        const bonus = timerBonusFor(elapsed);
        setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, timedSeconds: elapsed } : tk)));
        setActiveTimer(null);
        completeTask(id, bonus);
    }

    function cancelTimer() {
        setActiveTimer(null);
    }

    function removeTask(id) {
        setTasks((t) => t.filter((tk) => tk.id !== id));
    }

    function logScreenTime() {
        const mins = parseInt(screenTimeInput, 10);
        if (!mins || mins <= 0) return;
        const freeMinutes = 30;
        const overage = Math.max(0, mins - freeMinutes);
        const penalty = Math.round(overage / 2); // -1 xp per 2 min over 30
        setScreenTimeLog((l) => [{ id: uid(), minutes: mins, penalty, at: Date.now() }, ...l].slice(0, 60));
        setScreenTimeInput("");
    }

    function exportSave() {
        const payload = {
            saveVersion: 2,
            exportedAt: Date.now(),
            app: "questlog",
            data: { tasks, theme, aiMode, customProvider, screenTimeLog, activeTimer, soundEnabled },
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `questlog-save-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setImportStatus({ ok: true, msg: "Save file downloaded." });
    }

    function triggerImportPicker() {
        setImportStatus(null);
        fileInputRef.current?.click();
    }

    function handleImportFile(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const d = parsed.data || parsed;
                if (!Array.isArray(d.tasks)) throw new Error("Missing tasks array.");
                setTasks(d.tasks || []);
                setTheme(d.theme || "dark");
                setAiMode(d.aiMode || "builtin");
                setCustomProvider(d.customProvider || { endpoint: "", apiKey: "", model: "" });
                setScreenTimeLog(d.screenTimeLog || []);
                setActiveTimer(d.activeTimer || null);
                setSoundEnabled(d.soundEnabled !== false);
                setImportStatus({ ok: true, msg: `Loaded save (${(d.tasks || []).length} tasks).` });
            } catch (err) {
                setImportStatus({ ok: false, msg: "Couldn't read that file - is it a Questlog save?" });
            }
        };
        reader.onerror = () => setImportStatus({ ok: false, msg: "Couldn't read that file." });
        reader.readAsText(file);
    }

    function resetSave() {
        if (!window.confirm("Reset all Questlog data? This deletes every quest, badge progress, and setting. This can't be undone unless you've exported a save file.")) return;
        clearSavedState();
        setTasks([]);
        setTheme("dark");
        setAiMode("builtin");
        setCustomProvider({ endpoint: "", apiKey: "", model: "" });
        setScreenTimeLog([]);
        setActiveTimer(null);
        setSoundEnabled(true);
        setImportStatus({ ok: true, msg: "Everything reset." });
    }

    const active = tasks.filter((t) => !t.done);
    const completed = tasks.filter((t) => t.done).sort((a, b) => b.completedAt - a.completedAt);
    const badges = useMemo(() => buildBadges(tasks), [tasks]);
    const earnedBadgeCount = badges.filter((b) => b.earned).length;

    const themeObj = THEMES[theme] || THEMES.dark;
    const dark = themeObj.isDark;
    const colors = themeObj.colors;

    const catColor = (cat) => themeObj.catColors[cat] || themeObj.catColors.personal;

    const navItem = (id, label) => (
        <button
            className="ql-btn"
            onClick={() => { setView(id); setMenuOpen(false); }}
            style={{
                display: "block", width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 8,
                background: view === id ? colors.panel2 : "transparent", border: "none", color: colors.text,
                fontSize: 14.5, fontWeight: view === id ? 600 : 400, marginBottom: 4,
            }}
        >
            {label}
        </button>
    );

    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();
    const tasksByDay = useMemo(() => {
        const map = {};
        tasks.forEach((t) => {
            const k = dayKey(t.createdAt);
            map[k] = map[k] || [];
            map[k].push(t);
            if (t.done && t.completedAt && dayKey(t.completedAt) !== k) {
                const k2 = dayKey(t.completedAt);
                map[k2] = map[k2] || [];
                map[k2].push(t);
            }
        });
        return map;
    }, [tasks]);

    return (
        <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: colors.bg, color: colors.text, minHeight: "100vh", transition: "background 0.3s, color 0.3s" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        .ql-scroll::-webkit-scrollbar { width: 6px; }
        .ql-scroll::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 3px; }
        .ql-task { animation: ql-in 0.25s ease; }
        @keyframes ql-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ql-levelup { 0% { opacity: 0; transform: translate(-50%,-40%) scale(0.8);} 15% { opacity:1; transform: translate(-50%,-50%) scale(1);} 85% { opacity:1; } 100% { opacity: 0; transform: translate(-50%,-55%) scale(1);} }
        .ql-btn { cursor: pointer; border: none; font-family: inherit; }
        .ql-btn:active { transform: scale(0.97); }
        input, textarea, select { font-family: inherit; }
      `}</style>

            {levelUpFlash && (
                <div style={{ position: "fixed", top: "45%", left: "50%", zIndex: 50, animation: "ql-levelup 2.2s ease forwards", textAlign: "center", pointerEvents: "none" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 44, color: colors.amber, fontWeight: 600 }}>Level {levelUpFlash}</div>
                    <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1 }}>LEVEL UP</div>
                </div>
            )}

            {menuOpen && (
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: 240, height: "100%", background: colors.panel, borderRight: `1px solid ${colors.border}`, padding: 18 }}>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, marginBottom: 18 }}>Questlog</div>
                        {navItem("quests", "Quests")}
                        {navItem("completed", "Completed")}
                        {navItem("calendar", "Calendar")}
                        {navItem("badges", `Badges (${earnedBadgeCount}/${badges.length})`)}
                        {navItem("customization", "Customization")}
                        {navItem("settings", "Settings")}
                    </div>
                </div>
            )}

            <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button className="ql-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"
                            style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, width: 38, height: 38, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                        </button>
                        <div>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>
                                {{ quests: "Questlog", completed: "Completed", calendar: "Calendar", badges: "Badges", customization: "Customization", settings: "Settings" }[view]}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Level card - always visible */}
                <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: colors.amber }}>Lv {level}</div>
                            <div style={{ fontSize: 12.5, color: colors.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{into} / {need} xp</div>
                        </div>
                        <div style={{ fontSize: 12, color: colors.textDim }}>{totalXp} total xp</div>
                    </div>
                    <div style={{ height: 10, borderRadius: 6, background: colors.panel2, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colors.accentDim}, ${colors.accent})`, borderRadius: 6, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12.5, letterSpacing: 0.5, fontWeight: 600, color: colors.accent, textTransform: "uppercase" }}>{rank.name}</div>
                        <div style={{ fontSize: 11, color: colors.textDim }}>{nRank ? `${nRank.name} at Lv ${nRank.min}` : "Top rank reached"}</div>
                    </div>
                </div>

                {view === "quests" && (
                    <>
                        <div style={{ display: "flex", gap: 8, marginBottom: 22, position: "relative" }}>
                            <input
                                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask(false)}
                                placeholder="What needs doing? e.g. 'Finish history essay draft'"
                                style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 14, outline: "none" }}
                            />
                            <div style={{ display: "flex" }}>
                                <button className="ql-btn" onClick={() => addTask(false)}
                                    style={{ padding: "0 18px", borderRadius: "10px 0 0 10px", border: "none", background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 14 }}>Add</button>
                                <button className="ql-btn" onClick={() => setAddMenuOpen((o) => !o)} aria-label="Add options"
                                    style={{ padding: "0 10px", borderRadius: "0 10px 10px 0", border: "none", borderLeft: `1px solid ${dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)"}`, background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 11 }}>▾</button>
                            </div>
                            {addMenuOpen && (
                                <div onMouseLeave={() => setAddMenuOpen(false)}
                                    style={{ position: "absolute", top: 46, right: 0, zIndex: 20, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", minWidth: 210, overflow: "hidden" }}>
                                    <button className="ql-btn" onClick={() => addTask(false)}
                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", color: colors.text, fontSize: 13 }}>
                                        Add normally
                                    </button>
                                    <button className="ql-btn" disabled={!!activeTimer} onClick={() => addTask(true)}
                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderTop: `1px solid ${colors.border}`, color: activeTimer ? colors.textDim : colors.text, fontSize: 13, opacity: activeTimer ? 0.5 : 1 }}>
                                        ⏱ Add &amp; start focus stopwatch
                                        <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>+1 xp per 5 focused min, capped at +{TIMER_BONUS_CAP}</div>
                                    </button>
                                </div>
                            )}
                        </div>


                        {active.length === 0 && <div style={{ color: colors.textDim, fontSize: 13.5, padding: "10px 2px" }}>No open quests. Add one above to start earning xp.</div>}
                        {active.map((t) => {
                            const isTiming = activeTimer && activeTimer.taskId === t.id;
                            const elapsed = isTiming ? Math.floor((Date.now() - activeTimer.startedAt) / 1000) : 0;
                            const projectedBonus = isTiming ? timerBonusFor(elapsed) : 0;
                            return (
                                <div key={t.id} className="ql-task" style={{ display: "flex", alignItems: "center", gap: 12, background: colors.panel, border: `1px solid ${isTiming ? colors.accent : colors.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                                    {isTiming ? (
                                        <button className="ql-btn" onClick={() => stopTimerAndComplete(t.id)} disabled={t.pending} aria-label="Stop timer and complete"
                                            style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${colors.accent}`, background: t.pending ? "transparent" : colors.accent, flexShrink: 0, opacity: t.pending ? 0.4 : 1 }} />
                                    ) : (
                                        <button className="ql-btn" onClick={() => completeTask(t.id)} disabled={t.pending} aria-label="Complete task"
                                            style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${t.pending ? colors.border : colors.accent}`, background: "transparent", flexShrink: 0, opacity: t.pending ? 0.4 : 1 }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, marginBottom: 2 }}>{t.text}</div>
                                        <div style={{ fontSize: 11.5, color: t.pending ? colors.textDim : catColor(t.category) }}>
                                            {t.pending ? "Grading…" : `${CATS[t.category]?.label || "Task"} · ${t.reason}`}
                                        </div>
                                        {isTiming ? (
                                            <div style={{ fontSize: 11, color: colors.accent, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                                                ⏱ {fmtClock(elapsed)} running · +{projectedBonus} bonus so far
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>Added {fmtDateTime(t.createdAt)}</div>
                                        )}
                                    </div>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: t.pending ? colors.textDim : colors.amber, minWidth: 44, textAlign: "right" }}>
                                        {t.pending ? "…" : `+${t.exp}${isTiming ? `+${projectedBonus}` : ""}`}
                                    </div>
                                    {isTiming ? (
                                        <button className="ql-btn" onClick={cancelTimer} aria-label="Cancel timer" style={{ background: "transparent", color: colors.textDim, fontSize: 10.5, padding: "0 2px", whiteSpace: "nowrap" }}>cancel timer</button>
                                    ) : (
                                        <button className="ql-btn" onClick={() => removeTask(t.id)} aria-label="Remove task" style={{ background: "transparent", color: colors.textDim, fontSize: 16, padding: "0 2px" }}>×</button>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}

                {view === "completed" && (
                    <div>
                        {completed.length === 0 && <div style={{ color: colors.textDim, fontSize: 13.5 }}>Nothing completed yet.</div>}
                        {completed.map((t) => (
                            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontSize: 14, color: colors.textDim, textDecoration: "line-through" }}>{t.text}</div>
                                    <div style={{ fontSize: 11, color: colors.textDim, marginTop: 3 }}>
                                        Added {fmtDateTime(t.createdAt)} &middot; Completed {fmtDateTime(t.completedAt)}
                                        {t.timeBonus > 0 && <> &middot; ⏱ {fmtClock(t.timedSeconds)} focused</>}
                                    </div>
                                </div>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: catColor(t.category), fontSize: 13 }}>
                                    +{t.exp}{t.timeBonus > 0 && <span style={{ color: colors.accent }}> ({t.timeBonus} timed)</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {view === "calendar" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <button className="ql-btn" onClick={() => setCalMonth((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; })}
                                style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", color: colors.text }}>‹</button>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{new Date(calMonth.y, calMonth.m).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                            <button className="ql-btn" onClick={() => setCalMonth((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; })}
                                style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", color: colors.text }}>›</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: colors.textDim }}>{d}</div>)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const k = `${calMonth.y}-${calMonth.m}-${day}`;
                                const has = tasksByDay[k];
                                const selected = calSelected === k;
                                return (
                                    <button key={day} className="ql-btn" onClick={() => setCalSelected(selected ? null : k)}
                                        style={{ aspectRatio: "1", borderRadius: 8, border: `1px solid ${selected ? colors.accent : colors.border}`, background: has ? colors.panel2 : colors.panel, color: colors.text, fontSize: 12.5, position: "relative" }}>
                                        {day}
                                        {has && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: colors.accent }} />}
                                    </button>
                                );
                            })}
                        </div>
                        {calSelected && (
                            <div style={{ marginTop: 16 }}>
                                {(tasksByDay[calSelected] || []).map((t) => (
                                    <div key={t.id + (t.done ? "-c" : "")} style={{ padding: "8px 10px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                                        {t.text} {t.done ? <span style={{ color: colors.textDim }}>(completed)</span> : <span style={{ color: colors.textDim }}>(open)</span>}
                                    </div>
                                ))}
                                {!(tasksByDay[calSelected] || []).length && <div style={{ color: colors.textDim, fontSize: 13 }}>Nothing on this day.</div>}
                            </div>
                        )}
                    </div>
                )}

                {view === "customization" && (
                    <div>
                        <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 16, lineHeight: 1.6 }}>
                            Pick a color profile for the whole app.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                            {Object.entries(THEMES).map(([key, t]) => {
                                const selected = theme === key;
                                return (
                                    <button key={key} className="ql-btn" onClick={() => setTheme(key)}
                                        style={{
                                            textAlign: "left", padding: 14, borderRadius: 12,
                                            border: `2px solid ${selected ? t.colors.accent : colors.border}`,
                                            background: t.colors.bg,
                                        }}>
                                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                            <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.accent, display: "inline-block" }} />
                                            <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.amber, display: "inline-block" }} />
                                            <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.colors.panel2, border: `1px solid ${t.colors.border}`, display: "inline-block" }} />
                                        </div>
                                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: t.colors.text, marginBottom: 3 }}>{t.label}</div>
                                        <div style={{ fontSize: 11, color: t.colors.textDim }}>{selected ? "Active" : t.isDark ? "Dark" : "Light"}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === "badges" && (
                    <div>
                        <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 16, lineHeight: 1.6 }}>
                            Earned by staying consistent - {earnedBadgeCount} of {badges.length} unlocked. Badges track
                            completed tasks by keyword, separate from XP category, across six goal areas.
                        </div>
                        {Object.keys(BADGE_LABELS).map((category) => (
                            <div key={category} style={{ marginBottom: 22 }}>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    {BADGE_LABELS[category]}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                                    {badges.filter((b) => b.category === category).map((b) => (
                                        <div key={b.id} title={b.description}
                                            style={{
                                                background: b.earned ? colors.panel2 : colors.panel,
                                                border: `1px solid ${b.earned ? colors.accent : colors.border}`,
                                                borderRadius: 10, padding: "12px 12px", opacity: b.earned ? 1 : 0.7,
                                            }}>
                                            <div style={{ fontSize: 20, marginBottom: 4 }}>{b.earned ? "🏅" : "🔒"}</div>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: b.earned ? colors.accent : colors.text, marginBottom: 3 }}>{b.label}</div>
                                            <div style={{ fontSize: 10.5, color: colors.textDim, marginBottom: 6, lineHeight: 1.4 }}>{b.description}</div>
                                            {!b.earned && (
                                                <div style={{ height: 5, borderRadius: 3, background: colors.border, overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${Math.round((b.progress / b.target) * 100)}%`, background: colors.accentDim, borderRadius: 3 }} />
                                                </div>
                                            )}
                                            {!b.earned && <div style={{ fontSize: 10, color: colors.textDim, marginTop: 3 }}>{b.progress}/{b.target}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {view === "settings" && (
                    <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            {[["general", "General"], ["ai", "AI engine"], ["guided", "Guided hand"], ["screentime", "Screen time"], ["keywords", "Keywords"], ["dev", "Developer"], ["save", "Save file"]].map(([id, label]) => (
                                <button key={id} className="ql-btn" onClick={() => setSettingsSection(id)}
                                    style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${settingsSection === id ? colors.accent : colors.border}`, background: settingsSection === id ? colors.panel2 : "transparent", color: colors.text, fontSize: 12.5 }}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {settingsSection === "general" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Theme</div>
                                <div style={{ fontSize: 12.5, color: colors.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                                    Currently <strong style={{ color: colors.accent }}>{themeObj.label}</strong>. Color profiles have moved to
                                    <strong> Customization</strong> in the menu — open the ☰ menu and pick from four looks.
                                </div>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Sound effects</div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                                    {[{ id: true, label: "On" }, { id: false, label: "Off" }].map((opt) => (
                                        <button key={String(opt.id)} className="ql-btn" onClick={() => setSoundEnabled(opt.id)}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${soundEnabled === opt.id ? colors.accent : colors.border}`, background: soundEnabled === opt.id ? colors.panel2 : "transparent", color: colors.text, fontSize: 13 }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>XP curve</div>
                                <div style={{ fontSize: 12.5, color: colors.textDim, lineHeight: 1.6, marginBottom: 18 }}>
                                    Level 1 needs {xpToNext(1)} XP. Level 100 needs {xpToNext(100)} XP — about {Math.round((xpToNext(100) / xpToNext(1) - 1) * 100)}% more than level 1.
                                </div>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Ranks</div>
                                <div>
                                    {RANKS.map((r, i) => {
                                        const upper = RANKS[i + 1] ? RANKS[i + 1].min - 1 : null;
                                        const isCurrent = r.name === rank.name;
                                        return (
                                            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < RANKS.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                                                <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? colors.accent : colors.text }}>{isCurrent ? "→ " : ""}{r.name}</span>
                                                <span style={{ fontSize: 11.5, color: colors.textDim, fontFamily: "'JetBrains Mono', monospace" }}>Lv {r.min}{upper ? `–${upper}` : "+"}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {settingsSection === "ai" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                    {[{ id: "builtin", label: "Claude (built-in)" }, { id: "custom", label: "Custom AI" }, { id: "off", label: "Off (local rules)" }].map((opt) => (
                                        <button key={opt.id} className="ql-btn" onClick={() => setAiMode(opt.id)}
                                            style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${aiMode === opt.id ? colors.accent : colors.border}`, background: aiMode === opt.id ? colors.panel2 : "transparent", color: colors.text, fontSize: 12.5 }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {aiMode === "custom" && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: colors.panel2, padding: 12, borderRadius: 8 }}>
                                        <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 2 }}>Quick fill a preset, then paste your key:</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                                            {PROVIDER_PRESETS.map((p) => (
                                                <button key={p.name} className="ql-btn" onClick={() => setCustomProvider((prev) => ({ ...prev, endpoint: p.endpoint, model: p.model }))}
                                                    style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 11.5 }}>
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                        <input placeholder="Endpoint URL (OpenAI-compatible /chat/completions)" value={customProvider.endpoint}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, endpoint: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <input placeholder="Model name (e.g. gpt-4o-mini)" value={customProvider.model}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, model: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <input placeholder="API key (leave blank for Ollama/local)" type="password" value={customProvider.apiKey}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, apiKey: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.5 }}>
                                            Stored only in this app's saved data on this device
                                        </div>
                                    </div>
                                )}
                                {aiMode === "builtin" && <div style={{ fontSize: 11.5, color: colors.textDim, lineHeight: 1.5 }}>Every new task is sent to Claude to judge its category and XP value.</div>}
                            </div>
                        )}

                        {settingsSection === "guided" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                                    Every task the AI has judged so far — see exactly how it categorized and scored each one.
                                </div>
                                {tasks.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No tasks graded yet.</div>}
                                <div className="ql-scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
                                    {tasks.filter((t) => !t.pending).map((t) => (
                                        <div key={t.id} style={{ padding: "9px 0", borderBottom: `1px solid ${colors.border}` }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                                                <span>{t.text}</span>
                                                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: colors.amber }}>+{t.exp}</span>
                                            </div>
                                            <div style={{ fontSize: 11.5, color: catColor(t.category), marginTop: 2 }}>
                                                {CATS[t.category]?.label} · {t.reason}{t.timeBonus > 0 && ` · +${t.timeBonus} timed bonus`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {settingsSection === "screentime" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                                    Browsers can't read iPhone or Android screen-time data directly — there's no web API for it, and a
                                    future native companion app would be needed to pull it automatically. For now, log your social
                                    media minutes yourself below and it'll dock XP for time over 30 minutes a day (1 XP per 2 minutes
                                    over).
                                </div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                                    <input value={screenTimeInput} onChange={(e) => setScreenTimeInput(e.target.value)} type="number" placeholder="Minutes on social media today"
                                        style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 13.5 }} />
                                    <button className="ql-btn" onClick={logScreenTime} style={{ padding: "0 16px", borderRadius: 8, border: "none", background: colors.danger, color: "#fff", fontWeight: 600, fontSize: 13 }}>Log</button>
                                </div>
                                {screenTimeLog.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No screen time logged yet.</div>}
                                {screenTimeLog.map((l) => (
                                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
                                        <span style={{ color: colors.textDim }}>{fmtDateTime(l.at)} · {l.minutes} min</span>
                                        <span style={{ color: colors.danger, fontFamily: "'JetBrains Mono', monospace" }}>{l.penalty > 0 ? `-${l.penalty}` : "0"}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {settingsSection === "keywords" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                                    Every word the no-AI grading and badge systems watch for. Search to filter either list.
                                </div>
                                <input value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} placeholder="Filter keywords..."
                                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 13, marginBottom: 16 }} />

                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    XP grading keywords ({KEYWORD_XP_TABLE.length})
                                </div>
                                {Object.keys(CATS).map((cat) => {
                                    const rows = KEYWORD_XP_TABLE.filter((k) => k.category === cat && k.word.includes(keywordFilter.toLowerCase()));
                                    if (rows.length === 0) return null;
                                    return (
                                        <div key={cat} style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: catColor(cat), marginBottom: 4 }}>{CATS[cat].label}</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {rows.map((k) => (
                                                    <span key={k.word} style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: colors.panel2, border: `1px solid ${colors.border}`, color: colors.text, fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {k.word} <span style={{ color: colors.amber }}>+{k.exp}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                <div style={{ fontSize: 12, color: colors.textDim, margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    Badge tracking keywords
                                </div>
                                {Object.keys(BADGE_LABELS).map((cat) => {
                                    const rows = BADGE_KEYWORDS[cat].filter((w) => w.includes(keywordFilter.toLowerCase()));
                                    if (rows.length === 0) return null;
                                    return (
                                        <div key={cat} style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.accent, marginBottom: 4 }}>{BADGE_LABELS[cat]}</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {rows.map((w) => (
                                                    <span key={w} style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: colors.panel2, border: `1px solid ${colors.border}`, color: colors.text, fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {w}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {settingsSection === "dev" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 14, lineHeight: 1.6 }}>
                                    Raw diagnostics for debugging - not needed for normal use.
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                                    {[
                                        ["Total tasks", tasks.length],
                                        ["Active", active.length],
                                        ["Completed", completed.length],
                                        ["Badges earned", `${earnedBadgeCount} / ${badges.length}`],
                                        ["Level", level],
                                        ["Total XP", totalXp],
                                        ["Theme", themeObj.label],
                                        ["AI mode", aiMode],
                                    ].map(([label, val]) => (
                                        <div key={label} style={{ background: colors.panel2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px" }}>
                                            <div style={{ fontSize: 10.5, color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                                            <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: colors.text }}>{String(val)}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Storage keys</div>
                                <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: colors.textDim, marginBottom: 16, lineHeight: 1.7 }}>
                                    {STORAGE_KEY} (primary)<br />{STORAGE_BACKUP_KEY} (backup)
                                </div>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Raw save payload</div>
                                <pre className="ql-scroll" style={{ maxHeight: 240, overflow: "auto", background: colors.panel2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, fontSize: 10.5, color: colors.textDim, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                    {JSON.stringify({ tasks, theme, aiMode, customProvider: { ...customProvider, apiKey: customProvider.apiKey ? "***" : "" }, screenTimeLog, activeTimer, soundEnabled }, null, 2)}
                                </pre>
                            </div>
                        )}

                        {settingsSection === "save" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 16, lineHeight: 1.6 }}>
                                    Everything - quests, completed history, badge progress, screen time log, theme, and
                                    AI settings - lives in one save file. Export it to back it up or move it to another
                                    device; import to restore it. Progress also autosaves to this browser continuously,
                                    with a redundant backup copy in case one write gets interrupted.
                                </div>

                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Export</div>
                                <button className="ql-btn" onClick={exportSave}
                                    style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 13.5, marginBottom: 20 }}>
                                    ⬇ Download save file
                                </button>

                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Import</div>
                                <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
                                <button className="ql-btn" onClick={triggerImportPicker}
                                    style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontWeight: 600, fontSize: 13.5, marginBottom: 20 }}>
                                    ⬆ Choose save file to import
                                </button>
                                <div style={{ fontSize: 11, color: colors.textDim, marginTop: -12, marginBottom: 20, lineHeight: 1.5 }}>
                                    Importing replaces everything currently in the app - export a backup first if you want to keep it.
                                </div>

                                <div style={{ fontSize: 12, color: colors.danger, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Reset</div>
                                <button className="ql-btn" onClick={resetSave}
                                    style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: `1px solid ${colors.danger}`, background: "transparent", color: colors.danger, fontWeight: 600, fontSize: 13.5 }}>
                                    🗑 Reset all data
                                </button>
                                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 8, lineHeight: 1.5 }}>
                                    Wipes every quest, badge, and setting on this device. Asks for confirmation first and can't be undone.
                                </div>

                                {importStatus && (
                                    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: importStatus.ok ? colors.panel2 : "transparent", border: `1px solid ${importStatus.ok ? colors.accent : colors.danger}`, color: importStatus.ok ? colors.accent : colors.danger, fontSize: 12.5 }}>
                                        {importStatus.msg}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}