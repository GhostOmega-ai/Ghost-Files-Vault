# Ghost Files Vault v0.2.7 — Premium File Cards

## Included

- Replaced emoji file icons with a transparent, scalable Ghost SVG icon family.
- Added dedicated visual identities for PDF, Word, spreadsheets, presentations, archives,
  Markdown, data, databases, code, text, images, video, audio, applications and generic files.
- Added compact file-type badges, cleaner size information and relative dates such as
  `Today`, `Yesterday` and `3 days ago`.
- Redesigned file cards with improved hierarchy, spacing, responsive sizing and restrained
  file-type glows that remain consistent with the Ghost theme.
- Long filenames are safely contained with an ellipsis. The full filename is available by
  hovering on desktop or long-pressing on touchscreens.
- Added smoother hover, press, focus and selected-card feedback.
- Improved Select mode with a clear circular selector and animated check state.
- Preserved search, sorting, direct-folder uploads, folder ordering, Viewer 2.0,
  Premium Viewer gestures, Ghost PDF/Document Viewer and all existing file actions.

## Clean-code changes

- Added `js/file-card.js` as the single owner of file-card construction and touch feedback.
- Added `js/file-types.js` as the single owner of file classification, labels and SVG icons.
- Removed obsolete emoji/icon/type logic from `js/viewer.js`.
- Removed the duplicate filename-extension helper from `js/document-viewer.js` and reused
  the shared helper from `js/file-types.js`.
- Replaced the previous file-card CSS component rather than layering overrides over it.
- Cached date formatters and added one shared relative-date formatter in `js/utils.js`.

## Changed files

- `css/files.css`
- `js/app.js`
- `js/viewer.js`
- `js/document-viewer.js`
- `js/utils.js`

## New files

- `js/file-card.js`
- `js/file-types.js`
