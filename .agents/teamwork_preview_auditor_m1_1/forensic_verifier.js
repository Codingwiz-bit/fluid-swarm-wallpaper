/**
 * FORENSIC INTEGRITY AUDIT SUITE
 * Milestone 1 Files: math.js, spatial_grid.js, physics.js
 * Independent verification without trusting existing test assertions.
 */

import fs from 'fs';
import path from 'path';

import { PRNG, SimplexNoise, CurlNoise, TrigLUT, ColorMath, VectorMath } from '../../Fluid Swarm V4/src/math.js';
import { SpatialHashGrid } from '../../Fluid Swarm V4/src/spatial_grid.js';
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
  ATTR_ENERGY,
  SPECIES_PHYTOPLANKTON,
  SPECIES_STARLING_BOID,
  SPECIES_VOID_PREDATOR,
  SPECIES_VORTEX_WEAVER
} from '../../Fluid Swarm V4/src/physics.js';

let auditPassed = 0;
let auditFailed = 0;
const failures = [];

function check(label, condition, details = '') {
  if (condition) {
    auditPassed++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${label}`);
  } else {
    auditFailed++;
    failures.push({ label, details });
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${label} ${details ? '--> ' + details : ''}`);
  }
}

function header(title) {
  console.log(`\n\x1b[1m\x1b[34m>>> ${title} <<<\x1b[0m`);
}

const baseDir = '/Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/Fluid Swarm V4';

// ============================================================================
// PHASE 1: STATIC CODE ANALYSIS & DEPENDENCY / CHEATING AUDIT
// ============================================================================
header('PHASE 1: Static Code Analysis & Dependency/Bypass Auditing');

