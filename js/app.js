(function () {
  const $ = id => document.getElementById(id);
  const alg = window.DioptraAlgorithm;
  const store = window.DioptraStorage;
  const cfg = window.DIOPTRA_CONFIG;

  let lockedPrediction = null;
  let lockedInput = null;
  let currentComparison = null;

  const symptomMap = {
    tearing: ["symptomTearing", "Tearing"],
    blurredVision: ["symptomBlur", "Blurred vision"],
    burningIrritation: ["symptomBurning", "Burning / irritation"],
    itching: ["symptomItching", "Itching"],
    discharge: ["symptomDischarge", "Discharge"],
    infection: ["symptomInfection", "Infection"],
    headache: ["symptomHeadache", "Headache"],
    flashes: ["symptomFlashes", "Flashes"],
    dryEye: ["symptomDryEye", "Dry eye"],
    other: ["symptomOther", "Other"]
  };

  function newCaseId() {
    const cases = store.listCases();
    return "RX-" + String(cases.length + 1).padStart(4, "0");
  }

  function populateVA() {
    ["vaOd","phOd","vaOs","phOs"].forEach(id => {
      const el = $(id);
      el.innerHTML = '<option value="">Select</option>' +
        cfg.visualAcuity.map(v => `<option value="${v.snellen}">${v.snellen} · ${v.decimal.toFixed(2)}</option>`).join("");
    });
  }

  function populateAxis() {
    ["finalOdAxis","finalOsAxis"].forEach(id => {
      const el = $(id);
      el.innerHTML = '<option value="">Select</option>' +
        Array.from({length: 36}, (_, i) => (i + 1) * 5)
          .map(v => `<option value="${v}">${v}°</option>`).join("");
    });
  }

  function populateAdd() {
    $("finalAdd").innerHTML = '<option value="">None / N/A</option>' +
      Array.from({length: 13}, (_, i) => (i * 0.25).toFixed(2))
        .map(v => `<option value="${v}">+${v}</option>`).join("");
  }

  function number(id) {
    const v = $(id).value;
    return v === "" ? null : Number(v);
  }

  function signedPower(id) {
    const el = $(id);
    if (el.value === "") return null;
    const magnitude = Math.abs(Number(el.value));
    const sign = Number(el.dataset.sign || -1);
    return magnitude === 0 ? 0 : magnitude * sign;
  }

  function negativeCylinder(id) {
    const el = $(id);
    if (el.value === "") return null;
    const magnitude = Math.abs(Number(el.value));
    return magnitude === 0 ? 0 : -magnitude;
  }

  function readSymptoms() {
    const symptoms = {};
    const labels = [];
    for (const [key, [id, label]] of Object.entries(symptomMap)) {
      const checked = $(id).checked;
      symptoms[key] = checked;
      if (checked) labels.push(label);
    }
    const otherText = $("symptomOtherText").value.trim();
    symptoms.otherText = otherText;
    if (symptoms.other && otherText) labels[labels.indexOf("Other")] = `Other: ${otherText}`;
    return { symptoms, labels };
  }

  function readInput() {
    const symptomData = readSymptoms();
    return {
      caseId: $("caseId").value,
      age: number("age"),
      symptom: symptomData.labels.join(", "),
      symptoms: symptomData.symptoms,
      medical: {
        diabetes: $("diabetes").checked,
        hypertension: $("hypertension").checked,
        pregnancy: $("pregnancy").checked
      },
      previousRxKnown: $("previousRxKnown").value,
      od: {
        sphere: signedPower("arOdSph"),
        cylinder: negativeCylinder("arOdCyl"),
        axis: number("arOdAxis"),
        va: $("vaOd").value,
        pinhole: $("phOd").value
      },
      os: {
        sphere: signedPower("arOsSph"),
        cylinder: negativeCylinder("arOsCyl"),
        axis: number("arOsAxis"),
        va: $("vaOs").value,
        pinhole: $("phOs").value
      }
    };
  }

  function readActual() {
    return {
      od: {
        sphere: signedPower("finalOdSph"),
        cylinder: negativeCylinder("finalOdCyl"),
        axis: number("finalOdAxis")
      },
      os: {
        sphere: signedPower("finalOsSph"),
        cylinder: negativeCylinder("finalOsCyl"),
        axis: number("finalOsAxis")
      },
      add: $("finalAdd").value === "" ? null : Number($("finalAdd").value),
      note: $("finalNote").value.trim()
    };
  }

  function validRxEye(eye, rawAxis = false) {
    if (![eye.sphere, eye.cylinder, eye.axis].every(Number.isFinite)) return false;
    if (rawAxis && (eye.axis < 1 || eye.axis > 180)) return false;
    return true;
  }

  function formatPower(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(2);
  }

  function formatAxis(n) {
    return n == null ? "—" : `${n}°`;
  }

  function resetSigns() {
    document.querySelectorAll(".sign-toggle").forEach(btn => {
      const input = $(btn.dataset.signTarget);
      input.dataset.sign = "-1";
      btn.textContent = "−";
      btn.dataset.positive = "false";
    });
  }

  function resetForm() {
    lockedPrediction = null;
    lockedInput = null;
    currentComparison = null;
    document.querySelectorAll("input").forEach(el => {
      if (el.type === "checkbox") el.checked = false;
      else if (!el.readOnly) el.value = "";
    });
    document.querySelectorAll("select").forEach(el => el.selectedIndex = 0);
    resetSigns();
    $("caseId").value = newCaseId();
    $("lockStatus").textContent = "";
    $("finalSection").classList.add("hidden");
    $("comparisonSection").classList.add("hidden");
    $("comparisonContent").innerHTML = "";
    $("lockBtn").disabled = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function lockPrediction() {
    const input = readInput();
    if (!Number.isFinite(input.age)) {
      $("lockStatus").textContent = "Enter age first.";
      return;
    }
    if (!validRxEye(input.od, true) || !validRxEye(input.os, true)) {
      $("lockStatus").textContent = "Enter complete OD/OS data. Raw AR axis must be between 1° and 180°.";
      return;
    }
    try {
      lockedInput = input;
      lockedPrediction = alg.predictCase(input);
      $("lockStatus").textContent = `Prediction locked at ${new Date(lockedPrediction.lockedAt).toLocaleTimeString()}.`;
      $("finalSection").classList.remove("hidden");
      $("lockBtn").disabled = true;
      $("finalSection").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      $("lockStatus").textContent = err.message;
    }
  }

  function reveal() {
    if (!lockedPrediction) return;
    const actual = readActual();
    if (!validRxEye(actual.od) || !validRxEye(actual.os)) {
      alert("Enter the complete final Rx for both eyes.");
      return;
    }

    currentComparison = {
      od: alg.compareEye(lockedPrediction.od, actual.od),
      os: alg.compareEye(lockedPrediction.os, actual.os),
      addError: actual.add == null ? null : actual.add - lockedPrediction.tentativeAdd
    };

    const row = (label, p, a, delta, kind="power") => {
      const fmt = kind === "axis" ? formatAxis : formatPower;
      const cls = Math.abs(delta || 0) <= (kind === "axis" ? 5 : 0.25) ? "good" : "warn";
      return `<tr><td>${label}</td><td>${fmt(p)}</td><td>${fmt(a)}</td><td class="${cls}">${kind === "axis" ? (delta == null ? "—" : delta + "°") : (delta == null ? "—" : formatPower(delta))}</td></tr>`;
    };

    const addDelta = currentComparison.addError;
    $("comparisonContent").innerHTML = `
      <table class="compare-table">
        <thead><tr><th>Metric</th><th>Algorithm</th><th>Clinician</th><th>Δ</th></tr></thead>
        <tbody>
          ${row("OD SPH", lockedPrediction.od.sphere, actual.od.sphere, currentComparison.od.sphereError)}
          ${row("OD CYL", lockedPrediction.od.cylinder, actual.od.cylinder, currentComparison.od.cylinderError)}
          ${row("OD Axis", lockedPrediction.od.axis, actual.od.axis, currentComparison.od.axisError, "axis")}
          ${row("OS SPH", lockedPrediction.os.sphere, actual.os.sphere, currentComparison.os.sphereError)}
          ${row("OS CYL", lockedPrediction.os.cylinder, actual.os.cylinder, currentComparison.os.cylinderError)}
          ${row("OS Axis", lockedPrediction.os.axis, actual.os.axis, currentComparison.os.axisError, "axis")}
          <tr><td>ADD</td><td>${formatPower(lockedPrediction.tentativeAdd)}</td><td>${actual.add == null ? "—" : formatPower(actual.add)}</td><td>${addDelta == null ? "—" : formatPower(addDelta)}</td></tr>
        </tbody>
      </table>
      <p class="status">
        Exact-eye matches: OD ${currentComparison.od.exact ? "yes" : "no"} · OS ${currentComparison.os.exact ? "yes" : "no"}
      </p>
    `;
    $("comparisonSection").classList.remove("hidden");
    $("comparisonSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function saveCase() {
    if (!lockedPrediction || !currentComparison || !lockedInput) return;
    const actual = readActual();
    const record = {
      caseId: lockedInput.caseId,
      savedAt: new Date().toISOString(),
      input: lockedInput,
      prediction: lockedPrediction,
      actual,
      comparison: currentComparison
    };
    store.saveCase(record);
    updateStats();
    alert("Case saved locally.");
    resetForm();
  }

  function updateStats() {
    const cases = store.listCases();
    const eyes = cases.flatMap(c => [c.comparison.od, c.comparison.os]);
    const pct = (count, total) => total ? Math.round((count / total) * 100) + "%" : "—";
    const exact = eyes.filter(e => e.exact).length;
    const s025 = eyes.filter(e => e.within025Sphere).length;
    const c025 = eyes.filter(e => e.within025Cylinder).length;
    const a5 = eyes.filter(e => e.within5Axis).length;

    $("stats").innerHTML = [
      ["Cases", cases.length],
      ["Exact eyes", pct(exact, eyes.length)],
      ["SPH ±0.25 D", pct(s025, eyes.length)],
      ["CYL ±0.25 D", pct(c025, eyes.length)],
      ["Axis ≤5°", pct(a5, eyes.length)]
    ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }

  function exportCSV() {
    const cases = store.listCases();
    if (!cases.length) {
      alert("No saved cases yet.");
      return;
    }
    const csv = store.toCSV(cases);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-dioptra-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearData() {
    if (!confirm("Delete all locally stored study cases on this device?")) return;
    store.clearCases();
    updateStats();
    resetForm();
  }

  document.querySelectorAll(".sign-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.signTarget);
      const positive = Number(input.dataset.sign || -1) < 0;
      input.dataset.sign = positive ? "1" : "-1";
      btn.textContent = positive ? "+" : "−";
      btn.dataset.positive = positive ? "true" : "false";
    });
  });

  $("lockBtn").addEventListener("click", lockPrediction);
  $("revealBtn").addEventListener("click", reveal);
  $("saveCaseBtn").addEventListener("click", saveCase);
  $("newCaseBtn").addEventListener("click", resetForm);
  $("exportBtn").addEventListener("click", exportCSV);
  $("clearDataBtn").addEventListener("click", clearData);

  populateVA();
  populateAxis();
  populateAdd();
  $("caseId").value = newCaseId();
  resetSigns();
  updateStats();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
