import { describe, it, expect, vi, afterEach } from "vitest";
import { parseGrade, migrateAiSettings, gradeTask, stripAiKeys, redactAi, OFF } from "../providers.js";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(body, ok = true, status = 200) {
    const fn = vi.fn(async () => ({ ok, status, json: async () => body }));
    vi.stubGlobal("fetch", fn);
    return fn;
}

describe("parseGrade", () => {
    it("extracts JSON even when wrapped in prose or fences", () => {
        const g = parseGrade('Sure!\n```json\n{"category":"work","exp":50,"reason":"School essay"}\n```');
        expect(g).toEqual({ category: "work", exp: 50, reason: "School essay" });
    });

    it("clamps XP into the category range and repairs unknown categories", () => {
        expect(parseGrade('{"category":"mundane","exp":90,"reason":"x"}').exp).toBe(15);
        expect(parseGrade('{"category":"bogus","exp":1,"reason":"x"}')).toMatchObject({ category: "personal", exp: 15 });
    });

    it("throws when there is no JSON", () => {
        expect(() => parseGrade("no idea")).toThrow();
    });
});

describe("migrateAiSettings", () => {
    it("maps the old keyless built-in Claude mode to the Anthropic provider", () => {
        expect(migrateAiSettings({ aiMode: "builtin" })).toEqual({ provider: "anthropic", configs: {} });
    });

    it("keeps an old custom provider", () => {
        const m = migrateAiSettings({ aiMode: "custom", customProvider: { endpoint: "http://x", apiKey: "k", model: "m" } });
        expect(m).toEqual({ provider: "custom", configs: { custom: { endpoint: "http://x", apiKey: "k", model: "m" } } });
    });

    it("defaults to off", () => {
        expect(migrateAiSettings({}).provider).toBe(OFF);
    });
});

describe("gradeTask", () => {
    it("uses local rules when AI is off", async () => {
        const f = mockFetch({});
        const g = await gradeTask("do laundry", { provider: OFF, configs: {} });
        expect(f).not.toHaveBeenCalled();
        expect(g).toMatchObject({ category: "mundane", gradedBy: "Local rules" });
    });

    it("does not call a provider that is missing its key", async () => {
        const f = mockFetch({});
        const g = await gradeTask("do laundry", { provider: "anthropic", configs: {} });
        expect(f).not.toHaveBeenCalled();
        expect(g.gradedBy).toMatch(/not set up/);
    });

    it("calls Anthropic with the user's key and browser-access header", async () => {
        const f = mockFetch({ content: [{ type: "text", text: '{"category":"work","exp":60,"reason":"Big report"}' }] });
        const g = await gradeTask("quarterly report", { provider: "anthropic", configs: { anthropic: { apiKey: "sk-test" } } });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(init.headers["x-api-key"]).toBe("sk-test");
        expect(init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
        expect(JSON.parse(init.body).model).toBe("claude-haiku-4-5");
        expect(g).toMatchObject({ category: "work", exp: 60, gradedBy: "Anthropic (Claude) · claude-haiku-4-5" });
    });

    it("calls OpenAI-compatible providers with a bearer token and custom model", async () => {
        const f = mockFetch({ choices: [{ message: { content: '{"category":"personal","exp":20,"reason":"Workout"}' } }] });
        await gradeTask("gym", { provider: "gemini", configs: { gemini: { apiKey: "g-key", model: "gemini-x" } } });
        const [url, init] = f.mock.calls[0];
        expect(url).toContain("generativelanguage.googleapis.com");
        expect(init.headers.Authorization).toBe("Bearer g-key");
        expect(JSON.parse(init.body).model).toBe("gemini-x");
    });

    it("falls back to local rules when the provider errors", async () => {
        mockFetch({}, false, 401);
        const g = await gradeTask("do dishes", { provider: "openai", configs: { openai: { apiKey: "bad" } } });
        expect(g.category).toBe("mundane");
        expect(g.reason).toContain("HTTP 401");
        expect(g.gradedBy).toBe("Local rules (AI fallback)");
    });
});

describe("key handling", () => {
    const ai = { provider: "openai", configs: { openai: { apiKey: "secret", model: "m" } } };
    it("strips keys for export and masks them for display", () => {
        expect(stripAiKeys(ai).configs.openai.apiKey).toBe("");
        expect(redactAi(ai).configs.openai.apiKey).toBe("***");
        expect(ai.configs.openai.apiKey).toBe("secret");
    });
});
