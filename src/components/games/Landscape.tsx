import { useEffect, useState, type ReactNode } from "react";
import { Smartphone } from "lucide-react";

/** true quando a tela está deitada (largura > altura). */
export function useIsLandscape() {
  const [land, setLand] = useState(true);
  useEffect(() => {
    const upd = () => setLand(window.innerWidth >= window.innerHeight);
    upd();
    window.addEventListener("resize", upd);
    window.addEventListener("orientationchange", upd);
    return () => {
      window.removeEventListener("resize", upd);
      window.removeEventListener("orientationchange", upd);
    };
  }, []);
  return land;
}

/**
 * Tenta tela cheia + travar deitado (Android). Chame dentro de um toque do usuário.
 * No iPhone não existe trava: mostramos o aviso para girar.
 */
export async function enterLandscape() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    /* noop */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape");
  } catch {
    /* noop */
  }
}

export function exitLandscape() {
  try {
    const o = screen.orientation as ScreenOrientation & { unlock?: () => void };
    o.unlock?.();
  } catch {
    /* noop */
  }
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    /* noop */
  }
}

/** Envolve um jogo que deve ser jogado com o celular deitado. */
export function LandscapeGate({ children }: { children: ReactNode }) {
  const land = useIsLandscape();
  useEffect(() => () => exitLandscape(), []);
  return (
    <>
      {children}
      {!land && (
        <button
          type="button"
          onClick={() => void enterLandscape()}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-neutral-950/95 px-8 text-center text-white"
        >
          <Smartphone size={56} className="animate-[spin_2.4s_ease-in-out_infinite] rotate-90 text-pink-400" />
          <p className="text-lg font-bold">Gire o celular</p>
          <p className="text-sm text-white/60">Este jogo é feito para jogar com o celular deitado. Toque aqui para tela cheia.</p>
        </button>
      )}
    </>
  );
}