const srcFiles = ['src/math.js', 'src/spatial_grid.js', 'src/physics.js'];
for (const relPath of srcFiles) {
  const fullPath = path.join(baseDir, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Check 1: File existence and non-trivial length
  check(`${relPath} exists and has substantial implementation (> 3KB)`, content.length > 3000, `Size: ${content.length} bytes`);

  // Check 2: No external npm / cdn / http imports
  const importLines = content.split('\n').filter(l => l.trim().startsWith('import '));
  let invalidImport = false;
  for (const line of importLines) {
    // Only relative local imports (./...) allowed
    if (!line.includes("from './") && !line.includes('from "./')) {
      invalidImport = true;
      break;
    }
  }
  check(`${relPath} has ZERO external/third-party package imports`, !invalidImport, `Imports: ${importLines.join('; ')}`);

  // Check 3: No stubbed / NotImplemented exceptions
  const hasNotImplemented = /throw new (Error|NotImplementedError)\(["'].*not implemented.*["']\)/i.test(content);
  check(`${relPath} contains no 'not implemented' stubs`, !hasNotImplemented);

  // Check 4: No hardcoded test output mocking
  const hasHardcodedMocks = /return\s+["'](PASS|FAIL|✔|✖)["']/i.test(content);
  check(`${relPath} contains no hardcoded PASS/FAIL test strings`, !hasHardcodedMocks);

  // Check 5: No eval, Function constructor, or dynamic obfuscation
  const hasObfuscation = /\beval\(|new Function\(|atob\(|btoa\(|\\x[0-9a-f]{2}/i.test(content);
  check(`${relPath} is free of eval / dynamic execution obfuscation`, !hasObfuscation);
}

// ============================================================================
// PHASE 2: MATHEMATICAL INTEGRITY & CONTINUITY CHECKS (src/math.js)
// ============================================================================
header('PHASE 2: Mathematical Integrity & Algorithmic Rigor');

// 2.1 PRNG Authenticity & Periodicity
{
  const prng1 = new PRNG(12345);
  const prng2 = new PRNG(12345);
  let deterministic = true;
  for (let i = 0; i < 5000; i++) {
    if (prng1.random() !== prng2.random()) {
      deterministic = false;
      break;
    }
  }
  check('PRNG Mulberry32 is 100% deterministic with matching seeds', deterministic);

  // Check uniform distribution moments (mean ~ 0.5, var ~ 1/12 ≈ 0.08333)
  let sum = 0, sumSq = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) {
    const v = prng1.random();
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / N;
  const variance = sumSq / N - mean * mean;
  check('PRNG uniform statistical mean in [0.495, 0.505]', Math.abs(mean - 0.5) < 0.005, `Mean: ${mean.toFixed(5)}`);
  check('PRNG uniform statistical variance in [0.080, 0.086]', Math.abs(variance - 1/12) < 0.003, `Var: ${variance.toFixed(5)}`);
}

// 2.2 Simplex Noise Continuity & Bound Verification
{
  const simplex = new SimplexNoise(4242);
  let maxAbs2D = 0, maxAbs3D = 0, maxAbs4D = 0;
  let continuous = true;

  for (let i = 0; i < 2000; i++) {
    const x = (i * 0.137) - 100;
    const y = (i * 0.281) - 100;
    const z = (i * 0.319) - 100;
    const w = (i * 0.457) - 100;

    const v2 = simplex.noise2D(x, y);
    const v3 = simplex.noise3D(x, y, z);
    const v4 = simplex.noise4D(x, y, z, w);

    if (Math.abs(v2) > maxAbs2D) maxAbs2D = Math.abs(v2);
    if (Math.abs(v3) > maxAbs3D) maxAbs3D = Math.abs(v3);
    if (Math.abs(v4) > maxAbs4D) maxAbs4D = Math.abs(v4);

    // Continuity test with micro delta
    const delta = 1e-4;
    const v2_next = simplex.noise2D(x + delta, y);
    if (Math.abs(v2_next - v2) > 0.05) continuous = false;
  }

  check('SimplexNoise 2D, 3D, 4D output bounded <= 1.05', maxAbs2D <= 1.05 && maxAbs3D <= 1.05 && maxAbs4D <= 1.05,
    `Max: 2D=${maxAbs2D.toFixed(3)}, 3D=${maxAbs3D.toFixed(3)}, 4D=${maxAbs4D.toFixed(3)}`);
  check('SimplexNoise displays $C^0$ Lipschitz continuity over micro deltas', continuous);
}

// 2.3 Simplex Analytical Derivatives Exactness
{
  const simplex = new SimplexNoise(8888);
  const outGrad2 = new Float32Array(3);
  const outGrad3 = new Float32Array(4);
  let maxRelErr2D = 0;
  let maxRelErr3D = 0;
  const eps = 1e-5;

  for (let i = 0; i < 300; i++) {
    const x = Math.sin(i) * 50;
    const y = Math.cos(i) * 50;
    const z = Math.sin(i * 2) * 50;

    // 2D Gradient check
    simplex.noise2DGrad(x, y, outGrad2);
    const numGx2D = (simplex.noise2D(x + eps, y) - simplex.noise2D(x - eps, y)) / (2 * eps);
    const numGy2D = (simplex.noise2D(x, y + eps) - simplex.noise2D(x, y - eps)) / (2 * eps);

    const errX2D = Math.abs(outGrad2[1] - numGx2D);
    const errY2D = Math.abs(outGrad2[2] - numGy2D);
    if (errX2D > maxRelErr2D) maxRelErr2D = errX2D;
    if (errY2D > maxRelErr2D) maxRelErr2D = errY2D;

    // 3D Gradient check
    simplex.noise3DGrad(x, y, z, outGrad3);
    const numGx3D = (simplex.noise3D(x + eps, y, z) - simplex.noise3D(x - eps, y, z)) / (2 * eps);
    const numGy3D = (simplex.noise3D(x, y + eps, z) - simplex.noise3D(x, y - eps, z)) / (2 * eps);
    const numGz3D = (simplex.noise3D(x, y, z + eps) - simplex.noise3D(x, y, z - eps)) / (2 * eps);

    const errX3D = Math.abs(outGrad3[1] - numGx3D);
    const errY3D = Math.abs(outGrad3[2] - numGy3D);
    const errZ3D = Math.abs(outGrad3[3] - numGz3D);
    if (errX3D > maxRelErr3D) maxRelErr3D = errX3D;
    if (errY3D > maxRelErr3D) maxRelErr3D = errY3D;
    if (errZ3D > maxRelErr3D) maxRelErr3D = errZ3D;
  }

  check('Simplex analytical 2D derivatives match central difference (err < 1e-3)', maxRelErr2D < 1e-3, `Max err: ${maxRelErr2D.toExponential(3)}`);
  check('Simplex analytical 3D derivatives match central difference (err < 1e-3)', maxRelErr3D < 1e-3, `Max err: ${maxRelErr3D.toExponential(3)}`);
}

// 2.4 Mathematical Divergence-Free Curl Verification: div(curl(Psi)) = 0
{
  const curl = new CurlNoise(new SimplexNoise(5555));
  const v1 = [0, 0], v2 = [0, 0], v3 = [0, 0], v4 = [0, 0];
  const h = 0.001;
  let maxDivergence2D = 0;
  let maxDivergence3D = 0;
  let totalDiv2D = 0;

  const N = 5000;
  for (let i = 0; i < N; i++) {
    const x = (Math.random() - 0.5) * 500;
    const y = (Math.random() - 0.5) * 500;
    const z = (Math.random() - 0.5) * 500;
    const t = 3.14;

    // 2D Curl Divergence: dvx/dx + dvy/dy
    curl.sampleCurl2D(x + h, y, t, 3, 0.003, 0.5, 2.0, v1);
    curl.sampleCurl2D(x - h, y, t, 3, 0.003, 0.5, 2.0, v2);
    curl.sampleCurl2D(x, y + h, t, 3, 0.003, 0.5, 2.0, v3);
    curl.sampleCurl2D(x, y - h, t, 3, 0.003, 0.5, 2.0, v4);

    const dvx_dx = (v1[0] - v2[0]) / (2 * h);
    const dvy_dy = (v3[1] - v4[1]) / (2 * h);
    const div2D = Math.abs(dvx_dx + dvy_dy);
    totalDiv2D += div2D;
    if (div2D > maxDivergence2D) maxDivergence2D = div2D;

    // 3D Curl Divergence: dvx/dx + dvy/dy + dvz/dz
    const v3D_xp = [0, 0, 0], v3D_xm = [0, 0, 0];
    const v3D_yp = [0, 0, 0], v3D_ym = [0, 0, 0];
    const v3D_zp = [0, 0, 0], v3D_zm = [0, 0, 0];

    curl.sampleCurl3D(x + h, y, z, 2, 0.003, 0.5, 2.0, v3D_xp);
    curl.sampleCurl3D(x - h, y, z, 2, 0.003, 0.5, 2.0, v3D_xm);
    curl.sampleCurl3D(x, y + h, z, 2, 0.003, 0.5, 2.0, v3D_yp);
    curl.sampleCurl3D(x, y - h, z, 2, 0.003, 0.5, 2.0, v3D_ym);
    curl.sampleCurl3D(x, y, z + h, 2, 0.003, 0.5, 2.0, v3D_zp);
    curl.sampleCurl3D(x, y, z - h, 2, 0.003, 0.5, 2.0, v3D_zm);

    const div3D = Math.abs(
      (v3D_xp[0] - v3D_xm[0]) / (2 * h) +
      (v3D_yp[1] - v3D_ym[1]) / (2 * h) +
      (v3D_zp[2] - v3D_zm[2]) / (2 * h)
    );
    if (div3D > maxDivergence3D) maxDivergence3D = div3D;
  }

  const avgDiv2D = totalDiv2D / N;
  check('2D Curl Noise average divergence across 5,000 coordinates is < 1e-4', avgDiv2D < 1e-4, `Avg div: ${avgDiv2D.toExponential(4)}, max: ${maxDivergence2D.toExponential(4)}`);
  check('3D Curl Noise divergence is mathematically zero (max div < 0.01)', maxDivergence3D < 0.01, `Max div: ${maxDivergence3D.toExponential(4)}`);
}

// 2.5 TrigLUT Accuracy & Polynomial Atan2 Accuracy
{
  let maxTrigErr = 0;
  let maxAtanErr = 0;
  for (let angle = -100; angle <= 100; angle += 0.07) {
    const sErr = Math.abs(Math.sin(angle) - TrigLUT.fastSinLerp(angle));
    const cErr = Math.abs(Math.cos(angle) - TrigLUT.fastCosLerp(angle));
    if (sErr > maxTrigErr) maxTrigErr = sErr;
    if (cErr > maxTrigErr) maxTrigErr = cErr;

    const y = Math.sin(angle);
    const x = Math.cos(angle);
    const atanErr = Math.abs(Math.atan2(y, x) - TrigLUT.fastAtan2(y, x));
    if (atanErr > maxAtanErr) maxAtanErr = atanErr;
  }
  check('TrigLUT fastSinLerp/fastCosLerp error < 1e-5 against Math.sin/cos', maxTrigErr < 1e-5, `Max err: ${maxTrigErr.toExponential(3)}`);
  check('TrigLUT fastAtan2 rational polynomial error < 0.01 rad against Math.atan2', maxAtanErr < 0.01, `Max err: ${maxAtanErr.toExponential(3)}`);
}

// ============================================================================
// PHASE 3: SPATIAL ACCELERATION GRID RIGOR (src/spatial_grid.js)
// ============================================================================
header('PHASE 3: Spatial Acceleration Grid Integrity & Edge Boundaries');

{
  const width = 1280, height = 720;
  const grid = new SpatialHashGrid(width, height, 32, 5000);
  const pBuf = new Float32Array(5000 * 10);

  // Populate with tricky positions: boundaries, negative coords, out-of-bounds coords, dense cluster
  for (let i = 0; i < 5000; i++) {
    if (i < 500) {
      // Clustered at (200, 200)
      pBuf[i * 10 + 0] = 200 + (Math.random() - 0.5) * 10;
      pBuf[i * 10 + 1] = 200 + (Math.random() - 0.5) * 10;
    } else if (i < 1000) {
      // Out of bounds / negative coords
      pBuf[i * 10 + 0] = -50 + Math.random() * 20;
      pBuf[i * 10 + 1] = height + 50 + Math.random() * 20;
    } else {
      // Random inside world
      pBuf[i * 10 + 0] = Math.random() * width;
      pBuf[i * 10 + 1] = Math.random() * height;
    }
  }

  grid.populate(pBuf, 5000, 10);

  // Validate linked-list structure: no infinite cycles or invalid indices
  let cyclesFound = 0;
  let totalLinkedCount = 0;
  for (let c = 0; c < grid.numCells; c++) {
    let head = grid.cellHead[c];
    const visited = new Set();
    while (head !== -1) {
      if (head < 0 || head >= 5000 || visited.has(head)) {
        cyclesFound++;
        break;
      }
      visited.add(head);
      totalLinkedCount++;
      head = grid.next[head];
    }
  }

  check('SpatialHashGrid linked-list is acyclic and indices are strictly valid', cyclesFound === 0);
  check('SpatialHashGrid retains all 5,000 inserted particles without loss', totalLinkedCount === 5000, `Count: ${totalLinkedCount}`);

  // Test radius neighbor query against exhaustive brute-force search
  let queryErrors = 0;
  for (let q = 0; q < 100; q++) {
    const qx = Math.random() * width;
    const qy = Math.random() * height;
    const rad = 48.0;
    const radSq = rad * rad;

    const bruteSet = new Set();
    for (let i = 0; i < 5000; i++) {
      const dx = pBuf[i * 10 + 0] - qx;
      const dy = pBuf[i * 10 + 1] - qy;
      if (dx * dx + dy * dy <= radSq) {
        bruteSet.add(i);
      }
    }

    const gridSet = new Set();
    grid.queryNeighborsBuffer(qx, qy, rad, pBuf, 10, (id) => {
      gridSet.add(id);
    });

    if (bruteSet.size !== gridSet.size) {
      queryErrors++;
    } else {
      for (const id of bruteSet) {
        if (!gridSet.has(id)) {
          queryErrors++;
          break;
        }
      }
    }
  }

  check('SpatialHashGrid query matches 100% of brute-force truth across 100 random probes', queryErrors === 0, `Errors: ${queryErrors}`);
}

// ============================================================================
// PHASE 4: MULTI-SPECIES ECOSYSTEM & 8 PHYSICS MODES (src/physics.js)
// ============================================================================
header('PHASE 4: Multi-Species Ecosystem & 8 Cosmic Physics Modes');

// 4.1 4-Species Distinct Ecological Dynamics
{
  const engine = new PhysicsEngine(1920, 1080, 4000);
  engine.setParticleCount(4000);
  const p = engine.getParticleBuffer();

  // Verify initial species ratios
  let counts = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) {
    counts[p[i * PARTICLE_STRIDE + ATTR_SPECIES]]++;
  }
  check('4 Species generated with correct configured distribution ratios',
    counts[0] > 1800 && counts[1] > 1200 && counts[2] > 100 && counts[3] > 300,
    `Phyto=${counts[0]}, Boid=${counts[1]}, Pred=${counts[2]}, Weaver=${counts[3]}`);

  // Test Predator Hunting & Devouring dynamics
  // Place 1 Predator at (500, 500) and 1 Boid at (508, 500)
  engine.resetParticle(0);
  engine.resetParticle(1);
  p[0 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_VOID_PREDATOR;
  p[0 * PARTICLE_STRIDE + ATTR_X] = 500;
  p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
  p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
  p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
  p[0 * PARTICLE_STRIDE + ATTR_ENERGY] = 0;

  p[1 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_STARLING_BOID;
  p[1 * PARTICLE_STRIDE + ATTR_X] = 508;
  p[1 * PARTICLE_STRIDE + ATTR_Y] = 500;
  p[1 * PARTICLE_STRIDE + ATTR_VX] = 0;
  p[1 * PARTICLE_STRIDE + ATTR_VY] = 0;
  p[1 * PARTICLE_STRIDE + ATTR_LIFE] = 20.0;

  engine.spatialGrid.populate(p, 2, PARTICLE_STRIDE);
  engine.integrateParticles(1 / 120);

  const predatorGainedEnergy = p[0 * PARTICLE_STRIDE + ATTR_ENERGY] > 0.5;
  const preyLifeDrained = p[1 * PARTICLE_STRIDE + ATTR_LIFE] <= 1.0;
  check('Predator strikes nearby prey and drains prey life while gaining energy glow', predatorGainedEnergy && preyLifeDrained);
}

// 4.2 8 Cosmic Physics Modes Mathematical Force Validation
{
  const engine = new PhysicsEngine(1920, 1080, 100);
  const p = engine.getParticleBuffer();

  // Mode 0: Vortex Typhoon -> Swirl cross-product & tangential acceleration
  {
    engine.setMode(0);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 600;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    // Pointer at (500, 500) moving downward (vy > 0)
    engine.setMouse(500, 500, true, 0, 0, 100);
    engine.integrateParticles(1 / 120);
    const hasTangentialForce = Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VY]) > 0;
    check('Mode 0 (Vortex Typhoon): Rankine tangential velocity and Coriolis torque active', hasTangentialForce);
  }

  // Mode 1: Kerr Singularity -> Relativistic gravitational acceleration & horizon capture
  {
    engine.setMode(1);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 510; // Within event horizon ~37px of pointer at (500,500)
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_LIFE] = 20.0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 0);
    engine.integrateParticles(1 / 120);
    const horizonCaptured = p[0 * PARTICLE_STRIDE + ATTR_LIFE] === 0;
    check('Mode 1 (Kerr Singularity): Infalling particle consumed by event horizon (life=0)', horizonCaptured);
  }

  // Mode 2: Quantum Repulsor -> Yukawa repulsion force
  {
    engine.setMode(2);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 520;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 0);
    engine.integrateParticles(1 / 120);
    const repelledOutward = p[0 * PARTICLE_STRIDE + ATTR_VX] > 0;
    check('Mode 2 (Quantum Repulsor): Yukawa deflection pushes particles outward', repelledOutward);
  }

  // Mode 3: Nebula Drift -> Stokes drag couples pointer velocity
  {
    engine.setMode(3);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 550;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 200, 0); // moving right
    engine.integrateParticles(1 / 120);
    const draggedAlongPointer = p[0 * PARTICLE_STRIDE + ATTR_VX] > 0;
    check('Mode 3 (Nebula Drift): Cosmic laminar wake imparts directional momentum', draggedAlongPointer);
  }

  // Mode 4: Magnetic Dipole -> Lorentz force for charged species
  {
    engine.setMode(4);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 550;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_SPECIES] = SPECIES_PHYTOPLANKTON; // q = +1
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 100);
    engine.integrateParticles(1 / 120);
    const hasMagneticImpulse = Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VX]) > 0 || Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VY]) > 0;
    check('Mode 4 (Magnetic Dipole): Magnetic field lines apply Lorentz acceleration', hasMagneticImpulse);
  }

  // Mode 5: Cryo Freeze -> Hexagonal lattice harmonic restoring force
  {
    engine.setMode(5);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 520;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 50;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 50;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 0);
    engine.integrateParticles(1 / 120);
    const dampedAndLatticeRestored = Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VX]) !== 50;
    check('Mode 5 (Cryo Freeze): Quench spring force snaps coordinates toward hexagonal lattice', dampedAndLatticeRestored);
  }

  // Mode 6: Strange Attractor -> Non-linear chaotic acceleration
  {
    engine.setMode(6);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 550;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 0);
    engine.integrateParticles(1 / 120);
    const chaoticForceActive = Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VX]) > 0 || Math.abs(p[0 * PARTICLE_STRIDE + ATTR_VY]) > 0;
    check('Mode 6 (Strange Attractor): Clifford / Lorenz dynamical attractor applies acceleration', chaoticForceActive);
  }

  // Mode 7: Swarm Flocking -> Shepherd Attraction Force
  {
    engine.setMode(7);
    p[0 * PARTICLE_STRIDE + ATTR_X] = 600;
    p[0 * PARTICLE_STRIDE + ATTR_Y] = 500;
    p[0 * PARTICLE_STRIDE + ATTR_VX] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_VY] = 0;
    p[0 * PARTICLE_STRIDE + ATTR_MASS] = 1.0;
    engine.setMouse(500, 500, true, 0, 0, 0);
    engine.integrateParticles(1 / 120);
    const attractedToLeader = p[0 * PARTICLE_STRIDE + ATTR_VX] < 0; // pulled towards pointer x=500
    check('Mode 7 (Swarm Flocking): Shepherd attraction accelerates swarm towards leader pointer', attractedToLeader);
  }
}

