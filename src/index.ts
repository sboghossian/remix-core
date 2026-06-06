/**
 * remix-core — public surface.
 *
 * Origin: the Hit-Boy "open-source album" demo (dump your stems, let anyone
 * recombine across songs, a layer reconciles key + BPM in real time). This is
 * that mechanic with the domain ripped out: bring your own Stem `meta` and your
 * own CoherenceLayer, and the engine recombines anything.
 *
 * Adapters live behind subpaths, e.g. `remix-core/music`.
 */

export type {
  Composition,
  CoherenceLayer,
  Issue,
  Severity,
  Stem,
} from "./types";

export { evaluate, isCoherent, recombine } from "./recombine";
