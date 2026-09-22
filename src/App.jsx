import { useState, useEffect, useMemo, useRef } from "react";
import { THEMES } from "./lib/themes.js";
import { levelInfo, rankFor, nextRank, timerBonusFor } from "./lib/xp.js";
import { gradeTask, migrateAiSettings, redactAi, stripAiKeys, resolveProvider, providerProblem, DEFAULT_AI } from "./lib/providers.js";
import { buildBadges } from "./lib/badges.js";
import { totalAdjustment, screenTimePenalty } from "./lib/xpAdjustments.js";
import { uid } from "./lib/dates.js";
import { playCreateDing, playCompleteDing } from "./lib/sound.js";
import { DEFAULT_PUSH, buildPushSnapshot, syncPush, refreshSubscription, disablePush } from "./lib/push.js";
import { loadSavedState, saveState, clearSavedState, loadNewerIdbState } from "./lib/storage.js";
import { ThemeCtx, SERIF } from "./components/theme.js";
import LevelCard from "./components/LevelCard.jsx";
import MenuDrawer from "./components/MenuDrawer.jsx";
import QuestsView from "./components/QuestsView.jsx";
import CompletedView from "./components/CompletedView.jsx";
import CalendarView from "./components/CalendarView.jsx";
import CustomizationView from "./components/CustomizationView.jsx";
import BadgesView from "./components/BadgesView.jsx";
import SettingsView from "./components/SettingsView.jsx";
import WeeklySummaryView from "./components/WeeklySummaryView.jsx";
import GeneralSettings from "./components/settings/GeneralSettings.jsx";
import AiSettings from "./components/settings/AiSettings.jsx";
import GuidedHandSettings from "./components/settings/GuidedHandSettings.jsx";
import ScreenTimeSettings from "./components/settings/ScreenTimeSettings.jsx";
import KeywordsSettings from "./components/settings/KeywordsSettings.jsx";
import DeveloperSettings from "./components/settings/DeveloperSettings.jsx";
import SaveFileSettings from "./components/settings/SaveFileSettings.jsx";
import NotificationsSettings from "./components/settings/NotificationsSettings.jsx";

const VIEW_TITLES = { quests: "Questlog", summary: "Weekly summary", completed: "Completed tasks", calendar: "Calendar", badges: "Badges", customization: "Customization", settings: "Settings" };

