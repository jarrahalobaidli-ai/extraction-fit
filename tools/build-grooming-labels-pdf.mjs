// build-grooming-labels-pdf.mjs
//
// Renders extraction-grooming-labels.html (print-ready kraft bottle labels for the full
// Grooming line -- Beard Oil, Beard Balm, Beard Wash, Body Wash -- plus the travel-size mini
// labels for the Travel Field Kit) to assets/extraction-grooming-labels.pdf. Sizes are set in
// true CSS inches so the PDF prints at exact physical size at 100% scale.
// Standalone reference document. Re-run if the label sizes/copy change.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-grooming-labels.html");
const OUT_PDF = path.join(REPO_ROOT, "assets", "extraction-grooming-labels.pdf");

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
