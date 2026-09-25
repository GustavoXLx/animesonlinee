import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Minimize2, Maximize2, Volume2, Volume1 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setCallActive } from "@/lib/panic";

type Who = "gu" | "li";
type Status = "idle" | "calling" | "incoming" | "connecting" | "active" | "reconnecting";
type Sig =
  | { t: "ring"; from: Who; id: string }
  | { t: "accept"; from: Who; id: string }
  | { t: "decline"; from: Who; id: string }
  | { t: "hangup"; from: Who; id: string }
  | { t: "offer"; from: Who; id: string; sdp: RTCSessionDescriptionInit }
  | { t: "answer"; from: Who; id: string; sdp: RTCSessionDescriptionInit }
  | { t: "ice"; from: Who; id: string; c: RTCIceCandidateInit };

const ICE: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/** Toque suave gerado na hora (sem arquivos). */
function useRinger() {
  const ref = useRef<{ ctx: AudioContext; iv: ReturnType<typeof setInterval> } | null>(null);
  const stop = useCallback(() => {
    if (!ref.current) return;
    clearInterval(ref.current.iv);
    void ref.current.ctx.close().catch(() => {});
    ref.current = null;
  }, []);
  const start = useCallback(
    (kind: "in" | "out") => {
      stop();
      try {
        const ctx = new AudioContext();
        const beep = () => {
          const tones = kind === "in" ? [880, 660] : [440];
          tones.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = f;
            g.gain.value = 0.0001;
            o.connect(g).connect(ctx.destination);
            const t = ctx.currentTime + i * 0.25;
            g.gain.exponentialRampToValueAtTime(kind === "in" ? 0.2 : 0.08, t + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            o.start(t);
            o.stop(t + 0.25);
          });
          if (kind === "in") navigator.vibrate?.([300, 150, 300]);
        };
        beep();
        ref.current = { ctx, iv: setInterval(beep, kind === "in" ? 1800 : 2500) };
      } catch {
        /* sem áudio */
      }
    },
    [stop],
  );
  useEffect(() => stop, [stop]);
  return { start, stop };
}

