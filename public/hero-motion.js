const DURATION = 16;
const SCENES = [
  { id: "open", start: 0, end: 3.6, label: "Scene 01", title: "Open" },
  { id: "studio", start: 3.6, end: 7.8, label: "Scene 02", title: "Studio" },
  { id: "polish", start: 7.8, end: 12.2, label: "Scene 03", title: "AI Polish" },
  { id: "ship", start: 12.2, end: 16, label: "Scene 04", title: "Export" },
];

const hero = document.querySelector(".hero");
const media = document.getElementById("heroMedia");
const showcase = document.getElementById("heroShowcase");
const reel = document.getElementById("heroReel");
const videoToggle = document.getElementById("heroVideoToggle");
const ctrlPlay = document.getElementById("heroCtrlPlay");
const videoStatus = document.getElementById("heroVideoStatus");
const liveStatus = document.getElementById("heroLiveStatus");
const videoProgress = document.getElementById("heroVideoProgress");
const videoBuffer = document.getElementById("heroVideoBuffer");
const videoTime = document.getElementById("heroVideoTime");
const scrub = document.getElementById("heroScrub");
const scrubThumb = document.getElementById("heroScrubThumb");
const watchDemo = document.getElementById("heroWatchDemo");
const caption = document.getElementById("heroReelCaption");
const mascot = document.getElementById("heroMascot");
const floatingBadges = [...document.querySelectorAll(".hero-floating")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (hero && media && showcase && reel && videoToggle) {
  const scenes = SCENES.map((scene) => ({
    ...scene,
    el: reel.querySelector(`[data-scene="${scene.id}"]`),
  }));

  let currentTime = 0;
  let playing = false;
  let heroIsVisible = false;
  let pageIsVisible = !document.hidden;
  let isSeeking = false;
  let rafId = 0;
  let lastTs = 0;
  let activeSceneId = "";

  const announce = (message) => {
    if (videoStatus) videoStatus.textContent = message;
  };

  const setLive = (label) => {
    if (!liveStatus) return;
    liveStatus.innerHTML = `<i></i> ${label}`;
  };

  const formatTime = (time) => {
    const total = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const updateProgress = (ratio) => {
    const progress = Math.min(1, Math.max(0, ratio));
    if (videoProgress) videoProgress.style.transform = `scaleX(${progress})`;
    if (videoBuffer) videoBuffer.style.transform = "scaleX(1)";
    if (scrubThumb) scrubThumb.style.left = `${progress * 100}%`;
    if (scrub) {
      scrub.setAttribute("aria-valuenow", String(Math.round(progress * DURATION)));
      scrub.setAttribute("aria-valuemax", String(DURATION));
    }
    if (videoTime) videoTime.textContent = `${formatTime(progress * DURATION)} / ${formatTime(DURATION)}`;
  };

  const setScene = (sceneId) => {
    if (sceneId === activeSceneId) return;
    const prev = scenes.find((scene) => scene.id === activeSceneId);
    const next = scenes.find((scene) => scene.id === sceneId);
    if (prev?.el) {
      prev.el.classList.remove("is-active");
      prev.el.classList.add("is-leaving");
      window.setTimeout(() => prev.el.classList.remove("is-leaving"), 450);
    }
    if (next?.el) {
      next.el.classList.add("is-active");
      next.el.classList.remove("is-leaving");
    }
    if (caption && next) {
      caption.innerHTML = `<span>${next.label}</span><strong>${next.title}</strong>`;
    }
    activeSceneId = sceneId;
  };

  const renderAt = (time) => {
    currentTime = ((time % DURATION) + DURATION) % DURATION;
    const scene = scenes.find((item) => currentTime >= item.start && currentTime < item.end) || scenes[scenes.length - 1];
    setScene(scene.id);
    updateProgress(currentTime / DURATION);
  };

  const updatePlaybackState = () => {
    const state = playing ? "playing" : "paused";
    showcase.dataset.state = state;
    const playLabel = playing ? "Pause promo preview" : "Play promo preview";
    videoToggle.setAttribute("aria-label", playLabel);
    ctrlPlay?.setAttribute("aria-label", playing ? "Pause" : "Play");
    if (playing) {
      announce("Promo preview playing");
      setLive("Playing");
    } else {
      setLive(currentTime > 0.05 ? "Paused" : "Ready");
    }
  };

  const tick = (ts) => {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    const delta = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    renderAt(currentTime + delta);
    rafId = window.requestAnimationFrame(tick);
  };

  const playReel = () => {
    if (playing) return true;
    if (reducedMotion.matches) {
      renderAt(0);
      setLive("Ready");
      return false;
    }
    playing = true;
    lastTs = 0;
    updatePlaybackState();
    rafId = window.requestAnimationFrame(tick);
    return true;
  };

  const pauseReel = () => {
    playing = false;
    lastTs = 0;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    updatePlaybackState();
  };

  const togglePlay = () => {
    if (playing) pauseReel();
    else playReel();
  };

  const seekToRatio = (ratio) => {
    renderAt(Math.min(1, Math.max(0, ratio)) * DURATION);
  };

  const ratioFromPointer = (clientX) => {
    const bounds = scrub.getBoundingClientRect();
    if (!bounds.width) return 0;
    return (clientX - bounds.left) / bounds.width;
  };

  videoToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePlay();
  });
  ctrlPlay?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePlay();
  });

  showcase.querySelector(".hero-player-screen")?.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    togglePlay();
  });

  if (scrub) {
    const startSeek = (clientX) => {
      isSeeking = true;
      showcase.dataset.seeking = "true";
      const wasPlaying = playing;
      pauseReel();
      showcase.dataset.resumeAfterSeek = wasPlaying ? "true" : "false";
      seekToRatio(ratioFromPointer(clientX));
    };
    const moveSeek = (clientX) => {
      if (!isSeeking) return;
      seekToRatio(ratioFromPointer(clientX));
    };
    const endSeek = () => {
      if (!isSeeking) return;
      isSeeking = false;
      showcase.dataset.seeking = "false";
      if (showcase.dataset.resumeAfterSeek === "true") playReel();
      showcase.dataset.resumeAfterSeek = "false";
    };

    scrub.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      scrub.setPointerCapture(event.pointerId);
      startSeek(event.clientX);
    });
    scrub.addEventListener("pointermove", (event) => moveSeek(event.clientX));
    scrub.addEventListener("pointerup", endSeek);
    scrub.addEventListener("pointercancel", endSeek);
    scrub.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 1 : 0.5;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        seekToRatio((currentTime + step) / DURATION);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        seekToRatio((currentTime - step) / DURATION);
      } else if (event.key === "Home") {
        event.preventDefault();
        seekToRatio(0);
      } else if (event.key === "End") {
        event.preventDefault();
        seekToRatio(0.99);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        togglePlay();
      }
    });
  }

  watchDemo?.addEventListener("click", () => {
    media.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
    const started = playReel();
    if (!started) videoToggle.focus();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      heroIsVisible = entry.isIntersecting;
      if (heroIsVisible && pageIsVisible && !reducedMotion.matches) playReel();
      else pauseReel();
    }, { rootMargin: "160px 0px", threshold: 0.2 });
    observer.observe(media);
  } else {
    heroIsVisible = true;
    if (!reducedMotion.matches) playReel();
  }

  document.addEventListener("visibilitychange", () => {
    pageIsVisible = !document.hidden;
    if (!pageIsVisible) pauseReel();
    else if (heroIsVisible && !reducedMotion.matches) playReel();
  });

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) pauseReel();
    else if (heroIsVisible && pageIsVisible) playReel();
  });

  renderAt(0);
  updatePlaybackState();

  if (window.gsap) initHeroMotion(window.gsap);
  else {
    let attempts = 0;
    const waitForGsap = window.setInterval(() => {
      attempts += 1;
      if (window.gsap) {
        window.clearInterval(waitForGsap);
        initHeroMotion(window.gsap);
      } else if (attempts >= 50) {
        window.clearInterval(waitForGsap);
        media.classList.add("hero-motion-static");
      }
    }, 40);
  }
}

