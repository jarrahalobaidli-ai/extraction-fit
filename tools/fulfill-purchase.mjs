// fulfill-purchase.mjs
//
// Turns one paid $97 self-serve sale into: a purchases row, a self-serve operator account
// (auth user + profiles + clients, no coach involvement), a personalized watermarked manual
// PDF and a matching invoice PDF in private Storage, and the two delivery emails
// (operator_welcome with the Rules & Regs SOP attached, then pdf_delivery with the manual
// AND the invoice attached directly, plus signed download links as a 7-day backup) -- via
// the existing email_outbox table, which a DB trigger (on_email_outbox_created) auto-sends
// through the send-email edge function.
//
// WHERE THIS RUNS: this needs Node + a real Chromium (Playwright) to render the PDF, which
// a Supabase Edge Function (Deno, no persistent browser) cannot do. So this is NOT deployed
// to Supabase -- it needs a small always-on or on-demand Node host that a Gumroad webhook
// (or a Zapier/Make automation bridging Gumroad -> HTTP POST) can call, OR it can be run
// by hand for now: `node tools/fulfill-purchase.mjs '<purchase JSON>'`.
//
// REQUIRED ENV VARS (never hardcode these):
//   SUPABASE_URL                 -- e.g. https://nhypmosbyqngfbiwxoow.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    -- service role key, server-side only, never exposed to a browser
//
// Purchase shape (what a Gumroad webhook payload should be mapped to before calling this):
//   {
//     orderId: string,           // Gumroad sale_id
//     email: string,
//     name: string,
//     equipment: "Full gym" | "Functional training" | "Bodyweight only" | "Bands only",
//     daysPerWeek: "3" | "4" | "5" | "6",
//     amountCents?: number,
//     currency?: string,
//   }

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFullProgram, manualNameFor } from "../program-generator.mjs";
import { generateManualPdf } from "./generate-manual-pdfs.mjs";
import { generateInvoicePdf } from "./generate-invoice-pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script. " +
        "These are secrets -- never commit them or pass them on the command line where they'd land in shell history."
    );
  }
}

// Cover uses the full wordmark/compass lockup, background-keyed transparent so it blends
// into the cover's own dark gradient instead of sitting in a visible black box.
const logoDataUri = () =>
  `data:image/png;base64,${fs.readFileSync(path.join(REPO_ROOT, "assets", "logo-rectangle-transparent.png")).toString("base64")}`;

