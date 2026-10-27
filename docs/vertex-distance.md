# Vertex compensation

The supplied Boston Equalens / Lumilent fitting-guide photograph has a lower-right table headed “DISTANCIA DE VERTICE A 12 mm”. It is a coarse power-conversion reference, not a method of measuring the physical vertex distance. Its printed arrows specify opposite reading directions for the minus and plus columns. The left-hand diopter/radius table and RGP fitting instructions are separate and are not implemented here.

Use the analytic formula instead of digitizing rounded table entries:

`F_target = F_source / (1 - ((sourceMm - targetMm) / 1000) * F_source)`

Distances are measured from the cornea. Convert the sphere meridian and sphere-plus-cylinder meridian independently, then reconstruct cylinder as their difference. The axis does not change. Keep full precision internally. Calculators show powers to 0.01 D and do not select available contact lens powers or prescribe a fit. The photographed values are approximate; tests allow 0.13 D for selected coarse entries while checking exact formula examples independently.

The calculator defaults to 12 → 0 mm (spectacle to corneal plane); either distance can be changed from 0 to 25 mm, including the reverse conversion. Blank, nonfinite, out-of-range distances and conversion through a focal singularity are rejected.

The existing v0.3 and experimental v0.4 refraction engines already normalized each AR reading to the configured 12 mm spectacle plane before vector averaging, offsets and rounding. They now call the same `js/vertex.js` implementation as the calculator. This does not change their target to 0 mm, add a second conversion, alter calibration, or rewrite historical cases. The v0.3 500-case golden baseline and v0.2 freeze remain intact. The refraction form explains its output plane. A blank instrument distance retains the existing 12 mm assumption and flag.

Sources:

- User-supplied Boston Equalens / Lumilent photograph, lower-right 12 mm table (no patient data).
- [University of Utah Moran CORE: Contact Lens Over-Refraction](https://morancore.utah.edu/section-03-clinical-optics/contact-lens-over-refraction/) — vertex formula and clinical context.
- [CooperVision: Contact Lens Designs](https://coopervision.com/practitioner/ecp-viewpoints/technicians-and-staff/contact-lenses-101-part-2-contact-lens-designs) — 12 mm spectacle / 0 mm contact lens convention and distinction from available lens powers.

Run the existing verification workflow, including optical calculator, engine, baseline/freeze and browser suites. No new calibration or clinical validation is claimed.
