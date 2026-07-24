# AGENTS.md

## Project Type

Chrome Extension (Manifest V3), plain vanilla JS/CSS. No build step, no package manager, no tests.

## Key Files

- `VERSION` — single source of truth for version number (plain text)
- `manifest.json` — extension config; `version` field injected from `VERSION` during build
- `background.js` — service worker; on icon click opens `popup.html`, routes sync messages
- `popup.html` — main UI, loads CSS then JS in strict order
- `about.html` — standalone "About" page, loads its own inline CSS + `js/about.js`
- `settings.html` — sync settings page (GitHub Token / Gist ID), inline CSS + `js/sync-settings.js` + `js/settings.js`
- `js/controller.js` — main logic, event binding, initialization
- `js/sync-gist.js` — GitHub Gist bookmark sync (upload/download/clear), loaded by background via `importScripts`

## Script Load Order (do not change)

In `popup.html`: `utils.js` → `bookmarks.js` → `state.js` → `ui.js` → `controller.js`

`js/about.js` is loaded separately by `about.html` and is not part of this chain.

All use `var` (no ES modules). `state.js` declares globals, `controller.js` consumes them.

## CSS Load Order

`base.css` → `layout.css` → `components.css`

## State Persistence

All state stored in `localStorage` with keys prefixed `workspace_`:
- `workspace_theme` — one of: `dark-gold`, `dark-crimson`, `ocean-blue`, `warm-light`
- `workspace_panel1Path` / `workspace_panel2Path` — JSON arrays of bookmark node paths
- `workspace_panel1Scale` / `workspace_panel2Scale` — float (0.6–1.8)
- `workspace_activePanel` — `"panel1"` or `"panel2"`

Clear button removes all of these.

## How to Develop / Test

1. Edit files in place
2. Open `chrome://extensions`, find the extension, click the reload icon
3. Click the extension toolbar icon to open the popup in a new tab

No dev server, no hot reload. Icons (`icons/icon*.png`) must exist to load the extension.

## Conventions

- All JS files use plain `function` declarations, no ES modules
- Comments and UI text are in Chinese (zh-CN)
- `popup.html` has `lang="zh-CN"`
- `about.html` has `lang="zh-CN"` with inline CSS (no external stylesheet)

## CI / Release

`.github/workflows/release.yml` triggers on tag `v*` pushed to `main`. It reads the version from `VERSION`, calls `deployment/build.sh` (which injects version into manifest, creates `.zip` and `.crx`), and publishes a GitHub Release.

Do not modify `dist/` manually — it is ignored by `.gitignore` and only the `.crx` file is kept.

## Deployment

`deployment/build.sh` — reads `VERSION`, injects version into `manifest.json`, generates RSA key (`deployment/key.pem`) if missing, creates `dist/*.zip` and `dist/*.crx`, then restores original `manifest.json`. Requires Node.js for CRX packaging; falls back to ZIP-only if unavailable.

`deployment/pack-crx.cjs` — Node.js script for CRX3 format signing (called by `build.sh`).

## Bookmark Sync (GitHub Gist, implemented)

Messages routed through `background.js` service worker:
- `upload` / `download` / `clearAll` / `openSettings` — sent by popup via `chrome.runtime.sendMessage()`
- Sync logic in `js/sync-gist.js` (loaded via `importScripts` in background.js)
- Settings stored in `chrome.storage.sync` via `js/sync-settings.js` (shared with settings.html)
- Manifest requires `host_permissions` for `github.com` and `githubusercontent.com`

## Docs

- `docs/产品详细设计文档.md` — detailed product design document
- `docs/主题配色方案设计.md` — theme color scheme design
