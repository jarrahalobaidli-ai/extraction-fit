// program-generator.mjs
//
// Server-side extraction of dashboard.html's 90-day manual generator (MOVEMENT_PATTERNS,
// WEEK_SCHEME, buildFullProgram, etc.) so it can run outside the React dashboard — e.g. in
// a Supabase Edge Function or a Node fulfillment script that turns a Gumroad sale into a
// personalized, watermarked PDF without a browser.
//
// KEEP THIS IN SYNC WITH dashboard.html: this is a verbatim copy of the generator logic
// (MOVEMENT_PATTERNS through buildFullProgram) with `const`/`function` declarations turned
// into named exports. If the program logic changes in the dashboard, port the same change
// here, or a self-serve buyer's PDF will silently drift from what the coach dashboard shows.
//
// PROGRAMMING MODEL (S&C notes)
// - Primary movement patterns carry 3 exercise variants per equipment level, indexed by
//   phase (0 = Designate Your Heading, 1 = Golden Hour, 2 = Hold the Line). Each training
//   day pulls TWO variants per muscle target — the phase's primary variant plus the next
//   variant in rotation — so the target gets ≥2 exercises at a different joint angle every
//   session, and the pairing itself changes phase to phase. This is exercise rotation for
//   accommodation, not random substitution: the underlying pattern and target never change.
// - RTB retest always resolves to variant index 0 (Designate Your Heading's), so Week 13
//   compares load/reps against the literal Week 1 exercise, not a rotated substitute.
// - Load/Tempo/RPE are prescribed per phase (WEEK_SCHEME[].rx) and volume (sets) is adjusted
//   inversely to intensity in Golden Hour → Hold the Line: Golden Hour adds a work set as
//   load climbs into the 70s-80s% range; Hold the Line trims sets as load peaks into the 90s
//   so total stress stays manageable while intensity, not volume, drives the overload.
// - Functional training's conditioning finishers run on time-domain protocols (Tabata,
//   EMOM, AMRAP) rather than open-ended "steady state" framing.
//
// Verified: `node program-generator.mjs` runs a self-check at the bottom of this file and
// prints a summary (13 weeks, correct day counts per frequency) for every equipment level x
// days/week combination.

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- primary compound patterns: 3 phase-indexed variants per level ----------
// index 0 = Designate Your Heading, 1 = Golden Hour, 2 = Hold the Line. RTB retest uses 0.
export const MOVEMENT_PATTERNS = [
  {
    pattern: "Squat",
    target: "Quads",
    variants: {
      "Full gym": ["Barbell back squat", "Barbell front squat", "Bulgarian split squat (DB)"],
      "Functional training": ["KB or DB goblet squat", "Double KB front-rack squat", "KB Bulgarian split squat"],
      "Bodyweight only": ["Tempo bodyweight squat", "Jump squat", "Bodyweight Bulgarian split squat"],
      "Bands only": ["Band-resisted squat", "Band front-rack squat", "Band Bulgarian split squat"],
    },
  },
  {
    pattern: "Hinge",
    target: "Hamstrings / Glutes",
    variants: {
      "Full gym": ["Barbell deadlift", "Barbell Romanian deadlift", "DB single-leg RDL"],
      "Functional training": ["KB Romanian deadlift", "Sandbag deadlift", "Single-leg KB RDL"],
      "Bodyweight only": ["Single-leg glute bridge", "Nordic curl progression", "Single-leg bodyweight RDL"],
      "Bands only": ["Band good morning", "Band Romanian deadlift", "Band single-leg deadlift"],
    },
  },
  {
    pattern: "Horizontal push",
    target: "Chest",
    variants: {
      "Full gym": ["Barbell bench press", "Incline barbell press", "DB bench press (unilateral)"],
      "Functional training": ["DB or floor press", "DB incline press", "Single-arm landmine press"],
      "Bodyweight only": ["Push-up", "Feet-elevated push-up", "Single-arm push-up progression"],
      "Bands only": ["Band chest press", "Band incline press", "Band single-arm chest press"],
    },
  },
  {
    pattern: "Vertical push",
    target: "Shoulders",
    variants: {
      "Full gym": ["Barbell overhead press", "Seated DB press", "Single-arm DB press"],
      "Functional training": ["KB or landmine press", "Double KB press", "Single-arm KB press"],
      "Bodyweight only": ["Pike push-up", "Feet-elevated pike push-up", "Handstand hold progression"],
      "Bands only": ["Band overhead press", "Band Z-press", "Band single-arm press"],
    },
  },
  {
    pattern: "Horizontal pull",
    target: "Mid-Back",
    variants: {
      "Full gym": ["Barbell bent-over row", "Chest-supported DB row", "Single-arm DB row"],
      "Functional training": ["KB or sandbag single-arm row", "Sandbag row", "Single-arm landmine row"],
      "Bodyweight only": ["Inverted row", "Feet-elevated inverted row", "Single-arm towel row"],
      "Bands only": ["Band seated row", "Band chest-supported row", "Band single-arm row"],
    },
  },
  {
    pattern: "Vertical pull",
    target: "Lats",
    variants: {
      "Full gym": ["Weighted pull-up", "Wide-grip pull-up", "Neutral-grip chin-up"],
      "Functional training": ["Ring pull-up / band-assisted pull-up", "DB pullover", "Ring chin-up"],
      "Bodyweight only": ["Pull-up / band-assisted pull-up", "Wide-grip pull-up", "Chin-up"],
      "Bands only": ["Band lat pulldown", "Band straight-arm pulldown", "Band single-arm pulldown"],
    },
  },
  {
    pattern: "Triceps",
    target: "Triceps",
    variants: {
      "Full gym": ["Cable triceps pressdown", "Close-grip bench press", "DB overhead triceps extension"],
      "Functional training": ["DB overhead triceps extension", "Close-grip floor press", "Band or DB kickback"],
      "Bodyweight only": ["Bench dip", "Close-grip push-up", "Diamond push-up"],
      "Bands only": ["Band triceps pressdown", "Band overhead extension", "Band kickback"],
    },
  },
  {
    pattern: "Biceps",
    target: "Biceps",
    variants: {
      "Full gym": ["DB bicep curl", "Barbell curl", "Hammer curl"],
      "Functional training": ["KB bicep curl", "Sandbag curl", "KB hammer curl"],
      "Bodyweight only": ["Chin-up hold (bicep-biased isometric)", "Towel curl (isometric)", "Slow-eccentric chin-up"],
      "Bands only": ["Band bicep curl", "Band hammer curl", "Band concentration curl"],
    },
  },
  // ---------- single-variant support patterns (no phase rotation) ----------
  {
    pattern: "Loaded carry",
    target: "Grip / Full-Body",
    variants: {
      "Full gym": ["Farmer's carry (trap bar or DBs)"],
      "Functional training": ["DB, KB, or sandbag farmer's / suitcase carry"],
      "Bodyweight only": ["Loaded backpack ruck carry"],
      "Bands only": ["Band-resisted march / carry walk"],
    },
  },
  {
    pattern: "Core / anti-extension",
    target: "Core",
    variants: {
      "Full gym": ["Hanging leg raise"],
      "Functional training": ["Weighted plank / DB deadbug / sandbag hold"],
      "Bodyweight only": ["Plank / hollow hold progression"],
      "Bands only": ["Band pallof press"],
    },
  },
  {
    pattern: "Rotational / shoulder flow",
    target: "Rotational Core",
    variants: {
      "Full gym": ["Landmine rotational press / cable rotational chop"],
      "Functional training": ["Steel mace 10-to-2 swings / steel club mills and swipes"],
      "Bodyweight only": ["Rotational lunge with reach / bear crawl with rotation"],
      "Bands only": ["Band rotational chop and lift"],
    },
  },
];

