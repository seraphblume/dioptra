// Project Dioptra â€” v0.3 engine configuration.
//
// The v0.3 engine runs in SHADOW mode while Cohort B is open: it is computed and stored
// with every case, but the locked study prediction still comes from the frozen v0.2 path
// (js/config.js + js/algorithm.js, which this release does not modify).
//
// To promote v0.3 after Cohort B is closed and exported:
//   1. fit the stratified offsets with `node tools/fit-offsets.js <export.csv> --cohort-closed`,
//   2. paste the result into `sphereOffsets` / `offsetsProvenance` below,
//   3. set `mode: "active"` and `ui.finalAxisStep: 1`,
//   4. start a new cohort.
//
// Every threshold marked PROVISIONAL is an uncalibrated starting value. It produces a
// review flag only; it never changes a dioptric value.

window.DIOPTRA_V03_CONFIG = {
  version: "0.3.0",
  mode: "shadow", // "shadow" | "active"

  powerStep: 0.25,

  // Which centre of the autorefractor readings feeds the prediction.
  // All three are computed and stored with every case so they can be compared later.
  //   "selected" â€” the line the instrument marks as its result
  //   "median"   â€” component-wise median of the readings in power-vector space
  //   "mostPlus" â€” the reading with the most positive M (most plus / least minus)
  estimator: "median",

  vertex: {
    defaultMm: 12,   // assumed when the ticket's vertex distance is not entered
    targetMm: 12     // spectacle plane the prediction is expressed at
  },

  // Strata for the spherical offset: refractive state (from the raw AR M) x age band.
  refractiveBins: {
    emmetropiaUpperSE: 0.50,   // same cut-points as the v0.2 ADD table
    lowHyperopiaUpperSE: 2.00
  },
  ageBands: [
    { id: "under40", maxAge: 39 },
    { id: "40plus", maxAge: 200 }
  ],

  // Offset applied to M (spherical equivalent), in dioptres.
  // Every stratum starts at the v0.2 global value (-0.25 D) until fitted on closed-cohort data.
  sphereOffsets: {
    myopiaEmmetropia: { under40: -0.25, "40plus": -0.25 },
    lowHyperopia:     { under40: -0.25, "40plus": -0.25 },
    higherHyperopia:  { under40: -0.25, "40plus": -0.25 }
  },
  offsetsProvenance: {
    method: "prior",         // "prior" | "fitted"
    source: "v0.2 global offset",
    fittedOn: null,
    priorStrength: null,
    eyes: 0
  },

  // Hard cap on any automatic offset, and the combined shift (estimator + offset + rounding)
  // above which the case is flagged for review.
  maxOffset: 0.50,
  seReviewShift: 0.50,

  // Axis resolution follows the cylinder: fine steps where the axis matters optically.
  axis: {
    fineFromCylinder: 0.75, // |cyl| >= this uses fineStep
    fineStep: 1,
    coarseStep: 5
  },

  // Hypothesis switch, OFF by default: drop a small cylinder and move half of it into the sphere.
  lowCylinder: {
    dropAtOrBelow: null // e.g. 0.25 to test
  },

  add: {
    referenceWorkingDistanceCm: 40, // distance the age table implicitly assumes
    adjustForWorkingDistance: true,
    maxAdd: 3.50
  },

  // PROVISIONAL review thresholds.
  repeatability: {
    maxMRange: 0.50,          // D, range of M across readings
    maxJSpread: 0.25,         // D, max distance of a reading from the centre in the J0/J45 plane
    maxSelectedDistance: 0.25 // D, power-vector distance between the selected line and the median
  },
  keratometry: {
    javalAdjustment: 0.50,    // simplified Javal: -0.50 with-the-rule, +0.50 against-the-rule
    maxDisagreementCyl: 0.75  // D of cylinder-equivalent vector difference (PROVISIONAL)
  },

  ui: {
    finalAxisStep: 5 // keep 5Â° entry while Cohort B is open; set to 1 when v0.3 becomes active
  }
};
