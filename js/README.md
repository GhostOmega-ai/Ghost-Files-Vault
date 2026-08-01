# JavaScript modules

- `app.js` — app state, event wiring, folder flows and file actions
- `folder-order.js` — fixed system-folder positions, persistent custom-folder ordering and drag/keyboard movement
- `db.js` — IndexedDB schema and persistence
- `viewer.js` — file preview, Viewer 2.0 and image gesture logic
- `utils.js` — formatting, sorting and shared helpers

Modify the module that owns the requested behaviour. Remove superseded logic instead of stacking patches. Every JavaScript release must include the updated complete root `README.md`.
