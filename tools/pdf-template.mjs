// pdf-template.mjs
//
// Renders a buildFullProgram() manual (see program-generator.mjs) into a full, branded,
// print-ready HTML document: cover, program map, mission briefing, safety points,
// disclaimer, 5-minute mobility warm-up, then the week-by-week program tables with
// per-exercise video links. Palette/typography match the rest of the site
// (extraction-rules-and-regulations.html, dashboard.html) — matte black + bone +
// burnt-orange, Oswald / IBM Plex Mono — extended here with a 4-phase color system (each
// phase gets its own accent color, carried through the cover timeline, the program map, the
// per-week edge tab, and the progress dots) so the manual reads like a real field guide
// instead of a flat text dump, and a reader can flip straight to a phase by its color.

import { videoUrlFor } from "./video-links.mjs";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- 4-phase color system ----------
// Order matters (used for the cover timeline and the program map). `range` is inclusive
// week numbers, kept in sync with WEEK_SCHEME in program-generator.mjs.
const PHASES = [
  { name: "Designate Your Heading", code: "DYH", range: [1, 3], tempo: "3-1-1-0", pct: "60–70% 1RM", color: "#C0451D",
    blurb: "Baseline load, technique standard — lock in the movement before the weight goes up." },
  { name: "Golden Hour", code: "GH", range: [4, 7], tempo: "2-1-1-0", pct: "72–82% 1RM", color: "#D3A031",
    blurb: "Progressive overload begins — volume climbs with load, phase to phase." },
  { name: "Hold the Line", code: "HTL", range: [8, 11], tempo: "1-0-X-0", pct: "85–93% 1RM", color: "#B23A3A",
    blurb: "Peak intensity — volume trims as load peaks toward true max." },
  { name: "RTB", code: "RTB", range: [12, 13], tempo: "Deload → retest", pct: "40% cut", color: "#4F8C74",
    blurb: "Deload, then retest every Week 1 number against where you stand now." },
];
const phaseForWeek = (weekNum) => PHASES.find((p) => weekNum >= p.range[0] && weekNum <= p.range[1]) || PHASES[0];
const weekRangeLabel = (p) => `Wk ${p.range[0]}${p.range[1] !== p.range[0] ? `–${p.range[1]}` : ""}`;

const MOBILITY_WARMUP = [
  ["Cat-Cow Flow", "45 sec", "Slow, full range — mobilize the spine before anything else loads it"],
  ["World's Greatest Stretch", "45 sec / side", "Hip flexor, hamstring, and thoracic rotation in one movement"],
  ["Arm Circles + Shoulder CARs", "45 sec", "Small to large circles, then slow controlled articular rotations"],
  ["Hip CARs", "45 sec / side", "Slow controlled hip circles — full range, no momentum"],
  ["Bodyweight Squat to Stand", "45 sec", "Sit into a deep squat, stand tall, repeat — wake up the hips and ankles"],
  ["Inchworm Walkout", "45 sec", "Walk hands out to a plank, walk feet up to hands, stand — full-body primer"],
];

const SAFETY_POINTS = [
  "Always complete the 5-minute mobility warm-up before loading any weight — cold tissue under a heavy kettlebell, mace, or sandbag is how minor issues become real ones.",
  "Technique before load. If form breaks down on a rep, drop the weight before you drop the standard — every exercise in this manual is linked to a form-check video for exactly this reason.",
  "Soreness is normal. Sharp, sudden, or radiating pain is not — stop the movement immediately if it happens and don't push through it.",
  "Progress load only when every prescribed rep at the current weight moves clean. Chasing a heavier number before technique is locked in is the single most common cause of injury in this kind of training.",
  "Hydrate and fuel appropriately around training, especially if you're training in a hot climate.",
  "Give at least one full day of rest between sessions that hit the same movement pattern hard — recovery is part of the program, not a break from it.",
  "If you're new to structured training, returning after an injury, pregnant, or managing any health condition, get medical clearance before starting this or any exercise program.",
];

// ---------- small reusable bits ----------

function cornerMark(compassDataUri) {
  return `<img class="corner-mark" src="${compassDataUri}" alt="">`;
}

