# Clinical rationale and scope

## What Dioptra is predicting

The supplied procedure separates several clinically different values that must not be collapsed into one target:

```text
objective observations
  -> monocular subjective endpoint
  -> binocularly reconciled endpoint
  -> prescribed/dispensed Rx
  -> product fitting
```

For Dioptra, the intended long-term targets are therefore:

1. **Subjective refractive endpoint**: the optically refined S/C/A result before adaptation or dispensing choices.
2. **Prescribed Rx**: the value actually issued after binocular comfort, habitual-correction history, adaptation and clinician judgment are considered.

A difference between these targets is not automatically model error. It is a prescribing decision that needs an explicit reason code.

The current v0.2.0 study does not implement this decomposition. It predicts from the selected autorefractor S/C/A and compares with the clinician-entered final Rx. The richer structure is proposed for v0.3 data collection only.

## Evidence sources to keep separate

The objective-refraction source identifies four different starting observations:

- habitual spectacles measured by lensometer;
- selected and, where available, repeated autorefractor readings;
- keratometry;
- retinoscopy.

They do not measure identical things. Dioptra should retain each raw observation with its method, eye, units and provenance. Agreement can later support confidence; disagreement should trigger review rather than a silent average.

The subjective-refraction source then adds process evidence:

- tentative starting Rx;
- cylinder axis and power refinement;
- sphere refinement;
- best-achieved monocular VA;
- binocular-balance eligibility and result;
- dominant eye when relevant;
- tentative and refined ADD.

This process data explains *how* an endpoint was reached and supports later error analysis without changing the frozen v0.2 output.

## Clinically useful roles for preliminary tests

The preliminary-test source places history, VA, pinhole, cover test, near point of convergence, colour vision, external examination, motility, pupils and confrontation fields before refraction. Their safest initial use in Dioptra is:

- **context**: chief complaint, visual task and habitual-correction experience;
- **data-quality checks**: was the expected test performed under the documented correction condition?;
- **reason codes**: why a subjective test was not usable or why the case needs review;
- **safety flags**: abnormal or incomplete screening should prevent an unqualified high-confidence presentation;
- **stratification**: future analysis may examine subgroups after adequate sample sizes exist.

They are not direct dioptric switches. In particular, pinhole improvement must not automatically add or subtract sphere, and colour-vision status must not independently alter the Rx.

## Habitual correction

Both the objective and subjective sources give special importance to the patient's habitual correction. A yes/no field loses the clinically useful information. Future collection should include, per eye:

- measured habitual S/C/A and ADD;
- age of the prescription when known;
- corrected VA with that prescription;
- patient satisfaction and complaint;
- whether the patient is adapted to it;
- vector change from habitual to objective, subjective and prescribed values.

The subjective source also describes staged prescribing when a full change may be difficult to tolerate. This is the main reason to keep the subjective endpoint and issued prescription separate.

## VA and pinhole

The eye-exam source records distance VA with and without correction, near VA at the patient's working distance, and pinhole when VA is worse than 20/30. In Dioptra:

- preserve the original notation and correction condition;
- treat pinhole as evidence about whether ordinary refractive blur plausibly explains reduced VA;
- compare achieved best-corrected VA with the recorded pinhole result as a review check;
- do not infer disease or prescribe from pinhole alone;
- distinguish not performed, not indicated, untestable and missing.

## Cylinder, sphere and optical invariants

The subjective source explicitly couples cylinder and sphere during Jackson cross-cylinder refinement: adding −0.50 D cylinder is accompanied by +0.25 D sphere to preserve spherical equivalent. This supports two safeguards:

1. represent S/C/A changes in a way that preserves the combined optical effect;
2. run a spherical-equivalent sanity check after all component changes, rather than trusting apparently small independent adjustments.

Spherical equivalent is not enough to describe astigmatic prescriptions. Future comparison should retain S/C/A and use power vectors:

```text
M   = S + C / 2
J0  = (-C / 2) cos(2A)
J45 = (-C / 2) sin(2A)
```

This representation is a Dioptra design choice. The training sources support the need to preserve optical relationships but do not prescribe a statistical vector model.

## Binocular and ADD layers

The procedure performs binocular balance only after the eyes reach equal VA and favors the dominant eye if equality cannot be achieved. A future model should therefore produce monocular candidates first, then assess binocular consistency. It should not finalize OD and OS as unrelated records.

For presbyopia, the source distinguishes tentative ADD from refinement using NRA/PRA or a near-distance check. The record should keep:

- the method used for tentative ADD;
- actual working distance;
- NRA and PRA when performed;
- the result of the distance check when used;
- refined ADD and comfortable near VA;
- prescribed ADD per eye, allowing an asymmetric result to be represented even when uncommon.

The current v0.2 age/refractive-state table remains frozen. These fields are for future evaluation, not a mid-cohort rule change.

## Scope boundary

The contact-lens and ophthalmic-product sources confirm a clean boundary:

```text
clinical refraction -> prescription -> product selection/fitting
```

Spectacle-to-contact-lens conversion, vertex compensation, toric rotation, contact-lens ADD ranges, progressive fitting measurements, material choice and commercial product selection are downstream modules. None may alter the v0.2 spectacle prediction.

## Safety position

Dioptra is a research prototype, not a diagnostic or autonomous prescribing system. Future confidence must describe evidence quality and model validation, not clinical certainty. The system must always show source measurements, flags and reasons; preserve the clinician's independent exam; and allow abstention when inputs are incomplete, inconsistent or outside the validated population.

See [the source register](source-register.md) for claim provenance and [the v0.3 notes](v0.3-design-notes.md) for proposed implementation.
