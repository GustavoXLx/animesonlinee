import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = {
  unlocked?: boolean;
  master?: boolean;
  /** só quem acertou o código na busca pode tentar a senha */
  armed?: boolean;
  armedMaster?: boolean;
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

async function isChatOpen() {
  try {
    const db = await admin();
    const { data } = await db.from("site_state").select("chat_open").eq("id", "main").maybeSingle();
    return data?.chat_open ?? true;
  } catch {
    return true;
  }
}

/** Verifica o código digitado na busca (nunca vai para o bundle do navegador). */
export const checkTrigger = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const code = (data.code ?? "").trim();
    // senha de coação digitada na busca: abre só o perfil falso, sempre
    if (matches(code.toLowerCase(), process.env["DURESS_PASSWORD"] || "naruto")) {
      const session = await useSession<GateSession>(sessionConfig());
      await session.clear();
      await slow(150);
      return { ok: true, master: false, decoy: true };
    }
    const master = matches(code, process.env["SITE_TRIGGER_MASTER"]);
    let normal = matches(code, process.env["SITE_TRIGGER_CODE"]);
    // bloqueado: o código normal vira uma busca comum
    if (normal && !master && !(await isChatOpen())) normal = false;
    if (!master && !normal) {
      await slow(150);
      return { ok: false, master: false, decoy: false };
    }
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ ...session.data, armed: true, armedMaster: master });
    return { ok: true, master, decoy: false };
  });

export const unlock = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const session = await useSession<GateSession>(sessionConfig());
    const now = Date.now();

    if (!session.data.armed) {
      await slow(600);
      return { ok: false as const };
    }
    if (session.data.blockedUntil && session.data.blockedUntil > now) {
      await slow(800);
      return { ok: false as const };
    }

    const pw = (data.password ?? "").trim();
    const master = matches(pw, process.env["MASTER_PASSWORD"]);
    let normal = matches(pw, process.env["SITE_PASSWORD"]);
    // bloqueado: só entra quem veio pelo código mestre
    if (normal && !master && !session.data.armedMaster && !(await isChatOpen())) normal = false;
    const duress = matches(pw.toLowerCase(), process.env["DURESS_PASSWORD"] || "naruto");
    if (duress && !master && !normal) {
      await session.clear();
      await slow(300);
      return { ok: true as const, decoy: true as const, master: false };
    }

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

    const isMaster = master || Boolean(session.data.armedMaster);
    await session.update({ unlocked: true, master: isMaster, armed: true, fails: 0 });
    return { ok: true as const, master: isMaster };
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

/** Usa o redimensionador do Storage para a grade, sem baixar a foto original inteira. */
function galleryPreviewUrl(url: string | null, mediaType: string | null) {
  if (!url || mediaType !== "image") return null;
  try {
    const preview = new URL(url);
    preview.pathname = preview.pathname.replace("/object/sign/", "/render/image/sign/");
    preview.searchParams.set("width", "360");
    preview.searchParams.set("height", "360");
    preview.searchParams.set("resize", "cover");
    preview.searchParams.set("quality", "68");
    return preview.toString();
  } catch {
    return url;
  }
}

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

export const listMedia = createServerFn({ method: "POST" })
  .inputValidator((d?: { limit?: number; before?: string }) => d ?? {})
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const limit = Math.min(Math.max(data.limit ?? 45, 1), 120);
    let q = db
      .from("messages")
      .select(
        "id, author, text, media_url, media_path, media_type, created_at, reactions, reply_to, seen_at, edited_at",
      )
      .not("media_path", "is", null)
      .in("media_type", ["image", "video"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows } = await q;
    const fresh = await refreshMedia(db, rows ?? []);
    const galleryRows = fresh.map((row) => ({
      ...row,
      media_preview_url: galleryPreviewUrl(row.media_url, row.media_type),
    }));
    return { rows: galleryRows, hasMore: (rows ?? []).length === limit };
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

/** Edita o texto da mensagem (permitido só nos 30 minutos após o envio). */
export const editMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; author: "gu" | "li"; text: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: row } = await db
      .from("messages")
      .select("created_at, author, media_type")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.author !== data.author) return { ok: false as const, reason: "not_yours" as const };
    if (row.media_type === "deleted") return { ok: false as const, reason: "deleted" as const };
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age > 30 * 60 * 1000) return { ok: false as const, reason: "expired" as const };
    const editedAt = new Date().toISOString();
    await db
      .from("messages")
      .update({ text: data.text.slice(0, 4000), edited_at: editedAt })
      .eq("id", data.id);
    return { ok: true as const, editedAt };
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
  guItems?: { item: string; note: number; why: string }[];
  liItems?: { item: string; note: number; why: string }[];
};

