// build-quote-backgrounds-png.mjs
//
// Renders extraction-quote-backgrounds.html (branded backgrounds for manually-written
// quote posts -- Stories/Reels 1080x1920 and Carousel/Feed 1080x1350, in 3 style
// variants: Black Tactical, Kraft Field, Field Grid) to individual PNGs, one per
// frame, at exact pixel dimensions -- ready to post to or drop into Canva/IG directly.
// Standalone reference document. Re-run if the sizes/variants change.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SOURCE_HTML = path.join(REPO_ROOT, "extraction-quote-backgrounds.html");
const OUT_DIR = path.join(REPO_ROOT, "assets", "quote-backgrounds");

const FRAMES = [
  { id: "story-black", file: "extraction-quote-bg-story-black-1080x1920.png" },
  { id: "story-kraft", file: "extraction-quote-bg-story-kraft-1080x1920.png" },
  { id: "story-grid", file: "extraction-quote-bg-story-grid-1080x1920.png" },
  { id: "feed-black", file: "extraction-quote-bg-feed-black-1080x1350.png" },
  { id: "feed-kraft", file: "extraction-quote-bg-feed-kraft-1080x1350.png" },
  { id: "feed-grid", file: "extraction-quote-bg-feed-grid-1080x1350.png" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  // file:// (not setContent) so relative asset paths (assets/*.png) resolve.
  await page.goto(`file://${SOURCE_HTML}`, { waitUntil: "networkidle" });

  for (const frame of FRAMES) {
    const el = await page.$(`#${frame.id}`);
    const outPath = path.join(OUT_DIR, frame.file);
    await el.screenshot({ path: outPath, omitBackground: false });
    const stat = fs.statSync(outPath);
    console.log(`Wrote ${outPath} (${(stat.size / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
}
