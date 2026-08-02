import { getFilePresentation } from "./file-types.js";
import { formatBytes, formatRelativeDate } from "./utils.js";

const CHEVRON_ICON = `
  <svg class="file-card__chevron-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
`;

const CHECK_ICON = `
  <svg class="file-card__check-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6.5 12.5 3.5 3.5 7.5-8" />
  </svg>
`;

const DRAG_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 8h10M7 12h10M7 16h10" />
  </svg>
`;

function attachLongPress(button, callback) {
  if (typeof callback !== "function") return;

  const holdDelay = 520;
  const movementTolerance = 10;
  let timer = 0;
  let startPoint = null;
  let suppressNextClick = false;

  function clearHold() {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    startPoint = null;
  }

  button.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || event.button !== 0) return;

    startPoint = { x: event.clientX, y: event.clientY };
    suppressNextClick = false;
    timer = window.setTimeout(() => {
      timer = 0;
      suppressNextClick = true;
      button.closest(".file-card")?.classList.add("file-card--long-press");
      callback();
      window.setTimeout(
        () => button.closest(".file-card")?.classList.remove("file-card--long-press"),
        260
      );
    }, holdDelay);
  });

  button.addEventListener("pointermove", event => {
    if (!startPoint) return;

    const moved = Math.hypot(
      event.clientX - startPoint.x,
      event.clientY - startPoint.y
    );

    if (moved > movementTolerance) clearHold();
  });

  button.addEventListener("pointerup", clearHold);
  button.addEventListener("pointerleave", clearHold);
  button.addEventListener("pointercancel", () => {
    clearHold();
    suppressNextClick = false;
  });
  button.addEventListener("contextmenu", event => event.preventDefault());

  button.addEventListener("click", event => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
}


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendHighlightedName(element, value, terms) {
  const cleanTerms = [...new Set(
    terms.map(term => String(term).trim()).filter(Boolean)
  )].sort((first, second) => second.length - first.length);

  if (!cleanTerms.length) {
    element.textContent = value;
    return;
  }

  const expression = new RegExp(`(${cleanTerms.map(escapeRegExp).join("|")})`, "gi");
  const parts = String(value).split(expression);

  for (const part of parts) {
    if (!part) continue;
    if (cleanTerms.some(term => term.toLowerCase() === part.toLowerCase())) {
      const mark = document.createElement("mark");
      mark.textContent = part;
      element.append(mark);
    } else {
      element.append(document.createTextNode(part));
    }
  }
}

export function createFileCard(file, options = {}) {
  const {
    index = 0,
    selected = false,
    selectionMode = false,
    reorderable = false,
    highlightTerms = [],
    matchKind = "",
    onActivate = () => {},
    onLongPress = null,
  } = options;
  const presentation = getFilePresentation(file);
  const sizeLabel = formatBytes(file.size);
  const dateLabel = formatRelativeDate(file.createdAt);
  const card = document.createElement("article");

  card.className = [
    "file-card",
    `file-card--${presentation.category}`,
    selectionMode ? "file-card--selection-mode" : "",
    selected ? "file-card--selected" : "",
    reorderable ? "file-card--reorderable" : "",
    matchKind === "content" ? "file-card--content-match" : "",
  ].filter(Boolean).join(" ");
  card.dataset.fileId = file.id;
  card.dataset.fileType = presentation.category;
  card.style.setProperty("--file-index", String(Math.min(index, 8)));

  card.innerHTML = `
    <button class="file-card__open" type="button">
      <span class="file-card__icon" aria-hidden="true">
        ${presentation.icon}
      </span>
      <span class="file-card__content">
        <span class="file-card__name"></span>
        <span class="file-card__details">
          <span class="file-card__type">${presentation.label}</span>
          ${matchKind === "content" ? '<span class="file-card__match">Contents</span>' : ""}
          <span class="file-card__detail">${sizeLabel}</span>
          <span class="file-card__detail">${dateLabel}</span>
        </span>
      </span>
      <span class="file-card__state" aria-hidden="true">
        <span class="file-card__chevron">${CHEVRON_ICON}</span>
        <span class="file-card__check">${CHECK_ICON}</span>
      </span>
    </button>
    ${reorderable ? `
      <button class="file-drag-handle" type="button">
        ${DRAG_ICON}
      </button>
    ` : ""}
  `;

  const openButton = card.querySelector(".file-card__open");
  const dragHandle = card.querySelector(".file-drag-handle");
  const name = card.querySelector(".file-card__name");
  appendHighlightedName(name, file.name, highlightTerms);

  if (dragHandle) {
    dragHandle.setAttribute("aria-label", `Move ${file.name}`);
    dragHandle.title = "Drag to change this file's position";
  }

  openButton.title = file.name;
  openButton.setAttribute(
    "aria-label",
    `${file.name}, ${presentation.label}, ${sizeLabel}, ${dateLabel}${matchKind === "content" ? ", matched document contents" : ""}`
  );

  if (selectionMode) {
    openButton.setAttribute("aria-pressed", String(selected));
  }

  openButton.addEventListener("click", onActivate);
  attachLongPress(openButton, onLongPress);
  return card;
}