export async function fulfillPurchase(purchase) {
  requireEnv();
  const { orderId, email, name, equipment, daysPerWeek, amountCents, currency } = purchase;
  if (!orderId || !email || !name || !equipment || !daysPerWeek) {
    throw new Error("purchase requires orderId, email, name, equipment, daysPerWeek");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Record the sale. Idempotent on order_id -- a retried webhook delivery is a no-op past here.
  const { data: existing } = await supabase
    .from("purchases")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing?.status === "fulfilled") {
    return { ok: true, skipped: "already fulfilled", purchaseId: existing.id };
  }

  const { data: purchaseRow, error: purchaseErr } = await supabase
    .from("purchases")
    .upsert(
      {
        order_id: orderId,
        email,
        name,
        equipment,
        days_per_week: daysPerWeek,
        amount_cents: amountCents ?? 9700,
        currency: currency ?? "USD",
        status: "paid",
      },
      { onConflict: "order_id" }
    )
    .select()
    .single();
  if (purchaseErr) throw purchaseErr;

  // 2. Find or create the matching manual (reuses the coach dashboard's own generator, so a
  // self-serve manual is byte-for-byte the same program a coach would assign).
  const manualName = manualNameFor(equipment, daysPerWeek);
  let { data: manual } = await supabase.from("manuals").select("*").eq("name", manualName).maybeSingle();
  if (!manual) {
    const program = buildFullProgram(equipment, daysPerWeek);
    const { data: newManual, error: manualErr } = await supabase
      .from("manuals")
      .insert({ name: program.name, description: program.description, weeks: program.weeks })
      .select()
      .single();
    if (manualErr) throw manualErr;
    manual = newManual;
  }

  // 3. Self-serve account: an auth user with no coach involvement, a profile, and a clients
  // row. tier stays 'flagship' -- same full-manual-always-visible behavior a coach-assigned
  // flagship client gets; clients.data records how this one actually arrived.
  const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1, email });
  let authUser = authList?.users?.[0];
  if (!authUser) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr) throw createErr;
    authUser = created.user;
  }

  await supabase.from("profiles").upsert({ id: authUser.id, email, name, role: "client" });

  let { data: client } = await supabase.from("clients").select("*").eq("profile_id", authUser.id).maybeSingle();
  if (!client) {
    const { data: newClient, error: clientErr } = await supabase
      .from("clients")
      .insert({
        profile_id: authUser.id,
        name,
        email,
        equipment,
        manual_id: manual.id,
        tier: "flagship",
        data: { source: "self_serve", days_per_week: daysPerWeek, order_id: orderId },
      })
      .select()
      .single();
    if (clientErr) throw clientErr;
    client = newClient;
  }

  await supabase.from("purchases").update({ manual_id: manual.id, client_id: client.id }).eq("id", purchaseRow.id);

  // 4. Render the personalized, watermarked PDF and upload it to the private bucket.
  const issuedDate = new Date().toISOString().slice(0, 10);
  const pdfBytes = await generateManualPdf({
    level: equipment,
    daysPerWeek,
    buyer: { name, orderId, issuedDate, logoDataUri: logoDataUri() },
  });
  const storagePath = `${client.id}/${orderId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("manuals-pdf")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw uploadErr;

  const { data: signed, error: signErr } = await supabase.storage
    .from("manuals-pdf")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
  if (signErr) throw signErr;

  await supabase
    .from("purchases")
    .update({ pdf_storage_path: storagePath, status: "fulfilled" })
    .eq("id", purchaseRow.id);

  // 4b. Render the matching invoice PDF and upload it next to the manual. Invoice number is
  // deterministic (INV-<orderId>) so it never needs its own DB column -- re-running fulfillment
  // for the same order just re-renders the same invoice.
  const priceMajor = (purchaseRow.amount_cents ?? 9700) / 100;
  const invoiceCurrency = purchaseRow.currency ?? "USD";
  const invoiceNumber = `INV-${orderId}`;
  const invoiceBytes = await generateInvoicePdf({
    invoice: {
      number: invoiceNumber,
      issuedDate,
      currency: invoiceCurrency,
      status: "PAID",
      items: [
        {
          description: `${manual.name} — Digital Manual + Lifetime Portal Access`,
          qty: 1,
          unitPrice: priceMajor,
          total: priceMajor,
        },
      ],
      total: priceMajor,
    },
    buyer: { name, email, orderId, logoDataUri: logoDataUri() },
  });
  const invoiceStoragePath = `${client.id}/${orderId}-invoice.pdf`;
  const { error: invoiceUploadErr } = await supabase.storage
    .from("manuals-pdf")
    .upload(invoiceStoragePath, invoiceBytes, { contentType: "application/pdf", upsert: true });
  if (invoiceUploadErr) throw invoiceUploadErr;

  const { data: invoiceSigned, error: invoiceSignErr } = await supabase.storage
    .from("manuals-pdf")
    .createSignedUrl(invoiceStoragePath, 60 * 60 * 24 * 7); // 7 days
  if (invoiceSignErr) throw invoiceSignErr;

  // 5. Queue delivery -- inserting into email_outbox is enough; on_email_outbox_created
  // fires the send-email edge function automatically for both rows. pdf_delivery's
  // attachments() fetches both downloadUrl and invoiceUrl and attaches them directly to the
  // email -- the buyer gets the manual and the invoice together, not just links.
  await supabase.from("email_outbox").insert([
    { template: "operator_welcome", to_email: email, to_name: name },
    {
      template: "pdf_delivery",
      to_email: email,
      to_name: name,
      data: {
        buyerName: name,
        manualName: manual.name,
        downloadUrl: signed.signedUrl,
        orderId,
        invoiceNumber,
        invoiceUrl: invoiceSigned.signedUrl,
      },
    },
  ]);

  return {
    ok: true,
    purchaseId: purchaseRow.id,
    clientId: client.id,
    manualId: manual.id,
    storagePath,
    invoiceNumber,
    invoiceStoragePath,
  };
}

/* ---------- CLI entrypoint: node tools/fulfill-purchase.mjs '<purchase JSON>' ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/fulfill-purchase.mjs \'{"orderId":"...","email":"...","name":"...","equipment":"Functional training","daysPerWeek":"4"}\'');
    process.exit(1);
  }
  const purchase = JSON.parse(arg);
  fulfillPurchase(purchase)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error("fulfillment failed:", err.message);
      process.exit(1);
    });
}
