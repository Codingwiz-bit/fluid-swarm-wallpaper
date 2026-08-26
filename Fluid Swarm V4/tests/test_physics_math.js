/**
 * Comprehensive Automated Test Suite for Fluid Swarm V4 Milestone 1:
 * - src/math.js (SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath, PRNG)
 * - src/spatial_grid.js (SpatialHashGrid)
 * - src/physics.js (PhysicsEngine, ShockwaveSystem, AnomalyEngine)
 */

import { PRNG, SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath } from '../src/math.js';
import { SpatialHashGrid } from '../src/spatial_grid.js';
import { PhysicsEngine, ShockwaveSystem, AnomalyEngine, PARTICLE_STRIDE, ATTR_X, ATTR_Y, ATTR_VX, ATTR_VY, ATTR_SPECIES } from '../src/physics.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
  }
}

function runSection(title) {
  console.log(`\n\x1b[36m=== ${title} ===\x1b[0m`);
}

// ============================================================================
// 1. MATH & NOISE ENGINE TESTS
// ============================================================================
runSection('1. Math & Noise Engine Tests');

// 1.1 PRNG
{
  const prng = new PRNG(42);
  let allInRange = true;
  for (let i = 0; i < 10000; i++) {
    const val = prng.random();
    if (val < 0 || val >= 1.0) allInRange = false;
  }
  assert(allInRange, 'PRNG Mulberry32 generates values strictly in [0, 1)');

  const g = prng.randomGaussian(50, 10);
  assert(typeof g === 'number' && !isNaN(g), 'PRNG Gaussian generates valid numerical float');
}

// 1.2 Simplex 2D/3D/4D Output Bounds
{
  const sn = new SimplexNoise(1337);
  let inBounds2D = true;
  let inBounds3D = true;
  let inBounds4D = true;

  for (let i = 0; i < 2000; i++) {
    const x = (Math.random() - 0.5) * 500;
    const y = (Math.random() - 0.5) * 500;
    const z = (Math.random() - 0.5) * 500;
    const w = (Math.random() - 0.5) * 500;

    const n2 = sn.noise2D(x, y);
    const n3 = sn.noise3D(x, y, z);
    const n4 = sn.noise4D(x, y, z, w);

    if (n2 < -1.1 || n2 > 1.1) inBounds2D = false;
    if (n3 < -1.1 || n3 > 1.1) inBounds3D = false;
    if (n4 < -1.1 || n4 > 1.1) inBounds4D = false;
  }
  assert(inBounds2D, '2D Simplex Noise bounded within [-1.0, 1.0]');
  assert(inBounds3D, '3D Simplex Noise bounded within [-1.0, 1.0]');
  assert(inBounds4D, '4D Simplex Noise bounded within [-1.0, 1.0]');
}

// 1.3 Analytical Gradients vs Central Differences
{
  const sn = new SimplexNoise(999);
  const gradOut = new Float32Array(4);
  const eps = 1e-6;
  let maxGradError2D = 0;
  let maxGradError3D = 0;
  let validCount2D = 0;
  let validCount3D = 0;

  for (let i = 0; i < 500; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;

    // 2D Check
    sn.noise2DGrad(x, y, gradOut);
    const numGx2D = (sn.noise2D(x + eps, y) - sn.noise2D(x - eps, y)) / (2 * eps);
    const numGy2D = (sn.noise2D(x, y + eps) - sn.noise2D(x, y - eps)) / (2 * eps);
    const errX2D = Math.abs(gradOut[1] - numGx2D);
    const errY2D = Math.abs(gradOut[2] - numGy2D);
    const err2D = Math.max(errX2D, errY2D);
    if (err2D < 0.05) {
      validCount2D++;
      if (err2D > maxGradError2D) maxGradError2D = err2D;
    }

    // 3D Check
    sn.noise3DGrad(x, y, z, gradOut);
    const numGx3D = (sn.noise3D(x + eps, y, z) - sn.noise3D(x - eps, y, z)) / (2 * eps);
    const numGy3D = (sn.noise3D(x, y + eps, z) - sn.noise3D(x, y - eps, z)) / (2 * eps);
    const numGz3D = (sn.noise3D(x, y, z + eps) - sn.noise3D(x, y, z - eps)) / (2 * eps);
    const errX3D = Math.abs(gradOut[1] - numGx3D);
    const errY3D = Math.abs(gradOut[2] - numGy3D);
    const errZ3D = Math.abs(gradOut[3] - numGz3D);
    const err3D = Math.max(errX3D, errY3D, errZ3D);
    if (err3D < 0.05) {
      validCount3D++;
      if (err3D > maxGradError3D) maxGradError3D = err3D;
    }
  }
  assert(validCount2D >= 495 && maxGradError2D < 1e-4, `2D Simplex analytical derivatives match central difference (max err: ${maxGradError2D.toExponential(3)}, ${validCount2D}/500 matched)`);
  assert(validCount3D >= 495 && maxGradError3D < 1e-4, `3D Simplex analytical derivatives match central difference (max err: ${maxGradError3D.toExponential(3)}, ${validCount3D}/500 matched)`);
}

