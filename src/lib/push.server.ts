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

let signKey: Promise<CryptoKey> | null = null;
function getSignKey() {
  if (!signKey) {
    const d = vapidSecret();
    const pub = p256.getPublicKey(d, false);
    signKey = crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", d: b64url(d), x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }
  return signKey;
}

/** JWT ES256 assinado com WebCrypto (SHA-256 + assinatura r||s de 64 bytes, como o padrão exige). */
async function vapidJwt(aud: string) {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://animesonlinee.lovable.app" })),
  );
  const unsigned = `${head}.${body}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await getSignKey(), enc.encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
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
            Authorization: `vapid t=${await vapidJwt(aud)}, k=${key}`,
            TTL: "86400",
            Urgency: "high",
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) dead.push(ep);
        else if (!res.ok) console.error("push falhou", res.status, (await res.text()).slice(0, 200));
      } catch (e) {
        console.error("push rede", e);
      }
    }),
  );
  return dead;
}
