/* ---------- PWA helpers ---------- */
export function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => { /* offline support is best-effort */ });
    });
}

// Ask the browser not to evict our storage under pressure.
export function requestPersistentStorage() {
    navigator.storage?.persist?.().catch(() => {});
}

export function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