/** Nota da IA para os esquadrões do jogo Leilão. */
export const judgeAuction = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      theme: string;
      slots?: string[];
      gu: string[];
      li: string[];
      budget: number;
      football?: boolean;
    }) => d,
  )
  .handler(async ({ data }): Promise<Judged> => {
    await gate();
    const fmt = (arr: string[]) => (arr.length ? arr.join(" | ") : "vazio");
    const prompt = `Tema do leilão: ${data.theme}
Orçamento inicial de cada jogador: R$${data.budget}
Time de "bb gu": ${fmt(data.gu)}
Time de "bb li": ${fmt(data.li)}

Julgue com CRITÉRIO RIGOROSO, item por item:
1. Dê internamente uma nota de 0 a 10 para CADA item, baseada em fatos reais: qualidade/habilidade, conquistas, prestígio, impacto histórico e relevância atual. ${
      data.football
        ? "Em futebol, compare o jogador com os melhores da MESMA posição (goleiro com goleiro, defensor com defensor, etc.) e considere títulos, Bolas de Ouro, seleção e nível de clube."
        : "Compare cada item com os melhores possíveis dentro do tema."
    }
2. A nota final de cada time = média das notas dos itens dele (arredonde em 1 decimal). NÃO invente empate: só use "empate" se a diferença for exatamente 0.
3. O vencedor é obrigatoriamente quem tiver a maior nota final.
4. Nos comentários (máx 2 frases, português brasileiro, divertido), cite o item mais forte e o mais fraco do time e justifique. No "summary" diga a diferença de nota e o motivo decisivo.
Seja imparcial: ignore quem pagou mais caro, avalie só a qualidade real.`;


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
                "Você é um juiz técnico e imparcial de um jogo de leilão. Baseie tudo em fatos reais, dê nota individual a cada item e some/faça a média com honestidade. Responda SEMPRE chamando a função julgar.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "julgar",
                description: "Dá as notas item por item e a nota final dos dois times",
                parameters: {
                  type: "object",
                  properties: {
                    guItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          note: { type: "number" },
                          why: { type: "string" },
                        },
                        required: ["item", "note", "why"],
                        additionalProperties: false,
                      },
                    },
                    liItems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          note: { type: "number" },
                          why: { type: "string" },
                        },
                        required: ["item", "note", "why"],
                        additionalProperties: false,
                      },
                    },
                    guScore: { type: "number" },
                    liScore: { type: "number" },
                    guComment: { type: "string" },
                    liComment: { type: "string" },
                    winner: { type: "string", enum: ["gu", "li", "empate"] },
                    summary: { type: "string" },
                  },
                  required: [
                    "guItems",
                    "liItems",
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
      const avg = (items?: { note: number }[], fallback = 0) =>
        items && items.length
          ? Math.round((items.reduce((a, b) => a + (b.note ?? 0), 0) / items.length) * 10) / 10
          : fallback;
      const guScore = avg(parsed.guItems, parsed.guScore);
      const liScore = avg(parsed.liItems, parsed.liScore);
      return {
        ...parsed,
        guScore,
        liScore,
        winner: guScore === liScore ? "empate" : guScore > liScore ? "gu" : "li",
      };

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

/** Consulta leve: mensagens novas da outra pessoa depois de um instante. */
export const peekNew = createServerFn({ method: "POST" })
  .inputValidator((d: { me: "gu" | "li"; since?: string | null }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const other = data.me === "gu" ? "li" : "gu";
    let q = db
      .from("messages")
      .select("id, text, media_type, created_at")
      .eq("author", other)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data.since) q = q.gt("created_at", data.since);
    const { data: rows } = await q;
    const list = rows ?? [];
    const last = list[0];
    return {
      count: list.length,
      now: new Date().toISOString(),
      last: last
        ? { id: last.id, text: last.text ?? "", mediaType: last.media_type ?? null, createdAt: last.created_at }
        : null,
    };
  });

