/* ---------- Sound effects ---------- */
// Synthesized with the Web Audio API instead of an external audio file, so
// there's nothing to fetch, no CORS risk once deployed, and no licensing to
// track down - it just works everywhere, offline included.
let sharedAudioCtx = null;
function getAudioCtx() {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
    if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume().catch(() => {});
    return sharedAudioCtx;
}
function playTone(freq, delayMs = 0, duration = 140, volume = 0.16) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const startAt = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration / 1000 + 0.02);
}
export function playCreateDing() {
    try { playTone(720, 0, 110, 0.12); } catch { /* audio unavailable */ }
}
export function playCompleteDing() {
    try { playTone(880, 0, 110, 0.14); playTone(1318, 90, 170, 0.14); } catch { /* audio unavailable */ }
}