function progressStrip(currentWeekNum) {
  const dots = Array.from({ length: 13 }, (_, i) => {
    const w = i + 1;
    const p = phaseForWeek(w);
    const cls = w === currentWeekNum ? "pdot current" : "pdot";
    return `<span class="${cls}" style="--dc:${p.color}"></span>`;
  }).join("");
  return `<div class="progress-strip">${dots}<span class="progress-label">WK ${currentWeekNum} / 13</span></div>`;
}

function coverTimeline() {
  const segs = PHASES.map((p) => {
    const weeks = p.range[1] - p.range[0] + 1;
    const width = ((weeks / 13) * 100).toFixed(2);
    return `<div class="tl-seg" style="width:${width}%;background:${p.color};"></div>`;
  }).join("");
  const labels = PHASES.map(
    (p) => `<div class="tl-label"><span class="tl-dot" style="background:${p.color};"></span>${esc(p.code)} <span class="tl-weeks">${esc(weekRangeLabel(p))}</span></div>`
  ).join("");
  return `
    <div class="cover-timeline">
      <div class="tl-bar">${segs}</div>
      <div class="tl-labels">${labels}</div>
    </div>`;
}

function coverPage({ program, buyer, compassDataUri }) {
  return `
  <section class="pdf-page cover">
    <img class="cover-wm" src="${compassDataUri}" alt="">
    <svg class="cover-topo" viewBox="0 0 800 1120" preserveAspectRatio="none">
      <path d="M -50 260 C 200 200, 600 320, 850 240" />
      <path d="M -50 340 C 200 280, 600 400, 850 320" />
      <path d="M -50 820 C 200 760, 600 880, 850 800" />
      <path d="M -50 900 C 200 840, 600 960, 850 880" />
    </svg>
    <div class="cover-inner">
      <img src="${buyer.logoDataUri}" alt="Extraction — Designate Your Heading" class="cover-logo">
      <div class="mono-tag">OPERATOR MANUAL // ${esc(buyer.orderId)}</div>
      <h1 class="cover-title">${esc(program.name)}</h1>
      <p class="cover-sub">Designate Your Heading &rarr; Golden Hour &rarr; Hold the Line &rarr; RTB</p>
      <div class="cover-meta">
        <div><span>Prepared For</span><b>${esc(buyer.name)}</b></div>
        <div><span>Order</span><b>${esc(buyer.orderId)}</b></div>
        <div><span>Issued</span><b>${esc(buyer.issuedDate)}</b></div>
        <div><span>Equipment</span><b>${esc(program.level)}</b></div>
      </div>
      ${coverTimeline()}
    </div>
    <div class="cover-footer">Licensed to ${esc(buyer.name)} — not for resale or redistribution &middot; contact@extraction.fit</div>
  </section>`;
}

function phaseCards() {
  return `
    <div class="phase-grid">
      ${PHASES.map(
        (p) => `
        <div class="phase-card" style="--pc:${p.color};">
          <div class="phase-card-top"><span class="phase-code">${esc(p.code)}</span><span class="phase-weeks">${esc(weekRangeLabel(p))}</span></div>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.blurb)}</p>
          <div class="phase-stats"><span>Tempo <b>${esc(p.tempo)}</b></span><span>${esc(p.pct)}</span></div>
        </div>`
      ).join("\n")}
    </div>`;
}

function briefingPage({ compassDataUri }) {
  return `
  <section class="pdf-page">
    ${cornerMark(compassDataUri)}
    ${pageHead("01", "Mission Briefing")}
    <div class="rx-block">
      <div><span>Mission Objective</span><p>Build maximal strength, work capacity, and structural durability under load — transferable output, not just gym numbers.</p></div>
      <div><span>Long Mission Strategic Target</span><p>By RTB (Week 13): exceed every Week 1 benchmark on load, reps, and conditioning pace, with movement quality holding under fatigue.</p></div>
    </div>
    <p class="lede">Four phases, thirteen weeks — the program map below. Volume and intensity are set to your chosen training frequency, not a template with days deleted. Every session: 5-minute mobility warm-up &rarr; main strength work &rarr; conditioning finisher.</p>
    ${phaseCards()}
    <p class="contact-line">Read Safety Briefing and Disclaimer before Week 1, Day 1.</p>
  </section>`;
}

