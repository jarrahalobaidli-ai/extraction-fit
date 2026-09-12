// build-product-label-stickers-pdf.mjs
//
// Renders extraction-product-label-stickers.html (the square corner-tick label mark as it
// appears on the Field Roast Coffee bags [black] and the Grooming bottles [kraft-tan], as
// standalone stickers at a few common sizes) to assets/extraction-product-label-stickers.pdf.
// Sizes are set in true CSS inches so the PDF prints at exact physical size at 100% scale.
// Standalone reference document. Re-run if the sticker sizes/layout change.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-product-label-stickers.html");
const OUT_PDF = path.join(REPO_ROOT, "assets", "extraction-product-label-stickers.pdf");

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  // file:// (not setContent) so relative asset paths (assets/*.png) resolve.
  await page.goto(`file://${SOURCE_HTML}`, { waitUntil: "networkidle" });
  const pdfBytes = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "0mm", right: "0mm" },
  });
  fs.writeFileSync(OUT_PDF, pdfBytes);
  console.log(`Wrote ${OUT_PDF} (${(pdfBytes.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
