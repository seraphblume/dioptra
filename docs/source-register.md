# Clinical source register

## Purpose

This register records which supplied Devlyn training notes informed the Dioptra documentation, what was taken from each, and what was deliberately kept outside the spectacle-Rx predictor. It is a provenance record, not an endorsement or independent validation of every statement in the training material.

The source notes are not copied into this repository. Titles and source metadata below identify the user-supplied material reviewed on 2026-10-01. The referenced conversation exposed ten attachment bodies for direct review; no claim was imported from an attachment body that was not available in this execution.

## Core refraction sources

| Source note | Source metadata recorded in the note | Dioptra use |
|---|---|---|
| `Eye_Exam_Protocol.md` | Arturo Torres Hernández, *Guía Práctica Para Realizar Un Examen De La Vista*, Devlyn instructor guide, 14th ed. (2015); Devlyn laminated sheets and forms | Defines exam stages; history and habitual-correction context; corrected/uncorrected distance and near VA; pinhole as a plausibility/triage observation; preliminary health/binocular tests as flags; ambulatory verification; separation of clinical findings from product selection. |
| `Objective_Refraction.md` | Same Devlyn guide, sections XIII–XVI and retinoscopy appendix | Supports storing lensometry/habitual Rx, autorefractor, keratometry and retinoscopy as distinct objective observations. The autorefractor and retinoscopy are starting points, not final prescriptions. |
| `Subjective_Refraction.md` | Same Devlyn guide, sections XVII–XXIII; Devlyn cards; dominant-eye appendix | Supports a distinct subjective endpoint; cylinder/sphere refinement provenance; the most-plus/least-minus principle; binocular-balance fields; refined ADD inputs; and explicit recording when the dispensed Rx differs from the subjective endpoint for adaptation or another clinical reason. |

## Downstream and boundary sources

These sources help define what occurs **after** a spectacle refractive endpoint. They are not evidence for modifying v0.2 sphere, cylinder, axis or ADD.

| Source note | Relevant boundary lesson | Excluded from core predictor |
|---|---|---|
| `Spherical_CL_Fitting.md` | Spectacle-to-contact-lens conversion and on-eye fit are separate steps. | Spherical-equivalent conversion, vertex conversion and fit assessment are not spectacle-Rx rules. |
| `Toric_CL_Fitting.md` | Toric selection, trial-lens assessment and rotation compensation occur after refraction. | LARS/CAAS and product availability do not alter the spectacle endpoint. |
| `Toric_Trial_Lens_Tables.md` | Tables are product- and version-specific lookup aids. | No table value enters Dioptra's spectacle predictor. |
| `Multifocal_CL_Fitting.md` | Contact-lens ADD ranges and over-refraction are a separate fitting workflow. | LO/MED/HI mapping, the +0.25 initial-lens step and brand-specific troubleshooting are excluded. |
| `Contact_Lens_Fundamentals.md` | Lens material, wear, replacement, design and geometry describe a separate module. | Product/material properties are excluded. |
| `Alcon_CL_Catalog.md` | Product parameters and ranges are time- and market-specific. | Catalog data and marketing claims are excluded. |
| `Ophthalmic_Lens_Portfolio.md` | Lens design, treatment and product recommendation occur after clinical refraction. | Commercial product selection and claims are excluded. |

## Traceability rules

1. A training statement may justify **collecting** a field without justifying its use as a prediction feature.
2. Abnormal preliminary findings produce a flag or a request for clinician review; they do not directly add or subtract dioptres.
3. Numeric thresholds not stated in the sources are marked as hypotheses and must be estimated and validated prospectively.
4. Product-fitting rules remain in downstream modules and may not be imported into the spectacle-Rx model.
5. The notes contain internal cautions and inconsistencies (for example, a retinoscopy appendix cylinder convention and product-table revisions). Dioptra must preserve the original observation and provenance rather than silently choosing a correction.

## Design hypotheses, not source claims

The following concepts are proposals derived from the documented workflow and optical representation. They are not claims made by the Devlyn sources:

- combining objective measurements in power-vector space (`M`, `J0`, `J45`);
- estimating a robust center and dispersion from repeated autorefractor readings;
- converting cross-source disagreement into a calibrated confidence value;
- choosing any threshold for low confidence, disagreement, out-of-distribution detection or abstention;
- learning a separate prescribing/adaptation layer after the subjective endpoint.

These items belong to v0.3 research and must not be back-ported into Cohort B.