function safetyPage({ compassDataUri }) {
  return `
  <section class="pdf-page">
    ${cornerMark(compassDataUri)}
    ${pageHead("02", "Safety Briefing")}
    <ol class="numbered">
      ${SAFETY_POINTS.map((p) => `<li>${esc(p)}</li>`).join("\n")}
    </ol>
  </section>`;
}

function disclaimerPage({ buyer, compassDataUri }) {
  const year = String(buyer.issuedDate || "").slice(0, 4) || new Date().getFullYear();
  return `
  <section class="pdf-page">
    ${cornerMark(compassDataUri)}
    ${pageHead("03", "Copyright &amp; Disclaimer")}
    <div class="legal-block">
      <p><b>Copyright.</b> &copy; ${esc(year)} Extraction. All rights reserved. This manual — its program design, phase structure, exercise selection, and written content — is the proprietary, original work of Extraction and is protected by copyright law. It is licensed for the personal use of <b>${esc(buyer.name)}</b> (Order ${esc(buyer.orderId)}) only. It is licensed, not sold, and this license does not transfer to any other person.</p>
      <p><b>No redistribution.</b> You may not reproduce, copy, distribute, resell, publicly share, post online, or transmit any part of this manual, in whole or in part, in any form, without prior written permission from Extraction. Every copy is watermarked and uniquely tied to the licensed buyer and order number above; unauthorized distribution can be traced back to its source and may result in legal action and immediate revocation of program and portal access.</p>
      <p><b>Health disclaimer.</b> This program involves strenuous physical exercise and heavy external load — kettlebells, steel mace, sandbag, and hanging/pulling work on rings — that carries an inherent risk of injury. Extraction and its coaches are not physicians, and nothing in this manual constitutes medical advice.</p>
      <p><b>Assumption of risk.</b> By training from this manual, you confirm that you are physically able to participate and that you assume full responsibility for your own safety, technique, and load selection at every session. Consult a physician before beginning this or any new exercise program, particularly if you have a pre-existing health condition, are pregnant, or are returning from injury.</p>
      <p><b>Limitation of liability.</b> Extraction, its founder, and its affiliates are not liable for injury, loss, or damage arising from the use of this program. This is a general notice provided for clarity, not a substitute for legal advice, and has not been reviewed by a licensed attorney in your jurisdiction.</p>
    </div>
    <p class="contact-line">By continuing past this page, you confirm you have read and accepted the terms above. Questions before you start? <b>contact@extraction.fit</b></p>
  </section>`;
}

function mobilityPage({ compassDataUri }) {
  return `
  <section class="pdf-page">
    ${cornerMark(compassDataUri)}
    ${pageHead("04", "5-Minute Mobility Warm-Up")}
    <p class="lede">Run this before every session in this manual, no exceptions. Six movements, roughly 45 seconds each — five minutes, full body, ready to load.</p>
    <div class="mobility-grid">
      ${MOBILITY_WARMUP.map(
        ([name, dur, note], i) => `
        <div class="mobility-card">
          <span class="mobility-num">${String(i + 1).padStart(2, "0")}</span>
          <div class="mobility-body">
            <div class="mobility-head"><h4>${esc(name)}</h4><span class="pill pill-dur">${esc(dur)}</span></div>
            <p>${esc(note)}</p>
          </div>
        </div>`
      ).join("\n")}
    </div>
  </section>`;
}

function pageHead(num, title) {
  return `<div class="page-head"><span class="page-num">${num}</span><h2>${title}</h2></div>`;
}

