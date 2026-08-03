import { memo } from "react";

const CLAPS = ["👏", "👏🏻", "🙌", "👏🏼", "🎉", "👏"];
const ANGRY = ["😡", "🤬", "💢", "😤", "🔥", "😠"];

/** Efeito comemorativo/raivoso exibido ao entrar como bb li (somente hoje). */
export const LiEffect = memo(function LiEffect({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden bg-black/85 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.35),transparent_65%)]" />

      {Array.from({ length: 18 }).map((_, i) => {
        const emoji = i % 2 === 0 ? CLAPS[i % CLAPS.length] : ANGRY[i % ANGRY.length];
        return (
          <span
            key={i}
            className="absolute text-3xl select-none animate-emoji-rise"
            style={{
              left: `${(i * 5.7 + 3) % 96}%`,
              bottom: "-10%",
              animationDelay: `${(i % 9) * 0.35}s`,
              animationDuration: `${3.4 + (i % 5) * 0.5}s`,
            }}
          >
            {emoji}
          </span>
        );
      })}

      <div className="relative animate-rage-shake text-center">
        <p className="text-4xl mb-3">👏👏👏</p>
        <h2 className="text-2xl sm:text-3xl font-black leading-tight text-red-400 drop-shadow-[0_0_18px_rgba(239,68,68,0.8)]">
          EU TE AVISEI PRA ME OUVIR, MEUS PARABÉNS!
        </h2>
        <p className="text-3xl mt-3">😡🤬💢</p>
      </div>

      <button className="relative mt-10 text-xs text-white/50">toque para continuar</button>
    </div>
  );
});
