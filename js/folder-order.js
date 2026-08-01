import { getSetting, setSetting } from "./db.js";

export const PINNED_ALBUM_ID = "pinned";
export const PRIVATE_ALBUM_ID = "private";

const ORDER_SETTING_KEY = "albumOrder";
const FLIP_DURATION = 260;
const SWAP_COOLDOWN = 140;

function sameStringArray(first, second) {
  return first.length === second.length &&
    first.every((value, index) => value === second[index]);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createFolderOrderController({
  grid,
  notify = () => {},
  onOrderChange = () => {},
  onSaveError = () => {},
}) {
  if (!(grid instanceof HTMLElement)) {
    throw new TypeError("Folder ordering requires a valid album grid.");
  }

  let albumOrder = [];
  let orderLoaded = false;
  let dragSession = null;

  function isReorderable(album) {
    return album.id !== PINNED_ALBUM_ID &&
      album.id !== PRIVATE_ALBUM_ID &&
      album.system !== true;
  }

  async function prepare(albums) {
    if (!orderLoaded) {
      const savedOrder = await getSetting(ORDER_SETTING_KEY);
      albumOrder = Array.isArray(savedOrder)
        ? savedOrder.filter(id => typeof id === "string")
        : [];
      orderLoaded = true;
    }

    const customIds = albums
      .filter(isReorderable)
      .sort((first, second) => first.createdAt - second.createdAt)
      .map(album => album.id);

    const availableIds = new Set(customIds);
    const seenIds = new Set();
    const preservedIds = albumOrder.filter(id => {
      if (!availableIds.has(id) || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    const missingIds = customIds.filter(id => !seenIds.has(id));
    const normalisedOrder = [...preservedIds, ...missingIds];

    if (!sameStringArray(albumOrder, normalisedOrder)) {
      albumOrder = normalisedOrder;
      await setSetting(ORDER_SETTING_KEY, albumOrder);
    }

    return sort(albums);
  }

  function sort(albums) {
    const positions = new Map(albumOrder.map((id, index) => [id, index]));

    return [...albums].sort((first, second) => {
      if (first.id === PINNED_ALBUM_ID) return -1;
      if (second.id === PINNED_ALBUM_ID) return 1;
      if (first.id === PRIVATE_ALBUM_ID) return 1;
      if (second.id === PRIVATE_ALBUM_ID) return -1;

      const firstPosition = positions.get(first.id) ?? Number.MAX_SAFE_INTEGER;
      const secondPosition = positions.get(second.id) ?? Number.MAX_SAFE_INTEGER;

      if (firstPosition !== secondPosition) return firstPosition - secondPosition;
      return first.createdAt - second.createdAt;
    });
  }

  function createHandle(card, album) {
    if (!isReorderable(album)) return null;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "album-drag-handle";
    handle.dataset.albumId = album.id;
    handle.setAttribute("aria-label", `Move ${album.name} folder`);
    handle.setAttribute("title", "Drag to reorder. Arrow keys also move this folder.");
    handle.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 8h12M6 12h12M6 16h12" />
      </svg>
    `;

    handle.addEventListener("pointerdown", startDrag);
    handle.addEventListener("keydown", handleKeyboardMove);
    handle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
    });

    return handle;
  }

  function allCards() {
    return [...grid.children].filter(child => child.classList.contains("album-card"));
  }

  function reorderableCards() {
    return allCards().filter(card => card.dataset.reorderable === "true");
  }

  function capturePositions() {
    return new Map(allCards().map(card => [
      card.dataset.albumId,
      card.getBoundingClientRect(),
    ]));
  }

  function animateFlip(previousPositions, pulseCard = null) {
    if (prefersReducedMotion()) return;

    for (const card of allCards()) {
      if (card.classList.contains("album-card--drag-origin")) continue;

      const previous = previousPositions.get(card.dataset.albumId);
      if (!previous) continue;

      const current = card.getBoundingClientRect();
      const offsetX = previous.left - current.left;
      const offsetY = previous.top - current.top;
      if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) continue;

      card.getAnimations().forEach(animation => animation.cancel());
      card.animate([
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ], {
        duration: FLIP_DURATION,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    }

    if (!pulseCard) return;

    pulseCard.classList.remove("album-card--swap-target");
    void pulseCard.offsetWidth;
    pulseCard.classList.add("album-card--swap-target");
    window.setTimeout(
      () => pulseCard.classList.remove("album-card--swap-target"),
      FLIP_DURATION
    );
  }

  function createDragGhost(card, bounds) {
    const ghost = card.cloneNode(true);
    ghost.classList.remove("album-card--drag-origin", "album-card--swap-target");
    ghost.classList.add("album-card--drag-ghost");
    ghost.removeAttribute("data-album-id");
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
    const card = handle.closest(".album-card");
    if (!card || card.dataset.reorderable !== "true") return;

    event.preventDefault();
    event.stopPropagation();
    cancel();

    const bounds = card.getBoundingClientRect();
    const ghost = createDragGhost(card, bounds);

    dragSession = {
      pointerId: event.pointerId,
      handle,
      card,
      ghost,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      currentX: event.clientX,
      currentY: event.clientY,
      previousX: event.clientX,
      animationFrame: 0,
      lastSwapAt: 0,
      moved: false,
    };

    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level listeners still keep the drag active.
    }

    handle.classList.add("is-dragging");
    card.classList.add("album-card--drag-origin");
    grid.classList.add("is-reordering");
    document.body.classList.add("album-reorder-active");

    window.addEventListener("pointermove", handleDragMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    positionDragGhost();
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
      positionDragGhost();
      reorderAtPointer();
    });
  }

  function positionDragGhost() {
    if (!dragSession) return;

    const left = dragSession.currentX - dragSession.offsetX;
    const top = dragSession.currentY - dragSession.offsetY;
    const movement = dragSession.currentX - dragSession.previousX;
    const tilt = Math.max(-2.4, Math.min(2.4, movement * .18));

    dragSession.ghost.style.left = `${left}px`;
    dragSession.ghost.style.top = `${top}px`;
    dragSession.ghost.style.transform = `rotate(${tilt}deg) scale(1.035)`;
    dragSession.previousX = dragSession.currentX;
  }

  function reorderAtPointer() {
    if (!dragSession) return;

    const pointedElement = document.elementFromPoint(
      dragSession.currentX,
      dragSession.currentY
    );
    const targetCard = pointedElement?.closest?.(
      '.album-card[data-reorderable="true"]'
    );

    if (!targetCard || targetCard === dragSession.card) return;

    const bounds = targetCard.getBoundingClientRect();
    const relativeX = (dragSession.currentX - bounds.left) / bounds.width;
    const relativeY = (dragSession.currentY - bounds.top) / bounds.height;
    const insideSwapZone =
      relativeX >= .18 && relativeX <= .82 &&
      relativeY >= .18 && relativeY <= .82;

    if (!insideSwapZone || performance.now() - dragSession.lastSwapAt < SWAP_COOLDOWN) {
      return;
    }

    const cards = reorderableCards();
    const currentIndex = cards.indexOf(dragSession.card);
    const targetIndex = cards.indexOf(targetCard);
    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return;

    const previousPositions = capturePositions();

    if (targetIndex > currentIndex) {
      targetCard.after(dragSession.card);
    } else {
      targetCard.before(dragSession.card);
    }

    dragSession.moved = true;
    dragSession.lastSwapAt = performance.now();
    animateFlip(previousPositions, targetCard);
  }

  function detachDragListeners() {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  }

  function finishDrag(event) {
    if (!dragSession ||
      (event.pointerId !== undefined && event.pointerId !== dragSession.pointerId)) {
      return;
    }

    const session = dragSession;
    detachDragListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);

    try {
      session.handle.releasePointerCapture?.(session.pointerId);
    } catch {
      // Pointer capture may already have ended outside the window.
    }

    session.handle.classList.remove("is-dragging");
    grid.classList.remove("is-reordering");
    document.body.classList.remove("album-reorder-active");

    const finalBounds = session.card.getBoundingClientRect();
    const cleanup = () => {
      session.ghost.remove();
      session.card.classList.remove("album-card--drag-origin");
    };

    if (prefersReducedMotion()) {
      cleanup();
    } else {
      session.ghost.classList.add("is-settling");
      requestAnimationFrame(() => {
        session.ghost.style.left = `${finalBounds.left}px`;
        session.ghost.style.top = `${finalBounds.top}px`;
        session.ghost.style.transform = "rotate(0deg) scale(1)";
        session.ghost.style.opacity = ".18";
      });
      window.setTimeout(cleanup, 190);
    }

    const moved = session.moved;
    dragSession = null;
    if (moved) void persistFromDom();
  }

  function cancel() {
    if (!dragSession) return;

    const session = dragSession;
    detachDragListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);
    session.handle.classList.remove("is-dragging");
    session.card.classList.remove("album-card--drag-origin");
    session.ghost.remove();
    grid.classList.remove("is-reordering");
    document.body.classList.remove("album-reorder-active");
    dragSession = null;
  }

  async function persistFromDom() {
    const previousOrder = [...albumOrder];
    const nextOrder = reorderableCards().map(card => card.dataset.albumId);
    if (sameStringArray(previousOrder, nextOrder)) return;

    albumOrder = nextOrder;
    onOrderChange(albumOrder);

    try {
      await setSetting(ORDER_SETTING_KEY, albumOrder);
    } catch (error) {
      console.error("Ghost folder order save error:", error);
      albumOrder = previousOrder;
      await onSaveError(error);
      notify("Folder order could not be saved");
    }
  }

  function handleKeyboardMove(event) {
    const directions = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    };

    const cards = reorderableCards();
    const card = event.currentTarget.closest(".album-card");
    const currentIndex = cards.indexOf(card);
    if (!card || currentIndex < 0) return;

    let targetIndex = currentIndex;

    if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = cards.length - 1;
    } else if (event.key in directions) {
      targetIndex = Math.max(
        0,
        Math.min(cards.length - 1, currentIndex + directions[event.key])
      );
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (targetIndex === currentIndex) return;

    const previousPositions = capturePositions();
    const targetCard = cards[targetIndex];

    if (targetIndex > currentIndex) {
      targetCard.after(card);
    } else {
      targetCard.before(card);
    }

    animateFlip(previousPositions, targetCard);
    void persistFromDom();

    const newPosition = reorderableCards().indexOf(card) + 1;
    const total = reorderableCards().length;
    notify(`${event.currentTarget.dataset.albumName} moved to ${newPosition} of ${total}`);
  }

  return {
    prepare,
    sort,
    isReorderable,
    createHandle(card, album) {
      const handle = createHandle(card, album);
      if (handle) handle.dataset.albumName = album.name;
      return handle;
    },
    cancel,
  };
}
