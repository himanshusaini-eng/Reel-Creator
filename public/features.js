const stage = document.querySelector("[data-feat-stage]");
if (stage) {
  const tabs = [...stage.querySelectorAll("[data-stage-tab]")];
  const panels = [...stage.querySelectorAll("[data-stage-panel]")];
  let index = 0;
  let timer = 0;

  const show = (next) => {
    index = next;
    tabs.forEach((tab, i) => {
      const on = i === next;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", String(on));
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== next;
    });
  };

  const arm = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => show((index + 1) % tabs.length), 4200);
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      show(i);
      arm();
    });
  });

  stage.addEventListener("mouseenter", () => window.clearInterval(timer));
  stage.addEventListener("mouseleave", arm);
  stage.addEventListener("focusin", () => window.clearInterval(timer));
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) arm();
  });

  show(0);
  arm();
}

const recButton = document.querySelector("[data-rec]");
const recPanel = document.getElementById("stagePanelRecord");
const scrub = recPanel?.querySelector("[data-scrub]");
recButton?.addEventListener("click", () => {
  const on = recButton.getAttribute("aria-pressed") !== "true";
  recButton.setAttribute("aria-pressed", String(on));
  recButton.querySelector("span").textContent = on ? "Recording 00:18" : "Start recording";
  recPanel?.classList.toggle("is-recording", on);
  if (scrub) {
    scrub.style.width = "0";
    if (on) requestAnimationFrame(() => { scrub.style.width = ""; });
  }
});

document.querySelectorAll("[data-pick]").forEach((list) => {
  list.addEventListener("click", (event) => {
    const item = event.target.closest("[data-pick-item]");
    if (!item || !list.contains(item)) return;
    list.querySelectorAll("[data-pick-item]").forEach((entry) => {
      const active = entry === item;
      entry.classList.toggle("is-on", active);
      entry.querySelector("button")?.setAttribute("aria-pressed", String(active));
    });
  });
});

const ratioCopy = {
  "9:16": "Master stays put. This frame is the feed cut.",
  "1:1": "Same story, squared for a paid placement.",
  "16:9": "Wide frame for a store preview or site embed.",
};
const ratioSize = {
  "9:16": "1080 × 1920",
  "1:1": "1080 × 1080",
  "16:9": "1920 × 1080",
};

document.querySelectorAll("[data-ratios]").forEach((group) => {
  const note = group.parentElement?.querySelector("[data-ratio-note]");
  const chip = group.parentElement?.querySelector("[data-ratio-chip]");
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ratio]");
    if (!button || !group.contains(button)) return;
    group.querySelectorAll("[data-ratio]").forEach((entry) => {
      entry.classList.toggle("is-on", entry === button);
    });
    const key = button.dataset.ratio;
    if (note && ratioCopy[key]) note.textContent = ratioCopy[key];
    if (chip && ratioSize[key]) chip.textContent = ratioSize[key];
  });
});

const captionToggle = document.querySelector("[data-caption-toggle]");
const caption = document.querySelector("[data-caption]");
const wave = document.querySelector("[data-wave]");
captionToggle?.addEventListener("click", () => {
  const on = captionToggle.getAttribute("aria-pressed") !== "true";
  captionToggle.setAttribute("aria-pressed", String(on));
  captionToggle.textContent = on ? "Captions on" : "Captions off";
  caption?.classList.toggle("is-off", !on);
  wave?.classList.toggle("is-paused", !on);
});

const counts = document.querySelectorAll("[data-count]");
if (counts.length && "IntersectionObserver" in window) {
  const counter = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / 700);
        el.textContent = String(Math.round(target * progress));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      observer.unobserve(el);
    });
  }, { threshold: 0.6 });
  counts.forEach((el) => counter.observe(el));
} else {
  counts.forEach((el) => { el.textContent = el.dataset.count; });
}

document.querySelectorAll(".feat-faq-list details").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    item.parentElement?.querySelectorAll("details").forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

document.querySelectorAll("a.feature-row").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  });
});
