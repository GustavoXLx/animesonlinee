// Muda o tom da voz em tempo real (delay-line pitch shifter num AudioWorklet).
const WORKLET = `
class P extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "ratio", defaultValue: 1, minValue: 0.5, maxValue: 2.5 }]; }
  constructor() { super(); this.N = 4096; this.buf = new Float32Array(this.N); this.w = 0; this.ph = 0; this.W = 1600; }
  read(d) { let i = this.w - d; while (i < 0) i += this.N; const a = Math.floor(i), f = i - a; return this.buf[a % this.N] * (1 - f) + this.buf[(a + 1) % this.N] * f; }
  process(ins, outs, params) {
    const inp = ins[0] && ins[0][0], out = outs[0][0];
    if (!out) return true;
    const r = params.ratio[0];
    for (let n = 0; n < out.length; n++) {
      const x = inp ? inp[n] : 0;
      this.buf[this.w] = x;
      if (Math.abs(r - 1) < 0.01) { out[n] = x; }
      else {
        this.ph += (1 - r) / this.W; this.ph -= Math.floor(this.ph);
        const p2 = (this.ph + 0.5) % 1;
        const g1 = 1 - Math.abs(2 * this.ph - 1), g2 = 1 - Math.abs(2 * p2 - 1);
        out[n] = this.read(this.ph * this.W + 2) * g1 + this.read(p2 * this.W + 2) * g2;
      }
      this.w = (this.w + 1) % this.N;
    }
    for (let c = 1; c < outs[0].length; c++) outs[0][c].set(out);
    return true;
  }
}
registerProcessor("as-pitch", P);
`;

export type VoiceFx = { stream: MediaStream; setRatio: (r: number) => void; close: () => void };

export async function makeVoiceFx(raw: MediaStream): Promise<VoiceFx | null> {
  try {
    const ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(raw);
    const node = new AudioWorkletNode(ctx, "as-pitch");
    const dest = ctx.createMediaStreamDestination();
    src.connect(node).connect(dest);
    if (ctx.state === "suspended") void ctx.resume();
    const ratio = node.parameters.get("ratio")!;
    return {
      stream: dest.stream,
      setRatio: (r) => ratio.setValueAtTime(r, ctx.currentTime),
      close: () => void ctx.close().catch(() => {}),
    };
  } catch {
    return null;
  }
}

export const FX_LEVELS = [
  { ratio: 1, label: "Voz normal" },
  { ratio: 1.45, label: "Voz fina" },
  { ratio: 1.85, label: "Voz de ET" },
];
