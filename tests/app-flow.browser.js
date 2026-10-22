#!/usr/bin/env node
// Synthetic cases only, in isolated Chromium storage. Requires Playwright + Chromium.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.DIOPTRA_BROWSER_CHANNEL ? { channel: process.env.DIOPTRA_BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    assert.match(await page.locator("#engineLine").innerText(), /Candidate engine v0.3.0/);
    assert.equal(await page.locator("#previousRxFields").isVisible(), false);

    // A real old-format record must retain both engine identities and its original bytes.
    const historical = await page.evaluate(() => {
      const input = { age: 25, previousRxKnown: "", od: { sphere: -2.5, cylinder: -1.25, axis: 178 }, os: { sphere: -2.75, cylinder: -1, axis: 168 } };
      DIOPTRA_V03_CONFIG.mode = "shadow";
      const run = DioptraEngines.run(input);
      const actual = { od: { ...input.od }, os: { ...input.os }, add: null, note: "Synthetic historical case" };
      const record = { caseId: "RX-0001", savedAt: "2026-10-01T12:00:00Z", input, actual, prediction: run.primary.prediction,
        comparison: { od: DioptraAlgorithm.compareEye(run.primary.prediction.od, actual.od), os: DioptraAlgorithm.compareEye(run.primary.prediction.os, actual.os) },
        shadow: { shadowOnly: true, prediction: run.shadow.prediction, observations: { near: { workingDistanceCm: 40, nearPointCm: 50 } } } };
      DioptraStorage.saveCase(record);
      return JSON.stringify(record);
    });
    await page.reload();
    assert.match(await page.locator("#statsScope").innerText(), /0 cases · 1 earlier cases/);
    assert.equal(await page.locator("#stats .stat strong").first().innerText(), "0");
    assert.equal(await page.locator("#engineCompare tr").count(), 6);
    const oldExport = await page.evaluate(() => DioptraStorage.toShadowCSV(DioptraStorage.listCases()));
    const oldRows = oldExport.split("\n").map(r => r.split(","));
    assert.equal(oldRows[1][oldRows[0].indexOf("near_wd_mm")], "400");

    // A dropdown-only edit must trigger the discard guard.
    await page.locator("#odSelSph").selectOption("2.50");
    await page.getByRole("button", { name: "New Case", exact: true }).click();
    await page.locator("#dialog").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Keep Editing" }).click();
    assert.equal(await page.locator("#odSelSph").inputValue(), "2.50");

    await page.locator("#age").fill("52");
    for (const [id, value] of Object.entries({ odSelSph: "2.50", odSelCyl: "1.25", odSelAx: "178", osSelSph: "2.75", osSelCyl: "1.00", osSelAx: "168" })) {
      await page.locator(`#${id}`).selectOption(value);
    }
    for (const id of ["vaOd", "phOd", "vaOs", "phOs"]) {
      assert.equal(await page.locator(`#${id} option[value="20/100"]`).innerText(), "0.20 = 20/100");
    }
    await page.locator("#vaOd").selectOption("20/100");
    await page.locator("#nearWd").fill("330");
    await page.locator("#nearPoint").fill("500");
    await page.getByRole("radio", { name: "Yes", exact: true }).click();
    assert.equal(await page.locator("#previousRxFields").isVisible(), true);
    await page.locator("#primaryAction").click();
    assert.equal(await page.locator("body").getAttribute("data-stage"), "measure");
    assert.match(await page.locator("#toast").innerText(), /previous prescription/);
    for (const eye of ["od", "os"]) {
      await page.locator(`#${eye}PrevSph`).selectOption("1.00");
    }
    await page.getByRole("button", { name: "Toggle OD previous sphere sign" }).click();
    await page.locator("#previousAdd").selectOption("1.25");
    await page.getByRole("radio", { name: "No", exact: true }).click();
    assert.equal(await page.locator("#previousRxFields").isVisible(), false);
    await page.getByRole("radio", { name: "Yes", exact: true }).click();
    assert.equal(await page.locator("#odPrevSph").inputValue(), "1.00");

    // mm validation catches a cm-sized entry, and 330 mm reaches the engine as 33 cm.
    await page.locator("#nearWd").fill("33");
    await page.locator("#primaryAction").click();
    assert.equal(await page.locator("body").getAttribute("data-stage"), "measure");
    assert.match(await page.locator("#toast").innerText(), /150–1000 mm/);
    await page.locator("#nearWd").fill("330");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile has no horizontal overflow");
    if (process.env.DIOPTRA_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.DIOPTRA_SCREENSHOT_DIR, { recursive: true });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.DIOPTRA_SCREENSHOT_DIR, "dioptra-candidate-mobile.png"), fullPage: true });
    }
    await page.locator("#primaryAction").click();
    assert.match(await page.locator("#lockedDetail").innerText(), /v0.3.0/);
    for (const eye of ["od", "os"]) {
      await page.locator(`#${eye}FinSph`).selectOption("2.75");
      await page.locator(`#${eye}FinCyl`).selectOption("1.25");
      await page.locator(`#${eye}FinAx`).selectOption("178");
    }
    await page.locator("#primaryAction").click();
    assert.equal(await page.locator("body").getAttribute("data-stage"), "compare");
    assert.match(await page.locator("#comparisonContent").innerText(), /Right eye · v0\.3\.0/i);
    await page.locator("#primaryAction").click();
    const saved = await page.evaluate(() => DioptraStorage.listCases());
    assert.equal(saved.length, 2);
    assert.equal(JSON.stringify(saved[0]), historical, "historical record is untouched");
    const c = saved[1];
    assert.equal(c.schema, "dioptra-case-2");
    assert.equal(c.cohort, "v0.3-candidate-1");
    assert.equal(c.prediction.engine, "v0.3");
    assert.equal(c.prediction.od.axis, 178);
    assert.equal(c.prediction.tentativeAdd, 1.75);
    assert.equal(c.shadow.prediction.version, "0.2.0");
    assert.equal(c.observations.near.workingDistanceCm, 33);
    assert.equal(c.observations.near.nearPointCm, 50);
    assert.equal(c.input.previousRx.od.sphere, 1);
    assert.equal(c.input.previousRx.os.sphere, -1);
    assert.equal(c.input.previousRx.od.cylinder, 0);
    assert.equal(c.input.previousRx.add, 1.25);
    assert.equal(c.input.od.va, "20/100");
    assert.equal(await page.locator("#previousRxFields").isVisible(), false);
    assert.equal(await page.locator("#nearWd").inputValue(), "");
    assert.equal(await page.locator("#stats .stat strong").first().innerText(), "1");
    const csv = await page.evaluate(() => DioptraStorage.toShadowCSV(DioptraStorage.listCases()));
    const rows = csv.split("\n").map(r => r.split(","));
    const recordRow = rows.find(r => r[0] === c.caseId && r[4] === "v0.3" && r[5] === "od");
    for (const [field, value] of Object.entries({ near_wd_mm: "330", near_point_mm: "500", previous_sph: "1", previous_cyl: "0", previous_axis: "180", previous_add: "1.25", cohort: "v0.3-candidate-1", record_schema: "dioptra-case-2" })) {
      assert.equal(recordRow[rows[0].indexOf(field)], value, field);
    }

    // Stub OCR only; exercise the production parser and all import-to-form mappings.
    await page.evaluate(() => {
      DioptraTicketScan.scanImage = async () => DioptraTicketScan.parseTicketText("<R>\n-2.37 -1.12 178 9\n<-2.37 -1.12 178>\n<L>\n+1.37 -0.62 168 9\n<+1.37 -0.62 168>\nVD=12.0\nWD=40cm\nPD=62");
    });
    await page.locator("#ticketImageInput").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from("stubbed OCR") });
    await page.locator("#scanStatus").filter({ hasText: /Imported/ }).waitFor();
    assert.equal(await page.locator("#odSelSph").inputValue(), "2.37");
    assert.equal(await page.locator("#odSelCyl").inputValue(), "1.12");
    assert.equal(await page.locator("#osSelSph").getAttribute("data-sign"), "1");
    assert.equal(await page.locator("#odR1Q").inputValue(), "9");
    assert.equal(await page.locator("#nearWd").inputValue(), "400");
    await page.locator("#age").fill("30");
    await page.getByRole("radio", { name: "Yes", exact: true }).click();
    await page.locator("#odPrevSph").selectOption("4.00");
    await page.getByRole("radio", { name: "No", exact: true }).click();
    await page.locator("#primaryAction").click();
    for (const eye of ["od", "os"]) await page.locator(`#${eye}FinSph`).selectOption("0.00");
    await page.locator("#primaryAction").click();
    await page.locator("#primaryAction").click();
    const scanned = await page.evaluate(() => DioptraStorage.listCases().at(-1));
    assert.equal(scanned.input.previousRx, null, "hidden stale previous Rx is excluded");
    assert.equal(scanned.input.od.sphere, -2.37, "scan is not rounded by dropdown");
    assert.equal(scanned.input.os.sphere, 1.37);
    assert.equal(scanned.observations.near.workingDistanceCm, 40);
    assert.equal(scanned.observations.near.nearPointCm, null);

    // Tools are a separate workspace, not a shortcut around the blinded case flow.
    const beforeTools = await page.evaluate(() => JSON.stringify(DioptraStorage.listCases()));
    await page.locator("#age").fill("44");
    await page.locator("#calculatorTab").click();
    assert.equal(await page.locator("#casePanel").isVisible(), false);
    assert.equal(await page.locator("#actionBar").isVisible(), false);
    assert.equal(await page.locator("#caseActions").isVisible(), false);
    await page.locator("#calculatorForm button[type=submit]").click();
    assert.match(await page.locator("#calculatorError").innerText(), /Enter sphere/);
    for (const [id, value] of Object.entries({ calcSphere: "-1.50", calcCylinder: "-1.25", calcAxis: "180" })) await page.locator(`#${id}`).fill(value);
    await page.locator("#calculatorForm button[type=submit]").click();
    assert.equal(await page.locator("#calcTransposed").innerText(), "-2.75 +1.25 × 090°");
    assert.equal(await page.locator("#calcSE").innerText(), "-2.125 D");
    await page.locator("#useTransposed").click();
    assert.equal(await page.locator("#calcSphere").inputValue(), "-2.75");
    assert.equal(await page.locator("#calcTransposed").innerText(), "-1.50 -1.25 × 180°");
    await page.locator("#calcAxis").fill("181");
    assert.equal(await page.locator("#calculatorResults").isVisible(), false, "editing removes stale outputs");
    await page.locator("#calculatorForm button[type=submit]").click();
    assert.match(await page.locator("#calculatorError").innerText(), /1° to 180°/);
    await page.locator(".calculator-paste summary").click();
    await page.locator("#calculatorPaste").fill("−2,00 +3,00 × 90");
    await page.locator("#calculatorPasteForm button").click();
    assert.equal(await page.locator("#calcTransposed").innerText(), "+1.00 -3.00 × 180°");
    assert.equal(await page.locator("#calcSE").innerText(), "-0.50 D");
    await page.locator("#calculatorPaste").fill("1 2 x999");
    await page.locator("#calculatorPasteForm button").click();
    assert.match(await page.locator("#calculatorPasteError").innerText(), /1° to 180°/);
    assert.equal(await page.locator("#calcSphere").inputValue(), "-2.00", "invalid paste never partially applies");
    await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.copiedText = text; } } }); });
    await page.locator("#copySE").click();
    assert.equal(await page.evaluate(() => window.copiedText), "-0.50 D");
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error("Denied"); }; });
    await page.locator("#copyTransposed").click();
    await page.locator("#calculatorStatus").filter({ hasText: /Clipboard unavailable/ }).waitFor();
    await page.locator("#calculatorTab").focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator("#caseTab").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#age").inputValue(), "44");
    await page.locator("#newCaseBtn").click();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page.locator("#caseTab").focus();
    await page.keyboard.press("End");
    assert.equal(await page.locator("#calcSphere").inputValue(), "-2.00", "case reset preserves calculator inputs");
    assert.equal(await page.locator("#calcSE").innerText(), "-0.50 D");

    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${colorScheme} calculator overflow at ${width}`);
        if (process.env.DIOPTRA_SCREENSHOT_DIR && width !== 320) {
          await page.locator(".calculator-paste summary").evaluate(el => { el.parentElement.open = false; });
          await page.screenshot({ path: path.join(process.env.DIOPTRA_SCREENSHOT_DIR, `calculator-${colorScheme}-${width}.png`), fullPage: true });
        }
      }
    }
    await page.locator("#calculatorReset").click();
    assert.equal(await page.locator("#calcSphere").inputValue(), "");
    assert.equal(await page.locator("#calculatorResults").isVisible(), false);
    await page.locator("#calcSphere").fill("1.13");
    await page.locator("#calcCylinder").fill("0");
    await page.locator("#calculatorForm button[type=submit]").click();
    assert.equal(await page.locator("#calcTransposed").innerText(), "+1.13 DS");
    assert.equal(await page.locator("#calcSE").innerText(), "+1.13 D");
    assert.equal(await page.evaluate(() => JSON.stringify(DioptraStorage.listCases())), beforeTools);
    await page.locator("#caseTab").click();
    await page.locator("#age").fill("44");
    for (const eye of ["od", "os"]) await page.locator(`#${eye}SelSph`).selectOption("1.00");
    await page.locator("#primaryAction").click();
    assert.equal(await page.locator("body").getAttribute("data-stage"), "refract");
    await page.locator("#calculatorTab").click();
    await page.locator("#caseTab").click();
    assert.equal(await page.locator("body").getAttribute("data-stage"), "refract");
    assert.equal(await page.locator("#comparisonContent").innerHTML(), "", "tab switch never reveals the locked prediction");
    assert.deepEqual(errors, []);
    console.log("PASS: candidate form, cohort isolation, previous Rx, mm conversion, exports, scan import, calculators, tab isolation, keyboard navigation, light/dark mobile layouts");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