function weekSection(week, weekIndex, compassDataUri) {
  const weekNum = weekIndex + 1;
  const phase = phaseForWeek(weekNum);
  const isRetest = /\(retest\)/.test(week.label);
  return `
  <section class="pdf-page week-page" style="--pc:${phase.color};">
    <div class="page-tab" style="background:${phase.color};"></div>
    ${cornerMark(compassDataUri)}
    <div class="week-head">
      <span class="week-tag">WEEK ${weekNum}</span>
      <h2>${esc(week.label.replace(/^Week \d+ — /, ""))}</h2>
      <span class="phase-pill" style="background:${phase.color};">${esc(phase.code)}</span>
      ${isRetest ? '<span class="retest-stamp">RETEST</span>' : ""}
    </div>
    ${progressStrip(weekNum)}
    ${week.rx ? `<div class="week-rx"><span class="pill" style="--pc:${phase.color};">Load <b>${esc(week.rx.load)}</b></span><span class="pill" style="--pc:${phase.color};">Tempo <b>${esc(week.rx.tempo)}</b></span><span class="pill" style="--pc:${phase.color};">RPE <b>${esc(week.rx.rpe)}</b></span></div>` : ""}
    ${week.days
      .map(
        (day, di) => `
      <div class="day-block">
        <h3 class="day-label"><span class="day-num" style="background:${phase.color};">${di + 1}</span>${esc(day.label.replace(/^Day \d+ — /, ""))}</h3>
        <table class="ex-table">
          <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Notes</th></tr></thead>
          <tbody>
            ${day.exercises
              .map(
                (ex) => `
              <tr>
                <td class="ex-name"><a href="${esc(videoUrlFor(ex.name))}">${esc(ex.name)} &#9654;</a></td>
                <td><span class="pill pill-num" style="--pc:${phase.color};">${esc(ex.sets)}</span></td>
                <td><span class="pill pill-num" style="--pc:${phase.color};">${esc(ex.reps)}</span></td>
                <td class="ex-notes">${esc(ex.notes)}</td>
              </tr>`
              )
              .join("\n")}
          </tbody>
        </table>
      </div>`
      )
      .join("\n")}
  </section>`;
}

