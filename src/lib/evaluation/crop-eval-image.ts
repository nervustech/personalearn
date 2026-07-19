import sharp from "sharp";
import type { BoundingBoxRegion } from "@/lib/evaluation/bounding-box";
import type { DraftPageImage } from "@/lib/evaluation/draft-question";

/**
 * Crop page images to stored bounding boxes (F6) — server-only (sharp).
 * Falls back to the original page bytes when crop is impossible.
 */
export async function cropPagesToBoundingBoxes(
  pages: DraftPageImage[],
  boxes: BoundingBoxRegion[] | null | undefined
): Promise<DraftPageImage[]> {
  if (!boxes?.length || pages.length === 0) return pages;

  const cropped: DraftPageImage[] = [];
  const seen = new Set<string>();

  for (const box of boxes) {
    const pageIndex = Math.min(box.page, pages.length - 1);
    const page = pages[pageIndex];
    if (!page) continue;
    const key = `${pageIndex}:${box.ymin}:${box.xmin}:${box.ymax}:${box.xmax}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      cropped.push(await cropSinglePage(page, box));
    } catch {
      cropped.push(page);
    }
  }

  return cropped.length > 0 ? cropped : pages;
}

async function cropSinglePage(
  page: DraftPageImage,
  box: BoundingBoxRegion
): Promise<DraftPageImage> {
  const image = sharp(Buffer.from(page.bytes));
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) return page;

  const left = Math.floor((box.xmin / 1000) * width);
  const top = Math.floor((box.ymin / 1000) * height);
  const right = Math.ceil((box.xmax / 1000) * width);
  const bottom = Math.ceil((box.ymax / 1000) * height);
  const cropWidth = Math.max(1, Math.min(width - left, right - left));
  const cropHeight = Math.max(1, Math.min(height - top, bottom - top));

  const out = await image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .jpeg({ quality: 90 })
    .toBuffer();

  return {
    bytes: new Uint8Array(out),
    mimeType: "image/jpeg",
  };
}