/** Playlist compartilhada do chat. */
export const listSongs = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const db = await admin();
  const { data: rows } = await db
    .from("playlist")
    .select("id, title, media_path, added_by, created_at")
    .order("created_at", { ascending: true });
  const list = rows ?? [];
  if (!list.length) return { rows: [] as { id: string; title: string; url: string | null; added_by: string }[] };
  const { data: signed } = await db.storage
    .from("chat-media")
    .createSignedUrls(list.map((r) => r.media_path), SIGNED_TTL);
  const map = new Map<string, string>();
  (signed ?? []).forEach((s) => s.path && s.signedUrl && map.set(s.path, s.signedUrl));
  return {
    rows: list.map((r) => ({ id: r.id, title: r.title, url: map.get(r.media_path) ?? null, added_by: r.added_by })),
  };
});

export const addSong = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; path: string; who: "gu" | "li" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db.from("playlist").insert({
      title: (data.title || "música").slice(0, 120),
      media_path: data.path,
      added_by: data.who === "li" ? "li" : "gu",
    });
    return { ok: true as const };
  });

export const deleteSong = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: row } = await db.from("playlist").select("media_path").eq("id", data.id).maybeSingle();
    if (row?.media_path) await db.storage.from("chat-media").remove([row.media_path]);
    await db.from("playlist").delete().eq("id", data.id);
    return { ok: true as const };
  });

/** Bios dos perfis. */
export const getBios = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const db = await admin();
  const { data: rows } = await db.from("chat_profiles").select("id, bio");
  const out = { gu: "", li: "" };
  (rows ?? []).forEach((r) => {
    if (r.id === "gu" || r.id === "li") out[r.id] = r.bio ?? "";
  });
  return out;
});

export const setBio = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; bio: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const who = data.who === "li" ? "li" : "gu";
    await db.from("chat_profiles").upsert({ id: who, bio: (data.bio ?? "").slice(0, 300) }, { onConflict: "id" });
    return { ok: true as const };
  });

/** Stories das últimas 24h. */
export const listStories = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const db = await admin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from("stories")
    .select("id, author, media_path, media_type, liked_by, seen_by, created_at, music")
    .gt("created_at", since)
    .order("created_at", { ascending: true });
  const list = rows ?? [];
  if (!list.length) return { rows: [] };
  const { data: signed } = await db.storage
    .from("chat-media")
    .createSignedUrls(list.map((r) => r.media_path), SIGNED_TTL);
  const map = new Map<string, string>();
  (signed ?? []).forEach((s) => s.path && s.signedUrl && map.set(s.path, s.signedUrl));
  return { rows: list.map((r) => ({ ...r, url: map.get(r.media_path) ?? null })) };
});

export const postStory = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; path: string; type: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db.from("stories").insert({
      author: data.who === "li" ? "li" : "gu",
      media_path: data.path,
      media_type: data.type === "video" ? "video" : "image",
    });
    return { ok: true as const };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db.from("stories").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const seeStory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; me: "gu" | "li" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: row } = await db.from("stories").select("seen_by").eq("id", data.id).maybeSingle();
    if (row && !row.seen_by.includes(data.me)) {
      await db.from("stories").update({ seen_by: [...row.seen_by, data.me] }).eq("id", data.id);
    }
    return { ok: true as const };
  });

/** Curte o story e avisa no chat. */
export const likeStory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; me: "gu" | "li" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: row } = await db
      .from("stories")
      .select("author, media_path, liked_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false as const };
    if (row.liked_by.includes(data.me)) {
      await db.from("stories").update({ liked_by: row.liked_by.filter((x) => x !== data.me) }).eq("id", data.id);
      return { ok: true as const, liked: false };
    }
    await db.from("stories").update({ liked_by: [...row.liked_by, data.me] }).eq("id", data.id);
    const name = (w: string) => (w === "gu" ? "bb gu" : "bb li");
    const { data: signed } = await db.storage.from("chat-media").createSignedUrl(row.media_path, SIGNED_TTL);
    await db.from("messages").insert({
      author: data.me,
      text: `${name(data.me)} curtiu um story de ${name(row.author)}`,
      media_type: "story_like",
      media_path: row.media_path,
      media_url: signed?.signedUrl ?? null,
    });
    return { ok: true as const, liked: true };
  });

