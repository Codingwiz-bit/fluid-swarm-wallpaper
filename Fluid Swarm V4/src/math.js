/**
 * Fluid Swarm V4 - Mathematical & Computational Physics Core Engine
 * Module: src/math.js
 * 
 * Features:
 * - Deterministic Mulberry32 PRNG (Pseudo-Random Number Generator)
 * - Simplex Noise (2D, 3D, 4D) with analytical partial derivatives
 * - Divergence-Free Multi-Octave Curl Noise Fields (Zero Particle Compression)
 * - 4096-entry Fast Trigonometric Look-Up Tables (TrigLUT) with linear interpolation
 * - Perceptually uniform OKLab / Oklch color conversions and precomputed palette LUT generator
 * - Zero-GC VectorMath utilities, numerical safety regularization, and boundary wrapping
 */

// ============================================================================
// 1. DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR (PRNG)
// ============================================================================

export class PRNG {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
    this.initialSeed = this.seed;
  }

  setSeed(seed) {
    this.seed = seed >>> 0;
    this.initialSeed = this.seed;
  }

  reset() {
    this.seed = this.initialSeed;
  }

  /**
   * Generates a 32-bit pseudo-random float in [0, 1) using Mulberry32.
   */
  random() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float in range [min, max).
   */
  randomRange(min, max) {
    return min + this.random() * (max - min);
  }

  /**
   * Returns an integer in range [min, max] inclusive.
   */
  randomInt(min, max) {
    return (min + Math.floor(this.random() * (max - min + 1))) | 0;
  }

  /**
   * Box-Muller Gaussian normal distribution with specified mean and stdDev.
   */
  randomGaussian(mean = 0, stdDev = 1) {
    let u1 = this.random();
    let u2 = this.random();
    while (u1 <= 1e-15) u1 = this.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

// Global default PRNG instance
export const globalPRNG = new PRNG(1337);

// ============================================================================
// 2. SIMPLEX NOISE ENGINE WITH ANALYTICAL DERIVATIVES (2D, 3D, 4D)
// ============================================================================

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

// Gradient lookup tables
const GRAD2 = new Float32Array([
  1, 0, -1, 0, 0, 1, 0, -1,
  0.70710678, 0.70710678, -0.70710678, 0.70710678,
  0.70710678, -0.70710678, -0.70710678, -0.70710678
]);

const GRAD3 = new Float32Array([
  1, 1, 0,  -1, 1, 0,   1, -1, 0,  -1, -1, 0,
  1, 0, 1,  -1, 0, 1,   1, 0, -1,  -1, 0, -1,
  0, 1, 1,   0, -1, 1,   0, 1, -1,   0, -1, -1
]);

const GRAD4 = new Float32Array([
  0, 1, 1, 1,   0, 1, 1,-1,   0, 1,-1, 1,   0, 1,-1,-1,
  0,-1, 1, 1,   0,-1, 1,-1,   0,-1,-1, 1,   0,-1,-1,-1,
  1, 0, 1, 1,   1, 0, 1,-1,   1, 0,-1, 1,   1, 0,-1,-1,
 -1, 0, 1, 1,  -1, 0, 1,-1,  -1, 0,-1, 1,  -1, 0,-1,-1,
  1, 1, 0, 1,   1, 1, 0,-1,   1,-1, 0, 1,   1,-1, 0,-1,
 -1, 1, 0, 1,  -1, 1, 0,-1,  -1,-1, 0, 1,  -1,-1, 0,-1,
  1, 1, 1, 0,   1, 1,-1, 0,   1,-1, 1, 0,   1,-1,-1, 0,
 -1, 1, 1, 0,  -1, 1,-1, 0,  -1,-1, 1, 0,  -1,-1,-1, 0
]);

export class SimplexNoise {
  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    this.permMod32 = new Uint8Array(512);
    this.setSeed(seed);
  }

  setSeed(seed) {
    const prng = new PRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(prng.random() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 256; i++) {
      this.perm[i] = p[i];
      this.perm[256 + i] = p[i];
      this.permMod12[i] = (p[i] % 12) * 3;
      this.permMod12[256 + i] = this.permMod12[i];
      this.permMod32[i] = (p[i] % 32) * 4;
      this.permMod32[256 + i] = this.permMod32[i];
    }
  }

  /**
   * 2D Simplex Noise: returns [-1, 1]
   */
  noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1 = 0, j1 = 1;
    if (x0 > y0) { i1 = 1; j1 = 0; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = (this.perm[ii + this.perm[jj]] & 7) * 2;
    const gi1 = (this.perm[ii + i1 + this.perm[jj + j1]] & 7) * 2;
    const gi2 = (this.perm[ii + 1 + this.perm[jj + 1]] & 7) * 2;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (GRAD2[gi0] * x0 + GRAD2[gi0 + 1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (GRAD2[gi1] * x1 + GRAD2[gi1 + 1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (GRAD2[gi2] * x2 + GRAD2[gi2 + 1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * 2D Simplex Noise with Analytical Partial Derivatives
   * @param {number} x
   * @param {number} y
   * @param {Float32Array|Array} out - Output populated with [value, dNoise/dx, dNoise/dy]
   * @returns {Float32Array|Array} out
   */
  noise2DGrad(x, y, out = [0, 0, 0]) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1 = 0, j1 = 1;
    if (x0 > y0) { i1 = 1; j1 = 0; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = (this.perm[ii + this.perm[jj]] & 7) * 2;
    const gi1 = (this.perm[ii + i1 + this.perm[jj + j1]] & 7) * 2;
    const gi2 = (this.perm[ii + 1 + this.perm[jj + 1]] & 7) * 2;

    let n0 = 0, n1 = 0, n2 = 0;
    let gx = 0, gy = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const t0_2 = t0 * t0;
      const g0x = GRAD2[gi0], g0y = GRAD2[gi0 + 1];
      const q0 = g0x * x0 + g0y * y0;
      n0 = t0_2 * t0_2 * q0;
      const factor = t0 * t0_2;
      gx += factor * (t0 * g0x - 8.0 * q0 * x0);
      gy += factor * (t0 * g0y - 8.0 * q0 * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const t1_2 = t1 * t1;
      const g1x = GRAD2[gi1], g1y = GRAD2[gi1 + 1];
      const q1 = g1x * x1 + g1y * y1;
      n1 = t1_2 * t1_2 * q1;
      const factor = t1 * t1_2;
      gx += factor * (t1 * g1x - 8.0 * q1 * x1);
      gy += factor * (t1 * g1y - 8.0 * q1 * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const t2_2 = t2 * t2;
      const g2x = GRAD2[gi2], g2y = GRAD2[gi2 + 1];
      const q2 = g2x * x2 + g2y * y2;
      n2 = t2_2 * t2_2 * q2;
      const factor = t2 * t2_2;
      gx += factor * (t2 * g2x - 8.0 * q2 * x2);
      gy += factor * (t2 * g2y - 8.0 * q2 * y2);
    }

    out[0] = 70.0 * (n0 + n1 + n2);
    out[1] = 70.0 * gx;
    out[2] = 70.0 * gy;
    return out;
  }

  /**
   * 3D Simplex Noise: returns [-1, 1]
   */
  noise3D(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0 + GRAD3[gi0 + 2] * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1 + GRAD3[gi1 + 2] * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2 + GRAD3[gi2 + 2] * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      t3 *= t3;
      n3 = t3 * t3 * (GRAD3[gi3] * x3 + GRAD3[gi3 + 1] * y3 + GRAD3[gi3 + 2] * z3);
    }

    return 32.0 * (n0 + n1 + n2 + n3);
  }

  /**
   * 3D Simplex Noise with Analytical Partial Derivatives
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {Float32Array|Array} out - Output populated with [value, dNoise/dx, dNoise/dy, dNoise/dz]
   * @returns {Float32Array|Array} out
   */
  noise3DGrad(x, y, z, out = [0, 0, 0, 0]) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    let gx = 0, gy = 0, gz = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const t0_2 = t0 * t0;
      const g0x = GRAD3[gi0], g0y = GRAD3[gi0 + 1], g0z = GRAD3[gi0 + 2];
      const q0 = g0x * x0 + g0y * y0 + g0z * z0;
      n0 = t0_2 * t0_2 * q0;
      const factor = t0 * t0_2;
      gx += factor * (t0 * g0x - 8.0 * q0 * x0);
      gy += factor * (t0 * g0y - 8.0 * q0 * y0);
      gz += factor * (t0 * g0z - 8.0 * q0 * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const t1_2 = t1 * t1;
      const g1x = GRAD3[gi1], g1y = GRAD3[gi1 + 1], g1z = GRAD3[gi1 + 2];
      const q1 = g1x * x1 + g1y * y1 + g1z * z1;
      n1 = t1_2 * t1_2 * q1;
      const factor = t1 * t1_2;
      gx += factor * (t1 * g1x - 8.0 * q1 * x1);
      gy += factor * (t1 * g1y - 8.0 * q1 * y1);
      gz += factor * (t1 * g1z - 8.0 * q1 * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const t2_2 = t2 * t2;
      const g2x = GRAD3[gi2], g2y = GRAD3[gi2 + 1], g2z = GRAD3[gi2 + 2];
      const q2 = g2x * x2 + g2y * y2 + g2z * z2;
      n2 = t2_2 * t2_2 * q2;
      const factor = t2 * t2_2;
      gx += factor * (t2 * g2x - 8.0 * q2 * x2);
      gy += factor * (t2 * g2y - 8.0 * q2 * y2);
      gz += factor * (t2 * g2z - 8.0 * q2 * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const t3_2 = t3 * t3;
      const g3x = GRAD3[gi3], g3y = GRAD3[gi3 + 1], g3z = GRAD3[gi3 + 2];
      const q3 = g3x * x3 + g3y * y3 + g3z * z3;
      n3 = t3_2 * t3_2 * q3;
      const factor = t3 * t3_2;
      gx += factor * (t3 * g3x - 8.0 * q3 * x3);
      gy += factor * (t3 * g3y - 8.0 * q3 * y3);
      gz += factor * (t3 * g3z - 8.0 * q3 * z3);
    }

    out[0] = 32.0 * (n0 + n1 + n2 + n3);
    out[1] = 32.0 * gx;
    out[2] = 32.0 * gy;
    out[3] = 32.0 * gz;
    return out;
  }

  /**
   * 4D Simplex Noise: returns [-1, 1]
   */
  noise4D(x, y, z, w) {
    const s = (x + y + z + w) * F4;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const l = Math.floor(w + s);
    const t = (i + j + k + l) * G4;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const W0 = l - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;
    const w0 = w - W0;

    let c1 = (x0 > y0) ? 32 : 0;
    let c2 = (x0 > z0) ? 16 : 0;
    let c3 = (y0 > z0) ? 8 : 0;
    let c4 = (x0 > w0) ? 4 : 0;
    let c5 = (y0 > w0) ? 2 : 0;
    let c6 = (z0 > w0) ? 1 : 0;
    let c = c1 | c2 | c3 | c4 | c5 | c6;

    let i1 = 0, j1 = 0, k1 = 0, l1 = 0;
    let i2 = 0, j2 = 0, k2 = 0, l2 = 0;
    let i3 = 0, j3 = 0, k3 = 0, l3 = 0;

    // Simplex traversal by rank order
    i1 = (c & 0x20) ? 1 : 0;
    j1 = (c & 0x08) ? 1 : 0;
    k1 = (c & 0x01) ? 1 : 0;
    l1 = 0;

    // Determine traversal step coordinates
    const rankX = (x0 > y0 ? 1 : 0) + (x0 > z0 ? 1 : 0) + (x0 > w0 ? 1 : 0);
    const rankY = (y0 >= x0 ? 1 : 0) + (y0 > z0 ? 1 : 0) + (y0 > w0 ? 1 : 0);
    const rankZ = (z0 >= x0 ? 1 : 0) + (z0 >= y0 ? 1 : 0) + (z0 > w0 ? 1 : 0);
    const rankW = (w0 >= x0 ? 1 : 0) + (w0 >= y0 ? 1 : 0) + (w0 >= z0 ? 1 : 0);

    i1 = rankX >= 3 ? 1 : 0;
    j1 = rankY >= 3 ? 1 : 0;
    k1 = rankZ >= 3 ? 1 : 0;
    l1 = rankW >= 3 ? 1 : 0;

    i2 = rankX >= 2 ? 1 : 0;
    j2 = rankY >= 2 ? 1 : 0;
    k2 = rankZ >= 2 ? 1 : 0;
    l2 = rankW >= 2 ? 1 : 0;

    i3 = rankX >= 1 ? 1 : 0;
    j3 = rankY >= 1 ? 1 : 0;
    k3 = rankZ >= 1 ? 1 : 0;
    l3 = rankW >= 1 ? 1 : 0;

    const x1 = x0 - i1 + G4;
    const y1 = y0 - j1 + G4;
    const z1 = z0 - k1 + G4;
    const w1 = w0 - l1 + G4;

    const x2 = x0 - i2 + 2.0 * G4;
    const y2 = y0 - j2 + 2.0 * G4;
    const z2 = z0 - k2 + 2.0 * G4;
    const w2 = w0 - l2 + 2.0 * G4;

    const x3 = x0 - i3 + 3.0 * G4;
    const y3 = y0 - j3 + 3.0 * G4;
    const z3 = z0 - k3 + 3.0 * G4;
    const w3 = w0 - l3 + 3.0 * G4;

    const x4 = x0 - 1.0 + 4.0 * G4;
    const y4 = y0 - 1.0 + 4.0 * G4;
    const z4 = z0 - 1.0 + 4.0 * G4;
    const w4 = w0 - 1.0 + 4.0 * G4;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const ll = l & 255;

    const gi0 = this.permMod32[ii + this.perm[jj + this.perm[kk + this.perm[ll]]]];
    const gi1 = this.permMod32[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1 + this.perm[ll + l1]]]];
    const gi2 = this.permMod32[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2 + this.perm[ll + l2]]]];
    const gi3 = this.permMod32[ii + i3 + this.perm[jj + j3 + this.perm[kk + k3 + this.perm[ll + l3]]]];
    const gi4 = this.permMod32[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1 + this.perm[ll + 1]]]];

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0, n4 = 0;

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0 - w0*w0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * (GRAD4[gi0] * x0 + GRAD4[gi0+1] * y0 + GRAD4[gi0+2] * z0 + GRAD4[gi0+3] * w0);
    }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1 - w1*w1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * (GRAD4[gi1] * x1 + GRAD4[gi1+1] * y1 + GRAD4[gi1+2] * z1 + GRAD4[gi1+3] * w1);
    }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2 - w2*w2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * (GRAD4[gi2] * x2 + GRAD4[gi2+1] * y2 + GRAD4[gi2+2] * z2 + GRAD4[gi2+3] * w2);
    }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3 - w3*w3;
    if (t3 > 0) {
      t3 *= t3;
      n3 = t3 * t3 * (GRAD4[gi3] * x3 + GRAD4[gi3+1] * y3 + GRAD4[gi3+2] * z3 + GRAD4[gi3+3] * w3);
    }

    let t4 = 0.6 - x4*x4 - y4*y4 - z4*z4 - w4*w4;
    if (t4 > 0) {
      t4 *= t4;
      n4 = t4 * t4 * (GRAD4[gi4] * x4 + GRAD4[gi4+1] * y4 + GRAD4[gi4+2] * z4 + GRAD4[gi4+3] * w4);
    }

    return 27.0 * (n0 + n1 + n2 + n3 + n4);
  }
}

