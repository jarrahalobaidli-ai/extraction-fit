// generate-client-manual.mjs
//
// Produces ONE real, ready-to-deliver manual + invoice for a specific paying client, with
// no "SAMPLE" text anywhere and no Supabase/service-role key needed -- for manually
// fulfilling an order (WhatsApp/email + bank transfer) before MyFatoorah is wired up, or
// any time you want to hand-generate a client's files without running the full
// fulfill-purchase.mjs pipeline (which also creates a portal account, uploads to Storage,
// and queues emails -- this script only renders the two PDFs to your local disk).
//
// The manuals-pdf/*.pdf files checked into this repo are a separate thing: 12 generic
// reference/preview copies (one per equipment x frequency combo, watermarked "SAMPLE —
// Preview Copy") for showing what the manual looks like -- not tied to any customer, and
// not meant to be sent to one. This script is what actually produces a client's real copy.
//
// Usage:
//   node tools/generate-client-manual.mjs '{"orderId":"EXT-...","name":"...","email":"...","equipment":"Full gym","daysPerWeek":"4"}'
//
// Optional fields: amountCents (default 9700), currency (default "USD").
// Output: deliveries/<orderId>/<orderId>-manual.pdf and <orderId>-invoice.pdf

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFullProgram, manualNameFor, MODALITY_LEVELS, DAYS_PER_WEEK_OPTIONS } from "../program-generator.mjs";
import { generateManualPdf } from "./generate-manual-pdfs.mjs";
import { generateInvoicePdf } from "./generate-invoice-pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const logoDataUri = () =>
  `data:image/png;base64,${fs.readFileSync(path.join(REPO_ROOT, "assets", "logo-rectangle-transparent.png")).toString("base64")}`;

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'Usage: node tools/generate-client-manual.mjs \'{"orderId":"...","name":"...","email":"...","equipment":"Full gym","daysPerWeek":"4"}\''
    );
    process.exit(1);
  }
  const input = JSON.parse(arg);
  const { orderId, name, email, equipment, daysPerWeek, amountCents = 9700, currency = "USD" } = input;

  if (!orderId || !name || !email) throw new Error("orderId, name, and email are required");
  if (!MODALITY_LEVELS.includes(equipment)) {
    throw new Error(`equipment must be one of: ${MODALITY_LEVELS.join(", ")}`);
  }
  if (!DAYS_PER_WEEK_OPTIONS.includes(String(daysPerWeek))) {
    throw new Error(`daysPerWeek must be one of: ${DAYS_PER_WEEK_OPTIONS.join(", ")}`);
  }

  const issuedDate = new Date().toISOString().slice(0, 10);
  const buyer = { name, orderId, issuedDate, logoDataUri: logoDataUri() };

  console.log(`Rendering manual for ${name} (Order ${orderId})...`);
  const manualBytes = await generateManualPdf({ level: equipment, daysPerWeek: String(daysPerWeek), buyer });

  const priceMajor = amountCents / 100;
  const manualName = manualNameFor(equipment, String(daysPerWeek));
  const invoiceNumber = `INV-${orderId}`;
  console.log(`Rendering invoice ${invoiceNumber}...`);
  const invoiceBytes = await generateInvoicePdf({
    invoice: {
      number: invoiceNumber,
      issuedDate,
      currency,
      status: "PAID",
      items: [
        { description: `${manualName} — Digital Manual + Lifetime Portal Access`, qty: 1, unitPrice: priceMajor, total: priceMajor },
      ],
      total: priceMajor,
    },
    buyer: { name, email, orderId, logoDataUri: logoDataUri() },
  });

  const outDir = path.join(REPO_ROOT, "deliveries", orderId);
  fs.mkdirSync(outDir, { recursive: true });
  const manualPath = path.join(outDir, `${orderId}-manual.pdf`);
  const invoicePath = path.join(outDir, `${orderId}-invoice.pdf`);
  fs.writeFileSync(manualPath, manualBytes);
  fs.writeFileSync(invoicePath, invoiceBytes);

  console.log(`\nDone. Ready to send:\n  ${manualPath}\n  ${invoicePath}`);
}

main().catch((err) => {
  console.error("generate-client-manual failed:", err.message);
  process.exit(1);
});
