import { describe, expect, it } from "vitest";
import { encodeWAV } from "../src/adapters/music/wav";

const ascii = (view: DataView, offset: number, len: number) =>
  Array.from({ length: len }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("");

describe("encodeWAV", () => {
  it("writes a valid RIFF/WAVE header", () => {
    const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const buffer = encodeWAV([left], 44100);
    const view = new DataView(buffer);
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(ascii(view, 36, 4)).toBe("data");
  });

  it("sizes the buffer correctly: 44-byte header + 2 bytes per sample per channel", () => {
    const frames = 100;
    const mono = encodeWAV([new Float32Array(frames)], 44100);
    expect(mono.byteLength).toBe(44 + frames * 2);
    const stereo = encodeWAV([new Float32Array(frames), new Float32Array(frames)], 44100);
    expect(stereo.byteLength).toBe(44 + frames * 2 * 2);
  });

  it("records sample rate, channel count, and bit depth in fmt", () => {
    const view = new DataView(encodeWAV([new Float32Array(8), new Float32Array(8)], 48000));
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(48000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it("clamps out-of-range samples to full-scale 16-bit", () => {
    const view = new DataView(encodeWAV([new Float32Array([2, -2])], 44100));
    expect(view.getInt16(44, true)).toBe(0x7fff); // +clamped
    expect(view.getInt16(46, true)).toBe(-0x8000); // -clamped
  });
});
