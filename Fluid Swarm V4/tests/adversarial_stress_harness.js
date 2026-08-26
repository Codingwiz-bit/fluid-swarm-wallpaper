/**
 * Fluid Swarm V4 - Adversarial Stress & Chaos Test Harness
 * Author: teamwork_preview_challenger_m1_1 (EMPIRICAL CHALLENGER)
 * Target Modules:
 *   - src/math.js
 *   - src/spatial_grid.js
 *   - src/physics.js
 * 
 * Tests extreme boundary conditions, mathematical singularities (r -> 0),
 * massive shockwave & spark cascades, 100,000 particles at extreme FPS (1 FPS to 1000 FPS),
 * NaN/Infinity poisoning, memory allocations, and numerical invariants.
 */

import { PRNG, SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath, globalPRNG } from '../src/math.js';
import { SpatialHashGrid } from '../src/spatial_grid.js';
import {
  PhysicsEngine,
  ShockwaveSystem,
  AnomalyEngine,
  PARTICLE_STRIDE,
  ATTR_X,
  ATTR_Y,
  ATTR_VX,
  ATTR_VY,
  ATTR_SIZE,
  ATTR_MASS,
  ATTR_LIFE,
  ATTR_MAX_LIFE,
  ATTR_SPECIES,
  ATTR_ENERGY
} from '../src/physics.js';

let passedTotal = 0;
let failedTotal = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedTotal++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    failedTotal++;
    const errMsg = `  \x1b[31m✖ FAIL\x1b[0m: ${testName}${details ? ` -> ${details}` : ''}`;
    console.error(errMsg);
    failures.push(errMsg);
  }
}

function runSection(title) {
  console.log(`\n\x1b[35m======================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[33m>>> ${title}\x1b[0m`);
  console.log(`\x1b[35m======================================================================\x1b[0m`);
}

// ============================================================================
// 1. ADVERSARIAL STRESS: MATH & PRNG BOUNDARIES
// ============================================================================
runSection('1. Math, Noise & PRNG Adversarial Boundary Tests');

// 1.1 PRNG Extreme Seeds & Boundary Distributions
{
  const prngSeeds = [0, -1, -999999, 4294967295, 0x100000000, 3.14159, NaN, Infinity, -Infinity];
  let allSeedsHandled = true;
  for (const s of prngSeeds) {
    try {
      const p = new PRNG(s);
      const val = p.random();
      if (typeof val !== 'number' || isNaN(val) || val < 0 || val >= 1.0) {
        allSeedsHandled = false;
      }
      p.randomRange(100, -100); // Inverted range
      p.randomInt(50, 10);      // Inverted integer range
      p.randomGaussian(0, 0);   // Zero stdDev
      p.randomGaussian(-1000, -50); // Negative stdDev
    } catch (e) {
      allSeedsHandled = false;
    }
  }
  assert(allSeedsHandled, 'PRNG handles extreme seeds (0, negative, float, NaN, Inf, inverted ranges) without throwing');
}

// 1.2 SimplexNoise Extreme Coordinates & Float Limits
{
  const sn = new SimplexNoise(42);
  const extremeCoords = [
    0, -0, 1e-15, -1e-15, 1e6, -1e6, 1e12, -1e12, 1e20, -1e20
  ];
  let simplexFinite = true;
  for (const c of extremeCoords) {
    const n2 = sn.noise2D(c, -c);
    const n3 = sn.noise3D(c, -c, c * 0.5);
    const n4 = sn.noise4D(c, -c, c * 0.5, -c * 0.25);
    if (!isFinite(n2) || !isFinite(n3) || !isFinite(n4)) {
      simplexFinite = false;
    }
  }
  assert(simplexFinite, 'SimplexNoise 2D/3D/4D evaluates to finite numbers on extreme coordinates [1e-15 to 1e20]');

  // Check Analytical Derivatives with extreme inputs
  const gradOut = new Float32Array(4);
  let gradFinite = true;
  for (const c of [0, 1e-6, 1e5, -1e5]) {
    sn.noise2DGrad(c, -c, gradOut);
    if (!isFinite(gradOut[0]) || !isFinite(gradOut[1]) || !isFinite(gradOut[2])) gradFinite = false;
    sn.noise3DGrad(c, -c, c * 0.5, gradOut);
    if (!isFinite(gradOut[0]) || !isFinite(gradOut[1]) || !isFinite(gradOut[2]) || !isFinite(gradOut[3])) gradFinite = false;
  }
  assert(gradFinite, 'SimplexNoise analytical derivatives remain finite under extreme coordinate evaluations');
}

