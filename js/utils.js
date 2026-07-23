export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function createId(prefix = "item") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function showToast(message) {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 2600);
}

export function sortFiles(files, mode) {
  const copy = [...files];

  switch (mode) {
    case "oldest":
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "size-desc":
      return copy.sort((a, b) => b.size - a.size);
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}
