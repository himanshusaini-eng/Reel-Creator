/**
 * Shared runtime for templates: project data, theme/fonts, 540×960 stage fit,
 * easing, placeholders and the window.__reel seek bridge.
 * Loaded as ../_shared/kit.js (preview uses <base href="/templates/<id>/">, export a file:// base).
 */
(function () {
  const K = (window.Kit = {});

  K.data = (defaults) => Object.assign({}, defaults, window.__PROJECT__ || {});
  K.$ = (id) => document.getElementById(id);
  K.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  K.lines = (s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean);
  // Wrap the last word in <span> so templates can color it with the accent
  K.accentLast = (s) => K.esc(s).replace(/(\S+)\s*$/, "<span>$1</span>");

  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.prog = (t, a, b) => K.clamp((t - a) / (b - a));
  K.ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    spring: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-7 * p) * Math.cos(9 * p)),
    back: (p) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2),
  };
  K.set = (el, o, tr) => {
    if (!el) return;
    el.style.opacity = o;
    el.style.visibility = o <= 0.001 ? "hidden" : "visible";
    if (tr !== undefined) el.style.transform = tr;
  };

  // Google Fonts offered in the editor. heavy = weight used for headlines.
  K.FONTS = {
    Manrope: { q: "Manrope:wght@500;600;700;800", heavy: 800 },
    Inter: { q: "Inter:wght@500;600;700;800;900", heavy: 800 },
    Poppins: { q: "Poppins:wght@500;600;700;800", heavy: 800 },
    Montserrat: { q: "Montserrat:wght@500;600;700;800;900", heavy: 900 },
    "Space Grotesk": { q: "Space+Grotesk:wght@500;600;700", heavy: 700 },
    Sora: { q: "Sora:wght@500;600;700;800", heavy: 800 },
    "Bebas Neue": { q: "Bebas+Neue", heavy: 400, body: "Inter" },
    Anton: { q: "Anton", heavy: 400, body: "Inter" },
    "DM Serif Display": { q: "DM+Serif+Display", heavy: 400, body: "Inter" },
    "Playfair Display": { q: "Playfair+Display:wght@600;700;800", heavy: 800, body: "Inter" },
  };

  function loadFont(name) {
    const f = K.FONTS[name] || K.FONTS.Manrope;
    const families = [f.q];
    if (f.body && K.FONTS[f.body]) families.push(K.FONTS[f.body].q);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families.map((q) => "family=" + q).join("&")}&display=block`;
    document.head.appendChild(link);
    return { head: name in K.FONTS ? name : "Manrope", body: f.body || (name in K.FONTS ? name : "Manrope"), heavy: f.heavy };
  }

  function hexToRgb(hex) {
    const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return [0, 0, 0];
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  K.rgba = (hex, a) => `rgba(${hexToRgb(hex).join(",")},${a})`;
  K.isDark = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b < 140;
  };

  /**
   * Apply shared style options to the stage.
   * D.font, D.theme ("light" | "dark"), D.primary, D.secondary, D.background, D.bgStyle
   */
  K.theme = (stage, D) => {
    const font = loadFont(D.font);
    const dark = D.theme === "dark";
    const bg = D.background || (dark ? "#0E0F13" : "#F6F7FB");
    const vars = {
      "--primary": D.primary || "#34C759",
      "--secondary": D.secondary || D.primary || "#0A84FF",
      "--bg": bg,
      "--fg": dark ? "#FFFFFF" : "#15161A",
      "--muted": dark ? "rgba(255,255,255,.62)" : "#7A7D87",
      "--card": dark ? "rgba(255,255,255,.07)" : "#FFFFFF",
      "--cardBorder": dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.06)",
      "--shadow": dark ? "0 18px 40px rgba(0,0,0,.45)" : "0 18px 40px rgba(20,24,40,.10)",
      "--fontHead": `"${font.head}", system-ui, sans-serif`,
      "--fontBody": `"${font.body}", system-ui, sans-serif`,
      "--heavy": font.heavy,
    };
    for (const [k, v] of Object.entries(vars)) stage.style.setProperty(k, v);
    stage.classList.toggle("dark", dark);

    const layer = document.createElement("div");
    layer.className = "kit-bg";
    layer.style.cssText = "position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden";
    const p = vars["--primary"], s = vars["--secondary"];
    const style = D.bgStyle || "gradient";
    if (style === "solid") layer.style.background = bg;
    else if (style === "gradient")
      layer.style.background = `linear-gradient(180deg, ${K.rgba(p, dark ? 0.22 : 0.14)} 0%, ${bg} 48%, ${K.rgba(s, dark ? 0.16 : 0.08)} 100%), ${bg}`;
    else if (style === "grid")
      layer.style.background = `linear-gradient(${K.rgba(dark ? "#ffffff" : "#000000", 0.05)} 1px, transparent 1px) 0 0/36px 36px,
        linear-gradient(90deg, ${K.rgba(dark ? "#ffffff" : "#000000", 0.05)} 1px, transparent 1px) 0 0/36px 36px, ${bg}`;
    else if (style === "dots")
      layer.style.background = `radial-gradient(${K.rgba(dark ? "#ffffff" : "#000000", 0.09)} 1.4px, transparent 1.6px) 0 0/22px 22px, ${bg}`;
    else layer.style.background = bg; // "glow": animated blobs added below
    if (style === "glow") {
      layer.innerHTML = [p, s, p]
        .map((c, i) => `<i style="position:absolute;width:${[460, 380, 300][i]}px;height:${[460, 380, 300][i]}px;border-radius:50%;
          background:${K.rgba(c, dark ? 0.45 : 0.3)};filter:blur(70px)"></i>`)
        .join("");
    }
    stage.prepend(layer);
    K._bg = style === "glow" ? [...layer.children] : [];
  };

  // Called from each template's render(t) so animated backgrounds stay deterministic
  K.renderBg = (t) => {
    K._bg.forEach((el, i) => {
      const a = t * (0.35 + i * 0.12) + i * 2.1;
      el.style.transform = `translate(${[40, 260, 120][i] + Math.cos(a) * 90}px, ${[60, 520, 300][i] + Math.sin(a * 1.3) * 120}px)`;
    });
  };

  K.fit = (stage) => {
    const fit = () => {
      const s = Math.min(innerWidth / 540, innerHeight / 960);
      stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    addEventListener("resize", fit);
    fit();
  };

  /** Logo element content: uploaded image, or the app's initial on a gradient. */
  K.logoHTML = (D) =>
    D.logoUrl
      ? `<img src="${K.esc(D.logoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;
          font-family:var(--fontHead);font-weight:var(--heavy);container-type:size;
          background:linear-gradient(135deg,var(--primary),var(--secondary))"><span style="font-size:58cqh;line-height:1">${K.esc(
            (D.appName || "A").trim().charAt(0).toUpperCase()
          )}</span></div>`;

  K.storesHTML = () => `
    <div class="kit-store"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v11m0 0-4.5-4.5M12 14l4.5-4.5M5 19h14" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><small>Download on the</small><b>App Store</b></div></div>
    <div class="kit-store"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5v17l14-8.5z"/></svg>
      <div><small>Get it on</small><b>Google Play</b></div></div>`;

  K.css = `
    .kit-store{height:56px;border-radius:15px;background:#111216;color:#fff;display:flex;align-items:center;gap:10px;padding:0 16px;
      border:1px solid rgba(255,255,255,.14);flex:1}
    .kit-store small{display:block;font-size:10px;opacity:.7;font-weight:600;font-family:var(--fontBody)}
    .kit-store b{display:block;font-size:17px;font-weight:700;font-family:var(--fontBody);line-height:1.1}`;
  const st = document.createElement("style");
  st.textContent = K.css;
  document.head.appendChild(st);

  /** Placeholder phone screen (SVG data URI) for screenshot slots left empty. */
  K.placeholderScreen = (i, primary, dark) => {
    const bg = dark ? "#121318" : "#F5F6FA", card = dark ? "#1E2028" : "#FFFFFF";
    const fg = dark ? "#FFFFFF" : "#15161A", mu = dark ? "#5C5F6B" : "#C9CCD6";
    const p = primary || "#34C759";
    const bar = (x, y, w, h = 14, c = mu, r = 7) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
    const cardR = (y, h) => `<rect x="24" y="${y}" width="342" height="${h}" rx="26" fill="${card}"/>`;
    let body = "";
    const kind = i % 4;
    if (kind === 0) {
      body = cardR(170, 300) +
        `<circle cx="195" cy="320" r="92" fill="none" stroke="${mu}" stroke-width="22" opacity=".5"/>
         <circle cx="195" cy="320" r="92" fill="none" stroke="${p}" stroke-width="22" stroke-linecap="round" stroke-dasharray="400 600" transform="rotate(-90 195 320)"/>
         <text x="195" y="334" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="44" fill="${fg}">72%</text>` +
        [0, 1, 2].map((k) => cardR(494 + k * 96, 80) + `<circle cx="66" cy="${534 + k * 96}" r="20" fill="${p}" opacity="${1 - k * 0.25}"/>` +
          bar(100, 520 + k * 96, 150, 14, fg) + bar(100, 544 + k * 96, 100)).join("");
    } else if (kind === 1) {
      body = [0, 1, 2, 3, 4].map((k) => cardR(170 + k * 108, 92) +
        `<rect x="44" y="${190 + k * 108}" width="52" height="52" rx="16" fill="${p}" opacity="${0.35 + (k % 3) * 0.3}"/>` +
        bar(112, 198 + k * 108, 140 + (k * 37) % 80, 14, fg) + bar(112, 224 + k * 108, 90) + bar(300, 206 + k * 108, 46, 16, p)).join("");
    } else if (kind === 2) {
      const hs = [120, 190, 150, 240, 200, 280, 230];
      body = cardR(170, 360) + hs.map((h, k) => `<rect x="${54 + k * 44}" y="${490 - h}" width="26" height="${h}" rx="10" fill="${p}" opacity="${k === 5 ? 1 : 0.4}"/>`).join("") +
        bar(48, 196, 120, 16, fg) + cardR(556, 120) + bar(48, 586, 180, 16, fg) + bar(48, 618, 240) + bar(48, 644, 200);
    } else {
      body = `<circle cx="195" cy="250" r="64" fill="${p}" opacity=".85"/>` + bar(125, 336, 140, 18, fg, 9) + bar(150, 366, 90) +
        [0, 1, 2, 3].map((k) => cardR(420 + k * 84, 68) + bar(52, 448 + k * 84, 160, 14, fg) +
          `<rect x="306" y="${440 + k * 84}" width="40" height="26" rx="13" fill="${k % 2 ? mu : p}"/>`).join("");
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844"><rect width="390" height="844" fill="${bg}"/>
      ${bar(24, 92, 120, 14, mu)}${bar(24, 116, 210, 26, fg, 10)}${body}
      <rect x="24" y="760" width="342" height="62" rx="24" fill="${card}"/>
      ${[0, 1, 2, 3].map((k) => `<circle cx="${80 + k * 77}" cy="791" r="10" fill="${k === kind ? p : mu}"/>`).join("")}</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };

  /** Animation clock + seek bridge used by the editor preview and the exporter. */
  K.start = (DUR, render) => {
    let start = performance.now(), paused = false, pausedT = 0;
    const freeze = new URLSearchParams(location.search).get("t");
    if (freeze !== null) { paused = true; pausedT = +freeze; }
    const frame = (now) => {
      render(paused ? pausedT : ((now - start) / 1000) % DUR);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.__reel = { DUR, setTime(t) { paused = true; pausedT = t; render(t); }, render };
  };
})();
