#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/config.js"), "utf8"), sandbox, { filename: "js/config.js" });
vm.runInContext(fs.readFileSync(path.join(root, "js/algorithm.js"), "utf8"), sandbox, { filename: "js/algorithm.js" });

const cfg = sandbox.window.DIOPTRA_CONFIG;
const alg = sandbox.window.DioptraAlgorithm;
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/v0.2-freeze-cases.json"), "utf8"));
const EPS = 1e-9;

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= EPS, `${message}: ${actual} !== ${expected}`);
}

assert.equal(cfg.version, "0.2.0");
near(cfg.heuristics.sphereOffset, -0.25, "sphere offset");
assert.equal(cfg.heuristics.preserveCylinder, true);
assert.equal(cfg.heuristics.preserveAxis, true);
near(cfg.powerStep, 0.25, "power step");
near(cfg.axisStep, 5, "axis step");
near(cfg.seGuardrail.maxAutomaticShift, 0.25, "SE budget");
assert.deepEqual(
  JSON.parse(JSON.stringify(cfg.tentativeAdd)),
  [
    { minAge: 33, maxAge: 37, myopiaEmmetropia: 0, lowHyperopia: 0, higherHyperopia: 0.75 },
    { minAge: 38, maxAge: 43, myopiaEmmetropia: 0, lowHyperopia: 0.75, higherHyperopia: 1.25 },
    { minAge: 44, maxAge: 49, myopiaEmmetropia: 0.75, lowHyperopia: 1.25, higherHyperopia: 1.75 },
    { minAge: 50, maxAge: 56, myopiaEmmetropia: 1.25, lowHyperopia: 1.75, higherHyperopia: 2.25 },
    { minAge: 57, maxAge: 62, myopiaEmmetropia: 1.75, lowHyperopia: 2.25, higherHyperopia: 2.5 },
    { minAge: 63, maxAge: 120, myopiaEmmetropia: 2.25, lowHyperopia: 2.5, higherHyperopia: 2.5 }
  ]
);

assert.equal(alg.axisDistance(180, 5), 5);
assert.equal(alg.axisDistance(1, 179), 2);
assert.equal(alg.quantizeAxis(178), 180);

for (const fixture of fixtures) {
  const prediction = alg.predictCase(fixture.input);
  assert.equal(prediction.version, "0.2.0", fixture.name);

  if (fixture.expected) {
    for (const eye of ["od", "os"]) {
      assert.equal(prediction[eye].sphere, fixture.expected[eye].sphere, `${fixture.name} ${eye} sphere`);
      assert.equal(prediction[eye].cylinder, fixture.expected[eye].cylinder, `${fixture.name} ${eye} cylinder`);
      assert.equal(prediction[eye].axis, fixture.expected[eye].axis, `${fixture.name} ${eye} axis`);
      near(prediction[eye].seShiftFromAR, fixture.expected[eye].seShiftFromAR, `${fixture.name} ${eye} SE shift`);
    }
    assert.equal(prediction.tentativeAdd, fixture.expected.tentativeAdd, `${fixture.name} ADD`);
  }

  if (fixture.maximumAbsoluteSeShift != null) {
    for (const eye of ["od", "os"]) {
      assert.ok(
        Math.abs(prediction[eye].seShiftFromAR) <= fixture.maximumAbsoluteSeShift + EPS,
        `${fixture.name} ${eye} exceeded SE budget`
      );
    }
  }
}

const vaA = alg.predictCase({
  age: 25,
  od: { sphere: -2, cylinder: -1, axis: 90, va: "20/400", pinhole: "20/20" },
  os: { sphere: -2, cylinder: -1, axis: 90, va: "20/400", pinhole: "20/20" }
});
const vaB = alg.predictCase({
  age: 25,
  od: { sphere: -2, cylinder: -1, axis: 90, va: "20/20", pinhole: "20/400" },
  os: { sphere: -2, cylinder: -1, axis: 90, va: "20/20", pinhole: "20/400" }
});
for (const eye of ["od", "os"]) {
  assert.equal(vaA[eye].sphere, vaB[eye].sphere, `${eye} VA/pinhole changed sphere`);
  assert.equal(vaA[eye].cylinder, vaB[eye].cylinder, `${eye} VA/pinhole changed cylinder`);
  assert.equal(vaA[eye].axis, vaB[eye].axis, `${eye} VA/pinhole changed axis`);
}

console.log(`PASS: v0.2 freeze contract (${fixtures.length} fixtures)`);
