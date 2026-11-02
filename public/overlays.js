/**
 * Overlay elements (text, buttons, images, shapes, emoji) drawn on top of any reel.
 * Injected into the editor preview iframe and into the export page by worker/render.mjs,
 * so both draw the same frame for a given t. Wraps window.__reel.setTime to stay in sync.
 *
 * Element: { id, type, x, y, w, h (percent of the 9:16 frame), fontSize (px at 1080 wide), …style,
 *            start, end (0 = until the end), animIn, inDur, animOut, outDur, loop }
 *
 * setGlobal(video) also draws the project-wide layers from the Video panel: colour look
 * (brightness, contrast, saturation, warmth, vignette, grain), timed captions and a progress bar.
 */
(function () {
  if (window.__overlays) return;

  const BASE_W = 1080;
  const TEXT_TYPES = ["heading", "text", "button", "emoji"];
  // Google Fonts with a single weight can't be asked for others
  const SINGLE_WEIGHT = ["Bebas Neue", "Anton", "DM Serif Display"];

  const layer = document.createElement("div");
  layer.id = "__overlay-layer";
  layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;";
  (document.body || document.documentElement).appendChild(layer);

  let items = [];
  let lastT = 0;
  const nodes = new Map();
  const fonts = new Set();

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeBack = (p) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);
  const u = (n) => `calc(${Number(n) || 0} * 100vw / ${BASE_W})`; // design px → viewport

  function loadFont(name) {
    if (!name || fonts.has(name)) return;
    fonts.add(name);
    const fam = name.replace(/ /g, "+") + (SINGLE_WEIGHT.includes(name) ? "" : ":wght@400;500;600;700;800;900");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fam}&display=block`;
    document.head.appendChild(link);
  }

  function hook() {
    const r = window.__reel;
    if (!r || r.__overlaysHooked || typeof r.setTime !== "function") return;
    const orig = r.setTime;
    r.setTime = function (t) {
      const out = orig.apply(this, arguments);
      render(t);
      return out;
    };
    r.__overlaysHooked = true;
  }

  /** Static look of one element; animation is applied per frame in render(). */
  function apply(node, it) {
    const isText = TEXT_TYPES.includes(it.type);
    const s = node.style;
    s.cssText = "position:absolute;box-sizing:border-box;transform-origin:50% 50%;will-change:transform,opacity;";
    s.left = `${it.x}%`;
    s.top = `${it.y}%`;
    s.width = `${it.w}%`;
    if (!isText) s.height = `${it.h}%`;
    node.innerHTML = "";

    if (isText) {
      loadFont(it.font);
      const inner = document.createElement("div");
      inner.style.cssText = "white-space:pre-wrap;overflow-wrap:break-word;line-height:1.15;";
      inner.style.fontFamily = it.font ? `"${it.font}", system-ui, sans-serif` : "system-ui, sans-serif";
      inner.style.fontSize = u(it.fontSize || 48);
      inner.style.fontWeight = it.weight || 700;
      inner.style.color = it.color || "#fff";
      inner.style.textAlign = it.align || "center";
      if (it.shadow) inner.style.textShadow = `0 ${u(4)} ${u(18)} rgba(0,0,0,.45)`;
      if (it.type === "button") {
        Object.assign(inner.style, { display: "inline-block", padding: `${u(26)} ${u(52)}`, background: it.bg || "#0d99ff",
          borderRadius: u(it.radius ?? 999), boxShadow: `0 ${u(14)} ${u(36)} rgba(0,0,0,.25)` });
        s.textAlign = it.align || "center";
      } else if (it.boxed) {
        Object.assign(inner.style, { background: it.bg || "#000", padding: `${u(14)} ${u(28)}`, borderRadius: u(it.radius ?? 18) });
      }
      if (it.type === "emoji") inner.style.lineHeight = "1";
      inner.textContent = it.text || "";
      node.appendChild(inner);
      node.__text = inner;
      node.__typed = -1;
    } else if (it.type === "image") {
      s.borderRadius = u(it.radius ?? 0);
      s.overflow = "hidden";
      if (it.src) {
        const img = document.createElement("img");
        img.src = it.src;
        img.alt = "";
        img.style.cssText = `width:100%;height:100%;display:block;object-fit:${it.fit === "cover" ? "cover" : "contain"};`;
        node.appendChild(img);
      } else {
        node.dataset.placeholder = "1";
        Object.assign(s, { border: `${u(4)} dashed rgba(255,255,255,.6)`, background: "rgba(255,255,255,.08)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.75)",
          font: `600 ${u(34)} system-ui, sans-serif` });
        node.textContent = "Image";
      }
    } else {
      s.background = it.bg || "#fff";
      s.borderRadius = it.type === "circle" ? "50%" : u(it.radius ?? 0);
    }
  }

  function set(list) {
    hook();
    items = Array.isArray(list) ? list.map((it) => ({ ...it })) : [];
    const keep = new Set(items.map((it) => it.id));
    for (const [id, node] of nodes) {
      if (!keep.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    }
    items.forEach((it, i) => {
      let node = nodes.get(it.id);
      if (!node) {
        node = document.createElement("div");
        nodes.set(it.id, node);
      }
      const sig = JSON.stringify(it);
      if (node.__sig !== sig) {
        apply(node, it);
        node.__sig = sig;
      }
      node.style.zIndex = String(i + 1);
      layer.appendChild(node); // keeps DOM order = list order
    });
    render(lastT);
  }

  /** Offsets an element by how far it is from fully "in" (q = 0 in, 1 out). */
  function animate(kind, q, entering, f, D) {
    if (!kind || kind === "none" || q <= 0) return;
    const dir = entering ? 1 : -1;
    switch (kind) {
      case "fade": f.o *= 1 - q; break;
      case "slide-up": f.ty += dir * q * D; f.o *= 1 - q * 0.6; break;
      case "slide-down": f.ty -= dir * q * D; f.o *= 1 - q * 0.6; break;
      case "slide-left": f.tx += dir * q * D; f.o *= 1 - q * 0.6; break;
      case "slide-right": f.tx -= dir * q * D; f.o *= 1 - q * 0.6; break;
      case "pop": f.sc *= Math.max(0, 1 - 0.7 * q); f.o *= clamp((1 - q) * 2.5); break;
      case "zoom": f.sc *= 1 + 0.6 * q; f.o *= 1 - q; break;
      case "blur": f.blur += 28 * q; f.o *= 1 - q; break;
      case "spin": f.rot -= dir * 200 * q; f.sc *= 1 - 0.5 * q; f.o *= 1 - q; break;
      case "typewriter": if (!entering) f.o *= 1 - q; break;
    }
  }

  function render(t) {
    lastT = Number(t) || 0;
    renderGlobal(lastT);
    const px = layer.clientWidth / BASE_W || 1;
    for (const it of items) {
      const node = nodes.get(it.id);
      if (!node) continue;
      const start = Number(it.start) || 0;
      const end = Number(it.end) > start ? Number(it.end) : Infinity;
      const hidden = lastT < start || lastT >= end || (node.dataset.placeholder && window.__reelExport);
      if (hidden) {
        node.style.visibility = "hidden";
        continue;
      }
      const inDur = it.animIn && it.animIn !== "none" ? Math.max(0.05, Number(it.inDur) || 0.5) : 0;
      const outDur = it.animOut && it.animOut !== "none" && end < Infinity ? Math.max(0.05, Number(it.outDur) || 0.4) : 0;
      const pi = inDur ? clamp((lastT - start) / inDur) : 1;
      const po = outDur ? clamp((lastT - (end - outDur)) / outDur) : 0;

      const f = { o: clamp((it.opacity ?? 100) / 100), tx: 0, ty: 0, sc: 1, rot: Number(it.rotation) || 0, blur: 0 };
      const D = 140 * px;
      animate(it.animIn, 1 - (it.animIn === "pop" ? easeBack(pi) : easeOut(pi)), true, f, D);
      animate(it.animOut, easeOut(po), false, f, D);

      const lt = lastT - start;
      switch (it.loop) {
        case "pulse": f.sc *= 1 + 0.06 * Math.sin((lt / 1.2) * 2 * Math.PI); break;
        case "float": f.ty += 14 * px * Math.sin((lt / 2.4) * 2 * Math.PI); break;
        case "wiggle": f.rot += 4 * Math.sin((lt / 0.8) * 2 * Math.PI); break;
        case "spin": f.rot += (360 * lt) / 3; break;
      }

      if (node.__text && it.animIn === "typewriter") {
        // Untyped characters stay in the layout (hidden) so lines don't reflow or shift while typing
        const chars = [...(it.text || "")];
        const n = Math.round(chars.length * pi);
        if (node.__typed !== n) {
          node.__typed = n;
          const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
          node.__text.innerHTML = esc(chars.slice(0, n).join("")) + `<span style="visibility:hidden">${esc(chars.slice(n).join(""))}</span>`;
        }
      }
      const s = node.style;
      s.visibility = f.o > 0.001 ? "visible" : "hidden";
      s.opacity = String(f.o);
      s.transform = `translate(${f.tx}px, ${f.ty}px) rotate(${f.rot}deg) scale(${f.sc})`;
      s.filter = f.blur > 0.05 ? `blur(${f.blur * px}px)` : "";
    }
  }

  /** Layout boxes (no animation) in percent of the frame, for the editor's handles. */
  function boxes() {
    const W = layer.clientWidth || 1, H = layer.clientHeight || 1;
    const out = {};
    for (const [id, node] of nodes) {
      out[id] = { x: (node.offsetLeft / W) * 100, y: (node.offsetTop / H) * 100, w: (node.offsetWidth / W) * 100, h: (node.offsetHeight / H) * 100 };
    }
    return out;
  }

  /* ---------- Project-wide layers: look, captions, progress bar ---------- */
  const lookLayer = document.createElement("div");
  lookLayer.id = "__look-layer";
  lookLayer.style.cssText = "position:fixed;inset:0;z-index:2147482900;pointer-events:none;overflow:hidden;";
  lookLayer.innerHTML =
    `<svg width="0" height="0" style="position:absolute"><filter id="__lookWarm" color-interpolation-filters="sRGB">` +
    `<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter></svg>` +
    `<div data-v style="position:absolute;inset:0"></div><div data-g style="position:absolute;inset:-20%;mix-blend-mode:overlay"></div>`;
  layer.parentNode.insertBefore(lookLayer, layer);
  const warmMatrix = lookLayer.querySelector("feColorMatrix");
  const vignette = lookLayer.querySelector("[data-v]");
  const grain = lookLayer.querySelector("[data-g]");
  grain.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
  const gradeStyle = document.createElement("style");
  document.head.appendChild(gradeStyle);

  const capLayer = document.createElement("div");
  capLayer.id = "__caption-layer";
  capLayer.style.cssText = "position:fixed;inset:0;z-index:2147483100;pointer-events:none;overflow:hidden;";
  layer.parentNode.appendChild(capLayer);
  const capBox = document.createElement("div");
  capLayer.appendChild(capBox);
  const bar = document.createElement("div");
  bar.style.cssText = "position:fixed;left:0;height:0;z-index:2147483150;pointer-events:none;";
  capLayer.appendChild(bar);

  let G = {};
  let cues = [];

  /** "0.0-1.4 Text" (or "0 1.4 Text") per line → [{ a, b, text }] */
  function parseCaptions(src) {
    return String(src || "").split("\n").map((line) => {
      const m = line.match(/^\s*(\d+(?:\.\d+)?)\s*(?:-|–|—|,|\s)\s*(\d+(?:\.\d+)?)\s+(.+?)\s*$/);
      return m && Number(m[2]) > Number(m[1]) ? { a: Number(m[1]), b: Number(m[2]), text: m[3] } : null;
    }).filter(Boolean).sort((x, y) => x.a - y.a);
  }

  function setGlobal(v) {
    hook();
    G = v || {};
    cues = parseCaptions(G.captions);

    // Colour grade on the reel itself (not on captions or elements)
    const b = 1 + (Number(G.lookBrightness) || 0) / 100;
    const c = 1 + (Number(G.lookContrast) || 0) / 100;
    const sat = 1 + (Number(G.lookSaturation) || 0) / 100;
    const w = (Number(G.lookWarmth) || 0) / 100;
    warmMatrix.setAttribute("values", `${1 + 0.18 * w} 0 0 0 ${0.02 * w}  0 ${1 + 0.04 * w} 0 0 0  0 0 ${1 - 0.18 * w} 0 ${-0.02 * w}  0 0 0 1 0`);
    const graded = b !== 1 || c !== 1 || sat !== 1 || w !== 0;
    gradeStyle.textContent = graded
      ? `body > *:not(#__overlay-layer):not(#__look-layer):not(#__caption-layer){filter:brightness(${b}) contrast(${c}) saturate(${sat})${w ? " url(#__lookWarm)" : ""}}`
      : "";
    const vg = (Number(G.lookVignette) || 0) / 100;
    vignette.style.background = vg ? `radial-gradient(ellipse 80% 70% at 50% 46%, rgba(0,0,0,0) ${62 - vg * 22}%, rgba(0,0,0,${(0.75 * vg).toFixed(3)}) 100%)` : "none";
    grain.style.opacity = String(((Number(G.lookGrain) || 0) / 100) * 0.55);

    // Caption style
    const font = G.capFont || "Manrope";
    loadFont(font);
    const pos = { top: "16%", middle: "46%", bottom: "68%" }[G.capPos] || "68%";
    Object.assign(capBox.style, {
      position: "absolute", left: "6.5%", right: "13.5%", top: pos, transform: "translateY(-50%)",
      textAlign: "center", fontFamily: `"${font}", system-ui, sans-serif`, fontWeight: "800",
      fontSize: u(G.capSize || 64), lineHeight: (G.capStyle || "box") === "box" ? "1.55" : "1.18", color: G.capColor || "#fff",
      textTransform: G.capUpper ? "uppercase" : "none", letterSpacing: "-0.01em",
    });
    const pc = G.progressColor || "#ffffff";
    Object.assign(bar.style, {
      display: G.progressBar && G.progressBar !== "none" ? "block" : "none",
      top: G.progressBar === "bottom" ? "auto" : "0", bottom: G.progressBar === "bottom" ? "0" : "auto",
      height: u(G.progressHeight || 10), background: pc, boxShadow: `0 0 ${u(12)} ${pc}`,
    });
    render(lastT);
  }

  function renderGlobal(t) {
    // Grain moves every frame so it reads as film, deterministically from t
    if (Number(G.lookGrain) > 0) {
      const f = Math.floor(t * 24);
      grain.style.transform = `translate(${((f * 37) % 100) - 50}px, ${((f * 53) % 100) - 50}px)`;
    }
    const dur = Number(window.__reel?.DUR) || 0;
    if (G.progressBar && G.progressBar !== "none" && dur) bar.style.width = `${clamp(t / dur) * 100}%`;

    const cue = cues.find((q) => t >= q.a && t < q.b);
    if (!cue) {
      capBox.style.visibility = "hidden";
      capBox.__cue = null;
      return;
    }
    const style = G.capStyle || "box";
    const anim = G.capAnim || "pop";
    const words = cue.text.split(/\s+/);
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const fx = style === "outline"
      ? `-webkit-text-stroke:${u(10)} ${G.capBgColor || "#000"};paint-order:stroke fill;`
      : style === "shadow" ? `text-shadow:0 ${u(4)} ${u(20)} rgba(0,0,0,.65);` : "";
    const boxCss = style === "box"
      ? `background:${G.capBgColor || "#000"};padding:${u(6)} ${u(24)};border-radius:${u(20)};box-decoration-break:clone;-webkit-box-decoration-break:clone;`
      : "";
    // Word-by-word: words light up as they are "spoken" across the cue
    let html;
    if (anim === "words") {
      const k = (t - cue.a) / Math.max(0.2, (cue.b - cue.a) * 0.85);
      const shown = Math.min(words.length, Math.floor(k * words.length) + 1);
      html = words.map((wd, i) => {
        const col = i === shown - 1 ? G.capHighlight || "#FFD60A" : "inherit";
        return `<span style="opacity:${i < shown ? 1 : 0.35};color:${col}">${esc(wd)}</span>`;
      }).join(" ");
    } else {
      html = esc(cue.text);
    }
    const key = cue.a + "|" + html + style;
    if (capBox.__cue !== key) {
      capBox.__cue = key;
      capBox.innerHTML = `<span style="${boxCss}${fx}">${html}</span>`;
    }
    const p = clamp((t - cue.a) / 0.22), q = clamp((cue.b - t) / 0.15);
    let o = Math.min(1, q * 1.5), sc = 1, ty = 0;
    if (anim === "pop") { sc = 0.7 + 0.3 * easeBack(p); o *= clamp(p * 3); }
    else if (anim === "fade") { o *= easeOut(p); ty = (1 - easeOut(p)) * 18; }
    else if (anim === "words") { o *= clamp(p * 3); }
    capBox.style.visibility = o > 0.001 ? "visible" : "hidden";
    capBox.style.opacity = String(o);
    capBox.style.transform = `translateY(-50%) translateY(${ty}px) scale(${sc})`;
  }

  window.__overlays = { set, render, boxes, setGlobal };
  hook();
})();
