import { putFiles } from "./db.js";

const FLIP_DURATION = 210;
const SETTLE_DURATION = 190;
const SWAP_LOCK_DURATION = 170;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function swapElements(first, second) {
  const parent = first.parentNode;
  if (!parent || parent !== second.parentNode || first === second) return;

  const marker = document.createComment("ghost-file-swap");
  parent.insertBefore(marker, first);
  parent.insertBefore(first, second);
  parent.insertBefore(second, marker);
  marker.remove();
}

export function createFileOrderController({
  list,
  notify = () => {},
  getFiles = () => [],
  onOrderChange = () => {},
  onSaveError = () => {},
}) {
  if (!(list instanceof HTMLElement)) {
    throw new TypeError("File ordering requires a valid file list.");
  }

  let dragSession = null;

  async function prepare(files) {
    const groups = new Map();

    for (const file of files) {
      if (!groups.has(file.albumId)) groups.set(file.albumId, []);
      groups.get(file.albumId).push(file);
    }

    const updates = [];
    const replacements = new Map();

    for (const group of groups.values()) {
      const ordered = [...group].sort((first, second) => {
        const firstHasOrder = Number.isFinite(first.fileOrder);
        const secondHasOrder = Number.isFinite(second.fileOrder);

        if (firstHasOrder && secondHasOrder) {
          const difference = first.fileOrder - second.fileOrder;
          if (difference !== 0) return difference;
        } else if (firstHasOrder !== secondHasOrder) {
          return firstHasOrder ? -1 : 1;
        }

        return second.createdAt - first.createdAt;
      });

      ordered.forEach((file, index) => {
        if (file.fileOrder === index) return;
        const replacement = { ...file, fileOrder: index };
        replacements.set(file.id, replacement);
        updates.push(replacement);
      });
    }

    if (updates.length) await putFiles(updates);

    return files.map(file => replacements.get(file.id) ?? file);
  }

  function prependOrders(files, albumId, count) {
    const albumOrders = files
      .filter(file => file.albumId === albumId && Number.isFinite(file.fileOrder))
      .map(file => file.fileOrder);
    const minimum = albumOrders.length ? Math.min(...albumOrders) : 0;
    const start = minimum - count;

    return Array.from({ length: count }, (_, index) => start + index);
  }

  function bind(card, file) {
    const handle = card.querySelector(".file-drag-handle");
    if (!handle) return;

    handle.dataset.fileId = file.id;
    handle.dataset.fileName = file.name;
    handle.addEventListener("pointerdown", startDrag);
    handle.addEventListener("keydown", handleKeyboardMove);
    handle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  function cards() {
    return [...list.children].filter(child => child.classList.contains("file-card"));
  }

  function capturePositions() {
    return new Map(cards().map(card => [
      card.dataset.fileId,
      card.getBoundingClientRect(),
    ]));
  }

  function animateFlip(previousPositions, target = null) {
    if (prefersReducedMotion()) return;

    for (const card of cards()) {
      if (card.classList.contains("file-card--drag-origin")) continue;

      const previous = previousPositions.get(card.dataset.fileId);
      if (!previous) continue;

      const current = card.getBoundingClientRect();
      const offsetX = previous.left - current.left;
      const offsetY = previous.top - current.top;
      if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) continue;

      card.getAnimations().forEach(animation => animation.cancel());
      card.animate([
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(.99)` },
        { transform: "translate3d(0, 0, 0) scale(1)" },
      ], {
        duration: FLIP_DURATION,
        easing: "cubic-bezier(.22,1,.36,1)",
      });
    }

    if (!target) return;
    target.classList.remove("file-card--swap-target");
    void target.offsetWidth;
    target.classList.add("file-card--swap-target");
    window.setTimeout(
      () => target.classList.remove("file-card--swap-target"),
      FLIP_DURATION
    );
  }

  function createGhost(card, bounds) {
    const ghost = card.cloneNode(true);
    ghost.classList.remove(
      "file-card--drag-origin",
      "file-card--swap-target",
      "file-card--drop-complete"
    );
    ghost.classList.add("file-card--drag-ghost");
    ghost.removeAttribute("data-file-id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${bounds.width}px`;
    ghost.style.height = `${bounds.height}px`;
    ghost.style.left = `${bounds.left}px`;
    ghost.style.top = `${bounds.top}px`;

    ghost.querySelectorAll("button").forEach(button => {
      button.tabIndex = -1;
      button.disabled = true;
    });

    document.body.append(ghost);
    return ghost;
  }

  function startDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const handle = event.currentTarget;
    const card = handle.closest(".file-card");
    if (!card || handle.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    cancel();

    const bounds = card.getBoundingClientRect();
    const ghost = createGhost(card, bounds);

    dragSession = {
      pointerId: event.pointerId,
      handle,
      card,
      ghost,
      width: bounds.width,
      height: bounds.height,
      originLeft: bounds.left,
      originTop: bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      previousY: event.clientY,
      translateX: 0,
      translateY: 0,
      animationFrame: 0,
      swapLockedUntil: 0,
      moved: false,
    };

    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Window listeners keep the drag active if pointer capture is unavailable.
    }

    handle.classList.add("is-dragging");
    card.classList.add("file-card--drag-origin");
    list.classList.add("is-reordering");
    document.body.classList.add("file-reorder-active");

    window.addEventListener("pointermove", handleDragMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    positionGhost();
  }

  function handleDragMove(event) {
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;

    event.preventDefault();
    dragSession.currentX = event.clientX;
    dragSession.currentY = event.clientY;

    if (dragSession.animationFrame) return;
    dragSession.animationFrame = requestAnimationFrame(() => {
      if (!dragSession) return;
      dragSession.animationFrame = 0;
      positionGhost();
      swapAtCentre();
    });
  }

  function positionGhost() {
    if (!dragSession) return;

    dragSession.translateX = dragSession.currentX - dragSession.startX;
    dragSession.translateY = dragSession.currentY - dragSession.startY;
    const movement = dragSession.currentY - dragSession.previousY;
    const tilt = Math.max(-1.2, Math.min(1.2, movement * .06));

    dragSession.ghost.style.transform = `translate3d(${dragSession.translateX}px, ${dragSession.translateY}px, 0) rotate(${tilt}deg) scale(1.018)`;
    dragSession.previousY = dragSession.currentY;
  }

  function draggedCentre() {
    return {
      x: dragSession.originLeft + dragSession.translateX + dragSession.width / 2,
      y: dragSession.originTop + dragSession.translateY + dragSession.height / 2,
    };
  }

  function findTarget() {
    if (!dragSession) return null;

    const centre = draggedCentre();
    const element = document.elementFromPoint(centre.x, centre.y);
    const card = element?.closest?.(".file-card");

    if (!card || card === dragSession.card || card.parentElement !== list) {
      return null;
    }

    return card;
  }

  function swapAtCentre() {
    if (!dragSession || performance.now() < dragSession.swapLockedUntil) return;

    const target = findTarget();
    if (!target) return;

    const previousPositions = capturePositions();
    swapElements(dragSession.card, target);
    dragSession.moved = true;
    dragSession.swapLockedUntil = performance.now() + SWAP_LOCK_DURATION;
    animateFlip(previousPositions, target);
  }

  function detachListeners() {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  }

  function pulseDrop(card) {
    if (prefersReducedMotion()) return;

    card.classList.remove("file-card--drop-complete");
    void card.offsetWidth;
    card.classList.add("file-card--drop-complete");
    window.setTimeout(
      () => card.classList.remove("file-card--drop-complete"),
      SETTLE_DURATION + 70
    );
  }

  function finishDrag(event) {
    if (!dragSession ||
      (event.pointerId !== undefined && event.pointerId !== dragSession.pointerId)) {
      return;
    }

    const session = dragSession;
    detachListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);

    try {
      session.handle.releasePointerCapture?.(session.pointerId);
    } catch {
      // Pointer capture may already have ended outside the window.
    }

    session.handle.classList.remove("is-dragging");
    list.classList.remove("is-reordering");
    document.body.classList.remove("file-reorder-active");

    const finalBounds = session.card.getBoundingClientRect();
    const finalTranslateX = finalBounds.left - session.originLeft;
    const finalTranslateY = finalBounds.top - session.originTop;

    const cleanup = () => {
      session.ghost.remove();
      session.card.classList.remove("file-card--drag-origin");
      pulseDrop(session.card);
    };

    if (prefersReducedMotion()) {
      cleanup();
    } else {
      session.ghost.classList.add("is-settling");
      requestAnimationFrame(() => {
        session.ghost.style.transform = `translate3d(${finalTranslateX}px, ${finalTranslateY}px, 0) rotate(0deg) scale(1)`;
        session.ghost.style.opacity = ".1";
      });
      window.setTimeout(cleanup, SETTLE_DURATION);
    }

    const moved = session.moved;
    dragSession = null;
    if (moved) void persistFromDom();
  }

  function cancel() {
    if (!dragSession) return;

    const session = dragSession;
    detachListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);
    session.handle.classList.remove("is-dragging");
    session.card.classList.remove("file-card--drag-origin");
    session.ghost.remove();
    list.classList.remove("is-reordering");
    document.body.classList.remove("file-reorder-active");
    dragSession = null;
  }

  async function persistFromDom() {
    const fileIds = cards().map(card => card.dataset.fileId);
    const fileById = new Map(getFiles().map(file => [file.id, file]));
    const updates = fileIds
      .map((fileId, index) => {
        const file = fileById.get(fileId);
        if (!file || file.fileOrder === index) return null;
        return { ...file, fileOrder: index };
      })
      .filter(Boolean);

    if (!updates.length) return;

    onOrderChange(updates);

    try {
      await putFiles(updates);
    } catch (error) {
      console.error("Ghost file order save error:", error);
      await onSaveError(error);
      notify("File order could not be saved");
    }
  }

  function handleKeyboardMove(event) {
    const card = event.currentTarget.closest(".file-card");
    const allCards = cards();
    const currentIndex = allCards.indexOf(card);
    if (!card || currentIndex < 0) return;

    let targetIndex = currentIndex;

    if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = allCards.length - 1;
    } else if (event.key === "ArrowUp") {
      targetIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "ArrowDown") {
      targetIndex = Math.min(allCards.length - 1, currentIndex + 1);
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (targetIndex === currentIndex) return;

    const previousPositions = capturePositions();
    const target = allCards[targetIndex];
    swapElements(card, target);
    animateFlip(previousPositions, target);
    void persistFromDom();

    const newPosition = cards().indexOf(card) + 1;
    notify(`${event.currentTarget.dataset.fileName} moved to ${newPosition} of ${cards().length}`);
  }

  return {
    prepare,
    prependOrders,
    bind,
    cancel,
  };
}
