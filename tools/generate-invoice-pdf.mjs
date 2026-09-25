// generate-invoice-pdf.mjs
//
// Renders one invoice (see invoice-template.mjs) to a PDF Buffer. Mirrors
// generate-manual-pdfs.mjs's Chromium/Playwright rendering approach so both PDFs in a
// fulfillment email — the manual and its invoice — come out of the same pipeline and look
// like one system.

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Renders and returns ONE invoice PDF as a Buffer. Does not write to disk or touch
// Storage — the caller (fulfill-purchase.mjs) decides where it goes.
export async function generateInvoicePdf({ invoice, buyer }) {
  const { renderInvoiceHtml } = await import("./invoice-template.mjs");
  const html = renderInvoiceHtml({ invoice, buyer });

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.setTitle(`Invoice ${invoice.number} — ${buyer.name}`);
    pdfDoc.setAuthor("Extraction");
    pdfDoc.setSubject(`Invoice for Order ${buyer.orderId}`);
    pdfDoc.setProducer("Extraction Fulfillment");
    pdfDoc.setCreator("Extraction Fulfillment");
    const finalBytes = await pdfDoc.save();

    return Buffer.from(finalBytes);
  } finally {
    await browser.close();
  }
}
