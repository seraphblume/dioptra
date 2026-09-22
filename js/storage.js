(function () {
  const KEY = "project-dioptra-cases-v1";

  function listCases() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCase(record) {
    const cases = listCases();
    cases.push(record);
    localStorage.setItem(KEY, JSON.stringify(cases));
    return cases;
  }

  function clearCases() {
    localStorage.removeItem(KEY);
  }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replaceAll('"', '""') + '"';
    return text;
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
      "od_exact","os_exact","od_within_025_sph","od_within_025_cyl","od_within_5_axis",
      "os_within_025_sph","os_within_025_cyl","os_within_5_axis",
      "symptom","previous_rx_known","final_note"
    ];

    const rows = cases.map(c => [
      c.caseId, c.input.age, c.savedAt, c.prediction.version,
      c.input.od.sphere, c.input.od.cylinder, c.input.od.axis, c.input.od.va, c.input.od.pinhole,
      c.input.os.sphere, c.input.os.cylinder, c.input.os.axis, c.input.os.va, c.input.os.pinhole,
      c.prediction.od.sphere, c.prediction.od.cylinder, c.prediction.od.axis,
      c.prediction.os.sphere, c.prediction.os.cylinder, c.prediction.os.axis, c.prediction.tentativeAdd,
      c.actual.od.sphere, c.actual.od.cylinder, c.actual.od.axis,
      c.actual.os.sphere, c.actual.os.cylinder, c.actual.os.axis, c.actual.add,
      c.comparison.od.sphereError, c.comparison.od.cylinderError, c.comparison.od.axisError,
      c.comparison.os.sphereError, c.comparison.os.cylinderError, c.comparison.os.axisError,
      c.comparison.od.exact, c.comparison.os.exact,
      c.comparison.od.within025Sphere, c.comparison.od.within025Cylinder, c.comparison.od.within5Axis,
      c.comparison.os.within025Sphere, c.comparison.os.within025Cylinder, c.comparison.os.within5Axis,
      c.input.symptom, c.input.previousRxKnown, c.actual.note
    ]);

    return [headers, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  }

  window.DioptraStorage = { listCases, saveCase, clearCases, toCSV };
})();
