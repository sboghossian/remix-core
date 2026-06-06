/**
 * remix-core demo — the "open-source album".
 *
 * Three songs are synthesized in three different keys + tempos. Pull stems from
 * any of them into your remix and the RemixPlayer locks them in real time
 * (time-stretch to the anchor BPM, pitch-shift to the anchor key) and mixes
 * them. Play, mute, balance, export your version. No audio assets — every sound
 * is generated in the browser.
 */

import {
  RemixPlayer,
  synthesizeSong,
  musicCoherence,
  type AudioStem,
  type SongSpec,
} from "../src/adapters/music/index";
import { recombine } from "../src/index";
import "./style.css";

// 20 songs — spread across keys and tempos so the beats differ. Each is
// synthesized lazily (only when you open its panel).
const SONGS: SongSpec[] = [
  { id: "s01", title: "Midnight", key: "C", bpm: 120, bars: 4 },
  { id: "s02", title: "Sahel", key: "Am", bpm: 90, bars: 4 },
  { id: "s03", title: "Uptown", key: "G", bpm: 140, bars: 4 },
  { id: "s04", title: "Coast", key: "Dm", bpm: 100, bars: 4 },
  { id: "s05", title: "Velvet", key: "F", bpm: 112, bars: 4 },
  { id: "s06", title: "Static", key: "Em", bpm: 128, bars: 4 },
  { id: "s07", title: "Mirage", key: "Bb", bpm: 96, bars: 4 },
  { id: "s08", title: "Cobalt", key: "D", bpm: 124, bars: 4 },
  { id: "s09", title: "Ember", key: "Gm", bpm: 86, bars: 4 },
  { id: "s10", title: "Lotus", key: "A", bpm: 132, bars: 4 },
  { id: "s11", title: "Drift", key: "Cm", bpm: 108, bars: 4 },
  { id: "s12", title: "Halcyon", key: "E", bpm: 118, bars: 4 },
  { id: "s13", title: "Nocturne", key: "Fm", bpm: 92, bars: 4 },
  { id: "s14", title: "Pulse", key: "Ab", bpm: 150, bars: 4 },
  { id: "s15", title: "Saffron", key: "Bm", bpm: 102, bars: 4 },
  { id: "s16", title: "Tidal", key: "Eb", bpm: 116, bars: 4 },
  { id: "s17", title: "Vermillion", key: "F#m", bpm: 138, bars: 4 },
  { id: "s18", title: "Glacier", key: "Db", bpm: 84, bars: 4 },
  { id: "s19", title: "Marrakech", key: "Dm", bpm: 110, bars: 4 },
  { id: "s20", title: "Apex", key: "B", bpm: 144, bars: 4 },
];

const player = new RemixPlayer();
const stemIndex = new Map<string, AudioStem>();
const added = new Set<string>();
const loaded = new Set<string>();

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="wrap">
    <h1>remix-core — open-source album</h1>
    <p class="sub">
      Twenty songs, every key, tempos from 84 to 150 BPM — 15 stems each. Pull stems into
      your remix and the engine time-stretches each to the anchor BPM and pitch-shifts each to
      the anchor key — in real time — then mixes them. The first stem you add sets the anchor.
      Export your version. Every sound is synthesized in your browser; no audio files.
    </p>
    <hr />
    <div class="label">Stems — open a song, then click to add</div>
    <div class="grid" id="songs"></div>
    <div class="deck">
      <div>
        <div class="label">Your remix</div>
        <div class="transport">
          <button class="act play" id="play" disabled>▶ Play</button>
          <button class="act" id="export" disabled>Export .wav</button>
          <span class="anchor" id="anchor"></span>
        </div>
        <div id="voices"></div>
      </div>
      <div>
        <div class="label">Coherence (the original engine)</div>
        <div class="issues" id="issues" style="margin-top:8px"></div>
        <div class="label" style="margin-top:18px">Master</div>
        <input type="range" id="master" min="0" max="100" value="85" style="width:100%;accent-color:var(--gold);margin-top:8px" />
      </div>
    </div>
    <footer>
      Built on <b>remix-core</b> (MIT). The same recombine + coherence primitive powers
      <a href="https://github.com/sboghossian/clausebox">clausebox</a> (contracts).
      Pay what you want — that part's on you.
    </footer>
  </div>
