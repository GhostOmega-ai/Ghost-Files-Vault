# JavaScript modules

- `app.js` — app state, event wiring, folder flows and file actions
- `db.js` — IndexedDB schema and persistence
- `viewer.js` — file preview logic
- `utils.js` — formatting, sorting and shared helpers

Modify the module that owns the requested behaviour. Remove superseded logic instead of stacking patches. Every JavaScript release must include the updated complete root `README.md`.
