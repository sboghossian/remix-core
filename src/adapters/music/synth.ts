/**
 * Stem synthesizer — generates real audio for the demo with zero asset files.
 *
 * Hit-Boy's demo loads real snares, bass, vocals. We can't ship his catalogue,
 * so we render our own: each "song" becomes a set of stems (kick, snare, hats,
 * bass, melody, pad) at a chosen key + BPM, rendered offline to AudioBuffers.
 * Three songs in three keys/tempos → you actually HEAR the engine lock them.
 */

import { parseKey } from "./theory";
import type { AudioStem } from "./meta";

export interface SongSpec {
  id: string;
  title: string;
  key: string;
  bpm: number;
  bars: number;
}

const ALL_KINDS = [
  "kick",
  "808",
  "snare",
  "clap",
  "hat",
  "shaker",
  "tom",
  "bass",
  "arp",
  "chords",
  "melody",
  "lead",
  "pad",
  "vocal",
  "fx",
] as const;
type Kind = (typeof ALL_KINDS)[number];

const LABEL: Record<Kind, string> = {
  kick: "Kick",
  "808": "808",
  snare: "Snare",
  clap: "Clap",
  hat: "Hats",
  shaker: "Shaker",
  tom: "Toms",
  bass: "Bass",
  arp: "Arp",
  chords: "Chords",
  melody: "Melody",
  lead: "Lead",
  pad: "Pad",
  vocal: "Vocal",
  fx: "FX",
};

