import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { pdfFileName } from "@/lib/resources/render-pdf";

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;

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

/**
 * Capture a rendered DOM node (markdown tables included) and trigger a
 * direct PDF download — no print dialog (works in embedded browsers too).
 */
export async function downloadRenderedElementAsPdf(
  element: HTMLElement,
  title: string
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    onclone: (_doc, cloned) => {
      cloned.style.backgroundColor = "#ffffff";
      cloned.style.color = "#171717";
      cloned.style.maxHeight = "none";
      cloned.style.overflow = "visible";
      // Ensure wide tables aren't clipped in the capture.
      cloned.querySelectorAll(".overflow-x-auto").forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.overflow = "visible";
        }
      });
      const heading = cloned.ownerDocument.createElement("h1");
      heading.textContent = title.trim() || "Resource";
      heading.style.cssText =
        "margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.25;color:#171717;font-family:system-ui,sans-serif;";
      cloned.insertBefore(heading, cloned.firstChild);
    },
  });

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
