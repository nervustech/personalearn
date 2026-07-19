import { describe, expect, it } from "vitest";
import {
  boundingBoxToCssPercent,
  parseBoundingBoxJson,
} from "./bounding-box";
import { createConcurrencyLimit } from "./concurrency";

describe("parseBoundingBoxJson", () => {
  it("parses valid regions", () => {
    expect(
      parseBoundingBoxJson([
        { page: 0, ymin: 10, xmin: 20, ymax: 100, xmax: 200 },
      ])
    ).toEqual([{ page: 0, ymin: 10, xmin: 20, ymax: 100, xmax: 200 }]);
  });

  it("rejects inverted boxes", () => {
    expect(
      parseBoundingBoxJson([{ page: 0, ymin: 100, xmin: 20, ymax: 10, xmax: 200 }])
    ).toBeNull();
  });
});

describe("boundingBoxToCssPercent", () => {
  it("maps 0–1000 coords to CSS percents", () => {
    expect(
      boundingBoxToCssPercent({
        page: 0,
        ymin: 100,
        xmin: 200,
        ymax: 500,
        xmax: 800,
      })
    ).toEqual({
      top: "10%",
      left: "20%",
      width: "60%",
      height: "40%",
    });
  });
});

describe("createConcurrencyLimit", () => {
  it("caps parallel work", async () => {
    let active = 0;
    let maxActive = 0;
    const limit = createConcurrencyLimit(2);

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        limit(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 20));
          active -= 1;
          return i;
        })
      )
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