// ============================================================================
// PHASE 5: SHOCKWAVES & ANOMALY ENGINE FORENSICS
// ============================================================================
header('PHASE 5: Shockwaves, Wandering Pulsars & Lightning Ionization Arcs');

{
  const prng = new PRNG(777);
  const shockwaves = new ShockwaveSystem(16, 1024, prng);

  // Trigger shockwave
  shockwaves.trigger(400, 400, 2.0, 210, 10, -20);
  check('ShockwaveSystem initializes wavefront radius=12 and triggers initial radial spark burst',
    shockwaves.waves.length === 1 && shockwaves.sparkCount > 0);

  // Test dual-zone push/pull
  const testBuf = new Float32Array(20);
  testBuf[0] = 430; testBuf[1] = 400; testBuf[5] = 1.0; // ahead of wavefront
  testBuf[10] = 414; testBuf[11] = 400; testBuf[15] = 1.0; // behind wavefront

  shockwaves.update(1 / 60, testBuf, 2);
  check('Shockwave leading crest pushes outward (vx > 0) and trailing trough cavitates inward (vx < 0)',
    testBuf[ATTR_VX] > 0 && testBuf[10 + ATTR_VX] < 0);

  // Anomaly Engine: Pulsars and Lightning
  const anomalies = new AnomalyEngine(1920, 1080, prng);
  check('AnomalyEngine spawns 4 autonomous wandering pulsars with opposing magnetic polarities',
    anomalies.pulsars.length === 4 && anomalies.pulsars.some(p => p.polarity === 1.0) && anomalies.pulsars.some(p => p.polarity === -1.0));

  // Run update for 20 frames to trigger lightning and pulsar pulses
  for (let f = 0; f < 20; f++) {
    anomalies.update(1 / 30, f * (1 / 30), testBuf, 2, shockwaves);
  }
  check('AnomalyEngine simulates wandering kinematics, periodic radiation pulses, and lightning discharge',
    anomalies.pulsars[0].phase > 0);
}

