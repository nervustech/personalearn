/** Max long edge after resize — enough for admission/Q# handwriting. */
export const EVAL_IMAGE_MAX_EDGE = 2400;

/** JPEG quality — high enough for vision, small enough for Vercel body limits. */
export const EVAL_IMAGE_JPEG_QUALITY = 0.88;

/** Skip re-encode when JPEG is already small and within max edge. */
export const EVAL_IMAGE_SKIP_JPEG_BYTES = 4 * 1024 * 1024;

/** Skip re-encode when PNG is already small and within max edge. */
export const EVAL_IMAGE_SKIP_PNG_BYTES = 2 * 1024 * 1024;

export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number = EVAL_IMAGE_MAX_EDGE
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isEvalScanImage(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/jpg" ||
    /\.(jpe?g|png)$/.test(lower)
  );
}

export function skipThresholdBytes(fileName: string, mimeType: string): number {
  const lower = fileName.toLowerCase();
  const isJpeg =
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    /\.jpe?g$/.test(lower);
  return isJpeg ? EVAL_IMAGE_SKIP_JPEG_BYTES : EVAL_IMAGE_SKIP_PNG_BYTES;
}

/** True when the scan needs no resize and is under the type-specific size cap. */
export function shouldSkipEvalScanCompression(
  fileName: string,
  mimeType: string,
  fileSize: number,
  width: number,
  height: number
): boolean {
  if (!isEvalScanImage(fileName, mimeType)) return true;
  const { width: tw, height: th } = targetDimensions(width, height);
  const needsResize = tw !== width || th !== height;
  if (needsResize) return false;
  return fileSize <= skipThresholdBytes(fileName, mimeType);
}

export function outputFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "scan";
  return `${baseName}.jpg`;
}

export function storageExtension(
  fileName: string,
  contentType: string
): "jpg" | "png" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png") || contentType === "image/png") return "png";
  return "jpg";
}

export function buildEvalPageStoragePath(
  classId: string,
  batchId: string,
  fileName: string,
  contentType: string
): string {
  const ext = storageExtension(fileName, contentType);
  return `${classId}/${batchId}/${crypto.randomUUID()}.${ext}`;
}

export function isValidEvalPageStoragePath(
  storagePath: string,
  classId: string,
  batchId: string
): boolean {
  if (storagePath.includes("..")) return false;
  const prefix = `${classId}/${batchId}/`;
  return storagePath.startsWith(prefix) && storagePath.length > prefix.length;
}
