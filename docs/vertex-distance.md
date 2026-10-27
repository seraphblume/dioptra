# Vertex compensation

The supplied Boston Equalens / Lumilent fitting-guide photograph has a lower-right table headed “DISTANCIA DE VERTICE A 12 mm”. It is a coarse power-conversion reference, not a method of measuring the physical vertex distance. Its printed arrows specify opposite reading directions for the minus and plus columns. The left-hand diopter/radius table and RGP fitting instructions are separate and are not implemented here.

Use the analytic formula instead of digitizing rounded table entries:

`F_target = F_source / (1 - ((sourceMm - targetMm) / 1000) * F_source)`

Distances are measured from the cornea. Convert the sphere meridian and sphere-plus-cylinder meridian independently, then reconstruct cylinder as their difference. The axis does not change. Keep full precision internally. Calculators show powers to 0.01 D and do not select available contact lens powers or prescribe a fit. Printed fitting charts can contain coarse rounding, product-specific choices or errors. They are not numerical ground truth. Regression tests use independently derived exact reference values, including high powers, both signs and both meridians; no chart-matching error allowance is used.

The calculator defaults to 12 → 0 mm (spectacle to corneal plane); either distance can be changed from 0 to 25 mm, including the reverse conversion. Blank, nonfinite, out-of-range distances and conversion through a focal singularity are rejected.

The existing v0.3 and experimental v0.4 refraction engines already normalized each AR reading to the configured 12 mm spectacle plane before vector averaging, offsets and rounding. They now call the same `js/vertex.js` implementation as the calculator. This does not change their target to 0 mm, add a second conversion, alter calibration, or rewrite historical cases. The v0.3 500-case golden baseline and v0.2 freeze remain intact. The refraction form explains its output plane. A blank instrument distance retains the existing 12 mm assumption and flag.

Sources:

- User-supplied Boston Equalens / Lumilent photograph, lower-right 12 mm table (no patient data).
- [University of Utah Moran CORE: Contact Lens Over-Refraction](https://morancore.utah.edu/section-03-clinical-optics/contact-lens-over-refraction/) — vertex formula and clinical context.
- [CooperVision: Contact Lens Designs](https://coopervision.com/practitioner/ecp-viewpoints/technicians-and-staff/contact-lenses-101-part-2-contact-lens-designs) — 12 mm spectacle / 0 mm contact lens convention and distinction from available lens powers.

Run the existing verification workflow, including optical calculator, engine, baseline/freeze and browser suites. No new calibration or clinical validation is claimed.

## Applying compensation once

The source distance describes the plane of the power currently entered, not necessarily the instrument or spectacles originally used. A prescription already expressed at the cornea has source 0 mm. Converting 0 → 0 mm leaves it unchanged. The calculator explicitly identifies same-plane passthrough and reminds users to confirm the input plane when applying a conversion. It cannot infer prior compensation from sphere, cylinder and axis alone.

Manufacturer trial-lens recommendations may already incorporate vertex conversion and available powers. Do not feed those values through an additional spectacle-to-corneal conversion. Any future table integration must record its input/output planes and compensation provenance before enabling a conversion path.

The approximately ±4 D fitting guideline concerns either principal meridian. It is not a mathematical threshold: the calculator retains exact compensation below it. Spherical equivalent is a separate approximation that removes astigmatic correction; it is not substituted for meridian-by-meridian conversion. Manufacturer multifocal additions, RGP tear-lens/base-curve adjustments, lens rotation and selection of available powers require separate fitting workflows. None changes the general refraction engine's spectacle-plane target or calibration.

Only application code, synthetic checks and this implementation explanation accompany this update. No private notes, vault paths, source attachments or patient records are included.
