const state = {
  templates: [],
  projects: [],
  templateId: null,
  projectId: null,
  sourceType: "template", // template | html
  previewUrl: null,
  data: {},
  duration: 12,
  playing: false,
  raf: 0,
  t0: 0,
  t: 0,
  zoom: 1,
  view: "design", // design | code
  codeLoaded: false,
  codeDirty: false,
  codePath: "index.html",
  codeBaseline: "",
  video: null,
  overlays: [], // elements placed on top of the reel (see public/overlays.js)
  selectedId: null,
  closedGroups: new Set(["video:v-look", "video:v-captions", "video:v-audio", "video:v-format", "video:v-output"]),
};

// Output settings that apply to every project (templates and uploaded HTML); used by the preview and worker/render.mjs
const VIDEO_DEFAULTS = {
  speed: 1, trimStart: 0, trimEnd: 0, fadeIn: 0, fadeOut: 0.4,
  // Look (drawn by public/overlays.js in preview and export)
  lookBrightness: 0, lookContrast: 0, lookSaturation: 0, lookWarmth: 0, lookVignette: 0, lookGrain: 0,
  // Captions: "start-end text" per line
  captions: "", capStyle: "box", capAnim: "pop", capPos: "bottom", capFont: "Manrope", capSize: 64,
  capColor: "#FFFFFF", capBgColor: "#000000", capHighlight: "#FFD60A", capUpper: false,
  progressBar: "none", progressColor: "#FFFFFF", progressHeight: 10,
  // Audio
  music: "", musicName: "", musicVolume: 0.8, musicStart: 0,
  voice: "", voiceName: "", voiceVolume: 1, voiceOffset: 0, duckMusic: true,
  templateAudio: true, templateAudioVolume: 1,
  // Format
  aspect: "9:16", fitMode: "blur", padColor: "#000000", cropY: 50,
  fps: 30, resolution: "1080", quality: "high",
};
const ASPECTS = { "9:16": [9, 16], "4:5": [4, 5], "1:1": [1, 1], "16:9": [16, 9] };
state.video = { ...VIDEO_DEFAULTS };

const FONT_OPTIONS = ["Manrope", "Inter", "Poppins", "Montserrat", "Space Grotesk", "Sora", "Bebas Neue", "Anton", "DM Serif Display", "Playfair Display"];
const BG_STYLE_OPTIONS = [
  { value: "gradient", label: "Soft gradient" },
  { value: "glow", label: "Animated glow" },
  { value: "solid", label: "Solid" },
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dots" },
];

function videoFields() {
  const max = Math.max(1, Math.round(state.duration * 10) / 10);
  return [
    { type: "group", label: "Timing", id: "v-timing" },
    { key: "speed", label: "Playback speed", type: "range", min: 0.5, max: 2, step: 0.05, unit: "×" },
    { key: "trimStart", label: "Start at", type: "range", min: 0, max, step: 0.1, unit: "s" },
    { key: "trimEnd", label: "End at", type: "range", min: 0, max, step: 0.1, unit: "s", zeroLabel: "End" },
    { key: "fadeIn", label: "Fade in from black", type: "range", min: 0, max: 2, step: 0.1, unit: "s", zeroLabel: "Off" },
    { key: "fadeOut", label: "Fade out to black", type: "range", min: 0, max: 2, step: 0.1, unit: "s", zeroLabel: "Off" },
    { type: "group", label: "Look", id: "v-look" },
    { key: "lookBrightness", label: "Brightness", type: "range", min: -50, max: 50, step: 1, zeroLabel: "0" },
    { key: "lookContrast", label: "Contrast", type: "range", min: -50, max: 50, step: 1, zeroLabel: "0" },
    { key: "lookSaturation", label: "Saturation", type: "range", min: -100, max: 100, step: 1, zeroLabel: "0" },
    { key: "lookWarmth", label: "Warmth", type: "range", min: -100, max: 100, step: 1, zeroLabel: "0", hint: "Left = cooler, right = warmer." },
    { key: "lookVignette", label: "Vignette", type: "range", min: 0, max: 100, step: 1, zeroLabel: "Off" },
    { key: "lookGrain", label: "Film grain", type: "range", min: 0, max: 100, step: 1, zeroLabel: "Off" },
    { type: "group", label: "Captions", id: "v-captions" },
    { key: "captions", label: "Captions", type: "captions", rows: 5,
      hint: "One per line: start-end text (seconds), e.g. 0.0-1.4 Your hook goes here" },
    { key: "capAnim", label: "Animation", type: "select", options: [{ value: "pop", label: "Pop" }, { value: "fade", label: "Fade up" }, { value: "words", label: "Word by word" }, { value: "none", label: "None" }] },
    { key: "capStyle", label: "Style", type: "select", options: [{ value: "box", label: "Background box" }, { value: "outline", label: "Outline" }, { value: "shadow", label: "Shadow" }, { value: "plain", label: "Plain" }] },
    { key: "capPos", label: "Position", type: "select", options: [{ value: "bottom", label: "Lower third" }, { value: "middle", label: "Middle" }, { value: "top", label: "Top" }] },
    { key: "capFont", label: "Font", type: "font" },
    { key: "capSize", label: "Size", type: "range", min: 32, max: 120, step: 2, unit: "px" },
    { key: "capColor", label: "Text color", type: "color" },
    { key: "capBgColor", label: "Box / outline color", type: "color" },
    { key: "capHighlight", label: "Word highlight", type: "color" },
    { key: "capUpper", label: "Uppercase", type: "boolean" },
    { key: "progressBar", label: "Progress bar", type: "select", options: [{ value: "none", label: "Off" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }] },
    { key: "progressColor", label: "Progress bar color", type: "color" },
    { type: "group", label: "Audio", id: "v-audio" },
    { key: "music", label: "Background music", type: "audio", nameKey: "musicName" },
    { key: "musicVolume", label: "Music volume", type: "range", min: 0, max: 1, step: 0.05, percent: true },
    { key: "musicStart", label: "Start music at", type: "range", min: 0, max: 60, step: 0.5, unit: "s", hint: "Skip a slow intro in the track." },
    { key: "voice", label: "Voiceover", type: "audio", nameKey: "voiceName" },
    { key: "voiceVolume", label: "Voice volume", type: "range", min: 0, max: 2, step: 0.05, percent: true },
    { key: "voiceOffset", label: "Voice starts at", type: "range", min: 0, max, step: 0.1, unit: "s" },
    { key: "duckMusic", label: "Lower music under the voice", type: "boolean" },
    { key: "templateAudio", label: "Template soundtrack", type: "boolean", hint: "Some templates (e.g. Motion Promo) make their own music and effects." },
    { key: "templateAudioVolume", label: "Template soundtrack volume", type: "range", min: 0, max: 2, step: 0.05, percent: true },
    { type: "group", label: "Format", id: "v-format" },
    { key: "aspect", label: "Aspect ratio", type: "select", options: [
      { value: "9:16", label: "9:16 · Reels, Shorts, TikTok" }, { value: "4:5", label: "4:5 · Instagram feed" },
      { value: "1:1", label: "1:1 · Square" }, { value: "16:9", label: "16:9 · YouTube" }] },
    { key: "fitMode", label: "Fill", type: "select", options: [
      { value: "blur", label: "Fit, blurred background" }, { value: "color", label: "Fit, solid color" }, { value: "crop", label: "Crop" }],
      hint: "Only used when the ratio isn't 9:16." },
    { key: "padColor", label: "Background color", type: "color" },
    { key: "cropY", label: "Crop position", type: "range", min: 0, max: 100, step: 1, unit: "%", hint: "0% = top, 100% = bottom." },
    { type: "group", label: "Output", id: "v-output" },
    { key: "fps", label: "Frame rate", type: "select", options: [{ value: 24, label: "24 fps (film)" }, { value: 30, label: "30 fps" }, { value: 60, label: "60 fps (smooth)" }] },
    { key: "resolution", label: "Resolution", type: "select", options: [{ value: "1080", label: "1080 × 1920 (Full HD)" }, { value: "720", label: "720 × 1280 (smaller file)" }] },
    { key: "quality", label: "Quality", type: "select", options: [{ value: "high", label: "High" }, { value: "balanced", label: "Balanced" }, { value: "small", label: "Small file" }] },
  ];
}

