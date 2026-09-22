// Prints a fresh VAPID key pair in the format the worker expects:
// base64url 65-byte uncompressed public key and 32-byte private scalar.
import { webcrypto as crypto } from "node:crypto";

const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
const pub = Buffer.from(await crypto.subtle.exportKey("raw", keys.publicKey)).toString("base64url");

console.log(`VAPID_PUBLIC_KEY=${pub}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("\nSet them as worker secrets (paste each value when prompted):");
console.log("  npx wrangler secret put VAPID_PUBLIC_KEY");
console.log("  npx wrangler secret put VAPID_PRIVATE_KEY");
