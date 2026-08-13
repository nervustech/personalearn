import { describe, expect, it } from "vitest";
import {
  buildUploadDedupeState,
  collectClaimedPageKeys,
  dedupeIncomingUploadPages,
  filterPagesNotAlreadyClaimed,
  findContentHashDuplicateScriptIds,
  uniquePagesByContentKey,
} from "@/lib/evaluation/upload-page-dedupe";

describe("upload-page-dedupe", () => {
  it("skips pages whose hash already exists in the batch", () => {
    const state = buildUploadDedupeState([
      {
        page_order: [
          {
            storagePath: "existing/path.jpg",
            fileName: "page-a.jpg",
            uploadIndex: 0,
            contentHash: "hash-a",
          },
        ],
      },
    ]);

    const { pageOrder, warnings } = dedupeIncomingUploadPages(state, [
      {
        storagePath: "new/path.jpg",
        fileName: "page-a-copy.jpg",
        contentHash: "hash-a",
      },
    ]);

    expect(pageOrder).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.alreadyInSession).toBe(true);
  });

  it("keeps the first of two identical incoming pages", () => {
    const state = buildUploadDedupeState([]);
    const { pageOrder, warnings } = dedupeIncomingUploadPages(state, [
      {
        storagePath: "a.jpg",
        fileName: "scan-a.jpg",
        contentHash: "same",
      },
      {
        storagePath: "a.jpg",
        fileName: "scan-a-copy.jpg",
        contentHash: "same",
      },
    ]);

    expect(pageOrder).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(pageOrder[0]!.fileName).toBe("scan-a.jpg");
  });

  it("filters pending pages already claimed by non-pending scripts", () => {
    const claimed = collectClaimedPageKeys([
      {
        status: "drafting",
        page_order: [
          {
            storagePath: "a.jpg",
            fileName: "a.jpg",
            uploadIndex: 0,
            contentHash: "hash-a",
          },
        ],
      },
      {
        status: "pending",
        page_order: [
          {
            storagePath: "b.jpg",
            fileName: "b.jpg",
            uploadIndex: 1,
            contentHash: "hash-b",
          },
        ],
      },
    ]);

    expect(claimed.hashes.has("hash-a")).toBe(true);
    expect(claimed.hashes.has("hash-b")).toBe(false);

    const filtered = filterPagesNotAlreadyClaimed(
      [
        { storagePath: "a.jpg", contentHash: "hash-a" },
        { storagePath: "c.jpg", contentHash: "hash-c" },
      ],
      claimed
    );
    expect(filtered).toEqual([{ storagePath: "c.jpg", contentHash: "hash-c" }]);
  });

  it("uniques pages by content hash before identity grouping", () => {
    const unique = uniquePagesByContentKey([
      { storagePath: "a.jpg", contentHash: "h1" },
      { storagePath: "a-copy.jpg", contentHash: "h1" },
      { storagePath: "b.jpg", contentHash: "h2" },
    ]);
    expect(unique).toHaveLength(2);
    expect(unique[0]!.storagePath).toBe("a.jpg");
  });

  it("marks newer scripts that reuse hashes as duplicates to remove", () => {
    const removeIds = findContentHashDuplicateScriptIds([
      {
        id: "keep",
        student_id: "s1",
        created_at: "2026-07-27T00:00:00Z",
        page_order: [
          {
            storagePath: "a.jpg",
            fileName: "a.jpg",
            uploadIndex: 0,
            contentHash: "h1",
          },
        ],
      },
      {
        id: "drop",
        student_id: "s1",
        created_at: "2026-07-28T00:00:00Z",
        page_order: [
          {
            storagePath: "a.jpg",
            fileName: "a.jpg",
            uploadIndex: 0,
            contentHash: "h1",
          },
          {
            storagePath: "a.jpg",
            fileName: "a.jpg",
            uploadIndex: 1,
            contentHash: "h1",
          },
        ],
      },
    ]);

    expect(removeIds).toEqual(["drop"]);
  });
});
