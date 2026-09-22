import { describe, it, expect, vi, afterEach } from "vitest";
import worker, { runSchedule } from "../src/index.js";
import { b64urlEncode } from "../src/webpush.js";

afterEach(() => vi.unstubAllGlobals());

function memoryKv() {
    const m = new Map();
    return {
        m,
        get: async (k, type) => (m.has(k) ? (type === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null),
        put: async (k, v) => { m.set(k, v); },
        delete: async (k) => { m.delete(k); },
        list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
    };
}

async function makeEnv() {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    return {
        SUBSCRIPTIONS: memoryKv(),
        ALLOWED_ORIGINS: "https://quest.example",
        VAPID_SUBJECT: "mailto:a@b.c",
        VAPID_PUBLIC_KEY: b64urlEncode(await crypto.subtle.exportKey("raw", kp.publicKey)),
        VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey("jwk", kp.privateKey)).d,
    };
}

async function browserSubscription() {
    const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    return { endpoint: "https://push.example/send/abc", keys: { p256dh: b64urlEncode(await crypto.subtle.exportKey("raw", ua.publicKey)), auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))) } };
}

const call = (env, method, path, body, origin = "https://quest.example") =>
    worker.fetch(new Request(`https://w.example${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), env);

describe("push worker API", () => {
    it("rejects origins that aren't allowed", async () => {
        const env = await makeEnv();
        expect((await call(env, "GET", "/api/vapid-public-key", null, "https://evil.example")).status).toBe(403);
        const res = await call(env, "GET", "/api/vapid-public-key");
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://quest.example");
        expect((await res.json()).publicKey).toBe(env.VAPID_PUBLIC_KEY);
    });

    it("registers, updates and deletes a subscription", async () => {
        const env = await makeEnv();
        const res = await call(env, "POST", "/api/subscriptions", { subscription: await browserSubscription(), timeZone: "Europe/London", snapshot: { openTasks: [{ text: "x".repeat(500), exp: 5 }] } });
        const { id } = await res.json();
        expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
        let rec = JSON.parse(env.SUBSCRIPTIONS.m.get(`sub:${id}`));
        expect(rec.timeZone).toBe("Europe/London");
        expect(rec.snapshot.openTasks[0].text).toHaveLength(120);

        expect((await call(env, "PUT", `/api/subscriptions/${id}`, { timeZone: "Not/AZone" })).status).toBe(400);
        await call(env, "PUT", `/api/subscriptions/${id}`, { prefs: { morning: { enabled: false, time: "07:30" } } });
        rec = JSON.parse(env.SUBSCRIPTIONS.m.get(`sub:${id}`));
        expect(rec.prefs.morning).toEqual({ enabled: false, time: "07:30" });
        expect(rec.prefs.evening.enabled).toBe(true);

        expect((await call(env, "DELETE", `/api/subscriptions/${id}`)).status).toBe(200);
        expect((await call(env, "PUT", `/api/subscriptions/${id}`, {})).status).toBe(404);
    });

    it("sends an encrypted, VAPID-signed test push", async () => {
        const env = await makeEnv();
        const { id } = await (await call(env, "POST", "/api/subscriptions", { subscription: await browserSubscription() })).json();
        const push = vi.fn(async () => new Response(null, { status: 201 }));
        vi.stubGlobal("fetch", push);
        const res = await call(env, "POST", `/api/subscriptions/${id}/test`, { kind: "evening" });
        expect(res.status).toBe(200);
        const [url, init] = push.mock.calls[0];
        expect(url).toBe("https://push.example/send/abc");
        expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
        expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    });
});

describe("scheduled run", () => {
    it("sends due notifications once and drops dead subscriptions", async () => {
        const env = await makeEnv();
        const mk = async () => (await (await call(env, "POST", "/api/subscriptions", { subscription: await browserSubscription(), timeZone: "UTC" })).json()).id;
        const alive = await mk();
        const dead = await mk();
        const statusFor = (url) => (url.includes(dead) ? 410 : 201);
        // Point the dead record at a distinguishable endpoint.
        const d = JSON.parse(env.SUBSCRIPTIONS.m.get(`sub:${dead}`));
        d.subscription.endpoint += dead;
        env.SUBSCRIPTIONS.m.set(`sub:${dead}`, JSON.stringify(d));
        vi.stubGlobal("fetch", vi.fn(async (url) => new Response(null, { status: statusFor(url) })));

        const morning = Date.UTC(2026, 8, 22, 8, 5);
        expect(await runSchedule(env, morning)).toEqual({ checked: 2, sent: 1, removed: 1, failed: 0 });
        expect(env.SUBSCRIPTIONS.m.has(`sub:${dead}`)).toBe(false);
        expect(JSON.parse(env.SUBSCRIPTIONS.m.get(`sub:${alive}`)).sent.morning).toBe("2026-09-22");
        expect((await runSchedule(env, morning + 15 * 60e3)).sent).toBe(0);
    });
});