// Global default SimplexNoise instance
export const globalSimplex = new SimplexNoise(1337);

// ============================================================================
// 3. DIVERGENCE-FREE CURL NOISE TURBULENCE FIELD
// ============================================================================

export class CurlNoise {
  constructor(simplex = globalSimplex) {
    this.simplex = simplex;
    this._gradBuffer = new Float32Array(4);
    this._gradBuffer1 = new Float32Array(4);
    this._gradBuffer2 = new Float32Array(4);
    this._gradBuffer3 = new Float32Array(4);
  }

  /**
   * 2D Divergence-Free Curl Noise from scalar potential field:
   *   vx =  d(Psi)/dy
   *   vy = -d(Psi)/dx
   * Div(v) = d(vx)/dx + d(vy)/dy = d^2(Psi)/dxdy - d^2(Psi)/dydx == 0
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} t - Time evolution parameter
   * @param {number} octaves - Fractal noise octave count (1..4)
   * @param {number} scale - Spatial frequency multiplier
   * @param {number} persistence - Octave amplitude decay factor
   * @param {number} lacunarity - Octave frequency step factor
   * @param {Float32Array|Array} out - Output vector [vx, vy]
   * @returns {Float32Array|Array} out
   */
  sampleCurl2D(x, y, t = 0, octaves = 3, scale = 0.003, persistence = 0.5, lacunarity = 2.0, out = [0, 0]) {
    let vx = 0, vy = 0;
    let freq = scale;
    let amp = 1.0;
    const gb = this._gradBuffer;

    for (let o = 0; o < octaves; o++) {
      this.simplex.noise3DGrad(x * freq, y * freq, t * freq * 0.5, gb);
      // Curl operator: dPsi/dy -> vx, -dPsi/dx -> vy
      vx += gb[2] * amp * freq;
      vy -= gb[1] * amp * freq;
      freq *= lacunarity;
      amp *= persistence;
    }

    out[0] = vx;
    out[1] = vy;
    return out;
  }