// 1.3 CurlNoise Degenerate & Extreme Parameters
{
  const curl = new CurlNoise(new SimplexNoise(1234));
  const out2 = [0, 0];
  const out3 = [0, 0, 0];
  let curlRobust = true;

  try {
    // Zero octaves, huge octaves, negative parameters, zero scale, huge time
    curl.sampleCurl2D(100, 200, 1e9, 0, 0.003, 0.5, 2.0, out2);
    curl.sampleCurl2D(100, 200, 0, 10, 0, 0.5, 2.0, out2);
    curl.sampleCurl2D(1e7, -1e7, -500, 4, 1e-6, -0.5, -2.0, out2);
    curl.sampleCurl3D(100, 200, 300, 0, 0, 0, 0, out3);
    curl.sampleCurl3D(1e6, -1e6, 1e6, 8, 1e-4, 0.5, 2.0, out3);
    curl.samplePotential2D(100, 200, 0, 0, 0, 0, 0);
  } catch (e) {
    curlRobust = false;
  }
  assert(curlRobust && isFinite(out2[0]) && isFinite(out2[1]), 'CurlNoise 2D/3D handles degenerate parameters (0 octaves, 0 scale, 1e9 time) safely');
}

// 1.4 TrigLUT Out-of-Bounds & FastAtan2 Singularities
{
  let trigSafe = true;
  const extremeAngles = [0, -0, Math.PI, -Math.PI, 1e7, -1e7, 1e15, -1e15];
  for (const a of extremeAngles) {
    const s = TrigLUT.fastSin(a);
    const c = TrigLUT.fastCos(a);
    const sLerp = TrigLUT.fastSinLerp(a);
    const cLerp = TrigLUT.fastCosLerp(a);
    if (!isFinite(s) || !isFinite(c) || !isFinite(sLerp) || !isFinite(cLerp)) trigSafe = false;
    if (Math.abs(s) > 1.01 || Math.abs(c) > 1.01) trigSafe = false;
  }
  assert(trigSafe, 'TrigLUT fastSin/fastCos/Lerp safely handles extreme angle inputs (-1e15 to 1e15 rad) strictly within [-1, 1]');

  // FastAtan2 Singularity Stress: (0,0), axes, extreme aspect ratios
  const atan2Tests = [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, Math.PI / 2],
    [0, -1, Math.PI],
    [-1, 0, -Math.PI / 2],
    [1e-15, 1e15, 0],
    [1e15, 1e-15, Math.PI / 2],
    [-1e15, -1e-15, -Math.PI / 2],
    [100, 100, Math.PI / 4]
  ];
  let atan2Accurate = true;
  for (const [y, x, expected] of atan2Tests) {
    const approx = TrigLUT.fastAtan2(y, x);
    const exact = Math.atan2(y, x);
    if (Math.abs(approx - exact) > 0.05) {
      atan2Accurate = false;
    }
  }
  assert(atan2Accurate, 'TrigLUT.fastAtan2 handles exact (0,0) singularity and extreme coordinate ratios with < 0.05 rad error');
}

