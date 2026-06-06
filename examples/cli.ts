/**
 * remix-core demo — recombine stems from three different "songs" and let the
 * music coherence layer tell you what will and won't lock together.
 *
 * Run: npm run demo
 */

import { evaluate, isCoherent, recombine } from "../src/index";
import type { Stem } from "../src/index";
import { type MusicMeta, musicCoherence } from "../src/adapters/music/index";

type MusicStem = Stem<MusicMeta>;

// Three songs, pre-chopped into stems (the Hit-Boy "open-source album" setup).
const songA: MusicStem[] = [
  { id: "a-snare", kind: "snare", content: "snare.wav", source: "Song A", label: "A · snare", meta: { key: "C", bpm: 120 } },
  { id: "a-melody", kind: "melody", content: "melody.wav", source: "Song A", label: "A · melody", meta: { key: "C", bpm: 120 } },
];
const songB: MusicStem[] = [
  { id: "b-bass", kind: "bass", content: "bass.wav", source: "Song B", label: "B · bass", meta: { key: "Am", bpm: 120 } },
  { id: "b-vocal", kind: "vocal", content: "vocal.wav", source: "Song B", label: "B · vocal", meta: { key: "F#m", bpm: 95 } },
];
const songC: MusicStem[] = [
  { id: "c-guitar", kind: "guitar", content: "guitar.wav", source: "Song C", label: "C · guitar", meta: { key: "G", bpm: 240 } },
];

// Pick across all three — exactly the on-stage move.
const composition = recombine<MusicMeta>(
  songA[0]!, // anchor: A's snare in C @ 120
  songB[0]!, // B's bass in Am @ 120  -> relative key, double... same tempo: locks
  songB[1]!, // B's vocal in F#m @ 95 -> key clash + tempo drift
  songC[0]!, // C's guitar in G @ 240 -> compatible key, 2:1 tempo: locks
);

console.log("Composition:", composition.stems.map((s) => s.label).join("  +  "));
console.log("Anchor:", composition.stems[0]?.label, "\n");

const issues = evaluate(composition, musicCoherence);
if (issues.length === 0) {
  console.log("Everything locks. No issues.");
} else {
  for (const issue of issues) {
    const mark = issue.severity === "warning" ? "!" : issue.severity === "error" ? "x" : "i";
    console.log(`[${mark}] ${issue.code}: ${issue.message}`);
    if (issue.suggestion) console.log(`    -> ${issue.suggestion}`);
  }
}

console.log("\nCoherent (no hard errors)?", isCoherent(composition, musicCoherence));
