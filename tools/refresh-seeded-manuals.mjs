// refresh-seeded-manuals.mjs
//
// Regenerates the name/description/weeks content of the 12 standard equipment x
// days-per-week manuals in the `manuals` table, in place (same row id), from the
// CURRENT program-generator.mjs.
//
// WHY THIS EXISTS: the 12 standard manuals were originally seeded once (via an
// older gen_manuals.js script, long before program-generator.mjs became the
// single source of truth for both the coach dashboard and the $97 self-serve
// PDFs). fulfill-purchase.mjs's "find manual by name, else create" logic means
// once a named manual exists in the table, it is reused forever -- it is never
// automatically regenerated when program-generator.mjs changes. That caused a
// real bug: a client's dashboard/portal view (reads the stored `manuals.weeks`
// directly) showed stale content ("Week 1 -- Find Your Bearing") while a freshly
// downloaded PDF (rendered live via buildFullProgram()) showed the current,
// correct content ("Week 1 -- Designate Your Heading").
//
// Run this any time program-generator.mjs's output changes (a phase rename, an
// exercise-rotation tweak, a periodization change, etc.) to bring the DB back in
// sync with the code. It's idempotent and safe to re-run -- it only touches rows
// whose `name` matches one of the 12 standard combos, and updates them in place
// (same id), so any client already assigned to one is fixed automatically with
// no reassignment needed.
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tools/refresh-seeded-manuals.mjs
//
// REQUIRED ENV VARS (never hardcode these):
//   SUPABASE_URL                 -- e.g. https://nhypmosbyqngfbiwxoow.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    -- service role key, server-side only, never exposed to a browser

import { createClient } from "@supabase/supabase-js";
import { buildFullProgram, MODALITY_LEVELS, DAYS_PER_WEEK_OPTIONS } from "../program-generator.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script. " +
      "These are secrets -- never commit them or pass them on the command line where they'd land in shell history."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let updated = 0;
  let created = 0;
  let unchanged = 0;

  for (const level of MODALITY_LEVELS) {
    for (const dpw of DAYS_PER_WEEK_OPTIONS) {
      const built = buildFullProgram(level, dpw);
      const { data: existing, error: selErr } = await supabase
        .from("manuals")
        .select("id, description, weeks")
        .eq("name", built.name)
        .maybeSingle();
      if (selErr) throw selErr;

      if (!existing) {
        const { error: insErr } = await supabase
          .from("manuals")
          .insert({ name: built.name, description: built.description, weeks: built.weeks });
        if (insErr) throw insErr;
        created++;
        console.log(`created: ${built.name}`);
        continue;
      }

      const same =
        existing.description === built.description &&
        JSON.stringify(existing.weeks) === JSON.stringify(built.weeks);
      if (same) {
        unchanged++;
        console.log(`unchanged: ${built.name}`);
        continue;
      }

      const { error: updErr } = await supabase
        .from("manuals")
        .update({ description: built.description, weeks: built.weeks })
        .eq("id", existing.id);
      if (updErr) throw updErr;
      updated++;
      console.log(`updated: ${built.name}`);
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated, ${unchanged} already current.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
