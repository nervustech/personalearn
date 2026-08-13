/// <reference lib="webworker" />

import {
  EVAL_IMAGE_JPEG_QUALITY,
  outputFileName,
  shouldSkipEvalScanCompression,
  targetDimensions,
} from "@/lib/evaluation/compress-eval-image.shared";

export type CompressWorkerRequest = {
  id: string;
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export type CompressWorkerSuccess = {
  id: string;
  ok: true;
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  skipped: boolean;
};

export type CompressWorkerFailure = {
  id: string;
  ok: false;
  error: string;
};

export type CompressWorkerResponse = CompressWorkerSuccess | CompressWorkerFailure;

async function compressBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<{
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  skipped: boolean;
}> {
  const blob = new Blob([buffer], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    const width = bitmap.width;
    const height = bitmap.height;

    if (
      shouldSkipEvalScanCompression(fileName, mimeType, fileSize, width, height)
    ) {
      return { buffer, fileName, mimeType, skipped: true };
    }

    const { width: tw, height: th } = targetDimensions(width, height);
    const canvas = new OffscreenCanvas(tw, th);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not compress image (no canvas)");
    }
    ctx.drawImage(bitmap, 0, 0, tw, th);

    const outBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: EVAL_IMAGE_JPEG_QUALITY,
    });
    const outBuffer = await outBlob.arrayBuffer();

    if (
      outBlob.size >= fileSize &&
      (mimeType === "image/jpeg" || mimeType === "image/jpg") &&
      tw === width &&
      th === height
    ) {
      return { buffer, fileName, mimeType, skipped: true };
    }

    return {
      buffer: outBuffer,
      fileName: outputFileName(fileName),
      mimeType: "image/jpeg",
      skipped: false,
    };
  } finally {
    bitmap.close();
  }
}

self.onmessage = (event: MessageEvent<CompressWorkerRequest>) => {
  const { id, buffer, fileName, mimeType, fileSize } = event.data;
  void compressBuffer(buffer, fileName, mimeType, fileSize)
    .then((result) => {
      const response: CompressWorkerSuccess = {
        id,
        ok: true,
        ...result,
      };
      self.postMessage(response, [result.buffer]);
    })
    .catch((error: unknown) => {
      const response: CompressWorkerFailure = {
        id,
        ok: false,
        error:
          error instanceof Error ? error.message : "Image compression failed",
      };
      self.postMessage(response);
    });
};
