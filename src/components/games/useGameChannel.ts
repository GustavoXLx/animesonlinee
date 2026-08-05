import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Me = "gu" | "li";

export function useGameChannel<T>(gameKey: string | null, me: Me, initial: T) {
  const [state, setStateLocal] = useState<T>(initial);
  const [peerOnline, setPeerOnline] = useState(false);
  const stateRef = useRef<T>(initial);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const listenersRef = useRef<Record<string, (payload: unknown, from: Me) => void>>({});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!gameKey) return;
    setStateLocal(initial);
    stateRef.current = initial;
    const other: Me = me === "gu" ? "li" : "gu";
    const channel = supabase.channel(`game-${gameKey}`, {
      config: { presence: { key: me }, broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "state" }, (payload) => {
        const p = payload.payload as { state: T; from: Me };
        if (p?.from === me) return;
        if (p?.state !== undefined) {
          stateRef.current = p.state;
          setStateLocal(p.state);
        }
      })
      .on("broadcast", { event: "sync-request" }, (payload) => {
        if ((payload.payload as { from?: Me })?.from !== me) {
          channel.send({
            type: "broadcast",
            event: "state",
            payload: { state: stateRef.current, from: me },
          });
        }
      })
      .on("broadcast", { event: "msg" }, (payload) => {
        const p = payload.payload as { event: string; data: unknown; from: Me };
        if (p?.from === me) return;
        listenersRef.current[p.event]?.(p.data, p.from);
      })
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState();
        setPeerOnline(Boolean(st[other]?.length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
          channel.send({ type: "broadcast", event: "sync-request", payload: { from: me } });
        }
      });

    chanRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey, me]);

  const setState = useCallback(
    (next: T | ((p: T) => T)) => {
      setStateLocal((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        stateRef.current = value;
        chanRef.current?.send({
          type: "broadcast",
          event: "state",
          payload: { state: value, from: me },
        });
        return value;
      });
    },
    [me],
  );

  const sendEvent = useCallback(
    (event: string, data: unknown) => {
      chanRef.current?.send({
        type: "broadcast",
        event: "msg",
        payload: { event, data, from: me },
      });
    },
    [me],
  );

  const onEvent = useCallback((event: string, cb: (data: unknown, from: Me) => void) => {
    listenersRef.current[event] = cb as (p: unknown, from: Me) => void;
    return () => {
      delete listenersRef.current[event];
    };
  }, []);

  return { state, setState, peerOnline, sendEvent, onEvent };
}
