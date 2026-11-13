/* Pricing-page extras — billing toggle is handled by landing.js */
document.querySelectorAll(".price-faq-list details").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    document.querySelectorAll(".price-faq-list details").forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});
