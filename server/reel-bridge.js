/** Shared by the server (preview) and worker (export) so both seek reels the same way. */

export const STUB_BRIDGE_RE =
  /<script>\s*\(function\s*\(\)\s*\{\s*if\s*\(window\.__reel\)\s*return;[\s\S]*?window\.__reel\s*=\s*\{[\s\S]*?\}\)\(\);\s*<\/script>/g;

export function stripStubBridge(html) {
  return String(html || "").replace(STUB_BRIDGE_RE, "");
}

export function hasAuthorReelBridge(html) {
  // After stripping injected stubs, a real author bridge still assigns window.__reel.
  return /window\.__reel\s*=/.test(html);
}

export function ensureReelBridge(html) {
  let out = stripStubBridge(html || "");
  if (hasAuthorReelBridge(out)) return out;
  const bridge = `
<script>
(function () {
  if (window.__reel && window.__reel.setTime && !window.__reel.__stub) return;
  var DUR = 18;
  try {
    if (window.CONFIG && CONFIG.duration) DUR = CONFIG.duration;
    else if (typeof window.DUR === "number") DUR = window.DUR;
  } catch (e) {}
  var external = false;
  var controlT = 0;
  var _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return _raf(function (now) {
      if (external) return; // parent drives frames via setTime
      cb(now);
    });
  };
  function getRender() {
    if (typeof window.render === "function") return window.render;
    try { if (typeof render === "function") return render; } catch (e) {}
    return null;
  }
  function setTime(t) {
    external = true;
    controlT = Math.max(0, Number(t) || 0);
    var r = getRender();
    if (r) r(controlT);
  }
  window.__reel = { DUR: DUR, setTime: setTime, render: setTime, __stub: true };
})();
</script>`;
  return out.includes("</body>") ? out.replace("</body>", `${bridge}</body>`) : out + bridge;
}
