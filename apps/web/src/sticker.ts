// ─────────────────────────────────────────────────────────────────────────────
// sticker.ts — turn a captured photo into a die-cut "sticker" PNG.
// Tries the server (/api/sticker, mode:"cutout") first; on ANY failure falls
// back to a client-side canvas sticker. ALWAYS resolves to a usable data URL.
// Self-contained: no imports from api.ts, no external deps.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
const STICKER_ROUTE = "/api/sticker";

const SERVER_TIMEOUT_MS = 8_000;
const CANVAS_SIZE = 512;
const BORDER = 14; // die-cut white outline thickness (px)
const CORNER = 64; // rounded-rect corner radius (px)

/**
 * Convert a captured photo into a die-cut sticker PNG (transparent-ish, white
 * outlined). Never rejects — guaranteed to resolve to a data URL or hosted url.
 */
export async function makeStickerFromPhoto(
  photoDataUrl: string,
  label?: string,
): Promise<string> {
  try {
    const serverUrl = await requestServerSticker(photoDataUrl);
    if (serverUrl) return serverUrl;
  } catch {
    // fall through to client-side rendering
  }

  try {
    return await renderCanvasSticker(photoDataUrl, label);
  } catch {
    // last resort: hand back the original photo so callers always get something
    return photoDataUrl;
  }
}

// ── Server path ───────────────────────────────────────────────────────────────

async function requestServerSticker(
  photoDataUrl: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${STICKER_ROUTE}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: photoDataUrl, mode: "cutout" }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stickerUrl?: string } | null;
    const url = data?.stickerUrl;
    return typeof url === "string" && url.length > 0 ? url : null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Client-side fallback ────────────────────────────────────────────────────────

async function renderCanvasSticker(
  photoDataUrl: string,
  label?: string,
): Promise<string> {
  const img = await loadImage(photoDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  // Sticker body sits inside the canvas, leaving room for the outline + shadow.
  const inset = BORDER + 8;
  const bodyX = inset;
  const bodyY = inset;
  const bodySize = CANVAS_SIZE - inset * 2;

  // 1) Soft drop shadow + thick white die-cut border (drawn as a filled rect).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundedRectPath(ctx, bodyX, bodyY, bodySize, bodySize, CORNER);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // 2) Clip to the inner rounded-rect and cover-fit the photo into it.
  const photoX = bodyX + BORDER;
  const photoY = bodyY + BORDER;
  const photoSize = bodySize - BORDER * 2;
  const photoCorner = Math.max(0, CORNER - BORDER);

  ctx.save();
  roundedRectPath(ctx, photoX, photoY, photoSize, photoSize, photoCorner);
  ctx.clip();
  drawImageCover(ctx, img, photoX, photoY, photoSize, photoSize);

  // 3) Optional label on a translucent pill near the bottom (inside the clip).
  if (label && label.trim()) {
    drawLabelPill(ctx, label.trim(), photoX, photoY, photoSize, photoSize);
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** Cover-fit: scale the image to fill the box, centred, cropping overflow. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawLabelPill(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const fontSize = Math.round(w * 0.072);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = truncateToWidth(ctx, label, w * 0.82);
  const padX = fontSize * 0.7;
  const padY = fontSize * 0.45;
  const textW = ctx.measureText(text).width;
  const pillW = Math.min(w * 0.9, textW + padX * 2);
  const pillH = fontSize + padY * 2;
  const pillX = x + (w - pillW) / 2;
  const pillY = y + h - pillH - w * 0.05;

  ctx.save();
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, pillX + pillW / 2, pillY + pillH / 2);
  ctx.restore();
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
