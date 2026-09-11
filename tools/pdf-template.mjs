// pdf-template.mjs
//
// Renders a buildFullProgram() manual (see program-generator.mjs) into a full, branded,
// print-ready HTML document: cover, mission briefing, safety points, disclaimer, 5-minute
// mobility warm-up, then the week-by-week program tables with per-exercise video links.
// Palette/typography match the rest of the site (extraction-rules-and-regulations.html,
// dashboard.html) — matte black + bone + burnt-orange, Oswald / IBM Plex Mono.

import { videoUrlFor } from "./video-links.mjs";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

function coverPage({ program, buyer }) {
  return `
  <section class="pdf-page cover">
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
    </div>
    <div class="cover-footer">Licensed to ${esc(buyer.name)} — not for resale or redistribution &middot; contact@extraction.fit</div>
  </section>`;
}

function briefingPage() {
  return `
  <section class="pdf-page">
    ${pageHead("01", "Mission Briefing")}
    <div class="rx-block">
      <div><span>Mission Objective</span><p>Build maximal strength, work capacity, and structural durability under load — transferable output, not just gym numbers.</p></div>
      <div><span>Long Mission Strategic Target</span><p>By RTB (Week 13): exceed every Week 1 benchmark on load, reps, and conditioning pace, with movement quality holding under fatigue.</p></div>
    </div>
    <p>Four phases, thirteen weeks. Volume and intensity are set to your chosen training frequency — not a template with days deleted. Every session: 5-minute mobility warm-up &rarr; main strength work &rarr; conditioning finisher.</p>
    <p><b>Designate Your Heading</b> (Wk 1&ndash;3) &mdash; baseline load, technique standard. Tempo 3-1-1-0, 60&ndash;70% 1RM.<br>
    <b>Golden Hour</b> (Wk 4&ndash;7) &mdash; progressive overload begins, volume climbs with load. Tempo 2-1-1-0, 72&ndash;82% 1RM.<br>
    <b>Hold the Line</b> (Wk 8&ndash;11) &mdash; peak intensity, volume trims as load peaks. Tempo 1-0-X-0, 85&ndash;93% 1RM.<br>
    <b>RTB</b> (Wk 12&ndash;13) &mdash; deload, then retest every Week 1 number.</p>
    <p>Read Safety Briefing and Disclaimer before Week 1, Day 1.</p>
  </section>`;
}

function safetyPage() {
  return `
  <section class="pdf-page">
    ${pageHead("02", "Safety Briefing")}
    <ol class="numbered">
      ${SAFETY_POINTS.map((p) => `<li>${esc(p)}</li>`).join("\n")}
    </ol>
  </section>`;
}

function disclaimerPage() {
  return `
  <section class="pdf-page">
    ${pageHead("03", "Disclaimer &amp; Assumption of Risk")}
    <p>This program involves strenuous physical exercise and heavy external load — kettlebells, steel mace, sandbag, and hanging/pulling work on rings — that carries an inherent risk of injury. Extraction and its coaches are not physicians, and nothing in this manual constitutes medical advice.</p>
    <p>By training from this manual, you confirm that you are physically able to participate and that you assume full responsibility for your own safety, technique, and load selection at every session. Consult a physician before beginning this or any new exercise program, particularly if you have a pre-existing health condition, are pregnant, or are returning from injury.</p>
    <p>Extraction, its founder, and its affiliates are not liable for injury, loss, or damage arising from the use of this program. This is a general liability notice provided for clarity, not a substitute for legal advice, and has not been reviewed by a licensed attorney in your jurisdiction.</p>
    <p class="contact-line">Questions before you start? <b>contact@extraction.fit</b></p>
  </section>`;
}

function mobilityPage() {
  return `
  <section class="pdf-page">
    ${pageHead("04", "5-Minute Mobility Warm-Up")}
    <p class="lede">Run this before every session in this manual, no exceptions. Six movements, roughly 45 seconds each — five minutes, full body, ready to load.</p>
    <table class="ex-table">
      <thead><tr><th>Movement</th><th>Duration</th><th>Notes</th></tr></thead>
      <tbody>
        ${MOBILITY_WARMUP.map(
          ([name, dur, note]) => `<tr><td class="ex-name">${esc(name)}</td><td>${esc(dur)}</td><td class="ex-notes">${esc(note)}</td></tr>`
        ).join("\n")}
      </tbody>
    </table>
  </section>`;
}

function pageHead(num, title) {
  return `<div class="page-head"><span class="page-num">${num}</span><h2>${title}</h2></div>`;
}

