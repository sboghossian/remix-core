# remix-core

A domain-agnostic remix engine. Bring your own components ("stems") and your own
rules ("coherence layer"); the engine recombines them and tells you what doesn't fit.

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

v0.1 — engine + music adapter + tests. Proof-of-concept, not a platform.

## License

MIT.
