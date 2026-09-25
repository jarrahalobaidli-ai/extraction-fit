// create-payment-link/index.ts
//
// Called directly from the browser (shop.html's protocol checkout, index.html's offer
// checkout) when a visitor submits their order details. Generates a MyFatoorah hosted
// payment link for the $97 90-Day Extraction Protocol and queues our own branded
// "payment_link" email (via email_outbox -> send-email, same pipeline pdf_delivery uses) --
// NOT MyFatoorah's own notification email, so every email an operator gets looks like it
// came from the same system.
//
// SCOPE: this only generates + emails the payment link. It does NOT confirm payment, does
// NOT create a purchases/clients row, and does NOT trigger fulfillment -- the shop owner
// still confirms the MyFatoorah payment themselves (dashboard or bank alert) and runs
// `node tools/fulfill-purchase.mjs '<purchase JSON>'` by hand, same as today. The
// CustomerReference/UserDefinedField sent to MyFatoorah carry a ready-to-paste JSON blob
// (visible in the MyFatoorah dashboard on the invoice) so that CLI call is a copy/paste,
// not manual re-typing.
//
// REQUIRED SECRETS (Supabase project settings -> Edge Functions -> Secrets):
//   MYFATOORAH_API_KEY    -- MyFatoorah API token (test or live, matching MYFATOORAH_BASE_URL)
//   MYFATOORAH_BASE_URL   -- optional, defaults to the TEST gateway (see below)
//   MYFATOORAH_CURRENCY   -- optional, defaults to "USD"
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already configured for send-email and are
// reused here to insert into email_outbox with the same service-role client.
//
// MyFatoorah has separate test and live API bases -- apitest.myfatoorah.com vs
// api.myfatoorah.com -- with different tokens. Nothing here can be exercised end-to-end
// until MYFATOORAH_API_KEY is set to a real token from a MyFatoorah merchant account.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MYFATOORAH_API_KEY = Deno.env.get("MYFATOORAH_API_KEY") ?? "";
const MYFATOORAH_BASE_URL = Deno.env.get("MYFATOORAH_BASE_URL") || "https://apitest.myfatoorah.com";
const MYFATOORAH_CURRENCY = Deno.env.get("MYFATOORAH_CURRENCY") || "USD";
const SITE_URL = "https://extraction.fit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PRICE_USD = 97;

// Front-end <select> values ("Full Gym", "3 days/week") don't match the casing
// tools/fulfill-purchase.mjs and the purchases/manuals tables expect ("Full gym", "3").
// Normalizing here means the JSON an operator copies out of the MyFatoorah dashboard is
// paste-ready for the CLI, not something they have to hand-correct first.
const EQUIPMENT_MAP: Record<string, string> = {
  "full gym": "Full gym",
  "functional training": "Functional training",
  "bodyweight only": "Bodyweight only",
  "bands only": "Bands only",
};
function normalizeEquipment(raw: string): string | null {
  return EQUIPMENT_MAP[String(raw ?? "").trim().toLowerCase()] ?? null;
}
function normalizeDays(raw: string): string | null {
  const m = String(raw ?? "").match(/[3-6]/);
  return m ? m[0] : null;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!MYFATOORAH_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Payment links aren't configured yet -- email contact@extraction.fit instead." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const equipment = normalizeEquipment(body.equipment);
    const daysPerWeek = normalizeDays(body.daysPerWeek);

    if (!name || !email || !isValidEmail(email) || !equipment || !daysPerWeek) {
      return new Response(JSON.stringify({ error: "missing or invalid name, email, equipment, or daysPerWeek" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = `EXT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const itemDescription = `90-Day Extraction Protocol — ${equipment}, ${daysPerWeek} days/week`;
    // Paste-ready for `node tools/fulfill-purchase.mjs '<...>'` once the owner confirms payment.
    const purchaseJson = JSON.stringify({ orderId, email, name, equipment, daysPerWeek });

    const mfPayload: Record<string, unknown> = {
      NotificationOption: "LNK", // link-only -- MyFatoorah does not email/SMS it, we do
      CustomerName: name,
      CustomerEmail: email,
      InvoiceValue: PRICE_USD,
      CurrencyIso: MYFATOORAH_CURRENCY,
      DisplayCurrencyIso: MYFATOORAH_CURRENCY,
      Language: "en",
      CustomerReference: orderId,
      UserDefinedField: purchaseJson,
      CallBackUrl: `${SITE_URL}/shop.html?order=${encodeURIComponent(orderId)}&paid=1`,
      ErrorUrl: `${SITE_URL}/shop.html?order=${encodeURIComponent(orderId)}&paid=0`,
      InvoiceItems: [{ ItemName: itemDescription, Quantity: 1, UnitPrice: PRICE_USD }],
    };
    const mobileDigits = phone.replace(/[^\d]/g, "");
    if (mobileDigits.length >= 7) mfPayload.CustomerMobile = mobileDigits;

    const mfResp = await fetch(`${MYFATOORAH_BASE_URL}/v2/SendPayment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MYFATOORAH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mfPayload),
    });

    const mfJson = await mfResp.json().catch(() => null);
    if (!mfResp.ok || !mfJson?.IsSuccess || !mfJson?.Data?.InvoiceURL) {
      console.error("MyFatoorah SendPayment failed:", mfResp.status, JSON.stringify(mfJson));
      return new Response(
        JSON.stringify({
          error: "Couldn't generate a payment link right now -- email contact@extraction.fit and we'll send one manually.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentUrl = String(mfJson.Data.InvoiceURL);

    const { error: outboxErr } = await supabase.from("email_outbox").insert({
      template: "payment_link",
      to_email: email,
      to_name: name,
      data: {
        buyerName: name,
        itemDescription,
        amount: PRICE_USD.toFixed(2),
        currency: MYFATOORAH_CURRENCY,
        orderId,
        paymentUrl,
      },
    });
    if (outboxErr) {
      console.error("email_outbox insert failed:", outboxErr.message);
      return new Response(
        JSON.stringify({ error: "Payment link created but the email couldn't be queued -- email contact@extraction.fit." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, orderId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-payment-link error:", String(e));
    return new Response(JSON.stringify({ error: "unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
