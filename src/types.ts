/**
 * remix-core — core types.
 *
 * The whole engine is three nouns and one verb:
 *   Stem        — a raw, reusable component (a snare hit, a clause, a paragraph).
 *   Composition — an ordered set of stems assembled into something new.
 *   Issue       — something a coherence layer flags about a composition.
 *   recombine() — take stems from many sources, produce a Composition.
 *
 * A domain (music, law, decks, ...) is just a `<Meta>` shape plus a
 * `CoherenceLayer` that knows how to read it. The engine itself is blind to
 * the domain — that is the entire point.
 */

export type Severity = "error" | "warning" | "info";

/** A raw, reusable component. `meta` is whatever the domain adapter needs. */
export interface Stem<Meta = unknown> {
  /** Stable unique id — used for dedupe and to point Issues at stems. */
  id: string;
  /** Domain tag, e.g. "snare" | "melody" | "clause". Free-form. */
  kind: string;
  /** The actual payload: audio ref, clause text, markdown, ... */
  content: string;
  /** Domain-specific metadata the coherence layer reads (key+bpm, defined-terms, ...). */
  meta: Meta;
  /** Which original work this came from (the song / contract it was chopped out of). */
  source?: string;
  /** Human label for display. */
  label?: string;
}

/** An ordered set of stems assembled into a new whole. */
export interface Composition<Meta = unknown> {
  stems: Stem<Meta>[];
}

/** Something a coherence layer flags about a composition. */
export interface Issue {
  /** Machine code, e.g. "key-clash" | "dangling-reference". */
  code: string;
  severity: Severity;
  message: string;
  /** Ids of the stems this issue relates to. */
  stemIds: string[];
  /** Optional human-facing fix hint. Proposal only — never auto-applied. */
  suggestion?: string;
}

/**
 * The pluggable contract. A domain adapter implements `validate` (and
 * optionally `repair`). `validate` MUST be pure and side-effect free.
 *
 * `repair` is optional and, by design, advisory: it returns a *proposed*
 * Composition. Nothing in the engine ever calls it automatically.
 */
export interface CoherenceLayer<Meta = unknown> {
  name: string;
  validate(composition: Composition<Meta>): Issue[];
  repair?(composition: Composition<Meta>): Composition<Meta>;
}
