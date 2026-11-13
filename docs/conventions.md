# Conventions

## TypeScript

Nest code lives in `src/` and compiles to `dist/`. Decorators are enabled. Prefer a thrown `Error` with a short sentence for validation; controllers map that to `{ error: string }`. Do not send stack traces, SQL, or file paths to the client.

## Pages

Marketing and studio pages stay in `public/`. Shared tokens and controls are in `public/site.css`. Do not introduce a second visual style for new screens. Legal articles are rendered from `src/pages/documents.ts` so the header and footer stay in one place.

New interactive pages follow `settings.html`: skip link, `site-head`, `main#main`, existing `.btn` and `.input` classes.

## API

- Auth cookies, not tokens in `localStorage`
- `401` means sign in
- `429` means slow down
- Write endpoints check the session user before touching a project, upload, or invoice
- Webhooks do not use the session cookie. They use `BILLING_WEBHOOK_SECRET`

## Privacy in logs

Use `redact()` before logging an error that might contain an email, cookie, or token. Analytics props drop email-like values and keys named password, token, or cookie.

## Naming

Files are kebab-case. Nest services are `SomethingService`. Browser modules are plain ESM in `public/` and imported by absolute path (`/site.js`).