// ---------- conditioning: separate from MOVEMENT_PATTERNS (indexed by type, not target) ----------
export const CONDITIONING_TYPES = {
  "Steady state": {
    "Full gym": "Rower or assault bike — steady pace",
    "Functional training": "KB swings — steady, sustainable pace",
    "Bodyweight only": "Easy-paced run or ruck",
    "Bands only": "Brisk step-up or march circuit, steady pace",
  },
  HIIT: {
    "Full gym": "Assault bike or rower sprints",
    "Functional training": "KB swing intervals",
    "Bodyweight only": "Burpee or shuttle sprint intervals",
    "Bands only": "Band-resisted step-up sprints",
  },
  Rounds: {
    "Full gym": "Row cals + burpees + KB swings, continuous rounds",
    "Functional training": "KB swings + sandbag cleans, continuous rounds",
    "Bodyweight only": "Burpees + air squats + push-ups, continuous rounds",
    "Bands only": "Band press + band row + step-ups, continuous rounds",
  },
};

// Functional training's finishers run on explicit time-domain protocols (Tabata/EMOM/AMRAP)
// instead of open-ended interval framing. Other equipment levels keep WEEK_SCHEME's numbers
// as-authored — this only overrides the sets/reps/notes text for level === "Functional training".
function conditioningRx(level, cond) {
  if (level !== "Functional training") return cond;
  if (cond.type === "HIIT") {
    return { type: "Tabata", sets: cond.sets, reps: "Tabata — 20s on / 10s off", notes: `${cond.sets} rounds — all-out on every 20s work window` };
  }
  if (cond.type === "Steady state") {
    const mins = (cond.reps.match(/\d+/) || [15])[0];
    return { type: "EMOM", sets: "1", reps: `EMOM ${mins}: 10-12 KB swings every minute`, notes: "Submaximal pace — the clock enforces the rest" };
  }
  if (cond.type === "Rounds") {
    const label = /AMRAP/i.test(cond.reps) ? "AMRAP" : "EMOM";
    return { ...cond, type: label };
  }
  return cond;
}

