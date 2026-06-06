/**
 * The "open-source album" manifest — the dump-your-files format.
 *
 * Hit-Boy's pitch: "I can just dump all the files for my album and allow people
 * to recreate and have their own version." An album is songs; a song is stems;
 * each stem points at an audio file and carries its key + BPM. Ship this JSON
 * next to the audio and anyone can fork the record.
 */

export interface StemManifest {
  id: string;
  /** "snare" | "bass" | "vocal" | "melody" | ... */
  kind: string;
  label?: string;
  /** URL or path to the audio file for this stem. */
  url?: string;
}

export interface SongManifest {
  id: string;
  title: string;
  /** Musical key of the song, e.g. "C", "Am". */
  key: string;
  /** Tempo in BPM. */
  bpm: number;
  /** Length in bars (used for loop alignment). */
  bars: number;
  stems: StemManifest[];
}

export interface AlbumManifest {
  title: string;
  artist: string;
  songs: SongManifest[];
  /** Distribution stance from the transcript: "pay what you want". */
  payWhatYouWant?: boolean;
}

/** Throwable validation — confirms a manifest is well-formed before loading. */
export function validateAlbum(album: AlbumManifest): void {
  if (!album.songs?.length) throw new Error("album has no songs");
  const ids = new Set<string>();
  for (const song of album.songs) {
    if (!song.stems?.length) throw new Error(`song "${song.id}" has no stems`);
    if (song.bpm <= 0) throw new Error(`song "${song.id}" has invalid bpm`);
    for (const stem of song.stems) {
      const key = `${song.id}:${stem.id}`;
      if (ids.has(key)) throw new Error(`duplicate stem id ${key}`);
      ids.add(key);
    }
  }
}

/** Flat list of every stem in the album, namespaced by song id. */
export function listStems(
  album: AlbumManifest,
): Array<StemManifest & { songId: string; key: string; bpm: number }> {
  return album.songs.flatMap((song) =>
    song.stems.map((stem) => ({
      ...stem,
      songId: song.id,
      key: song.key,
      bpm: song.bpm,
    })),
  );
}
