/** Future product tour. Steps are registered; nothing starts until the tour is turned on. */
export const tourSteps = [
  { id: "projects", title: "Your projects", body: "Continue a reel or start a new one." },
  { id: "templates", title: "Templates", body: "Start from a layout that already knows the promo structure." },
  { id: "export", title: "Export", body: "Render a 9:16 MP4 when the cut is ready." },
];

export function startProductTour() {
  return { ok: false, reason: "The product tour is prepared and not enabled yet." };
}
