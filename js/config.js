// Project Dioptra configuration.
// Keep v0 transparent and auditable. Change heuristics here, not inside app.js.

window.DIOPTRA_CONFIG = {
  version: "0.1.0",
  axisStep: 5,
  powerStep: 0.25,

  // Visual acuity conversion from the Devlyn reference card.
  visualAcuity: [
    { snellen: "20/400", decimal: 0.05 },
    { snellen: "20/300", decimal: 0.07 },
    { snellen: "20/200", decimal: 0.10 },
    { snellen: "20/100", decimal: 0.20 },
    { snellen: "20/80",  decimal: 0.25 },
    { snellen: "20/70",  decimal: 0.29 },
    { snellen: "20/60",  decimal: 0.33 },
    { snellen: "20/50",  decimal: 0.40 },
    { snellen: "20/40",  decimal: 0.50 },
    { snellen: "20/30",  decimal: 0.67 },
    { snellen: "20/25",  decimal: 0.80 },
    { snellen: "20/20",  decimal: 1.00 },
    { snellen: "20/15",  decimal: 1.33 },
    { snellen: "20/10",  decimal: 2.00 }
  ],

  // Tentative ADD table captured from the Devlyn reference card.
  // "higherHyperopia" intentionally avoids claiming that +2.25 D is universally "high hyperopia."
  tentativeAdd: [
    { minAge: 33, maxAge: 37, myopiaEmmetropia: 0.00, lowHyperopia: 0.00, higherHyperopia: 0.75 },
    { minAge: 38, maxAge: 43, myopiaEmmetropia: 0.00, lowHyperopia: 0.75, higherHyperopia: 1.25 },
    { minAge: 44, maxAge: 49, myopiaEmmetropia: 0.75, lowHyperopia: 1.25, higherHyperopia: 1.75 },
    { minAge: 50, maxAge: 56, myopiaEmmetropia: 1.25, lowHyperopia: 1.75, higherHyperopia: 2.25 },
    { minAge: 57, maxAge: 62, myopiaEmmetropia: 1.75, lowHyperopia: 2.25, higherHyperopia: 2.50 },
    { minAge: 63, maxAge: 120, myopiaEmmetropia: 2.25, lowHyperopia: 2.50, higherHyperopia: 2.50 }
  ],

  // Refractive-state bins for the tentative ADD lookup.
  // This is an implementation choice for the study, not a universal clinical definition.
  refractiveBins: {
    lowHyperopiaUpperSE: 2.00,
    emmetropiaUpperSE: 0.50
  },

  // v0 deterministic heuristics.
  // These are intentionally modest and should be validated against the clinician dataset.
  heuristics: {
    // Autorefractors commonly provide a useful axis estimate; final axis is quantized to 5°.
    preserveAxis: true,

    // Conservative initial cylinder relaxation used only for blinded prediction.
    // Set to 0.00 to disable. Negative-cylinder notation expected.
    cylinderRelaxation: 0.25,

    // Sphere relaxation is applied only when pre-refraction evidence suggests the AR may be over-minus.
    // v0 uses a simple VA/pinhole rule; future versions should be learned from collected cases.
    sphereRelaxation: 0.25,

    // If pinhole VA improves by at least this decimal amount, allow sphere relaxation.
    pinholeImprovementThreshold: 0.20,

    // If baseline VA is already at least this good, also allow sphere relaxation.
    goodBaselineVaThreshold: 0.80
  }
};
