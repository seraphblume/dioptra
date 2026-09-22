(function () {
  const cfg = window.DIOPTRA_CONFIG;

  function roundToStep(value, step) {
    return Math.round((value + Number.EPSILON) / step) * step;
  }

  function normalizeAxis(axis) {
    let a = Number(axis);
    if (!Number.isFinite(a)) return null;
    while (a <= 0) a += 180;
    while (a > 180) a -= 180;
    return a;
  }

  function quantizeAxis(axis, step = cfg.axisStep) {
    const a = normalizeAxis(axis);
    if (a == null) return null;
    let q = Math.round(a / step) * step;
    if (q === 0) q = 180;
    if (q > 180) q -= 180;
    return q;
  }

  function axisDistance(a1, a2) {
    const x = normalizeAxis(a1);
    const y = normalizeAxis(a2);
    if (x == null || y == null) return null;
    const d = Math.abs(x - y);
    return Math.min(d, 180 - d);
  }

  function sphericalEquivalent(sph, cyl) {
    return Number(sph) + Number(cyl) / 2;
  }

  function powerVector(sph, cyl, axis) {
    const S = Number(sph), C = Number(cyl), A = normalizeAxis(axis);
    if (![S, C, A].every(Number.isFinite)) return null;
    const radians = 2 * A * Math.PI / 180;
    return {
      M: S + C / 2,
      J0: (-C / 2) * Math.cos(radians),
      J45: (-C / 2) * Math.sin(radians)
    };
  }

  function vaDecimal(snellen) {
    const row = cfg.visualAcuity.find(v => v.snellen === snellen);
    return row ? row.decimal : null;
  }

  function classifyRefractiveState(sph, cyl) {
    const se = sphericalEquivalent(sph, cyl);
    if (se <= cfg.refractiveBins.emmetropiaUpperSE) return "myopiaEmmetropia";
    if (se <= cfg.refractiveBins.lowHyperopiaUpperSE) return "lowHyperopia";
    return "higherHyperopia";
  }

  function tentativeAdd(age, sph, cyl) {
    const nAge = Number(age);
    if (!Number.isFinite(nAge) || nAge < 33) return 0;
    const row = cfg.tentativeAdd.find(r => nAge >= r.minAge && nAge <= r.maxAge);
    if (!row) return 0;
    const cls = classifyRefractiveState(sph, cyl);
    return row[cls] ?? 0;
  }

  function predictEye({ sph, cyl, axis, va, pinhole }) {
    const arSph = Number(sph);
    const arCyl = Number(cyl);
    const arAxis = Number(axis);
    if (![arSph, arCyl, arAxis].every(Number.isFinite)) {
      throw new Error("Incomplete autorefractor data.");
    }

    let predCyl = arCyl;
    if (cfg.heuristics.cylinderRelaxation > 0 && arCyl < 0) {
      predCyl = Math.min(0, arCyl + cfg.heuristics.cylinderRelaxation);
    }
    predCyl = roundToStep(predCyl, cfg.powerStep);

    const vaBase = vaDecimal(va);
    const vaPh = vaDecimal(pinhole);
    const improvement =
      (vaBase != null && vaPh != null) ? (vaPh - vaBase) : null;

    let predSph = arSph;
    const allowSphereRelaxation =
      (improvement != null && improvement >= cfg.heuristics.pinholeImprovementThreshold) ||
      (vaBase != null && vaBase >= cfg.heuristics.goodBaselineVaThreshold);

    if (allowSphereRelaxation && cfg.heuristics.sphereRelaxation > 0) {
      predSph = arSph + cfg.heuristics.sphereRelaxation;
    }
    predSph = roundToStep(predSph, cfg.powerStep);

    const predAxis = cfg.heuristics.preserveAxis
      ? quantizeAxis(arAxis)
      : quantizeAxis(arAxis);

    return {
      sphere: predSph,
      cylinder: predCyl,
      axis: predAxis,
      raw: {
        sphere: arSph,
        cylinder: arCyl,
        axis: arAxis,
        va: vaBase,
        pinhole: vaPh,
        pinholeImprovement: improvement
      },
      vectors: powerVector(predSph, predCyl, predAxis)
    };
  }

  function predictCase(input) {
    const od = predictEye({
      sph: input.od.sphere, cyl: input.od.cylinder, axis: input.od.axis,
      va: input.od.va, pinhole: input.od.pinhole
    });
    const os = predictEye({
      sph: input.os.sphere, cyl: input.os.cylinder, axis: input.os.axis,
      va: input.os.va, pinhole: input.os.pinhole
    });

    const addOD = tentativeAdd(input.age, od.sphere, od.cylinder);
    const addOS = tentativeAdd(input.age, os.sphere, os.cylinder);
    const add = Math.max(addOD, addOS);

    return {
      version: cfg.version,
      lockedAt: new Date().toISOString(),
      od,
      os,
      tentativeAdd: roundToStep(add, cfg.powerStep)
    };
  }

  function compareEye(pred, actual) {
    const pVec = powerVector(pred.sphere, pred.cylinder, pred.axis);
    const aVec = powerVector(actual.sphere, actual.cylinder, actual.axis);

    return {
      sphereError: roundToStep(actual.sphere - pred.sphere, cfg.powerStep),
      cylinderError: roundToStep(actual.cylinder - pred.cylinder, cfg.powerStep),
      axisError: axisDistance(pred.axis, actual.axis),
      sphericalEquivalentError:
        sphericalEquivalent(actual.sphere, actual.cylinder) -
        sphericalEquivalent(pred.sphere, pred.cylinder),
      vectorError: {
        M: aVec.M - pVec.M,
        J0: aVec.J0 - pVec.J0,
        J45: aVec.J45 - pVec.J45
      },
      exact:
        actual.sphere === pred.sphere &&
        actual.cylinder === pred.cylinder &&
        axisDistance(actual.axis, pred.axis) === 0,
      within025Sphere: Math.abs(actual.sphere - pred.sphere) <= 0.25,
      within025Cylinder: Math.abs(actual.cylinder - pred.cylinder) <= 0.25,
      within5Axis: axisDistance(actual.axis, pred.axis) <= 5
    };
  }

  window.DioptraAlgorithm = {
    roundToStep,
    normalizeAxis,
    quantizeAxis,
    axisDistance,
    sphericalEquivalent,
    powerVector,
    classifyRefractiveState,
    tentativeAdd,
    predictCase,
    compareEye
  };
})();
