#!/usr/bin/env node
const assert = require("node:assert/strict");
const { calculate, parse, formatPower, formatRx } = require("../js/optical-calculators.js");

const examples = [
  [-2, 3, 90, 1, -3, 180, -0.5],
  [-8, 4, 10, -4, -4, 100, -6],
  [3, -3, 90, 0, 3, 180, 1.5],
  [2, 3, 70, 5, -3, 160, 3.5],
  [0, 4, 85, 4, -4, 175, 2],
  [-1.5, -1.25, 180, -2.75, 1.25, 90, -2.125],
  [0, 0.25, 1, 0.25, -0.25, 91, 0.125],
  [0, -0.25, 91, -0.25, 0.25, 1, -0.125]
];
for (const [s, c, a, ts, tc, ta, se] of examples) {
  const r = calculate(s, c, a);
  assert.deepEqual(r.transposed, { sphere: ts, cylinder: tc, axis: ta });
  assert.equal(r.se, se);
}
for (const s of [-10.37, -2, 0, 1.13, 10]) {
  for (const c of [-4, -1.25, 0, 0.37, 3]) {
    for (let a = 1; a <= 180; a++) {
      const r = calculate(s, c, a);
      const t = r.transposed;
      const roundTrip = calculate(t.sphere, t.cylinder, t.axis);
      assert.deepEqual(roundTrip.transposed, r.original);
      assert.equal(roundTrip.se, r.se);
      assert.equal(roundTrip.roundedSE, r.roundedSE);
      assert.equal(r.roundedSE * 4, Math.round(r.roundedSE * 4));
      assert.ok(Math.abs(r.roundedSE - r.se) <= 0.125 + 1e-10);
      assert.ok(r.lowerQuarter <= r.se && r.se <= r.upperQuarter);
      assert.ok(Math.abs(r.upperQuarter - r.lowerQuarter) <= 0.25);
    }
  }
}
assert.equal(formatPower(-2.125), "-2.125");
assert.equal(formatPower(-0), "0.00");
assert.equal(formatPower(0.005), "+0.005");
assert.equal(formatRx(calculate("0", "0", "").transposed), "0.00 DS");
assert.equal(calculate("1.13", "0", "").lowerQuarter, 1);
assert.equal(calculate("1.13", "0", "").upperQuarter, 1.25);
assert.equal(calculate(-1.5, -1.25, 180).lowerQuarter, -2.25);
assert.equal(calculate(-1.5, -1.25, 180).upperQuarter, -2);
for (const [s, c, expected] of [[-1.5, -1.25, -2], [1.5, 1.25, 2.25], [0, -.25, 0], [0, .25, .25], [-2.12, 0, -2], [-2.13, 0, -2.25], [2.12, 0, 2], [2.13, 0, 2.25], [-2.25, 0, -2.25]]) {
  assert.equal(calculate(s, c, 90).roundedSE, expected);
}
assert.deepEqual(parse("−2,00 +3,00 × 090°"), calculate(-2, 3, 90));
assert.deepEqual(parse("plano ⌢ -.50 x 180"), calculate(0, -.5, 180));
assert.deepEqual(parse("-1.25 x 90"), calculate(0, -1.25, 90));
assert.deepEqual(parse("neutro"), calculate(0, 0, null));
assert.deepEqual(parse("-2.00 DS"), calculate(-2, 0, null));
for (const s of ["", " ", null, NaN, Infinity, "1e2", "1.234", "abc", 101]) assert.throws(() => calculate(s, 0, ""));
for (const c of ["", null, NaN, 21]) assert.throws(() => calculate(0, c, 90));
for (const a of ["", null, 0, -1, 181, 90.5, "90garbage", Infinity]) assert.throws(() => calculate(0, 1, a));
assert.throws(() => calculate(99, 2, 90));
for (const text of ["", "OD -2 -1 x90", "1 2 x999", "1 2 x0", "1 2 x90 junk", "1e2", "1.234 2 x90"]) assert.throws(() => parse(text));
console.log("Optical calculators: examples, 4,500 round trips, exact SE, boundaries, strict parsing and invalid inputs passed.");

const vertex = require("../js/vertex.js");
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
// Independently calculated exact 12 mm examples, and the photographed table's coarse values.
close(vertex.effectivePower(-10, 12, 0), -8.928571428571429);
close(vertex.effectivePower(10, 12, 0), 11.363636363636363);
for (const [spectacle, corneal] of [[-4, -3.87], [-7.62, -7], [-10, -9], [-20.37, -16.37]]) {
  close(vertex.effectivePower(spectacle, 12, 0), corneal, .13);
}
for (const sphere of [-20, -8, 0, 4, 12]) for (const cylinder of [-4, 0, 2]) {
  const rx = { sphere, cylinder, axis: cylinder ? 73 : null };
  const converted = vertex.convertVertex(rx, 12, 0);
  close(converted.sphere, sphere / (1 - .012 * sphere));
  close(converted.sphere + converted.cylinder, (sphere + cylinder) / (1 - .012 * (sphere + cylinder)));
  assert.equal(converted.axis, rx.axis);
  const back = vertex.convertVertex(converted, 0, 12);
  close(back.sphere, sphere); close(back.cylinder, cylinder);
  assert.deepEqual(vertex.convertVertex(rx, 12, 12), rx);
}
for (const bad of [null, undefined, "", " ", -1, 26, NaN, Infinity]) {
  assert.throws(() => vertex.effectivePower(-8, bad, 0));
  assert.throws(() => vertex.effectivePower(-8, 12, bad));
}
assert.throws(() => vertex.effectivePower(100, 12, 0), /focal plane/);
assert.throws(() => vertex.effectivePower(Infinity, 12, 0));
assert.throws(() => vertex.convertVertex({sphere: 0, cylinder: NaN}, 12, 12));
assert.equal(require("../js/optical-calculators.js").convertVertex, vertex.convertVertex);
console.log("PASS: vertex exact examples, approximate photographed table, meridians, inverse conversion, unchanged axis and invalid inputs");
