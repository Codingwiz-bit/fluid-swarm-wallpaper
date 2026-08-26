/**
 * Independent Adversarial & Stress Verification Suite for Milestone 1
 * Fluid Swarm V4 Reviewer Verification
 */

import { PRNG, SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath } from '../src/math.js';
import { SpatialHashGrid } from '../src/spatial_grid.js';
import {
  PhysicsEngine, ShockwaveSystem, AnomalyEngine,
  PARTICLE_STRIDE, ATTR_X, ATTR_Y, ATTR_VX, ATTR_VY,
  ATTR_SIZE, ATTR_MASS, ATTR_LIFE, ATTR_MAX_LIFE,
  ATTR_SPECIES, ATTR_ENERGY
} from '../src/physics.js';

let passedChecks = 0;
let totalChecks = 0;
const failures = [];

function check(desc, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  \x1b[32m✔ [VERIFIED]\x1b[0m ${desc}`);
  } else {
    failures.push({ desc, details });
    console.error(`  \x1b[31m✖ [FAILED]\x1b[0m ${desc} ${details ? ' - ' + details : ''}`);
  }
}

console.log('\n\x1b[36m================================================================');
console.log(' INDEPENDENT ADVERSARIAL STRESS & INTEGRITY SUITE (MILESTONE 1)');
console.log('================================================================\x1b[0m\n');

// ----------------------------------------------------------------------------
// TEST 1: PRNG STATISTICAL UNIFORMITY & GAUSSIAN DISTRIBUTION
// ----------------------------------------------------------------------------
console.log('\x1b[33m--- Test Group 1: PRNG Uniformity & Gaussian Statistics ---\x1b[0m');
{
  const prng = new PRNG(1337);
  const BUCKETS = 10;
  const N = 100000;
  const counts = new Uint32Array(BUCKETS);

  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < N; i++) {
    const val = prng.random();
    const b = Math.min(BUCKETS - 1, Math.floor(val * BUCKETS));
    counts[b]++;
    sum += val;
    sumSq += val * val;
  }

  const mean = sum / N;
  const variance = (sumSq / N) - (mean * mean);
  const expectedMean = 0.5;
  const expectedVariance = 1.0 / 12.0; // ~0.08333

  let chiSquare = 0;
  const expectedPerBucket = N / BUCKETS;
  for (let b = 0; b < BUCKETS; b++) {
    const diff = counts[b] - expectedPerBucket;
    chiSquare += (diff * diff) / expectedPerBucket;
  }

  check('PRNG Uniform Mean within tolerance (0.50 ± 0.005)', Math.abs(mean - expectedMean) < 0.005, `mean=${mean}`);
  check('PRNG Uniform Variance within tolerance (0.0833 ± 0.005)', Math.abs(variance - expectedVariance) < 0.005, `var=${variance}`);
  check('PRNG Chi-Square uniformity statistic (df=9, critical=21.67 at p=0.01)', chiSquare < 21.67, `chi2=${chiSquare.toFixed(2)}`);

  // Gaussian statistics
  let gSum = 0;
  let gSumSq = 0;
  const gN = 50000;
  for (let i = 0; i < gN; i++) {
    const g = prng.randomGaussian(100, 15);
    gSum += g;
    gSumSq += g * g;
  }
  const gMean = gSum / gN;
  const gStd = Math.sqrt((gSumSq / gN) - (gMean * gMean));
  check('PRNG Gaussian Mean within tolerance (100 ± 0.3)', Math.abs(gMean - 100.0) < 0.3, `gMean=${gMean.toFixed(3)}`);
  check('PRNG Gaussian StdDev within tolerance (15 ± 0.3)', Math.abs(gStd - 15.0) < 0.3, `gStd=${gStd.toFixed(3)}`);
}

// ----------------------------------------------------------------------------
// TEST 2: SIMPLEX NOISE DERIVATIVES & CURL DIVERGENCE UNDER EXTREMES
// ----------------------------------------------------------------------------
console.log('\n\x1b[33m--- Test Group 2: Simplex Noise Derivatives & Multi-Scale Divergence ---\x1b[0m');
{
  const sn = new SimplexNoise(4242);
  const curl = new CurlNoise(sn);
  const gb = new Float32Array(4);
  const eps = 1e-6;

  // Extreme range & boundary points
  const testCoords = [
    [0.0, 0.0],
    [0.5, 0.5],
    [-1234.56, 7890.12],
    [10000.0, -10000.0],
    [0.0001, -0.0001],
    [-99.999, 99.999],
    [3.14159265, 2.71828182]
  ];

  let maxDiffGrad2D = 0;
  for (const [x, y] of testCoords) {
    sn.noise2DGrad(x, y, gb);
    const numGx = (sn.noise2D(x + eps, y) - sn.noise2D(x - eps, y)) / (2 * eps);
    const numGy = (sn.noise2D(x, y + eps) - sn.noise2D(x, y - eps)) / (2 * eps);
    const errX = Math.abs(gb[1] - numGx);
    const errY = Math.abs(gb[2] - numGy);
    const err = Math.max(errX, errY);
    if (err > maxDiffGrad2D) maxDiffGrad2D = err;
  }
  check('Simplex 2D Analytical vs Central Differences at extreme points', maxDiffGrad2D < 1e-4, `maxErr=${maxDiffGrad2D.toExponential(3)}`);

  // Multi-octave curl divergence test across 2000 points
  let maxDivergence = 0;
  const vxp = [0, 0], vxm = [0, 0], vyp = [0, 0], vym = [0, 0];
  const numDivPoints = 2000;
  const prng = new PRNG(888);

  for (let i = 0; i < numDivPoints; i++) {
    const x = (prng.random() - 0.5) * 4000;
    const y = (prng.random() - 0.5) * 4000;
    const t = prng.random() * 100;
    const oct = (i % 4) + 1;

    curl.sampleCurl2D(x + eps, y, t, oct, 0.003, 0.5, 2.0, vxp);
    curl.sampleCurl2D(x - eps, y, t, oct, 0.003, 0.5, 2.0, vxm);
    curl.sampleCurl2D(x, y + eps, t, oct, 0.003, 0.5, 2.0, vyp);
    curl.sampleCurl2D(x, y - eps, t, oct, 0.003, 0.5, 2.0, vym);

    const div = Math.abs((vxp[0] - vxm[0]) / (2 * eps) + (vyp[1] - vym[1]) / (2 * eps));
    if (div > maxDivergence) maxDivergence = div;
  }
  check('Divergence-Free Curl field condition (div < 0.01) across 2000 multi-octave samples', maxDivergence < 0.01, `maxDiv=${maxDivergence.toExponential(3)}`);
}

// ----------------------------------------------------------------------------
// TEST 3: OKLAB / OKLCH / COLOR GAMUT INTEGRITY
// ----------------------------------------------------------------------------
console.log('\n\x1b[33m--- Test Group 3: OKLab / Oklch Color Gamut & Palette LUT Integrity ---\x1b[0m');
{
  const lab = [0, 0, 0];
  const lch = [0, 0, 0];
  const labRound = [0, 0, 0];
  const rgbRound = [0, 0, 0];

  // Boundary colors: Black, White, Red, Green, Blue, Yellow, Cyan, Magenta
  const primaries = [
    [0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 0],
    [0, 0, 1], [1, 1, 0], [0, 1, 1], [1, 0, 1]
  ];

  let maxPrimErr = 0;
  for (const [r, g, b] of primaries) {
    ColorMath.rgbToOklab(r, g, b, lab);
    ColorMath.oklabToOklch(lab[0], lab[1], lab[2], lch);
    ColorMath.oklchToOklab(lch[0], lch[1], lch[2], labRound);
    ColorMath.oklabToRgb(labRound[0], labRound[1], labRound[2], rgbRound);

    const err = Math.abs(r - rgbRound[0]) + Math.abs(g - rgbRound[1]) + Math.abs(b - rgbRound[2]);
    if (err > maxPrimErr) maxPrimErr = err;
  }
  check('Primary & Boundary Colors OKLab/Oklch round-trip fidelity', maxPrimErr < 1e-4, `maxPrimErr=${maxPrimErr.toExponential(3)}`);

  // Palette LUT monotonicity & range check
  const palette = ColorMath.createPaletteLUT([
    { pos: 0.0, r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
    { pos: 0.5, r: 0.5, g: 0.2, b: 0.8, a: 0.5 },
    { pos: 1.0, r: 1.0, g: 1.0, b: 1.0, a: 1.0 }
  ], 512);

  let validLut = palette.length === 512 * 4;
  for (let i = 0; i < palette.length; i++) {
    if (isNaN(palette[i]) || palette[i] < -1e-5 || palette[i] > 1.00001) {
      validLut = false;
      break;
    }
  }
  check('512-entry OKLab Palette LUT generation bounded in [0, 1]', validLut);
}

// ----------------------------------------------------------------------------
// TEST 4: ZERO-ALLOCATION SPATIAL HASH GRID INTEGRITY & EDGE CASES
// ----------------------------------------------------------------------------
console.log('\n\x1b[33m--- Test Group 4: Spatial Hash Grid Adversarial Invariants ---\x1b[0m');
{
  const grid = new SpatialHashGrid(1920, 1080, 48, 50000);
  const buf = new Float32Array(50000 * 10);
  const prng = new PRNG(999);

  // Place 1,000 particles at negative, over-boundary, and identical coordinates
  for (let i = 0; i < 50000; i++) {
    if (i < 100) {
      // Clustered exact duplicate point (singularity stress test)
      buf[i * 10 + 0] = 500.0;
      buf[i * 10 + 1] = 500.0;
    } else if (i < 200) {
      // Negative coordinates
      buf[i * 10 + 0] = -50.0 - prng.random() * 200;
      buf[i * 10 + 1] = -50.0 - prng.random() * 200;
    } else if (i < 300) {
      // Over boundary coordinates
      buf[i * 10 + 0] = 1920 + 100 + prng.random() * 500;
      buf[i * 10 + 1] = 1080 + 100 + prng.random() * 500;
    } else {
      buf[i * 10 + 0] = prng.random() * 1920;
      buf[i * 10 + 1] = prng.random() * 1080;
    }
  }

  grid.populate(buf, 50000, 10);

  // Check cluster query at (500, 500)
  let clusterCount = 0;
  grid.queryNeighborsBuffer(500.0, 500.0, 5.0, buf, 10, () => {
    clusterCount++;
  });
  check('SpatialHashGrid accurately detects all 100 collocated cluster particles', clusterCount >= 100, `found=${clusterCount}`);

  // Linked-list cycle detection and visit count invariant
  let visitedTotal = 0;
  let hasCycle = false;
  for (let c = 0; c < grid.numCells; c++) {
    let pId = grid.cellHead[c];
    let countInCell = 0;
    while (pId !== -1) {
      countInCell++;
      visitedTotal++;
      if (countInCell > 50000) {
        hasCycle = true;
        break;
      }
      pId = grid.next[pId];
    }
    if (hasCycle) break;
  }
  check('SpatialHashGrid linked lists have zero cycles', !hasCycle);
  check('SpatialHashGrid total inserted entities exactly matches 50,000', visitedTotal === 50000, `total=${visitedTotal}`);
}

// ----------------------------------------------------------------------------
// TEST 5: PHYSICS ENGINE 10-ATTRIBUTE SOA & SPECIES DYNAMICS
// ----------------------------------------------------------------------------
console.log('\n\x1b[33m--- Test Group 5: Physics Engine SoA Layout, Species & Modes ---\x1b[0m');
{
  const engine = new PhysicsEngine(1920, 1080, 20000, 777);
  engine.setParticleCount(20000);
  const pBuf = engine.getParticleBuffer();

  check('Particle SoA Buffer Float32Array size matches 20,000 * 10 (200,000 floats)', pBuf.length === 200000);

  // Verify attribute initialization
  let validLayout = true;
  for (let i = 0; i < 20000; i++) {
    const off = i * PARTICLE_STRIDE;
    const x = pBuf[off + ATTR_X];
    const y = pBuf[off + ATTR_Y];
    const vx = pBuf[off + ATTR_VX];
    const vy = pBuf[off + ATTR_VY];
    const size = pBuf[off + ATTR_SIZE];
    const mass = pBuf[off + ATTR_MASS];
    const life = pBuf[off + ATTR_LIFE];
    const maxLife = pBuf[off + ATTR_MAX_LIFE];
    const species = pBuf[off + ATTR_SPECIES];
    const energy = pBuf[off + ATTR_ENERGY];

    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy) ||
        size <= 0 || mass <= 0 || life < 0 || maxLife <= 0 ||
        species < 0 || species > 3 || energy < 0 || energy > 1.0) {
      validLayout = false;
      break;
    }
  }
  check('All 10 particle attributes per particle adhere strictly to physics constraints', validLayout);

  // Test 8 Modes with high perturbation & pointer motion
  let modesPassed = 0;
  for (let m = 0; m < 8; m++) {
    engine.setMode(m);
    engine.setMouse(960, 540, true, 0, 200 * (m % 2 === 0 ? 1 : -1), 200 * (m % 2 === 0 ? -1 : 1));
    for (let f = 0; f < 30; f++) {
      engine.update(1 / 60);
    }
    let allFinite = true;
    for (let i = 0; i < 20000; i++) {
      const off = i * PARTICLE_STRIDE;
      if (!isFinite(pBuf[off + ATTR_X]) || !isFinite(pBuf[off + ATTR_Y]) ||
          !isFinite(pBuf[off + ATTR_VX]) || !isFinite(pBuf[off + ATTR_VY])) {
        allFinite = false;
        break;
      }
    }
    if (allFinite) modesPassed++;
  }
  check('All 8 Cosmic Physics Modes survive continuous 30-frame perturbation (8/8)', modesPassed === 8, `passed=${modesPassed}`);
}

// ----------------------------------------------------------------------------
// TEST 6: FIXED-TIMESTEP DETERMINISM ACROSS RANDOM DT WORKLOADS
// ----------------------------------------------------------------------------
console.log('\n\x1b[33m--- Test Group 6: Fixed-Timestep Accumulator Determinism ---\x1b[0m');
{
  const engA = new PhysicsEngine(1920, 1080, 2000, 12345);
  engA.setParticleCount(2000);
  const engB = new PhysicsEngine(1920, 1080, 2000, 12345);
  engB.setParticleCount(2000);

  // Simulate 1.0 second of simulation with different frame rates:
  // Run A: 60 FPS (dt = 1/60s)
  for (let i = 0; i < 60; i++) {
    engA.update(1.0 / 60.0);
  }

  // Run B: 120 FPS (dt = 1/120s)
  for (let i = 0; i < 120; i++) {
    engB.update(1.0 / 120.0);
  }

  const bA = engA.getParticleBuffer();
  const bB = engB.getParticleBuffer();
  let maxPosDiff = 0;
  for (let i = 0; i < 2000 * PARTICLE_STRIDE; i++) {
    const diff = Math.abs(bA[i] - bB[i]);
    if (diff > maxPosDiff) maxPosDiff = diff;
  }
  check('Fixed-timestep 120Hz accumulator maintains bitwise identical particle buffer (diff = 0)', maxPosDiff === 0, `diff=${maxPosDiff}`);
}

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n\x1b[36m================================================================');
console.log(` EMPIRICAL VERIFICATION COMPLETE: ${passedChecks}/${totalChecks} PASSED`);
console.log('================================================================\x1b[0m\n');

if (failures.length > 0) {
  console.error('\x1b[31mFAILURES:\x1b[0m');
  failures.forEach(f => console.error(` - ${f.desc} (${f.details})`));
  process.exit(1);
} else {
  console.log('\x1b[32m✔ 100% OF ADVERSARIAL STRESS CHECKS PASSED WITH ZERO DEFECTS!\x1b[0m\n');
  process.exit(0);
}