export default function QuestLog() {
    // Read the save once, synchronously, so every piece of state starts from it.
    const [saved] = useState(() => loadSavedState() || {});
    const [theme, setTheme] = useState(saved.theme || "dark");
    const [tasks, setTasks] = useState(saved.tasks || []);
    const [ai, setAi] = useState(() => migrateAiSettings(saved));
    const [notes, setNotes] = useState(saved.notes || []); // calendar notes: { id, text, createdAt }
    const [screenTimeLog, setScreenTimeLog] = useState(saved.screenTimeLog || []);
    const [activeTimer, setActiveTimer] = useState(saved.activeTimer || null); // { taskId, startedAt }
    const [soundEnabled, setSoundEnabled] = useState(saved.soundEnabled !== false);
    const [push, setPush] = useState(() => ({ ...DEFAULT_PUSH, ...(saved.push || {}), serverUrl: saved.push?.serverUrl || DEFAULT_PUSH.serverUrl }));
    const [pushLost, setPushLost] = useState(false);
    // Notifications deep-link with ?view=summary etc.
    const [view, setView] = useState(() => {
        const v = new URLSearchParams(window.location.search).get("view");
        return v && VIEW_TITLES[v] ? v : "quests";
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const [levelUpFlash, setLevelUpFlash] = useState(null);
    const [importStatus, setImportStatus] = useState(null); // { ok, msg } | null
    const [now, setNow] = useState(() => Date.now());

    // Clock for timers and due-date checks: every second while a timer runs,
    // otherwise every 30s.
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), activeTimer ? 1000 : 30000);
        return () => clearInterval(iv);
    }, [activeTimer]);

    // If IndexedDB holds a newer save than localStorage (evicted or lost
    // write), restore it once on startup.
    const savedAt = saved.savedAt || 0;
    useEffect(() => {
        let cancelled = false;
        loadNewerIdbState(savedAt).then((s) => { if (s && !cancelled) applyState(s); });
        return () => { cancelled = true; };
    }, [savedAt]);

    const snapshot = { tasks, notes, theme, ai, screenTimeLog, activeTimer, soundEnabled, push };
    useEffect(() => {
        saveState({ tasks, notes, theme, ai, screenTimeLog, activeTimer, soundEnabled, push });
    }, [tasks, notes, theme, ai, screenTimeLog, activeTimer, soundEnabled, push]);

    // Push: on open, hand the worker this device's current subscription
    // (browsers can rotate it), then keep its quest snapshot fresh. Syncs
    // are debounced so a burst of edits is one write to the worker's KV.
    const pushSnapshotJson = useMemo(() => {
        const data = buildPushSnapshot(tasks, now);
        delete data.generatedAt; // compare content only
        return JSON.stringify(data);
    }, [tasks, now]);
    const lastSynced = useRef(null);
    useEffect(() => {
        if (!push.id || !push.serverUrl) return;
        refreshSubscription(push.serverUrl, push.id)
            .then((ok) => setPushLost(!ok))
            .catch((e) => { if (e.status === 404) setPushLost(true); });
    }, [push.id, push.serverUrl]);
    useEffect(() => {
        if (!push.id || !push.serverUrl || lastSynced.current === pushSnapshotJson) return;
        const send = (opts) => {
            lastSynced.current = pushSnapshotJson;
            syncPush(push.serverUrl, push.id, { snapshot: { ...JSON.parse(pushSnapshotJson), generatedAt: Date.now() } }, opts)
                .catch((e) => { lastSynced.current = null; if (e.status === 404) setPushLost(true); });
        };
        const timer = setTimeout(send, 10000);
        // Flush right away if the app is being backgrounded/closed.
        const onHide = () => { if (document.visibilityState === "hidden") { clearTimeout(timer); send({ keepalive: true }); } };
        document.addEventListener("visibilitychange", onHide);
        return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onHide); };
    }, [pushSnapshotJson, push.id, push.serverUrl]);

    // Imported saves carry no API keys, so keep the ones already on this device.
    function applyState(d, { keepKeys = false } = {}) {
        setTasks(d.tasks || []);
        setNotes(d.notes || []);
        setTheme(d.theme || "dark");
        const nextAi = d.ai || d.aiMode ? migrateAiSettings(d) : DEFAULT_AI;
        setAi((cur) => {
            if (!keepKeys) return nextAi;
            const configs = { ...nextAi.configs };
            for (const [id, cfg] of Object.entries(cur.configs)) configs[id] = { ...configs[id], apiKey: configs[id]?.apiKey || cfg.apiKey };
            return { ...nextAi, configs };
        });
        setScreenTimeLog(d.screenTimeLog || []);
        setActiveTimer(d.activeTimer || null);
        setSoundEnabled(d.soundEnabled !== false);
    }

    const totalXp = useMemo(() => {
        const earned = tasks.filter((t) => t.done).reduce((s, t) => s + (t.exp || 0), 0);
        return Math.max(0, earned + totalAdjustment({ screenTimeLog }));
    }, [tasks, screenTimeLog]);

    const { level, into, need } = levelInfo(totalXp);
    const rank = rankFor(level);
    const nRank = nextRank(level);

    async function addTask(text, { startTimer, dueAt }) {
        if (soundEnabled) playCreateDing();
        const id = uid();
        const draft = { id, text, exp: null, category: null, reason: "", done: false, pending: true, createdAt: Date.now(), dueAt: dueAt || null, completedAt: null, timeBonus: 0, timedSeconds: 0 };
        setTasks((t) => [draft, ...t]);
        if (startTimer) setActiveTimer({ taskId: id, startedAt: Date.now() });
        const result = await gradeTask(text, ai);
        setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, ...result, pending: false } : tk)));
    }

    async function regradeTask(id) {
        const task = tasks.find((t) => t.id === id);
        if (!task || task.done) return;
        setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, pending: true } : tk)));
        const result = await gradeTask(task.text, ai);
        setTasks((t) => t.map((tk) => (tk.id === id ? { ...tk, ...result, pending: false } : tk)));
    }

    function completeTask(id, bonus, timedSeconds) {
        const task = tasks.find((t) => t.id === id);
        if (!task || task.done || task.pending) return;
        if (soundEnabled) playCompleteDing();
        const timeBonus = bonus || 0;
        const prevLevel = levelInfo(totalXp).level;
        const nextTotal = totalXp + (task.exp || 0) + timeBonus;
        setTasks((t) => t.map((tk) => (tk.id === id
            ? { ...tk, done: true, completedAt: Date.now(), exp: (tk.exp || 0) + timeBonus, timeBonus, timedSeconds: timedSeconds ?? tk.timedSeconds }
            : tk)));
        const newLevel = levelInfo(nextTotal).level;
        if (newLevel > prevLevel) {
            setLevelUpFlash(newLevel);
            setTimeout(() => setLevelUpFlash(null), 2200);
        }
    }

    function stopTimerAndComplete(id) {
        if (!activeTimer || activeTimer.taskId !== id) return;
        const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
        setActiveTimer(null);
        completeTask(id, timerBonusFor(elapsed), elapsed);
    }

    function removeTask(id) {
        setTasks((t) => t.filter((tk) => tk.id !== id));
        if (activeTimer?.taskId === id) setActiveTimer(null);
    }

    function addNote(text, createdAt) {
        setNotes((n) => [...n, { id: uid(), text, createdAt }]);
    }

    function logScreenTime(mins) {
        const penalty = screenTimePenalty(mins);
        setScreenTimeLog((l) => [{ id: uid(), minutes: mins, penalty, at: Date.now() }, ...l].slice(0, 60));
    }

    function exportSave() {
        // Keys and this device's push subscription id stay on this device.
        const payload = { saveVersion: 3, exportedAt: Date.now(), app: "questlog", data: { ...snapshot, ai: stripAiKeys(ai), push: { ...push, id: null } } };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `questlog-save-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setImportStatus({ ok: true, msg: "Save file downloaded." });
    }

    function importSave(file) {
        setImportStatus(null);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const d = parsed.data || parsed;
                if (!Array.isArray(d.tasks)) throw new Error("Missing tasks array.");
                applyState(d, { keepKeys: true });
                setImportStatus({ ok: true, msg: `Loaded save (${d.tasks.length} tasks).` });
            } catch {
                setImportStatus({ ok: false, msg: "Couldn't read that file - is it a Questlog save?" });
            }
        };
        reader.onerror = () => setImportStatus({ ok: false, msg: "Couldn't read that file." });
        reader.readAsText(file);
    }

    function resetSave() {
        if (!window.confirm("Reset all Questlog data? This deletes every quest, badge progress, and setting. This can't be undone unless you've exported a save file.")) return;
        clearSavedState();
        disablePush(push.serverUrl, push.id);
        setPush({ ...DEFAULT_PUSH });
        applyState({});
        setImportStatus({ ok: true, msg: "Everything reset." });
    }

    const provider = resolveProvider(ai);
    const aiNotice = !provider
        ? "Grading with local keyword rules. Connect an AI in Settings → AI engine."
        : providerProblem(provider) ? `AI grading paused: ${providerProblem(provider)}` : null;

    const active = tasks.filter((t) => !t.done);
    const completed = tasks.filter((t) => t.done).sort((a, b) => b.completedAt - a.completedAt);
    const badges = useMemo(() => buildBadges(tasks), [tasks]);
    const earnedBadgeCount = badges.filter((b) => b.earned).length;

    const themeObj = THEMES[theme] || THEMES.dark;
    const colors = themeObj.colors;
    // Keep the page behind the app (overscroll, status bar) on-theme.
    useEffect(() => {
        document.body.style.background = colors.bg;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.bg);
    }, [colors.bg]);

    const ui = useMemo(() => ({
        colors: themeObj.colors,
        dark: themeObj.isDark,
        catColor: (cat) => themeObj.catColors[cat] || themeObj.catColors.personal,
    }), [themeObj]);

    const menuItems = [
        ["quests", "Questlog"],
        ["summary", "Weekly summary"],
        ["completed", "Completed tasks"],
        ["calendar", "Calendar"],
        ["badges", `Badges (${earnedBadgeCount}/${badges.length})`],
        ["customization", "Customization"],
        ["settings", "Settings"],
    ];

    const settingsSections = [
        { id: "general", label: "General", render: () => <GeneralSettings themeLabel={themeObj.label} soundEnabled={soundEnabled} onSetSound={setSoundEnabled} rank={rank} /> },
        { id: "ai", label: "AI engine", render: () => <AiSettings ai={ai} onSetAi={setAi} /> },
        { id: "notifications", label: "Notifications", render: () => <NotificationsSettings push={push} onSetPush={setPush} tasks={tasks} lost={pushLost} /> },
        { id: "guided", label: "Guided hand", render: () => <GuidedHandSettings tasks={tasks} onRegrade={regradeTask} /> },
        { id: "screentime", label: "Screen time", render: () => <ScreenTimeSettings screenTimeLog={screenTimeLog} onLog={logScreenTime} /> },
        { id: "keywords", label: "Keywords", render: () => <KeywordsSettings /> },
        {
            id: "dev", label: "Developer", render: () => (
                <DeveloperSettings
                    stats={[["Total tasks", tasks.length], ["Active", active.length], ["Completed", completed.length], ["Notes", notes.length], ["Badges earned", `${earnedBadgeCount} / ${badges.length}`], ["Level", level], ["Total XP", totalXp], ["Theme", themeObj.label], ["AI provider", resolveProvider(ai)?.label || "Off"]]}
                    payload={{ ...snapshot, ai: redactAi(ai), push: { ...push, id: push.id ? "***" : null } }} />
            ),
        },
        { id: "save", label: "Save file", render: () => <SaveFileSettings onExport={exportSave} onImportFile={importSave} onReset={resetSave} status={importStatus} /> },
    ];

    return (
        <ThemeCtx.Provider value={ui}>
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
                        <div style={{ fontFamily: SERIF, fontSize: 44, color: colors.amber, fontWeight: 600 }}>Level {levelUpFlash}</div>
                        <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1 }}>LEVEL UP</div>
                    </div>
                )}

                {menuOpen && <MenuDrawer items={menuItems} view={view} onSelect={(id) => { setView(id); setMenuOpen(false); }} onClose={() => setMenuOpen(false)} />}

                <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 80px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                        <button className="ql-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"
                            style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8, width: 38, height: 38, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 3 }}>
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                            <span style={{ width: 16, height: 2, background: colors.text, borderRadius: 1 }} />
                        </button>
                        <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>{VIEW_TITLES[view]}</div>
                    </div>

                    <LevelCard totalXp={totalXp} level={level} into={into} need={need} rank={rank} nRank={nRank} />

                    {view === "quests" && (
                        <QuestsView tasks={active} activeTimer={activeTimer} now={now} aiNotice={aiNotice} onAdd={addTask} onComplete={(id) => completeTask(id)}
                            onStopTimer={stopTimerAndComplete} onCancelTimer={() => setActiveTimer(null)} onRemove={removeTask} />
                    )}
                    {view === "summary" && <WeeklySummaryView tasks={tasks} now={now} />}
                    {view === "completed" && <CompletedView tasks={completed} />}
                    {view === "calendar" && <CalendarView tasks={tasks} notes={notes} now={now} onAddNote={addNote} onDeleteNote={(id) => setNotes((n) => n.filter((x) => x.id !== id))} />}
                    {view === "customization" && <CustomizationView theme={theme} onSetTheme={setTheme} />}
                    {view === "badges" && <BadgesView badges={badges} />}
                    {view === "settings" && <SettingsView sections={settingsSections} />}
                </div>
            </div>
        </ThemeCtx.Provider>
    );
}
