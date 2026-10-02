// Project Dioptra â€” engine registry.
//
// Decides which engine produces the locked study prediction ("primary") and which runs
// alongside it ("shadow"). While DIOPTRA_V03_CONFIG.mode is "shadow", the frozen v0.2
// predictor stays primary and Cohort B remains comparable.
(function () {
  const v03cfg = window.DIOPTRA_V03_CONFIG;

  const ENGINES = {
    "v0.2": {
      id: "v0.2",
      label: "v0.2",
      version: () => window.DIOPTRA_CONFIG.version,
      predictCase: input => window.DioptraAlgorithm.predictCase(input)
    },
    "v0.3": {
      id: "v0.3",
      label: "v0.3",
      version: () => v03cfg.version,
      predictCase: input => window.DioptraEngineV03.predictCase(input)
    }
  };

  function primaryId() {
    return v03cfg.mode === "active" ? "v0.3" : "v0.2";
  }

  function shadowId() {
    return primaryId() === "v0.3" ? "v0.2" : "v0.3";
  }

  // The primary engine must succeed; a shadow failure is recorded and never blocks the case.
  function run(input) {
    const primary = ENGINES[primaryId()];
    const shadow = ENGINES[shadowId()];
    const primaryPrediction = primary.predictCase(input);
    let shadowPrediction = null;
    let shadowError = null;
    try {
      shadowPrediction = shadow.predictCase(input);
    } catch (err) {
      shadowError = err.message;
    }
    return {
      primary: { id: primary.id, prediction: primaryPrediction },
      shadow: { id: shadow.id, prediction: shadowPrediction, error: shadowError }
    };
  }

  window.DioptraEngines = { ENGINES, primaryId, shadowId, run };
})();
