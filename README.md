# Ghost Files Vault

A mobile-first, privacy-focused file vault for the Ghost app ecosystem.

## Release

**v0.1.1 — Startup & Navigation Fix**

This is the first clean-room Files Vault build. It is intentionally separated into focused files so future upgrades can replace only the area that changed.

## v0.1.1 update

This focused repair changes only the files that own the affected behaviour:

- `js/db.js` — repairs IndexedDB transaction completion handling
- `js/app.js` — reports the real startup error if another fault occurs
- `css/files.css` — aligns Hide with Home and Settings

No HTML, viewer logic, utilities or assets are changed.

## Current features

- Approved Ghost Files Vault logo with a true transparent background
- `+ File` upload flow with destination-folder selection
- `+ Album` custom folder creation
- Permanent **Pinned** folder for important files
- Permanent PIN-protected **Private** folder
- Uploads any file type accepted by the browser
- Local IndexedDB storage
- Built-in viewer for:
  - Images
  - Video
  - Audio
  - PDF
  - Plain text and common code/data formats
- Safe fallback screen for formats the browser cannot render internally
- Download, move and permanent delete controls
- Search and sorting inside folders
- Always-visible Home, Hide and Settings navigation
- Responsive Android/PWA layout

## Important viewer limitation

A browser cannot natively render every possible format. Office documents, archives, APK files and other unsupported formats are still stored inside Ghost and can be moved, deleted and downloaded, but the built-in viewer displays a safe file-information fallback instead of pretending it can render them.

## Temporary Private PIN

```text
1234
```

The PIN is stored locally in IndexedDB. A later Settings release will add a PIN-changing interface.

## Structure

```text
Ghost-Files-Vault/
├── index.html
├── README.md
├── assets/
│   ├── README.md
│   ├── files-vault.png
│   ├── secure-vault.png
│   ├── home.png
│   ├── hide.png
│   └── settings.png
├── css/
│   ├── README.md
│   └── files.css
└── js/
    ├── README.md
    ├── app.js
    ├── db.js
    ├── utils.js
    └── viewer.js
```

## File ownership

- `index.html`: semantic page structure and dialogs
- `css/files.css`: complete Files Vault appearance and responsive layout
- `js/app.js`: application state, events, folder flows and file actions
- `js/db.js`: IndexedDB schema and persistence only
- `js/viewer.js`: file-type detection and preview rendering only
- `js/utils.js`: reusable formatting, identifiers, sorting and toast helpers
- `assets/`: approved artwork only

## Clean update policy

Every future update must:

1. Modify the owning file or function instead of layering a patch.
2. Remove superseded code in the same release.
3. Avoid duplicate selectors, listeners, database methods or replacement functions.
4. Preserve IndexedDB compatibility unless a documented migration is included.
5. Upload only the files genuinely changed by the release.
6. Replace the root `README.md` with the updated complete version.
7. Keep all earlier release notes below the newest release notes.
8. Test uploads, stored data, Private access, previews, movement and navigation before release.

## Focused update examples

- Styling only: upload `css/files.css` and the updated root `README.md`
- Viewer support: upload `js/viewer.js` and the updated root `README.md`
- Database change: upload `js/db.js`, any affected owner file, and the updated root `README.md`
- Main behaviour: upload `js/app.js` and the updated root `README.md`
- Artwork change: replace only the matching file in `assets/` plus the updated root `README.md`
- Layout/dialog change: upload `index.html` plus the updated root `README.md`

## Stable asset names

Do not rename these without updating `index.html` or CSS:

```text
assets/files-vault.png
assets/secure-vault.png
assets/home.png
assets/hide.png
assets/settings.png
```

## Data model

Database: `ghost-files-vault`  
Version: `1`

Stores:

- `files`
- `albums`
- `settings`

The initial system folder IDs are stable:

- `pinned`
- `private`

## GitHub Pages installation

1. Extract the ZIP.
2. Upload the contents to the repository root.
3. Ensure `index.html` is directly in the root.
4. Open **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Select `main` and `/ (root)`.
7. Save and wait for deployment.

## Navigation note

The current Home and Settings destinations use relative Ghost routes:

- Home: `../`
- Settings: `../settings/`

They can be changed later in `index.html` once the final Ghost repository routing is confirmed.

## Release history

### v0.1.1 — Startup & Navigation Fix

- Fixed a mobile IndexedDB transaction timing fault that could prevent startup
- Ensured Pinned and Private system folders can seed reliably
- Added clearer startup error reporting
- Aligned the Hide navigation icon with Home and Settings
- Preserved the existing database name, version and stored-data compatibility
- Changed only the owning JavaScript and CSS files

### v0.1 — Clean Foundation

- Created the first clean modular Files Vault
- Added transparent Files Vault branding
- Added Pinned and PIN-protected Private system folders
- Added custom folders
- Added multi-file upload with folder selection
- Added IndexedDB persistence
- Added common-format internal previews
- Added unsupported-format fallback handling
- Added move, delete and download actions
- Added search and sorting
- Added fixed Ghost navigation
- Added permanent clean-update and README rules