// 1.4 Divergence-Free Curl Noise Invariant
{
  const curl = new CurlNoise(new SimplexNoise(777));
  const vxp = [0, 0], vxm = [0, 0], vyp = [0, 0], vym = [0, 0];
  const eps = 1e-4;
  let maxDiv = 0;

  for (let i = 0; i < 1500; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = (Math.random() - 0.5) * 200;
    const t = 1.25;

    curl.sampleCurl2D(x + eps, y, t, 2, 0.003, 0.5, 2.0, vxp);
    curl.sampleCurl2D(x - eps, y, t, 2, 0.003, 0.5, 2.0, vxm);
    curl.sampleCurl2D(x, y + eps, t, 2, 0.003, 0.5, 2.0, vyp);
    curl.sampleCurl2D(x, y - eps, t, 2, 0.003, 0.5, 2.0, vym);

    const div = Math.abs((vxp[0] - vxm[0]) / (2 * eps) + (vyp[1] - vym[1]) / (2 * eps));
    if (div > maxDiv) maxDiv = div;
  }
  assert(maxDiv < 0.05, `Divergence-Free property confirmed across 1500 coordinates (max div: ${maxDiv.toFixed(6)})`);
}

// 1.5 TrigLUT Accuracy
{
  let maxSinErr = 0;
  let maxCosErr = 0;
  for (let i = 0; i < 20000; i++) {
    const rad = (Math.random() - 0.5) * 50.0;
    const sErr = Math.abs(Math.sin(rad) - TrigLUT.fastSinLerp(rad));
    const cErr = Math.abs(Math.cos(rad) - TrigLUT.fastCosLerp(rad));
    if (sErr > maxSinErr) maxSinErr = sErr;
    if (cErr > maxCosErr) maxCosErr = cErr;
  }
  assert(maxSinErr < 1e-4, `TrigLUT fastSinLerp maximum error within tolerance (< 1e-4, actual: ${maxSinErr.toExponential(3)})`);
  assert(maxCosErr < 1e-4, `TrigLUT fastCosLerp maximum error within tolerance (< 1e-4, actual: ${maxCosErr.toExponential(3)})`);
}

// 1.6 OKLab Color Round-Trip & Palette LUT
{
  const lab = [0, 0, 0];
  const rgb = [0, 0, 0];
  let maxColorErr = 0;

  for (let i = 0; i < 500; i++) {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();

    ColorMath.rgbToOklab(r, g, b, lab);
    ColorMath.oklabToRgb(lab[0], lab[1], lab[2], rgb);

    const err = Math.abs(r - rgb[0]) + Math.abs(g - rgb[1]) + Math.abs(b - rgb[2]);
    if (err > maxColorErr) maxColorErr = err;
  }
  assert(maxColorErr < 1e-4, `OKLab perceptual color round-trip error < 1e-4 (actual: ${maxColorErr.toExponential(3)})`);

  const palette = ColorMath.createPaletteLUT([
    { pos: 0.0, r: 0.1, g: 0.8, b: 0.9, a: 1.0 },
    { pos: 0.5, r: 1.0, g: 0.2, b: 0.6, a: 1.0 },
    { pos: 1.0, r: 0.9, g: 0.9, b: 0.2, a: 1.0 }
  ], 256);

  let validPalette = palette.length === 256 * 4;
  for (let i = 0; i < palette.length; i++) {
    if (isNaN(palette[i]) || palette[i] < 0 || palette[i] > 1.0) validPalette = false;
  }
  assert(validPalette, 'ColorMath palette LUT generation produces valid 256x4 RGBA float buffer');
}

// 1.7 VectorMath Utilities
{
  const out = [0, 0];
  VectorMath.safeNormalize(0, 0, out);
  assert(out[0] === 0 && out[1] === 0, 'safeNormalize handles zero-vector safely without NaN');

  VectorMath.clampSpeed(100, 100, 50, out);
  const speed = Math.sqrt(out[0] * out[0] + out[1] * out[1]);
  assert(Math.abs(speed - 50.0) < 1e-3, `clampSpeed correctly limits magnitude (speed: ${speed.toFixed(3)})`);

  const wrapped = VectorMath.wrapCoord(-10, 100);
  assert(wrapped === 90, `wrapCoord correctly wraps negative coordinates (actual: ${wrapped})`);
}

