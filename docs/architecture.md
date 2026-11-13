# Architecture

Reel Creator is a NestJS API with server-rendered and static pages in `public/`. Accounts, projects, and billing state are JSON files on disk. That is the right shape for a single-node early launch. Move each store to a database when more than one app server is running.

## Layout

```
public/        Pages, studio JS, design tokens in site.css
src/           NestJS modules
  auth/        Sessions, passwords, account settings
  billing/     Plans, checkout, invoices, renewal sweep
  email/       Templates and provider seam
  analytics/   First-party event collect
  monitor/     Redacted client and server errors
  support/     Contact, bugs, features, lists
  projects/    Project files
  jobs/        Export worker
  pages/       HTML routes and legal documents
worker/        Puppeteer + FFmpeg renderer
templates/     Reel templates
docs/          This documentation
```

## Request path

`src/main.ts` sets security headers, compression, and the JSON limit, then Nest routes. `AuthMiddleware` reads the `rc_session` cookie and attaches the user. Mutating `/api` calls that already have a session cookie must come from the same origin.

Passwords are scrypt hashes. Session tokens are stored as SHA-256 hashes. Reset and verify links store only a hash of the token.

## Plans

`src/billing/plans.ts` is the catalog: Free, Pro, Team, Enterprise. Prices for Free and Pro match the pricing page. Team stays contact-led until `BILLING_TEAM_MONTHLY_CENTS` is set. Enterprise is contact-led (`from $49/seat` on the pricing page).

`BILLING_PROVIDER=manual` records plan changes and does not charge a card. Production without a provider keeps checkout in `awaiting_provider`. Stripe is a seam in `src/billing/provider.ts`: implement the Checkout Session call there, and send normalized events to `POST /api/billing/webhook` with `x-reel-webhook-secret`.

Free accounts are limited to one project. Free exports are forced to 720p and stamped with a small watermark by `worker/render.mjs` when `REEL_FORCE_720` and `REEL_WATERMARK` are set.

## Analytics and monitoring

`public/analytics.js` is the only browser tracker. It posts product events to `/api/analytics/collect`. Google Analytics, PostHog, Plausible, Mixpanel, and Clarity load only after the visitor accepts analytics cookies and the matching env var is set.

`public/boot.js` installs the cookie choice, page view, click hooks, and optional Sentry or LogRocket. Crash text is redacted before it is stored.

## Email

`src/email/email.templates.ts` holds welcome, verify, reset, subscription, invoice, export, team invite, early access, newsletter, and support acknowledgement. Delivery is a webhook (`EMAIL_WEBHOOK_URL`) or the local outbox at `data/outbox.json`.

## State

The studio UI keeps project state in `public/app.js`. Account preferences live on the user record and are read from `GET /api/auth/me`. There is no global client store.

## Hooks worth reusing

- `public/site.js` — `api`, `escapeHtml`, `mountAccount`, `mountOfflineBanner`
- `public/notify.js` — toasts and progress
- `public/analytics.js` — `track`, `identify`
- `public/dialogs.js` — confirm, prompt, and error copy
- `public/tour.js` — tour steps, not started automatically
