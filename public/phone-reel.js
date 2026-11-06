/**
 * Hero phone live promo — studio crew collaborating.
 * Same character.png. Each buddy has a different job; they sync + talk.
 */
const LOOP_MS = 16000;
const INTRO_MS = 1100;

const root = document.getElementById("phoneReel");
if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  if (root) root.classList.add("is-live");
} else {
  boot();
}

function boot() {
  const camera = document.getElementById("prCamera");
  const cast = document.getElementById("prCast");
  const intro = document.getElementById("prIntro");
  const handoff = document.getElementById("prHandoff");
  const handoffCard = handoff?.querySelector(".pr-handoff-card");
  const exportFill = document.getElementById("prExportFill");
  const captionKicker = document.getElementById("prCaptionKicker");
  const captionTitle = document.getElementById("prCaptionTitle");
  const badges = [...root.querySelectorAll("[data-badge]")];
  const thumbs = [...root.querySelectorAll(".pr-thumb")];
  const fill = document.getElementById("prTrackFill");
  const head = document.getElementById("prPlayhead");
  const timeCur = document.getElementById("prTimeCur");
  const sparkles = document.getElementById("prSparkles");
  const links = [...root.querySelectorAll(".pr-link")];
  const buddies = [...root.querySelectorAll(".pr-buddy")];
  const byRole = Object.fromEntries(buddies.map((el) => [el.dataset.buddy, el]));

  // Station positions (% of phone stage) — feet anchor
  const STATIONS = {
    back: { x: 50, y: 48, scale: 0.58, facing: 1 },
    left: { x: 24, y: 64, scale: 0.84, facing: 1 },
    lead: { x: 50, y: 68, scale: 1, facing: 1 },
    right: { x: 76, y: 64, scale: 0.84, facing: -1 },
  };

  const BEATS = [
    {
      at: 0,
      until: 0.18,
      caption: ["STUDIO CREW", "Four roles. One reel."],
      work: true,
      links: [],
    },
    {
      at: 0.18,
      until: 0.32,
      caption: ["DESIGN", "Palette picks the mood."],
      talk: { back: "Colors locked ✓" },
      look: { lead: "left", left: "right" },
      links: ["design-edit"],
      work: true,
    },
    {
      at: 0.32,
      until: 0.48,
      caption: ["EDIT", "Beats land on the cut."],
      talk: { left: "Cutting beat…" },
      look: { lead: "left", right: "left", back: "left" },
      links: ["design-edit", "edit-direct"],
      handoff: { from: [32, 42], to: [48, 58] },
      work: true,
    },
    {
      at: 0.48,
      until: 0.62,
      caption: ["DIRECT", "Story stays on track."],
      talk: { lead: "Nice — keep going!" },
      look: { left: "right", right: "left", back: "right" },
      nod: ["left", "right", "back"],
      links: ["edit-direct", "direct-export"],
      work: true,
    },
    {
      at: 0.62,
      until: 0.78,
      caption: ["EXPORT", "Render while we polish."],
      talk: { right: "Exporting…" },
      look: { lead: "right", left: "right" },
      links: ["direct-export"],
      exportProg: true,
      work: true,
    },
    {
      at: 0.78,
      until: 0.92,
      caption: ["SYNC CHECK", "Everyone aligned."],
      talk: { lead: "Ship it!", left: "Ready!", right: "MP4 done ✓", back: "Looks good!" },
      celebrate: true,
      links: ["design-edit", "edit-direct", "direct-export"],
      work: false,
    },
    {
      at: 0.92,
      until: 1,
      caption: ["STUDIO CREW", "Back to the next beat."],
      work: true,
      links: [],
    },
  ];

  let introDone = false;
  let liveAt = 0;
  let badgeIndex = 0;
  let lastBadgeAt = 0;
  let lastBlinkAt = 0;
  let nextBlinkIn = 2200;
  let lastSparkAt = 0;
  let lastBeatKey = "";
  let raf = 0;
  let visible = !document.hidden;

  root.classList.add("is-intro");

  window.setTimeout(() => {
    if (intro) intro.classList.add("is-done");
    root.classList.remove("is-intro");
    root.classList.add("is-live");
    introDone = true;
    liveAt = performance.now();
    cycleBadge(true);
    buddies.forEach((el) => el.classList.add("is-work"));
  }, INTRO_MS);

  const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  function cycleBadge(immediate) {
    if (!badges.length) return;
    const prev = badges[badgeIndex];
    if (!immediate && prev) {
      prev.classList.remove("is-active");
      prev.classList.add("is-exit");
      window.setTimeout(() => prev.classList.remove("is-exit"), 480);
    }
    badgeIndex = immediate ? 0 : (badgeIndex + 1) % badges.length;
    badges[badgeIndex].classList.add("is-active");
    lastBadgeAt = performance.now();
  }

  function clearLooks() {
    buddies.forEach((el) => {
      el.classList.remove("is-look-left", "is-look-right", "is-wave", "is-bounce", "is-nod", "is-talk");
      el.querySelector(".pr-bubble")?.classList.remove("is-on");
    });
  }

  function applyBeat(beat) {
    const key = `${beat.at}-${beat.caption?.[0]}`;
    if (key === lastBeatKey) return;
    lastBeatKey = key;

    if (captionKicker && beat.caption) captionKicker.textContent = beat.caption[0];
    if (captionTitle && beat.caption) captionTitle.textContent = beat.caption[1];

    buddies.forEach((el) => el.classList.toggle("is-work", !!beat.work));

    clearLooks();

    if (beat.look) {
      Object.entries(beat.look).forEach(([role, dir]) => {
        const el = byRole[role];
        if (!el) return;
        el.classList.add(dir === "left" ? "is-look-left" : "is-look-right");
      });
    }

    if (beat.talk) {
      Object.entries(beat.talk).forEach(([role, text]) => {
        const el = byRole[role];
        const bubble = el?.querySelector(".pr-bubble");
        if (!bubble) return;
        bubble.setAttribute("data-say", text);
        bubble.classList.add("is-on");
        el.classList.add("is-talk");
      });
    }

    if (beat.nod) {
      beat.nod.forEach((role, i) => {
        const el = byRole[role];
        if (!el) return;
        window.setTimeout(() => {
          el.classList.add("is-nod");
          window.setTimeout(() => el.classList.remove("is-nod"), 560);
        }, i * 90);
      });
    }

    if (beat.celebrate) {
      buddies.forEach((el, i) => {
        window.setTimeout(() => {
          el.classList.remove("is-work");
          el.classList.add("is-bounce");
          window.setTimeout(() => {
            el.classList.remove("is-bounce");
            el.classList.add("is-wave");
            window.setTimeout(() => el.classList.remove("is-wave"), 700);
          }, 500);
        }, i * 70);
      });
    }

    links.forEach((link) => {
      const id = link.getAttribute("data-link");
      link.classList.toggle("is-hot", (beat.links || []).includes(id));
    });
  }

  function placeBuddy(el, role, t) {
    const s0 = STATIONS[role];
    // Subtle idle drift so stations feel alive
    const driftX = Math.sin(t * 0.0011 + role.length) * 0.6;
    const driftY = Math.cos(t * 0.0014 + role.length * 2) * 0.45;
    const bob = Math.sin(t * 0.004 + role.length) * 0.35;
    const x = s0.x + driftX;
    const y = s0.y + driftY + bob;
    const facing = s0.facing;

    el.style.zIndex = role === "lead" ? "4" : role === "back" ? "2" : "3";
    el.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${s0.scale})`;
    const fig = el.querySelector(".pr-buddy-fig");
    if (fig) fig.style.transform = `translate3d(-50%, -88%, 0) scaleX(${facing})`;
  }

  function updateHandoff(beat, localU) {
    if (!handoff || !handoffCard || !beat.handoff) {
      handoff?.classList.remove("is-on");
      return;
    }
    const span = beat.until - beat.at;
    const p = easeInOut(Math.min(1, Math.max(0, (localU - beat.at) / span)));
    const [x0, y0] = beat.handoff.from;
    const [x1, y1] = beat.handoff.to;
    const x = x0 + (x1 - x0) * p;
    const y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 8;
    handoff.classList.add("is-on");
    handoffCard.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${0.85 + p * 0.2})`;
    handoffCard.style.opacity = String(p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1);
  }

  function cameraAt(u) {
    const breathe = Math.sin(u * Math.PI * 2) * 0.015;
    let tx = 0;
    let ty = -0.4;
    let scale = 1.02 + breathe;
    if (u < 0.32) tx = -1.2;
    else if (u < 0.48) tx = -0.4;
    else if (u < 0.62) tx = 0.2;
    else if (u < 0.78) tx = 1.1;
    else tx = 0;
    return { scale, tx, ty };
  }

  function spawnSpark() {
    if (!sparkles) return;
    const el = document.createElement("span");
    const kinds = ["purple", "orange", "star", "purple"];
    el.className = `pr-spark ${kinds[(Math.random() * kinds.length) | 0]}`;
    el.style.left = `${12 + Math.random() * 76}%`;
    el.style.top = `${18 + Math.random() * 48}%`;
    sparkles.appendChild(el);
    const rise = 16 + Math.random() * 30;
    const drift = (Math.random() - 0.5) * 24;
    const dur = 900 + Math.random() * 700;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 2);
      const op = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
      el.style.opacity = String(Math.max(0, op));
      el.style.transform = `translate3d(${drift * ease}px, ${-rise * ease}px, 0) scale(${1 - p * 0.35})`;
      if (p < 1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function blinkCrew(double) {
    const cls = double ? "is-blink-double" : "is-blink";
    buddies.forEach((el, i) => {
      window.setTimeout(() => {
        el.classList.remove("is-blink", "is-blink-double");
        void el.offsetWidth;
        el.classList.add(cls);
        window.setTimeout(() => el.classList.remove(cls), double ? 450 : 180);
      }, i * 45);
    });
  }

  function formatTime(ms) {
    const s = Math.floor((ms / 1000) % 16);
    return `0:${String(s).padStart(2, "0")}`;
  }

  function currentBeat(u) {
    return BEATS.find((b) => u >= b.at && u < b.until) || BEATS[BEATS.length - 1];
  }

  function frame(now) {
    if (!visible) {
      raf = requestAnimationFrame(frame);
      return;
    }

    if (introDone && cast) {
      const loopT = (now - liveAt) % LOOP_MS;
      const u = loopT / LOOP_MS;
      if (u < 0.02) lastBeatKey = "";
      const beat = currentBeat(u);

      placeBuddy(byRole.back, "back", now);
      placeBuddy(byRole.left, "left", now);
      placeBuddy(byRole.lead, "lead", now);
      placeBuddy(byRole.right, "right", now);

      applyBeat(beat);
      updateHandoff(beat, u);

      if (exportFill) {
        const prog = beat.exportProg
          ? Math.min(1, (u - beat.at) / (beat.until - beat.at))
          : beat.at >= 0.78
            ? 1
            : 0.12 + (u % 0.2) * 0.2;
        exportFill.style.width = `${Math.round(prog * 100)}%`;
      }

      if (camera) {
        const cam = cameraAt(u);
        camera.style.transform = `translate3d(${cam.tx}%, ${cam.ty}%, 0) scale(${cam.scale})`;
      }

      const progress = u * 100;
      if (fill) fill.style.width = `${progress}%`;
      if (head) head.style.left = `${progress}%`;
      if (timeCur) timeCur.textContent = formatTime(loopT);

      const thumbIdx = Math.min(thumbs.length - 1, Math.floor(u * thumbs.length));
      thumbs.forEach((el, i) => el.classList.toggle("is-hot", i === thumbIdx));

      if (now - lastBadgeAt > 2400) cycleBadge(false);

      if (now - lastBlinkAt > nextBlinkIn) {
        blinkCrew(Math.random() < 0.2);
        lastBlinkAt = now;
        nextBlinkIn = 2000 + Math.random() * 2600;
      }

      if (now - lastSparkAt > 480 + Math.random() * 500) {
        spawnSpark();
        lastSparkAt = now;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
  });

  raf = requestAnimationFrame(frame);
  window.addEventListener(
    "pagehide",
    () => {
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true }
  );
}
