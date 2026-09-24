(function () {
  const KEY = "project-dioptra-cases-v1";

  function listCases() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function saveCase(record) {
    const cases = listCases();
    cases.push(record);
    localStorage.setItem(KEY, JSON.stringify(cases));
    return cases;
  }

  function clearCases() { localStorage.removeItem(KEY); }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replaceAll('"', '""') + '"';
    return text;
  }

  function symptomValue(c, key) {
    return c.input && c.input.symptoms && typeof c.input.symptoms[key] === "boolean" ? c.input.symptoms[key] : "";
  }

  function medicalValue(c, key) {
    return c.input && c.input.medical && typeof c.input.medical[key] === "boolean" ? c.input.medical[key] : "";
  }

  function se(sph, cyl) {
    if (!Number.isFinite(Number(sph)) || !Number.isFinite(Number(cyl))) return "";
    return Number(sph) + Number(cyl) / 2;
  }

  function eyeSEFields(c, eye) {
    const input = c.input && c.input[eye] ? c.input[eye] : {};
    const pred = c.prediction && c.prediction[eye] ? c.prediction[eye] : {};
    const actual = c.actual && c.actual[eye] ? c.actual[eye] : {};
    const arSE = se(input.sphere, input.cylinder);
    const predSE = Number.isFinite(Number(pred.sphericalEquivalent)) ? Number(pred.sphericalEquivalent) : se(pred.sphere, pred.cylinder);
    const finalSE = se(actual.sphere, actual.cylinder);
    const shift = arSE === "" || predSE === "" ? "" : predSE - arSE;
    const error = predSE === "" || finalSE === "" ? "" : finalSE - predSE;
    return {
      arSE, predSE, finalSE, shift, error,
      status: pred.seGuardrail && pred.seGuardrail.status ? pred.seGuardrail.status : "",
      applied: pred.seGuardrail && typeof pred.seGuardrail.applied === "boolean" ? pred.seGuardrail.applied : ""
    };
  }

  function toCSV(cases) {
    const headers = [
      "case_id","age","created_at","algorithm_version",
      "ar_od_sph","ar_od_cyl","ar_od_axis","va_od","ph_od",
      "ar_os_sph","ar_os_cyl","ar_os_axis","va_os","ph_os",
      "pred_od_sph","pred_od_cyl","pred_od_axis",
      "pred_os_sph","pred_os_cyl","pred_os_axis","pred_add",
      "final_od_sph","final_od_cyl","final_od_axis",
      "final_os_sph","final_os_cyl","final_os_axis","final_add",
      "od_sph_error","od_cyl_error","od_axis_error",
      "os_sph_error","os_cyl_error","os_axis_error",
      "ar_od_se","pred_od_se","final_od_se","pred_od_se_shift","od_se_error","od_se_guardrail_status","od_se_guardrail_applied",
      "ar_os_se","pred_os_se","final_os_se","pred_os_se_shift","os_se_error","os_se_guardrail_status","os_se_guardrail_applied",
      "od_exact","os_exact","od_within_025_sph","od_within_025_cyl","od_within_5_axis","od_within_025_se",
      "os_within_025_sph","os_within_025_cyl","os_within_5_axis","os_within_025_se",
      "symptoms_text","symptom_tearing","symptom_blurred_vision","symptom_burning_irritation","symptom_itching",
      "symptom_discharge","symptom_infection","symptom_headache","symptom_flashes","symptom_dry_eye",
      "symptom_other","symptom_other_text","diabetes","hypertension","pregnancy","previous_rx_known","final_note"
    ];

    const rows = cases.map(c => {
      const odSE = eyeSEFields(c, "od");
      const osSE = eyeSEFields(c, "os");
      return [
        c.caseId, c.input.age, c.savedAt, c.prediction.version,
        c.input.od.sphere, c.input.od.cylinder, c.input.od.axis, c.input.od.va, c.input.od.pinhole,
        c.input.os.sphere, c.input.os.cylinder, c.input.os.axis, c.input.os.va, c.input.os.pinhole,
        c.prediction.od.sphere, c.prediction.od.cylinder, c.prediction.od.axis,
        c.prediction.os.sphere, c.prediction.os.cylinder, c.prediction.os.axis, c.prediction.tentativeAdd,
        c.actual.od.sphere, c.actual.od.cylinder, c.actual.od.axis,
        c.actual.os.sphere, c.actual.os.cylinder, c.actual.os.axis, c.actual.add,
        c.comparison.od.sphereError, c.comparison.od.cylinderError, c.comparison.od.axisError,
        c.comparison.os.sphereError, c.comparison.os.cylinderError, c.comparison.os.axisError,
        odSE.arSE, odSE.predSE, odSE.finalSE, odSE.shift, odSE.error, odSE.status, odSE.applied,
        osSE.arSE, osSE.predSE, osSE.finalSE, osSE.shift, osSE.error, osSE.status, osSE.applied,
        c.comparison.od.exact, c.comparison.os.exact,
        c.comparison.od.within025Sphere, c.comparison.od.within025Cylinder, c.comparison.od.within5Axis,
        odSE.error === "" ? "" : Math.abs(odSE.error) <= 0.25 + 1e-9,
        c.comparison.os.within025Sphere, c.comparison.os.within025Cylinder, c.comparison.os.within5Axis,
        osSE.error === "" ? "" : Math.abs(osSE.error) <= 0.25 + 1e-9,
        c.input.symptom || "",
        symptomValue(c,"tearing"), symptomValue(c,"blurredVision"), symptomValue(c,"burningIrritation"),
        symptomValue(c,"itching"), symptomValue(c,"discharge"), symptomValue(c,"infection"),
        symptomValue(c,"headache"), symptomValue(c,"flashes"), symptomValue(c,"dryEye"),
        symptomValue(c,"other"), (c.input.symptoms && c.input.symptoms.otherText) || "",
        medicalValue(c,"diabetes"), medicalValue(c,"hypertension"), medicalValue(c,"pregnancy"),
        c.input.previousRxKnown, c.actual.note
      ];
    });

    return [headers, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  }

  window.DioptraStorage = { listCases, saveCase, clearCases, toCSV };
})();
