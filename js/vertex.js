/* Vertex compensation: distances in mm from the cornea, powers in diopters. */
(function (root) {
  "use strict";
  function distance(value) {
    if (value === null || value === undefined || String(value).trim() === "" ||
        !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 25) {
      throw new Error("Enter a vertex distance from 0 to 25 mm (0 = corneal plane).");
    }
    return Number(value);
  }
  function effectivePower(power, fromMm, toMm) {
    const d = (distance(fromMm) - distance(toMm)) / 1000;
    if (!Number.isFinite(power)) throw new Error("Enter a finite lens power.");
    const denominator = 1 - d * power;
    if (denominator <= 1e-9) throw new Error("This power and distance combination cannot be converted across the focal plane.");
    return power / denominator;
  }
  function convertVertex(rx, fromMm, toMm) {
    const from = distance(fromMm), to = distance(toMm);
    if (!Number.isFinite(rx.sphere) || !Number.isFinite(rx.cylinder)) throw new Error("Enter finite sphere and cylinder powers.");
    if (Math.abs(from - to) < 1e-9) return { ...rx };
    const sphere = effectivePower(rx.sphere, from, to);
    const perpendicular = effectivePower(rx.sphere + rx.cylinder, from, to);
    return { sphere, cylinder: perpendicular - sphere, axis: rx.axis };
  }
  const api = Object.freeze({ effectivePower, convertVertex });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DioptraVertex = api;
})(typeof window !== "undefined" ? window : globalThis);
