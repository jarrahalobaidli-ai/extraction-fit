import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OUTBOX_SECRET = Deno.env.get("OUTBOX_SHARED_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Resend's shared sandbox sender -- works with zero setup. Switch to a
// verified extraction.fit address once the domain is verified in Resend.
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") || "Extraction <onboarding@resend.dev>";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Rules & Regulations SOP -- attached to every operator_welcome send so every newly
// registered operator (self-serve or coach-onboarded) gets it automatically. Fetched live
// from the site rather than embedded, so editing extraction-rules-and-regulations.html and
// regenerating the PDF (tools/build-send-email-function.mjs) is enough -- no redeploy of
// this function is needed to pick up a revision.
const RULES_REGS_PDF_URL = "https://extraction.fit/assets/extraction-rules-and-regulations.pdf";

async function rulesRegsAttachment(): Promise<{ filename: string; content: string }[]> {
  try {
    const resp = await fetch(RULES_REGS_PDF_URL);
    if (!resp.ok) throw new Error(`fetch ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return [{ filename: "Extraction-Rules-and-Regulations.pdf", content: btoa(binary) }];
  } catch (e) {
    // Don't fail the whole welcome email over a missing/unreachable SOP PDF -- log and send
    // without the attachment. Common cause: the PDF hasn't been pushed to the live site yet.
    console.error("rules_regs attachment fetch failed:", String(e));
    return [];
  }
}

type EmailRow = {
  id: string;
  template: string;
  to_email: string;
  to_name: string | null;
  data: Record<string, unknown> | null;
};

type Template = {
  subject: string | ((row: EmailRow) => string);
  html: string | ((row: EmailRow) => string);
  // Attachments this template always sends, beyond anything data-driven.
  attachments?: () => Promise<{ filename: string; content: string }[]>;
};

const TEMPLATES: Record<string, Template> = {
  operator_welcome: {
    subject: "Welcome To The Field, Operator.",
    // Every operator -- self-serve $97 buyer or coach-onboarded client -- gets the Rules &
    // Regulations SOP attached here. It's the one doc every operator needs before session one.
    attachments: rulesRegsAttachment,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Extraction — Welcome to the Field</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0A;">
<!-- Preview text (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
Orders are cut. You're in the field now — here's your first tasking.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0A;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#17140F;border:1px solid rgba(245,223,184,0.14);">

  <!-- Header -->
  <tr>
    <td align="center" style="padding:36px 32px 20px;border-bottom:1px solid rgba(245,223,184,0.14);">
      <img src="https://extraction.fit/assets/logo-circle.png" width="56" height="56" alt="Extraction" style="display:block;margin:0 auto 14px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:20px;letter-spacing:2px;color:#F5DFB8;text-transform:uppercase;">
        EXTRACTION<span style="color:#C0451D;">.</span>
      </div>
    </td>
  </tr>

  <!-- Status strip -->
  <tr>
    <td align="center" style="padding:22px 32px 0;">
      <div style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#A6926F;text-transform:uppercase;border:1px solid rgba(245,223,184,0.30);padding:8px 16px;">
        QRF Sitrep — Operator Onboarding
      </div>
    </td>
  </tr>

  <!-- Headline -->
  <tr>
    <td align="center" style="padding:24px 32px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:26px;line-height:1.3;color:#F5DFB8;text-transform:uppercase;letter-spacing:0.5px;">
        Welcome To The Field, Operator.
      </div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:20px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#D9CDBB;">
      <p style="margin:0 0 16px;">This is QRF — the team standing by behind every Extraction program. Your orders are cut, your heading is designated, and as of today you're no longer standing on the wire watching. You're in it.</p>
      <p style="margin:0 0 16px;">No one is coming to run this program for you. That's not a threat — it's the whole point. What follows is how we get you moving from day one.</p>
    </td>
  </tr>

  <!-- Briefing block -->
  <tr>
    <td style="padding:4px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">01 — Report in.</strong> Log into your portal and confirm your access — that's your operations center for the length of the program.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">02 — Read the SOP.</strong> The Rules &amp; Regulations doc is attached to this email — chain of command, mission timeline, and what's expected of both sides. Read it before session one.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">03 — Know your tasking.</strong> Your first week's program is loaded and waiting. Read it in full before your first session — no moving off a briefing you haven't read.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);border-bottom:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">04 — Keep comms open.</strong> Questions, sitreps, or a session you need to shift — QRF is one message away. You are never operating without support.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Expectations -->
  <tr>
    <td style="padding:24px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#D9CDBB;">
      <p style="margin:0 0 16px;">This isn't a program you finish by wanting it. It's finished by showing up on the days you don't feel like it, reporting your numbers honestly, and trusting the process even when week one feels harder than you expected. That's normal. That's the extraction point everyone has to pass through.</p>
      <p style="margin:0;">Designate your heading. We'll see you in the field.</p>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td align="center" style="padding:28px 40px 8px;">
      <a href="https://extraction.fit/portal.html" style="display:inline-block;background:#C0451D;color:#0C0C0A;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:15px 30px;border:1px solid #C0451D;">
        Enter Your Training Dashboard
      </a>
    </td>
  </tr>

  <!-- Sign-off -->
  <tr>
    <td style="padding:28px 40px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#A6926F;">
      <p style="margin:0;">Standing by,<br>— QRF Team, Extraction</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td align="center" style="padding:24px 32px 32px;border-top:1px solid rgba(245,223,184,0.14);">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#7A6E5C;text-transform:uppercase;margin-bottom:10px;">
        EXTRACTION // FROM MEDIOCRITY // NO ONE IS COMING
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5C544A;">
        You're receiving this because you enrolled in an Extraction program.<br>
        Questions? <a href="mailto:contact@extraction.fit" style="color:#7A6E5C;">contact@extraction.fit</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>
`,
  },
  waitlist_welcome: {
    subject: "You're On The List — Extraction",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Extraction — Founding Access Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0A;">
<!-- Preview text (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
Coordinates locked. You're on the founding list — here's what that gets you.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0A;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#17140F;border:1px solid rgba(245,223,184,0.14);">

  <!-- Header -->
  <tr>
    <td align="center" style="padding:36px 32px 20px;border-bottom:1px solid rgba(245,223,184,0.14);">
      <img src="https://extraction.fit/assets/logo-circle.png" width="56" height="56" alt="Extraction" style="display:block;margin:0 auto 14px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:20px;letter-spacing:2px;color:#F5DFB8;text-transform:uppercase;">
        EXTRACTION<span style="color:#C0451D;">.</span>
      </div>
    </td>
  </tr>

  <!-- Status strip -->
  <tr>
    <td align="center" style="padding:22px 32px 0;">
      <div style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#A6926F;text-transform:uppercase;border:1px solid rgba(245,223,184,0.30);padding:8px 16px;">
        Coordinates Locked — Founding Access Confirmed
      </div>
    </td>
  </tr>

  <!-- Headline -->
  <tr>
    <td align="center" style="padding:24px 32px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:26px;line-height:1.3;color:#F5DFB8;text-transform:uppercase;letter-spacing:0.5px;">
        You're On The List.
      </div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:20px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#D9CDBB;">
      <p style="margin:0 0 16px;">No one is coming to build this for you — you designated your own heading and got here first. That puts you on the founding roster for the Extraction armory, ahead of the general list.</p>
      <p style="margin:0 0 16px;">Here's what that means, exactly:</p>
    </td>
  </tr>

  <!-- Benefits block -->
  <tr>
    <td style="padding:4px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">01 —</strong> First access when the armory opens, before it's announced publicly.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">02 —</strong> Launch pricing locked in for founding members — no price increases at your door.
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);border-bottom:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;">
            <strong style="color:#C0451D;">03 —</strong> First look at every drop: patches, apparel, and field gear, before general release.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- What's coming -->
  <tr>
    <td style="padding:24px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#D9CDBB;">
      <p style="margin:0 0 16px;">The armory is still stocking up — morale patches, apparel, and field grooming, built for the community, not just operators. Checkout isn't live yet. When it is, you'll hear it here first, before anywhere else.</p>
      <p style="margin:0;">Until then — hold your position.</p>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td align="center" style="padding:28px 40px 8px;">
      <a href="https://extraction.fit/shop.html" style="display:inline-block;background:#C0451D;color:#0C0C0A;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:15px 30px;border:1px solid #C0451D;">
        Review The Concepts
      </a>
    </td>
  </tr>

  <!-- Sign-off -->
  <tr>
    <td style="padding:28px 40px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#A6926F;">
      <p style="margin:0;">Designate your heading.<br>— Extraction</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td align="center" style="padding:24px 32px 32px;border-top:1px solid rgba(245,223,184,0.14);">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#7A6E5C;text-transform:uppercase;margin-bottom:10px;">
        EXTRACTION // FROM MEDIOCRITY // NO ONE IS COMING
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5C544A;">
        You're receiving this because you joined the Extraction founding list at extraction.fit.<br>
        Want off the list? Reply or email <a href="mailto:contact@extraction.fit?subject=Unsubscribe" style="color:#7A6E5C;">contact@extraction.fit</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>
`,
  },
  // Sent by the fulfillment pipeline once a self-serve buyer's personalized manual PDF has
  // been rendered and uploaded to the private manuals-pdf Storage bucket. row.data carries
  // { buyerName, manualName, downloadUrl } -- downloadUrl is a short-lived signed URL, not a
  // permanent public link (see tools/fulfill-purchase.mjs).
  pdf_delivery: {
    subject: (row) => `Your ${String(row.data?.manualName ?? "90-Day Manual")} Is Ready`,
    html: (row) => {
      const buyerName = String(row.data?.buyerName ?? row.to_name ?? "Operator");
      const manualName = String(row.data?.manualName ?? "90-Day Extraction Protocol");
      const downloadUrl = String(row.data?.downloadUrl ?? "https://extraction.fit/portal.html");
      return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Extraction — Your Manual Is Ready</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0A;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
Orders are cut. Your personalized manual is ready to download.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0A;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#17140F;border:1px solid rgba(245,223,184,0.14);">
  <tr>
    <td align="center" style="padding:36px 32px 20px;border-bottom:1px solid rgba(245,223,184,0.14);">
      <img src="https://extraction.fit/assets/logo-circle.png" width="56" height="56" alt="Extraction" style="display:block;margin:0 auto 14px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:20px;letter-spacing:2px;color:#F5DFB8;text-transform:uppercase;">
        EXTRACTION<span style="color:#C0451D;">.</span>
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:22px 32px 0;">
      <div style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#A6926F;text-transform:uppercase;border:1px solid rgba(245,223,184,0.30);padding:8px 16px;">
        Orders Cut — Manual Ready
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 32px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:24px;line-height:1.3;color:#F5DFB8;text-transform:uppercase;letter-spacing:0.5px;">
        ${buyerName}, Your Manual Is Ready.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 40px 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#D9CDBB;">
      <p style="margin:0 0 16px;">Your <strong style="color:#F5DFB8;">${manualName}</strong> is built, watermarked to you, and ready to download — every exercise linked to a form-check video.</p>
      <p style="margin:0 0 16px;">This link is personal to your order and expires in 7 days. You can always re-download from your portal after that.</p>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:16px 40px 8px;">
      <a href="${downloadUrl}" style="display:inline-block;background:#C0451D;color:#0C0C0A;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:15px 30px;border:1px solid #C0451D;">
        Download Your Manual
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:10px 40px 8px;">
      <a href="https://extraction.fit/portal.html" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#A6926F;">Or sign in to your portal</a>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 40px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#A6926F;">
      <p style="margin:0;">Designate your heading.<br>— Extraction</p>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 32px 32px;border-top:1px solid rgba(245,223,184,0.14);">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#7A6E5C;text-transform:uppercase;margin-bottom:10px;">
        EXTRACTION // FROM MEDIOCRITY // NO ONE IS COMING
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5C544A;">
        Licensed to ${buyerName} — not for resale or redistribution.<br>
        Questions? <a href="mailto:contact@extraction.fit" style="color:#7A6E5C;">contact@extraction.fit</a>
      </div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
    },
  },
};

const MAYDAY_EQUIPMENT_LABELS: Record<string, string> = {
  eq_fullgym: "Full gym",
  eq_dbkb: "Functional training",
  eq_bodyweight: "Bodyweight only",
  eq_bands: "Bands only",
};

// Fired automatically by on_mayday_submission_created whenever a MAYDAY intake form is
// submitted (see supabase migration). Notifies the Extraction command inbox so a report
// never depends on the applicant's own mail app or WhatsApp actually going through --
// row.data carries the raw mayday_submissions row (name/email/phone/equipment/lang/
// submittedAt) plus the full `answers` form object.
const MAYDAY_ALERT: Template = {
  subject: (row) => `MAYDAY — ${String(row.data?.name ?? "New applicant")}`,
  html: (row) => {
    const a = (row.data?.answers ?? {}) as Record<string, unknown>;
    const name = String(row.data?.name ?? a.name ?? "-");
    const email = String(row.data?.email ?? a.email ?? "-");
    const phone = String(row.data?.phone ?? "").trim();
    const equipmentKey = String(row.data?.equipment ?? a.equipment ?? "");
    const equipment = MAYDAY_EQUIPMENT_LABELS[equipmentKey] || equipmentKey || "-";
    const submittedAt = String(row.data?.submittedAt ?? "");
    const commitments = [
      a.agreePhotos ? "Progress photos" : null,
      a.agreeFinancial ? "Financial commitment" : null,
      a.agreeCode ? "Code of conduct" : null,
    ].filter(Boolean).join(", ") || "None flagged";
    const line = (n: string, tag: string, label: string, value: string) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(245,223,184,0.14);font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#F5DFB8;vertical-align:top;">
            <strong style="color:#C0451D;">${n} — ${tag}.</strong> ${label}: ${value}
          </td>
        </tr>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Extraction — MAYDAY Received</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0A;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
New MAYDAY report from ${name} — ${equipment}.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0A;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#17140F;border:1px solid rgba(245,223,184,0.14);">
  <tr>
    <td align="center" style="padding:36px 32px 20px;border-bottom:1px solid rgba(245,223,184,0.14);">
      <img src="https://extraction.fit/assets/logo-circle.png" width="56" height="56" alt="Extraction" style="display:block;margin:0 auto 14px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:20px;letter-spacing:2px;color:#F5DFB8;text-transform:uppercase;">
        EXTRACTION<span style="color:#C0451D;">.</span>
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:22px 32px 0;">
      <div style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#C0451D;text-transform:uppercase;border:1px solid rgba(192,69,29,0.5);padding:8px 16px;">
        MAYDAY Received
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 32px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:24px;line-height:1.3;color:#F5DFB8;text-transform:uppercase;letter-spacing:0.5px;">
        ${name}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#A6926F;margin-top:6px;">
        ${email}${phone ? " · " + phone : ""}
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 40px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${line("1", "ID", "Contact", `${name} · ${email}${phone ? " · " + phone : ""}`)}
        ${line("2", "M", "Mission (why now)", String(a.whyNow ?? "-"))}
        ${line("3", "I", "Injuries", `${String(a.injuries ?? "None reported")}${a.failureResponse === "spiral" ? " -- spirals after a missed day" : ""}`)}
        ${line("4", "S", "Status", `${String(a.trainingAge ?? "-")} · Discipline ${String(a.disciplineRating ?? "-")}/10 · ${String(a.medicalClearance ?? "Not stated")}`)}
        ${line("5", "RES", "Resources", equipment)}
        ${line("6", "PRI", "Program", `${String(a.daysPerWeek ?? "-")} days/week, ${String(a.sessionLength ?? "-")} min`)}
        ${line("7", "T", "Target (becoming)", String(a.becoming ?? "-"))}
        ${line("8", "SEC", "Support system", String(a.supportSystem ?? "Not stated"))}
        ${line("9", "HAZ", "Commitments flagged", commitments)}
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:28px 40px 8px;">
      <a href="https://extraction.fit/dashboard.html" style="display:inline-block;background:#C0451D;color:#0C0C0A;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:15px 30px;border:1px solid #C0451D;">
        Open Coach Dashboard
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 40px 8px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5C544A;">
      Submitted ${submittedAt} · Lang: ${String(row.data?.lang ?? "en")}
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:24px 32px 32px;border-top:1px solid rgba(245,223,184,0.14);">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;color:#7A6E5C;text-transform:uppercase;">
        EXTRACTION // FROM MEDIOCRITY // NO ONE IS COMING
      </div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
  },
};
TEMPLATES.mayday_alert = MAYDAY_ALERT;

Deno.serve(async (req: Request) => {
  try {
    if (!OUTBOX_SECRET || req.headers.get("x-outbox-secret") !== OUTBOX_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }

    const { outbox_id } = await req.json();
    if (!outbox_id) {
      return new Response(JSON.stringify({ error: "missing outbox_id" }), { status: 400 });
    }

    const { data: row, error: fetchErr } = await supabase
      .from("email_outbox")
      .select("*")
      .eq("id", outbox_id)
      .single();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: "outbox row not found" }), { status: 404 });
    }

    if (row.status === "sent") {
      return new Response(JSON.stringify({ ok: true, skipped: "already sent" }), { status: 200 });
    }

    const tpl = TEMPLATES[row.template];
    if (!tpl) {
      await supabase.from("email_outbox").update({ status: "failed", error: `unknown template ${row.template}` }).eq("id", outbox_id);
      return new Response(JSON.stringify({ error: "unknown template" }), { status: 400 });
    }

    if (!RESEND_API_KEY) {
      await supabase.from("email_outbox").update({ status: "failed", error: "RESEND_API_KEY not configured" }).eq("id", outbox_id);
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 200 });
    }

    const subject = typeof tpl.subject === "function" ? tpl.subject(row) : tpl.subject;
    const html = typeof tpl.html === "function" ? tpl.html(row) : tpl.html;
    const attachments = tpl.attachments ? await tpl.attachments() : undefined;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [row.to_email],
        subject,
        html,
        ...(attachments ? { attachments } : {}),
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      await supabase.from("email_outbox").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", outbox_id);
      return new Response(JSON.stringify({ error: "resend failed", detail: errText }), { status: 200 });
    }

    await supabase.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", outbox_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