export type Music = { title: string; artist: string; cover: string; preview: string };
const cleanMusic = (m: unknown): Music | null => {
  if (!m || typeof m !== "object") return null;
  const x = m as Record<string, unknown>;
  const s = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");
  const preview = s(x.preview, 600);
  if (!/^https:\/\//.test(preview)) return null;
  return { title: s(x.title, 120), artist: s(x.artist, 120), cover: s(x.cover, 600), preview };
};

/** Busca faixas na iTunes Search API (prévia de 30s). */
export const searchMusic = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => ({ q: String(d?.q ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    await gate();
    if (!data.q.trim()) return { rows: [] as Music[] };
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=20&country=BR&term=${encodeURIComponent(data.q)}`;
    let r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }).catch(() => null);
    if (!r || !r.ok) {
      // fallback: Deezer
      const d = await fetch(`https://api.deezer.com/search?limit=20&q=${encodeURIComponent(data.q)}`).catch(() => null);
      if (!d || !d.ok) return { rows: [] as Music[] };
      const dj = (await d.json()) as { data?: { title: string; preview: string; artist?: { name: string }; album?: { cover_medium: string } }[] };
      return {
        rows: (dj.data ?? []).filter((x) => x.preview).map((x) => ({
          title: x.title, artist: x.artist?.name ?? "", cover: x.album?.cover_medium ?? "", preview: x.preview,
        })),
      };
    }
    void r;
    const j = (await r.json()) as { results?: Record<string, string>[] };
    const rows = (j.results ?? [])
      .filter((x) => x.previewUrl)
      .map((x) => ({
        title: x.trackName ?? "",
        artist: x.artistName ?? "",
        cover: (x.artworkUrl100 ?? "").replace("100x100", "300x300"),
        preview: x.previewUrl,
      }));
    return { rows };
  });

export const setStoryMusic = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; path: string; music: Music | null; type?: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db.from("stories").insert({
      author: data.who === "li" ? "li" : "gu",
      media_path: data.path,
      media_type: data.type === "video" ? "video" : "image",
      music: cleanMusic(data.music),
    });
    return { ok: true as const };
  });

export const listNotes = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const db = await admin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from("notes")
    .select("id, author, text, music, liked_by, created_at")
    .gt("created_at", since)
    .order("created_at", { ascending: false });
  const out: { gu: null | Record<string, unknown>; li: null | Record<string, unknown> } = { gu: null, li: null };
  for (const r of rows ?? []) if ((r.author === "gu" || r.author === "li") && !out[r.author]) out[r.author] = r;
  return out as unknown as { gu: NoteRow | null; li: NoteRow | null };
});
export type NoteRow = { id: string; author: "gu" | "li"; text: string; music: Music | null; liked_by: string[]; created_at: string };

export const postNote = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; text: string; music: Music | null }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const who = data.who === "li" ? "li" : "gu";
    await db.from("notes").delete().eq("author", who);
    await db.from("notes").insert({ author: who, text: (data.text ?? "").slice(0, 60), music: cleanMusic(data.music) });
    return { ok: true as const };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li" }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    await db.from("notes").delete().eq("author", data.who === "li" ? "li" : "gu");
    return { ok: true as const };
  });

/** Curte ou responde uma nota (vira mensagem no chat). */
export const reactNote = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; me: "gu" | "li"; reply?: string }) => d)
  .handler(async ({ data }) => {
    await gate();
    const db = await admin();
    const { data: n } = await db.from("notes").select("author, text, music, liked_by").eq("id", data.id).maybeSingle();
    if (!n) return { ok: false as const };
    const name = (w: string) => (w === "gu" ? "bb gu" : "bb li");
    const m = n.music as Music | null;
    const quote = `“${n.text}”${m ? ` ♪ ${m.title} – ${m.artist}` : ""}`;
    const reply = (data.reply ?? "").trim().slice(0, 1000);
    if (!reply) {
      if (n.liked_by.includes(data.me)) return { ok: true as const };
      await db.from("notes").update({ liked_by: [...n.liked_by, data.me] }).eq("id", data.id);
    }
    await db.from("messages").insert({
      author: data.me,
      text: reply ? `↪ nota de ${name(n.author)}: ${quote}\n${reply}` : `${name(data.me)} curtiu a nota de ${name(n.author)}: ${quote}`,
    });
    return { ok: true as const };
  });