/** Source-time window and output length after trim + speed. */
function outputWindow() {
  const v = state.video;
  const start = Math.min(Math.max(0, Number(v.trimStart) || 0), Math.max(0, state.duration - 0.1));
  const endRaw = Number(v.trimEnd) || 0;
  const end = endRaw > start ? Math.min(endRaw, state.duration) : state.duration;
  const speed = Math.min(4, Math.max(0.25, Number(v.speed) || 1));
  return { start, end, speed, outDur: (end - start) / speed };
}

const $ = (id) => document.getElementById(id);
const preview = $("preview");
const scrub = $("scrub");
const timeLabel = $("timeLabel");
const statusEl = $("status");
const bar = $("bar");

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) {
    location.href = `/signin?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("Sign in required");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Mirrored in the top bar: #status lives in the Export tab, which is usually hidden.
const topStatusEl = $("topStatus");
let topStatusTimer;
function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
  if (!topStatusEl) return;
  clearTimeout(topStatusTimer);
  topStatusEl.textContent = msg;
  topStatusEl.title = msg;
  topStatusEl.className = "status top-status" + (kind ? ` ${kind}` : "");
  if (kind === "ok") topStatusTimer = setTimeout(() => (topStatusEl.textContent = ""), 4000);
}

function scalePreview() {
  const frame = $("phoneFrame");
  if (!frame) return;
  // Base artboard width × zoom
  const base = 270;
  frame.style.width = `${base * state.zoom}px`;
  const s = frame.clientWidth / 1080;
  preview.style.transform = `scale(${s})`;
  const zl = $("zoomLabel");
  if (zl) zl.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setPlayIcon(playing) {
  const btn = $("btnPlay");
  if (!btn) return;
  btn.innerHTML = playing
    ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2.5" width="3" height="9" rx="0.5"/><rect x="8" y="2.5" width="3" height="9" rx="0.5"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2.2v9.6L12 7 3 2.2z"/></svg>`;
  btn.title = playing ? "Pause" : "Play";
}

function fmtRange(field, v) {
  if (field.zeroLabel && Number(v) === 0) return field.zeroLabel;
  if (field.percent) return `${Math.round(v * 100)}%`;
  const decimals = String(field.step || 1).split(".")[1]?.length || 0;
  return `${Number(v).toFixed(decimals)}${field.unit || ""}`;
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Upload failed");
  return out;
}

const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u || "");

/** Upload control for "image", "audio" and "media" (image or video) fields. */
function mediaControl(field, value, onChange, setExtra) {
  const isAudio = field.type === "audio";
  const isMedia = field.type === "media";
  const box = document.createElement("div");
  const row = document.createElement("div");
  row.className = "media-field";
  const thumb = document.createElement("div");
  thumb.className = "media-thumb" + (isAudio ? " audio" : "");
  const name = document.createElement("div");
  name.className = "media-name";
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "btn sm";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn ghost sm";
  clear.textContent = "×";
  clear.title = "Remove";
  const file = document.createElement("input");
  file.type = "file";
  file.hidden = true;
  file.accept = isAudio ? "audio/*,.mp3,.m4a,.aac,.wav,.ogg" : isMedia ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v,image/*" : "image/*";
  const url = document.createElement("input");
  url.type = "text";
  url.className = "media-url";
  url.placeholder = isAudio ? "" : isMedia ? "…or paste a video or image URL" : "…or paste an image URL";

  let current = value || "";
  const paint = () => {
    pick.textContent = current ? "Replace" : "Upload";
    clear.hidden = !current;
    if (isAudio) {
      thumb.textContent = "♪";
      name.textContent = current ? state.video[field.nameKey] || current.split("/").pop() : "No track";
    } else if (isVideoUrl(current)) {
      thumb.className = "media-thumb audio";
      thumb.style.backgroundImage = "";
      thumb.textContent = "▶";
      name.textContent = current.split("/").pop().slice(0, 40);
      url.value = current.startsWith("/uploads/") ? "" : current;
    } else {
      thumb.className = "media-thumb";
      thumb.textContent = "";
      thumb.style.backgroundImage = current ? `url("${current.replace(/"/g, "%22")}")` : "";
      name.textContent = current ? current.split("/").pop().slice(0, 40) : "Placeholder";
      url.value = current.startsWith("/uploads/") ? "" : current;
    }
  };
  const commit = (v, label) => {
    current = v;
    if (setExtra) setExtra(label || "");
    paint();
    onChange(v);
  };
  pick.addEventListener("click", () => file.click());
  clear.addEventListener("click", () => commit(""));
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    setStatus(`Uploading ${f.name}…`);
    try {
      const out = await uploadFile(f);
      commit(out.url, f.name);
      setStatus("Uploaded", "ok");
    } catch (e) {
      setStatus(e.message, "err");
    }
    file.value = "";
  });
  url.addEventListener("change", () => commit(url.value.trim()));
  row.append(thumb, name, pick, clear, file);
  box.appendChild(row);
  if (!isAudio) box.appendChild(url);
  paint();
  return box;
}

/** One editor control. onChange receives the typed value. */
function fieldControl(field, value, onChange, setExtra) {
  const wrap = document.createElement("div");
  wrap.className = "field" + (field.type === "boolean" ? " row" : "");
  const label = document.createElement("label");
  label.textContent = field.label;
  wrap.appendChild(label);

  let input;
  const type = field.type;
  if (type === "image" || type === "audio" || type === "media") {
    wrap.appendChild(mediaControl(field, value, onChange, setExtra));
  } else if (type === "select" || type === "font" || type === "bgStyle") {
    input = document.createElement("select");
    const options = type === "font" ? FONT_OPTIONS : type === "bgStyle" ? BG_STYLE_OPTIONS : field.options || [];
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = String(typeof o === "object" ? o.value : o);
      opt.textContent = typeof o === "object" ? o.label : o;
      if (type === "font") opt.style.fontFamily = o;
      input.appendChild(opt);
    }
    input.value = String(value ?? "");
    const numeric = options.length && typeof (options[0].value ?? options[0]) === "number";
    input.addEventListener("change", () => onChange(numeric ? Number(input.value) : input.value));
  } else if (type === "range") {
    input = document.createElement("input");
    input.type = "range";
    input.min = field.min ?? 0;
    input.max = field.max ?? 1;
    input.step = field.step ?? 0.1;
    input.value = value ?? field.min ?? 0;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = fmtRange(field, input.value);
    label.appendChild(val);
    input.addEventListener("input", () => {
      val.textContent = fmtRange(field, input.value);
      onChange(Number(input.value));
    });
  } else if (type === "captions") {
    const ta = document.createElement("textarea");
    ta.rows = field.rows || 4;
    ta.className = "captions-input";
    ta.placeholder = "0.0-1.4 Your hook goes here\n1.4-2.6 Show what your app does";
    ta.value = value ?? "";
    ta.addEventListener("input", () => onChange(ta.value));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn sm";
    add.textContent = "+ Caption at playhead";
    add.addEventListener("click", () => {
      const a = state.t, b = Math.min(state.duration, a + 2);
      ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, "\n") : "") + `${a.toFixed(1)}-${b.toFixed(1)} `;
      onChange(ta.value);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    wrap.append(ta, add);
  } else if (type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 3;
    input.value = value ?? "";
    input.addEventListener("input", () => onChange(input.value));
  } else if (type === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!value;
    input.addEventListener("input", () => onChange(input.checked));
  } else if (type === "color") {
    input = document.createElement("input");
    input.type = "color";
    input.value = value || "#34C759";
    input.addEventListener("input", () => onChange(input.value));
  } else if (type === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.value = value ?? 0;
    input.addEventListener("input", () => onChange(Number(input.value)));
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    if (field.placeholder) input.placeholder = field.placeholder;
    input.addEventListener("input", () => onChange(input.value));
  }
  if (input) wrap.appendChild(input);
  if (field.hint) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = field.hint;
    wrap.appendChild(hint);
  }
  return wrap;
}

