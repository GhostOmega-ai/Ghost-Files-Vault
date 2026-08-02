import { getSetting, setSetting } from "./db.js";

export const PINNED_ALBUM_ID = "pinned";
export const PRIVATE_ALBUM_ID = "private";

const ORDER_SETTING_KEY = "albumOrder";
const FLIP_DURATION = 230;
const SETTLE_DURATION = 210;
const SWAP_LOCK_DURATION = FLIP_DURATION;

function sameStringArray(first, second) {
  return first.length === second.length &&
    first.every((value, index) => value === second[index]);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function swapCards(firstCard, secondCard) {
  const parent = firstCard.parentNode;
  if (!parent || parent !== secondCard.parentNode || firstCard === secondCard) return;

  const marker = document.createComment("ghost-folder-swap");
  parent.insertBefore(marker, firstCard);
  parent.insertBefore(firstCard, secondCard);
  parent.insertBefore(secondCard, marker);
  marker.remove();
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
    handle.setAttribute(
      "title",
      "Drag directly over another custom folder to swap their positions."
    );
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
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(.99)` },
        { transform: "translate3d(0, 0, 0) scale(1)" },
      ], {
        duration: FLIP_DURATION,
        easing: "cubic-bezier(.22,1,.36,1)",
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
    ghost.classList.remove(
      "album-card--drag-origin",
      "album-card--swap-target",
      "album-card--drop-complete"
    );
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
      width: bounds.width,
      height: bounds.height,
      originLeft: bounds.left,
      originTop: bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      previousX: event.clientX,
      translateX: 0,
      translateY: 0,
      animationFrame: 0,
      swapTimer: 0,
      swapLockedUntil: 0,
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
      swapAtDraggedCentre();
    });
  }

  function positionDragGhost() {
    if (!dragSession) return;

    dragSession.translateX = dragSession.currentX - dragSession.startX;
    dragSession.translateY = dragSession.currentY - dragSession.startY;

    const movement = dragSession.currentX - dragSession.previousX;
    const tilt = Math.max(-1.6, Math.min(1.6, movement * .1));

    dragSession.ghost.style.transform = `translate3d(${dragSession.translateX}px, ${dragSession.translateY}px, 0) rotate(${tilt}deg) scale(1.035)`;
    dragSession.previousX = dragSession.currentX;
  }

  function draggedCentre() {
    return {
      x: dragSession.originLeft + dragSession.translateX + dragSession.width / 2,
      y: dragSession.originTop + dragSession.translateY + dragSession.height / 2,
    };
  }

  function findSwapTarget() {
    if (!dragSession) return null;

    const centre = draggedCentre();
    const element = document.elementFromPoint(centre.x, centre.y);
    const card = element?.closest?.(".album-card");

    if (!card ||
      card === dragSession.card ||
      card.parentElement !== grid ||
      card.dataset.reorderable !== "true") {
      return null;
    }

    return card;
  }

  function scheduleSwapCheck() {
    if (!dragSession) return;

    window.clearTimeout(dragSession.swapTimer);
    const delay = Math.max(0, dragSession.swapLockedUntil - performance.now());
    dragSession.swapTimer = window.setTimeout(() => {
      if (!dragSession) return;
      dragSession.swapTimer = 0;
      swapAtDraggedCentre();
    }, delay + 8);
  }

  function swapAtDraggedCentre() {
    if (!dragSession) return;

    if (performance.now() < dragSession.swapLockedUntil) {
      scheduleSwapCheck();
      return;
    }

    const targetCard = findSwapTarget();
    if (!targetCard) return;

    const previousPositions = capturePositions();
    swapCards(dragSession.card, targetCard);

    dragSession.moved = true;
    dragSession.swapLockedUntil = performance.now() + SWAP_LOCK_DURATION;
    animateFlip(previousPositions, targetCard);
    scheduleSwapCheck();
  }

  function detachDragListeners() {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  }

  function pulseDropComplete(card) {
    if (prefersReducedMotion()) return;

    card.classList.remove("album-card--drop-complete");
    void card.offsetWidth;
    card.classList.add("album-card--drop-complete");
    window.setTimeout(
      () => card.classList.remove("album-card--drop-complete"),
      SETTLE_DURATION + 80
    );
  }

  function finishDrag(event) {
    if (!dragSession ||
      (event.pointerId !== undefined && event.pointerId !== dragSession.pointerId)) {
      return;
    }

    const session = dragSession;
    detachDragListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);
    window.clearTimeout(session.swapTimer);

    try {
      session.handle.releasePointerCapture?.(session.pointerId);
    } catch {
      // Pointer capture may already have ended outside the window.
    }

    session.handle.classList.remove("is-dragging");
    grid.classList.remove("is-reordering");
    document.body.classList.remove("album-reorder-active");

    const finalBounds = session.card.getBoundingClientRect();
    const finalTranslateX = finalBounds.left - session.originLeft;
    const finalTranslateY = finalBounds.top - session.originTop;

    const cleanup = () => {
      session.ghost.remove();
      session.card.classList.remove("album-card--drag-origin");
      pulseDropComplete(session.card);
    };

    if (prefersReducedMotion()) {
      cleanup();
    } else {
      session.ghost.classList.add("is-settling");
      requestAnimationFrame(() => {
        session.ghost.style.transform = `translate3d(${finalTranslateX}px, ${finalTranslateY}px, 0) rotate(0deg) scale(1)`;
        session.ghost.style.opacity = ".12";
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
    detachDragListeners();
    if (session.animationFrame) cancelAnimationFrame(session.animationFrame);
    window.clearTimeout(session.swapTimer);
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
    swapCards(card, targetCard);

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
