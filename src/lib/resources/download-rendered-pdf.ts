import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { pdfFileName } from "@/lib/resources/render-pdf";

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;

/** Computed styles safe to inline for html2canvas (avoids color-mix/oklch parsing). */
const STYLE_PROPS = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "borderCollapse",
  "borderSpacing",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "textTransform",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
  "width",
  "maxWidth",
  "minWidth",
  "height",
  "maxHeight",
  "minHeight",
  "overflow",
  "overflowX",
  "overflowY",
  "opacity",
  "visibility",
  "verticalAlign",
  "boxSizing",
  "listStyleType",
  "listStylePosition",
] as const;

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92) {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isUnsupportedCssColor(value: string) {
  return /color-mix|oklch|oklab|lab\(|lch\(|color\(/i.test(value);
}

/**
 * Copy resolved computed styles onto a clone as plain rgb/hex inline CSS.
 * html2canvas crashes on stylesheets that use color-mix()/oklch().
 */
function inlineComputedStyles(source: Element, target: Element) {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }

  const computed = window.getComputedStyle(source);
  for (const prop of STYLE_PROPS) {
    let value = computed.getPropertyValue(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    );
    if (!value) {
      value = computed[prop as keyof CSSStyleDeclaration] as string;
    }
    if (!value || value === "none" && prop !== "backgroundImage") continue;
    if (prop === "backgroundImage" && isUnsupportedCssColor(value)) {
      target.style.backgroundImage = "none";
      continue;
    }
    if (isUnsupportedCssColor(value)) continue;
    target.style.setProperty(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      value
    );
  }

  // Drop class-based theming so stylesheet color-mix never applies.
  target.removeAttribute("class");

  const srcChildren = source.children;
  const tgtChildren = target.children;
  const count = Math.min(srcChildren.length, tgtChildren.length);
  for (let i = 0; i < count; i++) {
    inlineComputedStyles(srcChildren[i], tgtChildren[i]);
  }
}

/**
 * Build an isolated iframe document with only inlined styles, then rasterize.
 */
async function renderElementToCanvas(element: HTMLElement, title: string) {
  const width = Math.max(element.scrollWidth, element.clientWidth, 640);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;height:0;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not prepare PDF preview");
  }

  doc.open();
  doc.write(
    "<!DOCTYPE html><html><head><meta charset='utf-8' /></head><body></body></html>"
  );
  doc.close();

  const clone = element.cloneNode(true) as HTMLElement;
  inlineComputedStyles(element, clone);

  const container = doc.createElement("div");
  container.style.cssText = [
    "box-sizing:border-box",
    "width:100%",
    "padding:24px",
    "background:#ffffff",
    "color:#171717",
    "font-family:system-ui,-apple-system,sans-serif",
  ].join(";");

  const heading = doc.createElement("h1");
  heading.textContent = title.trim() || "Resource";
  heading.style.cssText =
    "margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.25;color:#171717;";
  container.appendChild(heading);
  container.appendChild(clone);
  doc.body.style.margin = "0";
  doc.body.style.background = "#ffffff";
  doc.body.appendChild(container);

  // Expand iframe so full content lays out before capture.
  const height = Math.max(container.scrollHeight, container.offsetHeight, 1);
  iframe.style.height = `${height}px`;

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    return await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width,
      windowWidth: width,
      windowHeight: height,
    });
  } finally {
    iframe.remove();
  }
}

/**
 * Capture a rendered DOM node (markdown tables included) and trigger a
 * direct PDF download — no print dialog (works in embedded browsers too).
 */
export async function downloadRenderedElementAsPdf(
  element: HTMLElement,
  title: string
) {
  const canvas = await renderElementToCanvas(element, title);

  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const contentHeight = PAGE_HEIGHT - MARGIN * 2;
  const drawWidth = contentWidth;
  const drawHeight = (canvas.height * drawWidth) / canvas.width;

  const pdf = await PDFDocument.create();
  const jpg = await pdf.embedJpg(canvasToJpegBytes(canvas));

  let remaining = drawHeight;
  let offsetY = 0;
  while (remaining > 0) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawImage(jpg, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - drawHeight + offsetY,
      width: drawWidth,
      height: drawHeight,
    });
    remaining -= contentHeight;
    offsetY += contentHeight;
  }

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = pdfFileName(title);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