export const MODALITY_BY_EQUIPMENT = {
  "Full gym": { level: "Full gym", modality: "Full Gym Bodybuilding" },
  "Functional training": { level: "Functional training", modality: "functional program" },
  "Bodyweight only": { level: "Bodyweight only", modality: "Bodyweight Training" },
  "Bands only": { level: "Bodyweight only", modality: "Bodyweight Training" },
};
export const MODALITY_LEVELS = ["Full gym", "Functional training", "Bodyweight only"];
export const DAYS_PER_WEEK_OPTIONS = ["3", "4", "5", "6"];

export function modalityName(level) {
  return (MODALITY_BY_EQUIPMENT[level] && MODALITY_BY_EQUIPMENT[level].modality) || level;
}
export function manualNameFor(level, daysPerWeek) {
  return `${modalityName(level)} — ${daysPerWeek} Days/Week`;
}

/* ---------- build a complete 90-day program (all 4 phases) for a given equipment level ---------- */
// main/acc = [sets, reps] for that week's primary / accessory lift slots.
// rx = the week's technical prescription strip: load (%1RM), tempo (eccentric-pause-
// concentric-pause), and target RPE. Golden Hour adds a work set as load climbs; Hold the
// Line trims sets as load peaks — volume moves opposite intensity on purpose.
export const WEEK_SCHEME = [
  // Designate Your Heading — weeks 1-3 — baseline load, technique standard, aerobic base
  { phase: "Designate Your Heading", main: ["3", "8"], acc: ["3", "10"], carrySets: "3", carryDist: "30m", coreDur: "12", note: "",
    rx: { load: "60-65% 1RM", tempo: "3-1-1-0", rpe: "6" },
    cond: { type: "Steady state", sets: "1", reps: "15 min continuous", notes: "Hold a conversational, sustainable pace" } },
  { phase: "Designate Your Heading", main: ["3", "8"], acc: ["3", "10"], carrySets: "3", carryDist: "40m", coreDur: "12", note: "",
    rx: { load: "62-67% 1RM", tempo: "3-1-1-0", rpe: "6-7" },
    cond: { type: "Steady state", sets: "1", reps: "18 min continuous", notes: "Hold a conversational, sustainable pace" } },
  { phase: "Designate Your Heading", main: ["4", "6"], acc: ["4", "8"], carrySets: "4", carryDist: "40m", coreDur: "15", note: "End of Designate Your Heading — technique should be locked in before load climbs",
    rx: { load: "65-70% 1RM", tempo: "3-1-1-0", rpe: "7" },
    cond: { type: "Steady state", sets: "1", reps: "20 min continuous", notes: "Base-building complete — note your average pace for later comparison" } },
  // Golden Hour — weeks 4-7 — progressive overload begins; volume climbs with load
  { phase: "Golden Hour", main: ["4", "6"], acc: ["4", "8"], carrySets: "4", carryDist: "45m", coreDur: "15", note: "Golden Hour begins — heavier loads, same technique standard",
    rx: { load: "72-75% 1RM", tempo: "2-1-1-0", rpe: "7" },
    cond: { type: "HIIT", sets: "6", reps: "20s on / 40s off", notes: "All-out effort on every work interval" } },
  { phase: "Golden Hour", main: ["5", "5"], acc: ["4", "8"], carrySets: "4", carryDist: "45m", coreDur: "18", note: "",
    rx: { load: "75-78% 1RM", tempo: "2-1-1-0", rpe: "7-8" },
    cond: { type: "Steady state", sets: "1", reps: "22 min continuous", notes: "Aim for a slightly faster pace than Week 3" } },
  { phase: "Golden Hour", main: ["6", "4"], acc: ["4", "8"], carrySets: "5", carryDist: "50m", coreDur: "18", note: "",
    rx: { load: "78-80% 1RM", tempo: "2-1-1-0", rpe: "8" },
    cond: { type: "HIIT", sets: "7", reps: "20s on / 40s off", notes: "" } },
  { phase: "Golden Hour", main: ["6", "4"], acc: ["4", "8"], carrySets: "5", carryDist: "50m", coreDur: "20", note: "End of Golden Hour — should feel noticeably stronger than week 1",
    rx: { load: "80-82% 1RM", tempo: "2-1-1-0", rpe: "8" },
    cond: { type: "Steady state", sets: "1", reps: "25 min continuous", notes: "End-of-phase aerobic check" } },
  // Hold the Line — weeks 8-11 — peak intensity; volume trims as load peaks
  { phase: "Hold the Line", main: ["4", "3"], acc: ["3", "6"], carrySets: "5", carryDist: "55m", coreDur: "20", note: "Hold the Line begins — peak effort, push closer to true max",
    rx: { load: "85-87% 1RM", tempo: "1-0-X-0", rpe: "8-9" },
    cond: { type: "HIIT", sets: "8", reps: "20s on / 40s off", notes: "Peak HIIT volume begins" } },
  { phase: "Hold the Line", main: ["4", "3"], acc: ["3", "6"], carrySets: "5", carryDist: "55m", coreDur: "25", note: "",
    rx: { load: "87-89% 1RM", tempo: "1-0-X-0", rpe: "9" },
    cond: { type: "Rounds", sets: "1", reps: "AMRAP 12", notes: "Score = total rounds + reps completed" } },
  { phase: "Hold the Line", main: ["5", "2"], acc: ["3", "6"], carrySets: "6", carryDist: "60m", coreDur: "25", note: "",
    rx: { load: "89-91% 1RM", tempo: "1-0-X-0", rpe: "9" },
    cond: { type: "HIIT", sets: "9", reps: "15s on / 45s off", notes: "Shorter work window, same max effort" } },
  { phase: "Hold the Line", main: ["5", "2"], acc: ["3", "6"], carrySets: "6", carryDist: "60m", coreDur: "30", note: "Peak week — hardest session of the entire block",
    rx: { load: "91-93% 1RM", tempo: "1-0-X-0", rpe: "9-9.5" },
    cond: { type: "Rounds", sets: "1", reps: "AMRAP 15", notes: "Hardest conditioning test of the block" } },
  // RTB — weeks 12-13 — deload, then retest against Week 1's benchmark
  { phase: "RTB", main: ["3", "8"], acc: ["2", "10"], carrySets: "3", carryDist: "30m", coreDur: "20", note: "RTB deload — cut load roughly 40%, focus on movement quality and recovery",
    rx: { load: "50-55% 1RM", tempo: "2-0-1-0", rpe: "≤6" },
    cond: { type: "Steady state", sets: "1", reps: "15 min continuous", notes: "Deload pace — easy effort only" } },
  { phase: "RTB", retest: true, note: "RTB Debrief — retest week. Compare every number against Week 1." },
];

