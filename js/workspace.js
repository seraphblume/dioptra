(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const optics = window.DioptraOptics;
  const tabs = [$("caseTab"), $("calculatorTab")];
  const panels = [$("casePanel"), $("calculatorPanel")];
  const scrollPositions = [0, 0];
  let selected = 0;
  let result = null;

  function selectTab(index) {
    if (selected === index) return;
    scrollPositions[selected] = window.scrollY;
    selected = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    $("actionBar").hidden = index !== 0;
    $("caseActions").hidden = index !== 0;
    document.body.dataset.view = index === 0 ? "case" : "calculator";
    document.querySelector(".skip-link").href = `#${panels[index].id}`;
    window.scrollTo({ top: scrollPositions[index], behavior: "instant" });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(index));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
      selectTab(next);
      tabs[next].focus();
    });
  });

  function invalidate() {
    result = null;
    $("calculatorResults").hidden = true;
    $("calculatorEmpty").hidden = false;
    $("calculatorError").textContent = "";
    $("calculatorStatus").textContent = "";
  }
  const eyes = [{ key: "od", suffix: "", label: "Right eye · OD" }, { key: "os", suffix: "Os", label: "Left eye · OS" }];
  const f = optics.formatPower;
  const quarter = x => Math.round((x + Number.EPSILON) * 4) / 4;
  const displayRx = rx => optics.formatRx({ ...rx, sphere: Math.round(rx.sphere * 100) / 100, cylinder: Math.round(rx.cylinder * 100) / 100 });
  function setInputs(rx, suffix = "") {
    $("calcSphere" + suffix).value = f(rx.sphere);
    $("calcCylinder" + suffix).value = f(rx.cylinder);
    $("calcAxis" + suffix).value = rx.axis ?? "";
  }
  function mode() { return $("calcConversion").value; }
  function configureMode() {
    const m = mode(), reverse = m === "contactsToSpectacles", custom = m === "custom";
    $("calcFromVertex").readOnly = reverse;
    $("calcToVertex").readOnly = !reverse && !custom;
    $("calcFromVertex").value = reverse ? "0" : "12";
    $("calcToVertex").value = reverse ? "12" : "0";
    $("calcFromLabel").textContent = custom ? "Source vertex" : reverse ? "Contact lens plane" : "Spectacle vertex";
    $("calcToLabel").textContent = custom ? "Target vertex" : reverse ? "Spectacle vertex" : "Contact lens plane";
    $("calcInputPlane").textContent = custom ? "Enter powers at the source vertex. Use this mode for a change in spectacle fit or a power already at the corneal plane." : reverse ? "Enter the contact lens power. The result is its spectacle-plane optical equivalent." : "Enter the spectacle prescription. The result is its corneal-plane optical equivalent.";
    invalidate();
  }
  function readEyes() {
    const next = {};
    for (const eye of eyes) {
      const values = ["calcSphere", "calcCylinder", "calcAxis"].map(id => $(id + eye.suffix).value);
      if (values.every(v => !v.trim())) continue;
      try { next[eye.key] = optics.calculate(...values); }
      catch (error) { throw new Error(`${eye.label}: ${error.message}`); }
    }
    if (!Object.keys(next).length) throw new Error("Enter sphere and cylinder for at least one eye (use 0 cylinder for sphere only).");
    return next;
  }
  function renderEye(eye, next, from, to) {
    const get = id => $(id + eye.suffix);
    const { original: o, transposed: t, se, converted } = next;
    get("calcOriginal").textContent = optics.formatRx(o);
    get("calcTransposed").textContent = optics.formatRx(t);
    get("calcNotation").textContent = t.cylinder === 0 ? "Sphere only · axis not applicable" : t.cylinder < 0 ? "Minus-cylinder notation" : "Plus-cylinder notation";
    get("calcVertexTitle").textContent = mode() === "custom" ? "Vertex optical equivalent" : mode() === "contactsToSpectacles" ? "Spectacle-plane optical equivalent" : "Contact-plane optical equivalent";
    get("calcVertex").textContent = displayRx(converted);
    get("calcVertexPlanes").textContent = `${Number(from)} mm → ${Number(to)} mm from cornea`;
    const highPower = Math.max(Math.abs(o.sphere), Math.abs(o.sphere + o.cylinder)) >= 4;
    get("calcVertexContext").textContent = Number(from) === Number(to) ? "Same source and target plane: no vertex compensation applied."
      : highPower ? "At least one principal meridian is ±4.00 D or greater. Both meridians have been compensated."
      : "Both principal meridians are below ±4.00 D. The exact mathematical conversion is still shown.";
    get("calcVertexMeridians").textContent = `Principal powers: ${converted.sphere.toFixed(2)} D / ${(converted.sphere + converted.cylinder).toFixed(2)} D`;
    get("calcVertexRounded").textContent = optics.formatRx({ ...converted, sphere: quarter(converted.sphere), cylinder: quarter(converted.cylinder) });
    get("calcSE").textContent = `${f(next.roundedSE)} D`;
    const rows = [
      ["Vertex formula (each meridian)", "F₂ = F₁ / [1 − ((source mm − target mm) / 1000) × F₁]"],
      ["Input principal powers", `${f(o.sphere)} D / ${f(o.sphere + o.cylinder)} D`],
      ["Sphere + cylinder", `${f(o.sphere)} + (${f(o.cylinder)}) = ${f(t.sphere)} D`],
      ["Reverse cylinder sign", `${f(o.cylinder)} → ${f(t.cylinder)} D`],
      ["Rotate axis by 90°", o.axis === null ? "Not applicable to a spherical lens" : `${o.axis}° → ${t.axis}°`],
      ["Exact spherical equivalent", `${f(o.sphere)} + (${f(o.cylinder)} ÷ 2) = ${f(se)} D`],
      ["Nearest 0.25 D", `${f(se)} D → ${f(next.roundedSE)} D (halfway values toward more plus)`]
    ];
    get("calculatorMath").replaceChildren(...rows.flatMap(([label, value]) => {
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = value;
      return [dt, dd];
    }));
    get("calculatorRounding").textContent = next.lowerQuarter === next.upperQuarter ? "Already an exact 0.25 D increment."
      : `Adjacent 0.25 D values: ${f(next.lowerQuarter)} D (more minus) and ${f(next.upperQuarter)} D (more plus).`;
  }
  function show(next) {
    const from = $("calcFromVertex").value.trim().replace(",", "."), to = $("calcToVertex").value.trim().replace(",", ".");
    // Validate every entered eye and conversion before revealing any result.
    for (const eye of eyes) if (next[eye.key]) next[eye.key].converted = optics.convertVertex(next[eye.key].original, from, to);
    result = next;
    $("calcSummaryTitle").textContent = mode() === "custom" ? "Vertex optical equivalents" : mode() === "contactsToSpectacles" ? "Spectacle-plane optical equivalents" : "Contact-plane optical equivalents";
    $("calcSummaryPlanes").textContent = `${Number(from)} mm → ${Number(to)} mm from cornea · computed before lens selection`;
    for (const eye of eyes) {
      $("calcSummaryRow" + eye.suffix).hidden = !next[eye.key];
      $("calcEyeResults" + eye.suffix).hidden = !next[eye.key];
      if (next[eye.key]) renderEye(eye, next[eye.key], from, to);
    }
    $("calculatorError").textContent = "";
    $("calculatorStatus").textContent = "";
    $("calculatorEmpty").hidden = true;
    $("calculatorResults").hidden = false;
  }
  $("calculatorForm").addEventListener("submit", event => {
    event.preventDefault(); invalidate();
    try { show(readEyes()); } catch (error) { $("calculatorError").textContent = error.message; }
  });
  for (const eye of eyes) for (const id of ["calcSphere", "calcCylinder", "calcAxis"]) $(id + eye.suffix).addEventListener("input", invalidate);
  ["calcFromVertex", "calcToVertex"].forEach(id => $(id).addEventListener("input", invalidate));
  $("calcConversion").addEventListener("change", configureMode);
  $("calculatorPasteForm").addEventListener("submit", event => {
    event.preventDefault(); $("calculatorPasteError").textContent = "";
    try {
      const parsed = optics.parse($("calculatorPaste").value);
      const eye = eyes.find(e => e.key === $("calculatorPasteEye").value);
      setInputs(parsed.original, eye.suffix); invalidate(); show(readEyes());
    } catch (error) { $("calculatorPasteError").textContent = error.message; }
  });
  $("calculatorReset").addEventListener("click", () => {
    $("calculatorForm").reset(); $("calculatorPasteForm").reset();
    $("calculatorPasteError").textContent = ""; configureMode(); $("calcSphere").focus();
  });
  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); $("calculatorStatus").textContent = `${label} copied.`; }
    catch { $("calculatorStatus").textContent = "Clipboard unavailable. Select and copy the displayed result manually."; }
  }
  for (const eye of eyes) {
    $("useTransposed" + eye.suffix).addEventListener("click", () => {
      if (!result?.[eye.key]) return;
      setInputs(result[eye.key].transposed, eye.suffix); invalidate();
      try { show(readEyes()); } catch (error) { $("calculatorError").textContent = error.message; }
    });
    for (const [id, kind] of [["copyTransposed", "rx"], ["copySE", "se"], ["copyVertex", "vertex"]]) $(id + eye.suffix).addEventListener("click", () => {
      const r = result?.[eye.key]; if (!r) return;
      const text = kind === "rx" ? optics.formatRx(r.transposed) : kind === "se" ? `${f(r.roundedSE)} D` : `${eye.label}: ${displayRx(r.converted)} (${$("calcFromVertex").value} mm → ${$("calcToVertex").value} mm)`;
      copyText(text, kind === "rx" ? "Transposed Rx" : kind === "se" ? "Spherical equivalent" : "Conversion");
    });
  }
  $("copyBothVertex").addEventListener("click", () => {
    if (!result) return;
    const plane = `${$("calcFromVertex").value} mm → ${$("calcToVertex").value} mm`;
    const lines = eyes.filter(e => result[e.key]).map(e => `${e.label}: ${displayRx(result[e.key].converted)}`);
    copyText([`Optical equivalents (${plane})`, ...lines].join("\n"), "Conversion results");
  });
  configureMode();
})();
