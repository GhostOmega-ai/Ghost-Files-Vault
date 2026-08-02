# Ghost Files Vault v0.2.6 — Ghost PDF & Document Viewer

## Changed files

- `js/document-viewer.js` — new dedicated document-rendering module
- `js/viewer.js` — updated preview routing and viewer integration
- `js/app.js` — updated viewer metadata and document-viewer wiring
- `css/files.css` — replaces the obsolete document fallback styling with the new Ghost document-viewer interface

## Included

- Native Ghost PDF canvas viewer with paging, fit-to-page and zoom controls
- DOCX and DOCM document rendering
- XLSX, XLS, XLSB, XLSM, ODS, CSV and TSV spreadsheet viewing with worksheet tabs
- PPTX, PPTM and ODP presentation viewing
- TXT, Markdown, JSON, HTML, XML, source-code and RTF viewing
- ODT and FODT support
- ZIP and EPUB inspection
- Readable-content recovery for legacy DOC and PPT files where the browser can safely extract text
- Safe internal inspection for unsupported binary formats instead of the former “preview support is coming” message
- Existing Premium Viewer image zoom, rename, pin, move, download, delete, upload workflow and folder organisation preserved
- Previous PDF iframe and obsolete generic fallback implementation removed rather than layered over

## Installation

Copy the four changed files into the matching locations in your local project:

```text
C:\Users\joeba\Documents\GitHub\Ghost-Files-Vault
```

Choose **Replace the file in the destination** for `viewer.js`, `app.js` and `files.css`. `document-viewer.js` is new and should be added to the existing `js` folder.

Refresh Chrome using `Ctrl + F5` after replacing the files.

## Suggested Git commit

```text
feat(file-vault): add Ghost PDF and document viewer v0.2.6
```