// ===================== Nossa Casa =====================
const HOME_FRESH = 15_000;
type Presence = { who: string; seen_at: string; together_date: string; together_s: number; sit_id: string | null; sit_at: string | null };

async function readPresence(sb: Awaited<ReturnType<typeof admin>>) {
  const { data } = await sb.from("home_presence").select("*");
  const rows = (data ?? []) as Presence[];
  const get = (w: string) => rows.find((r) => r.who === w);
  return { gu: get("gu"), li: get("li") };
}

function presenceCtx(p: { gu?: Presence; li?: Presence }, day: string) {
  const now = Date.now();
  const fresh = (r?: Presence) => !!r && now - new Date(r.seen_at).getTime() < HOME_FRESH;
  const both = fresh(p.gu) && fresh(p.li);
  const tog = (r?: Presence) => (r && r.together_date === day ? r.together_s : 0);
  const sitting = (r?: Presence) => fresh(r) && !!r!.sit_id;
  return {
    online: { gu: fresh(p.gu), li: fresh(p.li) },
    sits: { gu: sitting(p.gu) ? p.gu!.sit_id : null, li: sitting(p.li) ? p.li!.sit_id : null },
    ctx: { bothOnline: both, togetherS: Math.min(tog(p.gu), tog(p.li)), bothSitting: both && sitting(p.gu) && sitting(p.li) },
  };
}

/** Lê, altera e grava a casa com controle de versão (evita um sobrescrever o outro). */
async function mutateHome<T>(fn: (h: import("./home").Home) => T): Promise<{ home: import("./home").Home; out: T }> {
  const { normalize } = await import("./home");
  const sb = await admin();
  for (let i = 0; i < 4; i++) {
    const { data: row } = await sb.from("couple_home").select("data,version").eq("id", "main").maybeSingle();
    const h = normalize(row?.data as never);
    const out = fn(h);
    if (!row) {
      const { error } = await sb.from("couple_home").insert({ id: "main", data: h as never, version: 1 });
      if (!error) return { home: h, out };
      continue;
    }
    const { data: upd } = await sb
      .from("couple_home")
      .update({ data: h as never, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq("id", "main")
      .eq("version", row.version)
      .select("id");
    if (upd && upd.length) return { home: h, out };
  }
  throw new Error("Tente de novo");
}

const whoOk = (w: unknown): "gu" | "li" => {
  if (w !== "gu" && w !== "li") throw new Error("who");
  return w;
};

export const homePing = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; sit?: string | null }) => ({ who: whoOk(d.who), sit: d.sit === undefined ? undefined : d.sit ? String(d.sit).slice(0, 40) : null }))
  .handler(async ({ data }) => {
    await gate();
    const { today, checkMissions } = await import("./home");
    const sb = await admin();
    const day = today();
    const now = Date.now();
    let p = await readPresence(sb);
    const mine = p[data.who];
    const other = p[data.who === "gu" ? "li" : "gu"];
    const otherFresh = !!other && now - new Date(other.seen_at).getTime() < HOME_FRESH;
    const prevSeen = mine ? new Date(mine.seen_at).getTime() : 0;
    let tog = mine && mine.together_date === day ? mine.together_s : 0;
    if (otherFresh && now - prevSeen < HOME_FRESH) tog += Math.round((now - prevSeen) / 1000);
    const row: Record<string, unknown> = { who: data.who, seen_at: new Date(now).toISOString(), together_date: day, together_s: tog };
    if (data.sit !== undefined) {
      row.sit_id = data.sit;
      row.sit_at = data.sit ? new Date(now).toISOString() : null;
    }
    await sb.from("home_presence").upsert(row as never);
    p = await readPresence(sb);
    const pc = presenceCtx(p, day);
    const { home } = await mutateHome((h) => checkMissions(h, pc.ctx));
    return { home, online: pc.online, sits: pc.sits, together: pc.ctx.togetherS };
  });

