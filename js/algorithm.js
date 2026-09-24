(function () {
  const cfg = window.DIOPTRA_CONFIG;
  const EPS = 1e-9;

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

  function seDeviationStatus(delta) {
    const magnitude = Math.abs(Number(delta));
    if (!Number.isFinite(magnitude)) return "unknown";
    if (magnitude <= cfg.seGuardrail.maxAutomaticShift + EPS) return "normal";
    if (magnitude < cfg.seGuardrail.highDeviationThreshold - EPS) return "review";
    return "high";
  }

  function enforceSEBudget(arSph, arCyl, proposedSph, proposedCyl) {
    const arSE = sphericalEquivalent(arSph, arCyl);
    const proposedSE = sphericalEquivalent(proposedSph, proposedCyl);
    const proposedShift = proposedSE - arSE;
    const maxShift = cfg.seGuardrail.maxAutomaticShift;

    if (Math.abs(proposedShift) <= maxShift + EPS) {
      return {
        sphere: proposedSph,
        arSE,
        predictedSE: proposedSE,
        shift: proposedShift,
        applied: false,
        requestedShift: proposedShift,
        status: seDeviationStatus(proposedShift)
      };
    }

    const direction = Math.sign(proposedShift);
    const targetSE = arSE + direction * maxShift;
    const idealSphere = targetSE - proposedCyl / 2;
    const base = roundToStep(idealSphere, cfg.powerStep);
    const candidates = [
      base - 2 * cfg.powerStep,
      base - cfg.powerStep,
      base,
      base + cfg.powerStep,
      base + 2 * cfg.powerStep
    ];

    const allowed = candidates
      .map(sphere => {
        const se = sphericalEquivalent(sphere, proposedCyl);
        return { sphere, se, shift: se - arSE };
      })
      .filter(x => Math.abs(x.shift) <= maxShift + EPS)
      .sort((a, b) => {
        const aTarget = Math.abs(a.se - targetSE);
        const bTarget = Math.abs(b.se - targetSE);
        if (Math.abs(aTarget - bTarget) > EPS) return aTarget - bTarget;
        return Math.abs(a.sphere - proposedSph) - Math.abs(b.sphere - proposedSph);
      });

    const chosen = allowed[0] || {
      sphere: arSph,
      se: sphericalEquivalent(arSph, proposedCyl),
      shift: sphericalEquivalent(arSph, proposedCyl) - arSE
    };

    return {
      sphere: roundToStep(chosen.sphere, cfg.powerStep),
      arSE,
      predictedSE: chosen.se,
      shift: chosen.shift,
      applied: true,
      requestedShift: proposedShift,
      status: seDeviationStatus(chosen.shift)
    };
  }

  function predictEye({ sph, cyl, axis, va, pinhole }) {
    const arSph = Number(sph);
    const arCyl = Number(cyl);
    const arAxis = Number(axis);
    if (![arSph, arCyl, arAxis].every(Number.isFinite)) {
      throw new Error("Incomplete autorefractor data.");
    }

    const predCyl = roundToStep(arCyl, cfg.powerStep);
    const proposedSph = roundToStep(arSph + cfg.heuristics.sphereOffset, cfg.powerStep);
    const guard = enforceSEBudget(arSph, arCyl, proposedSph, predCyl);
    const predSph = guard.sphere;
    const predAxis = quantizeAxis(arAxis);

    return {
      sphere: predSph,
      cylinder: predCyl,
      axis: predAxis,
      sphericalEquivalent: sphericalEquivalent(predSph, predCyl),
      seShiftFromAR: sphericalEquivalent(predSph, predCyl) - sphericalEquivalent(arSph, arCyl),
      seGuardrail: {
        status: guard.status,
        applied: guard.applied,
        maxAutomaticShift: cfg.seGuardrail.maxAutomaticShift,
        requestedShift: guard.requestedShift
      },
      raw: {
        sphere: arSph,
        cylinder: arCyl,
        axis: arAxis,
        sphericalEquivalent: sphericalEquivalent(arSph, arCyl)
      },
      vectors: powerVector(predSph, predCyl, predAxis)
    };
  }

  function predictCase(input) {
    const od = predictEye(input.od);
    const os = predictEye(input.os);

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
    const predictedSE = sphericalEquivalent(pred.sphere, pred.cylinder);
    const actualSE = sphericalEquivalent(actual.sphere, actual.cylinder);
    const seError = actualSE - predictedSE;

    return {
      sphereError: roundToStep(actual.sphere - pred.sphere, cfg.powerStep),
      cylinderError: roundToStep(actual.cylinder - pred.cylinder, cfg.powerStep),
      axisError: axisDistance(pred.axis, actual.axis),
      predictedSE,
      actualSE,
      sphericalEquivalentError: seError,
      within025SE: Math.abs(seError) <= 0.25 + EPS,
      vectorError: {
        M: aVec.M - pVec.M,
        J0: aVec.J0 - pVec.J0,
        J45: aVec.J45 - pVec.J45
      },
      exact:
        actual.sphere === pred.sphere &&
        actual.cylinder === pred.cylinder &&
        axisDistance(actual.axis, pred.axis) === 0,
      within025Sphere: Math.abs(actual.sphere - pred.sphere) <= 0.25 + EPS,
      within025Cylinder: Math.abs(actual.cylinder - pred.cylinder) <= 0.25 + EPS,
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
    seDeviationStatus,
    predictCase,
    compareEye
  };
})();
