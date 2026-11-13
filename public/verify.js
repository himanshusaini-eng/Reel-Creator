import { api } from "/site.js";

const token = new URLSearchParams(location.search).get("token") || "";
const title = document.getElementById("title");
const copy = document.getElementById("copy");

if (!token) {
  title.textContent = "Confirmation link missing";
  copy.textContent = "Open the link from your email, or send a new one from settings.";
} else {
  try {
    await api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
    title.textContent = "Email confirmed";
    copy.textContent = "You’re set. Head back to the studio.";
  } catch (error) {
    title.textContent = "Link not valid";
    copy.textContent = error.message;
  }
}
