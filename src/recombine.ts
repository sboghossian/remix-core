import type { Composition, CoherenceLayer, Issue, Stem } from "./types";

/**
 * Take stems from any number of sources and assemble them, in order, into a
 * single Composition. Duplicate ids are dropped (first occurrence wins) so you
 * can freely pull "the snare from song A and the snare from song A again"
 * without doubling it.
 *
 * Accepts loose stems or arrays of stems, mixed:
 *   recombine(songA.snare, songB.melody, songC.bass)
 *   recombine(songA.stems, songB.stems)
 */
export function recombine<Meta>(
  ...picks: Array<Stem<Meta> | Stem<Meta>[]>
): Composition<Meta> {
  const seen = new Set<string>();
  const stems: Stem<Meta>[] = [];
  for (const pick of picks) {
    const group = Array.isArray(pick) ? pick : [pick];
    for (const stem of group) {
      if (seen.has(stem.id)) continue;
      seen.add(stem.id);
      stems.push(stem);
    }
  }
  return { stems };
}

/** Run a coherence layer over a composition. Pure pass-through to the layer. */
export function evaluate<Meta>(
  composition: Composition<Meta>,
  layer: CoherenceLayer<Meta>,
): Issue[] {
  return layer.validate(composition);
}

/** A composition is "coherent" when it raises no error-severity issues. */
export function isCoherent<Meta>(
  composition: Composition<Meta>,
  layer: CoherenceLayer<Meta>,
): boolean {
  return !layer.validate(composition).some((issue) => issue.severity === "error");
}
