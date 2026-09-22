import { CATS, heuristicGrade } from "./grading.js";

/* ---------- AI provider presets ---------- */
// One-click fills for popular OpenAI-compatible endpoints, so connecting a
// custom AI is "pick a name, paste a key" instead of hunting down a URL.
// True "log in with your AI account" OAuth isn't possible from a static
// front-end (it needs a backend to hold the client secret), so this is the
// closest practical shortcut without standing up a server.
export const PROVIDER_PRESETS = [
    { name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
    { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
    { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
    { name: "Ollama (local)", endpoint: "http://localhost:11434/v1/chat/completions", model: "llama3.1" },
];

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

export async function gradeTask(text, aiMode, customProvider) {
    try {
        if (aiMode === "builtin") return await claudeGrade(text);
        if (aiMode === "custom" && customProvider.endpoint) return await customGrade(text, customProvider);
        return heuristicGrade(text);
    } catch {
        const fb = heuristicGrade(text);
        return { ...fb, reason: fb.reason + " (AI unavailable)" };
    }
}
