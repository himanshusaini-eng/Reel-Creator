#!/usr/bin/env node
/**
 * Render a saved project to MP4.
 * Usage: node worker/render.mjs <projectId> [outPath]
 */
import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname, sep } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { ensureReelBridge } from "../server/reel-bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const projectId = process.argv[2];
const outPathArg = process.argv[3];

if (!projectId) {
  console.error("Usage: node worker/render.mjs <projectId> [outPath]");
  process.exit(1);
}

const projectPath = join(ROOT, "projects", `${projectId}.json`);
if (!existsSync(projectPath)) {
  console.error("Project not found:", projectId);
  process.exit(1);
}

const project = JSON.parse(readFileSync(projectPath, "utf8"));
const outPath = outPathArg || join(ROOT, "output", `${projectId.slice(0, 8)}.mp4`);
const framesDir = join(tmpdir(), `reel-frames-${randomUUID()}`);
mkdirSync(framesDir, { recursive: true });
mkdirSync(dirname(outPath), { recursive: true });

const W = 1080;
const H = 1920;

// Video settings from the editor (see VIDEO_DEFAULTS in public/app.js)
const V = {
  speed: 1, trimStart: 0, trimEnd: 0, fadeIn: 0, fadeOut: 0, music: "", musicVolume: 0.8, musicStart: 0,
  voice: "", voiceVolume: 1, voiceOffset: 0, duckMusic: true, templateAudio: true, templateAudioVolume: 1,
  aspect: "9:16", fitMode: "blur", padColor: "#000000", cropY: 50,
  fps: 30, resolution: "1080", quality: "high",
  ...(project.video || {}),
};
const FPS = [24, 30, 60].includes(Number(V.fps)) ? Number(V.fps) : 30;
const CRF = { high: 17, balanced: 21, small: 26 }[V.quality] ?? 17;

// Output frame for the chosen aspect ratio (frames are always captured at 1080×1920)
const ASPECTS = { "9:16": [9, 16], "4:5": [4, 5], "1:1": [1, 1], "16:9": [16, 9] };
const [AW, AH] = ASPECTS[V.aspect] || ASPECTS["9:16"];
const LONG = V.resolution === "720" ? 1280 : 1920, SHORT = V.resolution === "720" ? 720 : 1080;
const even = (n) => Math.round(n / 2) * 2;
const [OUT_W, OUT_H] = AW === AH ? [SHORT, SHORT] : AW > AH ? [LONG, even((LONG * AH) / AW)] : [SHORT, even((SHORT * AH) / AW)];

/**
 * Local file for an "/uploads/…" URL the project owner may use: their own
 * uploads/users/<id>/ files, or the shared pre-accounts files in uploads/.
 */
function ownedUploadFile(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  const file = join(ROOT, url);
  const own = join(ROOT, "uploads", "users", String(project.userId || "")) + sep;
  const legacy = dirname(file) === join(ROOT, "uploads");
  return (project.userId && file.startsWith(own)) || legacy ? file : null;
}

/** "/uploads/x.png" only resolves over http; the export loads file:// pages. */
function uploadsToFileUrls(value) {
  if (typeof value === "string" && value.startsWith("/uploads/")) {
    const file = ownedUploadFile(value);
    return file ? pathToFileURL(file).href : "";
  }
  if (Array.isArray(value)) return value.map(uploadsToFileUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, uploadsToFileUrls(v)]));
  }
  return value;
}

function audioFile(url, label) {
  if (!url || !String(url).startsWith("/uploads/")) return null;
  const f = ownedUploadFile(String(url));
  if (f && existsSync(f)) return f;
  log(`${label} file missing, exporting without it:`, url);
  return null;
}
const musicFile = audioFile(V.music, "Music");
const voiceFile = audioFile(V.voice, "Voiceover");
let templateWav = null;

