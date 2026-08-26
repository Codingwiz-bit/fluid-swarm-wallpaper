/**
 * Stress & Performance Benchmark Suite for Fluid Swarm V4 Milestone 1
 */

import { SimplexNoise, CurlNoise, TrigLUT } from '../src/math.js';
import { SpatialHashGrid } from '../src/spatial_grid.js';
import { PhysicsEngine } from '../src/physics.js';

console.log('\n\x1b[36m=== Fluid Swarm V4 - M1 Performance & Stress Benchmarks ===\x1b[0m\n');

// 1. Simplex & Curl Noise Throughput
{
  const sn = new SimplexNoise(1337);
  const curl = new CurlNoise(sn);
  const out = [0, 0];
  const N = 500000;

  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    curl.sampleCurl2D(i * 0.01, i * 0.02, 1.0, 2, 0.003, 0.5, 2.0, out);
  }
  const t1 = performance.now();
  const opsPerSec = (N / ((t1 - t0) / 1000)) / 1e6;
  console.log(`[Benchmark 1] 2D Curl Noise (2 octaves, analytical): ${(t1 - t0).toFixed(2)} ms for ${N.toLocaleString()} samples (${opsPerSec.toFixed(2)} M samples/sec)`);
}

// 2. TrigLUT vs Math.sin Throughput
{
  const N = 5000000;
  const t0 = performance.now();
  let s1 = 0;
  for (let i = 0; i < N; i++) {
    s1 += Math.sin(i * 0.001);
  }
  const t1 = performance.now();

  let s2 = 0;
  for (let i = 0; i < N; i++) {
    s2 += TrigLUT.fastSin(i * 0.001);
  }
  const t2 = performance.now();

  const mathSinTime = t1 - t0;
  const trigLutTime = t2 - t1;
  const speedup = mathSinTime / trigLutTime;
  console.log(`[Benchmark 2] TrigLUT fastSin: ${trigLutTime.toFixed(2)} ms vs Math.sin: ${mathSinTime.toFixed(2)} ms (${speedup.toFixed(2)}x speedup)`);
}

// 3. SpatialHashGrid 100,000 Particle Insertion & Query Benchmark
{
  const grid = new SpatialHashGrid(1920, 1080, 48, 100000);
  const buf = new Float32Array(100000 * 10);
  for (let i = 0; i < 100000; i++) {
    buf[i * 10 + 0] = Math.random() * 1920;
    buf[i * 10 + 1] = Math.random() * 1080;
  }

  const t0 = performance.now();
  grid.populate(buf, 100000, 10);
  const t1 = performance.now();

  let totalNeighborsFound = 0;
  const numQueries = 1000;
  for (let q = 0; q < numQueries; q++) {
    const qx = Math.random() * 1920;
    const qy = Math.random() * 1080;
    grid.queryNeighborsBuffer(qx, qy, 50.0, buf, 10, () => {
      totalNeighborsFound++;
    });
  }
  const t2 = performance.now();

  console.log(`[Benchmark 3] SpatialHashGrid: 100,000 particle populate in ${(t1 - t0).toFixed(2)} ms | 1,000 spatial queries (found ${totalNeighborsFound.toLocaleString()} pairs) in ${(t2 - t1).toFixed(2)} ms`);
}

// 4. 100,000 Particle Physics Engine Soak Test (Zero NaN check)
{
  const engine = new PhysicsEngine(1920, 1080, 100000);
  engine.setParticleCount(100000);
  engine.setMode(0); // Vortex Typhoon
  engine.setMouse(960, 540, true, 0, 150, -80);

  const t0 = performance.now();
  const numFrames = 30;
  for (let f = 0; f < numFrames; f++) {
    engine.update(1 / 60);
  }
  const t1 = performance.now();
  const avgFrameTime = (t1 - t0) / numFrames;

  // Invariant verification on 100k particles
  const pBuf = engine.getParticleBuffer();
  let corruptCount = 0;
  for (let i = 0; i < 100000 * 10; i++) {
    if (!isFinite(pBuf[i]) || isNaN(pBuf[i])) corruptCount++;
  }

  console.log(`[Benchmark 4] 100,000 Particle Swarm Simulation: ${avgFrameTime.toFixed(2)} ms/frame across ${numFrames} frames | Corrupt particles: ${corruptCount}`);
  if (corruptCount === 0) {
    console.log('\x1b[32m✔ 100k Particle Numerical Stability Confirmed!\x1b[0m\n');
  } else {
    console.error('\x1b[31m✖ 100k Particle Corruption Detected!\x1b[0m\n');
    process.exit(1);
  }
}
