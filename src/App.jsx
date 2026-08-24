import React, { useState, useEffect, useCallback, useMemo } from "react";

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

function heuristicGrade(text) {
    const t = text.toLowerCase();
    const workWords = ["exam", "project", "deadline", "meeting", "report", "assignment", "study", "presentation", "client", "thesis", "interview", "shift", "boss", "submit", "class", "homework", "essay"];
    const epicWords = ["launch", "finish book", "marathon", "certification", "move out", "quit", "start business", "degree", "publish"];
    const mundaneWords = ["dishes", "laundry", "trash", "clean", "vacuum", "shower", "brush", "tidy", "groceries", "dust"];
    let cat = "personal";
    if (epicWords.some((w) => t.includes(w))) cat = "epic";
    else if (workWords.some((w) => t.includes(w))) cat = "work";
    else if (mundaneWords.some((w) => t.includes(w))) cat = "mundane";
    const [lo, hi] = CATS[cat].range;
    const lengthBoost = Math.min(10, Math.floor(text.length / 20));
    const exp = Math.min(100, Math.round(lo + Math.random() * (hi - lo) + lengthBoost));
    return { category: cat, exp, reason: "Estimated locally (no AI connected)." };
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
    const [settingsSection, setSettingsSection] = useState("general"); // general | ai | guided | screentime
    const [activeTimer, setActiveTimer] = useState(null); // { taskId, startedAt }
    const [tick, setTick] = useState(0); // forces re-render each second while a timer runs
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const raw = localStorage.getItem("questlog-state");
                if (raw) {
                    const s = JSON.parse(raw);
                    setTasks(s.tasks || []);
                    setTheme(s.theme || "dark");
                    setAiMode(s.aiMode || "builtin");
                    setCustomProvider(s.customProvider || { endpoint: "", apiKey: "", model: "" });
                    setScreenTimeLog(s.screenTimeLog || []);
                    setActiveTimer(s.activeTimer || null);
                }
            } catch (e) { }
            setLoaded(true);
        })();
    }, []);

    useEffect(() => {
        if (!activeTimer) return;
        const iv = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(iv);
    }, [activeTimer]);

    useEffect(() => {
        if (!loaded) return;
        const s = { tasks, theme, aiMode, customProvider, screenTimeLog, activeTimer };
        try {
            localStorage.setItem("questlog-state", JSON.stringify(s));
        } catch (e) { }
    }, [tasks, theme, aiMode, customProvider, screenTimeLog, activeTimer, loaded]);

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

    const active = tasks.filter((t) => !t.done);
    const completed = tasks.filter((t) => t.done).sort((a, b) => b.completedAt - a.completedAt);

    const dark = theme === "dark";
    const colors = dark
        ? { bg: "#12141a", panel: "#1a1d26", panel2: "#20242f", border: "#2c3140", text: "#e8e6df", textDim: "#8b8f9e", accent: "#5ec8a8", accentDim: "#3a8f77", amber: "#e0a940", danger: "#d9614f" }
        : { bg: "#f4f1ea", panel: "#ffffff", panel2: "#ece7db", border: "#ddd5c2", text: "#26241d", textDim: "#767061", accent: "#1d7a5f", accentDim: "#2f9f7c", amber: "#b5780f", danger: "#b8402f" };

    const catColor = (cat) => {
        const map = dark
            ? { mundane: "#8b8f9e", personal: "#5ec8a8", work: "#e0836a", epic: "#e0a940" }
            : { mundane: "#767061", personal: "#1d7a5f", work: "#b5502f", epic: "#b5780f" };
        return map[cat] || map.personal;
    };

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
                                {{ quests: "Questlog", completed: "Completed", calendar: "Calendar", settings: "Settings" }[view]}
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
                                        ⏱ Add &amp; start focus timer
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

                {view === "settings" && (
                    <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            {[["general", "General"], ["ai", "AI engine"], ["guided", "Guided hand"], ["screentime", "Screen time"]].map(([id, label]) => (
                                <button key={id} className="ql-btn" onClick={() => setSettingsSection(id)}
                                    style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${settingsSection === id ? colors.accent : colors.border}`, background: settingsSection === id ? colors.panel2 : "transparent", color: colors.text, fontSize: 12.5 }}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {settingsSection === "general" && (
                            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
                                <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Theme</div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                                    {["light", "dark"].map((tm) => (
                                        <button key={tm} className="ql-btn" onClick={() => setTheme(tm)}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${theme === tm ? colors.accent : colors.border}`, background: theme === tm ? colors.panel2 : "transparent", color: colors.text, fontSize: 13, textTransform: "capitalize" }}>
                                            {tm}
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
                                        <input placeholder="Endpoint URL (OpenAI-compatible /chat/completions)" value={customProvider.endpoint}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, endpoint: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <input placeholder="Model name (e.g. gpt-4o-mini)" value={customProvider.model}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, model: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <input placeholder="API key" type="password" value={customProvider.apiKey}
                                            onChange={(e) => setCustomProvider((p) => ({ ...p, apiKey: e.target.value }))}
                                            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5 }} />
                                        <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.5 }}>Stored only in this app's saved data on this device, in plain text.</div>
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
                    </div>
                )}
            </div>
        </div>
    );
}