export function VoiceCall({
  me,
  otherName,
  otherAvatar,
  otherInitial,
  children,
}: {
  me: Who;
  otherName: string;
  otherAvatar: string | null;
  otherInitial: string;
  children: (start: () => void, busy: boolean) => React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [mini, setMini] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const boost = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState("");
  const statusRef = useRef<Status>("idle");
  const callId = useRef("");
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCaller = useRef(false);
  const speakerRef = useRef(false);
  const ringer = useRinger();

  const set = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
    setCallActive(s !== "idle");
  };

  const send = useCallback((m: { t: Sig["t"]; id?: string; sdp?: RTCSessionDescriptionInit; c?: RTCIceCandidateInit }) => {
    void chan.current?.send({
      type: "broadcast",
      event: "sig",
      payload: { ...m, from: me, id: m.id ?? callId.current },
    });
  }, [me]);

  const cleanup = useCallback(
    (msg = "") => {
      ringer.stop();
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (dropTimer.current) clearTimeout(dropTimer.current);
      pc.current?.getSenders().forEach((s) => s.track?.stop());
      pc.current?.close();
      pc.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      pendingIce.current = [];
      if (audioEl.current) audioEl.current.srcObject = null;
      callId.current = "";
      setMuted(false);
      setMini(false);
      speakerRef.current = false;
      setSpeaker(false);
      if (boost.current) {
        void boost.current.ctx.close().catch(() => {});
        boost.current = null;
      }
      if (audioEl.current) audioEl.current.muted = false;
      set("idle");
      if (msg) {
        setNote(msg);
        setTimeout(() => setNote(""), 2500);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ringer],
  );

  const getMic = async () => {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    local.current = s;
    return s;
  };

  const makePc = (stream: MediaStream) => {
    const p = new RTCPeerConnection({ iceServers: ICE });
    stream.getTracks().forEach((t) => p.addTrack(t, stream));
    p.onicecandidate = (e) => e.candidate && send({ t: "ice", c: e.candidate.toJSON() });
    p.ontrack = (e) => {
      if (audioEl.current) {
        audioEl.current.srcObject = e.streams[0];
        if (speakerRef.current) void applySpeaker(true);
        void audioEl.current.play().catch(() => {});
      }
    };
    p.onconnectionstatechange = async () => {
      const st = p.connectionState;
      if (st === "connected") {
        if (dropTimer.current) clearTimeout(dropTimer.current);
        if (statusRef.current !== "active") setSecs((v) => (statusRef.current === "reconnecting" ? v : 0));
        set("active");
      } else if (st === "disconnected" || st === "failed") {
        set("reconnecting");
        if (isCaller.current) {
          try {
            const o = await p.createOffer({ iceRestart: true });
            await p.setLocalDescription(o);
            send({ t: "offer", sdp: o });
          } catch {
            /* tenta de novo no próximo evento */
          }
        }
        if (dropTimer.current) clearTimeout(dropTimer.current);
        dropTimer.current = setTimeout(() => {
          if (statusRef.current === "reconnecting") {
            send({ t: "hangup" });
            cleanup("chamada caiu");
          }
        }, 25_000);
      }
    };
    pc.current = p;
    return p;
  };

  const flushIce = async () => {
    const p = pc.current;
    if (!p?.remoteDescription) return;
    for (const c of pendingIce.current.splice(0)) await p.addIceCandidate(c).catch(() => {});
  };

  // canal de sinalização
  useEffect(() => {
    const ch = supabase.channel("voice-call-room", { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "sig" }, async ({ payload }) => {
      const m = payload as Sig;
      if (!m || m.from === me) return;
      const cur = statusRef.current;
      if (m.t === "ring") {
        if (cur !== "idle") {
          if (cur === "calling" && me === "li") {
            // os dois ligaram juntos: bb li atende a do bb gu
            ringer.stop();
            if (ringTimer.current) clearTimeout(ringTimer.current);
            callId.current = m.id;
            isCaller.current = false;
            set("incoming");
            return;
          }
          return;
        }
        callId.current = m.id;
        isCaller.current = false;
        set("incoming");
        ringer.start("in");
        if (ringTimer.current) clearTimeout(ringTimer.current);
        ringTimer.current = setTimeout(() => {
          if (statusRef.current === "incoming") cleanup("chamada perdida");
        }, 45_000);
        return;
      }
      if (m.id !== callId.current) return;
      if (m.t === "decline") return cleanup("recusou a chamada");
      if (m.t === "hangup") return cleanup("chamada encerrada");
      if (m.t === "accept" && cur === "calling") {
        ringer.stop();
        if (ringTimer.current) clearTimeout(ringTimer.current);
        set("connecting");
        try {
          const p = makePc(local.current ?? (await getMic()));
          const o = await p.createOffer();
          await p.setLocalDescription(o);
          send({ t: "offer", sdp: o });
        } catch {
          send({ t: "hangup" });
          cleanup("sem microfone");
        }
        return;
      }
      if (m.t === "offer" && pc.current) {
        await pc.current.setRemoteDescription(m.sdp);
        await flushIce();
        const a = await pc.current.createAnswer();
        await pc.current.setLocalDescription(a);
        send({ t: "answer", sdp: a });
        return;
      }
      if (m.t === "answer" && pc.current) {
        await pc.current.setRemoteDescription(m.sdp).catch(() => {});
        await flushIce();
        return;
      }
      if (m.t === "ice") {
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(m.c).catch(() => {});
        else pendingIce.current.push(m.c);
      }
    });
    ch.subscribe();
    chan.current = ch;
    const bye = () => {
      if (statusRef.current !== "idle") send({ t: "hangup" });
    };
    window.addEventListener("pagehide", bye);
    return () => {
      bye();
      window.removeEventListener("pagehide", bye);
      cleanup();
      void supabase.removeChannel(ch);
      chan.current = null;
      setCallActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // cronômetro
  useEffect(() => {
    if (status !== "active") return;
    const iv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [status]);

  const startCall = async () => {
    if (statusRef.current !== "idle") return;
    try {
      await getMic();
    } catch {
      setNote("permita o microfone para ligar");
      setTimeout(() => setNote(""), 3000);
      return;
    }
    callId.current = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    isCaller.current = true;
    set("calling");
    ringer.start("out");
    send({ t: "ring" });
    // reenviar o toque caso a outra pessoa entre no chat depois
    const iv = setInterval(() => {
      if (statusRef.current === "calling") send({ t: "ring" });
      else clearInterval(iv);
    }, 3000);
    ringTimer.current = setTimeout(() => {
      clearInterval(iv);
      if (statusRef.current === "calling") {
        send({ t: "hangup" });
        cleanup("não atendeu");
      }
    }, 45_000);
  };

  const accept = async () => {
    ringer.stop();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    try {
      const s = await getMic();
      set("connecting");
      makePc(s);
      send({ t: "accept" });
    } catch {
      send({ t: "decline" });
      cleanup("permita o microfone para atender");
    }
  };

  const decline = () => {
    send({ t: "decline" });
    cleanup();
  };
  const hangup = () => {
    send({ t: "hangup" });
    cleanup("chamada encerrada");
  };
  const toggleMute = () => {
    const n = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !n));
    setMuted(n);
  };

  const applySpeaker = async (on: boolean) => {
    const el = audioEl.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el) return;
    // 1) tenta trocar a saída de áudio (alto-falante x fone/auricular)
    try {
      if (el.setSinkId && navigator.mediaDevices?.enumerateDevices) {
        const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
        const want = outs.find((d) =>
          on ? /speaker|alto|viva/i.test(d.label) : /earpiece|receiver|auricular|handset|fone/i.test(d.label),
        );
        if (want) await el.setSinkId(want.deviceId);
        else if (!on) await el.setSinkId("default");
      }
    } catch {
      /* ignora */
    }
    // 2) viva voz = volume bem mais alto (amplificado)
    if (boost.current) {
      void boost.current.ctx.close().catch(() => {});
      boost.current = null;
    }
    const stream = el.srcObject as MediaStream | null;
    if (on && stream) {
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 3;
        ctx.createMediaStreamSource(stream).connect(gain).connect(ctx.destination);
        await ctx.resume();
        boost.current = { ctx, gain };
        el.muted = true; // som sai pelo amplificador
      } catch {
        el.muted = false;
      }
    } else {
      el.muted = false;
    }
    el.volume = 1;
  };
  const toggleSpeaker = () => {
    const n = !speaker;
    speakerRef.current = n;
    setSpeaker(n);
    void applySpeaker(n);
  };

  const time = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const label =
    status === "calling"
      ? "chamando..."
      : status === "incoming"
        ? "chamada de voz"
        : status === "connecting"
          ? "conectando..."
          : status === "reconnecting"
            ? "reconectando..."
            : time;

  const avatar = (size: string) => (
    <div className={`${size} rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center font-black shrink-0`}>
      {otherAvatar ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" /> : otherInitial}
    </div>
  );

  return (
    <>
      {children(() => void startCall(), status !== "idle")}
      <audio ref={audioEl} autoPlay playsInline className="hidden" />

      {note && status === "idle" && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[300] bg-neutral-800/95 border border-white/10 rounded-full px-4 py-2 text-[11px] text-white shadow-xl">
          {note}
        </div>
      )}

      {status !== "idle" && (mini && status !== "incoming" ? (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 bg-emerald-600/95 text-white rounded-full pl-1.5 pr-1.5 py-1.5 shadow-2xl">
          {avatar("w-7 h-7 text-xs")}
          <span className="text-xs font-semibold tabular-nums px-1">{label}</span>
          <button onClick={toggleMute} className="p-1.5 rounded-full bg-white/20" aria-label="Mudo">
            {muted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button onClick={toggleSpeaker} className={`p-1.5 rounded-full ${speaker ? "bg-white text-emerald-700" : "bg-white/20"}`} aria-label="Viva voz">
            {speaker ? <Volume2 size={14} /> : <Volume1 size={14} />}
          </button>
          <button onClick={() => setMini(false)} className="p-1.5 rounded-full bg-white/20" aria-label="Expandir">
            <Maximize2 size={14} />
          </button>
          <button onClick={hangup} className="p-1.5 rounded-full bg-red-500" aria-label="Desligar">
            <PhoneOff size={14} />
          </button>
        </div>
      ) : (
        <div className="fixed inset-0 z-[300] bg-neutral-950/97 backdrop-blur text-white flex flex-col items-center justify-between py-16 animate-fade-in">
          <div className="w-full flex justify-end px-5 -mt-8">
            {status !== "incoming" && (
              <button onClick={() => setMini(true)} className="p-2 rounded-full bg-white/10" aria-label="Minimizar">
                <Minimize2 size={18} />
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className={status === "calling" || status === "incoming" ? "animate-pulse" : ""}>
              {avatar("w-28 h-28 text-4xl")}
            </div>
            <p className="text-2xl font-bold">{otherName}</p>
            <p className={`text-sm tabular-nums ${status === "reconnecting" ? "text-amber-400" : "text-white/60"}`}>{label}</p>
            {status !== "incoming" && (
              <p className="text-[11px] text-white/30 mt-2 max-w-[240px] text-center">
                minimize para voltar ao chat ou jogar — a chamada continua
              </p>
            )}
          </div>
          {status === "incoming" ? (
            <div className="flex gap-16">
              <button onClick={decline} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center" aria-label="Recusar">
                <PhoneOff size={26} />
              </button>
              <button onClick={() => void accept()} className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce" aria-label="Atender">
                <Phone size={26} />
              </button>
            </div>
          ) : (
            <div className="flex gap-8">
              <button onClick={toggleSpeaker} className={`w-16 h-16 rounded-full flex items-center justify-center ${speaker ? "bg-white text-black" : "bg-white/15"}`} aria-label="Viva voz">
                {speaker ? <Volume2 size={24} /> : <Volume1 size={24} />}
              </button>
              <button onClick={toggleMute} className={`w-16 h-16 rounded-full flex items-center justify-center ${muted ? "bg-white text-black" : "bg-white/15"}`} aria-label="Mudo">
                {muted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button onClick={hangup} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center" aria-label="Desligar">
                <PhoneOff size={26} />
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