  /**
   * 3D Divergence-Free Curl Noise from 3D Vector Potential Psi = (Psi1, Psi2, Psi3):
   *   vx = dPsi3/dy - dPsi2/dz
   *   vy = dPsi1/dz - dPsi3/dx
   *   vz = dPsi2/dx - dPsi1/dy
   */
  sampleCurl3D(x, y, z, octaves = 2, scale = 0.003, persistence = 0.5, lacunarity = 2.0, out = [0, 0, 0]) {
    let vx = 0, vy = 0, vz = 0;
    let freq = scale;
    let amp = 1.0;
    const gb1 = this._gradBuffer1;
    const gb2 = this._gradBuffer2;
    const gb3 = this._gradBuffer3;

    for (let o = 0; o < octaves; o++) {
      const sx = x * freq, sy = y * freq, sz = z * freq;
      this.simplex.noise3DGrad(sx, sy, sz, gb1);
      this.simplex.noise3DGrad(sx + 31.4159, sy + 47.1238, sz + 62.8318, gb2);
      this.simplex.noise3DGrad(sx + 78.5398, sy + 94.2477, sz + 15.7079, gb3);

      vx += (gb3[2] - gb2[3]) * amp * freq;
      vy += (gb1[3] - gb3[1]) * amp * freq;
      vz += (gb2[1] - gb1[2]) * amp * freq;

      freq *= lacunarity;
      amp *= persistence;
    }

    out[0] = vx;
    out[1] = vy;
    out[2] = vz;
    return out;
  }

