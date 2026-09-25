// myfatoorah-webhook/index.ts
//
// Receives MyFatoorah's Webhook V2 PAYMENT_STATUS_CHANGED event and closes the loop
// create-payment-link left open: when a customer actually pays, this flips the matching
// `purchases` row from 'pending' to 'paid' (matched on order_id = the event's
// CustomerReference, which we set to our own orderId when generating the link) and queues
// an `order_paid_alert` email to the shop owner with a ready-to-paste fulfillment command.
//
// SCOPE: this still does NOT run fulfillment. It only tells the owner an order is real and
// paid -- they still decide when to run `node tools/fulfill-purchase.mjs '<...>'` by hand.
// MyFatoorah's own docs recommend not relying on the webhook alone (their retries can be
// delayed or occasionally missed) -- the 'pending' row in `purchases` is itself the backstop:
// if this webhook never fires, the order is still visible and traceable in the dashboard/DB,
// not silently lost.
//
// SETUP (once you have a MyFatoorah account):
//   1. In the MyFatoorah portal, register this function's URL as a Webhook V2 endpoint for
//      the "Payment Status Changed" event, and copy the webhook secret key it gives you.
//   2. Set MYFATOORAH_WEBHOOK_SECRET as a Supabase Edge Function secret to that value.
//   3. Send yourself one real test payment and check this function's logs
//      (query_logs / Supabase dashboard) -- see the signature note below before trusting it.
//
// REQUIRED SECRETS:
//   MYFATOORAH_WEBHOOK_SECRET  -- optional but strongly recommended; see signature note below
//   OWNER_NOTIFY_EMAIL         -- optional, defaults to contact@extraction.fit
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already configured for the other functions.
//
// SIGNATURE VERIFICATION -- READ BEFORE TRUSTING THIS IN PRODUCTION:
// MyFatoorah signs webhooks with an HMAC-SHA256 of a canonical "key=value,key2=value2"
// string built from specific Data fields *in the order their docs specify for that event
// type*, base64-encoded, sent as the `myfatoorah-signature` header. That general mechanism
// is documented; the exact field order for PAYMENT_STATUS_CHANGED specifically could not be
// confirmed from this sandbox (MyFatoorah's docs site is network-blocked here). The field
// order below (PAYMENT_STATUS_SIGNATURE_FIELDS) is a best-effort guess from their own
// example payload ordering, NOT verified against a real signed request.
//
// If it's wrong, verification always fails closed (401, logged) -- MyFatoorah retries a few
// times then gives up, and the purchases row stays 'pending' instead of silently becoming
// 'paid' on a forged request. That's the safe failure mode. The first time you get a real
// webhook, check this function's logs: they print both the computed and received signature
// (never the secret itself) on a mismatch so the field order can be corrected in one place.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MYFATOORAH_WEBHOOK_SECRET = Deno.env.get("MYFATOORAH_WEBHOOK_SECRET") ?? "";
const OWNER_NOTIFY_EMAIL = Deno.env.get("OWNER_NOTIFY_EMAIL") || "contact@extraction.fit";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Best-effort field order for the PAYMENT_STATUS_CHANGED canonical string -- see the
// signature note above. Edit this one array if MyFatoorah's real order turns out different.
const PAYMENT_STATUS_SIGNATURE_FIELDS = [
  "InvoiceId",
  "InvoiceReference",
  "CustomerReference",
  "TransactionStatus",
];

async function computeSignature(data: Record<string, unknown>, secret: string): Promise<string> {
  const canonical = PAYMENT_STATUS_SIGNATURE_FIELDS
    .map((k) => `${k}=${data[k] ?? ""}`)
    .join(",");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical)));
  let binary = "";
  for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i]);
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
    }

    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
    }

    // Webhook V2 wraps the event data; be defensive about the exact wrapper shape since
    // it couldn't be confirmed live from this sandbox either -- fall back to the top level.
    const data = (payload.Data ?? payload.data ?? payload) as Record<string, unknown>;

    if (MYFATOORAH_WEBHOOK_SECRET) {
      const received = req.headers.get("myfatoorah-signature") ?? "";
      const expected = await computeSignature(data, MYFATOORAH_WEBHOOK_SECRET);
      if (!received || received !== expected) {
        console.error(
          "myfatoorah-webhook: signature mismatch -- received:",
          received,
          "expected:",
          expected,
          "canonical fields used:",
          PAYMENT_STATUS_SIGNATURE_FIELDS.join(",")
        );
        return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
      }
    } else {
      console.error("myfatoorah-webhook: MYFATOORAH_WEBHOOK_SECRET not set -- accepting unverified (set this secret before going live)");
    }

    const orderId = String(data.CustomerReference ?? "").trim();
    const transactionStatus = String(data.TransactionStatus ?? "").trim().toUpperCase();
    const invoiceId = data.InvoiceId ?? null;

    if (!orderId) {
      console.error("myfatoorah-webhook: no CustomerReference in payload:", rawBody.slice(0, 500));
      // Still 200 -- this isn't a delivery failure MyFatoorah should retry, it's an event we
      // can't match to an order (e.g. a payment made outside our own SendPayment flow).
      return new Response(JSON.stringify({ ok: true, skipped: "no CustomerReference" }), { status: 200 });
    }

    if (transactionStatus !== "SUCCESS") {
      // Record the failure but don't alert the owner -- a failed/expired attempt isn't
      // actionable for them, and the customer can just retry the same link.
      await supabase
        .from("purchases")
        .update({ status: "failed" })
        .eq("order_id", orderId)
        .eq("status", "pending");
      return new Response(JSON.stringify({ ok: true, status: transactionStatus }), { status: 200 });
    }

    // Idempotent: only flip + alert once. A retried webhook delivery for an already-paid (or
    // already-fulfilled) order is a no-op past here.
    const { data: updated, error: updateErr } = await supabase
      .from("purchases")
      .update({ status: "paid", paid_at: new Date().toISOString(), myfatoorah_invoice_id: invoiceId })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error("myfatoorah-webhook: purchases update failed:", updateErr.message);
      return new Response(JSON.stringify({ error: "db update failed" }), { status: 500 });
    }

    if (!updated) {
      // Either already paid/fulfilled (duplicate delivery -- fine), or no 'pending' row
      // exists for this order_id at all (shouldn't happen since create-payment-link writes
      // one, but don't lose the event silently if it does).
      console.error(`myfatoorah-webhook: no pending purchase row for order_id ${orderId} -- possible duplicate delivery or unmatched order`);
      return new Response(JSON.stringify({ ok: true, skipped: "no matching pending order" }), { status: 200 });
    }

    const purchaseJson = JSON.stringify({
      orderId: updated.order_id,
      email: updated.email,
      name: updated.name,
      equipment: updated.equipment,
      daysPerWeek: updated.days_per_week,
    });

    const { error: outboxErr } = await supabase.from("email_outbox").insert({
      template: "order_paid_alert",
      to_email: OWNER_NOTIFY_EMAIL,
      to_name: "Extraction",
      data: {
        orderId: updated.order_id,
        buyerName: updated.name,
        buyerEmail: updated.email,
        equipment: updated.equipment,
        daysPerWeek: updated.days_per_week,
        amount: (updated.amount_cents / 100).toFixed(2),
        currency: updated.currency,
        purchaseJson,
      },
    });
    if (outboxErr) console.error("myfatoorah-webhook: order_paid_alert insert failed:", outboxErr.message);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("myfatoorah-webhook error:", String(e));
    return new Response(JSON.stringify({ error: "unexpected error" }), { status: 500 });
  }
});
