(function () {
  const cfg = window.DIOPTRA_V04_CONFIG;
  const engine = window.DioptraEngineFactory(cfg);
  function predictCase(input) {
    const p = engine.predictCase(input);
    p.flags.unshift({ code: "EXPERIMENTAL_RC", level: "review", message: "Unvalidated experimental RC. Compare with an independently completed exam; do not prescribe from this result alone." });
    if (Number(input.age) < 18) p.flags.push({ code: "PEDIATRIC_PRIOR", level: "review", message: "Under 18: fitted offsets are not applied; the prior is retained. This is not pediatric validation." });
    if ([p.od, p.os].some(e => e.stratum.refractiveState !== "myopiaEmmetropia")) {
      p.flags.push({ code: "SPARSE_CALIBRATION", level: "review", message: "Hyperopic calibration data are sparse; original prior offsets are retained." });
    }
    p.status = "review";
    p.calibration = JSON.parse(JSON.stringify(cfg.offsetsProvenance));
    return p;
  }
  window.DioptraEngineV04 = { ...engine, predictCase };
})();
