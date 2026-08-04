import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean; master?: boolean };

const sessionConfig = () => ({
  password: process.env["SESSION_SECRET"]!,
  name: "as_pref",
  maxAge: 60 * 60 * 12,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
});

function matches(input: string, expected: string | undefined) {
  if (!expected) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function gate() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("locked");
  return session.data;
}

const SIGNED_TTL = 60 * 60 * 24 * 7;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Verifica o código digitado na busca (nunca vai para o bundle do navegador). */
export const checkTrigger = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const code = (data.code ?? "").trim();
    if (matches(code, process.env["SITE_TRIGGER_MASTER"])) return { ok: true, master: true };
    if (matches(code, process.env["SITE_TRIGGER_CODE"])) return { ok: true, master: false };
    return { ok: false, master: false };
  });

export const unlock = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const pw = (data.password ?? "").trim();
    const master = matches(pw, process.env["MASTER_PASSWORD"]);
    const normal = matches(pw, process.env["SITE_PASSWORD"]);
    if (!master && !normal) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
      return { ok: false as const };
    }
    if (!master) {
      const db = await admin();
      const { data: st } = await db.from("site_state").select("chat_open").eq("id", "main").maybeSingle();
      if (st && st.chat_open === false) return { ok: false as const };
    }
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true, master });
    return { ok: true as const, master };
  });

export const getGate = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  return { unlocked: Boolean(session.data.unlocked), master: Boolean(session.data.master) };
});

export const lock = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const listMessages = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number }) => d ?? {})
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: rows } = await db
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 250, 400));
    return { rows: (rows ?? []).reverse() };
  });

export const listMedia = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const db = await admin();
  const { data: rows } = await db
    .from("messages")
    .select("*")
    .not("media_url", "is", null)
    .in("media_type", ["image", "video"])
    .order("created_at", { ascending: true });
  return { rows: rows ?? [] };
});

export const createUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { ext: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const ext = (data.ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const db = await admin();
    const { data: signed, error } = await db.storage.from("chat-media").createSignedUploadUrl(path);
    if (error || !signed) throw new Error("upload_failed");
    return { path, token: signed.token };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      author: "gu" | "li";
      text?: string;
      replyTo?: string | null;
      mediaPath?: string | null;
      mediaType?: string | null;
      stickerUrl?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    let mediaUrl: string | null = data.stickerUrl ?? null;
    if (data.mediaPath) {
      const { data: signed } = await db.storage
        .from("chat-media")
        .createSignedUrl(data.mediaPath, SIGNED_TTL);
      mediaUrl = signed?.signedUrl ?? null;
    }
    const { data: row, error } = await db
      .from("messages")
      .insert({
        author: data.author,
        text: (data.text ?? "").slice(0, 4000),
        reply_to: data.replyTo ?? null,
        media_url: mediaUrl,
        media_type: data.stickerUrl ? "sticker" : (data.mediaType ?? null),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const reactMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; reactions: string[] }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db
      .from("messages")
      .update({ reactions: data.reactions.slice(0, 40) })
      .eq("id", data.id);
    return { ok: true as const };
  });

/** Estado público mínimo (só diz se o acesso está liberado + recado). */
export const getSiteState = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("site_state").select("chat_open, note").eq("id", "main").maybeSingle();
  return { chatOpen: data?.chat_open ?? true, note: data?.note ?? "" };
});

export const updateSiteState = createServerFn({ method: "POST" })
  .inputValidator((d: { chat_open?: boolean; note?: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const patch: { chat_open?: boolean; note?: string } = {};
    if (typeof data.chat_open === "boolean") patch.chat_open = data.chat_open;
    if (typeof data.note === "string") patch.note = data.note.slice(0, 200);
    if (Object.keys(patch).length) await db.from("site_state").update(patch).eq("id", "main");
    return { ok: true as const };
  });
