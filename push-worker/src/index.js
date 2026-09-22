/* Questlog push worker.
 *
 * HTTP API (JSON, CORS-restricted to ALLOWED_ORIGINS):
 *   GET    /api/vapid-public-key           -> { publicKey }
 *   POST   /api/subscriptions               { subscription, timeZone, prefs, snapshot } -> { id }
 *   PUT    /api/subscriptions/:id           any of { subscription, timeZone, prefs, snapshot }
 *   DELETE /api/subscriptions/:id
 *   POST   /api/subscriptions/:id/test      { kind } -> sends that notification now
 *
 * The subscription id is a random 128-bit secret known only to the device
 * that registered it; it's the credential for updating/deleting.
 *
 * Cron (see wrangler.toml) runs every 15 minutes and sends the morning plan,
 * streak check and evening check-in when each is due in the user's time zone.
 */
import { sendPush, b64urlEncode } from "./webpush.js";
import { KINDS, DEFAULT_PREFS, dueKinds, buildMessage, localDate, isValidTimeZone } from "./messages.js";

const MAX_BODY_BYTES = 64 * 1024;
const PREFIX = "sub:";

function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const ok = allowed.includes("*") || allowed.includes(origin);
    return ok ? {
        "Access-Control-Allow-Origin": allowed.includes("*") ? "*" : origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
    } : null;
}

function json(data, status, cors) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors } });
}

async function readJson(request) {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Body too large");
    try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "Invalid JSON"); }
}

class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

function validSubscription(s) {
    return s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") &&
        typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
}

function cleanPrefs(prefs) {
    const out = {};
    for (const kind of KINDS) {
        const p = prefs?.[kind] || DEFAULT_PREFS[kind];
        out[kind] = { enabled: !!p.enabled, time: /^\d{2}:\d{2}$/.test(p.time) ? p.time : DEFAULT_PREFS[kind].time };
    }
    return out;
}

// Keep only the fields the messages use, with sane caps.
function cleanSnapshot(s) {
    const text = (t) => String(t || "").slice(0, 120);
    return {
        generatedAt: Number(s?.generatedAt) || Date.now(),
        openTasks: (s?.openTasks || []).slice(0, 50).map((t) => ({
            text: text(t.text), exp: Number(t.exp) || 0, dueAt: Number(t.dueAt) || null, createdAt: Number(t.createdAt) || 0,
        })),
        completions: (s?.completions || []).slice(0, 1000).map((c) => ({ at: Number(c.at) || 0, exp: Number(c.exp) || 0 })),
    };
}

function applyUpdate(record, body) {
    if (body.subscription !== undefined) {
        if (!validSubscription(body.subscription)) throw new HttpError(400, "Invalid subscription");
        record.subscription = { endpoint: body.subscription.endpoint, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth } };
    }
    if (body.timeZone !== undefined) {
        if (!isValidTimeZone(body.timeZone)) throw new HttpError(400, "Invalid timeZone");
        record.timeZone = body.timeZone;
    }
    if (body.prefs !== undefined) record.prefs = cleanPrefs(body.prefs);
    if (body.snapshot !== undefined) record.snapshot = cleanSnapshot(body.snapshot);
    record.updatedAt = Date.now();
    return record;
}

function vapid(env) {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) throw new HttpError(500, "VAPID keys are not configured");
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
}

async function getRecord(env, id) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) throw new HttpError(404, "Unknown subscription");
    const record = await env.SUBSCRIPTIONS.get(PREFIX + id, "json");
    if (!record) throw new HttpError(404, "Unknown subscription");
    return record;
}

async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const m = path.match(/^\/api\/subscriptions\/([^/]+)(\/test)?$/);

    if (request.method === "GET" && path === "/api/vapid-public-key") {
        return { publicKey: vapid(env).publicKey };
    }

    if (request.method === "POST" && path === "/api/subscriptions") {
        const body = await readJson(request);
        if (!validSubscription(body.subscription)) throw new HttpError(400, "Invalid subscription");
        const id = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const record = applyUpdate({ id, createdAt: Date.now(), timeZone: "UTC", prefs: DEFAULT_PREFS, snapshot: cleanSnapshot({}), sent: {} }, body);
        await env.SUBSCRIPTIONS.put(PREFIX + id, JSON.stringify(record));
        return { id };
    }

    if (m && !m[2] && request.method === "PUT") {
        const record = applyUpdate(await getRecord(env, m[1]), await readJson(request));
        await env.SUBSCRIPTIONS.put(PREFIX + record.id, JSON.stringify(record));
        return { ok: true };
    }

    if (m && !m[2] && request.method === "DELETE") {
        await env.SUBSCRIPTIONS.delete(PREFIX + m[1]);
        return { ok: true };
    }

    if (m && m[2] && request.method === "POST") {
        const record = await getRecord(env, m[1]);
        const { kind = "morning" } = await readJson(request);
        if (!KINDS.includes(kind)) throw new HttpError(400, "Unknown kind");
        const message = buildMessage(kind, record.snapshot, Date.now(), record.timeZone);
        const result = await sendPush(record.subscription, message, vapid(env), { urgency: "high" });
        if (result.gone) await env.SUBSCRIPTIONS.delete(PREFIX + record.id);
        if (!result.ok) throw new HttpError(502, `Push service returned ${result.status}`);
        return { ok: true, message };
    }

    throw new HttpError(404, "Not found");
}

export async function runSchedule(env, now = Date.now()) {
    const keys = vapid(env);
    let cursor;
    const stats = { checked: 0, sent: 0, removed: 0, failed: 0 };
    do {
        const page = await env.SUBSCRIPTIONS.list({ prefix: PREFIX, cursor });
        cursor = page.list_complete ? undefined : page.cursor;
        for (const { name } of page.keys) {
            const record = await env.SUBSCRIPTIONS.get(name, "json");
            if (!record) continue;
            stats.checked++;
            const kinds = dueKinds(record, now);
            if (!kinds.length) continue;
            let gone = false;
            for (const kind of kinds) {
                const message = buildMessage(kind, record.snapshot, now, record.timeZone);
                try {
                    const res = await sendPush(record.subscription, message, keys, { topic: kind });
                    if (res.gone) { gone = true; break; }
                    if (res.ok) stats.sent++; else stats.failed++;
                } catch {
                    stats.failed++;
                }
                // Mark as handled for today either way so a broken endpoint isn't retried every 15 min.
                record.sent = { ...record.sent, [kind]: localDate(now, record.timeZone) };
            }
            if (gone) {
                await env.SUBSCRIPTIONS.delete(name);
                stats.removed++;
            } else {
                await env.SUBSCRIPTIONS.put(name, JSON.stringify(record));
            }
        }
    } while (cursor);
    return stats;
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        if (request.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
        if (!cors && request.headers.get("Origin")) return json({ error: "Origin not allowed" }, 403, {});
        try {
            return json(await handle(request, env), 200, cors || {});
        } catch (e) {
            return json({ error: e.message }, e.status || 500, cors || {});
        }
    },

    async scheduled(_event, env, ctx) {
        ctx.waitUntil(runSchedule(env));
    },
};
