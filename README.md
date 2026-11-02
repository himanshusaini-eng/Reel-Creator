# Reel Creator

Local studio for **9:16 app demo reels** (phone UI walkthrough → MP4).

Edit brand, captions, and store badges → preview → export with Puppeteer + FFmpeg.

## Requirements

- Node.js 18+
- [FFmpeg](https://ffmpeg.org/) on PATH
- Google Chrome (macOS default path used by the worker)

## Quick start

```bash
cd reel-creator
npm install
npm run dev
```

Open **http://localhost:3847**

## How it works

1. **Account**: sign up at `/signup`. Every project, upload, render job and export belongs to its user, and nobody else can open it. Templates are shared and read-only.
2. **Home** (`/app`): your projects. Rename, duplicate, delete, or download the latest export.
3. **New project** (`/app/new`): name it, then start from a template, an uploaded HTML reel, or a copy of an existing project.
4. **Editor** (`/app/projects/:id`): fields, video settings and live preview. Changes autosave. Export history is in the left panel.
5. **Worker** (`worker/render.mjs`): screenshots each frame with Puppeteer, then encodes it with FFmpeg into `output/<userId>/<projectId>/`.

The HTTP server is **NestJS** (`src/`). Frontend pages in `public/` are unchanged.

Accounts and sessions are stored in `data/users.json` and `data/sessions.json`, with scrypt password hashes. Sessions last 30 days. Set `NODE_ENV=production` to mark the cookie `Secure` (needs HTTPS).

The **first account created** takes over all existing projects from before accounts were added, and their exports are moved into that account's output folder.

### Elements (drag-and-drop overlays)

In the editor's **Elements** tab, drag a heading, text, button, image, rectangle, circle or emoji onto the video. Image files dropped onto the video become image elements.
- **On the video:** drag to move (it snaps to the center line), and drag the corner handle to resize.
- **Keyboard:** Delete removes, ⌘D duplicates, and the arrow keys nudge (hold Shift for bigger steps).
- **Inspector:** set style, appear and disappear times, entrance and exit animations, and a looping effect while visible.

Entrance options: fade, slide, pop, zoom, blur, spin and typewriter. Looping effects: pulse, float, wiggle and spin.

Elements are saved on the project as `overlays` and drawn by [`public/overlays.js`](public/overlays.js). The editor injects that script into the preview, and the worker injects it into the page it records, so both draw the same frames. Elements work on top of every template and uploaded HTML reel. Positions are stored as percentages of the 9:16 frame, and sizes as pixels at 1080 wide.

### Device Mockup template

`templates/device-mockup/` puts a screen recording (MP4, WebM, MOV) or screenshot inside an iPhone, Android, iPad or MacBook frame, or with no frame. You choose:
- the frame finish
- the motion: float, 3D tilt, slow zoom, orbit or still
- an optional headline above or below the device

If the recording is shorter than the reel, it loops. Uploads can be up to 200 MB.

Its `setTime(t)` returns a promise that resolves once the `<video>` has finished seeking. The worker awaits it before each screenshot, so exported frames match the recording exactly. Any template can do the same: return a promise from `setTime` when a frame needs time to be ready.

### Upload HTML requirements

Your HTML should expose a seek API (your existing reels already do):

```js
window.__reel = {
  DUR: 18,
  setTime(t) { /* seek animation to t seconds */ }
};
```

If `__reel` is missing, the server injects a basic bridge. Relative `assets/` files are supported; workspace `../assets` is copied in automatically when present.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start editor + API on port 3847 |
| `npm run render -- <projectId>` | Render a saved project from CLI |

## Project layout

```
reel-creator/
  public/          Landing, auth, home, new-project and editor pages
  src/             NestJS API (auth, projects, uploads, jobs, pages)
  server/          Shared helpers (reel-bridge.js for the worker)
  data/            Users + sessions (JSON)
  worker/          Puppeteer + FFmpeg renderer
  templates/       Reel templates
  projects/        Saved project JSON
  output/          Exported MP4s, per user and project
  uploads/         HTML reels (html/) and per-user assets (users/)
```

## Add a template

1. Create `templates/my-template/`
2. Add `meta.json` (id, name, fields, defaults)
3. Add `index.html` that reads `window.__PROJECT__` and exposes:

```js
window.__reel = {
  DUR: 18,
  setTime(t) { /* seek animation to t seconds */ },
  render(t) { /* optional */ }
};
```
