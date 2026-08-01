# Ghost Files Vault v0.2.5 — Folder Organisation

## Install

Replace these files in the matching locations of your local project:

- `js/app.js`
- `js/folder-order.js` (new)
- `css/files.css`
- `js/README.md`
- `README.md`

## Features

- Pinned always remains first
- Private always remains last
- Custom folders display a three-line drag handle
- Smooth FLIP swap animation, lift glow and snap transition
- Mouse, trackpad and touchscreen pointer support
- Persistent order using the existing IndexedDB settings store
- Arrow-key, Home and End keyboard movement
- No database migration required
- Existing Upload UX, Folder Workspace and Premium Viewer preserved

## Quick test

1. Confirm Pinned has no handle and appears first.
2. Confirm Private has no handle and appears last.
3. Drag a custom folder over another custom folder.
4. Refresh Chrome and confirm the order remains.
5. Open a folder and confirm uploads and the Viewer still work.