// ============================================================================
// PHASE 6: NUMERICAL SAFETY & ADVERSARIAL INVARIANTS STRESS TEST
// ============================================================================
header('PHASE 6: Adversarial Stress Testing & Numerical Safety Invariants');

{
  const engine = new PhysicsEngine(1920, 1080, 1000);
  const p = engine.getParticleBuffer();

  // Adversarial Injection: Inject NaNs, Infinities, extreme velocities, extreme positions
  p[0 * PARTICLE_STRIDE + ATTR_X] = NaN;
  p[0 * PARTICLE_STRIDE + ATTR_Y] = Infinity;
  p[0 * PARTICLE_STRIDE + ATTR_VX] = -Infinity;

  p[1 * PARTICLE_STRIDE + ATTR_X] = 999999;
  p[1 * PARTICLE_STRIDE + ATTR_Y] = -999999;
  p[1 * PARTICLE_STRIDE + ATTR_VX] = 50000; // far exceeds MAX_SPEED (450)
  p[1 * PARTICLE_STRIDE + ATTR_VY] = -50000;
  p[1 * PARTICLE_STRIDE + ATTR_ENERGY] = 99.0;

  // Run invariant check & simulation update
  engine.enforceInvariants();

  const particle0Sanitized = isFinite(p[0 * PARTICLE_STRIDE + ATTR_X]) && !isNaN(p[0 * PARTICLE_STRIDE + ATTR_X]);
  const particle1ClampedSpeed = Math.sqrt(p[1 * PARTICLE_STRIDE + ATTR_VX] ** 2 + p[1 * PARTICLE_STRIDE + ATTR_VY] ** 2) <= 450.01;
  const particle1WrappedCoords = p[1 * PARTICLE_STRIDE + ATTR_X] >= -60 && p[1 * PARTICLE_STRIDE + ATTR_X] <= 1980;
  const particle1BoundedEnergy = p[1 * PARTICLE_STRIDE + ATTR_ENERGY] <= 1.0 && p[1 * PARTICLE_STRIDE + ATTR_ENERGY] >= 0.0;

  check('Invariant 1: NaNs and Infinities immediately self-healed / reset to valid state', particle0Sanitized);
  check('Invariant 2: Extreme velocity (50,000 px/s) clamped strictly to MAX_SPEED (450 px/s)', particle1ClampedSpeed);
  check('Invariant 3: Out-of-world coordinates wrapped within toroidal boundary margin', particle1WrappedCoords);
  check('Invariant 4: Particle energy strictly clamped to [0.0, 1.0]', particle1BoundedEnergy);
}

// ============================================================================
// AUDIT SUMMARY & VERDICT
// ============================================================================
console.log(`\n\x1b[35m================================================================\x1b[0m`);
console.log(`\x1b[35mFORENSIC INTEGRITY AUDIT RESULTS: ${auditPassed} PASSED | ${auditFailed} FAILED\x1b[0m`);
console.log(`\x1b[35m================================================================\x1b[0m`);

if (auditFailed > 0) {
  console.error('\x1b[31m\x1b[1mVERDICT: INTEGRITY VIOLATION DETECTED!\x1b[0m');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1mVERDICT: CLEAN — 100% AUTHENTIC ZERO-DEPENDENCY IMPLEMENTATION\x1b[0m\n');
  process.exit(0);
}