`;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const songsEl = el<HTMLDivElement>("songs");
const voicesEl = el<HTMLDivElement>("voices");
const issuesEl = el<HTMLDivElement>("issues");
const anchorEl = el<HTMLSpanElement>("anchor");
const playBtn = el<HTMLButtonElement>("play");
const exportBtn = el<HTMLButtonElement>("export");
const masterEl = el<HTMLInputElement>("master");

// ---- lazy song panels -------------------------------------------------------
function addStemButton(list: HTMLElement, stem: AudioStem) {
  stemIndex.set(stem.id, stem);
  const btn = document.createElement("button");
  btn.className = "stem";
  btn.dataset["id"] = stem.id;
  if (added.has(stem.id)) btn.setAttribute("disabled", "");
  btn.innerHTML = `<span>${stem.kind}</span><span class="plus">+</span>`;
  btn.addEventListener("click", () => addStem(stem.id));
  list.append(btn);
}

function boot() {
  for (const song of SONGS) {
    const panel = document.createElement("div");
    panel.className = "song";
    panel.innerHTML = `
      <button class="song-head">
        <span><span class="caret">▸</span> ${song.title}</span>
        <span class="meta mono">${song.key} · ${song.bpm}</span>
      </button>
      <div class="stems" hidden></div>`;
    const head = panel.querySelector<HTMLButtonElement>(".song-head")!;
    const list = panel.querySelector<HTMLDivElement>(".stems")!;
    const caret = panel.querySelector<HTMLSpanElement>(".caret")!;
    head.addEventListener("click", async () => {
      if (!list.hidden) {
        list.hidden = true;
        caret.textContent = "▸";
        return;
      }
      list.hidden = false;
      caret.textContent = "▾";
      if (!loaded.has(song.id)) {
        loaded.add(song.id);
        list.innerHTML = `<div class="loadhint">synthesizing…</div>`;
        const stems = await synthesizeSong(song);
        list.innerHTML = "";
        for (const stem of stems) addStemButton(list, stem);
      }
    });
    songsEl.append(panel);
  }
  renderVoices();
}

async function addStem(id: string) {
  if (added.has(id)) return;
  const stem = stemIndex.get(id);
  if (!stem) return;
  added.add(id);
  await player.addStem(stem);
  document.querySelector<HTMLButtonElement>(`.stem[data-id="${id}"]`)?.setAttribute("disabled", "");
  if (player.isPlaying === false && added.size === 1) {
    // first stem — nothing auto-plays; user hits Play
  }
  renderVoices();
}

function removeStem(id: string) {
  player.removeStem(id);
  added.delete(id);
  document.querySelector<HTMLButtonElement>(`.stem[data-id="${id}"]`)?.removeAttribute("disabled");
  renderVoices();
}

function renderVoices() {
  const ids = player.stemIds;
  playBtn.disabled = ids.length === 0;
  exportBtn.disabled = ids.length === 0;
  anchorEl.innerHTML = ids.length
    ? `anchor: <b>${player.anchorKey} · ${player.anchorBpm} BPM</b>`
    : "";

  if (!ids.length) {
    voicesEl.innerHTML = `<div class="empty">Add a stem to start. Try a Kick from Midnight, then a Bass from Sahel (different key + tempo) and hear them lock.</div>`;
    renderIssues();
    return;
  }

  voicesEl.innerHTML = "";
  for (const id of ids) {
    const stem = stemIndex.get(id)!;
    const v = document.createElement("div");
    v.className = "voice";
    v.innerHTML = `
      <div class="top">
        <span class="name">${stem.label}</span>
        <span class="tags">${stem.meta.key} · ${stem.meta.bpm}</span>
      </div>
      <div class="row">
        <button class="iconbtn mute">mute</button>
        <input type="range" min="0" max="100" value="100" class="level" />
        <button class="iconbtn remove">✕</button>
      </div>`;
    const mute = v.querySelector<HTMLButtonElement>(".mute")!;
    const level = v.querySelector<HTMLInputElement>(".level")!;
    const remove = v.querySelector<HTMLButtonElement>(".remove")!;
    let muted = false;
    mute.addEventListener("click", () => {
      muted = !muted;
      player.setMuted(id, muted);
      mute.classList.toggle("on", muted);
      mute.textContent = muted ? "muted" : "mute";
    });
    level.addEventListener("input", () => player.setLevel(id, Number(level.value) / 100));
    remove.addEventListener("click", () => removeStem(id));
    voicesEl.append(v);
  }
  renderIssues();
}

function renderIssues() {
  const stems = player.stemIds.map((id) => stemIndex.get(id)!);
  const issues = musicCoherence.validate(recombine(stems));
  if (!stems.length) {
    issuesEl.innerHTML = `<span style="color:var(--dim)">No stems yet.</span>`;
    return;
  }
  if (!issues.length) {
    issuesEl.innerHTML = `<span class="ok">All compatible — but the engine syncs clashing stems anyway, in real time.</span>`;
    return;
  }
  issuesEl.innerHTML = issues
    .map(
      (i) =>
        `<div class="issue"><span class="dot ${i.severity}"></span><div><span class="mono" style="font-size:11px;color:var(--dim)">${i.code}</span><br/>${i.message}<br/><span style="color:var(--dim)">→ the player fixes this live</span></div></div>`,
    )
    .join("");
}

playBtn.addEventListener("click", async () => {
  if (player.isPlaying) {
    player.stop();
    playBtn.textContent = "▶ Play";
    playBtn.classList.add("play");
  } else {
    await player.play();
    playBtn.textContent = "■ Stop";
    playBtn.classList.remove("play");
  }
});

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  exportBtn.textContent = "Rendering…";
  try {
    const blob = await player.exportWav(8);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-remix.wav";
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    exportBtn.textContent = "Export .wav";
    exportBtn.disabled = player.stemIds.length === 0;
  }
});

masterEl.addEventListener("input", () => player.setMasterLevel(Number(masterEl.value) / 100));

void boot();
