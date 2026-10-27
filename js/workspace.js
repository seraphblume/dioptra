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
  function setInputs(rx) {
    $("calcSphere").value = optics.formatPower(rx.sphere);
    $("calcCylinder").value = optics.formatPower(rx.cylinder);
    $("calcAxis").value = rx.axis ?? "";
  }
  function show(next) {
    const from = $("calcFromVertex").value.trim().replace(",", ".");
    const to = $("calcToVertex").value.trim().replace(",", ".");
    const converted = optics.convertVertex(next.original, from, to);
    result = next;
    const { original: o, transposed: t, se } = next;
    const f = optics.formatPower;
    $("calculatorError").textContent = "";
    $("calculatorStatus").textContent = "";
    $("calculatorEmpty").hidden = true;
    $("calculatorResults").hidden = false;
    $("calcOriginal").textContent = optics.formatRx(o);
    $("calcTransposed").textContent = optics.formatRx(t);
    $("calcNotation").textContent = t.cylinder === 0 ? "Sphere only · axis not applicable" : t.cylinder < 0 ? "Minus-cylinder notation" : "Plus-cylinder notation";
    $("calcVertex").textContent = optics.formatRx({ ...converted,
      sphere: Math.round(converted.sphere * 100) / 100,
      cylinder: Math.round(converted.cylinder * 100) / 100 });
    $("calcVertexPlanes").textContent = `${Number(from)} mm → ${Number(to)} mm from cornea`;
    $("calcVertexMeridians").textContent = `Principal powers: ${converted.sphere.toFixed(2)} D / ${(converted.sphere + converted.cylinder).toFixed(2)} D`;
    $("calcSE").textContent = `${f(next.roundedSE)} D`;
    const rows = [
      ["Vertex formula (each meridian)", "F₂ = F₁ / [1 − ((source mm − target mm) / 1000) × F₁]"],
      ["Sphere + cylinder", `${f(o.sphere)} + (${f(o.cylinder)}) = ${f(t.sphere)} D`],
      ["Reverse cylinder sign", `${f(o.cylinder)} → ${f(t.cylinder)} D`],
      ["Rotate axis by 90°", o.axis === null ? "Not applicable to a spherical lens" : `${o.axis}° → ${t.axis}°`],
      ["Exact spherical equivalent", `${f(o.sphere)} + (${f(o.cylinder)} ÷ 2) = ${f(se)} D`],
      ["Nearest 0.25 D", `${f(se)} D → ${f(next.roundedSE)} D (halfway values toward more plus)`]
    ];
    $("calculatorMath").replaceChildren(...rows.flatMap(([label, value]) => {
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = value;
      return [dt, dd];
    }));
    $("calculatorRounding").textContent = next.lowerQuarter === next.upperQuarter
      ? "Already an exact 0.25 D increment."
      : `Adjacent 0.25 D values: ${f(next.lowerQuarter)} D (more minus) and ${f(next.upperQuarter)} D (more plus).`;
  }
  $("calculatorForm").addEventListener("submit", event => {
    event.preventDefault();
    invalidate();
    try { show(optics.calculate($("calcSphere").value, $("calcCylinder").value, $("calcAxis").value)); }
    catch (error) { $("calculatorError").textContent = error.message; }
  });
  ["calcSphere", "calcCylinder", "calcAxis", "calcFromVertex", "calcToVertex"].forEach(id => $(id).addEventListener("input", invalidate));
  $("calculatorPasteForm").addEventListener("submit", event => {
    event.preventDefault();
    $("calculatorPasteError").textContent = "";
    try {
      const parsed = optics.parse($("calculatorPaste").value);
      setInputs(parsed.original);
      show(parsed);
    } catch (error) { $("calculatorPasteError").textContent = error.message; }
  });
  $("calculatorReset").addEventListener("click", () => {
    $("calculatorForm").reset();
    $("calculatorPasteForm").reset();
    $("calculatorPasteError").textContent = "";
    invalidate();
    $("calcSphere").focus();
  });
  $("useTransposed").addEventListener("click", () => {
    if (!result) return;
    const rx = result.transposed;
    setInputs(rx);
    show(optics.calculate(rx.sphere, rx.cylinder, rx.axis));
  });
  async function copy(kind) {
    if (!result) return;
    const text = kind === "rx" ? optics.formatRx(result.transposed) : `${optics.formatPower(result.roundedSE)} D`;
    try {
      await navigator.clipboard.writeText(text);
      $("calculatorStatus").textContent = `${kind === "rx" ? "Transposed Rx" : "Spherical equivalent"} copied.`;
    } catch {
      $("calculatorStatus").textContent = "Clipboard unavailable. Select and copy the displayed result manually.";
    }
  }
  $("copyTransposed").addEventListener("click", () => copy("rx"));
  $("copySE").addEventListener("click", () => copy("se"));
})();