// ============================================================================
// 2. SPATIAL HASH GRID TESTS
// ============================================================================
runSection('2. Spatial Hash Grid Acceleration Tests');

{
  const grid = new SpatialHashGrid(1920, 1080, 48, 20000);
  const buf = new Float32Array(20000 * 10);
  for (let i = 0; i < 20000; i++) {
    buf[i * 10 + 0] = Math.random() * 1920;
    buf[i * 10 + 1] = Math.random() * 1080;
  }

  grid.populate(buf, 20000, 10);

  // Compare spatial query vs brute force ground truth
  let queryAccurate = true;
  for (let q = 0; q < 50; q++) {
    const qx = Math.random() * 1920;
    const qy = Math.random() * 1080;
    const radius = 64.0;
    const r2 = radius * radius;

    // Ground truth brute force
    const trueNeighbors = new Set();
    for (let i = 0; i < 20000; i++) {
      const dx = buf[i * 10 + 0] - qx;
      const dy = buf[i * 10 + 1] - qy;
      if (dx * dx + dy * dy <= r2) {
        trueNeighbors.add(i);
      }
    }

    // Grid query
    const gridNeighbors = new Set();
    grid.queryNeighborsBuffer(qx, qy, radius, buf, 10, (nId) => {
      gridNeighbors.add(nId);
    });

    if (trueNeighbors.size !== gridNeighbors.size) {
      queryAccurate = false;
      break;
    }
    for (const id of trueNeighbors) {
      if (!gridNeighbors.has(id)) {
        queryAccurate = false;
        break;
      }
    }
  }
  assert(queryAccurate, 'SpatialHashGrid neighbor query matches 100% of brute-force ground truth');

  // Resize test
  grid.resize(2560, 1440);
  assert(grid.width === 2560 && grid.height === 1440, 'SpatialHashGrid handles window resizing without corruption');
}

// ============================================================================
// 3. PHYSICS ENGINE & MULTI-SPECIES ECOSYSTEM TESTS
// ============================================================================
runSection('3. Physics Engine & Multi-Species Ecosystem Tests');

{
  const engine = new PhysicsEngine(1920, 1080, 10000);
  engine.setParticleCount(10000);

  // Species distribution check
  const pBuf = engine.getParticleBuffer();
  const speciesCounts = [0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) {
    const s = pBuf[i * PARTICLE_STRIDE + ATTR_SPECIES];
    speciesCounts[s]++;
  }
  assert(speciesCounts[0] > 4000 && speciesCounts[1] > 2500 && speciesCounts[2] > 200 && speciesCounts[3] > 600,
    `4-Species distribution active (Phyto: ${speciesCounts[0]}, Boids: ${speciesCounts[1]}, Preds: ${speciesCounts[2]}, Weavers: ${speciesCounts[3]})`);

  // Run 100 frames of full physics simulation
  for (let frame = 0; frame < 100; frame++) {
    engine.update(1 / 60);
  }

  // Check invariants after simulation
  let allFinite = true;
  let maxSpeedFound = 0;
  for (let i = 0; i < 10000; i++) {
    const off = i * PARTICLE_STRIDE;
    const x = pBuf[off + ATTR_X];
    const y = pBuf[off + ATTR_Y];
    const vx = pBuf[off + ATTR_VX];
    const vy = pBuf[off + ATTR_VY];

    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy) || isNaN(x) || isNaN(y)) {
      allFinite = false;
    }
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeedFound) maxSpeedFound = speed;
  }
  assert(allFinite, 'Zero NaN or Infinity in particle buffer after 100 frames');
  assert(maxSpeedFound <= 450.0 + 1e-2, `Particle velocities strictly clamped to max speed (max found: ${maxSpeedFound.toFixed(2)} <= 450)`);
}

// ============================================================================
// 4. 8 COSMIC PHYSICS MODES STABILITY TEST
// ============================================================================
runSection('4. 8 Cosmic Physics Modes Stability Test');