const phaseIndex = (phase) => (phase === "Golden Hour" ? 1 : phase === "Hold the Line" ? 2 : 0);

// Builds the N regular (non-retest) training days for a given week, for a given weekly
// frequency. `find(pattern, idx)` resolves a movement pattern to its phase-indexed variant;
// i2 is the next variant in rotation, used as the second exercise for the same target so
// every target gets ≥2 exercises and the pairing itself changes phase to phase.
export function buildRegularDays(daysPerWeek, w, find, condName, day, phaseIdx) {
  const [ms, mr] = w.main;
  const [as, ar] = w.acc;
  const coreReps = ar === "5" || ar === "6" ? "10" : "12";
  const i2 = (phaseIdx + 1) % 3;

  const lowerBody = (label) =>
    day(label || "Lower body", [
      [find("Squat", phaseIdx), ms, mr, w.note],
      [find("Squat", i2), as, ar, "Secondary quad angle — different variant, same target"],
      [find("Hinge", phaseIdx), ms, mr, ""],
      [find("Hinge", i2), as, ar, "Secondary posterior-chain angle"],
      [find("Loaded carry"), w.carrySets, w.carryDist, ""],
      [find("Core / anti-extension"), as, coreReps, ""],
    ]);
  const upperCombined = () =>
    day("Upper push/pull", [
      [find("Horizontal push", phaseIdx), ms, mr, ""],
      [find("Vertical push", phaseIdx), as, ar, ""],
      [find("Horizontal pull", phaseIdx), ms, mr, ""],
      [find("Vertical pull", phaseIdx), as, "max", "Log actual reps achieved"],
      [find("Triceps", phaseIdx), as, ar, ""],
      [find("Biceps", phaseIdx), as, ar, ""],
    ]);
  const pushDay = (label, opts = {}) => {
    const mIdx = opts.swap ? i2 : phaseIdx;
    const sIdx = opts.swap ? phaseIdx : i2;
    const [s, r] = opts.light ? [as, ar] : [ms, mr];
    return day(label || "Push", [
      [find("Horizontal push", mIdx), s, r, opts.note || (opts.swap ? "" : w.note)],
      [find("Horizontal push", sIdx), as, ar, "Secondary chest angle"],
      [find("Vertical push", mIdx), s, r, ""],
      [find("Vertical push", sIdx), as, ar, "Secondary shoulder angle"],
      [find("Triceps", mIdx), as, ar, ""],
      [find("Triceps", sIdx), "2", "10-12", "Secondary triceps angle"],
    ]);
  };
  const pullDay = (label, opts = {}) => {
    const mIdx = opts.swap ? i2 : phaseIdx;
    const sIdx = opts.swap ? phaseIdx : i2;
    const [s, r] = opts.light ? [as, ar] : [ms, mr];
    return day(label || "Pull", [
      [find("Vertical pull", mIdx), s, "max", "Log actual reps achieved"],
      [find("Vertical pull", sIdx), as, ar, "Secondary lat angle"],
      [find("Horizontal pull", mIdx), s, r, opts.note || ""],
      [find("Horizontal pull", sIdx), as, ar, "Secondary mid-back angle"],
      [find("Biceps", mIdx), as, ar, ""],
      [find("Biceps", sIdx), "2", "10-12", "Secondary biceps angle"],
    ]);
  };
  const conditioningCarry = (label) =>
    day(label || `Conditioning (${w.cond.type}) + carry`, [
      [find("Loaded carry"), w.carrySets, w.carryDist, "Heaviest/hardest carry of the week"],
      [condName, w.cond.sets, w.cond.reps, w.cond.notes],
      [find("Core / anti-extension"), "3", `${w.coreDur}s`, ""],
    ]);
  const fullBodyAccessory = () =>
    day("Full-body accessory", [
      [find("Squat", i2), as, ar, "Lighter, higher-rep — accessory volume, not a max effort"],
      [find("Hinge", i2), as, ar, ""],
      [find("Horizontal push", i2), as, ar, ""],
      [find("Horizontal pull", i2), as, ar, ""],
      [find("Rotational / shoulder flow"), "2", "8/side", "Shoulder health and rotational control"],
      [find("Core / anti-extension"), "2", "12", ""],
    ]);

  if (daysPerWeek === "4") {
    return [lowerBody(), upperCombined(), conditioningCarry(), fullBodyAccessory()];
  }
  if (daysPerWeek === "5") {
    return [lowerBody(), pushDay(), pullDay(), conditioningCarry(), fullBodyAccessory()];
  }
  if (daysPerWeek === "6") {
    return [
      pushDay("Push A"),
      pullDay("Pull A"),
      lowerBody("Legs + carry A"),
      pushDay("Push B", { swap: true, light: true, note: "Second push session — different lead angle, moderate volume" }),
      pullDay("Pull B", { swap: true, light: true, note: "Second pull session — different lead angle, moderate volume" }),
      conditioningCarry("Legs B + carry + conditioning"),
    ];
  }
  // default: 3 days/week
  return [lowerBody(), upperCombined(), conditioningCarry()];
}