// 1.5 ColorMath Out-of-Gamut & Adversarial Inputs
{
  const outRGB = [0, 0, 0];
  const outLab = [0, 0, 0];
  let colorSafe = true;

  // Negative and extreme HSV/HSL
  ColorMath.hsvToRgb(-9999, -5.0, 10.0, outRGB);
  ColorMath.hslToRgb(10000, 2.5, -3.0, outRGB);

  // Out-of-gamut OKLab roundtrips
  ColorMath.rgbToOklab(-1.0, 2.5, 10.0, outLab);
  ColorMath.oklabToRgb(outLab[0], outLab[1], outLab[2], outRGB);

  if (!isFinite(outRGB[0]) || !isFinite(outRGB[1]) || !isFinite(outRGB[2])) colorSafe = false;
  if (outRGB[0] < 0 || outRGB[0] > 1 || outRGB[1] < 0 || outRGB[1] > 1 || outRGB[2] < 0 || outRGB[2] > 1) colorSafe = false;

  // Palette LUT with degenerate stops
  const degPalette = ColorMath.createPaletteLUT([
    { pos: 0.5, r: 1, g: 0, b: 0, a: 1 },
    { pos: 0.5, r: 0, g: 1, b: 0, a: 1 } // Identical pos
  ], 64);
  if (degPalette.length !== 64 * 4 || !isFinite(degPalette[0])) colorSafe = false;

  assert(colorSafe, 'ColorMath clamps out-of-gamut RGB/OKLab values to [0, 1] and handles degenerate palette stops');
}

// 1.6 VectorMath Division-by-Zero & Singularity Regularization
{
  const vOut = [0, 0];
  const normLen0 = VectorMath.safeNormalize(0, 0, vOut);
  const normLenTiny = VectorMath.safeNormalize(1e-12, -1e-12, vOut);
  assert(normLen0 === 0 && vOut[0] === 0 && vOut[1] === 0, 'VectorMath.safeNormalize(0, 0) returns zero vector without NaN');
  assert(normLenTiny === 0 && vOut[0] === 0 && vOut[1] === 0, 'VectorMath.safeNormalize(sub-epsilon) returns zero vector without NaN');

  const invD0 = VectorMath.invDist(0, 0, 1e-4);
  assert(Math.abs(invD0 - 10000.0) < 1e-2, 'VectorMath.invDist(0, 0) correctly bounded to 1/eps (10000.0)');

  VectorMath.clampSpeed(0, 0, 450, vOut);
  assert(vOut[0] === 0 && vOut[1] === 0, 'VectorMath.clampSpeed(0, 0) handles zero vector safely');

  VectorMath.clampSpeed(1e10, 1e10, 100, vOut);
  const clampedSpeed = Math.sqrt(vOut[0] * vOut[0] + vOut[1] * vOut[1]);
  assert(Math.abs(clampedSpeed - 100.0) < 1e-3, 'VectorMath.clampSpeed(1e10, 1e10) clamps to exact maxSpeed without overflow');

  // WrapCoord negative and zero checks
  const wrapNeg = VectorMath.wrapCoord(-350, 100);
  const wrapZero = VectorMath.wrapCoord(0, 100);
  assert(wrapNeg === 50 && wrapZero === 0, 'VectorMath.wrapCoord correctly handles negative and boundary modulus');
}

// ============================================================================
// 2. ADVERSARIAL STRESS: SPATIAL HASH GRID INTEGRITY
// ============================================================================
runSection('2. SpatialHashGrid Structural Stress & Boundary Exploits');

// 2.1 Degenerate / Negative Dimensions
{
  let gridResilient = true;
  try {
    const g1 = new SpatialHashGrid(0, 0, 48, 1000);
    g1.insert(0, 10, 10);
    g1.resize(0, 0);

    const g2 = new SpatialHashGrid(-500, -300, 48, 1000);
    g2.insert(0, -100, -100);
    g2.resize(-200, -200);

    if (g1.cols < 1 || g1.rows < 1 || g2.cols < 1 || g2.rows < 1) gridResilient = false;
  } catch (e) {
    gridResilient = false;
  }
  assert(gridResilient, 'SpatialHashGrid handles 0 and negative world dimensions with Math.max(1, cols/rows) protection');
}

