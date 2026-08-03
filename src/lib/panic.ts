import { useEffect } from "react";

/** Limpa qualquer vestígio de sessão do chat. */
export function panicWipe() {
  try {
    sessionStorage.removeItem("chat-unlocked");
    sessionStorage.removeItem("chat-master");
    sessionStorage.removeItem("chat-me");
  } catch {
    /* noop */
  }
}

/**
 * Saída de emergência: 4 toques/cliques rápidos na tela ou tecla ESC
 * levam de volta ao site de animes e travam o acesso.
 */
export function usePanicExit(onExit: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let taps: number[] = [];

    const fire = () => {
      taps = [];
      panicWipe();
      onExit();
    };

    const onPointer = () => {
      const now = Date.now();
      taps = [...taps, now].filter((t) => now - t < 700);
      if (taps.length >= 4) fire();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fire();
    };

    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onExit]);
}

/** Trava o acesso se a aba ficar escondida por muito tempo (celular na mão de outra pessoa). */
export function useAutoLock(onExit: () => void, ms = 90_000) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(() => {
          panicWipe();
          onExit();
        }, ms);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timer) clearTimeout(timer);
    };
  }, [onExit, ms]);
}

/** Efeito especial válido somente em 03/08/2026 (horário local). */
export function isSpecialDay() {
  const d = new Date();
  return d.getFullYear() === 2026 && d.getMonth() === 7 && d.getDate() === 3;
}