function log(...args) {
  console.log("LOG", ...args);
}
function progress(p) {
  console.log(`PROGRESS ${p.toFixed(1)}`);
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const chrome = chromeCandidates.find((p) => existsSync(p));
if (!chrome) {
  console.error("Chrome not found. Set CHROME_PATH.");
  process.exit(1);
}

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

let pageUrl;
let tempHtml = null;

if (project.sourceType === "html" && project.htmlUploadId) {
  const htmlDir = join(ROOT, "uploads", "html", project.htmlUploadId);
  const htmlFile = join(htmlDir, "index.html");
  if (!existsSync(htmlFile)) {
    console.error("Uploaded HTML missing:", htmlFile);
    process.exit(1);
  }
  // Same bridge the preview server applies — older uploads have a stub that lets the
  // reel's own clock keep running between seeks. Written beside index.html so assets/ resolve.
  tempHtml = join(htmlDir, `.render-${randomUUID()}.html`);
  writeFileSync(tempHtml, ensureReelBridge(readFileSync(htmlFile, "utf8")));
  pageUrl = pathToFileURL(tempHtml).href + "?t=0";
  log(`Custom HTML ${project.htmlUploadId} → ${outPath}`);
} else {
  const templateDir = join(ROOT, "templates", project.templateId);
  const templateHtml = join(templateDir, "index.html");
  if (!existsSync(templateHtml)) {
    console.error("Template HTML missing:", templateHtml);
    process.exit(1);
  }
  const raw = readFileSync(templateHtml, "utf8");
  // Base points at the template folder so its relative assets resolve from the temp copy
  const inject =
    `<base href="${pathToFileURL(templateDir).href}/">` +
    `<script>window.__PROJECT__=${JSON.stringify(uploadsToFileUrls(project.data || {})).replace(/</g, "\\u003c")};</script>`;
  const html = raw.includes("<head>")
    ? raw.replace("<head>", `<head>${inject}`)
    : `${inject}${raw}`;
  const renderHtmlPath = join(framesDir, "render.html");
  writeFileSync(renderHtmlPath, html);
  pageUrl = pathToFileURL(renderHtmlPath).href + "?t=0";
  log(`Template ${project.templateId} → ${outPath}`);
}

progress(1);
let outDur = 0;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: chrome,
  args: [`--window-size=${W},${H}`, "--hide-scrollbars", "--force-device-scale-factor=1", "--no-sandbox"],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: "load", timeout: 120000 });

  // Ensure __reel exists (bridge may have been injected server-side)
  await page.waitForFunction(
    () => window.__reel && typeof window.__reel.setTime === "function",
    { timeout: 60000 }
  );

  // Elements, look, captions and progress bar (same runtime as the editor preview)
  const overlays = uploadsToFileUrls(project.overlays || []);
  await page.addScriptTag({ content: readFileSync(join(ROOT, "public", "overlays.js"), "utf8") });
  await page.evaluate((list, video) => {
    window.__overlays.set(list);
    window.__overlays.setGlobal(video);
  }, overlays, V);
  if (overlays.length) log(`${overlays.length} overlay element(s)`);

  // Templates that synthesize their own soundtrack hand it over as a WAV
  if (V.templateAudio !== false) {
    const b64 = await page.evaluate(async () =>
      typeof window.__reel.audioWav === "function" ? await window.__reel.audioWav() : null).catch(() => null);
    if (b64) {
      templateWav = join(framesDir, "template-audio.wav");
      writeFileSync(templateWav, Buffer.from(b64, "base64"));
      log("Template soundtrack included");
    }
  }

  // Web fonts and images (often added by script) must be in before frame 0
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((img) => !img.complete).map((img) =>
      new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 10000); })));
  });

  const DUR =
    Number(await page.evaluate(() => window.__reel.DUR || (window.CONFIG && CONFIG.duration) || 18)) ||
    project.duration ||
    18;
  const start = Math.min(Math.max(0, Number(V.trimStart) || 0), Math.max(0, DUR - 0.1));
  const end = Number(V.trimEnd) > start ? Math.min(Number(V.trimEnd), DUR) : DUR;
  const speed = Math.min(4, Math.max(0.25, Number(V.speed) || 1));
  outDur = (end - start) / speed;
  const total = Math.max(1, Math.round(outDur * FPS));
  log(`Recording ${total} frames @ ${FPS}fps (${start}s–${end}s of ${DUR}s at ${speed}×)`);

  for (let i = 0; i < total; i++) {
    const t = Math.min(end - 0.001, start + (i / FPS) * speed);
    // setTime may return a promise (e.g. a <video> seeking); the frame is captured once it settles
    await page.evaluate(async (tt) => {
      window.__reelExport = true;
      await window.__reel.setTime(tt);
      const r = document.getElementById("replay");
      if (r) r.style.display = "none";
      document.body.style.cursor = "none";
    }, t);
    const file = join(framesDir, `f${String(i).padStart(5, "0")}.png`);
    await page.screenshot({ path: file, type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    if (i % 15 === 0 || i === total - 1) progress(5 + (90 * i) / Math.max(1, total - 1));
  }
} finally {
  await browser.close();
  if (tempHtml) rmSync(tempHtml, { force: true });
}

log("Encoding mp4…");
progress(96);

const fadeIn = Math.min(Number(V.fadeIn) || 0, outDur / 2);
const fadeOut = Math.min(Number(V.fadeOut) || 0, outDur / 2);
const winStart = Math.min(Math.max(0, Number(V.trimStart) || 0), 1e6);
const winSpeed = Math.min(4, Math.max(0.25, Number(V.speed) || 1));
const winEnd = winStart + outDur * winSpeed;

// ---- Video: aspect ratio (fit with blurred / solid background, or crop), fades ----
const graph = [];
const tail = [];
if (fadeIn > 0) tail.push(`fade=t=in:st=0:d=${fadeIn.toFixed(3)}`);
if (fadeOut > 0) tail.push(`fade=t=out:st=${(outDur - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`);
tail.push("format=yuv420p");
const tailStr = tail.join(",");
if (AW === 9 && AH === 16) {
  graph.push(`[0:v]${OUT_W !== W ? `scale=${OUT_W}:${OUT_H}:flags=lanczos,` : ""}${tailStr}[vout]`);
} else if (V.fitMode === "crop") {
  // Keep the full width where possible; wide targets keep a horizontal band
  const ch = Math.min(H, even((W * AH) / AW));
  const y = Math.round((H - ch) * Math.min(1, Math.max(0, (Number(V.cropY) || 0) / 100)));
  graph.push(`[0:v]crop=${W}:${ch}:0:${y},scale=${OUT_W}:${OUT_H}:flags=lanczos,${tailStr}[vout]`);
} else if (V.fitMode === "color") {
  const col = /^#[0-9a-f]{6}$/i.test(V.padColor || "") ? "0x" + V.padColor.slice(1) : "black";
  graph.push(`[0:v]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,` +
    `pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2:color=${col},${tailStr}[vout]`);
} else {
  graph.push(`[0:v]split=2[bgsrc][fgsrc]`,
    `[bgsrc]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},boxblur=40:3,eq=brightness=-0.06[bg]`,
    `[fgsrc]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,${tailStr}[vout]`);
}

// ---- Audio: music (output time) + template soundtrack & voiceover (reel time), ducking ----
const ffArgs = ["-y", "-framerate", String(FPS), "-i", join(framesDir, "f%05d.png")];
let nextInput = 1;
const fmt = "aformat=sample_rates=44100:channel_layouts=stereo";
const num = (x, d) => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : d).toFixed(3);
function tempo(sp) {
  if (Math.abs(sp - 1) < 1e-3) return "";
  const parts = [];
  let x = sp;
  while (x > 2) { parts.push("atempo=2"); x /= 2; }
  while (x < 0.5) { parts.push("atempo=0.5"); x /= 0.5; }
  parts.push(`atempo=${x.toFixed(4)}`);
  return "," + parts.join(",");
}
// Reel-time audio follows the same trim + speed as the picture
const reelTime = (delay = 0) => `${fmt}${delay > 0 ? `,adelay=${Math.round(delay * 1000)}:all=1` : ""},apad,` +
  `atrim=start=${winStart.toFixed(3)}:end=${winEnd.toFixed(3)},asetpts=PTS-STARTPTS${tempo(winSpeed)}`;

