// Black-box UI red-team. Point it at any site you have permission to test.
//
//   npm i -D playwright && npx playwright install chromium
//   node tools/redteam.mjs https://example.pages.dev
//
// Only drive sites you own or have been asked to test. Automated probing of a
// third party's production app looks like an attack and can get you blocked.
//
// This tests the UI only. It cannot inject hostile data, because it does not
// know the target's API — so it will not find the class of bug that comes from
// bad rows. With repo access, add a page.route() stub of the data endpoint;
// that is where the sharpest findings come from.

import { chromium } from "playwright";

const URL_ = process.argv[2];
if (!URL_) {
  console.error("usage: node tools/redteam.mjs <url>");
  process.exit(1);
}

const GARBAGE = ["NaN", "undefined", "Infinity", "[object Object]", "[object", "Invalid Date"];

const NASTY = [
  ["400-char unbroken word", "z".repeat(400)],
  ["combining marks", "e" + "́".repeat(300)],
  ["RTL override", "‮gnitset‬"],
  ["ZWJ emoji", "👨‍👩‍👧‍👦".repeat(30)],
  ["zero-width spaces", "a​".repeat(200)],
  ["html-ish", "<img src=x onerror=alert(1)>"],
  ["quotes and slashes", `"'\`\\/<>&`],
  ["whitespace only", "     "],
  ["newlines", "a\nb\r\nc"],
  ["5000 chars", "a".repeat(5000)],
];

const findings = [];
const add = (area, input, output, why) => {
  findings.push({ area, input, output, why });
  console.log(`\n[${findings.length}] ${area}`);
  console.log(`    INPUT   ${input}`);
  console.log(`    OUTPUT  ${output}`);
  console.log(`    WHY     ${why}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let crashes = [];
page.on("pageerror", (e) => crashes.push(e.message));
const netErrors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  (/Failed to load resource|net::ERR_|ERR_TUNNEL/.test(t) ? netErrors : crashes).push(t);
});
page.on("dialog", async (d) => { crashes.push("dialog: " + d.message()); await d.dismiss(); });

async function audit(context) {
  if (crashes.length) {
    add(context, "—", `crash: ${crashes[0].slice(0, 110)}`, "An uncaught error can blank the page or leave it half-rendered.");
    crashes = [];
  }
  const body = await page.locator("body").innerText().catch(() => "");
  for (const tok of GARBAGE) {
    if (body.includes(tok)) {
      add(context, "—", `"${tok}" rendered on screen`, "A raw JS value reaching the page means a value was used before being checked.");
      break;
    }
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2).catch(() => false);
  if (overflow) add(context, "—", "horizontal page overflow", "Content escapes the viewport, so something is unreachable without sideways scrolling.");
  const empty = await page.evaluate(() => document.body.innerText.trim().length < 20).catch(() => true);
  if (empty) add(context, "—", "page is essentially blank", "No visible content: the app probably threw during render.");
}

console.log(`\n=== red-team ${URL_} ===`);
await page.goto(URL_, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
await audit("initial load");

// --- 1. Hostile text into every visible text input -------------------------
const inputs = await page.locator('input[type="text"], input:not([type]), input[type="search"], textarea').all();
console.log(`\n-- fuzzing ${inputs.length} text input(s)`);
for (const [label, value] of NASTY) {
  for (const input of inputs) {
    if (!(await input.isVisible().catch(() => false))) continue;
    await input.fill(value).catch(() => {});
    await page.waitForTimeout(220);
    await audit(`text input :: ${label}`);
    await input.fill("").catch(() => {});
  }
}

// --- 2. Viewport sweep -----------------------------------------------------
console.log("\n-- viewport sweep");
for (const [w, h] of [[320, 568], [360, 740], [768, 1024], [1440, 900], [2560, 1440]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  await audit(`viewport ${w}x${h}`);
}
await page.setViewportSize({ width: 1280, height: 900 });

// --- 3. Keyboard reachability ---------------------------------------------
// Distinct elements are counted by tagging the node itself. Identifying them
// by tag+class collapses a list of 29 identical cards into one entry and
// reports a focus trap that is not there.
console.log("\n-- keyboard walk");
await page.evaluate(() => document.querySelectorAll("[data-rt-seen]").forEach((e) => delete e.dataset.rtSeen));
await page.locator("body").click({ position: { x: 2, y: 2 } }).catch(() => {});
let repeats = 0;
for (let i = 0; i < 120; i++) {
  await page.keyboard.press("Tab");
  const fresh = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    if (el.dataset.rtSeen) return false;
    el.dataset.rtSeen = "1";
    return true;
  });
  repeats = fresh ? 0 : repeats + 1;
  if (repeats > 15) break;
}
const reached = await page.evaluate(() => document.querySelectorAll("[data-rt-seen]").length);
const focusable = await page.locator('a[href], button:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"])').count();
if (focusable > 3 && reached < focusable * 0.5) {
  add("keyboard", "Tab walk", `reached ${reached} of ~${focusable} focusable element(s)`,
      "Controls that Tab never reaches are unusable without a mouse.");
}
await page.evaluate(() => document.querySelectorAll("[data-rt-seen]").forEach((e) => delete e.dataset.rtSeen));

// --- 4. Click everything clickable ----------------------------------------
console.log("\n-- clicking interactive elements");
const clickable = await page.locator("button:visible").all();
for (let i = 0; i < Math.min(clickable.length, 25); i++) {
  await clickable[i].click({ timeout: 2500, force: true }).catch(() => {});
  await page.waitForTimeout(250);
  await audit(`click button #${i + 1}`);
  await page.keyboard.press("Escape").catch(() => {});
}

// --- 5. Reload / back-forward ---------------------------------------------
console.log("\n-- navigation");
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
await audit("after reload");
await page.goBack({ timeout: 4000 }).catch(() => {});
await page.goForward({ timeout: 4000 }).catch(() => {});
await audit("after back/forward");

// --- 6. Images -------------------------------------------------------------
const brokenImgs = await page.evaluate(() =>
  [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src).slice(0, 3));
if (brokenImgs.length) add("images", "—", `broken: ${brokenImgs.join(", ")}`, "An image that fails to load leaves a gap or alt text where content should be.");

if (netErrors.length) {
  console.log(`\n-- ${netErrors.length} network error(s) seen (not counted as findings):`);
  console.log("   " + netErrors[0].slice(0, 120));
  console.log("   If the site depends on that request, everything below tested an error state.");
}

console.log(`\n================ ${findings.length} finding(s) ================`);
if (!findings.length) console.log("Nothing broke at the UI level. Ask for repo access to stub the data layer — that is where the real bugs hide.");
await browser.close();
