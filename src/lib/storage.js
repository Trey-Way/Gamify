import { idbGet, idbSet, idbDelete } from "./idb.js";

/* ---------- Reliable local save (with redundant backup copies) ---------- */
// A single localStorage write can be lost to a full quota, a mid-write tab
// close, or Safari's storage eviction. Writing the same payload to a second
// key means a corrupted/missing primary can self-heal from the backup on
// next load instead of silently resetting progress. A third copy goes to
// IndexedDB, which iOS keeps more reliably for home-screen apps.
export const STORAGE_KEY = "questlog-state";
export const STORAGE_BACKUP_KEY = "questlog-state-backup";

export function loadSavedState() {
    for (const key of [STORAGE_KEY, STORAGE_BACKUP_KEY]) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tasks)) return parsed;
        } catch { /* try the next key */ }
    }
    return null;
}
export function saveState(state) {
    const s = { ...state, savedAt: Date.now() };
    idbSet(STORAGE_KEY, s);
    try {
        const json = JSON.stringify(s);
        localStorage.setItem(STORAGE_KEY, json);
        localStorage.setItem(STORAGE_BACKUP_KEY, json);
        return true;
    } catch {
        return false;
    }
}
export function clearSavedState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_BACKUP_KEY);
    } catch { /* nothing to clear */ }
    idbDelete(STORAGE_KEY);
}

// The IndexedDB copy, if it's newer than what localStorage gave us (e.g.
// localStorage was evicted or a write was lost).
export async function loadNewerIdbState(savedAt = 0) {
    const s = await idbGet(STORAGE_KEY);
    return s && Array.isArray(s.tasks) && (s.savedAt || 0) > savedAt ? s : null;
}
