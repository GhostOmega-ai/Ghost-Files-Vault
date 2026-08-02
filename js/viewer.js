import { renderDocumentPreview, releaseDocumentPreview } from "./document-viewer.js";

const IMAGE_ZOOM = Object.freeze({
  minScale: 1,
  maxScale: 6,
  doubleClickScale: 2.5,
  wheelSensitivity: 0.0015,
  doubleTapDelay: 320,
  doubleTapDistance: 28,
});

const previewControllers = new WeakMap();

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function createObjectUrl(container, blob) {
  const objectUrl = URL.createObjectURL(blob);
  container.dataset.objectUrl = objectUrl;
  return objectUrl;
}

export async function renderPreview(container, fileRecord) {
  releasePreview(container);

  const { blob, name } = fileRecord;
  const type = fileRecord.type || "";

  if (type.startsWith("image/")) {
    renderImagePreview(container, fileRecord, createObjectUrl(container, blob));
    return;
  }

  if (type.startsWith("video/")) {
    container.dataset.previewKind = "video";
    const video = document.createElement("video");
    video.src = createObjectUrl(container, blob);
    video.controls = true;
    video.playsInline = true;
    container.append(video);
    return;
  }

  if (type.startsWith("audio/")) {
    container.dataset.previewKind = "audio";
    const audio = document.createElement("audio");
    audio.src = createObjectUrl(container, blob);
    audio.controls = true;
    container.append(audio);
    return;
  }

  await renderDocumentPreview(container, fileRecord);
}

function renderImagePreview(container, fileRecord, objectUrl) {
  container.dataset.previewKind = "image";

  const stage = document.createElement("div");
  stage.className = "viewer-zoom-stage";
  stage.tabIndex = 0;
  stage.setAttribute("role", "group");
  stage.setAttribute(
    "aria-label",
    "Zoomable image preview. Double-click or double-tap to zoom. Pinch or use the mouse wheel for precise zoom."
  );

  const image = document.createElement("img");
  image.className = "viewer-zoom-image";
  image.src = objectUrl;
  image.alt = fileRecord.name;
  image.draggable = false;

  const hint = document.createElement("div");
  hint.className = "viewer-zoom-hint";
  hint.setAttribute("aria-hidden", "true");
  hint.textContent = matchMedia("(pointer: coarse)").matches
    ? "Double-tap or pinch to zoom"
    : "Double-click or scroll to zoom";

  const level = document.createElement("div");
  level.className = "viewer-zoom-level";
  level.setAttribute("aria-hidden", "true");
  level.textContent = "100%";

  stage.append(image, hint, level);
  container.append(stage);

  const controller = createImageZoomController(stage, image, hint, level);
  previewControllers.set(container, controller);

  const markReady = () => {
    stage.classList.add("is-ready");
    controller.refresh();
    controller.showHint();
  };

  if (image.complete) {
    requestAnimationFrame(markReady);
  } else {
    image.addEventListener("load", markReady, { once: true });
  }
}

