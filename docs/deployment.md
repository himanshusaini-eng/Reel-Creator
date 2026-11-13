# Deployment

## Environments

| | Development | Staging | Production |
|---|---|---|---|
| Command | `npm run dev` | `npm run build` then `npm start` | same as staging |
| `NODE_ENV` | unset or `development` | `production` | `production` |
| Billing | `manual` (default) | `manual` or `none` | `none` until Stripe is implemented |
| Cookie | not Secure | Secure (needs HTTPS) | Secure |
| Service worker | off | on | on |

Copy `.env.example` to `.env`. Set `PUBLIC_APP_URL` to the HTTPS origin before sending email. Set `TRUST_PROXY=1` only behind a proxy you control.

## Build

```bash
npm install
npm run build
npm run check
npm start
```

`npm start` runs `scripts/start.mjs`, which defaults `NODE_ENV` to production and loads `dist/main.js`. The app listens on `PORT` (default 3847).

The renderer needs FFmpeg on `PATH` (or `FFMPEG_PATH`) and Chrome or Edge (`CHROME_PATH` if it is not in a standard location).

## What to put behind a CDN

`public/` assets are cacheable. HTML routes send `Cache-Control: no-cache`. Hashed filenames are not used yet, so production cache time for CSS and JS is 10 minutes. Do not cache `/api`, `/uploads`, or `/app`.

`public/robots.txt` and `public/sitemap.xml` use `https://reelcreator.app`. Change those hosts if the real domain differs.

## Headers

Every response gets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a Content-Security-Policy that allows the current fonts and the GSAP CDN. HSTS is added when `NODE_ENV=production`.

## Process

Run one Node process per machine. JSON files in `data/` are not safe for two app servers writing at once. Put the process behind HTTPS, keep `data/`, `projects/`, `uploads/`, and `output/` on persistent disk, and exclude them from the image if you rebuild often.

## Go-live checklist

- `PUBLIC_APP_URL` is HTTPS
- `BILLING_PROVIDER` is `none` until Stripe checkout is implemented in `src/billing/provider.ts`
- `EMAIL_WEBHOOK_URL` points at the mail provider
- `BILLING_WEBHOOK_SECRET` is long and random
- Analytics keys are set only for tools you want after cookie consent
- `npm run qa` passes against the staging URL
