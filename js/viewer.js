const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "csv", "log", "xml", "html", "htm",
  "css", "js", "mjs", "ts", "tsx", "jsx", "py", "java", "c", "cpp",
  "h", "hpp", "sql", "yaml", "yml", "ini", "conf"
]);

function extensionOf(name) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function fileIcon(file) {
  const type = file.type || "";
  const ext = extensionOf(file.name);

  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf" || ext === "pdf") return "📕";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
  if (["doc", "docx", "odt"].includes(ext)) return "📘";
  if (["xls", "xlsx", "ods"].includes(ext)) return "📊";
  if (["ppt", "pptx", "odp"].includes(ext)) return "📽️";
  if (TEXT_EXTENSIONS.has(ext) || type.startsWith("text/")) return "📄";
  return "📁";
}

export function canPreviewAsText(file) {
  return file.type.startsWith("text/") || TEXT_EXTENSIONS.has(extensionOf(file.name));
}

export async function renderPreview(container, fileRecord) {
  container.replaceChildren();

  const { blob, type, name } = fileRecord;
  const objectUrl = URL.createObjectURL(blob);
  container.dataset.objectUrl = objectUrl;

  if (type.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = objectUrl;
    image.alt = name;
    container.append(image);
    return;
  }

  if (type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = objectUrl;
    video.controls = true;
    video.playsInline = true;
    container.append(video);
    return;
  }

  if (type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = objectUrl;
    audio.controls = true;
    container.append(audio);
    return;
  }

  if (type === "application/pdf" || extensionOf(name) === "pdf") {
    const frame = document.createElement("iframe");
    frame.src = objectUrl;
    frame.title = name;
    container.append(frame);
    return;
  }

  if (canPreviewAsText(fileRecord)) {
    URL.revokeObjectURL(objectUrl);
    delete container.dataset.objectUrl;

    try {
      const text = await blob.text();
      const pre = document.createElement("pre");
      pre.textContent = text;
      container.append(pre);
    } catch {
      renderFallback(container, fileRecord);
    }
    return;
  }

  renderFallback(container, fileRecord);
}

function renderFallback(container, fileRecord) {
  const wrapper = document.createElement("div");
  wrapper.className = "viewer__fallback";
  wrapper.innerHTML = `
    <div>
      <div style="font-size:3rem;margin-bottom:12px">${fileIcon(fileRecord)}</div>
      <strong>Stored safely in Ghost</strong>
      <span>This browser cannot render this file format internally. You can still move, delete or download it.</span>
    </div>
  `;
  container.append(wrapper);
}

export function releasePreview(container) {
  const objectUrl = container.dataset.objectUrl;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  delete container.dataset.objectUrl;
  container.replaceChildren();
}