export function renderManualHtml({ program, buyer, compassDataUri }) {
  const weekPages = program.weeks.map((w, i) => weekSection(w, i, compassDataUri)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(program.name)} — Extraction</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

  :root{
    --bg:#0C0C0A; --bg-raise:#17140F; --bg-card:#1B170F; --bg-card2:#201C13;
    --bone:#F5DFB8; --tan:#A6926F; --tan-dim:#7A6E56;
    --oxide:#C0451D; --oxide-dim:#7A2C12;
    --line:rgba(245,223,184,0.14); --line-strong:rgba(245,223,184,0.28);
  }
  *{ box-sizing:border-box; }
  body{
    margin:0; background:var(--bg); color:var(--bone);
    font-family:'Inter',Arial,Helvetica,sans-serif; font-size:10.5px; line-height:1.55;
  }
  h1,h2,h3,h4{ font-family:'Oswald',Arial,sans-serif; text-transform:uppercase; margin:0; color:var(--bone); }
  .mono{ font-family:'IBM Plex Mono','Courier New',monospace; }
  a{ color:var(--oxide); text-decoration:none; }

  .pdf-page{ page-break-after:always; padding:24px 34px 28px; position:relative; min-height:100vh; overflow:hidden; }
  .week-page{ padding-top:20px; }
  .pdf-page:last-child{ page-break-after:auto; }

  .corner-mark{ position:absolute; top:22px; right:28px; height:34px; width:auto; opacity:0.14; z-index:0; }

  /* ---------- cover ---------- */
  .cover{ display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; background:linear-gradient(180deg, var(--bg-raise), var(--bg)); }
  .cover-wm{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); height:520px; opacity:0.05; z-index:0; }
  .cover-topo{ position:absolute; top:0; left:0; width:100%; height:100%; z-index:0; }
  .cover-topo path{ fill:none; stroke:var(--line); stroke-width:1.4; }
  .cover-inner{ max-width:480px; position:relative; z-index:1; }
  .cover-logo{ width:280px; max-width:80%; height:auto; display:block; margin:0 auto 26px; }
  .mono-tag{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1.5px; color:var(--tan); text-transform:uppercase; border:1px solid var(--line-strong); display:inline-block; padding:6px 14px; margin-bottom:20px; }
  .cover-title{ font-size:26px; letter-spacing:0.5px; margin-bottom:12px; }
  .cover-sub{ color:var(--tan); font-size:11px; max-width:60ch; margin:0 auto 28px; }
  .cover-meta{ display:grid; grid-template-columns:1fr 1fr; gap:14px 28px; text-align:left; border-top:1px solid var(--line); padding-top:20px; }
  .cover-meta span{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--tan-dim); display:block; }
  .cover-meta b{ font-size:11px; color:var(--bone); font-weight:600; }
  .cover-footer{ position:absolute; bottom:26px; left:0; right:0; text-align:center; font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.5px; color:var(--tan-dim); z-index:1; }

  /* ---------- cover phase timeline ---------- */
  .cover-timeline{ margin-top:26px; text-align:left; }
  .tl-bar{ display:flex; height:6px; border-radius:3px; overflow:hidden; border:1px solid rgba(0,0,0,0.35); }
  .tl-labels{ display:flex; justify-content:space-between; margin-top:8px; flex-wrap:wrap; gap:6px; }
  .tl-label{ font-family:'IBM Plex Mono',monospace; font-size:7.5px; letter-spacing:0.5px; color:var(--tan); text-transform:uppercase; display:flex; align-items:center; gap:4px; }
  .tl-dot{ width:6px; height:6px; border-radius:50%; display:inline-block; }
  .tl-weeks{ color:var(--tan-dim); }

  /* ---------- content pages ---------- */
  .page-head{ display:flex; align-items:baseline; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--line-strong); margin-bottom:16px; position:relative; z-index:1; }
  .page-num{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--oxide); }
  .page-head h2{ font-size:16px; }
  p{ color:#D9CDBB; margin:0 0 10px; font-size:10.5px; position:relative; z-index:1; }
  p.lede{ color:var(--tan); }
  p.contact-line{ margin-top:16px; color:var(--bone); position:relative; z-index:1; }
  .legal-block{ border-left:2px solid var(--line-strong); padding-left:16px; }

  /* ---------- mission briefing Rx callout ---------- */
  .rx-block{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; position:relative; z-index:1; }
  .rx-block > div{ border:1px solid var(--line-strong); padding:12px 14px; background:var(--bg-card); }
  .rx-block span{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--oxide); display:block; margin-bottom:6px; }
  .rx-block p{ margin:0; font-size:10px; color:var(--bone); }

  /* ---------- phase map (program overview) ---------- */
  .phase-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0 16px; position:relative; z-index:1; }
  .phase-card{ border:1px solid var(--line-strong); border-left:3px solid var(--pc); background:var(--bg-card); padding:12px 14px; }
  .phase-card-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .phase-code{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1px; color:var(--pc); font-weight:600; }
  .phase-weeks{ font-family:'IBM Plex Mono',monospace; font-size:8px; color:var(--tan-dim); text-transform:uppercase; }
  .phase-card h3{ font-size:12px; margin-bottom:5px; }
  .phase-card p{ font-size:9px; color:var(--tan); margin-bottom:8px; }
  .phase-stats{ display:flex; gap:14px; font-family:'IBM Plex Mono',monospace; font-size:8px; color:var(--tan-dim); text-transform:uppercase; }
  .phase-stats b{ color:var(--bone); }

  /* ---------- safety list ---------- */
  .numbered{ list-style:none; counter-reset:item; margin:0; padding:0; position:relative; z-index:1; }
  .numbered li{ counter-increment:item; position:relative; padding:9px 0 9px 34px; border-top:1px solid var(--line); color:#D9CDBB; font-size:10.5px; }
  .numbered li::before{
    content: counter(item, decimal-leading-zero); position:absolute; left:0; top:6px;
    width:20px; height:20px; border-radius:50%; background:var(--oxide-dim); color:var(--bone);
    font-family:'IBM Plex Mono',monospace; font-size:8.5px; font-weight:600;
    display:flex; align-items:center; justify-content:center;
  }

  /* ---------- mobility card grid ---------- */
  .mobility-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; position:relative; z-index:1; }
  .mobility-card{ display:flex; gap:10px; border:1px solid var(--line-strong); background:var(--bg-card); padding:11px 12px; }
  .mobility-num{ font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--oxide); flex:none; }
  .mobility-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
  .mobility-head h4{ font-size:10.5px; }
  .mobility-card p{ font-size:9px; color:var(--tan); margin:0; }
  .pill{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.4px; padding:2px 7px; border-radius:10px; white-space:nowrap; }
  .pill-dur{ background:var(--bg-card2); color:var(--tan); border:1px solid var(--line-strong); }

  /* ---------- per-week Rx strip ---------- */
  .week-rx{ display:flex; gap:10px; margin-bottom:9px; position:relative; z-index:1; }
  .week-rx .pill{ background:color-mix(in srgb, var(--pc) 18%, var(--bg-card)); border:1px solid color-mix(in srgb, var(--pc) 55%, transparent); color:var(--tan); text-transform:uppercase; padding:3px 10px; }
  .week-rx .pill b{ color:var(--bone); font-weight:600; }

  /* ---------- progress strip (13-week dots) ---------- */
  .progress-strip{ display:flex; align-items:center; gap:3px; margin-bottom:8px; position:relative; z-index:1; }
  .pdot{ width:6px; height:6px; border-radius:50%; background:var(--dc); opacity:0.35; }
  .pdot.current{ width:9px; height:9px; opacity:1; box-shadow:0 0 0 2px rgba(245,223,184,0.3); }
  .progress-label{ font-family:'IBM Plex Mono',monospace; font-size:7.5px; color:var(--tan-dim); letter-spacing:0.5px; margin-left:6px; }

  .numbered{ list-style:none; }
  table.ex-table{ width:100%; border-collapse:collapse; margin-bottom:9px; position:relative; z-index:1; }
  .ex-table th{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.8px; text-transform:uppercase; color:var(--tan-dim); text-align:left; padding:4px 8px; border-bottom:1px solid var(--line-strong); }
  .ex-table tbody tr:nth-child(even){ background:rgba(245,223,184,0.03); }
  .ex-table td{ padding:5px 8px; border-bottom:1px solid var(--line); font-size:10px; color:#D9CDBB; vertical-align:top; }
  .ex-table .ex-name{ color:var(--bone); font-weight:600; white-space:nowrap; }
  .ex-table .ex-name a{ color:var(--bone); }
  .ex-table .ex-notes{ color:var(--tan); }
  .pill-num{ background:color-mix(in srgb, var(--pc) 16%, var(--bg-card)); color:var(--bone); border:1px solid color-mix(in srgb, var(--pc) 45%, transparent); font-weight:600; }

  /* ---------- week pages ---------- */
  .page-tab{ position:absolute; top:0; right:0; width:9px; height:100%; z-index:0; }
  .week-head{ display:flex; align-items:center; gap:10px; padding-bottom:7px; border-bottom:1px solid var(--line-strong); margin-bottom:7px; position:relative; z-index:1; flex-wrap:wrap; }
  .week-tag{ font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--oxide); border:1px solid var(--oxide-dim); padding:2px 8px; }
  .week-head h2{ font-size:14px; }
  .phase-pill{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.6px; color:#0C0C0A; font-weight:700; padding:2px 8px; border-radius:2px; }
  .retest-stamp{ margin-left:auto; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1.5px; color:var(--pc); border:1px solid var(--pc); padding:2px 9px; transform:rotate(-2deg); }
  .day-block{ margin-bottom:10px; position:relative; z-index:1; }
  .day-label{ font-size:11px; color:var(--tan); margin-bottom:5px; letter-spacing:0.4px; display:flex; align-items:center; gap:8px; }
  .day-num{ font-family:'IBM Plex Mono',monospace; font-size:9px; color:#0C0C0A; font-weight:700; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none; }
</style>
</head>
<body>
${coverPage({ program, buyer, compassDataUri })}
${briefingPage({ compassDataUri })}
${safetyPage({ compassDataUri })}
${disclaimerPage({ buyer, compassDataUri })}
${mobilityPage({ compassDataUri })}
${weekPages}
</body>
</html>`;
}
