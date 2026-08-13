import type { EvaluatedScriptPage } from "@/types/database";

export type UploadDuplicateWarning = {
  fileName: string;
  duplicateOfFileName: string;
  message: string;
  alreadyInSession?: boolean;
};

export type UploadPageInput = {
  storagePath: string;
  fileName: string;
  contentHash: string;
};

export type UploadDedupeState = {
  hashToPath: Map<string, string>;
  hashToFirstFileName: Map<string, string>;
  batchHashes: Set<string>;
  maxUploadIndex: number;
};

export type ClaimedPageKeys = {
  hashes: Set<string>;
  paths: Set<string>;
};

function asPages(pageOrder: unknown): EvaluatedScriptPage[] {
  if (!Array.isArray(pageOrder)) return [];
  return pageOrder as EvaluatedScriptPage[];
}

export function buildUploadDedupeState(
  existingScripts: { page_order: unknown }[]
): UploadDedupeState {
  const hashToPath = new Map<string, string>();
  const hashToFirstFileName = new Map<string, string>();
  const batchHashes = new Set<string>();
  let maxUploadIndex = -1;

  for (const row of existingScripts) {
    for (const page of asPages(row.page_order)) {
      maxUploadIndex = Math.max(maxUploadIndex, page.uploadIndex);
      if (!page.contentHash || !page.storagePath) continue;
      batchHashes.add(page.contentHash);
      if (!hashToPath.has(page.contentHash)) {
        hashToPath.set(page.contentHash, page.storagePath);
        hashToFirstFileName.set(page.contentHash, page.fileName);
      }
    }
  }

  return {
    hashToPath,
    hashToFirstFileName,
    batchHashes,
    maxUploadIndex,
  };
}

export function dedupeIncomingUploadPages(
  state: UploadDedupeState,
  incoming: UploadPageInput[]
): {
  pageOrder: EvaluatedScriptPage[];
  warnings: UploadDuplicateWarning[];
  maxUploadIndex: number;
} {
  const pageOrder: EvaluatedScriptPage[] = [];
  const warnings: UploadDuplicateWarning[] = [];
  let maxUploadIndex = state.maxUploadIndex;

  for (const page of incoming) {
    const existingPath = state.hashToPath.get(page.contentHash);
    if (existingPath) {
      const duplicateOfFileName =
        state.hashToFirstFileName.get(page.contentHash) ?? "earlier page";
      const alreadyInSession = state.batchHashes.has(page.contentHash);
      warnings.push({
        fileName: page.fileName,
        duplicateOfFileName,
        alreadyInSession,
        message: alreadyInSession
          ? `${page.fileName} is already in this session — not added again`
          : `${page.fileName} matches ${duplicateOfFileName} — stored once, not added again`,
      });
      continue;
    }

    maxUploadIndex += 1;
    state.hashToPath.set(page.contentHash, page.storagePath);
    state.hashToFirstFileName.set(page.contentHash, page.fileName);
    state.batchHashes.add(page.contentHash);
    pageOrder.push({
      storagePath: page.storagePath,
      fileName: page.fileName,
      uploadIndex: maxUploadIndex,
      contentHash: page.contentHash,
    });
  }

  return { pageOrder, warnings, maxUploadIndex };
}

/** Content hashes / storage paths already owned by non-pending scripts. */
export function collectClaimedPageKeys(
  scripts: { status: string; page_order: unknown }[]
): ClaimedPageKeys {
  const hashes = new Set<string>();
  const paths = new Set<string>();
  for (const script of scripts) {
    if (script.status === "pending") continue;
    for (const page of asPages(script.page_order)) {
      if (page.contentHash) hashes.add(page.contentHash);
      if (page.storagePath) paths.add(page.storagePath);
    }
  }
  return { hashes, paths };
}

/** Drop pages whose bytes/path are already on a non-pending script in the batch. */
export function filterPagesNotAlreadyClaimed<
  T extends { contentHash?: string; storagePath: string },
>(pages: T[], claimed: ClaimedPageKeys): T[] {
  return pages.filter((page) => {
    if (page.contentHash && claimed.hashes.has(page.contentHash)) return false;
    if (claimed.paths.has(page.storagePath)) return false;
    return true;
  });
}

/**
 * Keep the first occurrence of each content hash (or storage path when hash missing).
 * Prevents identity from expanding one blob into many page_order rows.
 */
export function uniquePagesByContentKey<
  T extends { contentHash?: string; storagePath: string },
>(pages: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const page of pages) {
    const key = page.contentHash
      ? `hash:${page.contentHash}`
      : `path:${page.storagePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(page);
  }
  return unique;
}

type ScriptForDedupe = {
  id: string;
  student_id: string | null;
  created_at: string;
  page_order: unknown;
};

/**
 * Newer scripts that share any contentHash/storagePath with an older script
 * in the same batch.
 */
export function findContentHashDuplicateScriptIds(
  scripts: ScriptForDedupe[]
): string[] {
  const ordered = [...scripts].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const claimedHashes = new Map<string, string>();
  const claimedPaths = new Map<string, string>();
  const removeIds = new Set<string>();

  for (const script of ordered) {
    const pages = asPages(script.page_order);
    const overlapsKeeper = pages.some((page) => {
      const byHash = page.contentHash
        ? claimedHashes.get(page.contentHash)
        : undefined;
      const byPath = claimedPaths.get(page.storagePath);
      return Boolean(byHash || byPath);
    });

    if (overlapsKeeper) {
      removeIds.add(script.id);
      continue;
    }

    for (const page of pages) {
      if (page.contentHash && !claimedHashes.has(page.contentHash)) {
        claimedHashes.set(page.contentHash, script.id);
      }
      if (page.storagePath && !claimedPaths.has(page.storagePath)) {
        claimedPaths.set(page.storagePath, script.id);
      }
    }
  }

  return [...removeIds];
}
