// build-logo-sticker-rectangle-pdf.mjs
//
// Renders extraction-logo-sticker-rectangle.html (the wordmark lockup on a black card,
// as standalone stickers at 4in/3in/2in -- rectangle only, no round badge) to
// assets/extraction-logo-sticker-rectangle.pdf. Sizes are set in true CSS inches so the
// PDF prints at exact physical size at 100% scale.
// Standalone reference document. Re-run if the sticker sizes/layout change.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-logo-sticker-rectangle.html");
const OUT_PDF = path.join(REPO_ROOT, "assets", "extraction-logo-sticker-rectangle.pdf");

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
