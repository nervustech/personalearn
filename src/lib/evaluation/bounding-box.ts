/** Normalized 0–1000 box on a single page (Gemini-style). */
export type BoundingBoxRegion = {
  page: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

export function parseBoundingBoxJson(raw: unknown): BoundingBoxRegion[] | null {
  if (raw == null) return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value) || value.length === 0) return null;

  const regions: BoundingBoxRegion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const page = Number(row.page);
    const ymin = Number(row.ymin);
    const xmin = Number(row.xmin);
    const ymax = Number(row.ymax);
    const xmax = Number(row.xmax);
    if (
      ![page, ymin, xmin, ymax, xmax].every((n) => Number.isFinite(n)) ||
      ymax <= ymin ||
      xmax <= xmin
    ) {
      continue;
    }
    regions.push({
      page: Math.max(0, Math.floor(page)),
      ymin: clampNorm(ymin),
      xmin: clampNorm(xmin),
      ymax: clampNorm(ymax),
      xmax: clampNorm(xmax),
    });
  }
  return regions.length > 0 ? regions : null;
}

function clampNorm(n: number): number {
  return Math.min(1000, Math.max(0, n));
}

/** CSS % for overlay: Gemini uses 0–1000 normalized coords. */
export function boundingBoxToCssPercent(box: BoundingBoxRegion): {
  top: string;
  left: string;
  width: string;
  height: string;
} {
  const top = (box.ymin / 1000) * 100;
  const left = (box.xmin / 1000) * 100;
  const width = ((box.xmax - box.xmin) / 1000) * 100;
  const height = ((box.ymax - box.ymin) / 1000) * 100;
  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${Math.max(width, 0.5)}%`,
    height: `${Math.max(height, 0.5)}%`,
  };
}
