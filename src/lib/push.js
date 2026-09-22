/* ---------- Web push (client side) ---------- */
// Talks to the Questlog push worker (push-worker/). The worker needs a
// little data to write useful notifications, so the app syncs a snapshot
// of open quests and recent completions whenever they change.
import { deadlineOf } from "./outcomes.js";
import { isIos, isStandalone } from "./pwa.js";

export const DEFAULT_PUSH_PREFS = {
    morning: { enabled: true, time: "08:00" },
    streak: { enabled: true, time: "19:00" },
    evening: { enabled: true, time: "21:30" },
};

export const DEFAULT_PUSH = {
    serverUrl: import.meta.env.VITE_PUSH_SERVER_URL || "",
    id: null,
    prefs: DEFAULT_PUSH_PREFS,
};

const SNAPSHOT_DAYS = 60;

export function buildPushSnapshot(tasks, now = Date.now()) {
    const since = now - SNAPSHOT_DAYS * 24 * 3600 * 1000;
    const openTasks = tasks
        .filter((t) => !t.done && !t.pending)
        .sort((a, b) => deadlineOf(a) - deadlineOf(b))
        .slice(0, 25)
        .map((t) => ({ text: t.text, exp: t.exp || 0, dueAt: t.dueAt || null, createdAt: t.createdAt }));
    const completions = tasks
        .filter((t) => t.done && t.completedAt >= since)
        .map((t) => ({ at: t.completedAt, exp: t.exp || 0 }));
    return { generatedAt: now, openTasks, completions };
}

export function timeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// Why push can't be enabled on this device right now, or null.
export function pushUnavailableReason() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return isIos() && !isStandalone()
            ? "On iPhone, notifications only work in the installed app: tap Share → Add to Home Screen, then open Questlog from your home screen (iOS 16.4+)."
            : "This browser doesn't support web push notifications.";
    }
    if (!import.meta.env.PROD) return "Push needs the service worker, which only runs in a production build (npm run build && npm run preview).";
    if (Notification.permission === "denied") return "Notifications are blocked for Questlog. Re-enable them in your device's settings.";
    return null;
}

export class PushApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

async function api(serverUrl, path, { method = "GET", body, keepalive } = {}) {
    const res = await fetch(serverUrl.replace(/\/+$/, "") + path, {
        method,
        keepalive,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new PushApiError(res.status, data.error || `Push server returned ${res.status}`);
    return data;
}

function urlBase64ToUint8Array(base64) {
    const padded = (base64 + "===".slice((base64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// Must be called from a user gesture (iOS requires it for the permission prompt).
export async function enablePush(serverUrl, { prefs, snapshot }) {
    if (!serverUrl) throw new Error("Add your push server URL first.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission wasn't granted.");
    const { publicKey } = await api(serverUrl, "/api/vapid-public-key");
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe().catch(() => {});
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const { id } = await api(serverUrl, "/api/subscriptions", {
        method: "POST",
        body: { subscription: subscription.toJSON(), timeZone: timeZone(), prefs, snapshot },
    });
    return id;
}

export async function disablePush(serverUrl, id) {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe().catch(() => {});
    if (serverUrl && id) await api(serverUrl, `/api/subscriptions/${id}`, { method: "DELETE" }).catch(() => {});
}

export function syncPush(serverUrl, id, patch, opts = {}) {
    return api(serverUrl, `/api/subscriptions/${id}`, { method: "PUT", body: { timeZone: timeZone(), ...patch }, ...opts });
}

// The browser can silently rotate or drop a subscription; re-send the
// current one so the worker has a live endpoint. Returns false if it's gone.
export async function refreshSubscription(serverUrl, id) {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return false;
    await syncPush(serverUrl, id, { subscription: sub.toJSON() });
    return true;
}

export function sendTestPush(serverUrl, id, kind) {
    return api(serverUrl, `/api/subscriptions/${id}/test`, { method: "POST", body: { kind } });
}
