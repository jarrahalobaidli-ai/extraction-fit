// build-shop-catalog-pdf.mjs
//
// Renders extraction-shop-catalog.html (the full product-description catalog for the
// Extraction Shop -- Clothing, Patches, Grooming, Field Roast Coffee, and Bundles) to
// assets/extraction-shop-catalog.pdf. Not wired into any email/fulfillment flow -- this is
// a standalone reference document. Re-run whenever shop.html's product lineup changes.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-shop-catalog.html");
const OUT_PDF = path.join(REPO_ROOT, "assets", "extraction-shop-catalog.pdf");

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  // file:// (not setContent) so relative asset paths (assets/*.jpg, assets/*.png) resolve.
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
