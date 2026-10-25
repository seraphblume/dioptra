// Project Dioptra — v0.3 engine.
//
// Pipeline per eye:
//   raw readings -> minus-cylinder form -> vertex normalisation (per principal meridian)
//   -> power vectors (M, J0, J45) -> robust centre + repeatability evidence
//   -> stratified M offset -> optional low-cylinder rule -> back to S/C/A
//   -> SE-preserving rounding -> cylinder-dependent axis resolution -> flags
//
// The engine reads the frozen v0.2 ADD table from js/config.js but never modifies it.
(function () {
  const cfg = window.DIOPTRA_V03_CONFIG;
  const baseCfg = window.DIOPTRA_CONFIG;
  const EPS = 1e-9;

  // ---------------------------------------------------------------- helpers

  function num(x) {
    if (x === null || x === undefined || x === "") return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  function clean(x) {
    return Math.abs(x) < EPS ? 0 : x;
  }

  function roundToStep(value, step) {
    // Ties go toward +infinity: more plus sphere, less minus cylinder.
    return clean(Math.round((value + Number.EPSILON) / step) * step);
  }

  function normalizeAxis(axis) {
    let a = Number(axis);
    if (!Number.isFinite(a)) return null;
    a = ((a % 180) + 180) % 180;
    return a === 0 ? 180 : a;
  }

  function roundAxis(axis, step) {
    const a = normalizeAxis(axis);
    if (a == null) return null;
    return normalizeAxis(Math.round(a / step) * step);
  }

  function axisDistance(a1, a2) {
    const x = normalizeAxis(a1);
    const y = normalizeAxis(a2);
    if (x == null || y == null) return null;
    const d = Math.abs(x - y);
    return Math.min(d, 180 - d);
  }

  function median(values) {
    const v = values.slice().sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  function toMinusCylinder(rx) {
    if (rx.cylinder > 0) {
      return { sphere: rx.sphere + rx.cylinder, cylinder: -rx.cylinder, axis: normalizeAxis(rx.axis + 90) };
    }
    return { sphere: rx.sphere, cylinder: rx.cylinder, axis: normalizeAxis(rx.axis) };
  }

  function sphericalEquivalent(sph, cyl) {
    return sph + cyl / 2;
  }

  function powerVector(rx) {
    const r = (2 * rx.axis * Math.PI) / 180;
    return {
      M: rx.sphere + rx.cylinder / 2,
      J0: (-rx.cylinder / 2) * Math.cos(r),
      J45: (-rx.cylinder / 2) * Math.sin(r)
    };
  }

  function fromPowerVector(v) {
    const cylinder = -2 * Math.hypot(v.J0, v.J45);
    let axis = (Math.atan2(v.J45, v.J0) * 90) / Math.PI;
    if (axis <= 0) axis += 180;
    return { sphere: v.M - cylinder / 2, cylinder, axis: normalizeAxis(axis) };
  }

  function vectorDistance(a, b) {
    return Math.hypot(a.M - b.M, a.J0 - b.J0, a.J45 - b.J45);
  }

  function astigmaticDistance(a, b) {
    // Difference between two astigmatic components, expressed as dioptres of cylinder.
    return 2 * Math.hypot(a.J0 - b.J0, a.J45 - b.J45);
  }

  // ---------------------------------------------------------------- optics

  // Effective power of a lens moved from one vertex distance to another (mm from the cornea).
  function effectivePower(power, fromMm, toMm) {
    const d = (fromMm - toMm) / 1000; // positive when the lens moves toward the eye
    return power / (1 - d * power);
  }

  // Convert each principal meridian separately (optical cross), then rebuild S/C/A.
  function convertVertex(rx, fromMm, toMm) {
    if (fromMm == null || toMm == null || Math.abs(fromMm - toMm) < EPS) return { ...rx };
    const axisMeridian = effectivePower(rx.sphere, fromMm, toMm);
    const perpendicular = effectivePower(rx.sphere + rx.cylinder, fromMm, toMm);
    return { sphere: axisMeridian, cylinder: perpendicular - axisMeridian, axis: rx.axis };
  }

  // Astigmatism orientation from the minus-cylinder axis.
  function astigmatismOrientation(cylinder, axis) {
    if (Math.abs(cylinder) < 0.25 - EPS || axis == null) return "none";
    const a = normalizeAxis(axis);
    if (a <= 30 || a >= 150) return "withTheRule";
    if (a >= 60 && a <= 120) return "againstTheRule";
    return "oblique";
  }

  // Ametropia label for a minus-cylinder prescription.
  function classifyAmetropia(sphere, cylinder) {
    const s = clean(sphere);
    const c = Math.abs(clean(cylinder));
    if (c < EPS) {
      if (s < 0) return "myopia";
      if (s > 0) return "hyperopia";
      return "emmetropia";
    }
    if (Math.abs(s) < EPS) return "simpleMyopicAstigmatism";
    if (s < 0) return "compoundMyopicAstigmatism";
    if (Math.abs(s - c) < EPS) return "simpleHyperopicAstigmatism";
    if (s > c) return "compoundHyperopicAstigmatism";
    return "mixedAstigmatism";
  }

  function classifyRefractiveState(m) {
    if (m <= cfg.refractiveBins.emmetropiaUpperSE + EPS) return "myopiaEmmetropia";
    if (m <= cfg.refractiveBins.lowHyperopiaUpperSE + EPS) return "lowHyperopia";
    return "higherHyperopia";
  }

  function ageBand(age) {
    const a = num(age);
    if (a == null) return null;
    const band = cfg.ageBands.find(b => a <= b.maxAge);
    return band ? band.id : cfg.ageBands[cfg.ageBands.length - 1].id;
  }

  // Simplified Javal: total astigmatism = corneal astigmatism + 0.50 D against-the-rule residual.
  // In vector form this reproduces "-0.50 with the rule, +0.50 against the rule".
  function javalEstimate(k) {
    if (!k) return null;
    const k1 = num(k.k1D), a1 = num(k.k1Axis), k2 = num(k.k2D), a2 = num(k.k2Axis);
    if ([k1, a1, k2, a2].some(v => v == null)) return null;
    const steep = k1 >= k2 ? { d: k1, axis: a1 } : { d: k2, axis: a2 };
    const flat = k1 >= k2 ? { d: k2, axis: a2 } : { d: k1, axis: a1 };
    const cornealCyl = steep.d - flat.d;
    const corneal = powerVector({ sphere: 0, cylinder: -cornealCyl, axis: normalizeAxis(flat.axis) });
    const residual = powerVector({ sphere: 0, cylinder: -cfg.keratometry.javalAdjustment, axis: 90 });
    const total = { M: 0, J0: corneal.J0 + residual.J0, J45: corneal.J45 + residual.J45 };
    const rx = fromPowerVector(total);
    return {
      cornealCylinder: cornealCyl,
      steepMeridian: normalizeAxis(steep.axis),
      cornealOrientation: astigmatismOrientation(-cornealCyl, normalizeAxis(flat.axis)),
      predictedCylinder: rx.cylinder,
      predictedAxis: rx.axis,
      vector: total
    };
  }

  function vaDecimal(snellen) {
    if (!snellen || !baseCfg || !baseCfg.visualAcuity) return null;
    const row = baseCfg.visualAcuity.find(v => v.snellen === snellen);
    return row ? row.decimal : null;
  }

  function flag(code, level, message) {
    return { code, level, message };
  }

  // ---------------------------------------------------------------- readings

  function readRx(r) {
    if (!r) return null;
    const sphere = num(r.sphere), cylinder = num(r.cylinder), axis = num(r.axis);
    if (sphere == null || cylinder == null || axis == null) return null;
    if (axis < 0 || axis > 180) return null;
    return toMinusCylinder({ sphere, cylinder, axis: axis === 0 ? 180 : axis });
  }

  function summarizeEvidence(eyeInput, vertexMm) {
    const target = cfg.vertex.targetMm;
    const selectedRaw = readRx(eyeInput);
    const repeatRaw = (eyeInput.readings || []).map(readRx).filter(Boolean);
    const selected = selectedRaw ? convertVertex(selectedRaw, vertexMm, target) : null;
    const repeats = repeatRaw.map(r => convertVertex(r, vertexMm, target));
    const pool = repeats.length ? repeats : selected ? [selected] : [];
    const vectors = pool.map(powerVector);

    if (!vectors.length) return { selectedRaw: null, count: 0 };

    const centre = {
      M: median(vectors.map(v => v.M)),
      J0: median(vectors.map(v => v.J0)),
      J45: median(vectors.map(v => v.J45))
    };
    const ms = vectors.map(v => v.M);
    const mostPlus = vectors
      .map((v, i) => ({ v, i }))
      .sort((a, b) => (b.v.M - a.v.M) || (astigmaticDistance(a.v, centre) - astigmaticDistance(b.v, centre)))[0].v;

    const selectedVector = selected ? powerVector(selected) : null;
    return {
      selectedRaw,
      selectedVector,
      repeatCount: repeats.length,
      count: vectors.length,
      centre,
      mostPlus,
      mRange: vectors.length > 1 ? Math.max(...ms) - Math.min(...ms) : null,
      jSpread: vectors.length > 1 ? Math.max(...vectors.map(v => Math.hypot(v.J0 - centre.J0, v.J45 - centre.J45))) : null,
      selectedDistance: selectedVector && repeats.length ? vectorDistance(selectedVector, centre) : null,
      reliability: (eyeInput.readings || []).map(r => (r ? num(r.reliability) : null)).filter(v => v != null)
    };
  }

  // ---------------------------------------------------------------- prediction

  function predictFromBase(base, age) {
    const step = cfg.powerStep;
    const state = classifyRefractiveState(base.M);
    const band = ageBand(age);
    const requestedOffset = cfg.sphereOffsets[state][band];
    const offset = Math.max(-cfg.maxOffset, Math.min(cfg.maxOffset, requestedOffset));

    const v = { M: base.M + offset, J0: base.J0, J45: base.J45 };
    const baseCylinder = 2 * Math.hypot(base.J0, base.J45);
    const drop = cfg.lowCylinder.dropAtOrBelow;
    const lowCylinderDropped = drop != null && baseCylinder > EPS && baseCylinder <= drop + EPS;
    if (lowCylinderDropped) {
      v.J0 = 0;
      v.J45 = 0;
    }

    const exact = fromPowerVector(v);
    const cylinder = roundToStep(exact.cylinder, step);
    const sphere = roundToStep(v.M - cylinder / 2, step); // SE-preserving: sphere absorbs cylinder rounding
    const fine = Math.abs(cylinder) >= cfg.axis.fineFromCylinder - EPS;
    const axis = cylinder === 0 ? 180 : roundAxis(exact.axis, fine ? cfg.axis.fineStep : cfg.axis.coarseStep);

    return {
      sphere,
      cylinder,
      axis,
      sphericalEquivalent: sphericalEquivalent(sphere, cylinder),
      stratum: { refractiveState: state, ageBand: band, offset, requestedOffset, offsetClamped: offset !== requestedOffset },
      lowCylinderDropped,
      axisStep: cylinder === 0 ? null : fine ? cfg.axis.fineStep : cfg.axis.coarseStep
    };
  }

  function predictEye(eyeInput, ctx) {
    const evidence = summarizeEvidence(eyeInput || {}, ctx.vertexMm);
    if (!evidence.selectedRaw) {
      throw new Error("Incomplete autorefractor data: the selected reading is required for both eyes.");
    }

    const bases = {
      selected: evidence.selectedVector,
      median: evidence.centre,
      mostPlus: evidence.mostPlus
    };
    const candidates = {};
    for (const [name, base] of Object.entries(bases)) {
      const p = predictFromBase(base, ctx.age);
      candidates[name] = { sphere: p.sphere, cylinder: p.cylinder, axis: p.axis, sphericalEquivalent: p.sphericalEquivalent };
    }

    const estimator = bases[cfg.estimator] ? cfg.estimator : "median";
    const base = bases[estimator];
    const p = predictFromBase(base, ctx.age);

    const raw = evidence.selectedRaw;
    const rawSE = sphericalEquivalent(raw.sphere, raw.cylinder);
    const shift = p.sphericalEquivalent - rawSE;
    const flags = [];

    if (ctx.vertexConverted) {
      flags.push(flag("VERTEX_CONVERTED", "info", `Readings converted from ${ctx.vertexMm} mm to ${cfg.vertex.targetMm} mm vertex distance.`));
    }
    if (evidence.repeatCount === 0) {
      flags.push(flag("AR_REPEATS_MISSING", "info", "Only the selected line was entered; repeatability is unknown."));
    }
    if (evidence.mRange != null && evidence.mRange > cfg.repeatability.maxMRange + EPS) {
      flags.push(flag("AR_REPEATABILITY_LOW", "review", `Readings vary by ${evidence.mRange.toFixed(2)} D in spherical equivalent.`));
    }
    if (evidence.jSpread != null && evidence.jSpread > cfg.repeatability.maxJSpread + EPS) {
      flags.push(flag("AR_ASTIGMATISM_UNSTABLE", "review", "Cylinder or axis varies across readings."));
    }
    if (evidence.selectedDistance != null && evidence.selectedDistance > cfg.repeatability.maxSelectedDistance + EPS) {
      flags.push(flag("AR_SELECTED_OUTSIDE_CLUSTER", "review", "The instrument's selected line sits away from the centre of the readings."));
    }
    if (p.stratum.offsetClamped) {
      flags.push(flag("OFFSET_CLAMPED", "review", `Configured offset ${p.stratum.requestedOffset} D exceeds the ${cfg.maxOffset} D cap.`));
    }
    if (Math.abs(shift) > cfg.seReviewShift + EPS) {
      flags.push(flag("SE_SHIFT_REVIEW", "review", `Prediction moves the spherical equivalent ${shift.toFixed(2)} D from the selected reading.`));
    }
    if (p.lowCylinderDropped) {
      flags.push(flag("LOW_CYLINDER_DROPPED", "info", "Small cylinder removed; half moved into the sphere."));
    }

    const orientation = astigmatismOrientation(p.cylinder, p.axis);
    if (orientation === "oblique" && Math.abs(p.cylinder) >= cfg.axis.fineFromCylinder - EPS) {
      flags.push(flag("OBLIQUE_ASTIGMATISM", "info", "Oblique axis: check axis carefully."));
    }

    const javal = javalEstimate(eyeInput.keratometry);
    let keratometryDisagreement = null;
    if (javal) {
      keratometryDisagreement = astigmaticDistance(base, javal.vector);
      if (keratometryDisagreement > cfg.keratometry.maxDisagreementCyl + EPS) {
        flags.push(flag("KERATOMETRY_DISAGREEMENT", "review",
          `Autorefractor cylinder differs from the keratometry estimate by ${keratometryDisagreement.toFixed(2)} D.`));
      }
    }

    const va = vaDecimal(eyeInput.va);
    const ph = vaDecimal(eyeInput.pinhole);
    if (va != null && ph != null && va < 0.67 - EPS && ph <= va + EPS) {
      flags.push(flag("PINHOLE_LIMITED_GAIN", "review", "Reduced VA without pinhole improvement: refraction alone may not explain it."));
    }

    const status = Math.abs(shift) <= cfg.seReviewShift + EPS ? "normal" : Math.abs(shift) < 0.75 - EPS ? "review" : "high";

    return {
      sphere: p.sphere,
      cylinder: p.cylinder,
      axis: p.axis,
      sphericalEquivalent: p.sphericalEquivalent,
      seShiftFromAR: shift,
      seGuardrail: {
        status,
        applied: p.stratum.offsetClamped,
        maxAutomaticShift: cfg.maxOffset,
        requestedShift: p.stratum.requestedOffset
      },
      raw: { sphere: raw.sphere, cylinder: raw.cylinder, axis: raw.axis, sphericalEquivalent: rawSE },
      vectors: powerVector({ sphere: p.sphere, cylinder: p.cylinder, axis: p.axis }),
      estimator,
      candidates,
      stratum: p.stratum,
      axisStep: p.axisStep,
      ametropia: classifyAmetropia(p.sphere, p.cylinder),
      astigmatism: orientation,
      evidence: {
        readings: evidence.count,
        repeatCount: evidence.repeatCount,
        centre: evidence.centre,
        mRange: evidence.mRange,
        jSpread: evidence.jSpread,
        selectedDistance: evidence.selectedDistance,
        reliability: evidence.reliability,
        vertexMm: ctx.vertexMm
      },
      keratometry: javal ? { ...javal, disagreement: keratometryDisagreement } : null,
      flags
    };
  }

  function tableAdd(age, state) {
    const a = num(age);
    if (a == null || a < 33) return 0;
    const row = baseCfg.tentativeAdd.find(r => a >= r.minAge && a <= r.maxAge);
    return row ? row[state] ?? 0 : 0;
  }

  function predictAdd(age, odState, osState, near) {
    const ageTable = Math.max(tableAdd(age, odState), tableAdd(age, osState));
    const wd = near ? num(near.workingDistanceCm) : null;
    const nearPoint = near ? num(near.nearPointCm) : null;
    const reference = cfg.add.referenceWorkingDistanceCm;

    let workingDistanceAdjustment = 0;
    if (ageTable > 0 && cfg.add.adjustForWorkingDistance && wd != null && wd > 0) {
      workingDistanceAdjustment = 100 / wd - 100 / reference;
    }
    const add = Math.max(0, Math.min(cfg.add.maxAdd, roundToStep(ageTable + workingDistanceAdjustment, cfg.powerStep)));

    // Second estimate, reported only: keep half the measured amplitude in reserve.
    let amplitude = null;
    let amplitudeAdd = null;
    if (nearPoint != null && nearPoint > 0) {
      amplitude = 100 / nearPoint;
      const demand = 100 / (wd && wd > 0 ? wd : reference);
      amplitudeAdd = Math.max(0, Math.min(cfg.add.maxAdd, roundToStep(demand - amplitude / 2, cfg.powerStep)));
    }

    return {
      tentativeAdd: add,
      estimates: { ageTable, workingDistanceAdjustment, amplitudeD: amplitude, amplitudeBased: amplitudeAdd },
      workingDistanceCm: wd
    };
  }

  function predictCase(input) {
    const vertexIn = input.instrument ? num(input.instrument.vertexMm) : null;
    const vertexMm = vertexIn != null ? vertexIn : cfg.vertex.defaultMm;
    const ctx = {
      age: input.age,
      vertexMm,
      vertexConverted: Math.abs(vertexMm - cfg.vertex.targetMm) > EPS
    };

    const od = predictEye(input.od, ctx);
    const os = predictEye(input.os, ctx);

    const add = predictAdd(input.age, od.stratum.refractiveState, os.stratum.refractiveState, input.near);

    const caseFlags = [];
    if (vertexIn == null) {
      caseFlags.push(flag("VERTEX_ASSUMED", "info", `Vertex distance not entered; assumed ${cfg.vertex.defaultMm} mm.`));
    }
    const all = [...caseFlags, ...od.flags, ...os.flags];
    const status = all.some(f => f.level === "abstain")
      ? "insufficient_evidence"
      : all.some(f => f.level === "review") ? "review" : "supported";

    return {
      engine: "v0.3",
      version: cfg.version,
      mode: cfg.mode,
      lockedAt: new Date().toISOString(),
      od,
      os,
      tentativeAdd: add.tentativeAdd,
      add,
      flags: caseFlags,
      status,
      config: {
        estimator: cfg.estimator,
        offsets: cfg.offsetsProvenance.method,
        lowCylinder: cfg.lowCylinder.dropAtOrBelow
      }
    };
  }

  window.DioptraEngineV03 = {
    version: cfg.version,
    predictCase,
    // exposed for tests, scoring and the fitting tool
    roundToStep,
    normalizeAxis,
    roundAxis,
    axisDistance,
    toMinusCylinder,
    powerVector,
    fromPowerVector,
    vectorDistance,
    astigmaticDistance,
    effectivePower,
    convertVertex,
    astigmatismOrientation,
    classifyAmetropia,
    classifyRefractiveState,
    ageBand,
    javalEstimate,
    tableAdd,
    predictAdd
  };
})();
