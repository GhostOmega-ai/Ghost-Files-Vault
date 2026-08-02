import { getFilePresentation } from "./file-types.js";
import { formatBytes, formatRelativeDate, showToast } from "./utils.js";

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

function attachFilenameLongPress(button, filename) {
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
      button.classList.add("file-card--long-press");
      showToast(filename);
      window.setTimeout(() => button.classList.remove("file-card--long-press"), 260);
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

export function createFileCard(file, options = {}) {
  const {
    index = 0,
    selected = false,
    selectionMode = false,
  } = options;
  const presentation = getFilePresentation(file);
  const sizeLabel = formatBytes(file.size);
  const dateLabel = formatRelativeDate(file.createdAt);
  const button = document.createElement("button");

  button.type = "button";
  button.className = [
    "file-card",
    `file-card--${presentation.category}`,
    selectionMode ? "file-card--selection-mode" : "",
    selected ? "file-card--selected" : "",
  ].filter(Boolean).join(" ");
  button.dataset.fileId = file.id;
  button.dataset.fileType = presentation.category;
  button.style.setProperty("--file-index", String(Math.min(index, 8)));
  button.title = file.name;
  button.setAttribute(
    "aria-label",
    `${file.name}, ${presentation.label}, ${sizeLabel}, ${dateLabel}`
  );

  if (selectionMode) {
    button.setAttribute("aria-pressed", String(selected));
  }

  button.innerHTML = `
    <span class="file-card__icon" aria-hidden="true">
      ${presentation.icon}
    </span>
    <span class="file-card__content">
      <span class="file-card__name"></span>
      <span class="file-card__details">
        <span class="file-card__type">${presentation.label}</span>
        <span class="file-card__detail">${sizeLabel}</span>
        <span class="file-card__detail">${dateLabel}</span>
      </span>
    </span>
    <span class="file-card__state" aria-hidden="true">
      <span class="file-card__chevron">${CHEVRON_ICON}</span>
      <span class="file-card__check">${CHECK_ICON}</span>
    </span>
  `;

  button.querySelector(".file-card__name").textContent = file.name;
  attachFilenameLongPress(button, file.name);
  return button;
}