export const homeAct = createServerFn({ method: "POST" })
  .inputValidator((d: { who: "gu" | "li"; action: unknown }) => {
    whoOk(d.who);
    if (!d.action || typeof d.action !== "object") throw new Error("action");
    return d as { who: "gu" | "li"; action: import("./home").HomeAction };
  })
  .handler(async ({ data }) => {
    await gate();
    const { applyHome, checkMissions, today } = await import("./home");
    const sb = await admin();
    const pc = presenceCtx(await readPresence(sb), today());
    const otherOnline = pc.online[data.who === "gu" ? "li" : "gu"];
    try {
      const { home, out } = await mutateHome((h) => {
        const msg = applyHome(h, data.who, data.action, otherOnline);
        checkMissions(h, pc.ctx);
        return msg;
      });
      return { home, msg: out, error: null as string | null };
    } catch (e) {
      return { home: null, msg: "", error: e instanceof Error ? e.message : "erro" };
    }
  });

/** Links das fotos dos quadros da casa. */
export const homeFrameUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { paths: string[] }) => ({ paths: (Array.isArray(d.paths) ? d.paths : []).map(String).slice(0, 8) }))
  .handler(async ({ data }) => {
    await gate();
    const { FRAME_PATH_RE } = await import("./home");
    const paths = data.paths.filter((p) => FRAME_PATH_RE.test(p));
    if (!paths.length) return {} as Record<string, string>;
    const db = await admin();
    const { data: signed } = await db.storage.from("chat-media").createSignedUrls(paths, SIGNED_TTL);
    const out: Record<string, string> = {};
    (signed ?? []).forEach((s) => s.path && s.signedUrl && (out[s.path] = s.signedUrl));
    return out;
  });

/** Gera cartas do jogo Embraza (Eu Nunca / O Mais Provável) a partir de um tema. */
export const genPartyPrompts = createServerFn({ method: "POST" })
  .inputValidator((d: { mode: "nunca" | "provavel"; level: string; theme: string }) => ({
    mode: d.mode === "provavel" ? "provavel" : "nunca",
    level: ["fofo", "engracado", "apimentado"].includes(d.level) ? d.level : "fofo",
    theme: String(d.theme ?? "").slice(0, 80),
  }))
  .handler(async ({ data }): Promise<{ prompts: string[]; error?: string }> => {
    await gate();
    const tone =
      data.level === "apimentado"
        ? "ousado e provocante, para um casal adulto, mas SEM conteúdo sexual explícito"
        : data.level === "engracado"
          ? "engraçado e constrangedor"
          : "fofo e romântico";
    const format =
      data.mode === "nunca"
        ? 'frases começando com "Eu nunca"'
        : 'perguntas começando com "Quem é mais provável de" e terminando com "?"';
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions:
          "Você cria cartas para um jogo de casal (namorados, os dois são 'bb gu' e 'bb li'). Português brasileiro. PROIBIDO: ex, crushes, primeiro beijo, qualquer pessoa ou relacionamento antes do casal, terceiros atraentes, flerte com outros, ciúmes, traição, desconfiança. Responda APENAS com um array JSON de strings.",
        input: `Crie 15 ${format}, tom ${tone}, sobre o tema: "${data.theme || "nós dois"}". Curtas (máx 110 caracteres), todas diferentes.`,
      }),
    });
    if (!res.ok) {
      const msg = res.status === 429 ? "Muitos pedidos, tente em instantes." : res.status === 402 ? "Créditos de IA esgotados." : "Não deu pra gerar agora.";
      return { prompts: [], error: msg };
    }
    const j = (await res.json()) as {
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
    };
    const text =
      j.output_text ??
      (j.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("");
    const m = text.match(/\[[\s\S]*\]/);
    try {
      const arr = JSON.parse(m ? m[0] : "[]") as unknown[];
      const prompts = arr.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 140)).slice(0, 20);
      return prompts.length ? { prompts } : { prompts: [], error: "A IA não respondeu, tente outro tema." };
    } catch {
      return { prompts: [], error: "A IA não respondeu, tente outro tema." };
    }
  });
