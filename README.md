# Project Dioptra

## Current release: v0.4.0-rc.1 (experimental, unvalidated)

New cases use the fitted v0.4 RC as primary and unchanged v0.3 as shadow comparator. v0.2 no longer runs on new cases; historical records and frozen sources are retained. A new prospective cohort keeps RC evaluation separate from development cases.

The post-exam percentage is **agreement within explicit tolerances, not clinical confidence**. Previous-Rx wearing duration is optional context and never changes a prediction. See [the RC specification](docs/v0.4-rc.md) for the exact offsets, fitting limitations, pediatric/sparse-group fallbacks, scoring denominator, export additions and validation plan. The v0.3/v0.2 sections below document earlier releases, not current routing.

## Paper-and-ink workspace

The interface follows [L’Oeil](https://github.com/seraphblume/loeil)'s warm paper/ink palette, serif branding, fine rules and pill navigation, with device-matched light/dark themes. Refraction and Calculators are separate tabs; switching preserves the in-progress case without revealing a locked prediction. No remote styling or font dependencies are required.

Calculators accept either cylinder sign and provide transposition and spherical equivalent (SE) rounded to the nearest 0.25 D. Optional arithmetic steps retain the exact SE and adjacent quarter-diopter values. They never change an engine, patient record or cohort. Resetting a case does not clear calculator work, and clearing the calculator does not touch a case. Calculator work is session-only and is not saved on reload.

- Transposition: `S′ = S + C`, `C′ = −C`, axis rotated 90° within 1–180°.
- SE: `S + C/2`, retained exactly to 0.005 D in calculation details. Display and Copy SE use the nearest 0.25 D; exact halfway values round toward more plus (−2.125 → −2.00, +2.125 → +2.25). This explicit mathematical convention is not a treatment recommendation. Transposition is not rounded.
- Powers accept up to two decimal places, including decimal commas and Unicode minus signs. Sphere and transposed sphere must be within ±100 D; cylinder within ±20 D. Invalid numbers and axes are rejected, never clamped. Zero cylinder needs no axis.
- Paste accepts `−2.00 +3.00 × 90`, cylinder-only `−1.25 × 90` (plano sphere), and sphere-only `−2.00 DS` or `plano`.
- Copy reports clipboard failures honestly; displayed values remain manually selectable.

Formula reference: [University of Iowa, Introduction to Optics and Refractive Errors](https://eyerounds.org/video/Refraction/Intro-Optics-Refract-Errors/index.htm). SE does not retain astigmatic correction and is not a substitute prescription.

Run `node tests/optical-calculators.test.js` for the standalone arithmetic tests. The existing browser regression also covers tabs, calculator isolation, accessibility keys, precision, copy failure, and mobile light/dark layouts. The v0.2 freeze and v0.3 candidate rules are unchanged by this UI update.

Project Dioptra is a local-first web app (PWA) for a blinded study. An autorefractor-based prediction is locked before the subjective exam; the optometrist then enters their own final Rx without seeing it, and the two are compared.

> **Research prototype.** Not a validated medical device. It must not be the sole basis for prescribing or dispensing.

## Engines

| Engine | Status | Role |
|---|---|---|
| **v0.2.0** | Frozen comparison | Historical Cohort B engine; runs in shadow for new cases. `js/config.js` and `js/algorithm.js` are unchanged. |
| **v0.3.0** | Active candidate | Produces the locked prediction for new cases in `v0.3-candidate-1`, using the existing prior offsets. |

### v0.2.0 (frozen for Cohort B)

- Sphere = selected autorefractor sphere −0.25 D
- Cylinder = selected autorefractor cylinder, quantized to 0.25 D
- Axis = selected autorefractor axis, quantized to the nearest 5°
- VA and pinhole are recorded but never change the prediction
- ADD from an age × refractive-state table
- Spherical equivalent (SE = S + C/2) is monitored, with automatic changes capped at ±0.25 D

See the [freeze contract](docs/v0.2-freeze.md).

### v0.3.0 (active candidate)

Full specification: [v0.3 engine](docs/v0.3-engine.md).

1. **Uses every autorefractor reading.** It takes the three repeat readings and the selected line, works in power vectors (M, J0, J45) and computes three candidate centres: the selected line, the median and the most-plus reading. It also measures repeatability.
2. **Normalizes vertex distance.** If the instrument's vertex distance differs from 12 mm, it converts each principal meridian separately.
3. **Applies the sphere offset in M, by stratum.** Strata are refractive state × age band (under 40 / 40+). Every stratum starts at the v0.2 value (−0.25 D) until fitted on closed-cohort data.
4. **Predicts in vector space.** Cylinder changes keep the spherical equivalent automatically. Rounding is SE-preserving, and ties go toward plus.
5. **Sets axis resolution from cylinder.** It keeps 1° when |cylinder| ≥ 0.75 D and uses 5° below that.
6. **Fixes the ADD.** The refractive state comes from the raw reading, not from the offset prediction. It can adjust for the patient's working distance and reports an amplitude-based second estimate.
7. **Raises review flags.** These cover repeatability, outlying selected lines, large SE shifts, keratometry disagreement (simplified Javal), oblique astigmatism and pinhole without improvement. Flags never change a dioptric value.

All thresholds marked *provisional* in `js/config-v03.js` are uncalibrated.

### Candidate transition and future calibration

On 2026-10-16, v0.3 was promoted at the owner's request with `mode: "active"` and 1° final-axis entry. New records belong to `v0.3-candidate-1`, separate from Cohort B. No offsets were fitted and no prediction rules changed; the algorithm version remains 0.3.0. Existing records are retained untouched. Study statistics include only the new candidate cohort; engine comparisons select each stored prediction by its actual engine identity across all saved cases.

For future calibration, close and export the relevant development cohort before fitting:

```sh
node tools/fit-offsets.js project-dioptra-shadow-YYYY-MM-DD.csv --cohort-closed
```

Any adopted offset changes require a new algorithm version and cohort. The tool refuses v0.2 data unless `--cohort-closed` is passed. It reports leave-one-case-out error for three options: no offset, a global offset and stratified offsets.

## Scoring

The comparison screen and the engine-comparison export use:

- sphere, cylinder and SE within 0.25 D;
- power-vector error (M, J0, J45) and its magnitude;
- an axis tolerance that depends on cylinder (ANSI Z80.1 schedule: ±14° up to 0.25 D, ±7° to 0.50 D, ±5° to 0.75 D, ±3° to 1.50 D, ±2° above). Axis is not scored when either cylinder is zero.

The original v0.2 comparison fields (`exact`, `within5Axis` …) are still produced unchanged for the study CSV.

## Autorefractor ticket scanning

The Measure screen can populate the AR tables from a photographed or selected autorefractor ticket. Recognition runs in the browser using Tesseract.js; the OCR library/language assets are fetched from a CDN on first use, but Dioptra's code does not upload or persist the ticket image. The imported values are always editable and must be reviewed before the prediction is locked.

The parser is intentionally format-conservative: it looks for the ticket's OD/R and OS/L sections, up to three repeated S/C/A readings plus the selected/bracketed line, reliability digits, VD, WD, distance PD and near PD. Patient name and other identifying text are ignored. Manual entry remains the fallback and source of truth when OCR is uncertain.

## Data and exports

Cases are stored in the browser's local storage on the device. Nothing is sent anywhere.

- **Study CSV.** Identical columns to the v0.2 Cohort B export.
- **Engine comparison CSV.** One row per case × eye × engine variant (v0.2, v0.3, and each v0.3 estimator), with cylinder-aware scores, repeatability evidence, stratum and flags. Appended columns include record schema, cohort, near distances in mm, and the previous prescription for that eye plus ADD. Historical cm columns retain their meaning.

New records use `schema: "dioptra-case-2"`, `cohort: "v0.3-candidate-1"`, and top-level `observations`. Historical `shadow.observations` remains readable. Previous Rx is saved as `input.previousRx` only when Yes is selected; it is collected for history and does not alter the current candidate prediction.

Manual sphere/cylinder entry uses 0.25 D dropdowns with a sphere sign toggle; AR and final axes use 1° dropdowns. Exact scanned values between dropdown steps are preserved. VA choices show both decimal and feet (for example, `0.20 = 20/100`); stored values remain Snellen. Working distance and near point are entered in mm and converted to the engine's existing cm representation at the input boundary.

## Development

```sh
node tests/v0.2-freeze.test.js      # frozen v0.2 contract
node tests/v0.3-engine.test.js      # v0.3 engine and scoring
node tests/export-and-fit.test.js   # exports and offset fitting, on synthetic data
```

`tests/algorithm.test.html` runs a browser smoke test. CI runs all of the above on every push and pull request.

With Playwright and Chromium installed, `node tests/app-flow.browser.js` tests the complete candidate entry, scan-import, lock, reveal, save, and export flow in isolated browser storage, including historical records and a narrow mobile viewport.

| Path | Purpose |
|---|---|
| `js/config.js`, `js/algorithm.js` | Frozen v0.2 engine |
| `js/config-v03.js`, `js/engine-v03.js` | v0.3 engine |
| `js/engines.js` | Chooses the study engine and the shadow engine |
| `js/scoring.js` | Cylinder-aware scoring |
| `js/storage.js` | Local storage and CSV exports |
| `js/app.js`, `js/ticket-scan.js`, `index.html`, `css/app.css` | Interface and local ticket scanning |
| `tools/fit-offsets.js` | Stratified offset fitting |

## Documentation

- [v0.3 engine specification](docs/v0.3-engine.md)
- [Clinical rationale and scope](docs/clinical-rationale.md)
- [References and traceability](docs/source-register.md)
- [v0.3 design notes](docs/v0.3-design-notes.md)
- [v0.3 data collection](docs/data-collection-v0.3.md) and [schema](docs/data-collection-v0.3.schema.json)
- [v0.2 freeze contract](docs/v0.2-freeze.md)
