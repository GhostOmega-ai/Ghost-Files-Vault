# Ghost Files Vault

A mobile-first, privacy-focused file vault for the Ghost app ecosystem.

## Release

**v0.2 — Folder Artwork & File Controls**

This is the first clean-room Files Vault build. It is intentionally separated into focused files so future upgrades can replace only the area that changed.

## v0.2 update

- Replaced folder emoji with the approved transparent Ghost folder artwork
- Added separate transparent artwork for the permanent Pinned folder
- Kept the existing secure-vault artwork for Private
- Changed Pinned into a true virtual collection: pinned files remain in their original folder
- Prevented direct uploads and moves into Pinned
- Added Pin / Unpin and Rename controls to the file viewer
- Automatically unpins files moved into Private so they cannot appear outside the PIN-protected folder
- Added a Ghost-themed empty-folder state
- Preserved IndexedDB version 2 and all existing stored files

Changed files: `index.html`, `css/files.css`, `js/app.js`, `README.md`, `assets/folder.png`, and `assets/pinned-folder.png`.

No database, utility or preview module changes are required.

## v0.1.1 update

This focused repair changes only the files that own the affected behaviour:

- `js/db.js` — repairs IndexedDB transaction completion handling
- `js/app.js` — reports the real startup error if another fault occurs
- `css/files.css` — aligns Hide with Home and Settings

No HTML, viewer logic, utilities or assets are changed.

## v0.1.2 update

The Files Vault header now follows the approved Photo Vault layout:

- Files Vault ghost logo on the left
- `Files Vault` title on the right
- live file count beneath the title
- `+ File` and `+ Album` buttons directly underneath
- compact local-storage indicator below the header
- no oversized central logo or wasted empty header space

Changed files:

- `index.html`
- `css/files.css`
- `js/app.js`
- `README.md`

No database, viewer, utility or asset files are changed.

## v0.1.3 update

- Exact Photo Vault-style top bar with Back, `GHOST`, `File Vault`, and Information
- Files logo, folder summary, `+ File`, and `+ Folder` in the hero card
- Files, Folders, and Storage statistics underneath
- Photo Vault-style permanent navigation
- IndexedDB upgraded to version 2 so missing object stores are created and the startup error is repaired

Changed files: `index.html`, `css/files.css`, `js/app.js`, `js/db.js`, and `README.md`.

## v0.1.4 update

The Create Folder dialog has been refined without changing any database or folder logic:

- Replaced the basic browser-looking submit button with a full-width Ghost neon action
- Added pressed-state feedback
- Improved the folder-name input border, focus glow and spacing
- Added `enterkeyhint="done"` so supported Android keyboards show a Done action
- Enabled word capitalisation and spelling suggestions
- Kept the operating-system keyboard unchanged, because websites cannot reskin Android/Gboard

Changed files:

- `index.html`
- `css/files.css`
- `README.md`

## v0.1.5 update

- Removed the top-right close icon
- Added separate Cancel and Create buttons
- Cancel is now `type="button"`, so it closes without triggering required-field validation
- Create remains the only submit action
- Added clean dialog-close event wiring

Changed files: `index.html`, `css/files.css`, `js/app.js`, and `README.md`.

## v0.1.6 update

- Centred `GHOST` and `File Vault` against the full screen
- Fixed the Back button to the far left
- Fixed the Information button to the far right
- Prevented the File Vault title from wrapping
- Added a small-screen safeguard

Changed files: `index.html`, `css/files.css`, and `README.md`.

## Current features

- Approved Ghost Files Vault logo with a true transparent background
- `+ File` upload flow with destination-folder selection
- `+ Folder` custom folder creation
- Permanent **Pinned** collection that references files in their original folders
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
- Pin/Unpin, rename, download, move and permanent delete controls
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
│   ├── folder.png
│   ├── pinned-folder.png
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
assets/folder.png
assets/pinned-folder.png
assets/secure-vault.png
assets/home.png
assets/hide.png
assets/settings.png
```

## Data model

Database: `ghost-files-vault`  
Version: `2`

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

### v0.2 — Folder Artwork & File Controls

- Added true transparent normal and Pinned folder assets
- Converted Pinned from a destination folder into a non-duplicating virtual collection
- Added Pin, Unpin and Rename actions
- Protected Private by removing pinned status when files enter it
- Improved empty-folder presentation
- Preserved database compatibility

### v0.1.6 — Header Alignment

- Corrected the main header alignment
- Anchored Back and Information to opposite edges
- Kept the title perfectly centred
- Changed only header structure and CSS


### v0.1.5 — Create Folder Actions Fix

- Replaced the close icon with Cancel and Create actions
- Fixed the unwanted “Please fill in this field” message when cancelling
- Preserved existing folder creation and database behaviour


### v0.1.4 — Create Folder Dialog Polish

- Added a Ghost-themed Create Folder action button
- Improved input focus styling
- Added mobile keyboard hints and word capitalisation
- Changed only the dialog structure and owning CSS


### v0.1.3 — Photo Vault Replica & Database Repair

- Replicated the approved Photo Vault top structure
- Added Back and Information buttons
- Added live file, folder, and storage statistics
- Changed `+ Album` to `+ Folder`
- Matched the permanent bottom navigation
- Raised IndexedDB from version 1 to 2 to repair incomplete databases
- Kept the modular update structure intact


### v0.1.2 — Photo-Style Header

- Rebuilt the top area to match the approved Photo Vault design
- Positioned the Files Vault logo beside the title
- Added a live file count below the title
- Placed `+ File` and `+ Album` beneath the identity row
- Reduced wasted vertical space
- Retained the compact storage indicator
- Changed only the files that own layout, styling and count rendering


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
