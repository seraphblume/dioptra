(function () {
  const $ = id => document.getElementById(id);
  const cfg = window.DIOPTRA_CONFIG;
  const v03 = window.DIOPTRA_V03_CONFIG;
  const alg = window.DioptraAlgorithm;
  const engines = window.DioptraEngines;
  const scoring = window.DioptraScoring;
  const store = window.DioptraStorage;

  const EYES = [
    { id: "od", short: "OD", name: "Right eye" },
    { id: "os", short: "OS", name: "Left eye" }
  ];
  const AR_ROWS = [
    { id: "R1", label: "1", repeat: true },
    { id: "R2", label: "2", repeat: true },
    { id: "R3", label: "3", repeat: true },
    { id: "Sel", label: "â€¹ â€º", repeat: false }
  ];
  const SYMPTOMS = [
    ["tearing", "Tearing"],
    ["blurredVision", "Blurred vision"],
    ["burningIrritation", "Burning / irritation"],
    ["itching", "Itching"],
    ["discharge", "Discharge"],
    ["infection", "Infection"],
    ["headache", "Headache"],
    ["flashes", "Flashes"],
    ["dryEye", "Dry eye"],
    ["other", "Other"]
  ];
  const MEDICAL = [["diabetes", "Diabetes"], ["hypertension", "Hypertension"], ["pregnancy", "Pregnancy"]];

  const FLAG_TITLES = {
    VERTEX_CONVERTED: "Vertex distance converted",
    VERTEX_ASSUMED: "Vertex distance assumed",
    AR_REPEATS_MISSING: "Repeat readings not entered",
    AR_REPEATABILITY_LOW: "Readings disagree",
    AR_ASTIGMATISM_UNSTABLE: "Cylinder unstable across readings",
    AR_SELECTED_OUTSIDE_CLUSTER: "Selected line is an outlier",
    OFFSET_CLAMPED: "Offset capped",
    SE_SHIFT_REVIEW: "Large shift from the autorefractor",
    LOW_CYLINDER_DROPPED: "Small cylinder dropped",
    OBLIQUE_ASTIGMATISM: "Oblique astigmatism",
    KERATOMETRY_DISAGREEMENT: "Keratometry disagrees",
    PINHOLE_LIMITED_GAIN: "Pinhole gave no improvement"
  };

  const state = {
    stage: "measure",
    input: null,        // v0.2-shaped input (unchanged study record)
    observations: null, // extra shadow-only observations
    run: null,          // { primary, shadow }
    actual: null,
    comparison: null
  };

  // ------------------------------------------------------------------ formatting

  const MINUS = "âˆ’";

  function fmtPower(n) {
    if (n == null || !Number.isFinite(n)) return "â€”";
    if (Math.abs(n) < 1e-9) return "0.00";
    return (n > 0 ? "+" : MINUS) + Math.abs(n).toFixed(2);
  }

  function fmtDelta(n) {
    if (n == null || !Number.isFinite(n)) return "â€”";
    if (Math.abs(n) < 1e-9) return "0.00";
    return (n > 0 ? "+" : MINUS) + Math.abs(n).toFixed(2);
  }

  function fmtAxis(n) {
    return n == null || !Number.isFinite(n) ? "â€”" : `${Math.round(n)}Â°`;
  }

  function pct(rate) {
    return rate == null ? "â€”" : `${Math.round(rate * 100)}%`;
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ------------------------------------------------------------------ builders

  function powerField(id, signed, placeholder) {
    const sign = signed
      ? `<button type="button" class="sign" data-target="${id}" aria-label="Toggle sign">${MINUS}</button>`
      : `<span class="sign static" aria-hidden="true">${MINUS}</span>`;
    return `<div class="power">${sign}<input id="${id}" class="field" type="text" inputmode="decimal" autocomplete="off" placeholder="${placeholder}" data-sign="-1" /></div>`;
  }

  function buildArTables() {
    for (const eye of EYES) {
      const rows = AR_ROWS.map(row => {
        const p = `${eye.id}${row.id}`;
        const q = row.repeat
          ? `<input id="${p}Q" class="field" type="text" inputmode="numeric" autocomplete="off" maxlength="2" placeholder="Q" aria-label="Reliability" />`
          : `<span></span>`;
        return `
          <div class="rx-row${row.repeat ? "" : " selected"}" data-eye="${eye.id}" data-row="${row.id}">
            <span class="rx-row-label" title="${row.repeat ? "Reading " + row.label : "Selected line (required)"}">${row.label}</span>
            ${powerField(p + "Sph", true, "0.00")}
            ${powerField(p + "Cyl", false, "0.00")}
            <input id="${p}Ax" class="field" type="text" inputmode="numeric" autocomplete="off" placeholder="180" aria-label="Axis" />
            ${q}
          </div>`;
      }).join("");
      $(`ar-${eye.id}`).innerHTML = `
        <div class="rx-head"><span></span><span>SPH</span><span>CYL</span><span>AXIS</span><span>Q</span></div>${rows}`;
    }
  }

  function buildFinalTables() {
    const step = (v03.ui && v03.ui.finalAxisStep) || 5;
    const axisOptions = ['<option value="">â€”</option>']
      .concat(Array.from({ length: Math.floor(180 / step) }, (_, i) => (i + 1) * step).map(v => `<option value="${v}">${v}Â°</option>`))
      .join("");
    for (const eye of EYES) {
      const p = `${eye.id}Fin`;
      $(`final-${eye.id}`).innerHTML = `
        <div class="rx-head"><span></span><span>SPH</span><span>CYL</span><span>AXIS</span></div>
        <div class="rx-row" data-eye="${eye.id}">
          <span class="rx-row-label">${eye.short}</span>
          ${powerField(p + "Sph", true, "0.00")}
          ${powerField(p + "Cyl", false, "0.00")}
          <select id="${p}Ax" class="field" aria-label="Axis">${axisOptions}</select>
        </div>`;
    }
  }

  function buildKeratometry() {
    const rows = EYES.map(eye => `
      <div class="row">
        <span class="row-label">${eye.short} K1</span>
        <span class="row-value">
          <input id="${eye.id}K1" class="row-input num short" type="text" inputmode="decimal" placeholder="D" aria-label="${eye.short} K1 dioptres" />
          <span class="unit">@</span>
          <input id="${eye.id}K1Ax" class="row-input num short" type="text" inputmode="numeric" placeholder="Â°" aria-label="${eye.short} K1 axis" />
        </span>
      </div>
      <div class="row">
        <span class="row-label">${eye.short} K2</span>
        <span class="row-value">
          <input id="${eye.id}K2" class="row-input num short" type="text" inputmode="decimal" placeholder="D" aria-label="${eye.short} K2 dioptres" />
          <span class="unit">@</span>
          <input id="${eye.id}K2Ax" class="row-input num short" type="text" inputmode="numeric" placeholder="Â°" aria-label="${eye.short} K2 axis" />
        </span>
      </div>`).join("");
    $("k-fields").innerHTML = rows;
  }

  function buildChips() {
    $("symptomChips").innerHTML = SYMPTOMS.map(([key, label]) =>
      `<label class="chip"><input type="checkbox" data-symptom="${key}" /><span>${label}</span></label>`).join("");
    $("medicalChips").innerHTML = MEDICAL.map(([key, label]) =>
      `<label class="chip"><input type="checkbox" data-medical="${key}" /><span>${label}</span></label>`).join("");
  }

  function populateSelects() {
    const va = '<option value="">â€”</option>' + cfg.visualAcuity.map(v => `<option value="${v.snellen}">${v.snellen}</option>`).join("");
    ["vaOd", "phOd", "vaOs", "phOs"].forEach(id => { $(id).innerHTML = va; });
    $("finalAdd").innerHTML = '<option value="">None</option>' +
      Array.from({ length: 14 }, (_, i) => ((i + 1) * 0.25).toFixed(2)).map(v => `<option value="${v}">+${v}</option>`).join("");
  }

  // ------------------------------------------------------------------ reading values

  function rawText(id) {
    const el = $(id);
    return el ? el.value.trim().replace(",", ".") : "";
  }

  function parsed(id) {
    const t = rawText(id);
    if (t === "") return null;
    const n = Number(t.replace(/^[+âˆ’-]/, m => (m === "+" ? "" : "-")));
    return Number.isFinite(n) ? n : NaN;
  }

  function signedValue(id) {
    const n = parsed(id);
    if (n == null || Number.isNaN(n)) return n;
    const el = $(id);
    const typedSign = /^[+âˆ’-]/.test(rawText(id));
    const sign = typedSign ? Math.sign(n) || -1 : Number(el.dataset.sign || -1);
    const mag = Math.abs(n);
    return mag === 0 ? 0 : mag * sign;
  }

  function minusValue(id) {
    const n = parsed(id);
    if (n == null || Number.isNaN(n)) return n;
    return Math.abs(n) === 0 ? 0 : -Math.abs(n);
  }

  function markInvalid(ids, errors, id, message) {
    ids.add(id);
    if (message) errors.push(message);
  }

  function readArRow(eye, row) {
    const p = `${eye}${row}`;
    const ids = [`${p}Sph`, `${p}Cyl`, `${p}Ax`];
    const filled = ids.some(id => rawText(id) !== "") || ($(`${p}Q`) && rawText(`${p}Q`) !== "");
    return {
      ids,
      filled,
      sphere: signedValue(`${p}Sph`),
      cylinder: minusValue(`${p}Cyl`),
      axis: parsed(`${p}Ax`),
      reliability: $(`${p}Q`) ? parsed(`${p}Q`) : null
    };
  }

  function validRx(r) {
    return [r.sphere, r.cylinder, r.axis].every(v => v != null && Number.isFinite(v)) &&
      r.axis >= 1 && r.axis <= 180 && Math.abs(r.sphere) <= 30 && Math.abs(r.cylinder) <= 10;
  }

  function readSymptoms() {
    const symptoms = {};
    const labels = [];
    document.querySelectorAll("[data-symptom]").forEach(cb => {
      const key = cb.dataset.symptom;
      symptoms[key] = cb.checked;
      if (cb.checked) labels.push(SYMPTOMS.find(s => s[0] === key)[1]);
    });
    const otherText = $("symptomOtherText").value.trim();
    symptoms.otherText = otherText;
    if (symptoms.other && otherText) labels[labels.indexOf("Other")] = `Other: ${otherText}`;
    return { symptoms, labels };
  }

  function readMedical() {
    const medical = {};
    document.querySelectorAll("[data-medical]").forEach(cb => { medical[cb.dataset.medical] = cb.checked; });
    return medical;
  }

  function readKeratometry(eye) {
    const k = {
      k1D: parsed(`${eye}K1`), k1Axis: parsed(`${eye}K1Ax`),
      k2D: parsed(`${eye}K2`), k2Axis: parsed(`${eye}K2Ax`)
    };
    return Object.values(k).every(v => v == null) ? null : k;
  }

  function readCase() {
    const errors = [];
    const invalid = new Set();

    const age = parsed("age");
    if (age == null || Number.isNaN(age) || age < 1 || age > 120) markInvalid(invalid, errors, "age", "Enter the patient's age.");

    const eyes = {};
    const extras = {};
    for (const eye of EYES) {
      const sel = readArRow(eye.id, "Sel");
      if (!validRx(sel)) {
        sel.ids.forEach(id => invalid.add(id));
        errors.push(`Enter the bracketed (selected) line for the ${eye.name.toLowerCase()}.`);
      }
      const readings = [];
      for (const row of AR_ROWS.filter(r => r.repeat)) {
        const r = readArRow(eye.id, row.id);
        if (!r.filled) continue;
        if (!validRx(r)) {
          r.ids.forEach(id => invalid.add(id));
          errors.push(`Complete or clear reading ${row.label} for ${eye.short}.`);
          continue;
        }
        readings.push({ sphere: r.sphere, cylinder: r.cylinder, axis: r.axis, reliability: Number.isFinite(r.reliability) ? r.reliability : null });
      }
      const suffix = eye.id === "od" ? "Od" : "Os";
      eyes[eye.id] = {
        sphere: sel.sphere,
        cylinder: sel.cylinder,
        axis: sel.axis,
        va: $(`va${suffix}`).value,
        pinhole: $(`ph${suffix}`).value
      };
      extras[eye.id] = { readings, keratometry: readKeratometry(eye.id) };
    }

    const optional = (id, min, max, label) => {
      const v = parsed(id);
      if (v == null) return null;
      if (Number.isNaN(v) || v < min || v > max) { markInvalid(invalid, errors, id, `${label} looks out of range.`); return null; }
      return v;
    };
    const instrument = {
      vertexMm: optional("vertexMm", 0, 25, "Vertex distance"),
      pdDistanceMm: optional("pdDistance", 40, 85, "Distance PD"),
      pdNearMm: optional("pdNear", 35, 85, "Near PD")
    };
    const near = {
      workingDistanceCm: optional("nearWd", 15, 100, "Near working distance"),
      nearPointCm: optional("nearPoint", 5, 200, "Near point")
    };

    const symptomData = readSymptoms();
    const input = {
      caseId: $("caseTitle").dataset.caseId,
      age,
      symptom: symptomData.labels.join(", "),
      symptoms: symptomData.symptoms,
      medical: readMedical(),
      previousRxKnown: $("previousRxKnown").dataset.value,
      od: eyes.od,
      os: eyes.os
    };
    const observations = { instrument, near, od: extras.od, os: extras.os };
    return { input, observations, errors, invalid };
  }

  function engineInput(input, observations) {
    return {
      ...input,
      instrument: observations.instrument,
      near: observations.near,
      od: { ...input.od, ...observations.od },
      os: { ...input.os, ...observations.os }
    };
  }

  function readActual() {
    const errors = [];
    const invalid = new Set();
    const actual = {};
    for (const eye of EYES) {
      const p = `${eye.id}Fin`;
      const r = { sphere: signedValue(`${p}Sph`), cylinder: minusValue(`${p}Cyl`), axis: parsed(`${p}Ax`) };
      if (r.cylinder === null && r.sphere != null) r.cylinder = 0;
      if (r.cylinder === 0 && r.axis == null) r.axis = 180;
      if (!validRx(r)) {
        [`${p}Sph`, `${p}Cyl`, `${p}Ax`].forEach(id => invalid.add(id));
        errors.push(`Enter your final Rx for the ${eye.name.toLowerCase()}.`);
      }
      actual[eye.id] = r;
    }
    actual.add = $("finalAdd").value === "" ? null : Number($("finalAdd").value);
    actual.note = $("finalNote").value.trim();
    return { actual, errors, invalid };
  }

  function showInvalid(ids) {
    document.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      (el.closest(".power") || el).classList.add("invalid");
    });
    const first = [...ids].map($).find(Boolean);
    if (first) first.focus({ preventScroll: false });
  }

  // ------------------------------------------------------------------ stage flow

  function setStage(stage) {
    state.stage = stage;
    document.body.dataset.stage = stage;
    $("measureSection").hidden = stage !== "measure";
    $("refractSection").hidden = stage === "measure";
    $("compareSection").hidden = stage !== "compare";
    $("refractSection").disabled = stage === "compare";

    const order = ["measure", "refract", "compare"];
    document.querySelectorAll(".stepper li").forEach(li => {
      const i = order.indexOf(li.dataset.step);
      const cur = order.indexOf(stage);
      li.classList.toggle("current", i === cur);
      li.classList.toggle("done", i < cur);
      li.querySelector(".step-dot").textContent = i < cur ? "âœ“" : String(i + 1);
    });

    $("primaryAction").textContent = { measure: "Lock Prediction", refract: "Reveal Comparison", compare: "Save Case" }[stage];
  }

  function lock() {
    const { input, observations, errors, invalid } = readCase();
    showInvalid(invalid);
    if (errors.length) {
      toast(errors[0], true);
      return;
    }
    try {
      state.run = engines.run(engineInput(input, observations));
    } catch (err) {
      toast(err.message, true);
      return;
    }
    hideToast();
    state.input = input;
    state.observations = observations;
    const p = state.run.primary.prediction;
    const time = new Date(p.lockedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    $("lockedDetail").textContent = `${engineLabel(state.run.primary.id)} at ${time} Â· hidden until you reveal.`;
    setStage("refract");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reveal() {
    const { actual, errors, invalid } = readActual();
    showInvalid(invalid);
    if (errors.length) {
      toast(errors[0], true);
      return;
    }
    hideToast();
    const p = state.run.primary.prediction;
    state.actual = actual;
    state.comparison = {
      od: alg.compareEye(p.od, actual.od),
      os: alg.compareEye(p.os, actual.os),
      addError: actual.add == null ? null : actual.add - p.tentativeAdd
    };
    renderComparison();
    setStage("compare");
    $("compareSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function save() {
    const run = state.run;
    const record = {
      caseId: state.input.caseId,
      savedAt: new Date().toISOString(),
      input: state.input,
      prediction: run.primary.prediction,
      actual: state.actual,
      comparison: state.comparison,
      shadow: {
        shadowOnly: true,
        schema: "dioptra-shadow-1",
        primaryEngine: run.primary.id,
        shadowEngine: run.shadow.id,
        observations: state.observations,
        prediction: run.shadow.prediction,
        error: run.shadow.error
      }
    };
    store.saveCase(record);
    updateStats();
    resetForm();
    toast(`Saved ${record.caseId}`);
  }

  function primaryAction() {
    if (state.stage === "measure") lock();
    else if (state.stage === "refract") reveal();
    else save();
  }

  function resetForm() {
    state.input = state.observations = state.run = state.actual = state.comparison = null;
    document.querySelectorAll("input").forEach(el => {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
    document.querySelectorAll("select").forEach(el => { el.selectedIndex = 0; });
    document.querySelectorAll(".field[data-sign]").forEach(el => { el.dataset.sign = "-1"; });
    document.querySelectorAll(".sign:not(.static)").forEach(b => { b.textContent = MINUS; });
    document.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
    setSegment($("previousRxKnown"), "");
    $("comparisonContent").innerHTML = "";
    $("kSection").open = false;
    setCaseId(newCaseId());
    setStage("measure");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newCaseId() {
    return "RX-" + String(store.listCases().length + 1).padStart(4, "0");
  }

  function setCaseId(id) {
    $("caseTitle").dataset.caseId = id;
    $("caseTitle").textContent = `Case ${id}`;
    $("navTitle").textContent = id;
  }

  function engineLabel(id) {
    const e = engines.ENGINES[id];
    return `v${e.version()}`;
  }

  // ------------------------------------------------------------------ comparison view

  function deltaPill(value, ok, kind = "power") {
    if (value == null || !Number.isFinite(value)) return `<span class="pill na">n/a</span>`;
    const text = kind === "axis" ? `${Math.round(value)}Â°` : fmtDelta(value);
    return `<span class="pill ${ok ? "ok" : "off"}">${text}</span>`;
  }

  function eyeTable(eye, pred, actual, title) {
    const s = scoring.scoreEye(pred, actual);
    const axisCell = s.axisApplicable
      ? `${deltaPill(s.axisError, s.axisWithinTolerance, "axis")}<span class="tol">Â±${s.axisTolerance}Â°</span>`
      : `<span class="pill na">n/a</span>`;
    return `
      <h2 class="group-header">${esc(title)}</h2>
      <div class="group">
        <div class="cmp">
          <span class="cmp-h">${eye.short}</span><span class="cmp-h">Dioptra</span><span class="cmp-h">You</span><span class="cmp-h" style="padding-right:16px">Î”</span>
          <span class="cmp-label">SPH</span><span class="cmp-v">${fmtPower(pred.sphere)}</span><span class="cmp-v">${fmtPower(actual.sphere)}</span><span class="cmp-d">${deltaPill(s.sphereError, s.within025Sphere)}</span>
          <span class="cmp-sep"></span>
          <span class="cmp-label">CYL</span><span class="cmp-v">${fmtPower(pred.cylinder)}</span><span class="cmp-v">${fmtPower(actual.cylinder)}</span><span class="cmp-d">${deltaPill(s.cylinderError, s.within025Cylinder)}</span>
          <span class="cmp-sep"></span>
          <span class="cmp-label">AXIS</span><span class="cmp-v">${fmtAxis(pred.axis)}</span><span class="cmp-v">${fmtAxis(actual.axis)}</span><span class="cmp-d">${axisCell}</span>
          <span class="cmp-sep"></span>
          <span class="cmp-label">SE</span><span class="cmp-v">${fmtPower(pred.sphere + pred.cylinder / 2)}</span><span class="cmp-v">${fmtPower(actual.sphere + actual.cylinder / 2)}</span><span class="cmp-d">${deltaPill(s.seError, s.within025SE)}</span>
        </div>
      </div>`;
  }

  function flagsFor(prediction) {
    if (!prediction || prediction.engine !== "v0.3") return [];
    const list = [...(prediction.flags || [])];
    for (const eye of EYES) {
      for (const f of prediction[eye.id].flags) list.push({ ...f, eye: eye.short });
    }
    return list;
  }

  function flagsGroup(prediction, title) {
    if (!prediction || prediction.engine !== "v0.3") return "";
    const flags = flagsFor(prediction);
    const items = flags.length
      ? flags.map(f => `
          <li><span class="flag-dot ${f.level === "review" ? "review" : "info"}">${f.level === "review" ? "!" : "i"}</span>
          <span class="flag-text"><strong>${esc(FLAG_TITLES[f.code] || f.code)}${f.eye ? ` Â· ${f.eye}` : ""}</strong><span>${esc(f.message)}</span></span></li>`).join("")
      : `<li><span class="flag-dot ok">âœ“</span><span class="flag-text"><strong>No flags</strong><span>Readings consistent; nothing to review.</span></span></li>`;
    return `<h2 class="group-header">${esc(title)}</h2><div class="group"><ul class="flag-list">${items}</ul></div>`;
  }

  function addGroup(prediction, actual) {
    const p = prediction.tentativeAdd;
    const ok = actual.add == null ? null : Math.abs(actual.add - p) <= 0.25 + 1e-9;
    const est = prediction.add && prediction.add.estimates;
    const amp = est && est.amplitudeBased != null ? `<div class="row"><span class="row-label">Amplitude-based estimate</span><span class="row-detail">${fmtPower(est.amplitudeBased)}</span></div>` : "";
    return `
      <h2 class="group-header">Near addition</h2>
      <div class="group">
        <div class="row"><span class="row-label">Dioptra</span><span class="row-detail num">${p ? fmtPower(p) : "None"}</span></div>
        <div class="row"><span class="row-label">You</span><span class="row-detail num">${actual.add == null ? "None" : fmtPower(actual.add)}</span></div>
        ${actual.add == null ? "" : `<div class="row"><span class="row-label">Difference</span>${deltaPill(actual.add - p, ok)}</div>`}
        ${amp}
      </div>`;
  }

  function candidatesGroup(v03p) {
    if (!v03p) return "";
    const names = { selected: "Selected", median: "Median", mostPlus: "Most plus" };
    const rows = Object.entries(names).map(([key, label]) => {
      const lines = EYES.map(eye => {
        const c = v03p[eye.id].candidates[key];
        const axis = c.cylinder === 0 ? "" : ` Ã— ${Math.round(c.axis)}`;
        return `<span>${eye.short}&nbsp; ${fmtPower(c.sphere)} ${fmtPower(c.cylinder)}${axis}</span>`;
      }).join("");
      const used = v03p.od.estimator === key ? `<span class="badge">Used</span>` : "";
      return `<div class="row"><span class="row-label">${label} ${used}</span><span class="cand">${lines}</span></div>`;
    }).join("");
    return `<h2 class="group-header">v0.3 estimators</h2><div class="group">${rows}</div>
      <p class="group-footer">All three are computed on every case so they can be compared once the cohort closes.</p>`;
  }

  function renderComparison() {
    const run = state.run;
    const p = run.primary.prediction;
    const a = state.actual;
    const primaryName = engineLabel(run.primary.id);
    const shadowPred = run.shadow.prediction;
    const v03p = p.engine === "v0.3" ? p : shadowPred && shadowPred.engine === "v0.3" ? shadowPred : null;

    let html = EYES.map(eye => eyeTable(eye, p[eye.id], a[eye.id], `${eye.name} Â· ${primaryName}`)).join("");
    html += addGroup(p, a);

    if (p.engine === "v0.3") html += flagsGroup(p, "Flags");

    if (shadowPred) {
      const shadowName = engineLabel(run.shadow.id);
      const inner = EYES.map(eye => eyeTable(eye, shadowPred[eye.id], a[eye.id], `${eye.name} Â· ${shadowName}`)).join("") +
        (shadowPred.engine === "v0.3" ? flagsGroup(shadowPred, "Flags") + candidatesGroup(v03p) : "");
      html += `
        <details class="shadow-block">
          <summary class="group row disclosure-row"><span class="row-label">Shadow engine</span><span class="row-detail">${shadowName}</span></summary>
          <p class="group-footer">Shown for information only. The study records the ${primaryName} result above.</p>
          <div class="shadow-inner">${inner}</div>
        </details>`;
    } else if (run.shadow.error) {
      html += `<p class="group-footer">Shadow engine could not run: ${esc(run.shadow.error)}</p>`;
    }
    $("comparisonContent").innerHTML = html;
  }

  // ------------------------------------------------------------------ study stats

  function scoresFor(cases, pick) {
    const out = [];
    for (const c of cases) {
      const pred = pick(c);
      if (!pred || !c.actual) continue;
      for (const eye of EYES) {
        if (pred[eye.id] && c.actual[eye.id]) out.push(scoring.scoreEye(pred[eye.id], c.actual[eye.id]));
      }
    }
    return out;
  }

  function updateStats() {
    const cases = store.listCases();
    const summary = scoring.summarize(scoresFor(cases, c => c.prediction));
    const exact = cases.flatMap(c => [c.comparison.od, c.comparison.os]).filter(e => e.exact).length;
    const eyes = cases.length * 2;
    $("stats").innerHTML = [
      [cases.length, "Cases"],
      [pct(summary.clinicalMatchRate), "Eyes matched"],
      [pct(summary.sphereWithin025Rate), "Sphere Â±0.25 D"],
      [pct(summary.cylinderWithin025Rate), "Cylinder Â±0.25 D"],
      [pct(summary.axisWithinToleranceRate), "Axis in tolerance"],
      [eyes ? pct(exact / eyes) : "â€”", "Exact eyes"]
    ].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

    renderEngineCompare(cases);
  }

  function renderEngineCompare(cases) {
    const variants = [
      [`Study Â· ${engineLabel(engines.primaryId())}`, c => c.prediction, true],
      [`Shadow Â· ${engineLabel(engines.shadowId())}`, c => c.shadow && c.shadow.prediction],
      ["v0.3 selected", c => candidateSet(c, "selected")],
      ["v0.3 median", c => candidateSet(c, "median")],
      ["v0.3 most plus", c => candidateSet(c, "mostPlus")]
    ];
    const rows = variants.map(([label, pick, primary]) => {
      const s = scoring.summarize(scoresFor(cases, pick));
      if (!s.eyes) return "";
      return `<tr class="${primary ? "primary-row" : ""}"><td>${label}</td><td class="col-eyes">${s.eyes}</td><td>${pct(s.clinicalMatchRate)}</td>
        <td>${fmtDelta(s.meanSEBias)}</td><td>${s.meanAbsSEError == null ? "â€”" : s.meanAbsSEError.toFixed(2)}</td>
        <td>${s.meanVectorError == null ? "â€”" : s.meanVectorError.toFixed(2)}</td></tr>`;
    }).join("");
    $("engineCompareDetail").textContent = cases.length ? `${cases.length} case${cases.length === 1 ? "" : "s"}` : "No cases yet";
    $("engineCompare").innerHTML = rows
      ? `<table><thead><tr><th>Engine</th><th class="col-eyes">Eyes</th><th>Match</th><th>Bias</th><th>|SE|</th><th>Vector</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="empty">Saved cases will appear here.</p>`;
  }

  function candidateSet(c, key) {
    const p = c.prediction && c.prediction.engine === "v0.3" ? c.prediction
      : c.shadow && c.shadow.prediction && c.shadow.prediction.engine === "v0.3" ? c.shadow.prediction : null;
    if (!p) return null;
    return { od: p.od.candidates[key], os: p.os.candidates[key] };
  }

  // ------------------------------------------------------------------ dialogs, toast, export

  let toastTimer = null;
  function hideToast() {
    clearTimeout(toastTimer);
    $("toast").classList.remove("show");
  }

  function toast(message, isError = false) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), isError ? 3200 : 2200);
  }

  function ask({ title, message = "", actions }) {
    const dialog = $("dialog");
    $("dialogTitle").textContent = title;
    $("dialogMessage").textContent = message;
    $("dialogActions").innerHTML = actions
      .map(a => `<button value="${a.id}" class="${a.style || ""}">${esc(a.label)}</button>`).join("");
    return new Promise(resolve => {
      const done = () => {
        dialog.removeEventListener("close", done);
        resolve(dialog.returnValue || "cancel");
      };
      dialog.returnValue = "";
      dialog.addEventListener("close", done);
      dialog.showModal();
    });
  }

  function download(name, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportData() {
    const cases = store.listCases();
    if (!cases.length) {
      toast("No saved cases yet.");
      return;
    }
    const choice = await ask({
      title: "Export",
      message: `${cases.length} case${cases.length === 1 ? "" : "s"} on this device.`,
      actions: [
        { id: "study", label: "Study CSV" },
        { id: "shadow", label: "Engine Comparison CSV" },
        { id: "cancel", label: "Cancel", style: "cancel" }
      ]
    });
    const date = new Date().toISOString().slice(0, 10);
    if (choice === "study") download(`project-dioptra-${date}.csv`, store.toCSV(cases));
    if (choice === "shadow") download(`project-dioptra-shadow-${date}.csv`, store.toShadowCSV(cases));
  }

  async function clearData() {
    const n = store.listCases().length;
    if (!n) {
      toast("No saved cases.");
      return;
    }
    const choice = await ask({
      title: `Delete ${n} case${n === 1 ? "" : "s"}?`,
      message: "This removes every case stored on this device. Export first if you need them.",
      actions: [
        { id: "delete", label: "Delete", style: "destructive" },
        { id: "cancel", label: "Cancel", style: "cancel" }
      ]
    });
    if (choice !== "delete") return;
    store.clearCases();
    updateStats();
    resetForm();
    toast("All cases deleted.");
  }

  async function newCase() {
    const dirty = state.stage !== "measure" ||
      [...document.querySelectorAll("#measureSection input")].some(el => (el.type === "checkbox" ? el.checked : el.value.trim() !== ""));
    if (dirty) {
      const choice = await ask({
        title: "Discard this case?",
        message: state.stage === "measure" ? "The values you entered will be cleared." : "The locked prediction has not been saved.",
        actions: [
          { id: "discard", label: "Discard", style: "destructive" },
          { id: "cancel", label: "Keep Editing", style: "cancel" }
        ]
      });
      if (choice !== "discard") return;
    }
    resetForm();
  }

  // ------------------------------------------------------------------ controls

  function setSegment(el, value) {
    el.dataset.value = value;
    el.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.value === value)));
  }

  function bindControls() {
    document.addEventListener("click", e => {
      const sign = e.target.closest(".sign:not(.static)");
      if (sign) {
        const input = $(sign.dataset.target);
        const positive = Number(input.dataset.sign || -1) < 0;
        input.dataset.sign = positive ? "1" : "-1";
        sign.textContent = positive ? "+" : MINUS;
        // carry the sign to empty sphere fields of the same eye, so repeats need one tap
        const row = sign.closest(".rx-row");
        if (row && row.closest(".rx-table:not(.final)")) {
          row.parentElement.querySelectorAll(".rx-row .sign:not(.static)").forEach(other => {
            const target = $(other.dataset.target);
            if (other !== sign && target.value.trim() === "") {
              target.dataset.sign = input.dataset.sign;
              other.textContent = sign.textContent;
            }
          });
        }
        input.focus();
        return;
      }
      const seg = e.target.closest(".segmented button");
      if (seg) setSegment(seg.parentElement, seg.dataset.value);
    });

    document.addEventListener("change", e => {
      const chip = e.target.closest(".chip");
      if (chip) chip.classList.toggle("on", e.target.checked);
    });

    document.addEventListener("input", e => {
      const box = e.target.closest(".invalid") || (e.target.classList.contains("invalid") ? e.target : null);
      if (box) box.classList.remove("invalid");
    });

    // Enter moves to the next field, like a numeric keypad workflow.
    document.addEventListener("keydown", e => {
      if (e.key !== "Enter" || !e.target.matches("input.field, input.row-input")) return;
      e.preventDefault();
      const fields = [...document.querySelectorAll("fieldset:not([hidden]) input.field, fieldset:not([hidden]) input.row-input")]
        .filter(el => !el.disabled && el.offsetParent !== null);
      const next = fields[fields.indexOf(e.target) + 1];
      if (next) next.focus();
    });

    const navbar = $("navbar");
    const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 36);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    $("primaryAction").addEventListener("click", primaryAction);
    $("newCaseBtn").addEventListener("click", newCase);
    $("exportBtn").addEventListener("click", exportData);
    $("clearDataBtn").addEventListener("click", clearData);
  }

  // ------------------------------------------------------------------ init

  buildArTables();
  buildFinalTables();
  buildKeratometry();
  buildChips();
  populateSelects();
  bindControls();
  setSegment($("previousRxKnown"), "");
  setCaseId(newCaseId());

  const shadowWord = engines.primaryId() === "v0.2" ? "v0.3 runs in shadow" : "v0.2 runs in shadow";
  $("engineLine").textContent = `Study engine ${engineLabel(engines.primaryId())} Â· ${shadowWord}`;

  setStage("measure");
  updateStats();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