/** Render a field list; { type: "group" } entries become collapsible headings. */
function renderFieldList(root, fields, getValue, onChange, scope) {
  root.innerHTML = "";
  let body = root;
  for (const field of fields) {
    if (field.type === "group") {
      const id = `${scope}:${field.id || field.label}`;
      const closed = state.closedGroups.has(id);
      const head = document.createElement("button");
      head.type = "button";
      head.className = "field-group" + (closed ? " closed" : "");
      head.textContent = field.label;
      body = document.createElement("div");
      body.className = "field-group-body" + (closed ? " closed" : "");
      const target = body;
      head.addEventListener("click", () => {
        const nowClosed = !state.closedGroups.has(id);
        nowClosed ? state.closedGroups.add(id) : state.closedGroups.delete(id);
        head.classList.toggle("closed", nowClosed);
        target.classList.toggle("closed", nowClosed);
      });
      root.append(head, body);
      continue;
    }
    body.appendChild(fieldControl(field, getValue(field.key), (v) => onChange(field.key, v),
      field.nameKey ? (label) => onChange(field.nameKey, label) : null));
  }
}

function renderFields(template) {
  renderFieldList($("fields"), template.fields || [], (k) => state.data[k], (k, v) => {
    state.data[k] = v;
    schedulePreview();
    scheduleAutosave();
  }, template.id);
}

function renderVideoFields() {
  renderFieldList($("videoFields"), videoFields(), (k) => state.video[k], (k, v) => {
    state.video[k] = v;
    if (/^(music|voice|duck|templateAudio)/.test(k)) syncMusic(true);
    if (k === "templateAudio" && v) loadTemplateAudio();
    updateVideoSummary();
    applyFade();
    pushGlobal();
    drawFormatGuide();
    scheduleAutosave();
  }, "video");
  updateVideoSummary();
  drawFormatGuide();
}

/** Look, captions and progress bar live in the preview's overlay runtime. */
function pushGlobal() {
  const win = previewWin();
  if (win?.__overlays?.setGlobal) win.__overlays.setGlobal(state.video);
}

/** Output pixel size for the chosen aspect ratio and resolution. */
function outputSize() {
  const [aw, ah] = ASPECTS[state.video.aspect] || ASPECTS["9:16"];
  const long = state.video.resolution === "720" ? 1280 : 1920;
  const short = state.video.resolution === "720" ? 720 : 1080;
  if (aw === ah) return [short, short];
  if (aw > ah) return [long, Math.round((long * ah) / aw / 2) * 2];
  return [short, Math.round((short * ah) / aw / 2) * 2];
}

/** Shows which part of the 9:16 frame a crop keeps, or how a fit will look. */
function drawFormatGuide() {
  const frame = $("phoneFrame");
  if (!frame) return;
  let g = $("formatGuide");
  if (!g) {
    g = document.createElement("div");
    g.id = "formatGuide";
    g.className = "format-guide";
    frame.appendChild(g);
  }
  const v = state.video;
  const [aw, ah] = ASPECTS[v.aspect] || ASPECTS["9:16"];
  if (v.aspect === "9:16" || !ASPECTS[v.aspect]) {
    g.hidden = true;
    return;
  }
  g.hidden = false;
  const [ow, oh] = outputSize();
  if (v.fitMode === "crop") {
    // Keep full width when the target is taller than wide; 16:9 keeps a band
    const keepH = Math.min(1, (9 / 16) * (ah / aw));
    const top = (1 - keepH) * (Number(v.cropY) / 100);
    g.className = "format-guide crop";
    g.style.setProperty("--top", `${top * 100}%`);
    g.style.setProperty("--h", `${keepH * 100}%`);
    g.innerHTML = `<i></i><span>${v.aspect} crop · ${ow}×${oh}</span>`;
  } else {
    g.className = "format-guide fit";
    g.style.removeProperty("--top");
    g.innerHTML = `<span>${v.aspect} · ${v.fitMode === "blur" ? "blurred background" : "solid background"} · ${ow}×${oh}</span>`;
  }
}

function updateVideoSummary() {
  const { outDur } = outputWindow();
  const v = state.video;
  const [ow, oh] = outputSize();
  $("videoSummary").textContent = `${outDur.toFixed(1)}s · ${v.aspect || "9:16"}`;
  if ($("frameW")) { $("frameW").value = ow; $("frameH").value = oh; $("frameRatio").value = v.aspect || "9:16"; }
  if ($("frameLabel")) $("frameLabel").textContent = `Reel — ${ow} × ${oh}${(v.aspect || "9:16") !== "9:16" ? ` (${v.aspect})` : ""}`;
  const spec = $("exportSpec");
  const audio = [v.music && "music", v.voice && "voiceover", v.templateAudio && state.templateAudioUrl && "template soundtrack"].filter(Boolean);
  if (spec) spec.textContent = `MP4 · ${ow}×${oh} · ${v.fps}fps · ${outDur.toFixed(1)}s${audio.length ? " · " + audio.join(" + ") : ""}`;
}

// ---- Preview of video settings: fade overlay + background music ----
const fadeOverlay = $("fadeOverlay");
const music = new Audio();
music.loop = true;

function fadeAmount(srcT) {
  const { start, speed, outDur } = outputWindow();
  const o = (srcT - start) / speed;
  const fi = Number(state.video.fadeIn) || 0, fo = Number(state.video.fadeOut) || 0;
  let a = 0;
  if (fi > 0) a = Math.max(a, 1 - o / fi);
  if (fo > 0) a = Math.max(a, 1 - (outDur - o) / fo);
  return Math.min(1, Math.max(0, a));
}