export function buildFullProgram(level, daysPerWeek) {
  const dpw = daysPerWeek || "3";
  const find = (pattern, idx = 0) => {
    const variants = MOVEMENT_PATTERNS.find((p) => p.pattern === pattern).variants[level];
    return variants[Math.min(idx, variants.length - 1)];
  };
  const day = (label, rows) => ({
    id: uid(),
    label,
    exercises: rows.map(([name, sets, reps, notes]) => ({ id: uid(), name, sets, reps, notes: notes || "" })),
  });
  const week = (label, days, rx) => ({ id: uid(), label, days, rx });

  const weeks = WEEK_SCHEME.map((w, i) => {
    if (w.retest) {
      const steadyState = CONDITIONING_TYPES["Steady state"][level];
      return week(`Week ${i + 1} — RTB (retest)`, [
        day("Retest lower + core", [
          [find("Squat"), "1", "heaviest set of 5", "Compare load directly against Week 1"],
          [find("Hinge"), "1", "heaviest set of 5", ""],
          [find("Core / anti-extension"), "1", "max hold/reps", ""],
        ]),
        day("Retest upper", [
          [find("Horizontal push"), "1", "heaviest set of 5", "Compare load directly against Week 1"],
          [find("Horizontal pull"), "1", "heaviest set of 5", ""],
          [find("Vertical pull"), "1", "max", "Compare rep count against Week 1"],
        ]),
        day("Retest conditioning", [
          [steadyState, "1", "15 min continuous", "Retest — compare pace/output directly against Week 1's 15-minute piece"],
          [find("Loaded carry"), "1", "max distance in 60s", "RTB Debrief: log bodyweight, waist, and how the block felt overall — deload/retest week runs at reduced frequency regardless of your normal training days"],
        ]),
      ]);
    }
    const phaseIdx = phaseIndex(w.phase);
    const condRx = conditioningRx(level, w.cond);
    const wAdj = { ...w, cond: condRx };
    const condName = CONDITIONING_TYPES[w.cond.type][level];
    const days = buildRegularDays(dpw, wAdj, find, condName, day, phaseIdx);
    if (w.note) days[0].exercises[0].notes = days[0].exercises[0].notes || w.note;
    if (w.phase === "Golden Hour" && i === 6) {
      const last = days[days.length - 1];
      const lastEx = last.exercises[last.exercises.length - 1];
      lastEx.notes = lastEx.notes ? `${lastEx.notes} — SITREP: log bodyweight, waist, recovery` : "SITREP: log bodyweight, waist, recovery";
    }
    days.forEach((d, di) => { d.label = `Day ${di + 1} — ${d.label}`; });
    return week(`Week ${i + 1} — ${w.phase}`, days, w.rx);
  });

  const modality = modalityName(level);
  return {
    id: uid(),
    name: manualNameFor(level, dpw),
    description: `Full 90-day, 4-phase block (Designate Your Heading → Golden Hour → Hold the Line → RTB), ${dpw} days/week, built entirely around ${modality.toLowerCase()} (${level.toLowerCase()}).`,
    weeks,
  };
}