function weekSection(week, weekIndex) {
  return `
  <section class="pdf-page week-page">
    <div class="week-head">
      <span class="week-tag">WEEK ${weekIndex + 1}</span>
      <h2>${esc(week.label.replace(/^Week \d+ — /, ""))}</h2>
    </div>
    ${week.rx ? `<div class="week-rx"><span>Load <b>${esc(week.rx.load)}</b></span><span>Tempo <b>${esc(week.rx.tempo)}</b></span><span>RPE <b>${esc(week.rx.rpe)}</b></span></div>` : ""}
    ${week.days
      .map(
        (day) => `
      <div class="day-block">
        <h3 class="day-label">${esc(day.label)}</h3>
        <table class="ex-table">
          <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Notes</th></tr></thead>
          <tbody>
            ${day.exercises
              .map(
                (ex) => `
              <tr>
                <td class="ex-name"><a href="${esc(videoUrlFor(ex.name))}">${esc(ex.name)} &#9654;</a></td>
                <td>${esc(ex.sets)}</td>
                <td>${esc(ex.reps)}</td>
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

export function renderManualHtml({ program, buyer }) {
  const weekPages = program.weeks.map((w, i) => weekSection(w, i)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(program.name)} — Extraction</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

  :root{
    --bg:#0C0C0A; --bg-raise:#17140F; --bg-card:#1B170F;
    --bone:#F5DFB8; --tan:#A6926F; --tan-dim:#7A6E56;
    --oxide:#C0451D; --oxide-dim:#7A2C12;
    --line:rgba(245,223,184,0.14); --line-strong:rgba(245,223,184,0.28);
  }
  *{ box-sizing:border-box; }
  body{
    margin:0; background:var(--bg); color:var(--bone);
    font-family:'Inter',Arial,Helvetica,sans-serif; font-size:10.5px; line-height:1.55;
  }
  h1,h2,h3{ font-family:'Oswald',Arial,sans-serif; text-transform:uppercase; margin:0; color:var(--bone); }
  .mono{ font-family:'IBM Plex Mono','Courier New',monospace; }
  a{ color:var(--oxide); text-decoration:none; }

  .pdf-page{ page-break-after:always; padding:30px 34px 34px; position:relative; min-height:100vh; }
  .pdf-page:last-child{ page-break-after:auto; }

  /* ---------- cover ---------- */
  .cover{ display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; background:linear-gradient(180deg, var(--bg-raise), var(--bg)); }
  .cover-inner{ max-width:480px; }
  .cover-logo{ width:280px; max-width:80%; height:auto; display:block; margin:0 auto 26px; }
  .mono-tag{ font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:1.5px; color:var(--tan); text-transform:uppercase; border:1px solid var(--line-strong); display:inline-block; padding:6px 14px; margin-bottom:20px; }
  .cover-title{ font-size:26px; letter-spacing:0.5px; margin-bottom:12px; }
  .cover-sub{ color:var(--tan); font-size:11px; max-width:60ch; margin:0 auto 28px; }
  .cover-meta{ display:grid; grid-template-columns:1fr 1fr; gap:14px 28px; text-align:left; border-top:1px solid var(--line); padding-top:20px; }
  .cover-meta span{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--tan-dim); display:block; }
  .cover-meta b{ font-size:11px; color:var(--bone); font-weight:600; }
  .cover-footer{ position:absolute; bottom:26px; left:0; right:0; text-align:center; font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.5px; color:var(--tan-dim); }

  /* ---------- content pages ---------- */
  .page-head{ display:flex; align-items:baseline; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--line-strong); margin-bottom:16px; }
  .page-num{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--oxide); }
  .page-head h2{ font-size:16px; }
  p{ color:#D9CDBB; margin:0 0 10px; font-size:10.5px; }
  p.lede{ color:var(--tan); }
  p.contact-line{ margin-top:16px; color:var(--bone); }

  /* ---------- mission briefing Rx callout ---------- */
  .rx-block{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
  .rx-block > div{ border:1px solid var(--line-strong); padding:12px 14px; }
  .rx-block span{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--oxide); display:block; margin-bottom:6px; }
  .rx-block p{ margin:0; font-size:10px; color:var(--bone); }

  /* ---------- per-week Rx strip ---------- */
  .week-rx{ display:flex; gap:18px; margin-bottom:14px; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:0.4px; color:var(--tan); text-transform:uppercase; }
  .week-rx b{ color:var(--bone); font-weight:600; }
  .numbered{ list-style:none; counter-reset:item; margin:0; padding:0; }
  .numbered li{ counter-increment:item; position:relative; padding:8px 0 8px 26px; border-top:1px solid var(--line); color:#D9CDBB; font-size:10.5px; }
  .numbered li::before{ content: counter(item, decimal-leading-zero); position:absolute; left:0; top:8px; font-family:'IBM Plex Mono',monospace; color:var(--oxide); font-size:10px; }

  /* ---------- exercise tables ---------- */
  table.ex-table{ width:100%; border-collapse:collapse; margin-bottom:14px; }
  .ex-table th{ font-family:'IBM Plex Mono',monospace; font-size:8px; letter-spacing:0.8px; text-transform:uppercase; color:var(--tan-dim); text-align:left; padding:6px 8px; border-bottom:1px solid var(--line-strong); }
  .ex-table td{ padding:7px 8px; border-bottom:1px solid var(--line); font-size:10px; color:#D9CDBB; vertical-align:top; }
  .ex-table .ex-name{ color:var(--bone); font-weight:600; white-space:nowrap; }
  .ex-table .ex-name a{ color:var(--bone); }
  .ex-table .ex-notes{ color:var(--tan); }

  /* ---------- week pages ---------- */
  .week-head{ display:flex; align-items:baseline; gap:12px; padding-bottom:10px; border-bottom:1px solid var(--line-strong); margin-bottom:14px; }
  .week-tag{ font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--oxide); border:1px solid var(--oxide-dim); padding:3px 8px; }
  .week-head h2{ font-size:15px; }
  .day-block{ margin-bottom:16px; }
  .day-label{ font-size:11px; color:var(--tan); margin-bottom:6px; letter-spacing:0.4px; }
</style>
</head>
<body>
${coverPage({ program, buyer })}
${briefingPage()}
${safetyPage()}
${disclaimerPage()}
${mobilityPage()}
${weekPages}
</body>
</html>`;
}
