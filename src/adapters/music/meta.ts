import type { Stem } from "../../types";

/** Metadata a music stem carries: its musical key and tempo. */
export interface MusicMeta {
  /** Musical key, e.g. "C", "Am", "F#m". */
  key: string;
  /** Tempo in beats per minute. */
  bpm: number;
  /** Optional: number of bars the stem spans (used for loop alignment). */
  bars?: number;
}

/** A music stem before audio is attached (metadata only — Node-safe). */
export type MusicStem = Stem<MusicMeta>;

/**
 * A music stem with decoded audio attached. Browser-only (carries an
 * AudioBuffer). This is what the player actually schedules and mixes.
 */
export interface AudioStem extends MusicStem {
  buffer: AudioBuffer;
}