function initHeroMotion(gsap) {
  if (!hero || !media || !showcase) return;

  if (reducedMotion.matches) {
    gsap.set([media, showcase, mascot, ...floatingBadges].filter(Boolean), { clearProps: "all" });
    return;
  }

  let parallaxTween;
  let mascotBlink;
  const mascotImage = mascot?.querySelector("img");
  const lids = mascot?.querySelectorAll(".hero-mascot-lid");
  const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
  entrance.fromTo(showcase,
    { autoAlpha: 0, y: 28, scale: 0.97, filter: "blur(12px)" },
    { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.15 }
  );

  if (mascot) {
    entrance.fromTo(mascot,
      { autoAlpha: 0, y: 14, scale: 0.92 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, ease: "power2.out" },
      "-=0.42"
    );
    gsap.to(mascot, { y: "-=6", duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    if (mascotImage) {
      gsap.to(mascotImage, {
        scaleX: 1.012,
        scaleY: 0.992,
        rotation: 0.45,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }
    if (lids?.length) {
      mascotBlink = gsap.timeline({ repeat: -1, repeatDelay: 3.1 })
        .to(lids, { scaleY: 1, duration: 0.09, stagger: 0.025, ease: "power1.in" })
        .to(lids, { scaleY: 0, duration: 0.12, stagger: 0.025, ease: "power1.out" }, "+=0.06");
    }
  }

  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
    parallaxTween = gsap.to(media, {
      y: 28,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 },
    });
  }

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover) {
    const rotateX = gsap.quickTo(showcase, "rotationX", { duration: 0.55, ease: "power3.out" });
    const rotateY = gsap.quickTo(showcase, "rotationY", { duration: 0.55, ease: "power3.out" });
    const mascotX = mascotImage ? gsap.quickTo(mascotImage, "x", { duration: 0.65, ease: "power3.out" }) : null;
    const mascotY = mascotImage ? gsap.quickTo(mascotImage, "y", { duration: 0.65, ease: "power3.out" }) : null;
    const setLightX = gsap.quickSetter(showcase, "--pointer-x", "%");
    const setLightY = gsap.quickSetter(showcase, "--pointer-y", "%");

    media.addEventListener("pointermove", (event) => {
      const bounds = showcase.getBoundingClientRect();
      const x = gsap.utils.clamp(0, 100, ((event.clientX - bounds.left) / bounds.width) * 100);
      const y = gsap.utils.clamp(0, 100, ((event.clientY - bounds.top) / bounds.height) * 100);
      rotateX(gsap.utils.mapRange(0, 100, 2.8, -2.8, y));
      rotateY(gsap.utils.mapRange(0, 100, -3.2, 3.2, x));
      setLightX(x);
      setLightY(y);
      mascotX?.(gsap.utils.mapRange(0, 100, 2, -2, x));
      mascotY?.(gsap.utils.mapRange(0, 100, 1, -1, y));
    });

    media.addEventListener("pointerleave", () => {
      rotateX(0);
      rotateY(0);
      setLightX(50);
      setLightY(50);
      mascotX?.(0);
      mascotY?.(0);
    });

    hero.querySelectorAll(".hero-ctas .btn").forEach((button) => {
      button.addEventListener("mouseenter", () => gsap.to(button, { y: -2, scale: 1.015, duration: 0.22, ease: "power2.out" }));
      button.addEventListener("mouseleave", () => gsap.to(button, { y: 0, scale: 1, duration: 0.28, ease: "power2.out" }));
      button.addEventListener("focus", () => gsap.to(button, { y: -2, duration: 0.2, ease: "power2.out" }));
      button.addEventListener("blur", () => gsap.to(button, { y: 0, duration: 0.24, ease: "power2.out" }));
    });
  }

  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    entrance.kill();
    mascotBlink?.kill();
    gsap.killTweensOf([media, showcase, mascot, mascotImage, lids, ...floatingBadges].filter(Boolean));
    parallaxTween?.scrollTrigger?.kill();
    gsap.set([media, showcase, mascot, mascotImage, lids, ...floatingBadges].filter(Boolean), { clearProps: "all" });
  });
}
