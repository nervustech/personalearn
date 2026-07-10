/** Max long edge after resize — enough for admission/Q# handwriting. */
export const EVAL_IMAGE_MAX_EDGE = 2400;

/** JPEG quality — high enough for vision, small enough for Vercel body limits. */
export const EVAL_IMAGE_JPEG_QUALITY = 0.88;

/** Skip work if already under this size and within max edge. */
export const EVAL_IMAGE_SKIP_UNDER_BYTES = 2 * 1024 * 1024;

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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image: ${file.name}`));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Resize/compress a scan for eval upload without meaningful loss for vision reads.
 * Returns the original file if already small enough and within max edge.
 */
export async function compressEvalScanImage(file: File): Promise<File> {
  const lower = file.name.toLowerCase();
  const isImage =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/jpg" ||
    /\.(jpe?g|png)$/.test(lower);

  if (!isImage) return file;

  const img = await loadImage(file);
  const { width, height } = targetDimensions(img.naturalWidth, img.naturalHeight);
  const needsResize =
    width !== img.naturalWidth || height !== img.naturalHeight;

  if (!needsResize && file.size <= EVAL_IMAGE_SKIP_UNDER_BYTES) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not compress image (no canvas)");
  }
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToJpegBlob(canvas, EVAL_IMAGE_JPEG_QUALITY);
  // Prefer compressed only when it actually helps (or we had to re-encode PNG).
  if (blob.size >= file.size && file.type === "image/jpeg" && !needsResize) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function compressEvalScanImages(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    out.push(await compressEvalScanImage(file));
  }
  return out;
}
