import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { issueDeviceToken, peekDevice, getPushKey, savePushSub } from "@/lib/chat.functions";

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const inFrame = () => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
};

async function swReg() {
  if (!("serviceWorker" in navigator) || inFrame()) return null;
  try {
    return await navigator.serviceWorker.register("/push-sw.js");
  } catch {
    return null;
  }
}

/** iPhone só aceita avisos com o site instalado na Tela de Início. */
export function iosNeedsInstall() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return ios && !standalone;
}

/** Inscreve este aparelho (bb gu) para receber avisos mesmo com o site fechado. */
export async function ensurePush(): Promise<boolean> {
  try {
    if (getWho() !== "gu" || !("Notification" in window) || Notification.permission !== "granted") return false;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !("PushManager" in window)) return false;
    const reg = await swReg();
    if (!reg) return false;
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await getPushKey();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    }
    const r = await savePushSub({ data: { token, endpoint: sub.endpoint } });
    return r.ok;
  } catch {
    return false;
  }
}

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
        .then((r) => {
          localStorage.setItem(TOKEN_KEY, r.token);
          void ensurePush();
        })
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
  const [hydrated, setHydrated] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setHydrated(true);
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
      const title = count > 1 ? `${count} novos episódios disponíveis` : "Novo episódio disponível";
      const opts = { body, tag: "as-feed", renotify: true, icon: "/favicon.ico" } as NotificationOptions;
      // Android não aceita "new Notification": usa o service worker
      void (async () => {
        try {
          const reg = "serviceWorker" in navigator && !inFrame() ? await navigator.serviceWorker.getRegistration() : null;
          if (reg) return void (await reg.showNotification(title, opts));
          const n = new Notification(title, opts);
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* noop */
        }
      })();
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

  const who = hydrated ? getWho() : null;
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!hydrated || who !== "gu") return;
    void ensurePush().then(setSubscribed);
  }, [hydrated, who, identityVersion]);

  const requestPermission = async () => {
    if (who !== "gu") return "unsupported" as const;
    if (inFrame()) return "open-in-new-tab" as const;
    if (!("Notification" in window)) {
      if (iosNeedsInstall()) return "ios-install" as const;
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      const ok = await ensurePush();
      setSubscribed(ok);
      if (!ok && !localStorage.getItem(TOKEN_KEY)) return "need-chat" as const;
    }
    return result;
  };

  return { unread, permission, subscribed, canRequest: who === "gu", requestPermission };
}
