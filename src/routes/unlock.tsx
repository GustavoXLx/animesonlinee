import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/unlock")({
  head: () => ({ meta: [{ title: "Área restrita" }, { name: "robots", content: "noindex" }] }),
  component: Unlock,
});

function Unlock() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === "licegu") {
      sessionStorage.setItem("chat-unlocked", "1");
      nav({ to: "/chat" });
    } else {
      setErr(true);
      setPw("");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <button onClick={() => nav({ to: "/" })} className="p-4 text-white/60 self-start">
        <ArrowLeft size={22} />
      </button>
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
          <Lock size={28} />
        </div>
        <h1 className="text-xl font-bold">Conteúdo protegido</h1>
        <p className="text-sm text-white/50 mt-1 text-center">Digite a senha para continuar</p>
        <form onSubmit={submit} className="w-full max-w-xs mt-8">
          <input
            autoFocus
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            placeholder="Senha"
            className={`w-full bg-white/10 rounded-2xl px-4 py-3 outline-none text-center tracking-widest ${err ? "ring-2 ring-red-500" : ""}`}
          />
          {err && <p className="text-red-400 text-xs mt-2 text-center">Senha incorreta</p>}
          <button type="submit" className="w-full mt-4 bg-white text-black font-semibold py-3 rounded-2xl">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