function midiToFreq(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function pluck(
  ctx: OfflineAudioContext,
  type: OscillatorType,
  freq: number,
  t: number,
  dur: number,
  peak: number,
  dest: AudioNode,
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const BUILDERS: Record<Kind, (ctx: OfflineAudioContext, spec: SongSpec, dest: AudioNode) => void> = {
  kick(ctx, spec, dest) {
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    for (let t = 0; t < total - 1e-6; t += beat) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.3);
    }
  },
  snare(ctx, spec, dest) {
    const beat = 60 / spec.bpm;
    for (let b = 0; b < spec.bars; b++) {
      for (const bi of [1, 3]) {
        const t = (b * 4 + bi) * beat;
        const n = ctx.createBufferSource();
        n.buffer = noiseBuffer(ctx, 0.2);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        n.connect(hp).connect(g).connect(dest);
        n.start(t);
        n.stop(t + 0.2);
      }
    }
  },
  hat(ctx, spec, dest) {
    const beat = 60 / spec.bpm;
    const eighth = beat / 2;
    const total = spec.bars * 4 * beat;
    for (let t = 0; t < total - 1e-6; t += eighth) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx, 0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(hp).connect(g).connect(dest);
      n.start(t);
      n.stop(t + 0.06);
    }
  },
  bass(ctx, spec, dest) {
    const pc = parseKey(spec.key)?.pc ?? 0;
    const root = 12 * (2 + 1) + pc; // octave 2
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    lp.connect(dest);
    let i = 0;
    for (let t = 0; t < total - 1e-6; t += beat) {
      const note = i % 4 === 2 ? root + 7 : root; // root, root, fifth, root
      pluck(ctx, "triangle", midiToFreq(note), t, beat * 0.9, 0.5, lp);
      i++;
    }
  },
  melody(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const scale = [0, third, 7, 12];
    const root = 12 * (4 + 1) + pc; // octave 4
    const beat = 60 / spec.bpm;
    const eighth = beat / 2;
    const total = spec.bars * 4 * beat;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    g.connect(dest);
    let i = 0;
    for (let t = 0; t < total - 1e-6; t += eighth) {
      pluck(ctx, "triangle", midiToFreq(root + scale[i % scale.length]!), t, eighth * 0.9, 0.6, g);
      i++;
    }
  },
  pad(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const root = 12 * (4 + 1) + pc;
    const notes = [root, root + third, root + 7];
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.linearRampToValueAtTime(0.16, 0.8);
    g.gain.setValueAtTime(0.16, Math.max(0.8, total - 0.5));
    g.gain.linearRampToValueAtTime(0.0001, total);
    lp.connect(g).connect(dest);
    for (const n of notes) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midiToFreq(n);
      o.connect(lp);
      o.start(0);
      o.stop(total);
    }
  },
  "808"(ctx, spec, dest) {
    const pc = parseKey(spec.key)?.pc ?? 0;
    const root = 12 * (1 + 1) + pc; // octave 1 — deep sub
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    const pattern = [0, 1.5, 2, 3.5]; // syncopated
    for (let b = 0; b < spec.bars; b++) {
      for (const pos of pattern) {
        const t = (b * 4 + pos) * beat;
        if (t >= total) continue;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(midiToFreq(root + 7), t); // glide from fifth
        o.frequency.exponentialRampToValueAtTime(midiToFreq(root), t + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.6, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + 0.75);
      }
    }
  },
  clap(ctx, spec, dest) {
    const beat = 60 / spec.bpm;
    for (let b = 0; b < spec.bars; b++) {
      for (const bi of [1, 3]) {
        const t0 = (b * 4 + bi) * beat;
        for (const off of [0, 0.01, 0.02, 0.045]) {
          const t = t0 + off;
          const n = ctx.createBufferSource();
          n.buffer = noiseBuffer(ctx, 0.08);
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1200;
          bp.Q.value = 1.2;
          const g = ctx.createGain();
          g.gain.setValueAtTime(off === 0.045 ? 0.35 : 0.25, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          n.connect(bp).connect(g).connect(dest);
          n.start(t);
          n.stop(t + 0.09);
        }
      }
    }
  },
  shaker(ctx, spec, dest) {
    const beat = 60 / spec.bpm;
    const sixteenth = beat / 4;
    const total = spec.bars * 4 * beat;
    let i = 0;
    for (let t = 0; t < total - 1e-6; t += sixteenth) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx, 0.03);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 9000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(i % 2 === 0 ? 0.06 : 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      n.connect(hp).connect(g).connect(dest);
      n.start(t);
      n.stop(t + 0.04);
      i++;
    }
  },
  tom(ctx, spec, dest) {
    const pc = parseKey(spec.key)?.pc ?? 0;
    const beat = 60 / spec.bpm;
    const roots = [12 * (3 + 1) + pc, 12 * (3 + 1) + pc - 3, 12 * (2 + 1) + pc + 7];
    for (let b = 0; b < spec.bars; b++) {
      const base = (b * 4 + 3) * beat; // fill on beat 4
      roots.forEach((m, j) => {
        const t = base + j * (beat / 3);
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(midiToFreq(m), t);
        o.frequency.exponentialRampToValueAtTime(midiToFreq(m) * 0.7, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + 0.2);
      });
    }
  },
  arp(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const seq = [0, third, 7, 12, 7, third];
    const root = 12 * (4 + 1) + pc;
    const beat = 60 / spec.bpm;
    const sixteenth = beat / 4;
    const total = spec.bars * 4 * beat;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    g.connect(dest);
    let i = 0;
    for (let t = 0; t < total - 1e-6; t += sixteenth) {
      pluck(ctx, "sawtooth", midiToFreq(root + seq[i % seq.length]!), t, sixteenth * 0.9, 0.5, g);
      i++;
    }
  },
  chords(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const root = 12 * (4 + 1) + pc;
    const notes = [root, root + third, root + 7];
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    lp.connect(g).connect(dest);
    for (let t = beat / 2; t < total - 1e-6; t += beat) {
      for (const n of notes) pluck(ctx, "sawtooth", midiToFreq(n), t, beat * 0.4, 0.4, lp);
    }
  },
  lead(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const seq = [0, 7, third, 12];
    const root = 12 * (5 + 1) + pc; // octave 5
    const beat = 60 / spec.bpm;
    const total = spec.bars * 4 * beat;
    const noteLen = beat * 2;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    g.connect(dest);
    let i = 0;
    for (let t = 0; t < total - 1e-6; t += noteLen) {
      const freq = midiToFreq(root + seq[i % seq.length]!);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      const lfo = ctx.createOscillator(); // vibrato
      lfo.frequency.value = 5;
      const lg = ctx.createGain();
      lg.gain.value = freq * 0.01;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + noteLen);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.6, t + 0.05);
      env.gain.setValueAtTime(0.6, t + noteLen - 0.1);
      env.gain.linearRampToValueAtTime(0.0001, t + noteLen);
      o.connect(env).connect(g);
      o.start(t);
      o.stop(t + noteLen + 0.02);
      i++;
    }
  },
  vocal(ctx, spec, dest) {
    const k = parseKey(spec.key);
    const pc = k?.pc ?? 0;
    const third = k?.mode === "minor" ? 3 : 4;
    const root = 12 * (4 + 1) + pc;
    const notes = [root, root + third, root + 7];
    const total = spec.bars * 4 * (60 / spec.bpm);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, 0);
    out.gain.linearRampToValueAtTime(0.14, 1.2);
    out.gain.setValueAtTime(0.14, Math.max(1.2, total - 0.6));
    out.gain.linearRampToValueAtTime(0.0001, total);
    out.connect(dest);
    for (const formant of [700, 1150]) {
      // an "ah"-ish vowel
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = formant;
      bp.Q.value = 6;
      bp.connect(out);
      for (const n of notes) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midiToFreq(n);
        o.connect(bp);
        o.start(0);
        o.stop(total);
      }
    }
  },
  fx(ctx, spec, dest) {
    const total = spec.bars * 4 * (60 / spec.bpm);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, total);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(200, 0);
    hp.frequency.exponentialRampToValueAtTime(8000, total); // riser sweep
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(0.12, total);
    n.connect(hp).connect(g).connect(dest);
    n.start(0);
    n.stop(total);
  },
};

function renderOffline(
  sampleRate: number,
  seconds: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const frames = Math.max(1, Math.ceil(seconds * sampleRate));
  const ctx = new OfflineAudioContext(1, frames, sampleRate);
  build(ctx);
  return ctx.startRendering();
}

/** Render a song into its stems (each an AudioStem with a real AudioBuffer). */
export async function synthesizeSong(
  spec: SongSpec,
  sampleRate = 44100,
  kinds: readonly string[] = ALL_KINDS,
): Promise<AudioStem[]> {
  const seconds = spec.bars * 4 * (60 / spec.bpm);
  const stems: AudioStem[] = [];
  for (const kind of kinds) {
    const build = BUILDERS[kind as Kind];
    if (!build) continue;
    const buffer = await renderOffline(sampleRate, seconds, (ctx) => {
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      build(ctx, spec, master);
    });
    stems.push({
      id: `${spec.id}-${kind}`,
      kind,
      label: `${spec.title} · ${LABEL[kind as Kind] ?? kind}`,
      source: spec.title,
      content: `${spec.id}-${kind}`,
      meta: { key: spec.key, bpm: spec.bpm, bars: spec.bars },
      buffer,
    });
  }
  return stems;
}
