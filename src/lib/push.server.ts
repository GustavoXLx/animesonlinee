import { createHmac } from "node:crypto";
import { p256 } from "@noble/curves/nist.js";

/** Avisos do navegador (Web Push sem conteúdo): só acorda o aparelho, o texto fica no service worker. */

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function vapidSecret(): Uint8Array {
  const h = createHmac("sha256", process.env["SESSION_SECRET"]! + ":vapid-v1").update("anistream").digest();
  return new Uint8Array(h);
}

export function vapidPublicKey() {
  return b64url(p256.getPublicKey(vapidSecret(), false));
}

function vapidJwt(aud: string) {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://animesonlinee.lovable.app" })),
  );
  const unsigned = `${head}.${body}`;
  const sig = p256.sign(enc.encode(unsigned), vapidSecret()) as unknown as { toBytes: (f: string) => Uint8Array } | Uint8Array;
  const raw = sig instanceof Uint8Array ? sig : sig.toBytes("compact");
  return `${unsigned}.${b64url(raw)}`;
}

/** Envia um "ping" para cada inscrição; devolve as que expiraram (404/410). */
export async function sendPushes(endpoints: string[]) {
  const dead: string[] = [];
  const key = vapidPublicKey();
  await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const aud = new URL(ep).origin;
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${vapidJwt(aud)}, k=${key}`,
            TTL: "86400",
            Urgency: "high",
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) dead.push(ep);
      } catch {
        /* rede */
      }
    }),
  );
  return dead;
}