// 2.2 Buffer Overrun & Out-of-Bounds ID Insertion
{
  const grid = new SpatialHashGrid(1920, 1080, 48, 100);
  let overrunCaught = true;

  try {
    grid.insert(-1, 100, 100);          // Negative ID
    grid.insert(100, 100, 100);         // Equal to maxEntities
    grid.insert(999999, 100, 100);      // Far beyond maxEntities
  } catch (e) {
    overrunCaught = false;
  }
  assert(overrunCaught, 'SpatialHashGrid.insert rejects negative IDs and ID >= maxEntities without throwing or buffer overrun');
}

// 2.3 Extreme Coordinates (Infinite, Negative, Huge)
{
  const grid = new SpatialHashGrid(1920, 1080, 48, 1000);
  const coords = [
    [-1e9, -1e9],
    [1e9, 1e9],
    [NaN, NaN],
    [Infinity, -Infinity],
    [-Infinity, Infinity]
  ];

  let coordSafe = true;
  try {
    for (let i = 0; i < coords.length; i++) {
      grid.insert(i, coords[i][0], coords[i][1]);
    }
  } catch (e) {
    coordSafe = false;
  }
  assert(coordSafe, 'SpatialHashGrid.insert handles extreme coordinates (+/-1e9, NaN, +/-Inf) without cell array bounds fault');
}

// 2.4 Massive Spatial Density (100,000 particles in a single pixel)
{
  const maxN = 100000;
  const grid = new SpatialHashGrid(1920, 1080, 48, maxN);
  const buffer = new Float32Array(maxN * 10);

  // Place all 100,000 particles at exact coordinate (500, 500)
  for (let i = 0; i < maxN; i++) {
    buffer[i * 10 + 0] = 500.0;
    buffer[i * 10 + 1] = 500.0;
  }

  grid.populate(buffer, maxN, 10);

  let queryProcessed = 0;
  const queried = grid.queryNeighborsBuffer(500, 500, 50.0, buffer, 10, (nId, dx, dy, d2) => {
    queryProcessed++;
  }, 50); // maxNeighbors = 50 limit

  assert(queried === 50 && queryProcessed === 50, `SpatialHashGrid efficiently halts neighbor search at maxNeighbors (50/100,000 density)`);

  // Query with radius 0 (should still match exact point)
  let exactMatchCount = 0;
  grid.queryNeighborsBuffer(500, 500, 0, buffer, 10, (nId) => {
    exactMatchCount++;
  }, 10);
  assert(exactMatchCount === 10, 'SpatialHashGrid handles radius = 0 queries accurately');

  // Query with negative radius (should return 0 matches without inverted match bug)
  let negRadiusCount = 0;
  grid.queryNeighborsBuffer(500, 500, -20.0, buffer, 10, () => {
    negRadiusCount++;
  });
  assert(negRadiusCount === 0, 'SpatialHashGrid handles negative search radius safely returning 0 matches', `Actual matches returned: ${negRadiusCount}`);
}

// 2.5 SpatialHashGrid Zero/Negative CellSize Initialization
{
  let cellSizeZeroHandled = false;
  try {
    const gZero = new SpatialHashGrid(1920, 1080, 0, 1000);
    cellSizeZeroHandled = isFinite(gZero.numCells) && gZero.numCells > 0;
  } catch (e) {
    cellSizeZeroHandled = false;
  }
  assert(cellSizeZeroHandled, 'SpatialHashGrid constructor handles cellSize <= 0 without throwing RangeError: Invalid typed array length');
}

// ============================================================================
// 3. ADVERSARIAL STRESS: PHYSICS MODES & SINGULARITIES (r -> 0)
// ============================================================================
runSection('3. Physics Modes Singularities (r -> 0) & Chaos Dynamics');

