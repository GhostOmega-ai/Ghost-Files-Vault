# Ghost Files Vault v0.2.9 — Advanced Search & Smart Filters

## Changed files

- `index.html` — replaces the basic folder search toolbar with the complete search, filter and sort interface
- `css/files.css` — replaces the old search-toolbar styling with the responsive Ghost search system
- `js/app.js` — integrates asynchronous search, filters, progress, highlights and recently-opened state
- `js/document-viewer.js` — exposes supported document text to the search engine using the existing viewer loaders
- `js/file-card.js` — adds safe filename highlighting and content-match badges
- `js/utils.js` — adds File type, Smallest and Recently opened sorting
- `js/file-search.js` — new dedicated search engine
- `js/README.md` — updates module ownership
- `README.md` — updates the complete project documentation

## Included

- Search by filename, extension, type, MIME, size and date
- Quoted-phrase and accent-insensitive matching
- Supported document-content search across PDFs, Word files, spreadsheets, slides, text, Markdown, data, code, markup and archives
- Type filter chips: All, PDF, Word, Sheets, Slides, Text & Code, Archives, Images, Media, Apps and Pinned
- Date filters: Today, last 7 days, last 30 days, this year and older than a year
- Size filters: under 1 MB, 1–10 MB, 10–100 MB and 100 MB+
- Optional document-content searching
- Custom, Recently opened, File type, Largest and Smallest sorting
- Live progress/result status
- Filename match highlighting and document-content result badges
- Search cancellation, limited concurrency, extraction timeouts and in-memory caching
- Existing uploads, folders, multi-select, bulk actions, file ordering, Premium Viewer and document viewers preserved

## Clean replacement

The previous inline filename-only search path and old toolbar CSS were removed. Search now has one dedicated engine and one UI implementation rather than layered selectors or duplicate filtering functions.

## Suggested Git commit

```text
feat(file-vault): add advanced search and smart filters v0.2.9
```
