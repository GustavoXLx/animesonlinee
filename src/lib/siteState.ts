import { useEffect, useState } from "react";
import { getSiteState, updateSiteState } from "@/lib/chat.functions";

export type SiteState = { chatOpen: boolean; note: string };

const DEFAULT_STATE: SiteState = { chatOpen: true, note: "" };

export async function fetchSiteState(): Promise<SiteState> {
  try {
    const s = await getSiteState();
    return { chatOpen: s.chatOpen, note: s.note };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function setSiteState(patch: Partial<{ chat_open: boolean; note: string }>) {
  try {
    await updateSiteState({ data: patch });
  } catch {
    /* noop */
  }
}

/** Live site state (bloqueio remoto do chat) — lido pelo servidor, sem acesso direto ao banco. */
export function useSiteState() {
  const [state, setState] = useState<SiteState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const s = await fetchSiteState();
      if (cancelled) return;
      setState(s);
      setLoaded(true);
    };
    load();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { ...state, loaded };
}