// 3.1 Mode 1: Kerr Singularity Exact Center Placement (r = 0, dx = 0, dy = 0)
{
  const phys = new PhysicsEngine(1920, 1080, 1000, 42);
  phys.setMode(1); // Kerr Singularity
  phys.setParticleCount(100);

  const ptrX = 960.0;
  const ptrY = 540.0;
  phys.setMouse(ptrX, ptrY, true, 0, 0, 0);

  const buf = phys.getParticleBuffer();
  // Force all 100 particles to exact singularity coordinate (ptrX, ptrY)
  for (let i = 0; i < 100; i++) {
    buf[i * PARTICLE_STRIDE + ATTR_X] = ptrX;
    buf[i * PARTICLE_STRIDE + ATTR_Y] = ptrY;
    buf[i * PARTICLE_STRIDE + ATTR_VX] = 0;
    buf[i * PARTICLE_STRIDE + ATTR_VY] = 0;
  }

  // Step physics simulation across 60 fixed substeps
  for (let s = 0; s < 60; s++) {
    phys.stepFixed(1.0 / 120.0);
  }

  let zeroViolations = true;
  for (let i = 0; i < 100; i++) {
    const off = i * PARTICLE_STRIDE;
    const x = buf[off + ATTR_X];
    const y = buf[off + ATTR_Y];
    const vx = buf[off + ATTR_VX];
    const vy = buf[off + ATTR_VY];
    const life = buf[off + ATTR_LIFE];

    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy) || !isFinite(life)) {
      zeroViolations = false;
    }
  }
  assert(zeroViolations, 'Mode 1 (Kerr Singularity) handles exact center r=0 singularity without NaN/Infinity explosion');
}

// 3.2 All 8 Modes Singularities & Extreme Pointer Momentum
{
  let allModesSingularitySafe = true;

  for (let m = 0; m <= 7; m++) {
    const phys = new PhysicsEngine(1920, 1080, 500, 100 + m);
    phys.setMode(m);
    phys.setParticleCount(200);

    const ptrX = 500.0;
    const ptrY = 500.0;
    // Extreme pointer inertia: 50,000 px/s
    phys.setMouse(ptrX, ptrY, true, 0, 50000.0, -50000.0);

    // Concentrate particles at pointer coordinate
    const buf = phys.getParticleBuffer();
    for (let i = 0; i < 50; i++) {
      buf[i * PARTICLE_STRIDE + ATTR_X] = ptrX;
      buf[i * PARTICLE_STRIDE + ATTR_Y] = ptrY;
    }

    // Run 60 sub-steps
    for (let s = 0; s < 60; s++) {
      phys.stepFixed(1.0 / 120.0);
    }

    // Verify Invariant bounds
    for (let i = 0; i < 200; i++) {
      const off = i * PARTICLE_STRIDE;
      const x = buf[off + ATTR_X];
      const y = buf[off + ATTR_Y];
      const vx = buf[off + ATTR_VX];
      const vy = buf[off + ATTR_VY];
      const vMag = Math.sqrt(vx * vx + vy * vy);

      if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)) {
        allModesSingularitySafe = false;
      }
      if (vMag > 450.05) { // MAX_SPEED = 450.0
        allModesSingularitySafe = false;
      }
    }
  }
  assert(allModesSingularitySafe, 'All 8 Physics Modes survive exact r=0 placement & 50,000px/s pointer inertia with velocities <= 450px/s');
}

// 3.3 Multi-Pointer Chaos Storm (100 Simultaneous Pointers)
{
  const phys = new PhysicsEngine(1920, 1080, 2000, 777);
  phys.setMode(0); // Vortex Typhoon

  for (let i = 0; i < 100; i++) {
    phys.addPointer(`ptr_${i}`, Math.random() * 1920, Math.random() * 1080);
    phys.updatePointer(`ptr_${i}`, Math.random() * 1920, Math.random() * 1080, (Math.random() - 0.5) * 5000, (Math.random() - 0.5) * 5000);
  }

  // Step 60 times
  for (let s = 0; s < 60; s++) {
    phys.stepFixed(1.0 / 120.0);
  }

  // Remove 50 pointers
  for (let i = 0; i < 50; i++) {
    phys.removePointer(`ptr_${i}`);
  }

  assert(phys.pointers.size === 50, 'PhysicsEngine supports 100 concurrent dynamic pointers and partial removal without leaks');
}

