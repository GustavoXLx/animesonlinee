import { useCallback, useState } from "react";
import { Lock } from "lucide-react";
import { unlock, lock } from "@/lib/chat.functions";
import { panicWipe, usePanicExit, useIdleLock } from "@/lib/panic";
import { SecretChat } from "./SecretChat";
import { DecoyProfile } from "./DecoyProfile";

/**
 * Portão + chat renderizados dentro da própria home (mesma URL, mesmo título),
 * então nada aparece separado no histórico do navegador.
 */
export function SecretGate({
  onExit,
  startDecoy = false,
}: {
  onExit: () => void;
  startDecoy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [decoy, setDecoy] = useState(startDecoy);
  const [master, setMaster] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const leave = useCallback(() => {
    panicWipe();
    void lock().catch(() => {});
    setPw("");
    setOpen(false);
    setDecoy(false);
    setMaster(false);
    onExit();
  }, [onExit]);

  usePanicExit(leave);
  useIdleLock(leave);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const submittedPassword = new FormData(e.currentTarget).get("password");
    const password = typeof submittedPassword === "string" ? submittedPassword : pw;
    setBusy(true);
    try {
      const res = await unlock({ data: { password: password.trim() } });
      setPw("");
      if (res.ok && "decoy" in res && res.decoy) {
        setDecoy(true);
      } else if (res.ok) {
        setMaster(Boolean(res.master));
        setOpen(true);
      } else {
        setErr(true);
      }
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  if (decoy) return <DecoyProfile onExit={leave} />;
  if (open) return <SecretChat onExit={leave} master={master} />;

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white flex flex-col">
      <button onClick={leave} className="p-4 text-white/50 self-start text-xs">
        cancelar
      </button>
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
          <Lock size={28} />
        </div>
        <h1 className="text-xl font-bold">Conteúdo restrito</h1>
        <p className="text-sm text-white/50 mt-1 text-center">
          Verificação de idade · digite o código de acesso
        </p>
        <form onSubmit={submit} className="w-full max-w-xs mt-8">
          <input
            autoFocus
            type="password"
            name="password"
            inputMode="text"
            autoComplete="current-password"
            value={pw}
            onInput={(e) => {
              setPw(e.target.value);
              setErr(false);
            }}
            placeholder="Código"
            className={`w-full bg-white/10 rounded-2xl px-4 py-3 outline-none text-center tracking-widest ${
              err ? "ring-2 ring-red-500" : ""
            }`}
          />
          {err && <p className="text-red-400 text-xs mt-2 text-center">Código inválido</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-4 bg-white text-black font-semibold py-3 rounded-2xl disabled:opacity-50"
          >
            {busy ? "Verificando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
