# remix-core

A domain-agnostic remix engine. Bring your own components ("stems") and your own
rules ("coherence layer"); the engine recombines them and tells you what doesn't fit.

**▶ Live demo (the open-source album): https://remix-core.pages.dev**
Three songs, three keys, three tempos — pick stems across them and hear the engine
lock them in real time.

It started as one observation. In an interview about AI and creativity, the producer
Hit-Boy demoed an "open-source album": dump every stem from a track — snare, bass,
vocal, melody — and let anyone recombine components across songs, while software
matched key and BPM in real time so the new arrangement actually held together.

That's a general primitive with the music ripped out:

```
stems  ->  recombine()  ->  CoherenceLayer.validate()  ->  issues
```

Music matches **key + BPM**. Point it at another domain by writing a different
`meta` shape and a different coherence layer. Contracts, for instance, match
**defined terms + cross-references** instead — that's [clausebox](#vertical), the
first real vertical (separate repo, AGPL).

## Install

```bash
npm install
npm test       # run the suite
npm run demo   # recombine three songs and see what locks
```

## The whole API

Three nouns, one verb:

```ts
import { recombine, evaluate, isCoherent } from "remix-core";
import type { Stem, Composition, CoherenceLayer, Issue } from "remix-core";

const composition = recombine(songA.snare, songB.bass, songC.guitar);
const issues = evaluate(composition, myCoherenceLayer);
```

- **`Stem<Meta>`** — a reusable component. `meta` is whatever your domain needs.
- **`Composition<Meta>`** — stems assembled in order (duplicate ids dropped).
- **`CoherenceLayer<Meta>`** — `validate(composition) => Issue[]`, plus an optional,
  advisory `repair()`. The engine never auto-repairs; it flags, a human decides.
- **`recombine(...picks)`** — assemble stems from any number of sources.

## Music adapter

```ts
import { musicCoherence, type MusicMeta } from "remix-core/music";

const issues = musicCoherence.validate(composition);
// -> [{ code: "key-clash", ... }, { code: "bpm-clash", ... }]
```

Keys are compared on the Camelot wheel (same / relative / neighbour = compatible);
tempos lock at the same BPM or a clean 2:1. Fully deterministic — no model, no API
key. The engine doesn't depend on AI; only some adapters choose to.

## The open-source album (audio engine)

The coherence layer *detects* clashes. The audio engine *fixes* them — the actual
thing from the demo: dump stems from different songs, recombine, and hear them lock
in real time.

```ts
import { RemixPlayer, synthesizeSong } from "remix-core/music";

const player = new RemixPlayer();           // Web Audio
const [a, b] = await Promise.all([
  synthesizeSong({ id: "a", title: "Midnight", key: "C",  bpm: 120, bars: 4 }),
  synthesizeSong({ id: "b", title: "Sahel",    key: "Am", bpm: 90,  bars: 4 }),
]);

await player.addStem(a[0]!);   // first stem sets the anchor (C, 120)
await player.addStem(b[3]!);   // Am @ 90 — time-stretched to 120 AND pitch-shifted to C
await player.play();           // looped, bar-synced, mixed
const wav = await player.exportWav(8);  // your own version, as a file
```

What it does, mapped to the demo:

- **Time-stretch** every stem to the anchor BPM (`playbackRate`).
- **Pitch-shift** every stem to the anchor key — independently of tempo — via a
  zero-dependency granular pitch-shifter (`AudioWorklet`). This is the "different
  speeds, different keys, in real time".
- **Mix**: per-stem gain + mute/solo, master bus ("the AI doing the mixing").
- **Loop**: bar-aligned, synced.
- **Export**: render the recombination to a WAV (`OfflineAudioContext`).
- **Album manifest** (`AlbumManifest`): the "dump your files" format — songs → stems
  → `{ kind, key, bpm, url }`, shareable and forkable.

### The playable demo

Live: **https://remix-core.pages.dev** — or run it locally:

```bash
npm run demo:web      # the open-source album, in your browser
```

Three songs are synthesized on the fly (no audio assets, nothing copyrighted) so you
can hear three different keys and tempos lock together. Or bring your own `.wav`
stems via an `AlbumManifest` and the same engine plays them.

> Fidelity note: the granular pitch-shifter is zero-dependency and good for a demo;
> extreme shifts have audible artifacts. A WASM time-stretch (Rubberband/soundtouch)
> can drop in as an optional "HiFi" path without touching the core.

## Writing your own adapter

```ts
import type { CoherenceLayer } from "remix-core";

interface DeckMeta { aspectRatio: string; theme: string; }

export const deckCoherence: CoherenceLayer<DeckMeta> = {
  name: "deck/visual",
  validate(composition) {
    // flag mixed aspect ratios, clashing themes, ...
    return [];
  },
};
```

## Status

v0.2 — engine + deterministic coherence + a real browser audio engine (synced
playback, real-time time-stretch + pitch-shift, mixing, WAV export) + the playable
"open-source album" demo. 31 tests on the pure layer (theory, WAV encoder, manifest);
the Web Audio layer is verified in the demo.

## License

MIT.
