/* Web Push for Cloudflare Workers using only WebCrypto:
 * - VAPID authentication (RFC 8292): an ES256 JWT signed with our key
 * - payload encryption (RFC 8291, "aes128gcm" content coding, RFC 8188)
 */

const enc = new TextEncoder();

export function b64urlEncode(bytes) {
    let bin = "";
    for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function concat(...parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of parts) { out.set(p, i); i += p.length; }
    return out;
}

async function hmac(key, data) {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// HKDF with a single output block (all lengths we need are <= 32 bytes).
async function hkdf(salt, ikm, info, length) {
    const prk = await hmac(salt, ikm);
    return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/* ---------- VAPID ---------- */

// publicKey: base64url 65-byte uncompressed P-256 point; privateKey: base64url 32-byte scalar.
async function importVapidPrivateKey(publicKey, privateKey) {
    const pub = b64urlDecode(publicKey);
    const jwk = {
        kty: "EC", crv: "P-256", ext: true,
        x: b64urlEncode(pub.slice(1, 33)),
        y: b64urlEncode(pub.slice(33, 65)),
        d: privateKey,
    };
    return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function vapidAuthHeader(endpoint, { publicKey, privateKey, subject }, nowSec = Math.floor(Date.now() / 1000)) {
    const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    const claims = b64urlEncode(enc.encode(JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: nowSec + 12 * 3600,
        sub: subject,
    })));
    const key = await importVapidPrivateKey(publicKey, privateKey);
    const unsigned = `${header}.${claims}`;
    // WebCrypto emits the raw r||s signature JWS expects.
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
    return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${publicKey}`;
}

/* ---------- Payload encryption (RFC 8291) ---------- */

const RECORD_SIZE = 4096;

export async function encryptPayload(subscription, payload, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
    const uaPublic = b64urlDecode(subscription.keys.p256dh);
    const authSecret = b64urlDecode(subscription.keys.auth);

    const asKeys = serverKeys || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
    const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

    const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
    const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
    const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

    // Single record: plaintext followed by the 0x02 "last record" delimiter.
    const plaintext = concat(typeof payload === "string" ? enc.encode(payload) : payload, new Uint8Array([2]));
    if (plaintext.length + 16 > RECORD_SIZE) throw new Error("Push payload too large");
    const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, RECORD_SIZE);
    return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/* ---------- Send ---------- */

// Returns { ok, status, gone } - gone means the subscription is dead and should be deleted.
export async function sendPush(subscription, message, vapid, { ttl = 4 * 3600, urgency = "normal", topic } = {}) {
    const body = await encryptPayload(subscription, JSON.stringify(message));
    const headers = {
        Authorization: await vapidAuthHeader(subscription.endpoint, vapid),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttl),
        Urgency: urgency,
    };
    if (topic) headers.Topic = topic;
    const res = await fetch(subscription.endpoint, { method: "POST", headers, body });
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