/* ---------- self-check (only runs when this file is executed directly) ---------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  let failures = 0;
  for (const level of MODALITY_LEVELS) {
    for (const dpw of DAYS_PER_WEEK_OPTIONS) {
      const program = buildFullProgram(level, dpw);
      const weekCount = program.weeks.length;
      const nonRetestWeeks = program.weeks.filter((w) => !/RTB \(retest\)/.test(w.label));
      const dayCountsOk = nonRetestWeeks.every((w) => w.days.length === (dpw === "3" ? 3 : Number(dpw)));
      // Muscle-target days (lower/upper/push/pull/full-body-accessory) need >=6 exercises;
      // conditioning days (metabolic finisher, not a target day) are exempt at >=3.
      const exCountsOk = nonRetestWeeks.every((w) =>
        w.days.every((d) => d.exercises.length >= (/conditioning/i.test(d.label) ? 3 : 6))
      );
      const ok = weekCount === 13 && dayCountsOk && exCountsOk;
      if (!ok) failures++;
      const minEx = Math.min(...nonRetestWeeks[0].days.map((d) => d.exercises.length));
      console.log(
        `${ok ? "OK  " : "FAIL"}  ${program.name.padEnd(38)} weeks=${weekCount} days/week=${nonRetestWeeks[0].days.length} min-exercises/day=${minEx}`
      );
    }
  }
  console.log(failures === 0 ? "\nAll combinations generate correctly." : `\n${failures} combination(s) FAILED — do not use until fixed.`);
  process.exit(failures === 0 ? 0 : 1);
}
