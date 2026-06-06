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

const SONGS: SongSpec[] = [
  { id: "a", title: "Midnight", key: "C", bpm: 120, bars: 4 },
  { id: "b", title: "Sahel", key: "Am", bpm: 90, bars: 4 },
  { id: "c", title: "Uptown", key: "G", bpm: 140, bars: 4 },
];

const player = new RemixPlayer();
const stemIndex = new Map<string, AudioStem>();
const added = new Set<string>();

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="wrap">
    <h1>remix-core — open-source album</h1>
    <p class="sub">
      Three songs, three keys, three tempos. Pull stems into your remix and the engine
      time-stretches each to the anchor BPM and pitch-shifts each to the anchor key — in real
      time — then mixes them. The first stem you add sets the anchor. Export your version.
      Every sound is synthesized in your browser; no audio files.
    </p>
    <hr />
    <div class="label">Stems — click to add</div>
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

// ---- synth all songs up front ----------------------------------------------
async function boot() {
  for (const song of SONGS) {
    const panel = document.createElement("div");
    panel.className = "song";
    panel.innerHTML = `<h3>${song.title}</h3><div class="meta mono">${song.key} · ${song.bpm} BPM</div><div class="stems"></div>`;
    songsEl.append(panel);
    const stems = await synthesizeSong(song);
    const list = panel.querySelector(".stems")!;
    for (const stem of stems) {
      stemIndex.set(stem.id, stem);
      const btn = document.createElement("button");
      btn.className = "stem";
      btn.dataset["id"] = stem.id;
      btn.innerHTML = `<span>${stem.kind}</span><span class="plus">+</span>`;
      btn.addEventListener("click", () => addStem(stem.id));
      list.append(btn);
    }
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