  /**
   * Sample multi-octave scalar potential directly.
   */
  samplePotential2D(x, y, t = 0, octaves = 3, scale = 0.003, persistence = 0.5, lacunarity = 2.0) {
    let pot = 0;
    let freq = scale;
    let amp = 1.0;
    for (let o = 0; o < octaves; o++) {
      pot += this.simplex.noise3D(x * freq, y * freq, t * freq * 0.5) * amp;
      freq *= lacunarity;
      amp *= persistence;
    }
    return pot;
  }
}

// Global default CurlNoise instance
export const globalCurl = new CurlNoise(globalSimplex);

// ============================================================================
// 4. PRECOMPUTED 4096-ENTRY TRIGONOMETRIC LOOK-UP TABLE (TrigLUT)
// ============================================================================

const LUT_SIZE = 4096;
const TWO_PI = Math.PI * 2;
const RAD_TO_INDEX = LUT_SIZE / TWO_PI;
const SIN_LUT = new Float32Array(LUT_SIZE);
const COS_LUT = new Float32Array(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {
  const theta = (i / LUT_SIZE) * TWO_PI;
  SIN_LUT[i] = Math.sin(theta);
  COS_LUT[i] = Math.cos(theta);
}

export const TrigLUT = {
  /**
   * Fast branchless sine lookup (~3x speedup over Math.sin)
   */
  fastSin(rad) {
    const idx = (Math.floor(rad * RAD_TO_INDEX) & 4095);
    return SIN_LUT[idx];
  },

  /**
   * Fast branchless cosine lookup
   */
  fastCos(rad) {
    const idx = (Math.floor(rad * RAD_TO_INDEX) & 4095);
    return COS_LUT[idx];
  },

  /**
   * Fast simultaneous sine and cosine calculation
   */
  fastSinCos(rad, out = [0, 0]) {
    const idx = (Math.floor(rad * RAD_TO_INDEX) & 4095);
    out[0] = SIN_LUT[idx];
    out[1] = COS_LUT[idx];
    return out;
  },

  /**
   * High-precision linearly interpolated sine (maximum error < 3.3e-7)
   */
  fastSinLerp(rad) {
    const val = rad * RAD_TO_INDEX;
    const i0 = Math.floor(val);
    const frac = val - i0;
    const idx0 = i0 & 4095;
    const idx1 = (idx0 + 1) & 4095;
    return SIN_LUT[idx0] + (SIN_LUT[idx1] - SIN_LUT[idx0]) * frac;
  },

  /**
   * High-precision linearly interpolated cosine
   */
  fastCosLerp(rad) {
    const val = rad * RAD_TO_INDEX;
    const i0 = Math.floor(val);
    const frac = val - i0;
    const idx0 = i0 & 4095;
    const idx1 = (idx0 + 1) & 4095;
    return COS_LUT[idx0] + (COS_LUT[idx1] - COS_LUT[idx0]) * frac;
  },

  /**
   * Fast rational polynomial approximation for atan2(y, x)
   */
  fastAtan2(y, x) {
    if (x === 0 && y === 0) return 0;
    const ax = Math.abs(x), ay = Math.abs(y);
    const a = Math.min(ax, ay) / (Math.max(ax, ay) + 1e-12);
    const s = a * a;
    let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
    if (ay > ax) r = 1.5707963267948966 - r;
    if (x < 0) r = 3.141592653589793 - r;
    if (y < 0) r = -r;
    return r;
  }
};

// ============================================================================
// 5. COLOR MATH & PERCEPTUALLY UNIFORM OKLAB CONVERSIONS
// ============================================================================

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
}

