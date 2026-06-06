import { describe, expect, it } from "vitest";
import { listStems, validateAlbum } from "../src/adapters/music/album";
import type { AlbumManifest } from "../src/adapters/music/album";

const album: AlbumManifest = {
  title: "Open Source Album",
  artist: "Demo",
  payWhatYouWant: true,
  songs: [
    {
      id: "a",
      title: "Song A",
      key: "C",
      bpm: 120,
      bars: 4,
      stems: [
        { id: "snare", kind: "snare" },
        { id: "bass", kind: "bass" },
      ],
    },
    {
      id: "b",
      title: "Song B",
      key: "Am",
      bpm: 90,
      bars: 4,
      stems: [{ id: "vocal", kind: "vocal" }],
    },
  ],
};

describe("validateAlbum", () => {
  it("accepts a well-formed album", () => {
    expect(() => validateAlbum(album)).not.toThrow();
  });

  it("rejects an album with no songs", () => {
    expect(() => validateAlbum({ title: "x", artist: "y", songs: [] })).toThrow(/no songs/);
  });

  it("rejects a song with no stems", () => {
    expect(() =>
      validateAlbum({ ...album, songs: [{ ...album.songs[0]!, stems: [] }] }),
    ).toThrow(/no stems/);
  });

  it("rejects duplicate stem ids within a song", () => {
    const dupe: AlbumManifest = {
      ...album,
      songs: [
        {
          ...album.songs[0]!,
          stems: [
            { id: "x", kind: "snare" },
            { id: "x", kind: "bass" },
          ],
        },
      ],
    };
    expect(() => validateAlbum(dupe)).toThrow(/duplicate/);
  });
});

describe("listStems", () => {
  it("flattens every stem with its song's key and bpm", () => {
    const all = listStems(album);
    expect(all).toHaveLength(3);
    expect(all[0]).toMatchObject({ songId: "a", key: "C", bpm: 120 });
    expect(all[2]).toMatchObject({ songId: "b", key: "Am", bpm: 90 });
  });
});