const voice = new Audio();
const tplAudio = new Audio();
let voiceTimer = 0;

const clampVol = (x) => Math.min(1, Math.max(0, x));
function voiceActive() {
  return !voice.paused && voice.currentTime > 0 && voice.currentTime < (voice.duration || Infinity) - 0.05;
}

function applyFade() {
  if (fadeOverlay) fadeOverlay.style.opacity = fadeAmount(state.t);
  if (!state.playing) return;
  const fade = 1 - fadeAmount(state.t);
  const v = state.video;
  const duck = v.duckMusic && v.voice && voiceActive() ? 0.3 : 1;
  if (v.music) music.volume = clampVol((Number(v.musicVolume) || 0) * fade * duck);
  if (v.voice) voice.volume = clampVol((Number(v.voiceVolume) || 0) * fade);
  if (state.templateAudioUrl) tplAudio.volume = clampVol((Number(v.templateAudioVolume) || 0) * fade * duck);
}

function setSrc(el, src) {
  const abs = new URL(src, location.href).href;
  if (el.src !== abs) { el.src = abs; return true; }
  return false;
}

/** Keep music (output time), voiceover and template soundtrack (reel time) in step with playback. */
function syncMusic(restart) {
  const v = state.video;
  clearTimeout(voiceTimer);
  if (!state.playing) {
    music.pause(); voice.pause(); tplAudio.pause();
    return;
  }
  const { start, speed } = outputWindow();

  if (v.music) {
    if (setSrc(music, v.music)) restart = true;
    if (restart) {
      const o = Math.max(0, (state.t - start) / speed) + (Number(v.musicStart) || 0);
      try { music.currentTime = music.duration ? o % music.duration : o; } catch (_) {}
    }
    music.play().catch(() => {});
  } else music.pause();

  if (v.voice) {
    setSrc(voice, v.voice);
    voice.playbackRate = speed;
    const at = state.t - (Number(v.voiceOffset) || 0);
    if (at >= 0) {
      try { voice.currentTime = at; } catch (_) {}
      voice.play().catch(() => {});
    } else {
      voice.pause();
      try { voice.currentTime = 0; } catch (_) {}
      voiceTimer = setTimeout(() => state.playing && voice.play().catch(() => {}), (-at / speed) * 1000);
    }
  } else voice.pause();

  if (v.templateAudio && state.templateAudioUrl) {
    setSrc(tplAudio, state.templateAudioUrl);
    tplAudio.playbackRate = speed;
    try { tplAudio.currentTime = state.t; } catch (_) {}
    tplAudio.play().catch(() => {});
  } else tplAudio.pause();
  applyFade();
}

/** Templates that make their own soundtrack expose __reel.audioWav(); preview it as a blob. */
async function loadTemplateAudio() {
  state.templateAudioUrl = null;
  updateVideoSummary();
  const reel = getReel();
  if (!reel || typeof reel.audioWav !== "function") return;
  const forId = state.data;
  try {
    const b64 = await reel.audioWav();
    if (forId !== state.data || !b64) return;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (state.templateAudioBlob) URL.revokeObjectURL(state.templateAudioBlob);
    state.templateAudioBlob = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    state.templateAudioUrl = state.templateAudioBlob;
    updateVideoSummary();
    if (state.playing) syncMusic(true);
  } catch (_) {}
}

function renderProjects() {
  const root = $("projects");
  root.innerHTML = "";
  if (!state.projects.length) {
    root.innerHTML = `<span style="color:var(--muted);font-size:12px">No projects yet</span>`;
    return;
  }
  for (const p of state.projects) {
    const row = document.createElement("div");
    row.className = "proj-row" + (p.id === state.projectId ? " active" : "");
    const link = document.createElement("a");
    link.className = "proj";
    link.href = `/app/projects/${p.id}`;
    const kind = p.sourceType === "html" ? "HTML upload" : p.templateId;
    link.innerHTML = `<b>${escapeHtml(p.name)}</b><span>${escapeHtml(kind)} · ${new Date(p.updatedAt).toLocaleString()}</span>`;
    row.appendChild(link);
    root.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 250);
}

function getReel() {
  try {
    return preview.contentWindow?.__reel || null;
  } catch {
    return null;
  }
}

function stopPlayback() {
  if (!state.playing) return;
  state.playing = false;
  cancelAnimationFrame(state.raf);
  setPlayIcon(false);
  syncMusic(false);
}

function refreshPreview() {
  stopPlayback();

  const onReady = () => {
    scalePreview();
    try {
      const reel = getReel();
      const dur = reel?.DUR;
      if (dur) {
        const prev = state.duration;
        state.duration = Number(dur) || state.duration;
        scrub.max = Math.round(state.duration * 10);
        if (prev !== state.duration) renderVideoFields();
      }
      if (reel?.setTime) reel.setTime(state.t);
    } catch (_) {}
    pushOverlays();
    loadTemplateAudio();
  };

  if (state.sourceType === "html" && state.previewUrl) {
    const onLoad = () => {
      onReady();
      preview.removeEventListener("load", onLoad);
    };
    preview.addEventListener("load", onLoad);
    preview.removeAttribute("srcdoc");
    // Cache-bust only — do not pass ?t=0 (that freezes the reel and breaks play)
    const base = state.previewUrl.split("?")[0];
    preview.src = `${base}?_=${Date.now()}`;
    return;
  }

  if (!state.templateId || state.templateId === "custom-html") return;
  const htmlUrl = `/templates/${state.templateId}/index.html`;
  fetch(htmlUrl)
    .then((r) => r.text())
    .then((html) => {
      // srcdoc stays same-origin so play/scrub can call window.__reel
      const baseTag = `<base href="/templates/${state.templateId}/">`;
      const inject = `<script>window.__PROJECT__=${JSON.stringify(state.data)};<\/script>`;
      let out = html;
      if (out.includes("<head>")) {
        out = out.replace("<head>", `<head>${baseTag}${inject}`);
      } else {
        out = `${baseTag}${inject}${out}`;
      }
      const onLoad = () => {
        onReady();
        preview.removeEventListener("load", onLoad);
      };
      preview.addEventListener("load", onLoad);
      preview.removeAttribute("src");
      preview.srcdoc = out;
    })
    .catch((e) => setStatus(e.message, "err"));
}

function seek(t) {
  state.t = Math.max(0, Math.min(state.duration, t));
  scrub.value = Math.round(state.t * 10);
  timeLabel.textContent = `${state.t.toFixed(1)}s`;
  applyFade();
  const reel = getReel();
  if (reel?.setTime) {
    try {
      reel.setTime(state.t);
    } catch (_) {}
  }
  syncHandles();
}