function createImageZoomController(stage, image, hint, level) {
  const abortController = new AbortController();
  const { signal } = abortController;
  const pointers = new Map();

  let scale = IMAGE_ZOOM.minScale;
  let translateX = 0;
  let translateY = 0;
  let panGesture = null;
  let pinchGesture = null;
  let lastTap = null;
  let hintTimer = 0;
  let levelTimer = 0;
  let touchZoomAt = Number.NEGATIVE_INFINITY;

  function localPoint(clientX, clientY) {
    const bounds = stage.getBoundingClientRect();
    return {
      x: clientX - bounds.left - bounds.width / 2,
      y: clientY - bounds.top - bounds.height / 2,
    };
  }

  function panLimits(nextScale = scale) {
    const imageWidth = image.offsetWidth || stage.clientWidth;
    const imageHeight = image.offsetHeight || stage.clientHeight;

    return {
      x: Math.max(0, (imageWidth * nextScale - stage.clientWidth) / 2),
      y: Math.max(0, (imageHeight * nextScale - stage.clientHeight) / 2),
    };
  }

  function constrainTranslation() {
    if (scale <= IMAGE_ZOOM.minScale + 0.001) {
      scale = IMAGE_ZOOM.minScale;
      translateX = 0;
      translateY = 0;
      return;
    }

    const limits = panLimits();
    translateX = clamp(translateX, -limits.x, limits.x);
    translateY = clamp(translateY, -limits.y, limits.y);
  }

  function showZoomLevel() {
    clearTimeout(levelTimer);
    level.textContent = `${Math.round(scale * 100)}%`;
    level.classList.add("is-visible");
    levelTimer = window.setTimeout(() => level.classList.remove("is-visible"), 760);
  }

  function hideHint() {
    clearTimeout(hintTimer);
    stage.classList.remove("is-hint-visible");
  }

  function showHint() {
    hideHint();
    stage.classList.add("is-hint-visible");
    hintTimer = window.setTimeout(hideHint, 3000);
  }

  function markInteracted() {
    hideHint();
    stage.classList.add("has-interacted");
  }

  function applyTransform({ announce = false } = {}) {
    constrainTranslation();

    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    stage.dataset.scale = scale.toFixed(3);
    stage.dataset.translateX = translateX.toFixed(2);
    stage.dataset.translateY = translateY.toFixed(2);
    stage.classList.toggle("is-zoomed", scale > IMAGE_ZOOM.minScale + 0.01);

    if (announce) showZoomLevel();
  }

  function zoomAt(clientX, clientY, requestedScale, announce = true) {
    const nextScale = clamp(
      requestedScale,
      IMAGE_ZOOM.minScale,
      IMAGE_ZOOM.maxScale
    );
    const point = localPoint(clientX, clientY);
    const imagePointX = (point.x - translateX) / scale;
    const imagePointY = (point.y - translateY) / scale;

    scale = nextScale;
    translateX = point.x - imagePointX * scale;
    translateY = point.y - imagePointY * scale;
    applyTransform({ announce });
  }

  function reset(announce = true) {
    scale = IMAGE_ZOOM.minScale;
    translateX = 0;
    translateY = 0;
    applyTransform({ announce });
  }

  function toggleZoom(clientX, clientY) {
    markInteracted();

    if (scale > IMAGE_ZOOM.minScale + 0.08) {
      reset();
      return;
    }

    zoomAt(clientX, clientY, IMAGE_ZOOM.doubleClickScale);
  }

  function startPan(pointerId) {
    const pointer = pointers.get(pointerId);
    if (!pointer || scale <= IMAGE_ZOOM.minScale + 0.01) {
      panGesture = null;
      return;
    }

    panGesture = {
      pointerId,
      startX: pointer.x,
      startY: pointer.y,
      originX: translateX,
      originY: translateY,
    };
    stage.classList.add("is-dragging");
  }

  function startPinch() {
    const activePointers = [...pointers.values()].slice(0, 2);
    if (activePointers.length < 2) return;

    const startDistance = distanceBetween(activePointers[0], activePointers[1]);
    if (startDistance < 1) return;

    const center = midpoint(activePointers[0], activePointers[1]);
    const point = localPoint(center.x, center.y);

    pinchGesture = {
      startDistance,
      startScale: scale,
      imagePointX: (point.x - translateX) / scale,
      imagePointY: (point.y - translateY) / scale,
    };
    panGesture = null;
    stage.classList.remove("is-dragging");
    stage.classList.add("is-pinching");
  }

  function updatePinch() {
    const activePointers = [...pointers.values()].slice(0, 2);
    if (activePointers.length < 2) return;
    if (!pinchGesture) startPinch();
    if (!pinchGesture) return;

    const currentDistance = distanceBetween(activePointers[0], activePointers[1]);
    const center = midpoint(activePointers[0], activePointers[1]);
    const point = localPoint(center.x, center.y);

    scale = clamp(
      pinchGesture.startScale * (currentDistance / pinchGesture.startDistance),
      IMAGE_ZOOM.minScale,
      IMAGE_ZOOM.maxScale
    );
    translateX = point.x - pinchGesture.imagePointX * scale;
    translateY = point.y - pinchGesture.imagePointY * scale;
    applyTransform({ announce: true });
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    markInteracted();
    stage.focus({ preventScroll: true });

    const pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    pointers.set(event.pointerId, pointer);

    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events and older browsers may not expose pointer capture.
    }

    stage.classList.add("is-interacting");

    if (pointers.size >= 2) {
      startPinch();
    } else {
      startPan(event.pointerId);
    }
  }

  function onPointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved ||= Math.hypot(
      pointer.x - pointer.startX,
      pointer.y - pointer.startY
    ) > 5;

    if (pointers.size >= 2) {
      updatePinch();
      return;
    }

    if (panGesture?.pointerId !== event.pointerId || scale <= IMAGE_ZOOM.minScale) {
      return;
    }

    translateX = panGesture.originX + event.clientX - panGesture.startX;
    translateY = panGesture.originY + event.clientY - panGesture.startY;
    applyTransform({ announce: true });
  }

  function finishPointer(event, cancelled = false) {
    const pointer = pointers.get(event.pointerId);
    const wasPinching = Boolean(pinchGesture) || pointers.size > 1;

    pointers.delete(event.pointerId);

    try {
      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture is optional for the gesture to complete correctly.
    }

    if (pointers.size >= 2) {
      startPinch();
    } else if (pointers.size === 1) {
      pinchGesture = null;
      stage.classList.remove("is-pinching");
      startPan([...pointers.keys()][0]);
    } else {
      panGesture = null;
      pinchGesture = null;
      stage.classList.remove("is-interacting", "is-dragging", "is-pinching");
      applyTransform();
    }

    if (
      cancelled ||
      !pointer ||
      pointer.moved ||
      wasPinching ||
      event.pointerType === "mouse"
    ) {
      return;
    }

    const now = performance.now();
    const tap = { time: now, x: event.clientX, y: event.clientY };

    if (
      lastTap &&
      now - lastTap.time <= IMAGE_ZOOM.doubleTapDelay &&
      distanceBetween(lastTap, tap) <= IMAGE_ZOOM.doubleTapDistance
    ) {
      lastTap = null;
      touchZoomAt = now;
      toggleZoom(event.clientX, event.clientY);
      return;
    }

    lastTap = tap;
  }

  function onDoubleClick(event) {
    if (event.sourceCapabilities?.firesTouchEvents) return;
    if (performance.now() - touchZoomAt < 450) return;

    event.preventDefault();
    toggleZoom(event.clientX, event.clientY);
  }

  function onWheel(event) {
    event.preventDefault();
    markInteracted();

    const zoomFactor = Math.exp(-event.deltaY * IMAGE_ZOOM.wheelSensitivity);
    zoomAt(event.clientX, event.clientY, scale * zoomFactor);
  }

  function onKeyDown(event) {
    const bounds = stage.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    if (["+", "="].includes(event.key)) {
      event.preventDefault();
      markInteracted();
      zoomAt(centerX, centerY, scale * 1.25);
    } else if (["-", "_"].includes(event.key)) {
      event.preventDefault();
      markInteracted();
      zoomAt(centerX, centerY, scale / 1.25);
    } else if (event.key === "0") {
      event.preventDefault();
      markInteracted();
      reset();
    }
  }

  stage.addEventListener("pointerdown", onPointerDown, { signal });
  stage.addEventListener("pointermove", onPointerMove, { signal });
  stage.addEventListener("pointerup", event => finishPointer(event), { signal });
  stage.addEventListener("pointercancel", event => finishPointer(event, true), { signal });
  stage.addEventListener("lostpointercapture", event => {
    if (pointers.has(event.pointerId)) finishPointer(event, true);
  }, { signal });
  stage.addEventListener("dblclick", onDoubleClick, { signal });
  stage.addEventListener("wheel", onWheel, { passive: false, signal });
  stage.addEventListener("keydown", onKeyDown, { signal });
  stage.addEventListener("contextmenu", event => event.preventDefault(), { signal });

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(() => applyTransform())
    : null;
  resizeObserver?.observe(stage);
  resizeObserver?.observe(image);

  applyTransform();

  return {
    refresh() {
      applyTransform();
    },
    showHint,
    destroy() {
      clearTimeout(hintTimer);
      clearTimeout(levelTimer);
      resizeObserver?.disconnect();
      abortController.abort();
      pointers.clear();
      image.style.removeProperty("transform");
    },
  };
}

export function releasePreview(container) {
  releaseDocumentPreview(container);

  const controller = previewControllers.get(container);
  if (controller) {
    controller.destroy();
    previewControllers.delete(container);
  }

  const objectUrl = container.dataset.objectUrl;
  if (objectUrl) URL.revokeObjectURL(objectUrl);

  delete container.dataset.objectUrl;
  delete container.dataset.previewKind;
  container.replaceChildren();
}
