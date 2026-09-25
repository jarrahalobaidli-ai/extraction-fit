// invoice-template.mjs
//
// Renders a generic invoice (buyer + line items) into a branded, print-ready HTML document.
// Same palette/typography as pdf-template.mjs's manuals so an invoice and the manual it
// covers look like they came from the same system. Kept generic (an `items` array, not a
// hardcoded "90-Day Protocol" line) so it can cover any future line item -- shop products
// included -- once those orders have a real backend row to invoice from.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const money = (n, currency) => `${Number(n).toFixed(2)} ${currency}`;

export function renderInvoiceHtml({ invoice, buyer }) {
  const items = invoice.items || [];
  const rows = items
    .map(
      (item) => `
      <tr>
        <td class="item-desc">${esc(item.description)}</td>
        <td class="item-num">${esc(item.qty)}</td>
        <td class="item-num">${money(item.unitPrice, invoice.currency)}</td>
        <td class="item-num item-total">${money(item.total, invoice.currency)}</td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${esc(invoice.number)} — Extraction</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

  :root{
    --bg:#0C0C0A; --bg-raise:#17140F;
    --bone:#F5DFB8; --tan:#A6926F; --tan-dim:#7A6E56;
    --oxide:#C0451D; --oxide-dim:#7A2C12;
    --line:rgba(245,223,184,0.14); --line-strong:rgba(245,223,184,0.28);
  }
  *{ box-sizing:border-box; }
  body{
    margin:0; background:var(--bg); color:var(--bone);
    font-family:'Inter',Arial,Helvetica,sans-serif; font-size:11px; line-height:1.55;
    padding:34px 40px;
  }
  h1,h2{ font-family:'Oswald',Arial,sans-serif; text-transform:uppercase; margin:0; color:var(--bone); }
  .mono{ font-family:'IBM Plex Mono','Courier New',monospace; }

  .head{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:1px solid var(--line-strong); margin-bottom:24px; }
  .head-logo{ width:150px; height:auto; }
  .head-title{ text-align:right; }
  .head-title h1{ font-size:24px; letter-spacing:1px; color:var(--oxide); }
  .head-title .inv-num{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--tan); margin-top:6px; }
  .status-pill{ display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; color:var(--bg); background:var(--oxide); padding:4px 12px; margin-top:10px; }

  .meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }
  .meta-block span{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1.2px; text-transform:uppercase; color:var(--tan-dim); display:block; margin-bottom:6px; }
  .meta-block b{ font-size:13px; color:var(--bone); font-weight:600; display:block; }
  .meta-block .sub{ font-size:11px; color:var(--tan); margin-top:2px; }

  table.items{ width:100%; border-collapse:collapse; margin-bottom:4px; }
  .items th{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--tan-dim); text-align:left; padding:8px 6px; border-bottom:1px solid var(--line-strong); }
  .items th.item-num{ text-align:right; }
  .items td{ padding:12px 6px; border-bottom:1px solid var(--line); font-size:11.5px; color:#D9CDBB; vertical-align:top; }
  .items .item-desc{ color:var(--bone); }
  .items .item-num{ text-align:right; font-family:'IBM Plex Mono',monospace; white-space:nowrap; }
  .items .item-total{ color:var(--bone); font-weight:600; }

  .totals{ display:flex; justify-content:flex-end; margin-top:14px; }
  .totals table{ border-collapse:collapse; min-width:220px; }
  .totals td{ padding:6px 4px; font-size:12px; }
  .totals .label{ color:var(--tan); text-align:right; padding-right:18px; }
  .totals .value{ font-family:'IBM Plex Mono',monospace; text-align:right; color:var(--bone); }
  .totals .grand td{ border-top:1px solid var(--line-strong); padding-top:12px; font-size:15px; }
  .totals .grand .value{ color:var(--oxide); font-weight:700; }

  .foot{ margin-top:40px; padding-top:16px; border-top:1px solid var(--line); }
  .foot p{ color:var(--tan); font-size:10px; margin:0 0 6px; }
  .foot b{ color:var(--bone); }
</style>
</head>
<body>
  <div class="head">
    <img src="${buyer.logoDataUri}" alt="Extraction" class="head-logo">
    <div class="head-title">
      <h1>Invoice</h1>
      <div class="inv-num mono">No. ${esc(invoice.number)}</div>
      <div class="status-pill">${esc(invoice.status || "PAID")}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <span>Billed To</span>
      <b>${esc(buyer.name)}</b>
      <div class="sub">${esc(buyer.email)}</div>
    </div>
    <div class="meta-block">
      <span>Invoice Details</span>
      <div class="sub">Order <b class="mono" style="display:inline;">${esc(buyer.orderId)}</b></div>
      <div class="sub">Issued ${esc(invoice.issuedDate)}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th class="item-num">Qty</th>
        <th class="item-num">Unit Price</th>
        <th class="item-num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr class="grand"><td class="label">Total Paid</td><td class="value">${money(invoice.total, invoice.currency)}</td></tr>
    </table>
  </div>

  <div class="foot">
    <p><b>Extraction</b> &middot; contact@extraction.fit</p>
    <p>Digital product, delivered electronically — licensed for the personal use of ${esc(buyer.name)} only. See the Copyright &amp; Disclaimer page inside your manual for full licensing terms.</p>
    <p>Questions about this invoice? Reply to this email or write to <b>contact@extraction.fit</b>.</p>
  </div>
</body>
</html>`;
}
