/* ---------- Tiny IndexedDB key-value store ---------- */
// localStorage is synchronous and small; IndexedDB is the more durable
// offline store on iOS, so the save is mirrored here as a third copy.
const DB_NAME = "questlog";
const STORE = "kv";

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function run(mode, fn) {
    const db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const req = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(req?.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

export function idbGet(key) {
    return run("readonly", (s) => s.get(key)).catch(() => undefined);
}
export function idbSet(key, value) {
    return run("readwrite", (s) => s.put(value, key)).catch(() => undefined);
}
export function idbDelete(key) {
    return run("readwrite", (s) => s.delete(key)).catch(() => undefined);
}
