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
 * Saída de emergência: 8 toques BEM rápidos na tela (ou tecla ESC).
 * Rolagem, arraste e toques espaçados nunca disparam.
 */
export function usePanicExit(onExit: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let taps: number[] = [];
    let start: { x: number; y: number } | null = null;
    let moved = false;
    let lastScroll = 0;

    const fire = () => {
      taps = [];
      panicWipe();
      onExit();
    };

    const onScroll = () => {
      lastScroll = Date.now();
      taps = [];
    };

    const onDown = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
      moved = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) moved = true;
    };

    const onUp = () => {
      const now = Date.now();
      // ignora se acabou de rolar a tela ou se o dedo arrastou (scroll/swipe)
      if (moved || now - lastScroll < 500) {
        taps = [];
        start = null;
        return;
      }
      start = null;
      // toques precisam ser bem rápidos: intervalo máximo de 280ms entre eles
      if (taps.length && now - taps[taps.length - 1] > 280) taps = [];
      taps.push(now);
      if (taps.length >= 8) fire();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fire();
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onScroll, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("touchmove", onScroll, true);
    window.addEventListener("wheel", onScroll, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onScroll, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("touchmove", onScroll, true);
      window.removeEventListener("wheel", onScroll, true);
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

/** Aniversário da bb li: válido somente em 05/09/2026 (horário local). */
export function isBirthdayDay() {
  const d = new Date();
  return d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 5;
}
