/* Standalone optical arithmetic. No engine, storage, or patient-case dependencies. */
(function (root) {
  "use strict";
  const clean = value => String(value ?? "").trim().replace(/[−–]/g, "-").replace(/,/g, ".");
  const decimal = /^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

  function power(value, name) {
    const text = clean(value);
    if (!decimal.test(text)) throw new Error(`Enter ${name} as a signed number with up to two decimals.`);
    const cents = Math.round(Number(text) * 100);
    if (!Number.isSafeInteger(cents)) throw new Error(`Enter a finite ${name} value.`);
    return cents === 0 ? 0 : cents;
  }

  function calculate(sphere, cylinder, axis) {
    const s = power(sphere, "sphere");
    const c = power(cylinder, "cylinder (use 0 for sphere only)");
    if (Math.abs(s) > 10000 || Math.abs(s + c) > 10000 || Math.abs(c) > 2000) {
      throw new Error("Sphere and transposed sphere must be within ±100 D; cylinder within ±20 D.");
    }
    let a = null;
    if (c !== 0) {
      const text = clean(axis);
      if (!/^\d{1,3}$/.test(text) || Number(text) < 1 || Number(text) > 180) {
        throw new Error("Enter a whole-number axis from 1° to 180° for a nonzero cylinder.");
      }
      a = Number(text);
    }
    // Integer hundredths keep transposition exact. SE can have a half-cent diopter.
    const twiceSE = 2 * s + c;
    return {
      original: { sphere: s / 100, cylinder: c / 100, axis: a },
      transposed: { sphere: (s + c) / 100, cylinder: c === 0 ? 0 : -c / 100, axis: a === null ? null : a <= 90 ? a + 90 : a - 90 },
      se: twiceSE / 200,
      lowerQuarter: Math.floor(twiceSE / 50) / 4,
      upperQuarter: Math.ceil(twiceSE / 50) / 4
    };
  }

  function parse(text) {
    const input = clean(text).replace(/⌢/g, " ").replace(/\b(?:plano|neutro|pl)\b/gi, "0.00");
    const p = "([+-]?(?:\\d+(?:\\.\\d{1,2})?|\\.\\d{1,2}))";
    let match = input.match(new RegExp(`^${p}\\s+${p}\\s*[xX×*]\\s*(\\d{1,3})°?$`));
    if (match) return calculate(match[1], match[2], match[3]);
    match = input.match(new RegExp(`^${p}\\s*[xX×*]\\s*(\\d{1,3})°?$`));
    if (match) return calculate("0", match[1], match[2]);
    match = input.match(new RegExp(`^${p}(?:\\s*(?:DS|SPH|ESF))?$`, "i"));
    if (match) return calculate(match[1], "0", "");
    throw new Error("Use sphere cylinder × axis (−2.00 +3.00 × 90), or a sphere-only value.");
  }

  function formatPower(value) {
    const rounded = Math.round(value * 1000) / 1000;
    const digits = Math.abs(rounded * 100 - Math.round(rounded * 100)) > 1e-8 ? 3 : 2;
    return `${rounded > 0 ? "+" : ""}${(rounded === 0 ? 0 : rounded).toFixed(digits)}`;
  }
  function formatRx(rx) {
    if (rx.cylinder === 0) return `${formatPower(rx.sphere)} DS`;
    return `${formatPower(rx.sphere)} ${formatPower(rx.cylinder)} × ${String(rx.axis).padStart(3, "0")}°`;
  }
  const api = Object.freeze({ calculate, parse, formatPower, formatRx });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DioptraOptics = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