function playToggle() {
  if (state.playing) {
    stopPlayback();
    return;
  }
  const reel = getReel();
  if (!reel?.setTime) {
    setStatus("Preview not ready — wait a second, then press play", "err");
    return;
  }
  state.playing = true;
  setPlayIcon(true);
  // Plays the trimmed window at the chosen speed, looping — what the export will contain
  let { start, end } = outputWindow();
  if (state.t < start || state.t >= end - 0.05) seek(start);
  state.t0 = performance.now() - ((state.t - start) / outputWindow().speed) * 1000;
  syncMusic(true);
  const tick = (now) => {
    if (!state.playing) return;
    const w = outputWindow();
    let t = w.start + ((now - state.t0) / 1000) * w.speed;
    if (t >= w.end) {
      t = w.start;
      state.t0 = now;
      syncMusic(true);
    }
    seek(t);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

function setSaveState(text) {
  $("saveState").textContent = text;
}

let autosaveTimer;
function scheduleAutosave() {
  setSaveState("Unsaved");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveProject({ quiet: true }), 2500);
}

function projectPayload() {
  return { name: $("projectName").value.trim() || "Untitled reel", data: state.data, video: state.video, overlays: state.overlays };
}

async function saveProject({ quiet = false } = {}) {
  if (!state.projectId) return false;
  clearTimeout(autosaveTimer);
  setSaveState("Saving…");
  if (!quiet) setStatus("Saving…");
  try {
    await api(`/api/projects/${state.projectId}`, { method: "PUT", body: JSON.stringify(projectPayload()) });
    setSaveState("Saved");
    if (!quiet) setStatus("Saved", "ok");
    await loadProjectList();
    return true;
  } catch (e) {
    setSaveState("Not saved");
    setStatus(e.message, "err");
    return false;
  }
}

async function loadProject(id) {
  const p = await api(`/api/projects/${id}`);
  state.projectId = p.id;
  state.templateId = p.templateId;
  state.sourceType = p.sourceType || "template";
  state.previewUrl = p.previewUrl || null;
  state.data = p.data || {};
  state.video = { ...VIDEO_DEFAULTS, ...(p.video || {}) };
  state.overlays = Array.isArray(p.overlays) ? p.overlays : [];
  state.selectedId = null;
  state.duration = p.duration || p.data?.duration || 12;
  state.codeLoaded = false;
  state.codeDirty = false;
  $("projectName").value = p.name;
  scrub.max = Math.round(state.duration * 10);
  setSaveState("Saved");
  renderProjects();
  const template = state.templates.find((t) => t.id === p.templateId);
  if (state.sourceType === "html") {
    $("fields").innerHTML = `<p style="color:var(--muted);font-size:13px;line-height:1.45">Custom HTML reel. Edit in <b>Code</b>, then <b>Export MP4</b>.</p>`;
  } else if (template) {
    renderFields(template);
  } else {
    $("fields").innerHTML = "";
  }
  renderVideoFields();
  refreshPreview();
  if (state.view === "code") loadCodeEditor({ force: true });
  setStatus(`Loaded ${p.name}`, "ok");
}

async function loadProjectList() {
  state.projects = await api("/api/projects");
  renderProjects();
}

async function loadOutputs() {
  const list = await api(`/api/projects/${state.projectId}/exports`);
  const root = $("outputs");
  root.innerHTML = list.length
    ? list
        .map((o) => {
          const when = new Date(o.createdAt).toLocaleString();
          const mb = o.size ? ` · ${(o.size / 1048576).toFixed(1)} MB` : "";
          return `<a href="${o.url}" download>${escapeHtml(when)}${mb}</a>`;
        })
        .join("")
    : `<span style="color:var(--muted);font-size:12px">No exports yet</span>`;
}

function showExportTab() {
  document.querySelectorAll(".panel-tab[data-right]").forEach((b) => {
    b.classList.toggle("on", b.dataset.right === "export");
  });
  $("rightDesign")?.classList.add("hidden");
  $("rightCode")?.classList.add("hidden");
  $("rightExport")?.classList.remove("hidden");
}

function setCodeDirty(dirty) {
  state.codeDirty = dirty;
  $("codeDirty")?.classList.toggle("hidden", !dirty);
}

function setView(view) {
  state.view = view;
  const isCode = view === "code";
  $("viewDesign")?.classList.toggle("on", !isCode);
  $("viewCode")?.classList.toggle("on", isCode);
  $("canvas")?.classList.toggle("hidden", isCode);
  $("codeView")?.classList.toggle("hidden", !isCode);
  $("btnApplyCode")?.toggleAttribute("hidden", !isCode);
  if (isCode) loadCodeEditor();
  else scalePreview();
}

async function loadCodeEditor({ force = false } = {}) {
  const editor = $("codeEditor");
  if (!editor) return;
  if (state.codeDirty && state.codeLoaded && !force) {
    if (!confirm("Reload and discard unsaved HTML changes?")) return;
  }
  setStatus("Loading HTML…");
  try {
    let payload;
    if (state.projectId) {
      payload = await api(`/api/projects/${state.projectId}/source`);
    } else if (state.templateId && state.templateId !== "custom-html") {
      payload = await api(`/api/templates/${state.templateId}/source`);
    } else {
      editor.value = "<!-- Upload an HTML reel or pick a template, then edit here -->\n";
      state.codeBaseline = editor.value;
      state.codeLoaded = true;
      state.codePath = "index.html";
      $("codePath").textContent = state.codePath;
      setCodeDirty(false);
      setStatus("No source yet — upload HTML or choose a template", "err");
      return;
    }
    editor.value = payload.html || "";
    state.codeBaseline = editor.value;
    state.codeLoaded = true;
    state.codePath = payload.path || "index.html";
    $("codePath").textContent = state.codePath;
    setCodeDirty(false);
    setStatus("HTML loaded — edit, then Save & preview", "ok");
  } catch (e) {
    setStatus(e.message, "err");
  }
}

async function saveCodeAndPreview() {
  const editor = $("codeEditor");
  if (!editor) return;
  const html = editor.value;
  if (!html.trim()) {
    setStatus("HTML is empty", "err");
    return;
  }
  setStatus("Saving HTML…");
  try {
    const { project } = await api(`/api/projects/${state.projectId}/source`, {
      method: "PUT",
      body: JSON.stringify({ html }),
    });
    state.sourceType = "html";
    state.previewUrl = project.previewUrl;
    state.templateId = project.templateId || state.templateId;
    state.duration = project.duration || state.duration;
    scrub.max = Math.round(state.duration * 10);
    state.codeBaseline = html;
    state.codeLoaded = true;
    state.codePath = project.htmlPath || state.codePath;
    $("codePath").textContent = state.codePath;
    setCodeDirty(false);
    $("projectName").value = project.name;
    $("fields").innerHTML = `<p style="color:var(--muted);font-size:13px;line-height:1.45">Custom HTML reel. Edit in <b>Code</b>, then <b>Export MP4</b>.</p>`;
    await loadProjectList();
    renderProjects();
    setStatus("Saved — switching to preview", "ok");
    setView("design");
    refreshPreview();
  } catch (e) {
    setStatus(e.message, "err");
  }
}

window.__openCodeView = () => setView("code");

async function renderExport() {
  // Save first so the worker sees the current fields and video settings
  if (!(await saveProject())) return;
  showExportTab();
  $("btnRender").disabled = true;
  $("download").innerHTML = "";
  bar.style.width = "0%";
  setStatus("Queued render…");
  try {
    const job = await api(`/api/projects/${state.projectId}/render`, { method: "POST", body: "{}" });
    const poll = async () => {
      const j = await api(`/api/jobs/${job.id}`);
      bar.style.width = `${j.progress || 0}%`;
      if (j.status === "rendering" || j.status === "queued") {
        setStatus(`Rendering… ${Math.round(j.progress || 0)}%`);
        setTimeout(poll, 800);
        return;
      }
      $("btnRender").disabled = false;
      if (j.status === "done") {
        setStatus("Export ready", "ok");
        $("download").innerHTML = `<a class="btn primary" style="display:inline-block;text-decoration:none;margin-top:8px" href="${j.outputUrl}" download>Download MP4</a>`;
        loadOutputs();
      } else {
        setStatus(j.error || "Render failed", "err");
      }
    };
    poll();
  } catch (e) {
    $("btnRender").disabled = false;
    setStatus(e.message, "err");
  }
}

/* ---------- Overlay elements: drag-and-drop editing on the preview ---------- */

const TEXT_TYPES = ["heading", "text", "button", "emoji"];
const ELEMENT_TYPES = {
  heading: { label: "Heading", icon: "<i>H</i>", make: () => ({ text: "Your headline", font: "Inter", fontSize: 96, weight: 800, color: "#ffffff", align: "center", w: 80, shadow: true }) },
  text: { label: "Text", icon: "<i style='font-size:14px'>Aa</i>", make: () => ({ text: "Add a line of text", font: "Inter", fontSize: 48, weight: 600, color: "#ffffff", align: "center", w: 70, shadow: true }) },
  button: { label: "Button", icon: "<i><span class='sw pill'></span></i>", make: () => ({ text: "Download now", font: "Inter", fontSize: 44, weight: 700, color: "#ffffff", bg: "#0d99ff", radius: 999, align: "center", w: 56 }) },
  image: { label: "Image", icon: "<i>▣</i>", make: () => ({ src: "", fit: "contain", radius: 24, w: 40, h: 22.5 }) },
  rect: { label: "Rectangle", icon: "<i><span class='sw'></span></i>", make: () => ({ bg: "#ffffff", radius: 24, w: 60, h: 8, opacity: 90 }) },
  circle: { label: "Circle", icon: "<i><span class='sw round'></span></i>", make: () => ({ bg: "#0d99ff", w: 30, h: 16.875 }) },
  emoji: { label: "Emoji", icon: "<i>🔥</i>", make: () => ({ text: "🔥", fontSize: 160, w: 20, align: "center" }) },
};
const ANIM_IN = [
  { value: "none", label: "None" }, { value: "fade", label: "Fade in" }, { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" }, { value: "slide-left", label: "Slide in from right" },
  { value: "slide-right", label: "Slide in from left" }, { value: "pop", label: "Pop" }, { value: "zoom", label: "Zoom in" },
  { value: "blur", label: "Blur in" }, { value: "spin", label: "Spin in" }, { value: "typewriter", label: "Typewriter" },
];
const ANIM_OUT = [
  { value: "none", label: "None" }, { value: "fade", label: "Fade out" }, { value: "slide-up", label: "Slide up" },
  { value: "slide-down", label: "Slide down" }, { value: "slide-left", label: "Slide out left" },
  { value: "slide-right", label: "Slide out right" }, { value: "pop", label: "Pop out" }, { value: "zoom", label: "Zoom out" },
  { value: "blur", label: "Blur out" }, { value: "spin", label: "Spin out" },
];
const LOOPS = [
  { value: "none", label: "None" }, { value: "pulse", label: "Pulse" }, { value: "float", label: "Float" },
  { value: "wiggle", label: "Wiggle" }, { value: "spin", label: "Spin" },
];

const ovEditor = $("ovEditor");
const selected = () => state.overlays.find((o) => o.id === state.selectedId) || null;
const round1 = (n) => Math.round(n * 10) / 10;

function previewWin() {
  try {
    return preview.contentWindow;
  } catch {
    return null;
  }
}

/** Send elements to the preview, loading the shared runtime into it the first time. */
function pushOverlays() {
  const win = previewWin();
  if (!win) return;
  if (win.__overlays) {
    win.__overlays.set(state.overlays);
    win.__overlays.setGlobal?.(state.video);
    win.__overlays.render(state.t);
    requestAnimationFrame(syncHandles);
    return;
  }
  const doc = preview.contentDocument;
  if (!doc?.body || win.__overlaysLoading) return;
  win.__overlaysLoading = true;
  const script = doc.createElement("script");
  script.src = "/overlays.js";
  script.onload = () => pushOverlays();
  doc.body.appendChild(script);
}

function visibleAt(o, t) {
  const start = Number(o.start) || 0;
  const end = Number(o.end) > start ? Number(o.end) : Infinity;
  return t >= start && t < end;
}

/** Selection boxes over the preview, mirroring each element's layout box. */
function syncHandles() {
  const boxes = previewWin()?.__overlays?.boxes?.() || {};
  const seen = new Set();
  for (const o of state.overlays) {
    const b = boxes[o.id];
    if (!b) continue;
    seen.add(o.id);
    let el = ovEditor.querySelector(`[data-id="${o.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "ov-box";
      el.dataset.id = o.id;
      el.innerHTML = `<span class="ov-handle" data-handle="1"></span>`;
      ovEditor.appendChild(el);
    }
    Object.assign(el.style, { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
    el.classList.toggle("sel", o.id === state.selectedId);
    el.classList.toggle("off", !visibleAt(o, state.t));
    el.querySelector(".ov-handle").hidden = o.id !== state.selectedId;
  }
  ovEditor.querySelectorAll(".ov-box").forEach((el) => {
    if (!seen.has(el.dataset.id)) el.remove();
  });
}

function overlaysChanged({ inspector = false } = {}) {
  pushOverlays();
  renderLayers();
  if (inspector) renderElementInspector();
  scheduleAutosave();
}

function addElement(type, at, extra = {}) {
  const def = ELEMENT_TYPES[type];
  if (!def) return;
  const base = def.make();
  const w = base.w;
  const h = base.h ?? 6;
  const dur = state.duration;
  const start = round1(Math.min(state.t, Math.max(0, dur - 1)));
  const o = {
    id: crypto.randomUUID().slice(0, 8),
    type,
    x: round1(Math.min(100 - w, Math.max(0, (at?.x ?? 50) - w / 2))),
    y: round1(Math.min(96, Math.max(0, (at?.y ?? 50) - h / 2))),
    rotation: 0,
    opacity: 100,
    start,
    end: 0,
    animIn: type === "emoji" || type === "button" ? "pop" : type === "heading" ? "slide-up" : "fade",
    inDur: 0.5,
    animOut: "fade",
    outDur: 0.4,
    loop: type === "emoji" ? "float" : "none",
    ...base,
    ...extra,
  };
  state.overlays.push(o);
  selectElement(o.id);
  overlaysChanged();
  setStatus(`${def.label} added at ${start.toFixed(1)}s`, "ok");
}

function selectElement(id) {
  state.selectedId = id;
  renderElementInspector();
  renderLayers();
  syncHandles();
  if (id) {
    document.querySelector('.panel-tab[data-right="design"]:not(.on)')?.click();
    $("rightDesign").scrollTop = 0;
  }
}

function removeSelected() {
  const o = selected();
  if (!o) return;
  state.overlays = state.overlays.filter((x) => x !== o);
  selectElement(null);
  overlaysChanged();
}

function duplicateSelected() {
  const o = selected();
  if (!o) return;
  const copy = { ...structuredClone(o), id: crypto.randomUUID().slice(0, 8), x: round1(Math.min(95, o.x + 3)), y: round1(Math.min(95, o.y + 3)) };
  state.overlays.splice(state.overlays.indexOf(o) + 1, 0, copy);
  selectElement(copy.id);
  overlaysChanged();
}

function moveSelected(step) {
  const o = selected();
  if (!o) return;
  const i = state.overlays.indexOf(o);
  const j = Math.min(state.overlays.length - 1, Math.max(0, i + step));
  if (i === j) return;
  state.overlays.splice(i, 1);
  state.overlays.splice(j, 0, o);
  overlaysChanged();
}

function renderElementTiles() {
  const root = $("elementTiles");
  root.innerHTML = "";
  for (const [type, def] of Object.entries(ELEMENT_TYPES)) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "el-tile";
    tile.draggable = true;
    tile.innerHTML = `${def.icon}<span>${def.label}</span>`;
    tile.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-reel-element", type);
      e.dataTransfer.effectAllowed = "copy";
    });
    tile.addEventListener("click", () => addElement(type));
    root.appendChild(tile);
  }
}

function layerLabel(o) {
  if (TEXT_TYPES.includes(o.type)) return (o.text || "").split("\n")[0] || ELEMENT_TYPES[o.type].label;
  return ELEMENT_TYPES[o.type]?.label || o.type;
}

function renderLayers() {
  const root = $("layers");
  if (!state.overlays.length) {
    root.innerHTML = `<span style="color:var(--muted);font-size:12px">No elements yet</span>`;
    return;
  }
  root.innerHTML = "";
  for (const o of [...state.overlays].reverse()) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "layer-row" + (o.id === state.selectedId ? " sel" : "");
    const end = Number(o.end) > Number(o.start) ? `${Number(o.end).toFixed(1)}s` : "end";
    row.innerHTML = `<span class="lt">${ELEMENT_TYPES[o.type]?.icon.replace(/<\/?i[^>]*>/g, "") || ""}</span>
      <b>${escapeHtml(layerLabel(o))}</b><span>${Number(o.start || 0).toFixed(1)}s–${end}</span>`;
    row.addEventListener("click", () => {
      selectElement(o.id);
      if (!visibleAt(o, state.t)) seek(Number(o.start) + Math.min(0.6, Number(o.inDur) || 0.5));
    });
    root.appendChild(row);
  }
}

function elementFields(o) {
  const max = Math.max(1, round1(state.duration));
  const isText = TEXT_TYPES.includes(o.type);
  const f = [{ type: "group", label: "Content", id: "el-content" }];
  if (o.type === "emoji") f.push({ key: "text", label: "Emoji or symbol", type: "text" });
  else if (isText) f.push({ key: "text", label: "Text", type: "textarea", rows: 2 });
  if (o.type === "image") {
    f.push({ key: "src", label: "Image", type: "image" });
    f.push({ key: "fit", label: "Fit", type: "select", options: [{ value: "contain", label: "Show whole image" }, { value: "cover", label: "Fill the box" }] });
  }
  f.push({ type: "group", label: "Style", id: "el-style" });
  if (isText && o.type !== "emoji") {
    f.push({ key: "font", label: "Font", type: "font" });
    f.push({ key: "fontSize", label: "Size", type: "range", min: 16, max: 240, step: 1, unit: "px" });
    f.push({ key: "weight", label: "Weight", type: "select", options: [400, 500, 600, 700, 800, 900].map((v) => ({ value: v, label: String(v) })) });
    f.push({ key: "color", label: "Color", type: "color" });
    f.push({ key: "align", label: "Align", type: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] });
  }
  if (o.type === "emoji") f.push({ key: "fontSize", label: "Size", type: "range", min: 40, max: 480, step: 2, unit: "px" });
  if (o.type === "heading" || o.type === "text") f.push({ key: "boxed", label: "Background box", type: "boolean" });
  if (["button", "rect", "circle"].includes(o.type) || o.boxed) f.push({ key: "bg", label: o.type === "button" ? "Button color" : "Fill", type: "color" });
  if (["button", "rect", "image"].includes(o.type) || o.boxed) f.push({ key: "radius", label: "Corner radius", type: "range", min: 0, max: 200, step: 1, unit: "px" });
  if (isText && o.type !== "emoji") f.push({ key: "shadow", label: "Text shadow", type: "boolean" });
  f.push({ key: "w", label: "Width", type: "range", min: 4, max: 100, step: 0.5, unit: "%" });
  if (o.type === "rect" || o.type === "image") f.push({ key: "h", label: "Height", type: "range", min: 1, max: 100, step: 0.5, unit: "%" });
  f.push({ key: "rotation", label: "Rotation", type: "range", min: -180, max: 180, step: 1, unit: "°" });
  f.push({ key: "opacity", label: "Opacity", type: "range", min: 0, max: 100, step: 1, unit: "%" });
  f.push({ type: "group", label: "Animation", id: "el-anim" });
  f.push({ key: "start", label: "Appears at", type: "range", min: 0, max, step: 0.1, unit: "s" });
  f.push({ key: "end", label: "Disappears at", type: "range", min: 0, max, step: 0.1, unit: "s", zeroLabel: "End" });
  f.push({ key: "animIn", label: "Entrance", type: "select", options: isText ? ANIM_IN : ANIM_IN.filter((a) => a.value !== "typewriter") });
  f.push({ key: "inDur", label: "Entrance length", type: "range", min: 0.1, max: 3, step: 0.1, unit: "s" });
  f.push({ key: "animOut", label: "Exit", type: "select", options: ANIM_OUT, hint: "Plays before “Disappears at”; set that time for an exit." });
  f.push({ key: "outDur", label: "Exit length", type: "range", min: 0.1, max: 3, step: 0.1, unit: "s" });
  f.push({ key: "loop", label: "While visible", type: "select", options: LOOPS });
  return f;
}

// Changing these alters which inspector fields exist
const RESHAPE_KEYS = new Set(["boxed"]);

function renderElementInspector() {
  const o = selected();
  $("elementSection").classList.toggle("hidden", !o);
  if (!o) return;
  $("elementTitle").textContent = ELEMENT_TYPES[o.type]?.label || "Element";
  renderFieldList($("elementFields"), elementFields(o), (k) => o[k], (k, v) => {
    o[k] = v;
    if (o.type === "circle" && k === "w") o.h = round1((v * 1080) / 1920);
    overlaysChanged({ inspector: RESHAPE_KEYS.has(k) });
  }, `el:${o.type}`);
}

/* Drop new elements (or image files) onto the video */
function framePoint(e) {
  const r = ovEditor.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
}

ovEditor.addEventListener("dragover", (e) => {
  const types = [...(e.dataTransfer?.types || [])];
  if (!types.includes("application/x-reel-element") && !types.includes("Files")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  ovEditor.classList.add("drag");
});
ovEditor.addEventListener("dragleave", () => ovEditor.classList.remove("drag"));
ovEditor.addEventListener("drop", async (e) => {
  e.preventDefault();
  ovEditor.classList.remove("drag");
  const at = framePoint(e);
  const type = e.dataTransfer.getData("application/x-reel-element");
  if (type) return addElement(type, at);
  const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith("image/"));
  if (!file) return setStatus("Drop an image file, or drag an element from the Elements panel", "err");
  setStatus(`Uploading ${file.name}…`);
  try {
    const { url } = await uploadFile(file);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode().catch(() => {});
    const w = 40;
    const h = img.naturalWidth ? round1(((w * 1080) / 1920) * (img.naturalHeight / img.naturalWidth)) : 22.5;
    addElement("image", at, { src: url, w, h: Math.min(90, h) });
  } catch (err) {
    setStatus(err.message, "err");
  }
});

/* Move / resize on the preview */
let gesture = null;
ovEditor.addEventListener("pointerdown", (e) => {
  const box = e.target.closest(".ov-box");
  if (!box) {
    selectElement(null);
    return;
  }
  e.preventDefault();
  if (state.playing) playToggle();
  const o = state.overlays.find((x) => x.id === box.dataset.id);
  if (!o) return;
  if (state.selectedId !== o.id) selectElement(o.id);
  const r = ovEditor.getBoundingClientRect();
  gesture = { o, resize: !!e.target.dataset.handle, sx: e.clientX, sy: e.clientY, r, x: o.x, y: o.y, w: o.w, h: o.h, fs: o.fontSize, moved: false };
  ovEditor.setPointerCapture(e.pointerId);
});
ovEditor.addEventListener("pointermove", (e) => {
  if (!gesture) return;
  const g = gesture;
  const dx = ((e.clientX - g.sx) / g.r.width) * 100;
  const dy = ((e.clientY - g.sy) / g.r.height) * 100;
  if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
  g.moved = true;
  const o = g.o;
  if (g.resize) {
    o.w = round1(Math.max(4, Math.min(100, g.w + dx)));
    if (o.type === "circle") o.h = round1((o.w * 1080) / 1920);
    else if (o.type === "rect" || o.type === "image") o.h = round1(Math.max(1, g.h + dy));
    if (o.type === "emoji") o.fontSize = Math.round(Math.max(40, g.fs * (o.w / g.w)));
  } else {
    let x = g.x + dx;
    const box = ovEditor.querySelector(`[data-id="${o.id}"]`);
    const bw = box ? (box.offsetWidth / g.r.width) * 100 : o.w;
    const snap = Math.abs(x + bw / 2 - 50) < 1.5;
    if (snap) x = 50 - bw / 2;
    o.x = round1(x);
    o.y = round1(g.y + dy);
    showGuide(snap);
  }
  pushOverlays();
});
function endGesture() {
  if (!gesture) return;
  const moved = gesture.moved;
  gesture = null;
  showGuide(false);
  if (moved) overlaysChanged({ inspector: true });
}
ovEditor.addEventListener("pointerup", endGesture);
ovEditor.addEventListener("pointercancel", endGesture);

function showGuide(on) {
  let g = ovEditor.querySelector(".ov-guide");
  if (on && !g) {
    g = document.createElement("div");
    g.className = "ov-guide";
    ovEditor.appendChild(g);
  } else if (!on && g) g.remove();
}

addEventListener("keydown", (e) => {
  if (!selected() || e.target.closest("input, textarea, select, [contenteditable]")) return;
  const o = selected();
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    removeSelected();
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === "Escape") {
    selectElement(null);
  } else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const step = e.shiftKey ? 2 : 0.5;
    if (e.key === "ArrowLeft") o.x = round1(o.x - step);
    if (e.key === "ArrowRight") o.x = round1(o.x + step);
    if (e.key === "ArrowUp") o.y = round1(o.y - step);
    if (e.key === "ArrowDown") o.y = round1(o.y + step);
    overlaysChanged();
  }
});

$("elDelete").addEventListener("click", removeSelected);
$("elDuplicate").addEventListener("click", duplicateSelected);
$("elForward").addEventListener("click", () => moveSelected(1));
$("elBack").addEventListener("click", () => moveSelected(-1));
$("elStartHere").addEventListener("click", () => {
  const o = selected();
  if (!o) return;
  o.start = round1(state.t);
  if (Number(o.end) && o.end <= o.start) o.end = 0;
  overlaysChanged({ inspector: true });
});
$("elEndHere").addEventListener("click", () => {
  const o = selected();
  if (!o) return;
  if (state.t <= Number(o.start)) return setStatus("Move the playhead after the element's start first", "err");
  o.end = round1(state.t);
  overlaysChanged({ inspector: true });
});

renderElementTiles();

$("btnPlay").addEventListener("click", playToggle);
$("scrub").addEventListener("input", () => {
  if (state.playing) playToggle();
  seek(Number(scrub.value) / 10);
});
$("btnSave").addEventListener("click", () => {
  if (state.view === "code") saveCodeAndPreview();
  else saveProject();
});
$("btnRender").addEventListener("click", renderExport);
$("btnNew").addEventListener("click", () => (location.href = "/app/new"));
$("projectName").addEventListener("input", scheduleAutosave);

// Flush a pending autosave when the tab closes or navigates away
addEventListener("pagehide", () => {
  if (!autosaveTimer || $("saveState").textContent !== "Unsaved") return;
  fetch(`/api/projects/${state.projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(projectPayload()),
    keepalive: true,
  });
});

$("viewDesign")?.addEventListener("click", () => setView("design"));
$("viewCode")?.addEventListener("click", () => setView("code"));
$("btnApplyCode")?.addEventListener("click", saveCodeAndPreview);
$("btnSaveCode")?.addEventListener("click", saveCodeAndPreview);
$("btnApplyCodeSide")?.addEventListener("click", saveCodeAndPreview);
$("btnOpenCode")?.addEventListener("click", () => setView("code"));
$("btnReloadCode")?.addEventListener("click", () => loadCodeEditor({ force: true }));
$("codeEditor")?.addEventListener("input", () => {
  const dirty = $("codeEditor").value !== state.codeBaseline;
  setCodeDirty(dirty);
});
$("codeEditor")?.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveCodeAndPreview();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = `${el.value.slice(0, start)}  ${el.value.slice(end)}`;
    el.selectionStart = el.selectionEnd = start + 2;
    setCodeDirty(el.value !== state.codeBaseline);
  }
});

$("zoomIn")?.addEventListener("click", () => {
  state.zoom = Math.min(1.8, Math.round((state.zoom + 0.1) * 10) / 10);
  scalePreview();
});
$("zoomOut")?.addEventListener("click", () => {
  state.zoom = Math.max(0.5, Math.round((state.zoom - 0.1) * 10) / 10);
  scalePreview();
});

addEventListener("resize", scalePreview);

async function boot() {
  const [, id, tab] = location.pathname.match(/^\/app\/projects\/([\w-]+)(?:\/(exports))?/) || [];
  if (!id) {
    location.href = "/app";
    return;
  }
  state.templates = await api("/api/templates");
  await loadProject(id);
  renderLayers();
  renderElementInspector();
  await loadProjectList();
  await loadOutputs();
  if (tab === "exports") showExportTab();
  scalePreview();
  setPlayIcon(false);
}

boot().catch((e) => setStatus(e.message, "err"));