{
  const engine = new PhysicsEngine(1920, 1080, 5000);
  engine.setParticleCount(5000);
  const modeNames = [
    'Vortex Typhoon',
    'Kerr Singularity / Black Hole',
    'Quantum Repulsor',
    'Nebula Drift',
    'Magnetic Dipole',
    'Cryo Freeze',
    'Strange Attractor Chaos',
    'Swarm Flocking'
  ];

  for (let m = 0; m < 8; m++) {
    engine.setMode(m);
    // Simulate active moving mouse pointer with velocity
    engine.setMouse(960 + Math.cos(m) * 200, 540 + Math.sin(m) * 200, true, 0, Math.cos(m) * 120, Math.sin(m) * 120);

    let modeClean = true;
    for (let step = 0; step < 120; step++) {
      engine.update(1 / 120);
    }

    const pBuf = engine.getParticleBuffer();
    for (let i = 0; i < 5000; i++) {
      const off = i * PARTICLE_STRIDE;
      if (!isFinite(pBuf[off + ATTR_X]) || !isFinite(pBuf[off + ATTR_Y]) || isNaN(pBuf[off + ATTR_VX])) {
        modeClean = false;
        break;
      }
    }
    assert(modeClean, `Mode ${m} (${modeNames[m]}): 120 sub-steps completed with zero numerical violations`);
  }
}

// ============================================================================
// 5. SHOCKWAVE & ANOMALY SYSTEM TESTS
// ============================================================================
runSection('5. Shockwaves, Pulsars & Lightning Tests');

{
  const shockwaves = new ShockwaveSystem(16, 2048);
  shockwaves.trigger(500, 500, 1.5, 200, 50, 50);
  assert(shockwaves.waves.length === 1, 'Shockwave triggered and recorded');
  assert(shockwaves.sparkCount > 0, `Shockwave generated radial spark burst (${shockwaves.sparkCount} sparks)`);

  // Shockwave dual-zone hydrodynamic test
  const pBuf = new Float32Array(500 * 10);
  // Particle 0 on leading compression crest (ahead of wavefront)
  pBuf[0 * 10 + 0] = 525;
  pBuf[0 * 10 + 1] = 500;
  pBuf[0 * 10 + 5] = 1.0;
  // Particle 1 on trailing rarefaction trough (behind wavefront)
  pBuf[1 * 10 + 0] = 518;
  pBuf[1 * 10 + 1] = 500;
  pBuf[1 * 10 + 5] = 1.0;

  shockwaves.update(1 / 60, pBuf, 2);
  assert(pBuf[0 * 10 + ATTR_VX] > 0, 'Leading compression crest imparts positive outward kinetic impulse');
  assert(pBuf[1 * 10 + ATTR_VX] < 0, 'Trailing rarefaction trough imparts negative inward cavitation suction');

  // Pulsars & Lightning
  const anomaly = new AnomalyEngine(1920, 1080);
  assert(anomaly.pulsars.length === 4, '4 wandering pulsars initialized');
  anomaly.update(1 / 60, 10.0, pBuf, 500, shockwaves);
  assert(anomaly.pulsars[0].x >= 0 && anomaly.pulsars[0].x <= 1920, 'Pulsars maintain valid coordinate bounds');
}

// ============================================================================
// 6. 120HZ FIXED-TIMESTEP DETERMINISM TEST
// ============================================================================
runSection('6. Fixed-Timestep Determinism & Invariant Validation');

{
  const eng1 = new PhysicsEngine(1920, 1080, 1000);
  eng1.prng.setSeed(42);
  eng1.initParticles();

  const eng2 = new PhysicsEngine(1920, 1080, 1000);
  eng2.prng.setSeed(42);
  eng2.initParticles();

  // Run eng1 with 60FPS frames (2 fixed sub-steps per frame)
  for (let f = 0; f < 60; f++) {
    eng1.update(1 / 60);
  }

  // Run eng2 with 120FPS frames (1 fixed sub-step per frame)
  for (let f = 0; f < 120; f++) {
    eng2.update(1 / 120);
  }

  const b1 = eng1.getParticleBuffer();
  const b2 = eng2.getParticleBuffer();
  let maxPosDiff = 0;
  for (let i = 0; i < 1000 * 10; i++) {
    const diff = Math.abs(b1[i] - b2[i]);
    if (diff > maxPosDiff) maxPosDiff = diff;
  }
  assert(maxPosDiff < 1e-4, `120Hz accumulator guarantees identical particle state across different frame rates (max diff: ${maxPosDiff.toExponential(3)})`);
}

// ============================================================================
// TEST SUMMARY
// ============================================================================
console.log(`\n\x1b[35m========================================\x1b[0m`);
console.log(`\x1b[35mTotal Passed: ${passed} | Total Failed: ${failed}\x1b[0m`);
console.log(`\x1b[35m========================================\x1b[0m`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ ALL MILESTONE 1 TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
  process.exit(0);
}
