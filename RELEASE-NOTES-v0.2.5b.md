# Ghost Files Vault v0.2.5b — One-for-One Folder Swaps

## Changed files

- `js/folder-order.js`
- `css/files.css`

## Improvements

- Replaced insertion/cascade reordering with stable one-for-one swaps.
- Only the dragged custom folder and the single folder underneath its centre exchange positions.
- Nearby folders no longer compete or move together when the dragged folder sits between them.
- Dragging back over the previous position swaps the folders back cleanly.
- Each swap fully settles before another can occur; a held destination is rechecked automatically, so no wiggle is required.
- Removed obsolete multi-target magnetic detection and its unused styling.
- Pinned remains permanently first and Private remains permanently last.
- Persistent order, keyboard movement, upload behaviour and Premium Viewer remain unchanged.
