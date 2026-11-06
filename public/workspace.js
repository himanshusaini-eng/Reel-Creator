/**
 * Workspace section — GSAP scroll reveal + tilt/look + blink.
 */
const section = document.getElementById("workspace");
if (section && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  waitForGsap().then(initWorkspace);
}

function waitForGsap(tries = 50) {
  return new Promise((resolve) => {
    const tick = (n) => {
      if (window.gsap) {
        if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
        resolve(window.gsap);
        return;
      }
      if (n <= 0) resolve(null);
      else window.setTimeout(() => tick(n - 1), 40);
    };
    tick(tries);
  });
}

function initWorkspace(gsap) {
  const copy = document.getElementById("workspaceCopy");
  const editor = document.getElementById("workspaceEditor");
  const mascot = document.getElementById("workspaceMascot");
  const face = mascot?.querySelector(".workspace-mascot-face");
  const stage = document.getElementById("workspaceStage");
  if (!copy || !editor || !mascot || !stage) return;

  const baseRotate = window.matchMedia("(max-width: 640px)").matches ? -5 : -7;

  if (gsap) {
    gsap.set(copy, { opacity: 0, y: 28 });
    gsap.set(editor, { opacity: 0, y: 40, scale: 0.95, rotation: baseRotate + 8 });
    gsap.set(mascot, { opacity: 0, y: 20, scale: 0.97 });

    // Pause CSS float during entrance, then restore
    editor.style.animationPlayState = "paused";
    mascot.style.animationPlayState = "paused";

    const tl = gsap.timeline({
      scrollTrigger: window.ScrollTrigger
        ? { trigger: section, start: "top 72%", once: true }
        : undefined,
      defaults: { ease: "power3.out" },
      onComplete: () => {
        editor.style.animationPlayState = "running";
        mascot.style.animationPlayState = "running";
      },
    });

    // If ScrollTrigger missing, play immediately when near viewport
    if (!window.ScrollTrigger) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tl.play(0);
            io.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      io.observe(section);
      tl.pause(0);
    }

    tl.to(copy, { opacity: 1, y: 0, duration: 0.9 }, 0)
      .to(
        editor,
        { opacity: 1, y: 0, scale: 1, rotate: baseRotate, duration: 1 },
        0.06
      )
      .to(mascot, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, 0.24);
  } else {
    copy.style.opacity = "1";
    editor.style.opacity = "1";
    mascot.style.opacity = "1";
  }

  // Blink
  const blink = () => {
    if (document.hidden) return;
    mascot.classList.remove("is-blink");
    void mascot.offsetWidth;
    mascot.classList.add("is-blink");
    window.setTimeout(() => mascot.classList.remove("is-blink"), 180);
  };
  let blinkTimer = window.setInterval(blink, 2600 + Math.random() * 2400);

  // Soft 3D tilt + mascot look
  let targetRX = 0;
  let targetRY = 0;
  let curRX = 0;
  let curRY = 0;
  let lookX = 0;
  let lookY = 0;
  let lookTX = 0;
  let lookTY = 0;
  let raf = 0;

  stage.addEventListener("pointermove", (e) => {
    const rect = stage.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const ny = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
    targetRY = Math.max(-4, Math.min(4, nx * 4));
    targetRX = Math.max(-3.2, Math.min(3.2, -ny * 3.2));
    lookTX = nx * 5;
    lookTY = ny * 3;
  });

  stage.addEventListener("pointerleave", () => {
    targetRX = 0;
    targetRY = 0;
    lookTX = 0;
    lookTY = 0;
  });

  const tick = () => {
    curRX += (targetRX - curRX) * 0.085;
    curRY += (targetRY - curRY) * 0.085;
    lookX += (lookTX - lookX) * 0.1;
    lookY += (lookTY - lookY) * 0.1;

    stage.style.setProperty("--stage-tilt-x", `${curRX.toFixed(3)}deg`);
    stage.style.setProperty("--stage-tilt-y", `${curRY.toFixed(3)}deg`);
    if (face) {
      face.style.setProperty("--look-x", `${lookX.toFixed(2)}deg`);
      face.style.setProperty("--look-y", `${(lookY * 0.35).toFixed(2)}px`);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearInterval(blinkTimer);
    else blinkTimer = window.setInterval(blink, 2600 + Math.random() * 2400);
  });

  window.addEventListener(
    "pagehide",
    () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(blinkTimer);
    },
    { once: true }
  );
}
