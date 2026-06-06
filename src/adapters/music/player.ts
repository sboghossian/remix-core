/**
 * RemixPlayer — the engine that actually plays the demo.
 *
 * This is "the AI doing the layering and the mixing": add stems pulled from
 * different songs and it (1) time-stretches each to the anchor BPM via
 * playbackRate, (2) pitch-shifts each to the anchor key via the granular
 * shifter (correcting for the pitch that playbackRate introduced), (3) mixes
 * them on a master bus, looped and bar-synced. The first stem you add sets the
 * anchor. Export renders the whole thing to a WAV — your own version.
 */

import { createPitchShifter, type PitchShifter } from "./pitch";
import { ratioToSemitones, semitonesToKey } from "./theory";
import { encodeWAV } from "./wav";
import type { AudioStem } from "./meta";

interface Voice {
  stem: AudioStem;
  gain: GainNode;
  shifter: PitchShifter;
  source: AudioBufferSourceNode | undefined;
  muted: boolean;
  level: number;
}

export interface RemixPlayerOptions {
  anchorBpm?: number;
  anchorKey?: string;
}

export class RemixPlayer {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly voices = new Map<string, Voice>();
  private playing = false;
  private startTime = 0;
  anchorBpm: number;
  anchorKey: string;

  constructor(ctx?: AudioContext, opts: RemixPlayerOptions = {}) {
    this.ctx = ctx ?? new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.anchorBpm = opts.anchorBpm ?? 0; // 0 => first stem sets it
    this.anchorKey = opts.anchorKey ?? "";
  }

  get stemIds(): string[] {
    return [...this.voices.keys()];
  }
  get isPlaying(): boolean {
    return this.playing;
  }
  /** Composition bar length in seconds at the anchor tempo. */
  get barSeconds(): number {
    return this.anchorBpm ? (4 * 60) / this.anchorBpm : 0;
  }

  /** Add a stem. The first stem added sets the anchor tempo + key (if unset). */
  async addStem(stem: AudioStem): Promise<void> {
    if (this.voices.has(stem.id)) return;
    if (!this.anchorBpm) this.anchorBpm = stem.meta.bpm;
    if (!this.anchorKey) this.anchorKey = stem.meta.key;

    const shifter = await createPitchShifter(this.ctx, 0);
    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    shifter.node.connect(gain).connect(this.master);

    const voice: Voice = { stem, gain, shifter, source: undefined, muted: false, level: 1 };
    this.voices.set(stem.id, voice);
    this.retune(voice);
    if (this.playing) this.startVoice(voice, this.startTime);
  }

  removeStem(id: string): void {
    const v = this.voices.get(id);
    if (!v) return;
    try {
      v.source?.stop();
    } catch {
      /* already stopped */
    }
    v.shifter.node.disconnect();
    v.gain.disconnect();
    this.voices.delete(id);
  }

  private retune(v: Voice): void {
    const tempoRatio = this.anchorBpm / v.stem.meta.bpm;
    const keyShift = semitonesToKey(v.stem.meta.key, this.anchorKey) ?? 0;
    // playbackRate already shifted pitch by ratioToSemitones(tempoRatio); undo
    // that and land on the anchor key.
    v.shifter.setSemitones(keyShift - ratioToSemitones(tempoRatio));
    if (v.source) v.source.playbackRate.value = tempoRatio;
  }

  setLevel(id: string, level: number): void {
    const v = this.voices.get(id);
    if (!v) return;
    v.level = Math.max(0, Math.min(1, level));
    v.gain.gain.value = v.muted ? 0 : v.level;
  }

  setMuted(id: string, muted: boolean): void {
    const v = this.voices.get(id);
    if (!v) return;
    v.muted = muted;
    v.gain.gain.value = muted ? 0 : v.level;
  }

  setMasterLevel(level: number): void {
    this.master.gain.value = Math.max(0, Math.min(1, level));
  }

  private startVoice(v: Voice, when: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = v.stem.buffer;
    src.loop = true;
    src.playbackRate.value = this.anchorBpm / v.stem.meta.bpm;
    src.connect(v.shifter.node);
    src.start(when);
    v.source = src;
    this.retune(v);
  }

  async play(): Promise<void> {
    if (this.playing) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.playing = true;
    this.startTime = this.ctx.currentTime + 0.1;
    for (const v of this.voices.values()) this.startVoice(v, this.startTime);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    for (const v of this.voices.values()) {
      try {
        v.source?.stop();
      } catch {
        /* already stopped */
      }
      v.source = undefined;
    }
  }

  /** Render the current (unmuted) composition to a WAV Blob — your own version. */
  async exportWav(bars = 4): Promise<Blob> {
    const sr = this.ctx.sampleRate;
    const seconds = bars * this.barSeconds;
    const offline = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sr)), sr);
    const master = offline.createGain();
    master.gain.value = this.master.gain.value;
    master.connect(offline.destination);

    for (const v of this.voices.values()) {
      if (v.muted) continue;
      const shifter = await createPitchShifter(offline, 0);
      const tempoRatio = this.anchorBpm / v.stem.meta.bpm;
      const keyShift = semitonesToKey(v.stem.meta.key, this.anchorKey) ?? 0;
      shifter.setSemitones(keyShift - ratioToSemitones(tempoRatio));
      const g = offline.createGain();
      g.gain.value = v.level;
      shifter.node.connect(g).connect(master);
      const src = offline.createBufferSource();
      src.buffer = v.stem.buffer;
      src.loop = true;
      src.playbackRate.value = tempoRatio;
      src.connect(shifter.node);
      src.start(0);
      src.stop(seconds);
    }

    const rendered = await offline.startRendering();
    const channels: Float32Array[] = [];
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      channels.push(rendered.getChannelData(c));
    }
    return new Blob([encodeWAV(channels, sr)], { type: "audio/wav" });
  }

  dispose(): void {
    this.stop();
    this.master.disconnect();
    this.voices.clear();
  }
}
