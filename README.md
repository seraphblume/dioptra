# Project Dioptra

**Codename:** Project Dioptra  
**Purpose:** A lightweight, local-first PWA for blinded comparison between an autorefractor-based prediction and the optometrist's independently produced final Rx.

## Why "Dioptra"

A *dioptra* was an ancient precision sighting instrument. The name fits this project because the app is not intended to replace clinical judgment; it is a measurement and comparison instrument for testing whether an algorithm can predict the clinician's endpoint.

## Important

This repository is a **research prototype**. It is not validated as a medical device and must not be used as the sole basis for prescribing or dispensing eyewear.

The intended workflow is:

1. Enter pre-refraction data.
2. Lock the algorithm prediction.
3. Complete the normal refraction without viewing the prediction.
4. Enter the clinician's final Rx.
5. Reveal and compare.
6. Save the anonymized case locally.
7. Export CSV for later analysis.

No patient name, phone number, birth date, address, or medical-record number is required.

## Included

- `index.html` — chairside interface
- `css/app.css` — responsive iPhone-first UI
- `js/config.js` — algorithm settings, VA table, ADD table
- `js/algorithm.js` — deterministic v0 predictor and comparison math
- `js/storage.js` — local study storage and CSV export
- `js/app.js` — UI behavior and blind-lock flow
- `manifest.webmanifest` — installable PWA manifest
- `sw.js` — offline cache/service worker
- `assets/` — app icons
- `tests/algorithm.test.html` — browser-based smoke tests
- `.github/workflows/pages.yml` — optional GitHub Pages deployment workflow

## Clinical conventions encoded

- Final axis is restricted to **5-degree multiples**.
- Raw autorefractor axis can be any value from 1–180.
- Sphere/cylinder output is quantized to **0.25 D**.
- Axis error is calculated circularly over 180°.
- Visual acuity values are normalized to decimal values internally.
- The tentative ADD lookup is age + refractive-state based.
- Autorefraction remains an objective baseline, not a source of truth.

## Algorithm v0

v0 is deliberately simple and auditable. It is designed to collect a clean dataset, not to claim a clinically validated prescription.

Current defaults:

- Preserve AR axis, then quantize to nearest 5°.
- Relax negative cylinder by +0.25 D.
- Relax sphere by +0.25 D only when:
  - pinhole improvement is at least 0.20 decimal VA, or
  - baseline VA is at least 0.80 decimal.
- Compute tentative ADD from the embedded age/refractive-state table.

All these values live in `js/config.js`.

### Do not tune after each case

To avoid overfitting and hindsight bias, define a batch size before changing the algorithm (for example, review after 25 or 50 cases). Keep algorithm versions distinct.

## Offline behavior

After the app loads successfully once, the service worker caches the app shell. Saved cases use the browser's `localStorage`.

Important: clearing Safari website data can delete locally stored cases. Export CSV regularly.

## CSV

The export contains:

- raw AR inputs
- VA and pinhole
- locked prediction
- clinician final Rx
- error metrics
- pass/fail tolerance flags
- optional notes

The data is suitable for later analysis in Python, R, Excel, Numbers, or a statistics package.

## Versioning recommendation

Tag algorithm versions before data collection:

- `v0.1.0` — initial deterministic heuristic
- `v0.2.0` — revised rules after predefined pilot batch
- `v1.0.0` — first frozen evaluation version

Never mix algorithm versions in one performance summary without stratifying by version.

## Suggested primary metrics

Per eye:

- exact S/C/A match
- sphere within ±0.25 D
- cylinder within ±0.25 D
- axis within 5°
- spherical equivalent error
- M / J0 / J45 vector error

## Project structure

```text
project-dioptra/
├── .github/
│   └── workflows/
│       └── pages.yml
├── assets/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── css/
│   └── app.css
├── js/
│   ├── algorithm.js
│   ├── app.js
│   ├── config.js
│   └── storage.js
├── tests/
│   └── algorithm.test.html
├── index.html
├── manifest.webmanifest
├── sw.js
└── README.md
```
