import { describe, expect, it } from "vitest";
import { recombine } from "../src/index";
import type { Stem } from "../src/index";
import {
  type MusicMeta,
  bpmCompatible,
  keyCompatibility,
  musicCoherence,
  parseKey,
} from "../src/adapters/music/index";

const stem = (id: string, key: string, bpm: number): Stem<MusicMeta> => ({
  id,
  kind: "test",
  content: id,
  label: id,
  meta: { key, bpm },
});

describe("parseKey", () => {
  it("reads majors, minors, and accidentals", () => {
    expect(parseKey("C")).toEqual({ pc: 0, mode: "major" });
    expect(parseKey("Am")).toEqual({ pc: 9, mode: "minor" });
    expect(parseKey("F#m")).toEqual({ pc: 6, mode: "minor" });
    expect(parseKey("Bb")).toEqual({ pc: 10, mode: "major" });
    expect(parseKey("Ebmin")).toEqual({ pc: 3, mode: "minor" });
  });

  it("returns null on garbage", () => {
    expect(parseKey("H")).toBeNull();
    expect(parseKey("")).toBeNull();
  });
});

describe("keyCompatibility", () => {
  it("accepts identical keys", () => {
    expect(keyCompatibility("C", "C")).toBe(true);
  });

  it("accepts relative major/minor (C / Am)", () => {
    expect(keyCompatibility("C", "Am")).toBe(true);
  });

  it("accepts wheel neighbours (C / G)", () => {
    expect(keyCompatibility("C", "G")).toBe(true);
  });

  it("rejects distant keys (C / F#)", () => {
    expect(keyCompatibility("C", "F#")).toBe(false);
  });

  it("returns null when a key is unparseable", () => {
    expect(keyCompatibility("C", "???")).toBeNull();
  });
});

describe("bpmCompatible", () => {
  it("locks same and double/half tempos", () => {
    expect(bpmCompatible(120, 120)).toBe(true);
    expect(bpmCompatible(120, 240)).toBe(true);
    expect(bpmCompatible(240, 120)).toBe(true);
  });

  it("rejects drifting tempos", () => {
    expect(bpmCompatible(120, 137)).toBe(false);
    expect(bpmCompatible(120, 95)).toBe(false);
  });
});

describe("musicCoherence", () => {
  it("passes a clean recombine across songs", () => {
    const comp = recombine(stem("anchor", "C", 120), stem("bass", "Am", 120), stem("gtr", "G", 240));
    expect(musicCoherence.validate(comp)).toEqual([]);
  });

  it("flags both a key clash and a tempo drift", () => {
    const comp = recombine(stem("anchor", "C", 120), stem("vox", "F#m", 95));
    const codes = musicCoherence.validate(comp).map((i) => i.code).sort();
    expect(codes).toEqual(["bpm-clash", "key-clash"]);
  });

  it("warns (not errors) — recombines stay coherent for the user to judge", () => {
    const comp = recombine(stem("anchor", "C", 120), stem("vox", "F#m", 95));
    expect(musicCoherence.validate(comp).every((i) => i.severity !== "error")).toBe(true);
  });
});
