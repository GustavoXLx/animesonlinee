import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Heart, Hammer, ShoppingBag, Shirt, PawPrint, Target, RotateCw, Package, Check, Hand, ArrowUpFromLine, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { homeAct, homePing } from "@/lib/chat.functions";
import {
  CATALOG, CAT_BY_KEY, CHARACTERS, FLOORS, MISSIONS, PETS, ROOM, TOGETHER_GOAL, WALLS, BONUS, petStats,
  type Home, type HomeAction, type PlacedItem, type Who,
} from "@/lib/home";
import type { Avatar } from "./HouseScene";

const HouseScene = lazy(() => import("./HouseScene"));

type Panel = null | "shop" | "box" | "char" | "pet" | "missions";
const other = (w: Who): Who => (w === "gu" ? "li" : "gu");
const CAT_NAMES = { sala: "Sala", quarto: "Quarto", cozinha: "Cozinha", decor: "Decoração" } as const;

export function NossaCasa({ me, onClose, onGames }: { me: Who; onClose: () => void; onGames?: () => void }) {
  const ping = useServerFn(homePing);
  const act = useServerFn(homeAct);
  const [home, setHome] = useState<Home | null>(null);
  const [online, setOnline] = useState<Record<Who, boolean>>({ gu: false, li: false });
  const [together, setTogether] = useState(0);
  const [avatars, setAvatars] = useState<Record<Who, Avatar>>({
    gu: { x: 2.4, z: 2.6, sit: null, emote: null, emoteAt: 0 },
    li: { x: 3.6, z: 2.6, sit: null, emote: null, emoteAt: 0 },
  });
  const [panel, setPanel] = useState<Panel>(null);
  const [decor, setDecor] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<(PlacedItem & { fromBox?: boolean }) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [petAction, setPetAction] = useState<{ name: string; at: number } | null>(null);
  const [cat, setCat] = useState<keyof typeof CAT_NAMES>("sala");
  const [petName, setPetName] = useState("");
  const [busy, setBusy] = useState(false);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const avRef = useRef(avatars);
  avRef.current = avatars;
  const pendingSit = useRef<string | null | undefined>(undefined);

  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((c) => (c === t ? null : c)), 2600);
  };

  // presença + estado a cada 4s
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const sit = pendingSit.current;
        pendingSit.current = undefined;
        const r = await ping({ data: { who: me, ...(sit !== undefined ? { sit } : {}) } });
        if (!alive) return;
        setHome((prev) => {
          if (prev && r.home.log[0] && r.home.log[0].t !== prev.log[0]?.t && Date.now() - r.home.log[0].t < 8000) say(r.home.log[0].text);
          return r.home;
        });
        setOnline(r.online);
        setTogether(r.together);
      } catch {
        /* rede instável: tenta no próximo */
      }
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
      ping({ data: { who: me, sit: null } }).catch(() => {});
    };
  }, [me, ping]);

  // movimento em tempo real (só manda quando muda o destino)
  useEffect(() => {
    const ch = supabase.channel("nossa-casa-v2", { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "av" }, ({ payload }) => {
      const p = payload as { who: Who; av: Avatar };
      if (p.who === me) return;
      setAvatars((a) => ({ ...a, [p.who]: p.av }));
    });
    ch.on("broadcast", { event: "hello" }, ({ payload }) => {
      if ((payload as { who: Who }).who === me) return;
      ch.send({ type: "broadcast", event: "av", payload: { who: me, av: avRef.current[me] } });
    });
    ch.on("broadcast", { event: "pet" }, ({ payload }) => setPetAction(payload as { name: string; at: number }));
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "hello", payload: { who: me } });
        ch.send({ type: "broadcast", event: "av", payload: { who: me, av: avRef.current[me] } });
      }
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me]);

  const moveMe = useCallback(
    (patch: Partial<Avatar>) => {
      setAvatars((a) => {
        const next = { ...a[me], ...patch };
        chRef.current?.send({ type: "broadcast", event: "av", payload: { who: me, av: next } });
        return { ...a, [me]: next };
      });
    },
    [me],
  );

  const run = async (action: HomeAction) => {
    setBusy(true);
    try {
      const r = await act({ data: { who: me, action } });
      if (r.error) say(r.error);
      else {
        if (r.home) setHome(r.home);
        if (r.msg) say(r.msg);
      }
      return !r.error;
    } catch {
      say("Sem conexão, tente de novo");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onFloor = (x: number, z: number) => {
    const cx = Math.max(0.3, Math.min(ROOM - 0.3, x));
    const cz = Math.max(0.3, Math.min(ROOM - 0.3, z));
    if (decor) {
      if (ghost) setGhost({ ...ghost, x: Math.round(cx * 4) / 4, z: Math.round(cz * 4) / 4 });
      else setSelected(null);
      return;
    }
    if (avatars[me].sit) pendingSit.current = null;
    moveMe({ x: cx, z: cz, sit: null });
  };

  const onItem = (it: PlacedItem) => {
    if (decor) {
      if (ghost) return;
      setSelected(it.uid);
      return;
    }
    const c = CAT_BY_KEY[it.k];
    if (c?.seat) {
      pendingSit.current = it.uid;
      moveMe({ sit: it.uid, x: it.x, z: it.z });
    } else {
      moveMe({ x: Math.max(0.3, Math.min(ROOM - 0.3, it.x + 0.6)), z: Math.max(0.3, Math.min(ROOM - 0.3, it.z + 0.6)), sit: null });
    }
  };

  const emote = (name: string) => {
    if (avatars[me].sit) pendingSit.current = null;
    moveMe({ emote: name, emoteAt: Date.now(), sit: null });
  };

  const petDo = async (t: "feed" | "pat") => {
    const ok = await run({ t });
    if (ok) {
      const a = { name: t === "feed" ? "eat" : "gesture-positive", at: Date.now() };
      setPetAction(a);
      chRef.current?.send({ type: "broadcast", event: "pet", payload: a });
      if (!online[other(me)]) say("Conta pra missão só quando os dois estão em casa");
    }
  };

  const confirmGhost = async () => {
    if (!ghost) return;
    const ok = ghost.fromBox
      ? await run({ t: "place", key: ghost.k, x: ghost.x, z: ghost.z, r: ghost.r })
      : await run({ t: "move", uid: ghost.uid, x: ghost.x, z: ghost.z, r: ghost.r });
    if (ok) {
      setGhost(null);
      setSelected(null);
    }
  };

  if (!home) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2a1f2b] text-white/80">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-pink-300/30 border-t-pink-300" />
          <p className="text-sm">Abrindo a casa...</p>
        </div>
      </div>
    );
  }

  const sel = home.items.find((i) => i.uid === selected);
  const doneCount = MISSIONS.filter((m) => home.missions[m.id]).length;
  const partner = other(me);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden text-white" style={{ background: "radial-gradient(120% 90% at 50% 20%, #5b4058 0%, #2a1f2b 60%, #1a1319 100%)" }}>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <HouseScene
            home={home}
            me={me}
            avatars={avatars}
            online={online}
            decor={decor}
            selected={selected}
            ghost={ghost}
            petAction={petAction}
            onFloor={onFloor}
            onItem={onItem}
            onPet={() => setPanel("pet")}
          />
        </Suspense>
      </div>

      {/* topo */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3">
        <button onClick={onClose} className="rounded-full bg-black/40 p-2 backdrop-blur" aria-label="Sair da casa">
          <X size={18} />
        </button>
        <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-bold backdrop-blur">
          <Heart size={15} className="fill-pink-400 text-pink-400" /> {home.coins}
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur">
          <span className={`h-2 w-2 rounded-full ${online[partner] ? "bg-emerald-400" : "bg-white/30"}`} />
          {partner === "gu" ? "bb gu" : "bb li"} {online[partner] ? "está em casa" : "fora de casa"}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}

      {/* barra de decoração */}
      {decor && (
        <div className="absolute inset-x-0 top-16 mx-auto flex w-fit items-center gap-2 rounded-2xl bg-black/55 p-2 text-xs backdrop-blur">
          {ghost ? (
            <>
              <span className="px-2 text-white/80">Toque no chão pra posicionar</span>
              <Tool icon={<RotateCw size={15} />} label="Girar" onClick={() => setGhost({ ...ghost, r: (ghost.r + 1) % 4 })} />
              <Tool icon={<Check size={15} />} label="Colocar" onClick={confirmGhost} disabled={busy} strong />
              <Tool icon={<X size={15} />} label="Cancelar" onClick={() => setGhost(null)} />
            </>
          ) : sel ? (
            <>
              <span className="px-2 font-semibold">{CAT_BY_KEY[sel.k]?.name}</span>
              <Tool icon={<Hand size={15} />} label="Mover" onClick={() => setGhost({ ...sel })} />
              <Tool icon={<RotateCw size={15} />} label="Girar" onClick={() => run({ t: "move", uid: sel.uid, x: sel.x, z: sel.z, r: sel.r + 1 })} disabled={busy} />
              <Tool icon={<Package size={15} />} label="Guardar" onClick={async () => (await run({ t: "store", uid: sel.uid })) && setSelected(null)} disabled={busy} />
            </>
          ) : (
            <span className="px-2 text-white/80">Toque num móvel pra mexer nele</span>
          )}
        </div>
      )}

      {/* rodapé */}
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {!decor && (
          <div className="mb-2 flex justify-center gap-2">
            <Pill onClick={() => emote("emote-yes")}>Acenar</Pill>
            <Pill onClick={() => emote("jump")}>Pular</Pill>
            <Pill onClick={() => emote("emote-no")}>Negar</Pill>
            {avatars[me].sit && (
              <Pill onClick={() => { pendingSit.current = null; moveMe({ sit: null, x: avatars[me].x + 0.5, z: avatars[me].z + 0.5 }); }}>
                <ArrowUpFromLine size={13} /> Levantar
              </Pill>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-md justify-between gap-1 rounded-2xl bg-black/50 p-1.5 backdrop-blur">
          <Dock icon={<Hammer size={18} />} label={decor ? "Pronto" : "Decorar"} active={decor} onClick={() => { setDecor(!decor); setSelected(null); setGhost(null); }} />
          <Dock icon={<ShoppingBag size={18} />} label="Loja" onClick={() => setPanel("shop")} />
          <Dock icon={<Package size={18} />} label={`Caixa${home.inv.length ? ` (${home.inv.length})` : ""}`} onClick={() => setPanel("box")} />
          <Dock icon={<Shirt size={18} />} label="Visual" onClick={() => setPanel("char")} />
          <Dock icon={<PawPrint size={18} />} label="Pet" onClick={() => setPanel("pet")} />
          <Dock icon={<Target size={18} />} label={`${doneCount}/${MISSIONS.length}`} onClick={() => setPanel("missions")} />
          {onGames && <Dock icon={<Gamepad2 size={18} />} label="Jogos" onClick={onGames} />}
        </div>
      </div>

      {panel && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="max-h-[72%] w-full overflow-y-auto rounded-t-3xl bg-[#241a23] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

            {panel === "shop" && (
              <>
                <Head title="Loja" right={<Coins n={home.coins} />} />
                <div className="mb-3 flex gap-1.5 overflow-x-auto">
                  {(Object.keys(CAT_NAMES) as (keyof typeof CAT_NAMES)[]).map((c) => (
                    <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs ${cat === c ? "bg-pink-500 text-white" : "bg-white/10"}`}>
                      {CAT_NAMES[c]}
                    </button>
                  ))}
                  <button onClick={() => setCat("sala")} className="hidden" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CATALOG.filter((c) => c.cat === cat).map((c) => (
                    <button
                      key={c.key}
                      disabled={busy || home.coins < c.price}
                      onClick={() => run({ t: "buy", key: c.key })}
                      className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 p-2 text-center disabled:opacity-40"
                    >
                      <Thumb k={c.key} />
                      <span className="text-[11px] leading-tight">{c.name}</span>
                      <span className="flex items-center gap-0.5 text-[11px] font-bold text-pink-300">
                        <Heart size={10} className="fill-pink-300" /> {c.price}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-xs font-semibold text-white/60">Paredes</p>
                <div className="flex flex-wrap gap-2">
                  {WALLS.map((w) => (
                    <StyleBtn key={w.id} active={home.wall === w.id} owned={home.styles.includes(w.id)} price={w.price} label={w.name} swatch={w.color} onClick={() => run({ t: "style", kind: "wall", id: w.id })} />
                  ))}
                </div>
                <p className="mb-2 mt-4 text-xs font-semibold text-white/60">Piso</p>
                <div className="flex flex-wrap gap-2">
                  {FLOORS.map((f) => (
                    <StyleBtn key={f.id} active={home.floor === f.id} owned={home.styles.includes(f.id)} price={f.price} label={f.name} swatch={f.a} onClick={() => run({ t: "style", kind: "floor", id: f.id })} />
                  ))}
                </div>
              </>
            )}

            {panel === "box" && (
              <>
                <Head title="Caixa de itens" />
                {home.inv.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/60">Nada guardado. Compre algo na loja.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {home.inv.map((k, i) => (
                      <button
                        key={k + i}
                        onClick={() => {
                          setDecor(true);
                          setSelected(null);
                          setGhost({ uid: `new-${i}`, k, x: ROOM / 2, z: ROOM / 2, r: 0, fromBox: true });
                          setPanel(null);
                        }}
                        className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 p-2"
                      >
                        <Thumb k={k} />
                        <span className="text-[11px]">{CAT_BY_KEY[k]?.name}</span>
                        <span className="text-[10px] text-pink-300">Colocar</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {panel === "char" && (
              <>
                <Head title="Seu personagem" />
                <div className="grid grid-cols-4 gap-2">
                  {CHARACTERS.map((c) => (
                    <button
                      key={c}
                      onClick={() => run({ t: "avatar", model: c })}
                      className={`overflow-hidden rounded-2xl border-2 bg-white/5 ${home.avatars[me] === c ? "border-pink-400" : "border-transparent"}`}
                    >
                      <img src={`/house/chars/prev/${c}.png`} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {panel === "pet" && (
              <>
                <Head title={home.pet ? home.pet.name : "Adotar um pet"} />
                {home.pet ? (
                  <PetPanel home={home} busy={busy} onFeed={() => petDo("feed")} onPat={() => petDo("pat")} />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {PETS.map((p) => (
                        <button
                          key={p.kind}
                          disabled={busy}
                          onClick={() => run({ t: "adopt", kind: p.kind, name: petName || p.name })}
                          className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 p-2"
                        >
                          <img src={`/house/pets/prev/${p.kind}.png`} alt="" className="aspect-square w-full object-contain" loading="lazy" />
                          <span className="text-xs">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <input
                      value={petName}
                      onChange={(e) => setPetName(e.target.value.slice(0, 16))}
                      placeholder="Nome do pet (opcional)"
                      className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none"
                    />
                  </>
                )}
              </>
            )}

            {panel === "missions" && (
              <>
                <Head title="Missões de hoje" right={<Coins n={home.coins} />} />
                <p className="mb-3 text-xs text-white/60">Os corações só vêm de coisas que vocês fazem juntos.</p>
                <div className="flex flex-col gap-2">
                  {MISSIONS.map((m) => {
                    const done = !!home.missions[m.id];
                    const extra =
                      m.id === "tempo" ? ` (${Math.min(5, Math.floor(together / 60))}/5 min)` :
                      m.id === "pet" ? ` (${[home.prog.pet.gu && "gu", home.prog.pet.li && "li"].filter(Boolean).join(", ") || "ninguém ainda"})` :
                      m.id === "decor" ? ` (${[home.prog.decor.gu && "gu", home.prog.decor.li && "li"].filter(Boolean).join(", ") || "ninguém ainda"})` : "";
                    return (
                      <div key={m.id} className={`flex items-center gap-3 rounded-2xl p-3 ${done ? "bg-emerald-500/15" : "bg-white/5"}`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-emerald-500" : "bg-white/10"}`}>
                          {done && <Check size={15} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{m.title}</p>
                          <p className="text-[11px] text-white/60">{m.desc}{!done && extra}</p>
                        </div>
                        <span className="text-xs font-bold text-pink-300">+{m.reward}</span>
                      </div>
                    );
                  })}
                  <div className={`rounded-2xl p-3 text-center text-xs ${home.bonus ? "bg-pink-500/20" : "bg-white/5 text-white/60"}`}>
                    Completar todas: +{BONUS} corações {home.bonus && "(conseguido!)"}
                  </div>
                  {together < TOGETHER_GOAL && !online[partner] && (
                    <p className="text-center text-[11px] text-white/50">Chame o outro pra entrar na casa.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PetPanel({ home, busy, onFeed, onPat }: { home: Home; busy: boolean; onFeed: () => void; onPat: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const s = petStats(home.pet!);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={`/house/pets/prev/${home.pet!.kind}.png`} alt="" className="h-20 w-20 rounded-2xl bg-white/5 object-contain" />
        <div className="flex-1 space-y-2">
          <Bar label="Barriga" v={s.hunger} color="bg-amber-400" />
          <Bar label="Alegria" v={s.joy} color="bg-pink-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={onFeed} className="flex-1 rounded-xl bg-amber-500/80 py-2.5 text-sm font-semibold disabled:opacity-50">Dar comida</button>
        <button disabled={busy} onClick={onPat} className="flex-1 rounded-xl bg-pink-500/80 py-2.5 text-sm font-semibold disabled:opacity-50">Fazer carinho</button>
      </div>
      <p className="text-[11px] text-white/50">Cuidar do pet com o outro em casa conta pra missão do dia.</p>
    </div>
  );
}

const Bar = ({ label, v, color }: { label: string; v: number; color: string }) => (
  <div>
    <div className="mb-0.5 flex justify-between text-[11px] text-white/70"><span>{label}</span><span>{v}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${color}`} style={{ width: `${v}%` }} /></div>
  </div>
);
const Head = ({ title, right }: { title: string; right?: React.ReactNode }) => (
  <div className="mb-3 flex items-center justify-between"><p className="text-base font-bold">{title}</p>{right}</div>
);
const Coins = ({ n }: { n: number }) => (
  <span className="flex items-center gap-1 text-sm font-bold"><Heart size={14} className="fill-pink-400 text-pink-400" />{n}</span>
);
const Thumb = ({ k }: { k: string }) => (
  <img src={`/house/furn/prev/${k}.png`} alt="" className="aspect-square w-full rounded-xl bg-white/5 object-contain p-1" loading="lazy" />
);
const Pill = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium backdrop-blur active:scale-95">{children}</button>
);
const Dock = ({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) => (
  <button onClick={onClick} className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] ${active ? "bg-pink-500" : "active:bg-white/10"}`}>{icon}{label}</button>
);
const Tool = ({ icon, label, onClick, disabled, strong }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; strong?: boolean }) => (
  <button disabled={disabled} onClick={onClick} className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 disabled:opacity-50 ${strong ? "bg-pink-500" : "bg-white/10"}`}>{icon}{label}</button>
);
const StyleBtn = ({ active, owned, price, label, swatch, onClick }: { active: boolean; owned: boolean; price: number; label: string; swatch: string; onClick: () => void }) => (
  <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-xs ${active ? "border-pink-400" : "border-transparent bg-white/5"}`}>
    <span className="h-5 w-5 rounded-md" style={{ background: swatch }} />
    {label}
    {!owned && <span className="text-pink-300">{price}</span>}
  </button>
);
