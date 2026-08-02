# JavaScript modules

- `app.js` — application state, event wiring and feature orchestration
- `db.js` — IndexedDB schema, transactions and persistence
- `document-viewer.js` — Ghost document rendering and searchable-text extraction
- `file-card.js` — premium file-card creation, metadata and search highlighting
- `file-order.js` — persistent custom ordering inside folders
- `file-search.js` — metadata/content search, filters, cancellation, progress and cache
- `file-types.js` — central file classification, labels and icons
- `folder-order.js` — fixed Pinned/Private placement and custom-folder movement
- `utils.js` — formatting, identifiers, sorting and shared helpers
- `viewer.js` — viewer routing, image gestures and preview cleanup

Keep one owner for each responsibility. Remove superseded logic rather than stacking patches or duplicate listeners.
