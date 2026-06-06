import { describe, expect, it } from "vitest";
import { evaluate, isCoherent, recombine } from "../src/index";
import type { CoherenceLayer, Stem } from "../src/index";

interface Plain {
  tag: string;
}

const stem = (id: string, tag = id): Stem<Plain> => ({
  id,
  kind: "test",
  content: id,
  meta: { tag },
});

describe("recombine", () => {
  it("assembles stems from multiple sources in order", () => {
    const comp = recombine(stem("a"), [stem("b"), stem("c")], stem("d"));
    expect(comp.stems.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops duplicate ids, keeping the first occurrence", () => {
    const comp = recombine(stem("a"), stem("b"), stem("a"));
    expect(comp.stems.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns an empty composition for no picks", () => {
    expect(recombine<Plain>().stems).toEqual([]);
  });
});

describe("evaluate / isCoherent", () => {
  const errorOnTwo: CoherenceLayer<Plain> = {
    name: "test/min-two",
    validate: (c) =>
      c.stems.length < 2
        ? [{ code: "too-few", severity: "error", message: "need 2+", stemIds: [] }]
        : [],
  };

  it("surfaces issues from the layer", () => {
    expect(evaluate(recombine(stem("a")), errorOnTwo)).toHaveLength(1);
    expect(evaluate(recombine(stem("a"), stem("b")), errorOnTwo)).toHaveLength(0);
  });

  it("treats error-severity issues as incoherent, warnings as coherent", () => {
    expect(isCoherent(recombine(stem("a")), errorOnTwo)).toBe(false);
    expect(isCoherent(recombine(stem("a"), stem("b")), errorOnTwo)).toBe(true);
  });
});
