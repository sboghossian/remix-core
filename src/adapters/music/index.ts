/**
 * Music adapter for remix-core.
 *
 * Two halves:
 *  - Coherence (Node-safe, deterministic): flag key/BPM clashes on recombine.
 *  - Audio engine (browser): actually load/synth stems, sync them in real time
 *    (time-stretch to anchor BPM + pitch-shift to anchor key), mix, loop, and
 *    export — the full Hit-Boy "open-source album" mechanic.
 */

import type { CoherenceLayer, Issue } from "../../types";
import type { MusicMeta } from "./meta";
import { bpmCompatible, keyCompatibility } from "./theory";

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

// Types
export type { MusicMeta, MusicStem, AudioStem } from "./meta";
export type { AlbumManifest, SongManifest, StemManifest } from "./album";
export type { PitchShifter } from "./pitch";
export type { SongSpec } from "./synth";
export type { RemixPlayerOptions } from "./player";

// Coherence + theory (Node-safe)
export {
  bpmCompatible,
  keyCompatibility,
  parseKey,
  semitonesToKey,
  semitonesToRatio,
  ratioToSemitones,
} from "./theory";

// Manifest + export (Node-safe)
export { validateAlbum, listStems } from "./album";
export { encodeWAV } from "./wav";

// Audio engine (browser)
export { createPitchShifter } from "./pitch";
export { synthesizeSong } from "./synth";
export { RemixPlayer } from "./player";