// ============================================================================
// 4. ADVERSARIAL STRESS: SHOCKWAVE CASCADES & SPARK BUFFER OVERFLOW
// ============================================================================
runSection('4. Shockwave System & Spark Ring Buffer Pool Stress');

// 4.1 Massive Shockwave Burst & Zero-Mass Particle Interaction
{
  const maxWaves = 16;
  const maxSparks = 2048;
  const sw = new ShockwaveSystem(maxWaves, maxSparks);
  const pBuffer = new Float32Array(500 * PARTICLE_STRIDE);
  // Intentionally leave particle buffer with mass = 0 to test division-by-zero resilience

  for (let i = 0; i < 1000; i++) {
    sw.trigger(
      Math.random() * 1920,
      Math.random() * 1080,
      Math.random() * 10.0 + 0.1,
      Math.random() * 360,
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 1000
    );
  }

  assert(sw.waves.length <= maxWaves, `ShockwaveSystem enforces max active wave limit (active: ${sw.waves.length} <= ${maxWaves})`);
  assert(sw.sparkCount <= maxSparks, `Spark pool strictly enforces capacity limit (sparks: ${sw.sparkCount} <= ${maxSparks})`);

  // Step shockwave system across 240 simulation steps
  let sparkBufferNeverCorrupted = true;
  for (let step = 0; step < 240; step++) {
    sw.update(1.0 / 120.0, pBuffer, 500);
    if (sw.sparkCount > maxSparks || sw.sparkCount < 0) sparkBufferNeverCorrupted = false;

    // Check spark coordinates & lifetimes
    for (let s = 0; s < sw.sparkCount; s++) {
      const idx = s * 8;
      const x = sw.sparks[idx + 0];
      const y = sw.sparks[idx + 1];
      const life = sw.sparks[idx + 4];
      if (!isFinite(x) || !isFinite(y) || !isFinite(life) || life < 0) {
        sparkBufferNeverCorrupted = false;
      }
    }
  }
  assert(sparkBufferNeverCorrupted, 'Shockwave spark ring buffer maintains 100% numerical validity under zero-mass & heavy deallocation swapping', 'Encountered NaN spark coordinates due to unregularized particle mass division');
}

// 4.2 Degenerate Shockwaves (Strength = 0, Negative, Huge, NaN)
{
  const sw = new ShockwaveSystem(16, 2048);
  let handledDegenerate = true;

  try {
    sw.trigger(960, 540, 0, 180);
    sw.trigger(960, 540, -100.0, 180);
    sw.trigger(960, 540, 1e8, 180);
    sw.trigger(NaN, NaN, 1.0, NaN);
  } catch (e) {
    handledDegenerate = false;
  }
  assert(handledDegenerate, 'ShockwaveSystem safely handles 0, negative, 1e8, and NaN shockwave parameters');
}

// ============================================================================
// 5. ADVERSARIAL STRESS: 100,000 PARTICLES AT EXTREME FPS (1 FPS TO 1000 FPS)
// ============================================================================
runSection('5. Scale & Variable Timestep Stress (100,000 particles, 1 FPS to 1000 FPS)');