export const ColorMath = {
  /**
   * Fast HSV to RGB conversion
   * @param {number} h - Hue in [0, 360)
   * @param {number} s - Saturation in [0, 1]
   * @param {number} v - Value/Brightness in [0, 1]
   * @param {Float32Array|Array} out - Output [r, g, b] in [0, 1]
   */
  hsvToRgb(h, s, v, out = [0, 0, 0]) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const hPrime = h / 60.0;
    const x = c * (1.0 - Math.abs((hPrime % 2) - 1.0));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;
    const hi = hPrime | 0;

    switch (hi) {
      case 0: r1 = c; g1 = x; b1 = 0; break;
      case 1: r1 = x; g1 = c; b1 = 0; break;
      case 2: r1 = 0; g1 = c; b1 = x; break;
      case 3: r1 = 0; g1 = x; b1 = c; break;
      case 4: r1 = x; g1 = 0; b1 = c; break;
      default: r1 = c; g1 = 0; b1 = x; break;
    }

    out[0] = r1 + m;
    out[1] = g1 + m;
    out[2] = b1 + m;
    return out;
  },

  /**
   * Fast HSL to RGB conversion
   * @param {number} h - Hue in [0, 360)
   * @param {number} s - Saturation in [0, 1]
   * @param {number} l - Lightness in [0, 1]
   * @param {Float32Array|Array} out - Output [r, g, b] in [0, 1]
   */
  hslToRgb(h, s, l, out = [0, 0, 0]) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1.0 - l);
    const f = (n) => {
      const k = (n + h / 30.0) % 12.0;
      return l - a * Math.max(-1.0, Math.min(k - 3.0, Math.min(9.0 - k, 1.0)));
    };
    out[0] = f(0);
    out[1] = f(8);
    out[2] = f(4);
    return out;
  },

  /**
   * Converts sRGB [0, 1] to OKLab [L, a, b]
   */
  rgbToOklab(r, g, b, out = [0, 0, 0]) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    out[0] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    out[1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return out;
  },

  /**
   * Converts OKLab [L, a, b] to sRGB [0, 1]
   */
  oklabToRgb(L, a, b, out = [0, 0, 0]) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    out[0] = Math.max(0, Math.min(1, linearToSrgb(lr)));
    out[1] = Math.max(0, Math.min(1, linearToSrgb(lg)));
    out[2] = Math.max(0, Math.min(1, linearToSrgb(lb)));
    return out;
  },

  /**
   * Converts OKLab [L, a, b] to Oklch [L, C, h]
   */
  oklabToOklch(L, a, b, out = [0, 0, 0]) {
    const C = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * (180.0 / Math.PI);
    if (h < 0) h += 360.0;
    out[0] = L;
    out[1] = C;
    out[2] = h;
    return out;
  },

  /**
   * Converts Oklch [L, C, h] to OKLab [L, a, b]
   */
  oklchToOklab(L, C, h, out = [0, 0, 0]) {
    const hRad = h * (Math.PI / 180.0);
    out[0] = L;
    out[1] = C * Math.cos(hRad);
    out[2] = C * Math.sin(hRad);
    return out;
  },

  /**
   * Smooth perceptual blend between two sRGB colors in OKLab space
   */
  lerpOklab(r1, g1, b1, r2, g2, b2, t, out = [0, 0, 0]) {
    const lab1 = new Float32Array(3);
    const lab2 = new Float32Array(3);
    this.rgbToOklab(r1, g1, b1, lab1);
    this.rgbToOklab(r2, g2, b2, lab2);

    const L = lab1[0] + (lab2[0] - lab1[0]) * t;
    const a = lab1[1] + (lab2[1] - lab1[1]) * t;
    const b = lab1[2] + (lab2[2] - lab1[2]) * t;

    return this.oklabToRgb(L, a, b, out);
  },

  /**
   * Generates a precomputed flat Float32Array(size * 4) RGBA palette LUT from color stops
   */
  createPaletteLUT(colorStops, size = 256) {
    const lut = new Float32Array(size * 4);
    const tempRgb = [0, 0, 0];

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      let stopA = colorStops[0];
      let stopB = colorStops[colorStops.length - 1];

      for (let s = 0; s < colorStops.length - 1; s++) {
        if (t >= colorStops[s].pos && t <= colorStops[s + 1].pos) {
          stopA = colorStops[s];
          stopB = colorStops[s + 1];
          break;
        }
      }

      const segmentSpan = stopB.pos - stopA.pos;
      const segmentT = segmentSpan <= 1e-7 ? 0 : (t - stopA.pos) / segmentSpan;
      this.lerpOklab(stopA.r, stopA.g, stopA.b, stopB.r, stopB.g, stopB.b, segmentT, tempRgb);

      const offset = i * 4;
      lut[offset + 0] = tempRgb[0];
      lut[offset + 1] = tempRgb[1];
      lut[offset + 2] = tempRgb[2];
      lut[offset + 3] = stopA.a !== undefined && stopB.a !== undefined ? (stopA.a + (stopB.a - stopA.a) * segmentT) : 1.0;
    }
    return lut;
  }
};

