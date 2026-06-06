/**
 * Minimal 16-bit PCM WAV encoder — pure, dependency-free, Node-testable.
 *
 * Used to export a recombined composition to a downloadable file: "have your
 * own version of what I did" (Hit-Boy's open-source album). Takes raw channel
 * data (what you get from an AudioBuffer) and returns WAV bytes.
 */

/** Encode interleaved-by-channel float PCM (-1..1) as a 16-bit WAV ArrayBuffer. */
export function encodeWAV(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channels[ch]![frame] ?? 0));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}
