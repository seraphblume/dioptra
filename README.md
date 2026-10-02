# Project Dioptra

Project Dioptra is a local-first web app (PWA) for a blinded study. An autorefractor-based prediction is locked before the subjective exam; the optometrist then enters their own final Rx without seeing it, and the two are compared.

> **Research prototype.** Not a validated medical device. It must not be the sole basis for prescribing or dispensing.

## Engines

| Engine | Status | Role |
|---|---|---|
| **v0.2.0** | Frozen | Produces the locked study prediction for Cohort B. `js/config.js` and `js/algorithm.js` are unchanged. |
| **v0.3.0** | Shadow | Runs on every case and is stored next to the study record. It never replaces the v0.2 result while `mode: "shadow"`. |

### v0.2.0 (frozen for Cohort B)

- Sphere = selected autorefractor sphere −0.25 D
- Cylinder = selected autorefractor cylinder, quantized to 0.25 D
- Axis = selected autorefractor axis, quantized to the nearest 5°
- VA and pinhole are recorded but never change the prediction
- ADD from an age × refractive-state table
- Spherical equivalent (SE = S + C/2) is monitored, with automatic changes capped at ±0.25 D

See the [freeze contract](docs/v0.2-freeze.md).

### v0.3.0 (shadow)

Full specification: [v0.3 engine](docs/v0.3-engine.md).

1. **Uses every autorefractor reading.** It takes the three repeat readings and the selected line, works in power vectors (M, J0, J45) and computes three candidate centres: the selected line, the median and the most-plus reading. It also measures repeatability.
2. **Normalizes vertex distance.** If the instrument's vertex distance differs from 12 mm, it converts each principal meridian separately.
3. **Applies the sphere offset in M, by stratum.** Strata are refractive state × age band (under 40 / 40+). Every stratum starts at the v0.2 value (−0.25 D) until fitted on closed-cohort data.
4. **Predicts in vector space.** Cylinder changes keep the spherical equivalent automatically. Rounding is SE-preserving, and ties go toward plus.
5. **Sets axis resolution from cylinder.** It keeps 1° when |cylinder| ≥ 0.75 D and uses 5° below that.
6. **Fixes the ADD.** The refractive state comes from the raw reading, not from the offset prediction. It can adjust for the patient's working distance and reports an amplitude-based second estimate.
7. **Raises review flags.** These cover repeatability, outlying selected lines, large SE shifts, keratometry disagreement (simplified Javal), oblique astigmatism and pinhole without improvement. Flags never change a dioptric value.

All thresholds marked *provisional* in `js/config-v03.js` are uncalibrated.

### Promoting v0.3

After Cohort B is closed and exported:

```sh
node tools/fit-offsets.js project-dioptra-shadow-YYYY-MM-DD.csv --cohort-closed
```

Paste the printed `sphereOffsets` and `offsetsProvenance` into `js/config-v03.js`, then set `mode: "active"` and `ui.finalAxisStep: 1`, and start a new cohort. The tool refuses v0.2 data unless `--cohort-closed` is passed. It reports leave-one-case-out error for three options: no offset, a global offset and stratified offsets.

## Scoring

The comparison screen and the engine-comparison export use:

- sphere, cylinder and SE within 0.25 D;
- power-vector error (M, J0, J45) and its magnitude;
- an axis tolerance that depends on cylinder (ANSI Z80.1 schedule: ±14° up to 0.25 D, ±7° to 0.50 D, ±5° to 0.75 D, ±3° to 1.50 D, ±2° above). Axis is not scored when either cylinder is zero.

The original v0.2 comparison fields (`exact`, `within5Axis` …) are still produced unchanged for the study CSV.

## Data and exports

Cases are stored in the browser's local storage on the device. Nothing is sent anywhere.

- **Study CSV.** Identical columns to the v0.2 Cohort B export.
- **Engine comparison CSV.** One row per case × eye × engine variant (v0.2, v0.3, and each v0.3 estimator), with the cylinder-aware scores, repeatability evidence, stratum and flags.

Extra observations (repeat readings, reliability digits, vertex distance, PD, near distances, keratometry) are saved under `shadow` with `shadowOnly: true`. They are not part of the study record.

## Development

```sh
node tests/v0.2-freeze.test.js      # frozen v0.2 contract
node tests/v0.3-engine.test.js      # v0.3 engine and scoring
node tests/export-and-fit.test.js   # exports and offset fitting, on synthetic data
```

`tests/algorithm.test.html` runs a browser smoke test. CI runs all of the above on every push and pull request.

| Path | Purpose |
|---|---|
| `js/config.js`, `js/algorithm.js` | Frozen v0.2 engine |
| `js/config-v03.js`, `js/engine-v03.js` | v0.3 engine |
| `js/engines.js` | Chooses the study engine and the shadow engine |
| `js/scoring.js` | Cylinder-aware scoring |
| `js/storage.js` | Local storage and CSV exports |
| `js/app.js`, `index.html`, `css/app.css` | Interface |
| `tools/fit-offsets.js` | Stratified offset fitting |

## Documentation

- [v0.3 engine specification](docs/v0.3-engine.md)
- [Clinical rationale and scope](docs/clinical-rationale.md)
- [References and traceability](docs/source-register.md)
- [v0.3 design notes](docs/v0.3-design-notes.md)
- [v0.3 data collection](docs/data-collection-v0.3.md) and [schema](docs/data-collection-v0.3.schema.json)
- [v0.2 freeze contract](docs/v0.2-freeze.md)