const bed = [];
let voiceLabel = null;
if (musicFile) {
  ffArgs.push("-ss", num(V.musicStart, 0), "-stream_loop", "-1", "-i", musicFile);
  graph.push(`[${nextInput++}:a]${fmt},volume=${num(V.musicVolume, 0.8)}[mus]`);
  bed.push("[mus]");
}
if (templateWav) {
  ffArgs.push("-i", templateWav);
  graph.push(`[${nextInput++}:a]${reelTime()},volume=${num(V.templateAudioVolume, 1)}[tpl]`);
  bed.push("[tpl]");
}
if (voiceFile) {
  ffArgs.push("-i", voiceFile);
  graph.push(`[${nextInput++}:a]${reelTime(Number(V.voiceOffset) || 0)},volume=${num(V.voiceVolume, 1)}[vo]`);
  voiceLabel = "[vo]";
}
let mixLabel = null;
if (bed.length || voiceLabel) {
  let bedLabel = bed[0] || null;
  if (bed.length > 1) { graph.push(`${bed.join("")}amix=inputs=${bed.length}:normalize=0[bed]`); bedLabel = "[bed]"; }
  if (voiceLabel && bedLabel && V.duckMusic !== false) {
    graph.push(`${voiceLabel}asplit=2[vokey][vomix]`,
      `${bedLabel}[vokey]sidechaincompress=threshold=0.035:ratio=6:attack=20:release=420[ducked]`,
      `[ducked][vomix]amix=inputs=2:normalize=0[mixed]`);
  } else if (voiceLabel && bedLabel) {
    graph.push(`${bedLabel}${voiceLabel}amix=inputs=2:normalize=0[mixed]`);
  } else {
    graph.push(`${bedLabel || voiceLabel}anull[mixed]`);
  }
  // The mix fades with the picture
  const aFade = Math.max(fadeOut, Math.min(1, outDur / 4));
  graph.push(`[mixed]afade=t=in:st=0:d=${Math.max(0.05, fadeIn).toFixed(3)},` +
    `afade=t=out:st=${(outDur - aFade).toFixed(3)}:d=${aFade.toFixed(3)},alimiter=limit=0.95:level=false[aout]`);
  mixLabel = "[aout]";
}

ffArgs.push("-filter_complex", graph.join(";"), "-map", "[vout]");
if (mixLabel) ffArgs.push("-map", mixLabel, "-c:a", "aac", "-b:a", "192k");
ffArgs.push("-t", outDur.toFixed(3), "-c:v", "libx264", "-crf", String(CRF), "-preset", "medium",
  "-r", String(FPS), "-movflags", "+faststart", outPath);
log(`Output ${OUT_W}×${OUT_H} (${V.aspect || "9:16"}${AW === 9 && AH === 16 ? "" : `, ${V.fitMode}`})` +
  `${mixLabel ? " with audio" : ""}`);

await new Promise((resolve, reject) => {
  const ff = spawn(ffmpeg, ffArgs, { stdio: ["ignore", "pipe", "pipe"] });
  let errTail = "";
  ff.stderr.on("data", (d) => (errTail = (errTail + d).slice(-1500)));
  ff.on("exit", (code) => {
    if (code === 0) return resolve();
    console.error(errTail.trim());
    reject(new Error("ffmpeg exit " + code));
  });
});

rmSync(framesDir, { recursive: true, force: true });
progress(100);
log("Wrote", outPath);
