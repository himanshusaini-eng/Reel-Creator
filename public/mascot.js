/**
 * Premium interactive landing mascot.
 * Vanilla JS + rAF + CSS transforms (no React/GSAP required).
 * Asset: /assets/character.png
 */

const HOVER_SEL = [
  "a",
  "button",
  ".btn",
  ".feature-row",
  ".workflow-card",
  ".price-card",
  ".tpl-card",
  ".hero-phone",
  ".hero-art",
  ".workspace-editor",
  ".workspace-stage",
  ".landing-tpls img",
  ".head-nav a",
  ".brand",
  ".platform-list li",
].join(",");

const SECTIONS = [
  { id: "hero", el: ".hero", mood: "wave" },
  { id: "features", el: "#features", mood: "point" },
  { id: "templates", el: "#templates", mood: "excited" },
  { id: "pricing", el: "#pricing", mood: "thumbs" },
  { id: "footer", el: ".site-foot", mood: "goodbye" },
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function createMascot() {
  const root = document.createElement("div");
  root.className = "mascot-root";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="mascot-stage">
      <div class="mascot-glow" aria-hidden="true"></div>
      <div class="mascot-particles" aria-hidden="true"></div>
      <img class="mascot-img" src="/assets/character.png" alt="" draggable="false" width="112" height="112">
    </div>
  `;
  document.body.appendChild(root);
  return {
    root,
    stage: root.querySelector(".mascot-stage"),
    img: root.querySelector(".mascot-img"),
    glow: root.querySelector(".mascot-glow"),
    particles: root.querySelector(".mascot-particles"),
  };
}

function initMascot() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { root, stage, img, glow, particles } = createMascot();

  const state = {
    // base home corner (viewport coords of mascot center)
    homeX: 0,
    homeY: 0,
    // current drawn position
    x: 0,
    y: 0,
    // soft follow target (offset from cursor, stays near home)
    tx: 0,
    ty: 0,
    // cursor
    cx: window.innerWidth * 0.7,
    cy: window.innerHeight * 0.5,
    // transforms
    scale: 0,
    rot: 0,
    bob: 0,
    breath: 1,
    lookRot: 0,
    // interaction bursts
    jump: 0,
    wave: 0,
    celebrate: 0,
    pose: 0,
    // scroll
    scrolling: false,
    scrollBoost: 0,
    scrollTimer: 0,
    // mood
    mood: "idle",
    moodT: 0,
    // intro
    intro: 0,
    born: performance.now(),
    // particles
    sparkTimer: 0,
    // visibility
    visible: !document.hidden,
    raf: 0,
  };

  const updateHome = () => {
    const rect = root.getBoundingClientRect();
    state.homeX = rect.left + rect.width / 2;
    state.homeY = rect.top + rect.height / 2;
    if (state.intro < 1) {
      state.x = state.homeX;
      state.y = state.homeY + 40;
      state.tx = state.homeX;
      state.ty = state.homeY;
    }
  };

  updateHome();
  window.addEventListener("resize", updateHome, { passive: true });

  // ---- cursor ----
  window.addEventListener(
    "pointermove",
    (e) => {
      state.cx = e.clientX;
      state.cy = e.clientY;
    },
    { passive: true },
  );

  // ---- hover targets ----
  let hoverClear = 0;
  const onHoverIn = () => {
    clearTimeout(hoverClear);
    state.wave = 1;
    state.jump = 1;
    burst(4);
  };
  const onHoverOut = () => {
    hoverClear = window.setTimeout(() => {
      if (state.mood === "idle") state.wave = Math.max(state.wave, 0);
    }, 120);
  };

  document.addEventListener(
    "pointerover",
    (e) => {
      const t = e.target?.closest?.(HOVER_SEL);
      if (!t || root.contains(t)) return;
      onHoverIn();
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerout",
    (e) => {
      const t = e.target?.closest?.(HOVER_SEL);
      if (!t || root.contains(t)) return;
      const related = e.relatedTarget?.closest?.(HOVER_SEL);
      if (related) return;
      onHoverOut();
    },
    { passive: true },
  );

  // ---- click celebrate ----
  const celebrate = () => {
    state.celebrate = 1;
    state.jump = 1.2;
    burst(10);
  };

  document.addEventListener(
    "click",
    (e) => {
      if (e.target?.closest?.("a,button,.btn,.mascot-img")) celebrate();
    },
    { passive: true },
  );

  img.addEventListener("click", (e) => {
    e.preventDefault();
    celebrate();
  });

  // ---- scroll ----
  let lastScrollY = window.scrollY || 0;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY || 0;
      if (Math.abs(y - lastScrollY) > 0.5) {
        state.scrolling = true;
        state.scrollBoost = clamp(state.scrollBoost + 0.08, 0, 1);
        clearTimeout(state.scrollTimer);
        state.scrollTimer = window.setTimeout(() => {
          state.scrolling = false;
        }, 140);
      }
      lastScrollY = y;
      updateMoodFromScroll();
    },
    { passive: true },
  );

  // ---- section moods ----
  const sectionEls = SECTIONS.map((s) => ({
    ...s,
    node: document.querySelector(s.el),
  })).filter((s) => s.node);

  function updateMoodFromScroll() {
    const mid = window.innerHeight * 0.42;
    let best = null;
    let bestDist = Infinity;
    for (const s of sectionEls) {
      const r = s.node.getBoundingClientRect();
      const c = (r.top + r.bottom) / 2;
      const dist = Math.abs(c - mid);
      if (r.bottom > 80 && r.top < window.innerHeight - 40 && dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    if (best && best.mood !== state.mood) {
      state.mood = best.mood;
      state.moodT = 1;
      if (best.mood === "wave" || best.mood === "goodbye") state.wave = 1;
      if (best.mood === "excited" || best.mood === "thumbs") state.jump = 0.8;
    }
  }

  // ---- particles ----
  function burst(count = 6) {
    const kinds = ["spark", "purple", "orange", "star"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = `mascot-particle ${kinds[i % kinds.length]}`;
      particles.appendChild(p);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 28 + Math.random() * 36;
      const life = 520 + Math.random() * 280;
      const start = performance.now();
      const spin = (Math.random() - 0.5) * 180;

      const tick = (now) => {
        const t = clamp((now - start) / life, 0, 1);
        const ease = 1 - Math.pow(1 - t, 2);
        const x = Math.cos(angle) * dist * ease;
        const y = Math.sin(angle) * dist * ease - 18 * ease;
        const op = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        p.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${spin * ease}deg) scale(${1 - t * 0.4})`;
        p.style.opacity = String(Math.max(0, op));
        if (t < 1) requestAnimationFrame(tick);
        else p.remove();
      };
      requestAnimationFrame(tick);
    }
  }

  // occasional ambient sparkles
  function maybeAmbientSpark(dt) {
    state.sparkTimer += dt;
    if (state.sparkTimer > 2800 + Math.random() * 2200) {
      state.sparkTimer = 0;
      if (!state.scrolling && state.intro >= 1) burst(2);
    }
  }

  // ---- render loop ----
  let last = performance.now();

  const frame = (now) => {
    state.raf = requestAnimationFrame(frame);
    if (!state.visible) {
      last = now;
      return;
    }

    const dt = clamp((now - last) / 16.67, 0.5, 2.2);
    last = now;
    const t = now / 1000;

    // intro 0→1
    const introRaw = clamp((now - state.born) / 900, 0, 1);
    const introEase = 1 - Math.pow(1 - introRaw, 3);
    state.intro = introEase;
    const bounce = introRaw < 1 ? Math.sin(introRaw * Math.PI) * 0.12 : 0;

    // soft follow: stay near home, lean toward cursor but keep distance
    const dx = state.cx - state.homeX;
    const dy = state.cy - state.homeY;
    const dist = Math.hypot(dx, dy) || 1;
    const keepAway = 140;
    const pull = clamp((dist - keepAway) / 420, 0, 0.35);
    // target offset from home toward cursor (capped)
    const maxLean = 36;
    state.tx = state.homeX + clamp(dx * pull * 0.55, -maxLean, maxLean);
    state.ty = state.homeY + clamp(dy * pull * 0.45, -28, 22);

    // smooth chase
    const follow = 1 - Math.pow(0.86, dt);
    state.x = lerp(state.x, state.tx, follow);
    state.y = lerp(state.y, state.ty, follow);

    // look / rotate toward cursor
    const lookTarget = clamp((state.cx - state.homeX) / 28, -10, 10);
    state.lookRot = lerp(state.lookRot, lookTarget, 1 - Math.pow(0.9, dt));

    // idle float + breath
    state.bob = Math.sin(t * 1.55) * 5 + Math.sin(t * 0.7) * 2;
    state.breath = 1 + Math.sin(t * 2.1) * 0.018;
    const idleRot = Math.sin(t * 0.9) * 2.2;

    // decay bursts
    state.jump = Math.max(0, state.jump - 0.045 * dt);
    state.wave = Math.max(0, state.wave - 0.03 * dt);
    state.celebrate = Math.max(0, state.celebrate - 0.035 * dt);
    state.moodT = Math.max(0, state.moodT - 0.012 * dt);
    state.scrollBoost = state.scrolling
      ? clamp(state.scrollBoost + 0.04 * dt, 0, 1)
      : Math.max(0, state.scrollBoost - 0.05 * dt);

    // mood pose offsets
    let poseY = 0;
    let poseRot = 0;
    let poseScale = 1;
    switch (state.mood) {
      case "wave":
        poseRot = Math.sin(t * 10) * 6 * Math.min(1, state.moodT + 0.3);
        break;
      case "point":
        poseRot = -8 * Math.min(1, state.moodT + 0.25);
        poseY = -2;
        break;
      case "excited":
        poseScale = 1 + 0.04 * Math.min(1, state.moodT + 0.2);
        poseY = Math.sin(t * 8) * 3 * Math.min(1, state.moodT + 0.2);
        break;
      case "thumbs":
        poseRot = 6;
        poseScale = 1.03;
        break;
      case "goodbye":
        poseY = 8;
        poseRot = Math.sin(t * 6) * 5;
        poseScale = 0.96;
        break;
      default:
        break;
    }

    const jumpY = -Math.sin(clamp(state.jump, 0, 1) * Math.PI) * 18;
    const celebrateScale =
      state.celebrate > 0
        ? 1 + Math.sin(clamp(state.celebrate, 0, 1) * Math.PI) * 0.1
        : 1;
    const waveRot = Math.sin(t * 14) * 8 * state.wave;
    const scrollLift = -state.scrollBoost * 10;
    const scrollRot = state.scrollBoost * (Math.sin(t * 6) * 4);

    const ox = state.x - state.homeX;
    const oy = state.y - state.homeY + state.bob + jumpY + poseY + scrollLift;

    const scale =
      (0.001 + introEase * (1 + bounce)) *
      state.breath *
      celebrateScale *
      poseScale;

    const rot =
      idleRot + state.lookRot * 0.35 + waveRot + poseRot + scrollRot;

    stage.style.opacity = String(introEase);
    stage.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;

    const glowPulse = 0.55 + Math.sin(t * 2.1) * 0.12 + state.celebrate * 0.25;
    glow.style.opacity = String(glowPulse);
    glow.style.transform = `translate3d(-50%, 0, 0) scale(${(0.95 + state.breath * 0.08).toFixed(3)}, 1)`;

    img.style.transform = `rotate(${(waveRot * 0.4).toFixed(2)}deg)`;

    maybeAmbientSpark(16.67 * dt);
  };

  document.addEventListener("visibilitychange", () => {
    state.visible = !document.hidden;
    last = performance.now();
  });

  // start after layout
  requestAnimationFrame(() => {
    updateHome();
    state.x = state.homeX;
    state.y = state.homeY + 48;
    state.tx = state.homeX;
    state.ty = state.homeY;
    updateMoodFromScroll();
    state.raf = requestAnimationFrame(frame);
    // entrance sparkle
    setTimeout(() => burst(5), 420);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMascot);
} else {
  initMascot();
}
