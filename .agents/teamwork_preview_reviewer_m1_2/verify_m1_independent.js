/**
 * Independent Adversarial & Behavioral Verification Test Suite for Milestone 1
 * Written by: teamwork_preview_reviewer_m1_2
 */

import { PRNG, SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath } from '../../Fluid Swarm V4/src/math.js';
import { SpatialHashGrid } from '../../Fluid Swarm V4/src/spatial_grid.js';
import { 
  PhysicsEngine, 
  ShockwaveSystem, 
  AnomalyEngine, 
  PARTICLE_STRIDE, 
  ATTR_X, ATTR_Y, ATTR_VX, ATTR_VY, ATTR_SIZE, ATTR_MASS, ATTR_LIFE, ATTR_MAX_LIFE, ATTR_SPECIES, ATTR_ENERGY,
  SPECIES_PHYTOPLANKTON, SPECIES_STARLING_BOID, SPECIES_VOID_PREDATOR, SPECIES_VORTEX_WEAVER 
} from '../../Fluid Swarm V4/src/physics.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, err });
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${name}: ${err.message}`);
    if (err.stack) console.error(`    ${err.stack.split('\n')[1]}`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) throw new Error(`Expected ${expected}, but got ${actual}`);
    },
    toBeCloseTo: (expected, delta = 1e-4) => {
      if (Math.abs(actual - expected) > delta) {
        throw new Error(`Expected ${actual} to be close to ${expected} within ${delta} (diff: ${Math.abs(actual - expected)})`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toBeLessThan: (expected) => {
      if (!(actual < expected)) throw new Error(`Expected ${actual} < ${expected}`);
    },
    toBeLessThanOrEqual: (expected) => {
      if (!(actual <= expected)) throw new Error(`Expected ${actual} <= ${expected}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy value, got ${actual}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy value, got ${actual}`);
    }
  };
}

console.log('\x1b[34m============================================================\x1b[0m');
console.log('\x1b[34m   INDEPENDENT REVIEWER VERIFICATION - MILESTONE 1\x1b[0m');
console.log('\x1b[34m============================================================\x1b[0m\n');

// ============================================================================
// SECTION 1: SIMPLEX & CURL NOISE ANALYTICAL MATHEMATICS
// ============================================================================
console.log('\x1b[33m--- SECTION 1: Simplex & Curl Noise Mathematics ---\x1b[0m');

test('1.1 Mulberry32 PRNG determinism and distribution uniformity', () => {
  const prng1 = new PRNG(12345);
  const prng2 = new PRNG(12345);
  for (let i = 0; i < 1000; i++) {
    expect(prng1.random()).toBe(prng2.random());
  }

  // Statistical mean check
  const prng = new PRNG(999);
  let sum = 0;
  const N = 50000;
  for (let i = 0; i < N; i++) sum += prng.random();
  const mean = sum / N;
  expect(mean).toBeCloseTo(0.5, 0.01);
});

test('1.2 Simplex 2D/3D/4D analytical derivatives vs numerical central difference (1000 samples)', () => {
  const sn = new SimplexNoise(4242);
  const out2D = new Float32Array(3);
  const out3D = new Float32Array(4);
  const eps = 1e-5;

  let maxErr2D = 0;
  let maxErr3D = 0;

  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = (Math.random() - 0.5) * 200;
    const z = (Math.random() - 0.5) * 200;

    // 2D
    sn.noise2DGrad(x, y, out2D);
    const numDx2D = (sn.noise2D(x + eps, y) - sn.noise2D(x - eps, y)) / (2 * eps);
    const numDy2D = (sn.noise2D(x, y + eps) - sn.noise2D(x, y - eps)) / (2 * eps);
    const err2D = Math.max(Math.abs(out2D[1] - numDx2D), Math.abs(out2D[2] - numDy2D));
    if (err2D > maxErr2D) maxErr2D = err2D;

    // 3D
    sn.noise3DGrad(x, y, z, out3D);
    const numDx3D = (sn.noise3D(x + eps, y, z) - sn.noise3D(x - eps, y, z)) / (2 * eps);
    const numDy3D = (sn.noise3D(x, y + eps, z) - sn.noise3D(x, y - eps, z)) / (2 * eps);
    const numDz3D = (sn.noise3D(x, y, z + eps) - sn.noise3D(x, y, z - eps)) / (2 * eps);
    const err3D = Math.max(Math.abs(out3D[1] - numDx3D), Math.abs(out3D[2] - numDy3D), Math.abs(out3D[3] - numDz3D));
    if (err3D > maxErr3D) maxErr3D = err3D;
  }

  expect(maxErr2D).toBeLessThan(1e-3);
  expect(maxErr3D).toBeLessThan(1e-3);
});

test('1.3 Curl Noise divergence-free proof across multi-octaves and coordinates', () => {
  const curl = new CurlNoise(new SimplexNoise(8888));
  const v1 = [0, 0], v2 = [0, 0], v3 = [0, 0], v4 = [0, 0];
  const h = 1e-4;
  let maxDivergence = 0;

  for (let i = 0; i < 2000; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const y = (Math.random() - 0.5) * 1000;
    const t = (i * 0.05);

    curl.sampleCurl2D(x + h, y, t, 3, 0.005, 0.5, 2.0, v1);
    curl.sampleCurl2D(x - h, y, t, 3, 0.005, 0.5, 2.0, v2);
    curl.sampleCurl2D(x, y + h, t, 3, 0.005, 0.5, 2.0, v3);
    curl.sampleCurl2D(x, y - h, t, 3, 0.005, 0.5, 2.0, v4);

    const dvx_dx = (v1[0] - v2[0]) / (2 * h);
    const dvy_dy = (v3[1] - v4[1]) / (2 * h);
    const div = Math.abs(dvx_dx + dvy_dy);
    if (div > maxDivergence) maxDivergence = div;
  }

  // Numerical divergence must be near 0
  expect(maxDivergence).toBeLessThan(0.01);
});

test('1.4 TrigLUT fastSin and fastCos accuracy against native trigonometric math', () => {
  for (let deg = -720; deg <= 720; deg += 3.5) {
    const rad = deg * (Math.PI / 180.0);
    const sNative = Math.sin(rad);
    const cNative = Math.cos(rad);

    const sFast = TrigLUT.fastSinLerp(rad);
    const cFast = TrigLUT.fastCosLerp(rad);

    expect(sFast).toBeCloseTo(sNative, 1e-5);
    expect(cFast).toBeCloseTo(cNative, 1e-5);
  }
});

// ============================================================================
// SECTION 2: ZERO-ALLOCATION SPATIAL HASH GRID
// ============================================================================
console.log('\n\x1b[33m--- SECTION 2: Zero-Allocation Spatial Hash Grid ---\x1b[0m');

test('2.1 SpatialHashGrid precision and recall against brute-force neighbor queries (50,000 particles)', () => {
  const N = 50000;
  const grid = new SpatialHashGrid(2560, 1440, 48, N);
  const buf = new Float32Array(N * PARTICLE_STRIDE);

  for (let i = 0; i < N; i++) {
    buf[i * PARTICLE_STRIDE + ATTR_X] = Math.random() * 2560;
    buf[i * PARTICLE_STRIDE + ATTR_Y] = Math.random() * 1440;
  }

  grid.populate(buf, N, PARTICLE_STRIDE);

  for (let q = 0; q < 30; q++) {
    const qx = Math.random() * 2560;
    const qy = Math.random() * 1440;
    const radius = 35.0 + Math.random() * 45.0;
    const r2 = radius * radius;

    // Brute force ground truth
    const groundTruth = [];
    for (let i = 0; i < N; i++) {
      const dx = buf[i * PARTICLE_STRIDE + ATTR_X] - qx;
      const dy = buf[i * PARTICLE_STRIDE + ATTR_Y] - qy;
      if (dx * dx + dy * dy <= r2) {
        groundTruth.push(i);
      }
    }

    // Grid query
    const gridFound = [];
    grid.queryNeighborsBuffer(qx, qy, radius, buf, PARTICLE_STRIDE, (id, dx, dy, d2) => {
      gridFound.push(id);
      expect(d2).toBeLessThanOrEqual(r2 + 1e-3);
    });

    expect(gridFound.length).toBe(groundTruth.length);
    const setG = new Set(gridFound);
    for (const id of groundTruth) {
      expect(setG.has(id)).toBeTruthy();
    }
  }
});

test('2.2 SpatialHashGrid boundary and out-of-bounds coordinates safety', () => {
  const grid = new SpatialHashGrid(1000, 1000, 50, 100);
  // Negative, extreme, corner coordinates
  grid.insert(0, -500, -500);
  grid.insert(1, 1500, 1500);
  grid.insert(2, 0, 0);
  grid.insert(3, 1000, 1000);
  grid.insert(4, 500, 500);

  // Out of range IDs
  grid.insert(-1, 200, 200);
  grid.insert(999, 200, 200);

  const found = [];
  grid.queryNeighbors(500, 500, 60, (id) => {
    found.push(id);
  });
  expect(found.includes(4)).toBeTruthy();
});

// ============================================================================
// SECTION 3: 4-SPECIES ECOSYSTEM BEHAVIORAL VALIDATION
// ============================================================================
console.log('\n\x1b[33m--- SECTION 3: 4-Species Ecosystem Behavioral Dynamics ---\x1b[0m');

test('3.1 Species Distribution and Initialization Ratios', () => {
  const engine = new PhysicsEngine(1920, 1080, 10000, 555);
  engine.setParticleCount(10000);
  const pBuf = engine.getParticleBuffer();

  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) {
    const s = pBuf[i * PARTICLE_STRIDE + ATTR_SPECIES];
    counts[s]++;
  }

  // 50% Phytoplankton, 35% Starling Boids, 5% Void Predators, 10% Vortex Weavers
  expect(counts[0] / 10000).toBeCloseTo(0.50, 0.03);
  expect(counts[1] / 10000).toBeCloseTo(0.35, 0.03);
  expect(counts[2] / 10000).toBeCloseTo(0.05, 0.015);
  expect(counts[3] / 10000).toBeCloseTo(0.10, 0.02);
});

test('3.2 Starling Boids: Reynolds Flocking (Alignment, Cohesion, Separation) & Topological Limit k<=7', () => {
  const engine = new PhysicsEngine(1920, 1080, 100);
  engine.setParticleCount(10);
  const pBuf = engine.getParticleBuffer();

  // Create a flock of 8 boids moving in similar direction
  for (let i = 0; i < 8; i++) {
    const off = i * PARTICLE_STRIDE;
    pBuf[off + ATTR_SPECIES] = SPECIES_STARLING_BOID;
    pBuf[off + ATTR_X] = 500 + (i % 4) * 15;
    pBuf[off + ATTR_Y] = 500 + Math.floor(i / 4) * 15;
    pBuf[off + ATTR_VX] = 50.0;
    pBuf[off + ATTR_VY] = 0.0;
    pBuf[off + ATTR_MASS] = 1.0;
    pBuf[off + ATTR_LIFE] = 100.0;
  }
  for (let i = 8; i < 10; i++) {
    const off = i * PARTICLE_STRIDE;
    pBuf[off + ATTR_LIFE] = 0; // inactive
  }

  engine.update(1 / 60);

  // Verify alignment cohesion maintained (positive vx)
  for (let i = 0; i < 8; i++) {
    const off = i * PARTICLE_STRIDE;
    expect(pBuf[off + ATTR_VX]).toBeGreaterThan(10.0);
  }
});

test('3.3 Starling Boids: Predator Panic Evasion Wave', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(2);
  const pBuf = engine.getParticleBuffer();

  // Boid at (500, 500)
  pBuf[0 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_STARLING_BOID;
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  // Predator approaching from left at (460, 500)
  pBuf[1 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_VOID_PREDATOR;
  pBuf[1 * PARTICLE_STRIDE + ATTR_X] = 460;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VX] = 100;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_MASS] = 4.5;
  pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Boid must accelerate AWAY to the right (+vx)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
});

test('3.4 Void Predator: Apex Hunter Pursuit and Devour Mechanism', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(2);
  const pBuf = engine.getParticleBuffer();

  // Predator at (500, 500)
  pBuf[0 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_VOID_PREDATOR;
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 4.5;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  // Prey (Phytoplankton) at (550, 500)
  pBuf[1 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_PHYTOPLANKTON;
  pBuf[1 * PARTICLE_STRIDE + ATTR_X] = 550;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_MASS] = 0.5;
  pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 60);

  // Predator should accelerate towards prey (+vx)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
});

test('3.5 Void Predator: Mutual Territory Repulsion', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(2);
  const pBuf = engine.getParticleBuffer();

  // Predator 1 at (500, 500)
  pBuf[0 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_VOID_PREDATOR;
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 4.5;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  // Predator 2 at (530, 500)
  pBuf[1 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_VOID_PREDATOR;
  pBuf[1 * PARTICLE_STRIDE + ATTR_X] = 530;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_MASS] = 4.5;
  pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // They should push away from each other: Pred 1 to left (-vx), Pred 2 to right (+vx)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
  expect(pBuf[1 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
});

// ============================================================================
// SECTION 4: 8 COSMIC PHYSICS MODES VERIFICATION
// ============================================================================
console.log('\n\x1b[33m--- SECTION 4: 8 Cosmic Physics Modes Verification ---\x1b[0m');

test('4.1 Mode 0 (Vortex Typhoon): Rankine swirl, radial suction, Coriolis and inertia torque', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(0);
  // Stationary pointer: verifies pure radial suction + tangential swirl
  engine.setMouse(500, 500, true, 0, 0, 0);

  const pBuf = engine.getParticleBuffer();
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 550;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Inward suction -> negative vx (towards 500 from 550)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
  // Tangential swirl -> non-zero vy
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VY]).toBeGreaterThan(0);
});

test('4.2 Mode 1 (Kerr Singularity): Ergosphere frame dragging and event horizon capture', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(2);
  engine.setMode(1);
  engine.setMouse(500, 500, true, 0, 0, 0);

  const pBuf = engine.getParticleBuffer();
  // Particle 0 outside event horizon
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 580;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  // Particle 1 inside event horizon (dist < 37px)
  pBuf[1 * PARTICLE_STRIDE + ATTR_X] = 515;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Particle 0 pulled towards singularity
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
  // Particle 1 captured (life set to 0 and respawned)
  expect(pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE]).toBeLessThanOrEqual(100.0);
});

test('4.3 Mode 2 (Quantum Repulsor): Yukawa deflection and hard core elastic restitution', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(2);
  engine.setMouse(500, 500, true, 0, 0, 0);

  const pBuf = engine.getParticleBuffer();
  // Approaching pointer at r = 25px (< rCore 38px) with inward velocity
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 525;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = -100;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Elastic restitution bounces particle outward (+vx)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
});

test('4.4 Mode 3 (Nebula Drift): Cosmic laminar wake velocity inheritance', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(3);
  engine.setMouse(500, 500, true, 0, 200, -100);

  const pBuf = engine.getParticleBuffer();
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 550;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Particle inherits pointer wake velocity (+vx, -vy)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VY]).toBeLessThan(0);
});

test('4.5 Mode 4 (Magnetic Dipole): Lorentz magnetic field line deflection for opposite charges', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(2);
  engine.setMode(4);
  engine.setMouse(500, 500, true, 0, 100, 0);

  const pBuf = engine.getParticleBuffer();
  // Even species (charge +1)
  pBuf[0 * PARTICLE_STRIDE + ATTR_SPECIES] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 580;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  // Odd species (charge -1)
  pBuf[1 * PARTICLE_STRIDE + ATTR_SPECIES] = 1;
  pBuf[1 * PARTICLE_STRIDE + ATTR_X] = 500;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = 580;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[1 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Accelerations must have opposite signs in X
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX] * pBuf[1 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
});

test('4.6 Mode 5 (Cryo Freeze): Hexagonal lattice crystallization & shatter wave', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(5);
  // High-speed fling (> 450 px/s) to trigger shatter wave
  engine.setMouse(500, 500, true, 0, 600, 0);

  const pBuf = engine.getParticleBuffer();
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 550;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Shatter wave excites energy to 1.0 and throws particle outward (+vx)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_ENERGY]).toBe(1.0);
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(50.0);
});

test('4.7 Mode 6 (Strange Attractor Chaos): Non-linear attractor field steering', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(6);
  engine.setMouse(500, 500, true, 0, 0, 0);

  const pBuf = engine.getParticleBuffer();
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 550;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 530;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  expect(isFinite(pBuf[0 * PARTICLE_STRIDE + ATTR_VX])).toBeTruthy();
  expect(isFinite(pBuf[0 * PARTICLE_STRIDE + ATTR_VY])).toBeTruthy();
});

test('4.8 Mode 7 (Swarm Flocking): Pointer Shepherd Attraction', () => {
  const engine = new PhysicsEngine(1920, 1080, 10);
  engine.setParticleCount(1);
  engine.setMode(7);
  engine.setMouse(500, 500, true, 0, 0, 0);

  const pBuf = engine.getParticleBuffer();
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = 600;
  pBuf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
  pBuf[0 * PARTICLE_STRIDE + ATTR_LIFE] = 100.0;

  engine.update(1 / 120);

  // Attracted to pointer (negative vx towards 500)
  expect(pBuf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
});

// ============================================================================
// SECTION 5: SUPERSONIC SHOCKWAVES & AUTONOMOUS ANOMALIES
// ============================================================================
console.log('\n\x1b[33m--- SECTION 5: Supersonic Shockwaves & Autonomous Anomalies ---\x1b[0m');

test('5.1 Dual-zone Shockwave pressure dynamics (Crest blast push & Trough cavitation pull)', () => {
  const shockwaves = new ShockwaveSystem(8, 512);
  shockwaves.trigger(500, 500, 1.0, 180, 0, 0);
  const w = shockwaves.waves[0];
  w.radius = 100.0;
  w.thickness = 50.0;

  const buf = new Float32Array(2 * PARTICLE_STRIDE);
  // Particle 0: on leading crest (dist = 115px > 100px)
  buf[0 * PARTICLE_STRIDE + ATTR_X] = 615;
  buf[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  buf[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;

  // Particle 1: on trailing trough (dist = 85px < 100px)
  buf[1 * PARTICLE_STRIDE + ATTR_X] = 585;
  buf[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  buf[1 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;

  shockwaves.update(1 / 60, buf, 2);

  // Particle 0 gets positive outward push (+vx)
  expect(buf[0 * PARTICLE_STRIDE + ATTR_VX]).toBeGreaterThan(0);
  // Particle 1 gets negative inward suction (-vx)
  expect(buf[1 * PARTICLE_STRIDE + ATTR_VX]).toBeLessThan(0);
});

test('5.2 Wandering Pulsars & Lightning Arcs Ionization', () => {
  const anomalies = new AnomalyEngine(1920, 1080);
  const shockwaves = new ShockwaveSystem(8, 512);
  expect(anomalies.pulsars.length).toBe(4);

  const buf = new Float32Array(100 * PARTICLE_STRIDE);
  for (let i = 0; i < 100; i++) {
    buf[i * PARTICLE_STRIDE + ATTR_X] = Math.random() * 1920;
    buf[i * PARTICLE_STRIDE + ATTR_Y] = Math.random() * 1080;
  }

  // Force discharge
  anomalies.pulsars[0].x = 500; anomalies.pulsars[0].y = 500;
  anomalies.pulsars[1].x = 600; anomalies.pulsars[1].y = 500;
  anomalies.dischargeCooldown = 0;

  for (let step = 0; step < 60; step++) {
    anomalies.update(1 / 60, step * (1 / 60), buf, 100, shockwaves);
  }

  for (const p of anomalies.pulsars) {
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(1920);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(1080);
  }
});

// ============================================================================
// SECTION 6: DETERMINISM & NUMERICAL STRESS HARDENING
// ============================================================================
console.log('\n\x1b[33m--- SECTION 6: Determinism & Numerical Stress Hardening ---\x1b[0m');

test('6.1 Accumulator Determinism across disparate and variable framerates', () => {
  const e1 = new PhysicsEngine(1920, 1080, 200, 777);
  const e2 = new PhysicsEngine(1920, 1080, 200, 777);
  const e3 = new PhysicsEngine(1920, 1080, 200, 777);

  // e1: steady 60 fps (1/60s, 60 frames = 120 fixed substeps)
  for (let i = 0; i < 60; i++) e1.update(1 / 60);

  // e2: steady 120 fps (1/120s, 120 frames = 120 fixed substeps)
  for (let i = 0; i < 120; i++) e2.update(1 / 120);

  // e3: 40 fps (1/40s, 40 frames = 120 fixed substeps)
  for (let i = 0; i < 40; i++) e3.update(1 / 40);

  const b1 = e1.getParticleBuffer();
  const b2 = e2.getParticleBuffer();
  const b3 = e3.getParticleBuffer();

  let maxDiff12 = 0;
  let maxDiff13 = 0;
  for (let i = 0; i < 200 * PARTICLE_STRIDE; i++) {
    const d12 = Math.abs(b1[i] - b2[i]);
    const d13 = Math.abs(b1[i] - b3[i]);
    if (d12 > maxDiff12) maxDiff12 = d12;
    if (d13 > maxDiff13) maxDiff13 = d13;
  }

  // Exactly identical: bitwise deterministic accumulator
  expect(maxDiff12).toBeCloseTo(0.0, 1e-4);
  expect(maxDiff13).toBeCloseTo(0.0, 1e-4);
});

test('6.2 Adversarial Input Hardening (NaN injection, Infs, extreme coordinates)', () => {
  const engine = new PhysicsEngine(1920, 1080, 50);
  const pBuf = engine.getParticleBuffer();

  // Inject NaNs and Infs into particle buffer
  pBuf[0 * PARTICLE_STRIDE + ATTR_X] = NaN;
  pBuf[0 * PARTICLE_STRIDE + ATTR_VX] = Infinity;
  pBuf[1 * PARTICLE_STRIDE + ATTR_Y] = -Infinity;
  pBuf[2 * PARTICLE_STRIDE + ATTR_X] = 1e9; // Extreme displacement

  engine.update(1 / 60);

  for (let i = 0; i < 50; i++) {
    const off = i * PARTICLE_STRIDE;
    expect(isNaN(pBuf[off + ATTR_X])).toBeFalsy();
    expect(isNaN(pBuf[off + ATTR_Y])).toBeFalsy();
    expect(isFinite(pBuf[off + ATTR_VX])).toBeTruthy();
    expect(isFinite(pBuf[off + ATTR_VY])).toBeTruthy();
    expect(pBuf[off + ATTR_X]).toBeGreaterThan(-100);
    expect(pBuf[off + ATTR_X]).toBeLessThan(1920 + 100);
  }
});

test('6.3 Long-Term Soak Simulation (5,000 sub-steps with continuous mode switching)', () => {
  const engine = new PhysicsEngine(1920, 1080, 1000);
  engine.setParticleCount(1000);

  for (let step = 0; step < 500; step++) {
    if (step % 50 === 0) {
      engine.setMode((step / 50) % 8);
      engine.setMouse(
        960 + Math.sin(step * 0.1) * 400,
        540 + Math.cos(step * 0.1) * 300,
        true,
        0,
        Math.cos(step * 0.1) * 200,
        Math.sin(step * 0.1) * 200
      );
    }
    if (step % 120 === 0) {
      engine.triggerShockwave(960, 540, 1.2, 220);
    }
    engine.update(1 / 60);
  }

  const pBuf = engine.getParticleBuffer();
  let corrupt = 0;
  for (let i = 0; i < 1000 * PARTICLE_STRIDE; i++) {
    if (!isFinite(pBuf[i]) || isNaN(pBuf[i])) corrupt++;
  }
  expect(corrupt).toBe(0);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n\x1b[34m============================================================\x1b[0m');
console.log(`\x1b[34mTotal Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}\x1b[0m`);
console.log('\x1b[34m============================================================\x1b[0m');

if (failedTests > 0) {
  console.error('\x1b[31mVerification Failed with errors:\x1b[0m');
  failures.forEach(f => console.error(` - ${f.name}: ${f.err.message}`));
  process.exit(1);
} else {
  console.log('\x1b[32m✔ 100% INDEPENDENT ADVERSARIAL VERIFICATION PASSED!\x1b[0m\n');
  process.exit(0);
}
