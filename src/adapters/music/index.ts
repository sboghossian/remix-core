/**
 * Music adapter for remix-core.
 *
 * Stem meta = { key, bpm }. The coherence layer checks every stem against the
 * anchor (first stem = the downbeat you build on) and flags key clashes and
 * tempo drift — the deterministic core of what Hit-Boy's demo did "in real time".
 *
 * Fully deterministic, zero AI: proof that the engine needs no model — only
 * *some* adapters opt into one.
 */

import type { CoherenceLayer, Issue } from "../../types";
import { bpmCompatible, keyCompatibility } from "./theory";

export interface MusicMeta {
  /** Musical key, e.g. "C", "Am", "F#m". */
  key: string;
  /** Tempo in beats per minute. */
  bpm: number;
}

export const musicCoherence: CoherenceLayer<MusicMeta> = {
  name: "music/key-bpm",
  validate(composition) {
    const issues: Issue[] = [];
    const [anchor, ...rest] = composition.stems;
    if (!anchor) return issues;

    for (const stem of rest) {
      const name = stem.label ?? stem.id;

      const keyOk = keyCompatibility(anchor.meta.key, stem.meta.key);
      if (keyOk === false) {
        issues.push({
          code: "key-clash",
          severity: "warning",
          stemIds: [anchor.id, stem.id],
          message: `${name} in ${stem.meta.key} clashes with anchor key ${anchor.meta.key}`,
          suggestion: `transpose ${stem.meta.key} toward ${anchor.meta.key} (a harmonic neighbour)`,
        });
      } else if (keyOk === null) {
        issues.push({
          code: "key-unknown",
          severity: "info",
          stemIds: [stem.id],
          message: `could not read key "${stem.meta.key}" on ${name}`,
        });
      }

      if (!bpmCompatible(anchor.meta.bpm, stem.meta.bpm)) {
        issues.push({
          code: "bpm-clash",
          severity: "warning",
          stemIds: [anchor.id, stem.id],
          message: `${name} at ${stem.meta.bpm} BPM won't lock to the anchor's ${anchor.meta.bpm} BPM`,
          suggestion: `time-stretch ${stem.meta.bpm} -> ${anchor.meta.bpm} BPM (or a clean 2:1 multiple)`,
        });
      }
    }

    return issues;
  },
};

export { bpmCompatible, keyCompatibility, parseKey } from "./theory";
