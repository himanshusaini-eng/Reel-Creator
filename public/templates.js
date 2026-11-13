const tpls = document.getElementById("tpls");
const countEl = document.getElementById("tplCount");
const filters = [...document.querySelectorAll("[data-tpl-filter]")];

const tagFor = (name = "", description = "") => {
  const text = `${name} ${description}`.toLowerCase();
  if (/review/.test(text)) return "review";
  if (/stat|count/.test(text)) return "stats";
  if (/motion|kinetic|type/.test(text)) return "motion";
  if (/demo|nutrition|tour|screenshot/.test(text)) return "demo";
  if (/promo|mockup|app/.test(text)) return "promo";
  return "promo";
};

const enrichCards = () => {
  if (!tpls?.dataset.rich) return;
  tpls.querySelectorAll(".tpl-card").forEach((card) => {
    const title = card.querySelector("b")?.textContent || "";
    const desc = card.querySelector("span")?.textContent || "";
    const tag = tagFor(title, desc);
    card.dataset.tag = tag;
    if (!card.querySelector(".tpl-card-meta")) {
      const meta = document.createElement("div");
      meta.className = "tpl-card-meta";
      meta.innerHTML = `<em>${tag}</em>`;
      card.appendChild(meta);
    }
  });
  updateCount("all");
};

const updateCount = (filter) => {
  if (!countEl || !tpls) return;
  const cards = [...tpls.querySelectorAll(".tpl-card")];
  const visible = cards.filter((card) => filter === "all" || card.dataset.tag === filter);
  countEl.textContent = `${visible.length} template${visible.length === 1 ? "" : "s"}`;
};

const applyFilter = (filter) => {
  if (!tpls) return;
  tpls.querySelectorAll(".tpl-card").forEach((card) => {
    const show = filter === "all" || card.dataset.tag === filter;
    card.hidden = !show;
  });
  updateCount(filter);
};

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((entry) => entry.classList.toggle("is-on", entry === button));
    applyFilter(button.dataset.tplFilter || "all");
  });
});

if (tpls) {
  const watch = new MutationObserver(() => enrichCards());
  watch.observe(tpls, { childList: true });
  enrichCards();
}

const film = document.querySelector(".tpl-film");
const timeline = [...document.querySelectorAll(".tpl-timeline span")];
if (film) {
  const frames = [...film.querySelectorAll(".tpl-frame")];
  let index = 0;
  const tick = () => {
    frames.forEach((frame, i) => frame.classList.toggle("is-active", i === index));
    timeline.forEach((bar, i) => bar.classList.toggle("is-on", i === index));
    index = (index + 1) % frames.length;
  };
  tick();
  window.setInterval(tick, 2600);
}
