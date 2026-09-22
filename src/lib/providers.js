import { CATS, heuristicGrade } from "./grading.js";

/* ---------- AI providers ---------- */
// Questlog is not tied to one AI vendor. Each provider is either the
// Anthropic Messages API or an OpenAI-compatible /chat/completions endpoint
// (which covers OpenAI, Gemini, OpenRouter, Groq, Ollama and most others).
// API keys are only ever typed in by the user in Settings and kept in this
// device's local save - nothing is hardcoded or bundled into the build.
export const PROVIDERS = {
    anthropic: {
        label: "Anthropic (Claude)", kind: "anthropic",
        endpoint: "https://api.anthropic.com/v1/messages", defaultModel: "claude-haiku-4-5",
        keyRequired: true, keyHelp: "console.anthropic.com → API keys",
    },
    openai: {
        label: "OpenAI", kind: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4o-mini",
        keyRequired: true, keyHelp: "platform.openai.com → API keys",
    },
    gemini: {
        label: "Google Gemini", kind: "openai",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", defaultModel: "gemini-2.5-flash",
        keyRequired: true, keyHelp: "aistudio.google.com → Get API key",
    },
    openrouter: {
        label: "OpenRouter", kind: "openai",
        endpoint: "https://openrouter.ai/api/v1/chat/completions", defaultModel: "openai/gpt-4o-mini",
        keyRequired: true, keyHelp: "openrouter.ai → Keys",
    },
    groq: {
        label: "Groq", kind: "openai",
        endpoint: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.1-8b-instant",
        keyRequired: true, keyHelp: "console.groq.com → API keys",
    },
    ollama: {
        label: "Ollama (local)", kind: "openai",
        endpoint: "http://localhost:11434/v1/chat/completions", defaultModel: "llama3.1",
        keyRequired: false, keyHelp: "No key needed - runs on your own machine.",
    },
    custom: {
        label: "Custom (OpenAI-compatible)", kind: "openai",
        endpoint: "", defaultModel: "", editableEndpoint: true,
        keyRequired: false, keyHelp: "Any /chat/completions endpoint.",
    },
};

export const OFF = "off";

export const DEFAULT_AI = { provider: OFF, configs: {} };

// Older saves stored `aiMode` ("builtin" | "custom" | "off") plus a single
// `customProvider`. "builtin" relied on a keyless Claude call that only
// worked inside claude.ai, so it maps to the Anthropic provider (which now
// asks for the user's own key).
export function migrateAiSettings(saved) {
    if (saved?.ai?.provider) return { provider: saved.ai.provider, configs: saved.ai.configs || {} };
    const configs = {};
    if (saved?.customProvider?.endpoint || saved?.customProvider?.apiKey) configs.custom = { ...saved.customProvider };
    const provider = saved?.aiMode === "builtin" ? "anthropic" : saved?.aiMode === "custom" ? "custom" : OFF;
    return { provider, configs };
}

export function resolveProvider(ai) {
    const def = PROVIDERS[ai?.provider];
    if (!def) return null;
    const cfg = ai.configs?.[ai.provider] || {};
    return {
        id: ai.provider,
        ...def,
        endpoint: (def.editableEndpoint ? cfg.endpoint : def.endpoint) || "",
        model: cfg.model || def.defaultModel,
        apiKey: cfg.apiKey || "",
    };
}

// Why a selected provider can't be used right now, or null if it's ready.
export function providerProblem(p) {
    if (!p) return null;
    if (!p.endpoint) return "Add an endpoint URL in Settings → AI engine.";
    if (!p.model) return "Add a model name in Settings → AI engine.";
    if (p.keyRequired && !p.apiKey) return `Add your ${p.label} API key in Settings → AI engine.`;
    return null;
}

// Settings export / developer view must never leak keys.
export function redactAi(ai) {
    const configs = {};
    for (const [id, cfg] of Object.entries(ai.configs || {})) configs[id] = { ...cfg, apiKey: cfg.apiKey ? "***" : "" };
    return { ...ai, configs };
}
export function stripAiKeys(ai) {
    const configs = {};
    for (const [id, cfg] of Object.entries(ai.configs || {})) configs[id] = { ...cfg, apiKey: "" };
    return { ...ai, configs };
}

const SYSTEM_PROMPT =
    `You grade to-do tasks for a gamified to-do app by difficulty and importance. ` +
    `Respond with ONLY raw JSON, no markdown: {"category":"mundane|personal|work|epic","exp":<integer>,"reason":"<under 12 words>"}.\n` +
    `Categories and XP ranges:\n` +
    Object.entries(CATS).map(([id, c]) => `- ${id} (${c.label}): ${c.range[0]}-${c.range[1]} xp`).join("\n") + `\n` +
    `mundane = everyday chores and errands; personal = self-care, health, hobbies, relationships; ` +
    `work = job or school work; epic = rare, major life goals. Within a range, score higher for more effort, stakes and importance.`;

// Pull the first JSON object out of a model reply and normalise it: unknown
// categories become "personal" and XP is clamped into the category's range
// so a chore can never out-earn schoolwork.
export function parseGrade(raw) {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in AI reply");
    const parsed = JSON.parse(match[0]);
    const category = CATS[parsed.category] ? parsed.category : "personal";
    const [lo, hi] = CATS[category].range;
    const n = Math.round(Number(parsed.exp));
    const exp = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : Math.round((lo + hi) / 2);
    const reason = String(parsed.reason || "").trim().slice(0, 120) || "Graded by AI.";
    return { category, exp, reason };
}

async function callAnthropic(p, text) {
    const res = await fetch(p.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": p.apiKey,
            "anthropic-version": "2023-06-01",
            // Required for calls made straight from a browser with the user's own key.
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model: p.model,
            max_tokens: 200,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: `Task: "${text}"` }],
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("");
}

async function callOpenAiCompatible(p, text) {
    const res = await fetch(p.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: p.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Task: "${text}"` },
            ],
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
}

// Grade with the selected provider, falling back to the keyword rules if
// none is configured or the call fails. The result records who graded it so
// the Guided hand view can show it.
export async function gradeTask(text, ai) {
    const gradedAt = Date.now();
    const p = resolveProvider(ai);
    if (!p) return { ...heuristicGrade(text), gradedBy: "Local rules", gradedAt };
    const problem = providerProblem(p);
    if (problem) {
        const fb = heuristicGrade(text);
        return { ...fb, reason: `${fb.reason} ${problem}`, gradedBy: "Local rules (AI not set up)", gradedAt };
    }
    try {
        const raw = p.kind === "anthropic" ? await callAnthropic(p, text) : await callOpenAiCompatible(p, text);
        return { ...parseGrade(raw), gradedBy: `${p.label} · ${p.model}`, gradedAt };
    } catch (e) {
        const fb = heuristicGrade(text);
        return { ...fb, reason: `${fb.reason} (${p.label} failed: ${e.message})`, gradedBy: "Local rules (AI fallback)", gradedAt };
    }
}
