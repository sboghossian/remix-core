/**
 * Zero-dependency granular pitch shifter (AudioWorklet).
 *
 * This is the "different keys" half of real-time sync, decoupled from tempo.
 * The player sets each stem's *tempo* with playbackRate (which also shifts
 * pitch), then this shifter corrects the pitch independently so the stem lands
 * on the anchor key — the literal "different speeds, different keys, in real
 * time" from the demo.
 *
 * Algorithm: single-buffer granular resynthesis. Two Hann-windowed read taps
 * trail the write pointer, offset by half a grain so their windows sum to ~1.
 * The taps advance at (pitchRatio) so output pitch = input * ratio; tap wrap
 * happens where the window is ~0, hiding the discontinuity.
 */

const PROCESSOR_SOURCE = `
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'pitch', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.size = 8192;
    this.grain = 2048;
    this.buf = new Float32Array(this.size);
    this.write = 0;
    this.p1 = 0;
    this.p2 = this.grain / 2;
  }
  read(delay) {
    // fractional read 'delay' samples behind the write pointer
    const r = (this.write - delay + this.size) % this.size;
    const i0 = Math.floor(r);
    const i1 = (i0 + 1) % this.size;
    const frac = r - i0;
    return this.buf[i0] * (1 - frac) + this.buf[i1] * frac;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    const pitch = parameters.pitch[0];
    const G = this.grain;
    const TWO_PI = Math.PI * 2;
    for (let i = 0; i < output.length; i++) {
      this.buf[this.write] = input ? input[i] : 0;
      const w1 = 0.5 - 0.5 * Math.cos((TWO_PI * this.p1) / G);
      const w2 = 0.5 - 0.5 * Math.cos((TWO_PI * this.p2) / G);
      output[i] = this.read(this.p1) * w1 + this.read(this.p2) * w2;
      this.write = (this.write + 1) % this.size;
      // tap delay shrinks as pitch rises -> reads faster -> higher pitch
      this.p1 -= pitch - 1;
      this.p2 -= pitch - 1;
      if (this.p1 < 0) this.p1 += G; else if (this.p1 >= G) this.p1 -= G;
      if (this.p2 < 0) this.p2 += G; else if (this.p2 >= G) this.p2 -= G;
    }
    return true;
  }
}
registerProcessor('remix-pitch-shifter', PitchShifter);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** Ensure the worklet module is registered on this context (once). */
async function ensureModule(ctx: BaseAudioContext): Promise<void> {
  let promise = loaded.get(ctx);
  if (!promise) {
    const blob = new Blob([PROCESSOR_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    promise = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loaded.set(ctx, promise);
  }
  return promise;
}

export interface PitchShifter {
  node: AudioWorkletNode;
  /** Set the shift in semitones (positive = up). */
  setSemitones(semitones: number): void;
}

/** Create a pitch-shifter node ready to splice into an audio graph. */
export async function createPitchShifter(
  ctx: BaseAudioContext,
  semitones = 0,
): Promise<PitchShifter> {
  await ensureModule(ctx);
  const node = new AudioWorkletNode(ctx, "remix-pitch-shifter");
  const param = node.parameters.get("pitch");
  const setSemitones = (s: number) => {
    if (param) param.value = 2 ** (s / 12);
  };
  setSemitones(semitones);
  return { node, setSemitones };
}