// ============================================================================
// 6. VECTOR MATH & NUMERICAL SAFETY REGULARIZATION ROUTINES
// ============================================================================

export const VectorMath = {
  /**
   * Squared Euclidean distance
   */
  distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  },

  /**
   * Euclidean distance
   */
  dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Fast inverse square root
   */
  fastInvSqrt(n) {
    return 1.0 / Math.sqrt(n);
  },

  /**
   * Epsilon-regularized inverse distance: 1 / sqrt(dx^2 + dy^2 + eps^2)
   */
  invDist(dx, dy, eps = 1e-4) {
    return 1.0 / Math.sqrt(dx * dx + dy * dy + eps * eps);
  },

  /**
   * Safe vector normalization with division guard
   */
  safeNormalize(vx, vy, out = [0, 0], eps = 1e-6) {
    const lenSq = vx * vx + vy * vy;
    if (lenSq < eps * eps) {
      out[0] = 0;
      out[1] = 0;
      return 0;
    }
    const len = Math.sqrt(lenSq);
    const invLen = 1.0 / len;
    out[0] = vx * invLen;
    out[1] = vy * invLen;
    return len;
  },

  /**
   * Clamps vector speed magnitude to maxSpeed
   */
  clampSpeed(vx, vy, maxSpeed, out = [0, 0]) {
    const speedSq = vx * vx + vy * vy;
    if (speedSq > maxSpeed * maxSpeed) {
      const scale = maxSpeed / Math.sqrt(speedSq);
      out[0] = vx * scale;
      out[1] = vy * scale;
    } else {
      out[0] = vx;
      out[1] = vy;
    }
    return out;
  },

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /**
   * Clamps value between min and max
   */
  clamp(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  },

  /**
   * Clamps value to [0, 1]
   */
  clamp01(val) {
    return val < 0 ? 0 : (val > 1 ? 1 : val);
  },

  /**
   * Hermite smoothstep
   */
  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
  },

  /**
   * Perlin smootherstep
   */
  smootherstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  },

  /**
   * Toroidal coordinate wrapping
   */
  wrapCoord(val, max) {
    const rem = val % max;
    return rem < 0 ? rem + max : rem;
  },

  /**
   * Reflective boundary bounce with elasticity loss
   */
  bounceCoord(pos, vel, min, max, elasticity = 0.8, out = [0, 0]) {
    if (pos < min) {
      out[0] = min + (min - pos);
      out[1] = -vel * elasticity;
    } else if (pos > max) {
      out[0] = max - (pos - max);
      out[1] = -vel * elasticity;
    } else {
      out[0] = pos;
      out[1] = vel;
    }
    return out;
  }
};
