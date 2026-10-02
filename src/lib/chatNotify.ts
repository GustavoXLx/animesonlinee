import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { issueDeviceToken, peekDevice } from "@/lib/chat.functions";

const WHO_KEY = "as_pref_who";
const SINCE_KEY = "as_pref_mark";
const TOKEN_KEY = "as_pref_dev";
const FEED = "as-feed-ping";

/** Guarda quem usa este aparelho e pega o token do aparelho. */
export function rememberWho(who: "gu" | "li") {
  try {
    localStorage.setItem(WHO_KEY, who);
    window.dispatchEvent(new Event("as-notify-identity"));
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t || !t.startsWith(who + ".")) {
      void issueDeviceToken({ data: { who } })
        .then((r) => localStorage.setItem(TOKEN_KEY, r.token))
        .catch(() => {});
    }
  } catch {
    /* noop */
  }
}

export function getWho(): "gu" | "li" | null {
  try {
    const v = localStorage.getItem(WHO_KEY);
    return v === "gu" || v === "li" ? v : null;
  } catch {
    return null;
  }
}

export function markNotifiedNow() {
  try {
    localStorage.setItem(SINCE_KEY, new Date().toISOString());
  } catch {
    /* noop */
  }
}

/** Avisa os outros aparelhos na hora (sem conteúdo nenhum). */
let pingCh: ReturnType<typeof supabase.channel> | null = null;
export function pingFeed() {
  try {
    if (!pingCh) {
      pingCh = supabase.channel(FEED);
      pingCh.subscribe();
    }
    void pingCh.send({ type: "broadcast", event: "p", payload: {} });
  } catch {
    /* noop */
  }
}

function preview(text: string, mediaType: string | null) {
  if (text) return text.slice(0, 120);
  if (mediaType === "sticker") return "figurinha";
  if (mediaType === "audio") return "áudio";
  if (mediaType === "video") return "vídeo";
  if (mediaType === "image") return "foto";
  return "nova mensagem";
}

/**
 * Fora do chat: bolinha no sino (os dois) + aviso do navegador (só bb gu).
 * Retorna se há mensagem não vista do outro.
 */
export function useChatNotifier(active: boolean) {
  const lastIdRef = useRef<string | null>(null);
  const [unread, setUnread] = useState(false);
  const [identityVersion, setIdentityVersion] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    const refresh = () => setIdentityVersion((value) => value + 1);
    window.addEventListener("as-notify-identity", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("as-notify-identity", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const who = getWho();
    const canNotify = who === "gu" && "Notification" in window;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const notify = (body: string, count: number) => {
      if (!canNotify || Notification.permission !== "granted") return;
      try {
        const n = new Notification(
          count > 1 ? `${count} novos episódios disponíveis` : "Novo episódio disponível",
          { body, tag: "as-feed", renotify: true } as NotificationOptions,
        );
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* noop */
      }
    };

    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        let since = localStorage.getItem(SINCE_KEY);
        if (!since) {
          since = new Date().toISOString();
          localStorage.setItem(SINCE_KEY, since);
        }
        const res = await peekDevice({ data: { token, since } });
        if (cancelled) return;
        setUnread(res.unread);
        if (res.count > 0 && res.last && res.last.id !== lastIdRef.current) {
          lastIdRef.current = res.last.id;
          notify(preview(res.last.text, res.last.mediaType), res.count);
          localStorage.setItem(SINCE_KEY, res.last.createdAt);
        }
      } catch {
        /* silencioso */
      } finally {
        running = false;
      }
    };
    const loop = async () => {
      await tick();
      if (cancelled) return;
      timer = setTimeout(loop, document.visibilityState === "visible" ? 4000 : 10000);
    };
    void loop();

    // chegada instantânea: o outro aparelho dá um "ping" ao enviar
    const ch = supabase.channel(FEED).on("broadcast", { event: "p" }, () => void tick()).subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [active, identityVersion]);

  const who = typeof window === "undefined" ? null : getWho();
  const requestPermission = async () => {
    if (who !== "gu" || !("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    if (window.top !== window.self) return "open-in-new-tab" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return { unread, permission, canRequest: who === "gu", requestPermission };
}
