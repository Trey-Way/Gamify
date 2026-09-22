import { describe, it, expect } from "vitest";
import { encryptPayload, vapidAuthHeader, b64urlEncode, b64urlDecode, concat } from "../src/webpush.js";

const enc = new TextEncoder();
async function hmac(key, data) {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, len);

// Receiver side of RFC 8291, written independently from the sender.
async function decrypt(body, uaKeys, authSecret) {
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const ciphertext = body.slice(21 + idlen);
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", uaKeys.publicKey));
    const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaKeys.privateKey, 256));
    const ikm = await hkdf(authSecret, secret, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
    const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
    expect(plain.at(-1)).toBe(2); // last-record delimiter
    return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push encryption", () => {
    it("round-trips a payload a browser could decrypt", async () => {
        const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
        const auth = crypto.getRandomValues(new Uint8Array(16));
        const sub = { endpoint: "https://push.example/x", keys: { p256dh: b64urlEncode(await crypto.subtle.exportKey("raw", ua.publicKey)), auth: b64urlEncode(auth) } };
        const body = await encryptPayload(sub, JSON.stringify({ title: "Hi ☀️" }));
        expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
        expect(JSON.parse(await decrypt(body, ua, auth))).toEqual({ title: "Hi ☀️" });
    });
});

describe("VAPID", () => {
    it("signs an ES256 JWT for the endpoint origin that verifies with the public key", async () => {
        const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        const publicKey = b64urlEncode(await crypto.subtle.exportKey("raw", kp.publicKey));
        const privateKey = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d;
        const header = await vapidAuthHeader("https://web.push.apple.com/abc", { publicKey, privateKey, subject: "mailto:a@b.c" }, 1000);
        const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
        expect(k).toBe(publicKey);
        const [h, c, s] = jwt.split(".");
        const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
        expect(claims).toEqual({ aud: "https://web.push.apple.com", exp: 1000 + 12 * 3600, sub: "mailto:a@b.c" });
        const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, b64urlDecode(s), enc.encode(`${h}.${c}`));
        expect(ok).toBe(true);
    });
});
