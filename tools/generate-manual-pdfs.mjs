// generate-manual-pdfs.mjs
//
// Renders all 12 equipment-level x days/week manuals to branded, watermarked PDF files.
// Used two ways:
//   1. Run directly (`node tools/generate-manual-pdfs.mjs`) to produce the 12 reference/
//      preview PDFs in manuals-pdf/ (watermarked "SAMPLE — Preview Copy", not tied to a
//      real buyer).
//   2. Imported by the fulfillment handler (see tools/fulfill-purchase.mjs) to render ONE
//      personalized, watermarked PDF for a real buyer at purchase time via generateManualPdf().
//
// Requires: playwright (Chromium at /opt/pw-browsers/chromium-1194/chrome-linux/chrome in
// this environment — adjust CHROMIUM_PATH for a different host) and pdf-lib.

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFullProgram,
  MODALITY_LEVELS,
  DAYS_PER_WEEK_OPTIONS,
} from "../program-generator.mjs";
import { renderManualHtml } from "./pdf-template.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Cover uses the full wordmark/compass lockup, background-keyed transparent so it blends
// into the cover's own dark gradient instead of sitting in a visible black box.
const LOGO_PATH = path.join(REPO_ROOT, "assets", "logo-rectangle-transparent.png");
const logoDataUri = () =>
  `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString("base64")}`;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function footerTemplate(buyer) {
  const line = `${buyer.name} · Order ${buyer.orderId} · Licensed to ${buyer.name} — not for redistribution · contact@extraction.fit`;
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:6.5px;color:#7A6E5C;width:100%;text-align:center;padding:0 30px;">
      ${line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}
      &nbsp;&mdash;&nbsp;Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`;
}

// Renders and returns ONE personalized PDF as a Buffer. Does not write to disk — callers
// (the sample-batch runner below, or a fulfillment handler) decide where it goes.
export async function generateManualPdf({ level, daysPerWeek, buyer }) {
  const program = { ...buildFullProgram(level, daysPerWeek), level };
  const html = renderManualHtml({ program, buyer });

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(buyer),
      margin: { top: "10mm", bottom: "14mm", left: "0mm", right: "0mm" },
    });

    // Stamp real PDF metadata (Title/Author/Subject) — pdf.print() doesn't set these itself.
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.setTitle(`${program.name} — ${buyer.name}`);
    pdfDoc.setAuthor("Extraction");
    pdfDoc.setSubject(`Licensed to ${buyer.name} — Order ${buyer.orderId} — not for redistribution`);
    pdfDoc.setKeywords(["Extraction", "90-Day Protocol", buyer.orderId]);
    pdfDoc.setProducer("Extraction Fulfillment");
    pdfDoc.setCreator("Extraction Fulfillment");
    const finalBytes = await pdfDoc.save();

    return Buffer.from(finalBytes);
  } finally {
    await browser.close();
  }
}

/* ---------- batch runner: generate all 12 sample/reference PDFs ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = path.join(REPO_ROOT, "manuals-pdf");
  fs.mkdirSync(outDir, { recursive: true });
  const logo = logoDataUri();
  const issuedDate = new Date().toISOString().slice(0, 10);

  let n = 0;
  for (const level of MODALITY_LEVELS) {
    for (const dpw of DAYS_PER_WEEK_OPTIONS) {
      n++;
      const orderId = `SAMPLE-${slug(level).toUpperCase()}-${dpw}D`;
      const buyer = {
        name: "SAMPLE — Preview Copy",
        orderId,
        issuedDate,
        logoDataUri: logo,
      };
      const bytes = await generateManualPdf({ level, daysPerWeek: dpw, buyer });
      const outPath = path.join(outDir, `${slug(level)}-${dpw}-days-week.pdf`);
      fs.writeFileSync(outPath, bytes);
      console.log(`[${n}/12] ${outPath} (${(bytes.length / 1024).toFixed(0)} KB)`);
    }
  }
  console.log(`\nDone — ${n} manual PDFs written to ${outDir}/`);
}
