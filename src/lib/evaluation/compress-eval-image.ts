import type { CompressWorkerResponse } from "@/lib/evaluation/compress-eval-image.worker";
import {
  EVAL_IMAGE_JPEG_QUALITY,
  EVAL_IMAGE_MAX_EDGE,
  EVAL_IMAGE_SKIP_JPEG_BYTES,
  EVAL_IMAGE_SKIP_PNG_BYTES,
  isEvalScanImage,
  outputFileName,
  shouldSkipEvalScanCompression,
  targetDimensions,
} from "@/lib/evaluation/compress-eval-image.shared";

export {
  EVAL_IMAGE_JPEG_QUALITY,
  EVAL_IMAGE_MAX_EDGE,
  EVAL_IMAGE_SKIP_JPEG_BYTES,
  EVAL_IMAGE_SKIP_PNG_BYTES,
  buildEvalPageStoragePath,
  isValidEvalPageStoragePath,
  shouldSkipEvalScanCompression,
  storageExtension,
  targetDimensions,
} from "@/lib/evaluation/compress-eval-image.shared";

/** @deprecated use EVAL_IMAGE_SKIP_JPEG_BYTES */
export const EVAL_IMAGE_SKIP_UNDER_BYTES = EVAL_IMAGE_SKIP_JPEG_BYTES;

const WORKER_POOL_SIZE = 2;

type WorkerJob = {
  resolve: (file: File) => void;
  reject: (error: Error) => void;
};

class CompressWorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private pending = new Map<string, WorkerJob>();
  private disabled = false;

  constructor() {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      this.disabled = true;
      return;
    }
    try {
      for (let index = 0; index < WORKER_POOL_SIZE; index += 1) {
        const worker = new Worker(
          new URL("./compress-eval-image.worker.ts", import.meta.url)
        );
        worker.onmessage = (event: MessageEvent<CompressWorkerResponse>) => {
          this.handleMessage(worker, event.data);
        };
        worker.onerror = () => {
          this.disabled = true;
        };
        this.workers.push(worker);
        this.available.push(worker);
      }
    } catch {
      this.disabled = true;
    }
  }

  canUseWorker() {
    return !this.disabled && this.workers.length > 0;
  }

  async compress(file: File): Promise<File> {
    if (!this.canUseWorker()) {
      throw new Error("Worker unavailable");
    }
    const worker = await this.acquireWorker();
    const id = crypto.randomUUID();
    const buffer = await file.arrayBuffer();

    return new Promise<File>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(
        {
          id,
          buffer,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
        [buffer]
      );
    }).finally(() => {
      this.releaseWorker(worker);
    });
  }

  private handleMessage(_worker: Worker, message: CompressWorkerResponse) {
    const job = this.pending.get(message.id);
    if (!job) return;
    this.pending.delete(message.id);

    if (!message.ok) {
      job.reject(new Error(message.error));
      return;
    }

    job.resolve(
      new File([message.buffer], message.fileName, {
        type: message.mimeType,
        lastModified: Date.now(),
      })
    );
  }

  private acquireWorker(): Promise<Worker> {
    const ready = this.available.pop();
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve) => {
      const wait = () => {
        const worker = this.available.pop();
        if (worker) {
          resolve(worker);
          return;
        }
        setTimeout(wait, 16);
      };
      wait();
    });
  }

  private releaseWorker(worker: Worker) {
    this.available.push(worker);
  }
}

let workerPool: CompressWorkerPool | null = null;

function getWorkerPool() {
  if (!workerPool) {
    workerPool = new CompressWorkerPool();
  }
  return workerPool;
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

async function compressEvalScanImageMainThread(file: File): Promise<File> {
  const mimeType = file.type || "application/octet-stream";
  if (!isEvalScanImage(file.name, mimeType)) return file;

  const img = await loadImage(file);
  const { width, height } = targetDimensions(img.naturalWidth, img.naturalHeight);

  if (
    shouldSkipEvalScanCompression(
      file.name,
      mimeType,
      file.size,
      img.naturalWidth,
      img.naturalHeight
    )
  ) {
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
  if (
    blob.size >= file.size &&
    (mimeType === "image/jpeg" || mimeType === "image/jpg") &&
    width === img.naturalWidth &&
    height === img.naturalHeight
  ) {
    return file;
  }

  return new File([blob], outputFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Resize/compress a scan for eval upload without meaningful loss for vision reads.
 * Uses a Web Worker when available; falls back to main-thread canvas.
 */
export async function compressEvalScanImage(file: File): Promise<File> {
  const pool = getWorkerPool();
  if (pool.canUseWorker()) {
    try {
      return await pool.compress(file);
    } catch {
      // Fall through to main-thread compression.
    }
  }
  return compressEvalScanImageMainThread(file);
}

export async function compressEvalScanImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressEvalScanImage(file)));
}