// 5.1 100,000 Particles Simulation Step & Invariant Verification
{
  const maxN = 100000;
  console.log(`  Allocating PhysicsEngine with ${maxN.toLocaleString()} particles...`);
  const phys = new PhysicsEngine(2560, 1440, maxN, 1337);
  phys.setParticleCount(maxN);

  const startTime = Date.now();
  // Execute 10 fixed substeps (83.3 ms of physics time)
  for (let s = 0; s < 10; s++) {
    phys.stepFixed(1.0 / 120.0);
  }
  const elapsed = Date.now() - startTime;
  console.log(`  10 fixed substeps at 100,000 particles executed in ${elapsed} ms (${(elapsed / 10).toFixed(2)} ms/step)`);

  const buf = phys.getParticleBuffer();
  let totalNaN = 0;
  let totalOutOfBounds = 0;
  let totalSpeedViolations = 0;

  for (let i = 0; i < maxN; i++) {
    const off = i * PARTICLE_STRIDE;
    const x = buf[off + ATTR_X];
    const y = buf[off + ATTR_Y];
    const vx = buf[off + ATTR_VX];
    const vy = buf[off + ATTR_VY];
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)) totalNaN++;
    if (x < -phys.BOUND_MARGIN - 1 || x > phys.width + phys.BOUND_MARGIN + 1 ||
        y < -phys.BOUND_MARGIN - 1 || y > phys.height + phys.BOUND_MARGIN + 1) totalOutOfBounds++;
    if (speed > phys.MAX_SPEED + 0.1) totalSpeedViolations++;
  }

  assert(totalNaN === 0, `100,000 particles: 0 NaN or Infinity floats detected after 10 substeps`);
  assert(totalOutOfBounds === 0, `100,000 particles: 0 coordinate bounds violations detected`);
  assert(totalSpeedViolations === 0, `100,000 particles: 0 velocity clamping violations detected (all <= 450 px/s)`);
}

// 5.2 Ultra High Frame Rate: 1000 FPS (dt = 0.001s)
{
  const phys = new PhysicsEngine(1920, 1080, 5000, 42);
  phys.setParticleCount(5000);

  // At 1000 FPS, dt = 0.001s. 1 fixed substep occurs every ~8 frames.
  for (let f = 0; f < 1000; f++) {
    const alpha = phys.update(0.001);
    if (alpha < 0 || alpha > 1.0) {
      assert(false, `Alpha interpolation out of [0, 1] range at 1000 FPS: ${alpha}`);
    }
  }
  // 1000 * 0.001s = 1.0s. At 120Hz, expect exactly 120 fixed steps.
  const actualTime = phys.globalTime;
  assert(Math.abs(actualTime - 1.0) < 0.02, `1000 FPS accumulator deterministically advanced simulation time by ~1.0s (actual: ${actualTime.toFixed(4)}s)`);
}

// 5.3 Low Frame Rate & Spiral-of-Death Clamp: 1 FPS (dt = 1.0s) & 0.0001 FPS (dt = 10000s)
{
  const phys = new PhysicsEngine(1920, 1080, 5000, 42);
  phys.setParticleCount(5000);

  // Single frame with dt = 1.0s (1 FPS)
  // Max accumulator clamp is 100ms (0.100s), which executes at most 12 substeps per frame.
  const prevTime = phys.globalTime;
  phys.update(1.0);
  const timeAdvanced1 = phys.globalTime - prevTime;
  assert(timeAdvanced1 <= 0.101, `Spiral-of-death clamp limits dt=1.0s to max accumulator window <= 0.10s (advanced: ${timeAdvanced1.toFixed(4)}s)`);

  // Single frame with dt = 10000.0s (Freeze / Sleep wake)
  phys.update(10000.0);
  const timeAdvanced2 = phys.globalTime - (prevTime + timeAdvanced1);
  assert(timeAdvanced2 <= 0.101, `Sleep wake dt=10,000s safely clamped to <= 0.10s without CPU stall`);

  // Negative / NaN / Zero dt
  const timeBefore = phys.globalTime;
  phys.update(-0.5);
  phys.update(NaN);
  phys.update(0);
  assert(phys.globalTime === timeBefore, `update() ignores negative, NaN, and 0 dt values without corrupting state`);
}

// ============================================================================
// 6. ADVERSARIAL STRESS: BUFFER INJECTION & INVARIANT REPAIR
// ============================================================================
runSection('6. Direct Buffer Poisoning & Self-Healing Invariant Hardening');

