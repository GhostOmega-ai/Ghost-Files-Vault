# Ghost Files Vault v0.2.8 — Bulk Operations & File Ordering

## Added

- Full multi-select mode from the existing **Select** button.
- Touchscreen long-press and desktop Ctrl/Cmd/Shift-click selection.
- **Select all** and **Clear all** controls.
- Live selected-file count above the folder title.
- Ghost-themed bulk action bar for:
  - Pin / Unpin
  - Move
  - Delete
- Multi-file move confirmation and Private-folder PIN protection.
- Multi-file delete confirmation with linked Pinned copies cleaned up safely.
- Persistent custom file ordering inside every folder.
- Three-line drag handles for one-file-at-a-time reordering.
- Smooth FLIP swap, drag lift, target pulse and drop animations.
- Keyboard reordering with Arrow Up, Arrow Down, Home and End.
- New **Custom order** sort mode, selected automatically when a folder opens.

## Changed

- Newly uploaded, moved and pinned files are inserted cleanly at the top of their destination's custom order.
- File cards now use a semantic outer card, dedicated open button and independent drag handle.
- Search and sort controls pause while Select mode is active to prevent hidden selections.
- The normal Ghost navigation bar is temporarily replaced by bulk actions during Select mode.
- Single and bulk Move/Delete actions now share the same clean action pipeline.
- Rename operations now save related original and Pinned records in one transaction.
- File ordering is isolated in the dedicated `js/file-order.js` module.
- Batch database helpers were added for safer multi-file updates and deletes.

## Preserved

- Direct upload into the current folder.
- Fixed Pinned and Private folder positions.
- Folder organisation.
- Premium File Cards.
- Premium Viewer gestures.
- Ghost PDF and Document Viewer.
- Rename, Pin, Move, Download and Delete viewer actions.

## Notes

- Drag handles appear while **Custom order** is selected and the folder search is clear.
- Other sort modes remain available and do not overwrite the saved custom order.
