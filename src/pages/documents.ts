import { renderSitePage } from "./render-page";

export type Doc = {
  slug: string;
  title: string;
  description: string;
  heading: string;
  updated: string;
  html: string;
};

const UPDATED = "November 13, 2026";

function page(doc: Omit<Doc, "slug"> & { slug: string }) {
  return doc;
}

export const DOCUMENTS: Record<string, Doc> = {
  privacy: page({
    slug: "privacy",
    title: "Privacy Policy — Reel Creator",
    description: "How Reel Creator collects, uses, and deletes account and project data.",
    heading: "Privacy Policy",
    updated: UPDATED,
    html: `
      <p>Reel Creator is an early-access studio for app promo videos. This policy describes what we store so the product can run. We do not sell personal data.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, password hash, and the time the account was created.</li>
        <li>Studio data: projects, templates you edit, uploads, and exported videos.</li>
        <li>Session data: a signed-in cookie, and a shortened hash of the network address with the browser name, so you can review devices in settings.</li>
        <li>Messages you send from contact, bug, and feature forms.</li>
        <li>Product events such as sign-up, project creation, and export. Optional analytics tools load only if you accept analytics cookies.</li>
      </ul>
      <h2>How we use it</h2>
      <p>We use this data to run your account, render videos, send the emails you ask for (verification, password reset, billing, and export notices), and keep the service reliable. Marketing email is off unless you opt in.</p>
      <h2>How long we keep it</h2>
      <p>Account and project data stay until you delete them. Sessions expire after 30 days. Password reset links expire after one hour. Support messages are kept so we can reply. You can export or delete your account from settings.</p>
      <h2>Sharing</h2>
      <p>We do not sell personal information. If you connect an email or error-monitoring provider later, only the data needed for that service is sent. Payment card numbers are not stored by Reel Creator; a payment processor will handle cards when paid billing is connected.</p>
      <h2>Your choices</h2>
      <p>Use settings to change email, password, notifications, analytics, and crash reports. You can download a copy of your account data or delete the account. Deleting removes your sign-in and projects from the studio.</p>
      <p>Questions: <a href="mailto:hello@reelcreator.app">hello@reelcreator.app</a>.</p>`,
  }),
  terms: page({
    slug: "terms",
    title: "Terms of Service — Reel Creator",
    description: "The terms for using the Reel Creator studio.",
    heading: "Terms of Service",
    updated: UPDATED,
    html: `
      <p>These terms cover the Reel Creator studio. By creating an account you agree to them. If you are using Reel Creator for a company, you confirm you can bind that company.</p>
      <h2>The service</h2>
      <p>Reel Creator lets you edit promo templates, upload your own HTML reels, preview them, and export MP4 files. Early access may change, pause, or drop features. We will not pretend a feature exists when it does not.</p>
      <h2>Your content</h2>
      <p>You keep the rights to the projects, footage, and copy you upload. You give us permission to store and process that content only to run the studio for you, including rendering exports. You must have the rights to everything you upload.</p>
      <h2>Acceptable use</h2>
      <p>Do not use the service to break the law, attack the system, upload malware, or infringe someone else’s rights. We may suspend an account that puts other people or the service at risk.</p>
      <h2>Plans</h2>
      <p>The Free plan includes one project at a time and watermarked 720p exports. Pro removes the watermark, unlocks 1080p, and allows unlimited projects. Team and Enterprise are available as described on the pricing page. Paid checkout charges a card only after a payment processor is connected. Until then, plan changes in local or staging mode are records, not charges.</p>
      <h2>Liability</h2>
      <p>The studio is provided as available. We are not liable for lost profits or for content you did not have the right to use. Nothing in these terms limits liability that the law does not allow us to limit.</p>
      <p>Questions: <a href="mailto:hello@reelcreator.app">hello@reelcreator.app</a>.</p>`,
  }),
  cookies: page({
    slug: "cookies",
    title: "Cookie Policy — Reel Creator",
    description: "The cookies Reel Creator uses and how to control optional analytics.",
    heading: "Cookie Policy",
    updated: UPDATED,
    html: `
      <p>We use a small number of cookies and similar storage.</p>
      <h2>Essential</h2>
      <ul>
        <li><strong>rc_session</strong> keeps you signed in. It is HTTP-only, lasts 30 days, and is marked Secure on HTTPS.</li>
        <li>A local preference remembers whether you accepted optional analytics.</li>
      </ul>
      <h2>Product events</h2>
      <p>Sign-up, sign-in, project creation, exports, and errors can be recorded on our own server so the product can operate. These are not sold. You can turn product analytics off in settings.</p>
      <h2>Optional analytics</h2>
      <p>If you choose Accept on the cookie notice, and the matching environment variable is set, we can load Google Analytics, PostHog, Plausible, Mixpanel, or Microsoft Clarity. If those keys are empty, nothing extra is loaded. Choose Essential only to skip them.</p>
      <p>Read the <a href="/privacy">Privacy Policy</a> for the rest of what we store.</p>`,
  }),
  refunds: page({
    slug: "refunds",
    title: "Refund Policy — Reel Creator",
    description: "How refunds work once Reel Creator charges for a paid plan.",
    heading: "Refund Policy",
    updated: UPDATED,
    html: `
      <p>Card billing is not connected yet. Until a payment processor is live, Reel Creator does not charge your card. Invoices created in manual billing mode are records of a plan change, not payments.</p>
      <h2>When paid billing is live</h2>
      <p>If your first Pro charge is a mistake or the export pipeline fails you in the first 7 days, email <a href="mailto:hello@reelcreator.app">hello@reelcreator.app</a> and we will make it right. That matches the promise on the pricing page.</p>
      <p>You can cancel any time from billing. Access stays through the end of the period you already paid for. Team and Enterprise agreements follow the contract you sign.</p>
      <p>Free accounts are not charged, so there is nothing to refund.</p>`,
  }),
  guidelines: page({
    slug: "guidelines",
    title: "Community Guidelines — Reel Creator",
    description: "What belongs in a Reel Creator project.",
    heading: "Community Guidelines",
    updated: UPDATED,
    html: `
      <p>Reel Creator is a studio, not a public social feed. These rules still apply to what you upload and render.</p>
      <ul>
        <li>Only promote apps, brands, and footage you have the rights to use.</li>
        <li>Do not upload malware, credential stealers, or pages meant to attack someone who previews them.</li>
        <li>Do not use the renderer to harass people or to publish illegal content.</li>
        <li>Do not share your password or try to open another person’s projects.</li>
      </ul>
      <p>Report a problem from <a href="/support/bug">Report a bug</a> or email <a href="mailto:hello@reelcreator.app">hello@reelcreator.app</a>.</p>`,
  }),
  faq: page({
    slug: "faq",
    title: "FAQ — Reel Creator",
    description: "Answers to common questions about accounts, exports, and plans.",
    heading: "FAQ",
    updated: UPDATED,
    html: `
      <div class="faq-list">
        <details open><summary>Where do my projects live?</summary><p>On your account. Another signed-in user cannot open them.</p></details>
        <details><summary>What does Free include?</summary><p>One project at a time, core templates, and watermarked 720p exports. Pro removes the watermark and the project cap.</p></details>
        <details><summary>Can I cancel?</summary><p>Yes. Billing lets you cancel at the end of the current period and resume before it ends.</p></details>
        <details><summary>Why did password reset say to check email?</summary><p>If the address matches an account, we send a one-hour link. We use the same reply when it does not, so accounts cannot be listed.</p></details>
        <details><summary>Which HTML can I upload?</summary><p>A reel that exposes <code>window.__reel</code> with <code>DUR</code> and <code>setTime</code>. If that API is missing, the server adds a basic bridge.</p></details>
        <details><summary>Is social sign-in available?</summary><p>Not yet. Email and password work today. Google and GitHub are shown as not connected.</p></details>
      </div>`,
  }),
  changelog: page({
    slug: "changelog",
    title: "Release notes — Reel Creator",
    description: "What is in the Reel Creator early-access studio.",
    heading: "Release notes",
    updated: UPDATED,
    html: `
      <h2>November 2026 — launch prep</h2>
      <p>Accounts, billing architecture, settings, legal pages, help, and production headers. Paid cards stay disconnected until a processor is configured. Free exports are 720p with a watermark.</p>
      <h2>Studio</h2>
      <ul>
        <li>Projects from templates, HTML upload, or a duplicate.</li>
        <li>Editor with overlays, preview, and MP4 export.</li>
        <li>Private sessions stored as HTTP-only cookies.</li>
      </ul>`,
  }),
  shortcuts: page({
    slug: "shortcuts",
    title: "Keyboard shortcuts — Reel Creator",
    description: "Keyboard controls in the Reel Creator editor.",
    heading: "Keyboard shortcuts",
    updated: UPDATED,
    html: `
      <p>These work in the editor when focus is not inside a text field.</p>
      <table class="shortcut-table">
        <thead><tr><th scope="col">Action</th><th scope="col">Shortcut</th></tr></thead>
        <tbody>
          <tr><th scope="row">Play or pause</th><td><kbd class="kbd">Space</kbd></td></tr>
          <tr><th scope="row">Delete the selected element</th><td><kbd class="kbd">Delete</kbd> or <kbd class="kbd">Backspace</kbd></td></tr>
          <tr><th scope="row">Duplicate the selected element</th><td><kbd class="kbd">Ctrl</kbd> or <kbd class="kbd">⌘</kbd> + <kbd class="kbd">D</kbd></td></tr>
          <tr><th scope="row">Nudge</th><td>Arrow keys. Hold <kbd class="kbd">Shift</kbd> for a larger step.</td></tr>
          <tr><th scope="row">Deselect</th><td><kbd class="kbd">Esc</kbd></td></tr>
          <tr><th scope="row">Save source in the code view</th><td><kbd class="kbd">Ctrl</kbd> or <kbd class="kbd">⌘</kbd> + <kbd class="kbd">S</kbd></td></tr>
        </tbody>
      </table>`,
  }),
  support: page({
    slug: "support",
    title: "Support — Reel Creator",
    description: "Get help with Reel Creator.",
    heading: "Support",
    updated: UPDATED,
    html: `
      <p>Start with the <a href="/faq">FAQ</a> or the <a href="/shortcuts">keyboard shortcuts</a>. If you still need a person, write to us.</p>
      <ul>
        <li><a href="/contact">Contact support</a></li>
        <li><a href="/support/bug">Report a bug</a></li>
        <li><a href="/support/feature">Request a feature</a></li>
        <li><a href="/changelog">Release notes</a></li>
        <li><a href="mailto:hello@reelcreator.app">hello@reelcreator.app</a></li>
      </ul>`,
  }),
};

export function renderDocument(slug: string) {
  const doc = DOCUMENTS[slug];
  if (!doc) return null;
  return renderSitePage({
    title: doc.title,
    description: doc.description,
    canonical: `https://reelcreator.app/${doc.slug}`,
    main: `<div class="page-head"><div class="page-head-copy"><h1>${doc.heading}</h1><p class="page-head-sub">Last updated ${doc.updated}.</p></div></div><article class="prose">${doc.html}</article>`,
  });
}
