import { escapeHtml } from "/site.js";

document.body.classList.add("js-ready");

const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const siteHead = document.querySelector(".site-head");
const navBackdrop = document.getElementById("navBackdrop");

const NAV_EXPAND_Y = 120;
const NAV_COLLAPSE_Y = 60;
const NAV_LOCK_MS = 450;

let isExpanded = false;
let lastScrollY = window.scrollY || 0;
let navLockUntil = 0;
let headerScrollTicking = false;

const getScrollY = () =>
  window.scrollY || document.documentElement.scrollTop || 0;

const setNavExpanded = (next) => {
  if (!siteHead || next === isExpanded) return;
  isExpanded = next;
  siteHead.classList.toggle("is-scrolled", next);
  navLockUntil = performance.now() + NAV_LOCK_MS;
};

const updateHeaderOnScroll = () => {
  if (!siteHead) return;

  const y = getScrollY();
  const dy = y - lastScrollY;
  lastScrollY = y;

  if (performance.now() < navLockUntil) return;

  const scrollingDown = dy > 0;
  const scrollingUp = dy < 0;

  if (!isExpanded && y >= NAV_EXPAND_Y && (scrollingDown || dy === 0)) {
    setNavExpanded(true);
    return;
  }

  if (isExpanded && y <= NAV_COLLAPSE_Y && (scrollingUp || dy === 0)) {
    setNavExpanded(false);
  }
};

const requestHeaderScrollUpdate = () => {
  if (headerScrollTicking) return;
  headerScrollTicking = true;
  requestAnimationFrame(() => {
    updateHeaderOnScroll();
    headerScrollTicking = false;
  });
};

const setMenuOpen = (open) => {
  menuToggle?.setAttribute("aria-expanded", String(open));
  menuToggle?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  siteNav?.classList.toggle("menu-open", open);
  document.body.classList.toggle("menu-open", open);
  if (navBackdrop) navBackdrop.hidden = !open;
};

const closeMenu = () => setMenuOpen(false);

lastScrollY = getScrollY();
isExpanded = lastScrollY >= NAV_EXPAND_Y;
if (siteHead) siteHead.classList.toggle("is-scrolled", isExpanded);

window.addEventListener("scroll", requestHeaderScrollUpdate, { passive: true });
window.addEventListener("resize", () => {
  if (window.matchMedia("(min-width: 641px)").matches) closeMenu();
  lastScrollY = getScrollY();
  if (performance.now() >= navLockUntil) updateHeaderOnScroll();
});

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  setMenuOpen(!isOpen);
});

navBackdrop?.addEventListener("click", closeMenu);

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const billingOptions = document.querySelectorAll("[data-billing]");
const prices = document.querySelectorAll(".plan-price[data-monthly][data-yearly]");
billingOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const yearly = option.dataset.billing === "yearly";
    billingOptions.forEach((button) => {
      const active = button === option;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    prices.forEach((price) => {
      const amount = price.dataset[yearly ? "yearly" : "monthly"];
      if (amount === undefined) return;
      price.innerHTML = `$${amount}<small>/month</small>`;
      price.setAttribute("aria-label", `$${amount} per month`);
    });
  });
});

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelectorAll(".feature-card").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--pointer-x");
    card.style.removeProperty("--pointer-y");
  });
});

const templatesContainer = document.getElementById("tpls");
try {
  const response = await fetch("/api/templates");
  if (!response.ok) throw new Error(`Could not load templates (${response.status})`);
  const templates = await response.json();
  if (!Array.isArray(templates)) throw new Error("The template list was not in the expected format");
  templatesContainer.innerHTML = templates.map((template) => {
    const id = encodeURIComponent(template.id);
    const thumbnail = encodeURIComponent(template.thumbnail || "preview.svg");
    return `
      <a class="tpl-card" href="/app/new?template=${id}">
        <img src="/templates/${id}/${thumbnail}" alt="" loading="lazy">
        <div><b>${escapeHtml(template.name)}</b><span>${escapeHtml(template.description || "")}</span></div>
      </a>`;
  }).join("");
} catch (error) {
  templatesContainer.innerHTML = `<p class="template-loading" role="status">${escapeHtml(error.message)}. You can still <a href="/app/new">browse templates in the studio ↗</a>.</p>`;
}

const testimonialTrack = document.getElementById("testimonialTrack");
const testimonialCards = [...(testimonialTrack?.querySelectorAll(".testimonial-card") || [])];
const testimonialPrev = document.getElementById("testimonialPrev");
const testimonialNext = document.getElementById("testimonialNext");
if (testimonialTrack && testimonialCards.length) {
  let testimonialIndex = 0;
  let shiftTimeout;
  const isMobileTestimonials = () => window.matchMedia("(max-width: 700px)").matches;
  const showTestimonial = (nextIndex) => {
    testimonialIndex = (nextIndex + testimonialCards.length) % testimonialCards.length;
    if (!isMobileTestimonials()) return;
    const card = testimonialCards[testimonialIndex];
    testimonialTrack.scrollTo({ left: card.offsetLeft - testimonialTrack.offsetLeft, behavior: "smooth" });
  };
  const rotateTestimonials = (direction) => {
    if (isMobileTestimonials()) {
      showTestimonial(testimonialIndex + direction);
      return;
    }

    testimonialTrack.classList.remove("is-shifting");
    if (direction > 0) testimonialTrack.append(testimonialCards.shift());
    else testimonialTrack.prepend(testimonialCards.pop());
    testimonialTrack.classList.add("is-shifting");
    window.clearTimeout(shiftTimeout);
    shiftTimeout = window.setTimeout(() => testimonialTrack.classList.remove("is-shifting"), 400);
  };
  testimonialPrev?.addEventListener("click", () => rotateTestimonials(-1));
  testimonialNext?.addEventListener("click", () => rotateTestimonials(1));

  let carouselTimer;
  const pauseCarousel = () => window.clearInterval(carouselTimer);
  const resumeCarousel = () => {
    pauseCarousel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    carouselTimer = window.setInterval(() => rotateTestimonials(1), 5000);
  };
  testimonialTrack.addEventListener("pointerenter", pauseCarousel);
  testimonialTrack.addEventListener("pointerleave", resumeCarousel);
  testimonialTrack.addEventListener("focusin", pauseCarousel);
  testimonialTrack.addEventListener("focusout", resumeCarousel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseCarousel();
    else resumeCarousel();
  });
  window.addEventListener("resize", resumeCarousel, { passive: true });
  resumeCarousel();
}
