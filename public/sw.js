/* Questlog service worker: offline app shell + web push. */
const VERSION = "questlog-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

// Resolve paths against the SW scope so the app works under any base path.
const scoped = (path) => new URL(path, self.registration.scope).href;

// Precache the shell, plus the hashed JS/CSS that index.html points at, so
// the very first offline launch works (those requests happened before this
// worker was controlling the page).
async function precacheShell() {
    const cache = await caches.open(SHELL_CACHE);
    const base = [scoped("./"), scoped("manifest.webmanifest"), scoped("icons/icon-192.png"), scoped("icons/apple-touch-icon.png"), scoped("icons/icon.svg")];
    await cache.addAll(base);
    const html = await (await cache.match(scoped("./"))).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
    if (assets.length) await cache.addAll(assets);
}

self.addEventListener("install", (event) => {
    event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

async function networkFirstNavigation(request) {
    try {
        const res = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(scoped("./"), res.clone());
        return res;
    } catch {
        return (await caches.match(scoped("./"), { ignoreVary: true })) || Response.error();
    }
}

async function cacheFirst(request) {
    const hit = await caches.match(request, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok || res.type === "opaque") (await caches.open(RUNTIME_CACHE)).put(request, res.clone());
    return res;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(request, { ignoreVary: true });
    const refresh = fetch(request).then((res) => {
        if (res.ok || res.type === "opaque") cache.put(request, res.clone());
        return res;
    }).catch(() => hit);
    return hit || refresh;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (request.mode === "navigate" && url.origin === self.location.origin) {
        event.respondWith(networkFirstNavigation(request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(url.pathname.includes("/assets/") ? cacheFirst(request) : staleWhileRevalidate(request));
    } else if (FONT_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request));
    }
    // Everything else (AI providers, the push server) goes straight to the network.
});

/* ---------- Web push ---------- */
// Payloads come from the push worker as JSON: { title, body, tag, url }.
self.addEventListener("push", (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
    const title = data.title || "Questlog";
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || "questlog",
        icon: scoped("icons/icon-192.png"),
        badge: scoped("icons/icon-192.png"),
        data: { url: data.url || scoped("./") },
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = event.notification.data?.url || scoped("./");
    event.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const existing = all.find((c) => c.url.startsWith(self.registration.scope));
        if (existing) {
            await existing.focus();
            if ("navigate" in existing && existing.url !== target) await existing.navigate(target).catch(() => {});
            return;
        }
        await self.clients.openWindow(target);
    })());
});
