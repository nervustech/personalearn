import { getSupabaseEnv } from "@/lib/supabase/env";

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

/** PUT to signed URL with byte progress via XHR. */
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

export async function confirmUploadedPage(
  batchId: string,
  page: { storagePath: string; fileName: string; contentHash: string }
): Promise<ConfirmUploadResult> {
  const response = await fetch(
    `/api/evaluation-batches/${batchId}/confirm-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages: [page] }),
    }
  );
  const payload = (await response.json()) as ConfirmUploadResult;
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not confirm upload");
  }
  return payload;
}
