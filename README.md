# Project Dioptra

**Current algorithm: v0.2.0**

Project Dioptra is a local-first PWA for blinded comparison between an autorefractor-based prediction and the optometrist's independently produced final Rx.

## Research prototype

This is not a validated medical device and must not be used as the sole basis for prescribing or dispensing.

## v0.2.0 — Cohort B

Development Cohort A (25 cases / 50 eyes under v0.1.0) showed a systematic spherical-equivalent bias. v0.2.0 freezes this prospective rule set:

- Sphere = AR sphere −0.25 D
- Cylinder = preserve AR cylinder, quantized to 0.25 D
- Axis = preserve AR direction, quantized to nearest 5°
- VA/pinhole remain recorded but no longer trigger the sphere heuristic
- ADD remains age + refractive-state lookup based

Do not tune these rules during Cohort B.

## Spherical-equivalent safeguard

SE is a sanity monitor, not the prescription target.

`SE = SPH + CYL / 2`

Dioptra records AR SE, predicted SE, clinician SE, AR→prediction shift, and final SE error. Automatic heuristic changes are capped at an absolute 0.25 D SE shift from the AR baseline. The comparison screen shows SE alongside S/C/A after reveal.

CSV export includes the SE fields and remains compatible with locally stored v0.1 cases.

## Other study variables

The chairside UI also records multi-select symptoms plus diabetes, hypertension and pregnancy as observational variables. Final axis is restricted to 5° multiples; raw AR axis is validated to 1–180°.
