import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = {
  unlocked?: boolean;
  master?: boolean;
  /** só quem acertou o código na busca pode tentar a senha */
  armed?: boolean;
  fails?: number;
  blockedUntil?: number;
};

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
const slow = (ms = 400) => new Promise((r) => setTimeout(r, ms + Math.random() * 400));

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Verifica o código digitado na busca (nunca vai para o bundle do navegador). */
export const checkTrigger = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const code = (data.code ?? "").trim();
    const master = matches(code, process.env["SITE_TRIGGER_MASTER"]);
    const normal = matches(code, process.env["SITE_TRIGGER_CODE"]);
    if (!master && !normal) {
      await slow(150);
      return { ok: false, master: false };
    }
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ ...session.data, armed: true });
    return { ok: true, master };
  });

export const unlock = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const session = await useSession<GateSession>(sessionConfig());
    const now = Date.now();

    // sem passar pelo código secreto da busca, a senha nem é avaliada
    if (!session.data.armed) {
      await slow(600);
      return { ok: false as const };
    }
    // bloqueio temporário após tentativas erradas
    if (session.data.blockedUntil && session.data.blockedUntil > now) {
      await slow(800);
      return { ok: false as const };
    }

    const pw = (data.password ?? "").trim();
    const master = matches(pw, process.env["MASTER_PASSWORD"]);
    const normal = matches(pw, process.env["SITE_PASSWORD"]);

    if (!master && !normal) {
      const fails = (session.data.fails ?? 0) + 1;
      await session.update({
        ...session.data,
        fails,
        ...(fails >= 5 ? { blockedUntil: now + 10 * 60 * 1000, fails: 0, armed: false } : {}),
      });
      await slow(600);
      return { ok: false as const };
    }

    if (!master) {
      const db = await admin();
      const { data: st } = await db
        .from("site_state")
        .select("chat_open")
        .eq("id", "main")
        .maybeSingle();
      if (st && st.chat_open === false) return { ok: false as const };
    }
    await session.update({ unlocked: true, master, armed: true, fails: 0 });
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

type DbClient = Awaited<ReturnType<typeof admin>>;
type MediaRow = { media_path?: string | null; media_url: string | null };

/** Regera os links assinados a partir do caminho salvo (mídia antiga nunca expira). */
async function refreshMedia<T extends MediaRow>(db: DbClient, rows: T[]): Promise<T[]> {
  const paths = Array.from(
    new Set(rows.map((r) => r.media_path).filter((p): p is string => Boolean(p))),
  );
  if (!paths.length) return rows;
  const { data: signed } = await db.storage
    .from("chat-media")
    .createSignedUrls(paths, SIGNED_TTL);
  const map = new Map<string, string>();
  (signed ?? []).forEach((s) => {
    if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  });
  return rows.map((r) =>
    r.media_path && map.has(r.media_path) ? { ...r, media_url: map.get(r.media_path)! } : r,
  );
}

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
    const fresh = await refreshMedia(db, rows ?? []);
    return { rows: fresh.reverse() };
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
  const fresh = await refreshMedia(db, rows ?? []);
  return { rows: fresh };
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

/** Fotos de perfil (guardadas por caminho, links renovados a cada leitura). */
export const getProfiles = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const db = await admin();
  const { data: rows } = await db.from("chat_profiles").select("id, avatar_path");
  const out: Record<string, string | null> = { gu: null, li: null };
  const paths = (rows ?? [])
    .map((r) => r.avatar_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await db.storage
      .from("chat-media")
      .createSignedUrls(paths, SIGNED_TTL);
    const map = new Map<string, string>();
    (signed ?? []).forEach((s) => s.path && s.signedUrl && map.set(s.path, s.signedUrl));
    (rows ?? []).forEach((r) => {
      out[r.id] = r.avatar_path ? (map.get(r.avatar_path) ?? null) : null;
    });
  }
  return out as { gu: string | null; li: string | null };
});

export const setProfileAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; path: string | null }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db
      .from("chat_profiles")
      .upsert({ id: data.who, avatar_path: data.path }, { onConflict: "id" });
    return { ok: true as const };
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
        media_path: data.mediaPath ?? null,
        media_type: data.stickerUrl ? "sticker" : (data.mediaType ?? null),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

/** Marca como vistas as mensagens da outra pessoa (visto azul). */
export const markSeen = createServerFn({ method: "POST" })
  .inputValidator((d: { me: "gu" | "li" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const other = data.me === "gu" ? "li" : "gu";
    await db
      .from("messages")
      .update({ seen_at: new Date().toISOString() })
      .eq("author", other)
      .is("seen_at", null);
    return { ok: true as const };
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
  const { data } = await db
    .from("site_state")
    .select("chat_open, note")
    .eq("id", "main")
    .maybeSingle();
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

/** Apaga a mensagem para todos (estilo WhatsApp "apagar para todos"). */
export const deleteMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db
      .from("messages")
      .update({ text: "", media_url: null, media_type: "deleted", reactions: [] })
      .eq("id", data.id);
    return { ok: true as const };
  });

type Judged = {
  guScore: number;
  liScore: number;
  guComment: string;
  liComment: string;
  winner: "gu" | "li" | "empate";
  summary: string;
};

/** Nota da IA para os esquadrões do jogo Leilão. */
export const judgeAuction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { theme: string; slots: string[]; gu: string[]; li: string[]; budget: number }) => d,
  )
  .handler(async ({ data }): Promise<Judged> => {
    await gate();
    const fmt = (arr: string[]) =>
      data.slots.map((s, i) => `${s}: ${arr[i] ?? "vazio"}`).join(" | ");
    const prompt = `Tema do leilão: ${data.theme}
Orçamento de cada jogador: R$${data.budget}
Esquadrão de "bb gu": ${fmt(data.gu)}
Esquadrão de "bb li": ${fmt(data.li)}

Avalie cada esquadrão de 0 a 10 (pode usar decimais) considerando qualidade/habilidade, fama, sucesso e história real de cada escolha, e o encaixe no tema. Seja justo e concreto: escolhas mais icônicas e vitoriosas valem mais. Comente em português brasileiro, curto e divertido (máx 2 frases por time).`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é um juiz divertido de um jogo de leilão. Responda SEMPRE chamando a função julgar.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "julgar",
                description: "Dá as notas dos dois esquadrões",
                parameters: {
                  type: "object",
                  properties: {
                    guScore: { type: "number" },
                    liScore: { type: "number" },
                    guComment: { type: "string" },
                    liComment: { type: "string" },
                    winner: { type: "string", enum: ["gu", "li", "empate"] },
                    summary: { type: "string" },
                  },
                  required: [
                    "guScore",
                    "liScore",
                    "guComment",
                    "liComment",
                    "winner",
                    "summary",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "julgar" } },
        }),
      });
      if (!res.ok) throw new Error(`ai_${res.status}`);
      const json = (await res.json()) as {
        choices?: {
          message?: { tool_calls?: { function?: { arguments?: string } }[] };
        }[];
      };
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) throw new Error("no_args");
      const parsed = JSON.parse(args) as Judged;
      return parsed;
    } catch {
      const score = () => Math.round((5 + Math.random() * 4) * 10) / 10;
      const g = score();
      const l = score();
      return {
        guScore: g,
        liScore: l,
        guComment: "Time equilibrado!",
        liComment: "Boas escolhas!",
        winner: g === l ? "empate" : g > l ? "gu" : "li",
        summary: "O juiz oficial cochilou, então valeu a nota rápida 😅",
      };
    }
  });
