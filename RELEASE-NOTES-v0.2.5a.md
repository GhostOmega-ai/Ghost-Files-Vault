# Ghost Files Vault v0.2.5a — Folder Organisation Polish

This hotfix replaces the original pointer-centre swap detection with responsive drag-card overlap detection.

## Improvements

- The full target card is responsive, including its edges and three-line handle area.
- Direct pointer targets swap at a light 8% overlap, while a 30% full-card overlap provides a fallback when the pointer sits in a gap.
- Detection follows the dragged card as well as the mouse/finger, eliminating the old centre-only hotspot.
- Adds an early Ghost-purple magnetic target glow before a swap.
- Reduces the swap delay from 140 ms to 70 ms.
- Prevents immediate bounce-back against the folder that just moved.
- Uses transform-only ghost movement for smoother rendering.
- Shortens and refines the FLIP and settling animations.
- Keeps Pinned permanently first and Private permanently last.
- Preserves saved ordering, keyboard reordering and all existing File Vault features.

## Changed files

- `js/folder-order.js`
- `css/files.css`
