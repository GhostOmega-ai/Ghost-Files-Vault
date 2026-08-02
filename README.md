# Ghost Files Vault

A mobile-first, privacy-focused document vault for the Ghost app ecosystem.

## Current release

**v0.2.9 — Advanced Search & Smart Filters**

This release replaces the former filename-only search with one coordinated search system for file metadata, supported document contents, smart filters and expanded sorting. The search engine is isolated in `js/file-search.js`; obsolete inline search logic was removed from `app.js` rather than retained as a second implementation.

## v0.2.9 highlights

- Searches file names, extensions, type labels, MIME types, sizes and dates
- Supports quoted phrases and case/accent-insensitive matching
- Searches readable content inside supported PDFs, Word documents, spreadsheets, presentations, text, Markdown, JSON, code, markup and archives
- Adds one-tap Ghost filter chips for PDF, Word, Sheets, Slides, Text & Code, Archives, Images, Media, Apps and Pinned
- Adds date and size filters
- Adds a switch for document-content search
- Adds Custom, Recently opened, File type, Largest and Smallest sorting
- Records the last-opened time when a file is viewed
- Highlights matching words in file names
- Marks results found through document contents
- Shows live search progress and result counts
- Keeps multi-select, bulk operations, custom file ordering, folder ordering, uploads and all viewers intact
- Uses cancellation, concurrency limits, extraction timeouts and an in-memory cache to keep content searches responsive

## Current features

### Folders and organisation

- Permanent **Pinned** folder fixed first
- Permanent PIN-protected **Private** folder fixed last
- Custom folder creation
- Persistent drag-and-drop folder ordering
- Direct upload into the currently open folder
- Destination picker when uploading from the File Vault home screen

### Files

- Premium Ghost file cards with type-specific scalable icons
- Long-filename containment and full-name reveal
- Custom file ordering with drag handles
- Multi-select, Select All and Clear All
- Bulk Pin/Unpin, Move and Delete
- Search, smart filters and expanded sorting

### Viewer

- Premium Ghost viewer shell
- Rename, Pin/Unpin, Move, Download and Delete
- Close using the button, Escape or the backdrop
- Image double-click/double-tap zoom, wheel zoom, pinch zoom and drag while zoomed
- Built-in viewing for PDF, DOCX/DOCM, spreadsheets, presentations, ODT/FODT, text, Markdown, JSON, HTML/XML, source code, RTF, ZIP/EPUB inspection and readable legacy DOC/PPT content

### Storage

- Local IndexedDB persistence
- Database versioning and transaction helpers
- Files remain local to the current browser/device until a future backup or sync feature is added

## Temporary Private PIN

```text
1234
```

The PIN is stored locally in IndexedDB. PIN management belongs to a later whole-app security release.

## Structure

```text
Ghost-Files-Vault/
├── index.html
├── README.md
├── assets/
├── css/
│   ├── README.md
│   └── files.css
└── js/
    ├── README.md
    ├── app.js
    ├── db.js
    ├── document-viewer.js
    ├── file-card.js
    ├── file-order.js
    ├── file-search.js
    ├── file-types.js
    ├── folder-order.js
    ├── utils.js
    └── viewer.js
```

## Module ownership

- `index.html` — semantic page, search controls and dialogs
- `css/files.css` — complete File Vault styling and responsive behaviour
- `js/app.js` — application state, event wiring and feature orchestration
- `js/db.js` — IndexedDB persistence only
- `js/document-viewer.js` — document rendering and searchable-text extraction
- `js/file-card.js` — premium file-card construction and search highlighting
- `js/file-order.js` — persistent file ordering
- `js/file-search.js` — metadata/content search, filters, progress and cache
- `js/file-types.js` — single source of truth for file classification and icons
- `js/folder-order.js` — fixed system-folder positions and custom-folder movement
- `js/utils.js` — shared formatting, identifiers, sorting and toast helpers
- `js/viewer.js` — viewer routing and image gesture lifecycle

## Clean update policy

Every update must:

1. Modify the owning module instead of layering a second implementation.
2. Remove superseded selectors, listeners and functions in the same release.
3. Avoid duplicate rendering, search, ordering or database logic.
4. Preserve IndexedDB compatibility unless a documented migration is included.
5. Ship only files genuinely changed by the release.
6. Test uploads, Private access, search, sorting, selection, ordering and previews before release.

## Release history

- **v0.2.9** — Advanced Search & Smart Filters
- **v0.2.8** — Bulk Operations & File Ordering
- **v0.2.7** — Premium File Cards
- **v0.2.6** — Ghost PDF & Document Viewer
- **v0.2.5** — Folder Organisation
- **v0.2.4** — Premium Viewer zoom and gestures
- **v0.2.3** — Ghost Viewer 2.0
- **v0.2.2** — Compact Folder Workspace
- **v0.2.1** — Direct-folder Upload UX
- **v0.2.0** — Consolidated foundation
