// build-send-email-function.mjs
//
// Renders the current extraction-rules-and-regulations.html to PDF and drops it at
// assets/extraction-rules-and-regulations.pdf. The send-email edge function fetches that
// PDF live from https://extraction.fit/assets/extraction-rules-and-regulations.pdf and
// attaches it to every operator_welcome email -- so run this (and push the regenerated
// PDF to the live site) whenever the SOP doc changes. No edge function redeploy needed.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-rules-and-regulations.html");
const OUT_PDF = path.join(REPO_ROOT, "assets", "extraction-rules-and-regulations.pdf");

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  // Navigate by file:// URL (not setContent) so the document's relative asset paths
  // (e.g. assets/logo-lockup-light.png) resolve against its real location on disk —
  // setContent has no base URL and silently fails to load them.
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
