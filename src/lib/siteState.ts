import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteState = { chatOpen: boolean; note: string };

const DEFAULT_STATE: SiteState = { chatOpen: true, note: "" };

export async function fetchSiteState(): Promise<SiteState> {
  const { data } = await supabase
    .from("site_state")
    .select("chat_open, note")
    .eq("id", "main")
    .maybeSingle();
  if (!data) return DEFAULT_STATE;
  return { chatOpen: data.chat_open, note: data.note ?? "" };
}

export async function setSiteState(patch: Partial<{ chat_open: boolean; note: string }>) {
  await supabase.from("site_state").update(patch).eq("id", "main");
}

/** Live site state (bloqueio remoto do chat). */
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

    const ch = supabase
      .channel("site-state")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_state" },
        (payload) => {
          const r = payload.new as { chat_open: boolean; note: string | null };
          setState({ chatOpen: r.chat_open, note: r.note ?? "" });
        },
      )
      .subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 8000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(ch);
    };
  }, []);

  return { ...state, loaded };
}
