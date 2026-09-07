import { useEffect, useRef } from "react";
import { peekNew } from "@/lib/chat.functions";

const WHO_KEY = "as_pref_who";
const SINCE_KEY = "as_pref_mark";

/** Guarda quem usa este aparelho (só o bb gu recebe aviso). */
export function rememberWho(who: "gu" | "li") {
  try {
    localStorage.setItem(WHO_KEY, who);
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

/** Marca tudo como visto até agora (chamado quando o chat está aberto). */
export function markNotifiedNow() {
  try {
    localStorage.setItem(SINCE_KEY, new Date().toISOString());
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
 * Vigia discreto: enquanto o chat NÃO está aberto, checa mensagens novas
 * e mostra um aviso do navegador (só no aparelho do bb gu).
 */
export function useChatNotifier(active: boolean) {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const who = getWho();
    if (who !== "gu" || !("Notification" in window)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const askOnce = () => {
      if (Notification.permission === "default") void Notification.requestPermission();
      window.removeEventListener("pointerdown", askOnce);
    };
    if (Notification.permission === "default") {
      window.addEventListener("pointerdown", askOnce, { once: true });
    }

    const notify = (body: string, count: number) => {
      if (Notification.permission !== "granted") return;
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

    const tick = async () => {
      try {
        let since = localStorage.getItem(SINCE_KEY);
        if (!since) {
          since = new Date().toISOString();
          localStorage.setItem(SINCE_KEY, since);
        }
        const res = await peekNew({ data: { me: "gu", since } });
        if (cancelled) return;
        if (res.count > 0 && res.last && res.last.id !== lastIdRef.current) {
          lastIdRef.current = res.last.id;
          notify(preview(res.last.text, res.last.mediaType), res.count);
          localStorage.setItem(SINCE_KEY, res.last.createdAt);
        }
      } catch {
        /* sessão fechada — silencioso */
      }
      if (cancelled) return;
      timer = setTimeout(tick, document.visibilityState === "visible" ? 3500 : 12000);
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pointerdown", askOnce);
    };
  }, [active]);
}
