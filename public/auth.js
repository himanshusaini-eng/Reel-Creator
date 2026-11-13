import { $, api } from "/site.js";
import { track } from "/analytics.js";

const path = location.pathname.replace(/\/$/, "") || "/";
const mode =
  path === "/signup"
    ? "signup"
    : path === "/forgot-password"
      ? "forgot"
      : path === "/reset-password"
        ? "reset"
        : document.body.dataset.authMode || "signin";
document.body.dataset.authMode = mode;

const params = new URLSearchParams(location.search);
const raw = params.get("next") || "";
const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
const carry = raw ? `?next=${encodeURIComponent(raw)}` : "";

const waitForGsap = () =>
  new Promise((resolve) => {
    if (window.gsap) return resolve(window.gsap);
    let tries = 0;
    const tick = () => {
      if (window.gsap) return resolve(window.gsap);
      if (++tries > 40) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });

const animateIn = async () => {
  const gsap = await waitForGsap();
  const brand = document.querySelector(".auth-brand-inner");
  const card = document.querySelector(".auth-card");
  if (!gsap) {
    brand?.classList.add("is-visible");
    card?.classList.add("is-visible");
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    gsap.set([brand, card], { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    brand,
    { opacity: 0, y: 18 },
    { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
  );
  gsap.fromTo(
    card,
    { opacity: 0, y: 22, scale: 0.98 },
    { opacity: 1, y: 0, scale: 1, duration: 0.65, delay: 0.12, ease: "power2.out" },
  );
  gsap.fromTo(
    ".auth-benefits li",
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, delay: 0.25, ease: "power2.out" },
  );
};

const wirePasswordToggle = () => {
  const input = document.getElementById("password");
  const toggle = document.getElementById("togglePassword");
  if (!input || !toggle) return;
  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide" : "Show";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
};

const wireOAuthPlaceholders = () => {
  document.querySelectorAll("[data-oauth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const error = document.getElementById("error");
      if (error) error.textContent = "Social sign-in is coming soon. Use email for now.";
    });
  });
};

const setupAuthForm = () => {
  const form = document.getElementById("form");
  if (!form) return;

  const signup = mode === "signup";
  if (signup) {
    document.title = "Create account — Reel Creator";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Create your Reel Creator account — free to start, projects stay private.");
    document.getElementById("title").textContent = "Create your account";
    document.getElementById("sub").textContent = "Free to start. Your projects stay private to you.";
    document.getElementById("nameField")?.classList.remove("hidden");
    document.getElementById("password").autocomplete = "new-password";
    document.getElementById("password").placeholder = "At least 8 characters";
    document.getElementById("submit").textContent = "Create account";
    document.getElementById("legal")?.classList.remove("hidden");
    document.getElementById("switch").innerHTML = `Already have an account? <a href="/signin${carry}">Sign in</a>`;
    const forgot = document.querySelector(".auth-forgot");
    if (forgot) forgot.classList.add("hidden");
  } else {
    document.getElementById("switch").innerHTML = `New here? <a href="/signup${carry}">Create a free account</a>`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = $("error");
    const submit = $("submit");
    error.textContent = "";
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) {
      error.textContent = "Enter your email and password.";
      return;
    }
    if (signup && password.length < 8) {
      error.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (signup && !$("name").value.trim()) {
      error.textContent = "Please enter your name.";
      return;
    }
    submit.disabled = true;
    try {
      const body = { email, password };
      if (signup) body.name = $("name").value.trim();
      await api(signup ? "/api/auth/signup" : "/api/auth/signin", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await track(signup ? "signup" : "login", { method: "email" });
      location.href = next;
    } catch (err) {
      error.textContent = err.message || "Something went wrong.";
      submit.disabled = false;
    }
  });
};

const setupForgotForm = () => {
  const form = document.getElementById("forgotForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email")?.value.trim();
    const error = document.getElementById("error");
    const success = document.getElementById("success");
    const submit = document.getElementById("submit");
    error.textContent = "";
    success.classList.add("hidden");
    if (!email) {
      error.textContent = "Enter the email on your account.";
      return;
    }
    submit.disabled = true;
    try {
      await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      success.textContent = "If that email matches an account, a reset link is on its way. It expires in one hour.";
      success.classList.remove("hidden");
    } catch (err) {
      error.textContent = err.message || "We couldn’t send the reset link.";
      submit.disabled = false;
    }
  });
};

const setupResetForm = () => {
  const form = document.getElementById("resetForm");
  if (!form) return;
  const token = new URLSearchParams(location.search).get("token") || "";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("password")?.value || "";
    const confirm = document.getElementById("confirm")?.value || "";
    const error = document.getElementById("error");
    const success = document.getElementById("success");
    const submit = document.getElementById("submit");
    error.textContent = "";
    success.classList.add("hidden");
    if (!token) {
      error.textContent = "This reset link is missing a token. Request a new one.";
      return;
    }
    if (password.length < 8) {
      error.textContent = "Password must be at least 8 characters.";
      return;
    }
    if (password !== confirm) {
      error.textContent = "Passwords do not match.";
      return;
    }
    submit.disabled = true;
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      success.textContent = "Password updated. Taking you to the studio.";
      success.classList.remove("hidden");
      location.href = "/app";
    } catch (err) {
      error.textContent = err.message || "That reset link is invalid or expired.";
      submit.disabled = false;
    }
  });
};

wirePasswordToggle();
wireOAuthPlaceholders();
setupAuthForm();
setupForgotForm();
setupResetForm();
animateIn();
