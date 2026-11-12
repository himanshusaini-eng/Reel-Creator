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
const testimonialViewport = document.getElementById("testimonialViewport");
const testimonialDots = [...document.querySelectorAll(".testimonial-dot")];
const testimonialPrev = document.getElementById("testimonialPrev");
const testimonialNext = document.getElementById("testimonialNext");
if (testimonialTrack && testimonialViewport && testimonialCards.length) {
  let testimonialIndex = 0;
  let slidePosition = 1;
  let touchStartX = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const getSlideStep = () => {
    const first = testimonialTrack.children[0];
    const second = testimonialTrack.children[1];
    if (!first || !second) return first?.getBoundingClientRect().width || 0;
    return second.getBoundingClientRect().left - first.getBoundingClientRect().left;
  };
  const setSlidePosition = (position) => {
    slidePosition = position;
    testimonialTrack.style.transform = `translate3d(${-getSlideStep() * slidePosition}px, 0, 0)`;
  };
  const cloneCard = (card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    return clone;
  };
  if (testimonialCards.length > 1) {
    testimonialTrack.prepend(cloneCard(testimonialCards[testimonialCards.length - 1]));
    for (let index = 0; index < Math.min(2, testimonialCards.length); index += 1) {
      testimonialTrack.append(cloneCard(testimonialCards[index]));
    }
  }
  setSlidePosition(slidePosition);
  requestAnimationFrame(() => testimonialTrack.classList.add("is-ready"));
  const updateTestimonialDots = () => {
    testimonialDots.forEach((dot, index) => {
      const active = index === testimonialIndex;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };
  const showTestimonial = (nextIndex) => {
    testimonialIndex = (nextIndex + testimonialCards.length) % testimonialCards.length;
    setSlidePosition(testimonialIndex + 1);
    updateTestimonialDots();
  };
  const rotateTestimonials = (direction) => {
    if (testimonialCards.length === 1) return;
    testimonialIndex = (testimonialIndex + direction + testimonialCards.length) % testimonialCards.length;
    slidePosition = reducedMotion.matches
      ? testimonialIndex + 1
      : testimonialIndex === 0 && direction > 0
        ? testimonialCards.length + 1
        : testimonialIndex === testimonialCards.length - 1 && direction < 0
          ? 0
          : testimonialIndex + 1;
    setSlidePosition(slidePosition);
    updateTestimonialDots();
  };
  testimonialTrack.addEventListener("transitionend", (event) => {
    if (event.target !== testimonialTrack || event.propertyName !== "transform") return;
    if (slidePosition === testimonialCards.length + 1 || slidePosition === 0) {
      const position = slidePosition === 0 ? testimonialCards.length : 1;
      testimonialTrack.classList.remove("is-ready");
      setSlidePosition(position);
      void testimonialTrack.offsetWidth;
      requestAnimationFrame(() => testimonialTrack.classList.add("is-ready"));
    }
  });
  testimonialDots.forEach((dot, index) => {
    dot.addEventListener("click", () => showTestimonial(index));
  });
  testimonialViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") touchStartX = event.clientX;
  });
  testimonialViewport.addEventListener("pointerup", (event) => {
    if (touchStartX === null) return;
    const distance = event.clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) > 48) rotateTestimonials(distance < 0 ? 1 : -1);
  });
  testimonialViewport.addEventListener("pointercancel", () => { touchStartX = null; });
  testimonialPrev?.addEventListener("click", () => rotateTestimonials(-1));
  testimonialNext?.addEventListener("click", () => rotateTestimonials(1));

  let carouselTimer;
  const pauseCarousel = () => window.clearInterval(carouselTimer);
  const resumeCarousel = () => {
    pauseCarousel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    carouselTimer = window.setInterval(() => rotateTestimonials(1), 5000);
  };
  testimonialViewport.addEventListener("pointerenter", pauseCarousel);
  testimonialViewport.addEventListener("pointerleave", resumeCarousel);
  testimonialViewport.addEventListener("focusin", pauseCarousel);
  testimonialViewport.addEventListener("focusout", resumeCarousel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseCarousel();
    else resumeCarousel();
  });
  window.addEventListener("resize", () => {
    testimonialTrack.classList.remove("is-ready");
    setSlidePosition(slidePosition);
    requestAnimationFrame(() => testimonialTrack.classList.add("is-ready"));
    resumeCarousel();
  }, { passive: true });
  const updateMotionPreference = () => {
    testimonialTrack.classList.toggle("is-reduced-motion", reducedMotion.matches);
    if (reducedMotion.matches) setSlidePosition(testimonialIndex + 1);
    else resumeCarousel();
  };
  reducedMotion.addEventListener("change", updateMotionPreference);
  updateMotionPreference();
  resumeCarousel();
}

const trustedMarquee = document.getElementById("trustedMarquee");
const trustedTrack = document.getElementById("trustedTrack");
const trustedLogos = document.getElementById("trustedLogos");

if (trustedMarquee && trustedTrack && trustedLogos) {
  const trustedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const logoSeed = trustedLogos.innerHTML;
  let trustedResizeTimer;

  const setupTrustedMarquee = () => {
    trustedTrack.classList.remove("is-ready");
    trustedTrack.replaceChildren();

    const gap = window.matchMedia("(max-width: 700px)").matches ? 52 : 72;
    trustedTrack.style.gap = `${gap}px`;

    const buildRow = () => {
      const row = document.createElement("ul");
      row.className = "platform-list";
      row.innerHTML = logoSeed;
      row.style.gap = `${gap}px`;
      return row;
    };

    const primary = buildRow();
    trustedTrack.appendChild(primary);

    // Keep cloning until one segment always covers the visible strip.
    const targetWidth = Math.max(trustedMarquee.clientWidth * 2, 900);
    let guard = 0;
    while (primary.scrollWidth < targetWidth && guard < 20) {
      primary.insertAdjacentHTML("beforeend", logoSeed);
      guard += 1;
    }

    const clone = primary.cloneNode(true);
    trustedTrack.appendChild(clone);

    const shift = primary.getBoundingClientRect().width + gap;
    trustedTrack.style.setProperty("--trusted-shift", `${Math.round(shift)}px`);
    trustedTrack.style.setProperty(
      "--trusted-duration",
      `${Math.max(28, Math.round(shift / 42))}s`
    );

    if (!trustedMotion.matches) {
      requestAnimationFrame(() => trustedTrack.classList.add("is-ready"));
    }
  };

  const scheduleTrustedSetup = () => {
    window.clearTimeout(trustedResizeTimer);
    trustedResizeTimer = window.setTimeout(setupTrustedMarquee, 60);
  };

  setupTrustedMarquee();
  requestAnimationFrame(setupTrustedMarquee);
  window.addEventListener("resize", scheduleTrustedSetup, { passive: true });
  window.addEventListener("load", setupTrustedMarquee, { once: true });
  trustedMotion.addEventListener("change", setupTrustedMarquee);
}
