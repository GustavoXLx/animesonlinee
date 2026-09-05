import { memo, useEffect, useState } from "react";
import cake from "@/assets/bday/cake.png";
import balloons from "@/assets/bday/balloons.png";
import heart from "@/assets/bday/heart.png";

/** Animação de aniversário da bb li (só no dia). */
export const BirthdayEffect = memo(function BirthdayEffect({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 900);
    const t2 = setTimeout(() => setStep(2), 2200);
    const t3 = setTimeout(() => setStep(3), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, #4a1136 0%, #2a0b23 45%, #12060f 100%)",
      }}
      onClick={step >= 3 ? onClose : undefined}
    >
      {/* brilhos ao fundo */}
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={`s${i}`}
          className="absolute rounded-full bg-white/80 animate-twinkle"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${(i * 7.3 + 4) % 97}%`,
            top: `${(i * 13.7 + 6) % 92}%`,
            animationDelay: `${(i % 7) * 0.4}s`,
          }}
        />
      ))}

      {/* corações subindo */}
      {Array.from({ length: 14 }).map((_, i) => (
        <img
          key={`h${i}`}
          src={heart}
          alt=""
          loading="lazy"
          className="absolute select-none animate-heart-float opacity-0"
          style={{
            width: `${20 + (i % 4) * 12}px`,
            left: `${(i * 7.1 + 2) % 94}%`,
            bottom: "-12%",
            animationDelay: `${(i % 8) * 0.55}s`,
            animationDuration: `${6 + (i % 4)}s`,
          }}
        />
      ))}

      <img
        src={balloons}
        alt=""
        loading="lazy"
        className="pointer-events-none absolute -left-6 top-2 w-40 opacity-90 animate-sway"
      />
      <img
        src={balloons}
        alt=""
        loading="lazy"
        className="pointer-events-none absolute -right-8 top-16 w-32 opacity-80 animate-sway"
        style={{ animationDelay: "1.2s", transform: "scaleX(-1)" }}
      />

      <div className="relative flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-glow-pulse rounded-full bg-pink-400/40 blur-3xl" />
          <img
            src={cake}
            alt="bolo de aniversário"
            className="w-56 sm:w-64 animate-cake-in drop-shadow-[0_10px_30px_rgba(255,150,200,0.45)]"
            width={768}
            height={768}
          />
        </div>

        <p className="mt-6 text-[11px] uppercase tracking-[0.4em] text-pink-200/70 animate-fade-in">
          um recadinho só seu
        </p>

        <h1 className="mt-2 text-4xl sm:text-5xl font-black leading-tight animate-title-in bg-gradient-to-r from-pink-200 via-fuchsia-300 to-rose-200 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,120,190,0.5)]">
          Feliz Aniversário,
          <br />
          bb li
        </h1>

        {step >= 1 && (
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-pink-100/90 animate-fade-in">
            hoje o mundo inteiro ficou mais bonito só porque é o seu dia.
          </p>
        )}
        {step >= 2 && (
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-pink-100/80 animate-fade-in">
            obrigado por existir do meu lado. que esse ano te traga tudo o que
            você sonha, e um pouquinho mais.
          </p>
        )}
        {step >= 3 && (
          <>
            <p className="mt-4 text-base font-semibold text-pink-200 animate-fade-in">
              eu te amo, hoje e sempre.
            </p>
            <button
              onClick={onClose}
              className="mt-8 rounded-full border border-pink-300/40 bg-white/10 px-6 py-2.5 text-xs font-semibold text-pink-100 backdrop-blur animate-fade-in active:scale-95 transition"
            >
              obrigada, meu amor
            </button>
          </>
        )}
      </div>
    </div>
  );
});
