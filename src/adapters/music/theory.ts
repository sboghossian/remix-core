/**
 * Harmonic-mixing helpers (the "key + BPM matching" Hit-Boy describes).
 *
 * Keys are compared on the Camelot wheel, the DJ-standard model of harmonic
 * compatibility: two keys mix cleanly if they are the same, relatives
 * (same number, A<->B), or adjacent on the wheel (number +/- 1, same letter).
 */

export type Mode = "major" | "minor";
export interface ParsedKey {
  pc: number; // pitch class, 0 = C ... 11 = B
  mode: Mode;
}

const NOTE_PC: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, DB: 1,
  D: 2,
  "D#": 3, EB: 3,
  E: 4, FB: 4,
  F: 5, "E#": 5,
  "F#": 6, GB: 6,
  G: 7,
  "G#": 8, AB: 8,
  A: 9,
  "A#": 10, BB: 10,
  B: 11, CB: 11,
};

/** Parse "C", "Am", "F#m", "Bb", "Ebmin" -> { pc, mode } (null if unparseable). */
export function parseKey(input: string): ParsedKey | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let mode: Mode = "major";
  let body = trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("min")) {
    mode = "minor";
    body = trimmed.slice(0, -3);
  } else if (lower.endsWith("maj")) {
    body = trimmed.slice(0, -3);
  } else if (lower.endsWith("m")) {
    mode = "minor";
    body = trimmed.slice(0, -1);
  }

  const note = body.trim().toUpperCase();
  const pc = NOTE_PC[note];
  if (pc === undefined) return null;
  return { pc, mode };
}

interface Camelot {
  n: number; // 1..12
  l: "A" | "B"; // A = minor, B = major
}

// Seed table: [number, letter, pitch-class, mode].
const CAMELOT_SEED: Array<[number, "A" | "B", number, Mode]> = [
  [8, "B", 0, "major"], [8, "A", 9, "minor"],
  [9, "B", 7, "major"], [9, "A", 4, "minor"],
  [10, "B", 2, "major"], [10, "A", 11, "minor"],
  [11, "B", 9, "major"], [11, "A", 6, "minor"],
  [12, "B", 4, "major"], [12, "A", 1, "minor"],
  [1, "B", 11, "major"], [1, "A", 8, "minor"],
  [2, "B", 6, "major"], [2, "A", 3, "minor"],
  [3, "B", 1, "major"], [3, "A", 10, "minor"],
  [4, "B", 8, "major"], [4, "A", 5, "minor"],
  [5, "B", 3, "major"], [5, "A", 0, "minor"],
  [6, "B", 10, "major"], [6, "A", 7, "minor"],
  [7, "B", 5, "major"], [7, "A", 2, "minor"],
];

const KEY_TO_CAMELOT = new Map<string, Camelot>();
for (const [n, l, pc, mode] of CAMELOT_SEED) {
  KEY_TO_CAMELOT.set(`${pc}:${mode}`, { n, l });
}

function toCamelot(key: ParsedKey): Camelot | null {
  return KEY_TO_CAMELOT.get(`${key.pc}:${key.mode}`) ?? null;
}

/** Shortest distance between two wheel positions (1..12, wraps). */
function wheelDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 12 - raw);
}

/**
 * Are two key strings harmonically compatible?
 *   true  — mix cleanly
 *   false — they clash
 *   null  — at least one key could not be parsed
 */
export function keyCompatibility(a: string, b: string): boolean | null {
  const ka = parseKey(a);
  const kb = parseKey(b);
  if (!ka || !kb) return null;

  const ca = toCamelot(ka);
  const cb = toCamelot(kb);
  if (!ca || !cb) return null;

  if (ca.n === cb.n && ca.l === cb.l) return true; // same key
  if (ca.n === cb.n && ca.l !== cb.l) return true; // relative major/minor
  if (ca.l === cb.l && wheelDistance(ca.n, cb.n) === 1) return true; // neighbor
  return false;
}

/**
 * Will two tempos lock together? Same BPM (within tolerance) or a clean
 * double/half-time relationship counts; everything else drifts.
 */
export function bpmCompatible(a: number, b: number, tolerance = 0.06): boolean {
  if (a <= 0 || b <= 0) return false;
  const ratio = Math.max(a, b) / Math.min(a, b);
  for (const target of [1, 2]) {
    if (Math.abs(ratio - target) / target <= tolerance) return true;
  }
  return false;
}
