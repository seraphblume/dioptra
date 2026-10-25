// Experimental RC: fitted on development outcomes, NOT clinically validated.
// See docs/v0.4-rc.md for derivation, sparse-group policy and release boundaries.
(function () {
  const baseline = JSON.parse(JSON.stringify(window.DIOPTRA_V03_CONFIG));
  const globalMean = -47.875 / 106;
  const shrunk = (sum, n) => (sum + 8 * globalMean) / (n + 8);
  const bounded = x => Math.max(-0.50, Math.min(0.50, Math.round(x * 100) / 100));
  window.DIOPTRA_V04_CONFIG = {
    ...baseline,
    engine: "v0.4",
    version: "0.4.0-rc.1",
    mode: "active",
    cohort: "v0.4-rc1-prospective",
    ageBands: [{ id: "under18", maxAge: 18, exclusive: true }, { id: "under40", maxAge: 40, exclusive: true }, { id: "40plus", maxAge: 200 }],
    sphereOffsets: {
      myopiaEmmetropia: { under18: -0.25, under40: bounded(shrunk(-38.5, 74)), "40plus": bounded(shrunk(-7.75, 30)) },
      lowHyperopia: { under18: -0.25, under40: -0.25, "40plus": -0.25 },
      higherHyperopia: { under18: -0.25, under40: -0.25, "40plus": -0.25 }
    },
    offsetsProvenance: {
      method: "experimental-partial-fit",
      source: "53-case v0.3 development analysis; aggregate final M minus AR centre M",
      fittedOn: "2026-10-23",
      priorStrength: 8,
      cases: 53,
      eyes: 106,
      globalMean,
      fittedGroups: {
        // The under-40 development pool includes children. Application is restricted
        // to adults as a conservative policy, NOT an independently validated adult fit.
        under40: { eyes: 74, residualSum: -38.5, uncappedOffset: shrunk(-38.5, 74) },
        "40plus": { eyes: 30, residualSum: -7.75, uncappedOffset: shrunk(-7.75, 30) }
      },
      validation: "development-only; prospective RC evaluation required",
      policy: "Under-18 and sparse hyperopic strata retain -0.25 D prior. No cases removed."
    }
  };
})();
