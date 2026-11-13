function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

const MARK = `<svg viewBox="0 0 32 32" fill="none"><path d="M10 8.5v15l13-7.5-13-7.5Z" fill="currentColor"/><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-opacity=".5"/></svg>`;

export function renderSitePage(opts: {
  title: string;
  description: string;
  canonical: string;
  robots?: string;
  main: string;
}) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <meta name="description" content="${esc(opts.description)}">
  <meta name="robots" content="${esc(opts.robots || "index,follow")}">
  <link rel="canonical" href="${esc(opts.canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/site.webmanifest">
  <title>${esc(opts.title)}</title>
  <link rel="preconnect" href="https://api.fontshare.com">
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/site.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-head">
    <a class="brand" href="/" aria-label="Reel Creator home">
      <span class="brand-mark" aria-hidden="true">${MARK}</span>
      <span class="brand-text">reelcreator</span>
    </a>
    <div class="head-actions">
      <a class="btn ghost" href="/help">Help</a>
      <a class="btn ghost" href="/signin">Log in</a>
      <a class="btn primary" href="/signup">Start free</a>
    </div>
  </header>
  <main id="main" class="page">
    ${opts.main}
  </main>
  <footer class="doc-foot">
    <div class="doc-foot-inner">
      <p>© ${year} Reel Creator</p>
      <nav aria-label="Legal and support">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/cookies">Cookies</a>
        <a href="/refunds">Refunds</a>
        <a href="/guidelines">Guidelines</a>
        <a href="/help">Help</a>
        <a href="/contact">Contact</a>
      </nav>
    </div>
  </footer>
  <script type="module" src="/boot.js"></script>
</body>
</html>`;
}
