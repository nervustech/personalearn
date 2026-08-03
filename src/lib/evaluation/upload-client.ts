import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  buildEvalPageStoragePath,
  storageExtension,
} from "@/lib/evaluation/compress-eval-image.shared";

export type UploadSlot = {
  fileName: string;
  storagePath: string;
  token: string;
  contentType: string;
};

export type ConfirmUploadResult = {
  batchId?: string;
  pageCount?: number;
  warnings?: {
    fileName: string;
    duplicateOfFileName: string;
    message: string;
  }[];
  queued?: boolean;
  skippedAll?: boolean;
  message?: string;
  error?: string;
};

export async function sha256HexBrowser(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function mintUploadSlots(
  batchId: string,
  files: { fileName: string; contentType?: string }[]
): Promise<UploadSlot[]> {
  const response = await fetch(
    `/api/evaluation-batches/${batchId}/upload-urls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    }
  );
  const payload = (await response.json()) as {
    uploads?: UploadSlot[];
    error?: string;
  };
  if (!response.ok || !payload.uploads?.length) {
    throw new Error(payload.error ?? "Could not prepare upload URLs");
  }
  return payload.uploads;
}

function signedUploadUrl(storagePath: string, token: string): string {
  const { url } = getSupabaseEnv();
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${url}/storage/v1/object/upload/sign/student_submissions/${encodedPath}?token=${encodeURIComponent(token)}`;
}

/** PUT to signed URL with byte progress via XHR (fallback path). */
export function uploadBlobToSignedUrl(
  slot: UploadSlot,
  blob: Blob,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const { anonKey } = getSupabaseEnv();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          xhr.responseText || `Upload failed (${xhr.status}): ${slot.fileName}`
        )
      );
    });
    xhr.addEventListener("error", () => {
      reject(new Error(`Network error uploading ${slot.fileName}`));
    });
    xhr.open("PUT", signedUploadUrl(slot.storagePath, slot.token));
    xhr.setRequestHeader(
      "Content-Type",
      slot.contentType || "image/jpeg"
    );
    if (anonKey) {
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
      xhr.setRequestHeader("apikey", anonKey);
    }
    xhr.send(blob);
  });
}

/** Direct authenticated upload via Supabase Storage RLS (preferred). */
export async function uploadEvalBlobDirect(
  classId: string,
  batchId: string,
  fileName: string,
  blob: Blob,
  contentType: string
): Promise<{ storagePath: string }> {
  const storagePath = buildEvalPageStoragePath(
    classId,
    batchId,
    fileName,
    contentType
  );
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("student_submissions")
    .upload(storagePath, blob, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || `Upload failed: ${fileName}`);
  }

  return { storagePath };
}

/** Upload with direct Supabase first; fall back to signed URL mint + XHR. */
export async function uploadEvalBlob(
  classId: string,
  batchId: string,
  fileName: string,
  blob: Blob,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ storagePath: string }> {
  const total = blob.size || 1;
  try {
    onProgress?.(0, total);
    const result = await uploadEvalBlobDirect(
      classId,
      batchId,
      fileName,
      blob,
      contentType
    );
    onProgress?.(total, total);
    return result;
  } catch {
    const ext = storageExtension(fileName, contentType);
    const slots = await mintUploadSlots(batchId, [
      {
        fileName,
        contentType: contentType || `image/${ext === "png" ? "png" : "jpeg"}`,
      },
    ]);
    const slot = slots[0];
    if (!slot) {
      throw new Error("Could not prepare upload URL");
    }
    await uploadBlobToSignedUrl({ ...slot, contentType }, blob, onProgress);
    return { storagePath: slot.storagePath };
  }
}

export async function confirmUploadedPages(
  batchId: string,
  pages: { storagePath: string; fileName: string; contentHash: string }[]
): Promise<ConfirmUploadResult> {
  if (pages.length === 0) {
    return { batchId, pageCount: 0, skippedAll: true };
  }
  const response = await fetch(
    `/api/evaluation-batches/${batchId}/confirm-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    }
  );
  const payload = (await response.json()) as ConfirmUploadResult;
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not confirm upload");
  }
  return payload;
}

export async function confirmUploadedPage(
  batchId: string,
  page: { storagePath: string; fileName: string; contentHash: string }
): Promise<ConfirmUploadResult> {
  return confirmUploadedPages(batchId, [page]);
}
