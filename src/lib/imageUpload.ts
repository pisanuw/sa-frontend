// What the STEM image upload accepts, checked before anything is sent, and how its errors read.
// The server prepares every upload (transparent backgrounds go on white, phone photos are turned
// upright), so any of these formats works; see backend/image_prep.py.

export const IMAGE_FORMAT_NAMES = "PNG, JPEG, WebP, GIF, BMP or TIFF";

/** The largest picture the server keeps with a STEM image (backend image_store.MAX_IMAGE_BYTES). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff"];
const EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];

/** For the file input's `accept`: types and extensions, since some systems report no type. */
export const IMAGE_UPLOAD_ACCEPT = [...TYPES, ...EXTENSIONS].join(",");

const extension = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

/** Why this file can't be uploaded, in words to show, or null when it can. */
export function imageFileProblem(file: File): string | null {
  const ext = extension(file.name);
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml" || ext === ".svg") {
    return `${file.name} is an SVG drawing, which can't be read yet. Export the diagram as a PNG and upload that.`;
  }
  if (type === "image/heic" || type === "image/heif" || ext === ".heic" || ext === ".heif") {
    return `${file.name} is a HEIC photo, which can't be read yet. Save it as JPEG (on an iPhone: Settings, Camera, Formats, Most Compatible) or take a screenshot, and upload that.`;
  }
  if (!TYPES.includes(type) && !EXTENSIONS.includes(ext)) {
    return `${file.name} is not a picture that can be read. Choose a ${IMAGE_FORMAT_NAMES} image.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name} is ${mb} MB; the limit is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB. Choose a smaller picture.`;
  }
  return null;
}

/**
 * The server's own message for a refused upload ("400 BAD REQUEST: SVG drawings can't be read…"),
 * or null when the error is not one of those. The upload route's 400 and 413 messages are written
 * to be shown; other failures carry technical detail and get the page's general message instead.
 */
export function uploadRefusalMessage(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const m = text.match(/^(400|413)\b[^:]*:\s*(.+)$/s);
  return m ? m[2].trim() : null;
}