{
  const phys = new PhysicsEngine(1920, 1080, 1000, 999);
  phys.setParticleCount(1000);
  const buf = phys.getParticleBuffer();

  // Poison 50% of the particles with invalid numbers
  for (let i = 0; i < 500; i++) {
    const off = i * PARTICLE_STRIDE;
    buf[off + ATTR_X] = i % 2 === 0 ? NaN : Infinity;
    buf[off + ATTR_Y] = i % 3 === 0 ? -Infinity : 9999999.0;
    buf[off + ATTR_VX] = 1e9;
    buf[off + ATTR_VY] = -1e9;
    buf[off + ATTR_ENERGY] = 999.0;
  }

  // Execute enforceInvariants
  phys.enforceInvariants();

  let unhealedCount = 0;
  let speedViolations = 0;
  let energyViolations = 0;

  for (let i = 0; i < 1000; i++) {
    const off = i * PARTICLE_STRIDE;
    const x = buf[off + ATTR_X];
    const y = buf[off + ATTR_Y];
    const vx = buf[off + ATTR_VX];
    const vy = buf[off + ATTR_VY];
    const energy = buf[off + ATTR_ENERGY];
    const speed = Math.sqrt(vx * vx + vy * vy);

    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)) unhealedCount++;
    if (speed > 450.05) speedViolations++;
    if (energy < 0 || energy > 1.0) energyViolations++;
  }

  assert(unhealedCount === 0, `Self-healing invariant: 100% of poisoned NaN/Inf particles repaired/respawned (0 unhealed)`);
  assert(speedViolations === 0, `Self-healing invariant: 100% of poisoned velocities clamped to <= 450 px/s`);
  assert(energyViolations === 0, `Self-healing invariant: 100% of poisoned energy values normalized to [0, 1]`);
}

// ============================================================================
// 7. MEMORY ALLOCATION & ZERO-GC PROFILE VALIDATION
// ============================================================================
runSection('7. Zero-GC Memory Allocation Invariance');

{
  const phys = new PhysicsEngine(1920, 1080, 50000, 42);
  phys.setParticleCount(50000);

  // Warmup JIT compiler
  for (let i = 0; i < 50; i++) {
    phys.stepFixed(1.0 / 120.0);
  }

  if (global.gc) global.gc();
  const initialHeap = process.memoryUsage().heapUsed;

  // Run 500 fixed substeps (4.16 seconds of continuous high-load simulation)
  for (let i = 0; i < 500; i++) {
    phys.stepFixed(1.0 / 120.0);
  }

  const finalHeap = process.memoryUsage().heapUsed;
  const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);
  console.log(`  Initial Heap: ${(initialHeap / (1024 * 1024)).toFixed(2)} MB | Final Heap: ${(finalHeap / (1024 * 1024)).toFixed(2)} MB | Delta: ${heapDeltaMB.toFixed(2)} MB`);

  // Under zero-allocation design, heap delta during 500 frames of 50k particles should be < 8.0 MB (ignoring minor V8 profiler overhead)
  assert(heapDeltaMB < 8.0, `Zero-GC invariant verified: Heap growth < 8MB over 500 fixed frames at 50,000 particles (actual: ${heapDeltaMB.toFixed(2)} MB)`);
}

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n\x1b[35m======================================================================\x1b[0m`);
console.log(`\x1b[1mADVERSARIAL STRESS TEST SUMMARY\x1b[0m`);
console.log(`\x1b[35m======================================================================\x1b[0m`);
console.log(`Total Assertions Passed: \x1b[32${passedTotal}\x1b[0m`);
console.log(`Total Assertions Failed: \x1b[31m${failedTotal}\x1b[0m`);

if (failedTotal > 0) {
  console.error(`\n\x1b[31mVERDICT: CHALLENGE_FAILED (${failedTotal} defect(s) discovered)\x1b[0m\n`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32mVERDICT: APPROVE (ALL ADVERSARIAL STRESS CHALLENGES PASSED WITH ZERO DEFECTS)\x1b[0m\n`);
  process.exit(0);
}
