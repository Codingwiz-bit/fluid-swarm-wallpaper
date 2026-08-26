/**
 * Fluid Swarm V4 - Cosmic & Quantum Swarm Physics Engine
 * Module: src/physics.js
 * 
 * Features:
 * - Contiguous Float32Array Structure-of-Arrays (SoA) particle buffer (up to 100,000 particles)
 *   Stride = 10: [x, y, vx, vy, size, mass, life, maxLife, speciesId, energy]
 * - 4-Species Ecosystem:
 *     Species 0: Phytoplankton (Passive curl advection, bioluminescent phosphor excitation)
 *     Species 1: Starling Boids (Reynolds flocking, Cavagna topological limit, predator panic evasion)
 *     Species 2: Void Predators (Heavy apex hunters, prey pursuit, predator territory repulsion)
 *     Species 3: Vortex Weavers (Streamline & magnetic field line tracers, cosmic ribbon guide corridors)
 * - 8 Cosmic & Quantum Physics Modes:
 *     0: Vortex Typhoon (Rankine-Coriolis torque & swirl)
 *     1: Kerr Singularity (Relativistic ergosphere, frame dragging, event horizon capture)
 *     2: Quantum Repulsor (Yukawa / Lennard-Jones elastic deflection & hard-core restitution)
 *     3: Nebula Drift (Cosmic laminar flow, Stokes drag & Brownian excitation)
 *     4: Magnetic Dipole (Lorentz force field lines for charged particles)
 *     5: Cryo Freeze (Hexagonal lattice crystallization & kinetic shatter waves)
 *     6: Strange Attractor (Clifford & Lorenz non-linear chaotic dynamics)
 *     7: Swarm Flocking (Reynolds Boid murmuration + shepherd attraction)
 * - Supersonic Blast Shockwaves System with Dual-Zone Pressure Front & Pre-allocated Spark Pool
 * - Autonomous Wandering Pulsars & Fractal Lightning Plasma Discharge Arcs
 * - Deterministic 120Hz Fixed-Timestep Accumulator & Numerical Safety Invariants (NaN/Inf protection, velocity clamping)
 */

import { SimplexNoise, CurlNoise, TrigLUT, VectorMath, PRNG, globalPRNG } from './math.js';
import { SpatialHashGrid } from './spatial_grid.js';

// Particle Buffer Layout Constants
export const PARTICLE_STRIDE = 10;
export const ATTR_X = 0;
export const ATTR_Y = 1;
export const ATTR_VX = 2;
export const ATTR_VY = 3;
export const ATTR_SIZE = 4;
export const ATTR_MASS = 5;
export const ATTR_LIFE = 6;
export const ATTR_MAX_LIFE = 7;
export const ATTR_SPECIES = 8;
export const ATTR_ENERGY = 9;

// Species IDs
export const SPECIES_PHYTOPLANKTON = 0;
export const SPECIES_STARLING_BOID = 1;
export const SPECIES_VOID_PREDATOR = 2;
export const SPECIES_VORTEX_WEAVER = 3;

// Default Species Config
export const SPECIES_CONFIG = [
  { id: 0, name: 'Phytoplankton', ratio: 0.50, mass: 0.5, size: 1.2, maxSpeed: 130, baseLife: 20.0 },
  { id: 1, name: 'Starling Boids', ratio: 0.35, mass: 1.0, size: 2.0, maxSpeed: 170, baseLife: 25.0 },
  { id: 2, name: 'Void Predators', ratio: 0.05, mass: 4.5, size: 4.0, maxSpeed: 210, baseLife: 45.0 },
  { id: 3, name: 'Vortex Weavers', ratio: 0.10, mass: 0.8, size: 2.4, maxSpeed: 240, baseLife: 30.0 }
];

// ============================================================================
// 1. SUPERSONIC BLAST SHOCKWAVE SYSTEM WITH SPARK RING BUFFER POOL
// ============================================================================

export class ShockwaveSystem {
  constructor(maxShockwaves = 16, maxSparks = 2048, prng = globalPRNG) {
    this.maxShockwaves = maxShockwaves;
    this.waves = [];
    this.maxSparks = maxSparks;
    this.prng = prng;
    // Spark buffer: [x, y, vx, vy, life, maxLife, hue, size] (8 floats per spark)
    this.sparks = new Float32Array(maxSparks * 8);
    this.sparkCount = 0;
  }

  /**
   * Triggers a supersonic shockwave at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {number} strength - Force multiplier (default 1.0)
   * @param {number} hue - Color hue for blast and sparks (0..360)
   * @param {number} initialVx - Pointer velocity X
   * @param {number} initialVy - Pointer velocity Y
   */
  trigger(x, y, strength = 1.0, hue = 180, initialVx = 0, initialVy = 0) {
    if (this.waves.length >= this.maxShockwaves) {
      this.waves.shift(); // Evict oldest
    }
    const wave = {
      x, y,
      radius: 12.0,
      maxRadius: 1600.0,
      speed: 420.0 * Math.max(0.4, strength),
      force: 180.0 * strength,
      thickness: 45.0,
      decay: 0.88,
      hue: hue,
      life: 1.0
    };
    this.waves.push(wave);

    // Initial radial spark ejection burst (48 sparks)
    const numBurstSparks = Math.min(48, this.maxSparks - this.sparkCount);
    for (let i = 0; i < numBurstSparks; i++) {
      const angle = (i / numBurstSparks) * Math.PI * 2 + (this.prng.random() - 0.5) * 0.3;
      const speed = (this.prng.random() * 220.0 + 120.0) * strength;
      const svx = TrigLUT.fastCos(angle) * speed + initialVx * 0.3;
      const svy = TrigLUT.fastSin(angle) * speed + initialVy * 0.3;
      this.emitSpark(x, y, svx, svy, hue, this.prng.random() * 2.5 + 1.2, 0.4 + this.prng.random() * 0.4);
    }
  }

  /**
   * Updates shockwave fronts and sparks, applying dual-zone forces to particles.
   */
  update(dt, particlesSoA, particleCount) {
    // 1. Update Shockwave Fronts
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.radius += w.speed * dt;
      w.force *= Math.pow(w.decay, dt * 10.0);
      w.thickness = 45.0 + w.radius * 0.08;
      w.life = Math.max(0, w.force / 180.0);

      if (w.radius > w.maxRadius || w.force < 0.5) {
        this.waves.splice(i, 1);
        continue;
      }

      // 2. Apply Dual-Zone Hydrodynamic Force to Particles
      const halfThick = w.thickness * 0.5;
      const wRadius = w.radius;
      const wForce = w.force;

      for (let p = 0; p < particleCount; p++) {
        const offset = p * PARTICLE_STRIDE;
        const px = particlesSoA[offset + ATTR_X];
        const py = particlesSoA[offset + ATTR_Y];
        const dx = px - w.x;
        const dy = py - w.y;
        const distSq = dx * dx + dy * dy + 1e-4;
        const dist = Math.sqrt(distSq);
        const delta = dist - wRadius;

        if (Math.abs(delta) < halfThick) {
          const invDist = 1.0 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;
          const mass = particlesSoA[offset + ATTR_MASS];

          if (delta >= 0) {
            // Leading Compression Crest: Outward blast push (Maximum at wavefront delta = 0)
            const frac = delta / halfThick;
            const forceCrest = (wForce * TrigLUT.fastCos(frac * Math.PI * 0.5)) / mass;
            particlesSoA[offset + ATTR_VX] += nx * forceCrest * dt * 60.0;
            particlesSoA[offset + ATTR_VY] += ny * forceCrest * dt * 60.0;
            particlesSoA[offset + ATTR_ENERGY] = Math.min(1.0, particlesSoA[offset + ATTR_ENERGY] + 0.4);
          } else {
            // Trailing Rarefaction Trough: Inward cavitation suction
            const frac = Math.abs(delta) / halfThick;
            const forceTrough = (-0.25 * wForce * TrigLUT.fastSin(frac * Math.PI)) / mass;
            particlesSoA[offset + ATTR_VX] += nx * forceTrough * dt * 60.0;
            particlesSoA[offset + ATTR_VY] += ny * forceTrough * dt * 60.0;
          }

          // Occasional spark generation on high-speed impact
          if (this.prng.random() < 0.003 && this.sparkCount < this.maxSparks) {
            this.emitSpark(px, py, particlesSoA[offset + ATTR_VX] * 0.4, particlesSoA[offset + ATTR_VY] * 0.4, w.hue, 1.6, 0.3);
          }
        }
      }
    }

    // 3. Update Pre-allocated Sparks
    for (let s = 0; s < this.sparkCount; s++) {
      const idx = s * 8;
      this.sparks[idx + 0] += this.sparks[idx + 2] * dt;
      this.sparks[idx + 1] += this.sparks[idx + 3] * dt;
      const damp = Math.pow(0.92, dt * 60.0);
      this.sparks[idx + 2] *= damp;
      this.sparks[idx + 3] *= damp;
      this.sparks[idx + 4] -= dt; // Life decrement

      if (this.sparks[idx + 4] <= 0) {
        // Swap with last active spark
        const lastIdx = (this.sparkCount - 1) * 8;
        for (let k = 0; k < 8; k++) {
          this.sparks[idx + k] = this.sparks[lastIdx + k];
        }
        this.sparkCount--;
        s--;
      }
    }
  }

  /**
   * Emits a single spark into the pre-allocated buffer pool.
   */
  emitSpark(x, y, vx, vy, hue, size, maxLife) {
    if (this.sparkCount >= this.maxSparks) return;
    const idx = this.sparkCount * 8;
    this.sparks[idx + 0] = x;
    this.sparks[idx + 1] = y;
    this.sparks[idx + 2] = vx;
    this.sparks[idx + 3] = vy;
    this.sparks[idx + 4] = maxLife;
    this.sparks[idx + 5] = maxLife;
    this.sparks[idx + 6] = hue;
    this.sparks[idx + 7] = size;
    this.sparkCount++;
  }

  clear() {
    this.waves.length = 0;
    this.sparkCount = 0;
  }
}

// ============================================================================
// 2. AUTONOMOUS WANDERING PULSARS & PLASMA LIGHTNING DISCHARGES
// ============================================================================

export class AnomalyEngine {
  constructor(width, height, prng = globalPRNG) {
    this.width = width;
    this.height = height;
    this.prng = prng;
    this.pulsars = [];
    this.lightningArcs = [];
    this.dischargeCooldown = 0.0;
    this.initPulsars(4);
  }

  initPulsars(count = 4) {
    this.pulsars = [];
    for (let i = 0; i < count; i++) {
      this.pulsars.push({
        x: this.prng.random() * this.width,
        y: this.prng.random() * this.height,
        vx: (this.prng.random() - 0.5) * 40.0,
        vy: (this.prng.random() - 0.5) * 40.0,
        radius: 220 + this.prng.random() * 100,
        mass: 3200 + this.prng.random() * 1800,
        polarity: (i % 2 === 0) ? 1.0 : -1.0, // 1 = pull, -1 = push
        phase: this.prng.random() * Math.PI * 2,
        pulseSpeed: 1.8 + this.prng.random() * 1.5,
        jetAngle: this.prng.random() * Math.PI * 2,
        jetSpin: (this.prng.random() - 0.5) * 1.2,
        color: (i % 2 === 0) ? [0.2, 0.85, 1.0] : [1.0, 0.45, 0.15]
      });
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  update(dt, globalTime, particlesSoA, particleCount, shockwaveSystem) {
    const margin = 120.0;
    const wallK = 90.0;

    // 1. Update Pulsars
    for (let i = 0; i < this.pulsars.length; i++) {
      const p = this.pulsars[i];
      p.phase += p.pulseSpeed * dt;
      p.jetAngle += p.jetSpin * dt;

      // Soft margin boundary repulsion
      if (p.x < margin) p.vx += wallK * Math.pow((margin - p.x) / margin, 2) * dt;
      if (p.x > this.width - margin) p.vx -= wallK * Math.pow((p.x - (this.width - margin)) / margin, 2) * dt;
      if (p.y < margin) p.vy += wallK * Math.pow((margin - p.y) / margin, 2) * dt;
      if (p.y > this.height - margin) p.vy -= wallK * Math.pow((p.y - (this.height - margin)) / margin, 2) * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.pow(0.99, dt * 60.0);
      p.vx *= damp;
      p.vy *= damp;

      // Periodic Radiation Flash Pulse
      const sinPhase = TrigLUT.fastSin(p.phase);
      const pulseFlash = Math.pow(Math.max(0, sinPhase), 6);
      if (pulseFlash > 0.88 && this.prng.random() < 0.15) {
        shockwaveSystem.trigger(p.x, p.y, 0.55, (p.polarity > 0 ? 200 : 35), p.vx, p.vy);
      }

      // Gravitational pull / push on nearby particles
      const pRadSq = p.radius * p.radius;
      for (let j = 0; j < particleCount; j++) {
        const offset = j * PARTICLE_STRIDE;
        const dx = p.x - particlesSoA[offset + ATTR_X];
        const dy = p.y - particlesSoA[offset + ATTR_Y];
        const distSq = dx * dx + dy * dy + 1e-4;
        if (distSq < pRadSq) {
          const dist = Math.sqrt(distSq);
          const force = ((p.mass * 18.0) / (distSq + 200.0)) * (1.0 - dist / p.radius) * p.polarity;
          particlesSoA[offset + ATTR_VX] += (dx / dist) * force * dt;
          particlesSoA[offset + ATTR_VY] += (dy / dist) * force * dt;
        }
      }
    }

    // 2. Dynamic Lightning Discharge Arcs
    this.dischargeCooldown -= dt;
    this.lightningArcs = [];

    if (this.dischargeCooldown <= 0) {
      for (let i = 0; i < this.pulsars.length; i++) {
        for (let j = i + 1; j < this.pulsars.length; j++) {
          const p1 = this.pulsars[i];
          const p2 = this.pulsars[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 520.0 && this.prng.random() < 0.45) {
            const arcSegments = this.generateFractalArc(p1, p2, 4, 38.0);
            this.lightningArcs.push({
              segments: arcSegments,
              life: 1.0,
              color: [0.85, 0.95, 1.0]
            });
            this.dischargeCooldown = 0.35 + this.prng.random() * 0.45;

            // Ionize particles intersecting arc
            this.ionizeParticlesAlongArc(arcSegments, particlesSoA, particleCount, shockwaveSystem);
          }
        }
      }
    }
  }

  generateFractalArc(p1, p2, maxDepth, displacement) {
    const stack = [{ a: { x: p1.x, y: p1.y }, b: { x: p2.x, y: p2.y }, depth: 0, disp: displacement }];
    const lines = [];

    while (stack.length > 0) {
      const seg = stack.pop();
      if (seg.depth >= maxDepth) {
        lines.push({ x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y });
        continue;
      }

      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const len = Math.sqrt(dx * dx + dy * dy + 1e-4);
      const nx = -dy / len;
      const ny = dx / len;

      const jitter = (this.prng.random() - 0.5) * seg.disp;
      const mid = {
        x: (seg.a.x + seg.b.x) * 0.5 + nx * jitter,
        y: (seg.a.y + seg.b.y) * 0.5 + ny * jitter
      };

      const nextDepth = seg.depth + 1;
      const nextDisp = seg.disp * 0.55;

      stack.push({ a: seg.a, b: mid, depth: nextDepth, disp: nextDisp });
      stack.push({ a: mid, b: seg.b, depth: nextDepth, disp: nextDisp });

      // Stochastic Branch Fork
      if (this.prng.random() < 0.20 && nextDepth < maxDepth - 1) {
        const branchAngle = (this.prng.random() - 0.5) * 0.8;
        const bx = mid.x + (dx * Math.cos(branchAngle) - dy * Math.sin(branchAngle)) * 0.35;
        const by = mid.y + (dx * Math.sin(branchAngle) + dy * Math.cos(branchAngle)) * 0.35;
        stack.push({ a: mid, b: { x: bx, y: by }, depth: nextDepth + 1, disp: nextDisp * 0.6 });
      }
    }
    return lines;
  }

  ionizeParticlesAlongArc(lines, particlesSoA, particleCount, shockwaveSystem) {
    const arcRadiusSq = 32.0 * 32.0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lx = line.x2 - line.x1;
      const ly = line.y2 - line.y1;
      const lLenSq = lx * lx + ly * ly + 1e-4;

      for (let p = 0; p < particleCount; p++) {
        const offset = p * PARTICLE_STRIDE;
        const px = particlesSoA[offset + ATTR_X];
        const py = particlesSoA[offset + ATTR_Y];

        const t = Math.max(0.0, Math.min(1.0, ((px - line.x1) * lx + (py - line.y1) * ly) / lLenSq));
        const projX = line.x1 + t * lx;
        const projY = line.y1 + t * ly;
        const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

        if (dSq < arcRadiusSq) {
          particlesSoA[offset + ATTR_VX] += (this.prng.random() - 0.5) * 80.0;
          particlesSoA[offset + ATTR_VY] += (this.prng.random() - 0.5) * 80.0;
          particlesSoA[offset + ATTR_ENERGY] = 1.0;
          if (this.prng.random() < 0.05) {
            shockwaveSystem.emitSpark(px, py, (this.prng.random() - 0.5) * 80, (this.prng.random() - 0.5) * 80, 200, 2.0, 0.35);
          }
        }
      }
    }
  }
}

// ============================================================================
// 3. CORE PHYSICS ENGINE & 120HZ DETERMINISTIC INTEGRATION
// ============================================================================

export class PhysicsEngine {
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} maxParticles (default 50,000, up to 100,000)
   */
  constructor(width = 1920, height = 1080, maxParticles = 50000, seed = 1337) {
    this.width = width;
    this.height = height;
    this.maxParticles = maxParticles;
    this.particleCount = Math.min(maxParticles, 35000);

    // Flat Float32Array SoA: [x, y, vx, vy, size, mass, life, maxLife, speciesId, energy]
    this.particles = new Float32Array(maxParticles * PARTICLE_STRIDE);

    // Subsystems
    this.prng = new PRNG(seed);
    this.simplex = new SimplexNoise(seed);
    this.curl = new CurlNoise(this.simplex);
    this.spatialGrid = new SpatialHashGrid(width, height, 48, maxParticles);
    this.shockwaves = new ShockwaveSystem(16, 2048, this.prng);
    this.anomalies = new AnomalyEngine(width, height, this.prng);

    // Fixed-Timestep Accumulator (120 Hz)
    this.FIXED_DT = 1.0 / 120.0; // 8.333 ms
    this.MAX_ACCUMULATOR = 0.100; // 100ms clamp (prevents spiral-of-death)
    this.accumulator = 0.0;
    this.lastTime = 0;
    this.globalTime = 0.0;
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;

    // Numerical Safety Limits
    this.MAX_SPEED = 450.0; // max px / sec
    this.MAX_SPEED_SQ = this.MAX_SPEED * this.MAX_SPEED;
    this.BOUND_MARGIN = 60.0;
    this.EPSILON = 1e-4;

    // Simulation Modes & Tuning Parameters
    this.currentMode = 0; // 0..7
    this.viscosity = 0.985;
    this.curlStrength = 1.0;
    this.predatorStrength = 1.0;

    // Multi-Pointer Input State
    this.pointers = new Map(); // id -> { x, y, vx, vy, isDown, button, prevX, prevY }
    this.primaryPointer = { x: -1000, y: -1000, vx: 0, vy: 0, isDown: false, button: 0 };

    this.tempVec2 = [0, 0];
    this.initParticles();
  }

  init(width, height, maxParticles = this.maxParticles) {
    this.width = width;
    this.height = height;
    this.maxParticles = maxParticles;
    this.particleCount = Math.min(this.particleCount, maxParticles);
    this.spatialGrid.resize(width, height);
    this.anomalies.resize(width, height);
    this.initParticles();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.spatialGrid.resize(width, height);
    this.anomalies.resize(width, height);
  }

  initParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.resetParticle(i, true);
    }
  }

  resetParticle(i, randomizeLife = false) {
    const off = i * PARTICLE_STRIDE;
    // Assign species according to distribution ratio
    // 50% Phyto (0), 35% Boid (1), 5% Predator (2), 10% Weaver (3)
    const r = this.prng.random();
    let species = SPECIES_PHYTOPLANKTON;
    if (r >= 0.90) species = SPECIES_VORTEX_WEAVER;
    else if (r >= 0.85) species = SPECIES_VOID_PREDATOR;
    else if (r >= 0.50) species = SPECIES_STARLING_BOID;

    const spec = SPECIES_CONFIG[species];

    this.particles[off + ATTR_X] = this.prng.random() * this.width;
    this.particles[off + ATTR_Y] = this.prng.random() * this.height;
    this.particles[off + ATTR_VX] = (this.prng.random() - 0.5) * 20.0;
    this.particles[off + ATTR_VY] = (this.prng.random() - 0.5) * 20.0;
    this.particles[off + ATTR_SIZE] = spec.size * (0.8 + this.prng.random() * 0.4);
    this.particles[off + ATTR_MASS] = spec.mass * (0.85 + this.prng.random() * 0.3);
    const maxLife = spec.baseLife * (0.7 + this.prng.random() * 0.6);
    this.particles[off + ATTR_LIFE] = randomizeLife ? this.prng.random() * maxLife : maxLife;
    this.particles[off + ATTR_MAX_LIFE] = maxLife;
    this.particles[off + ATTR_SPECIES] = species;
    this.particles[off + ATTR_ENERGY] = 0.0;
  }

  // ==========================================
  // INPUT CONTROLS & GESTURES
  // ==========================================

  setMouse(x, y, isDown = false, button = 0, vx = 0, vy = 0) {
    this.primaryPointer.x = x;
    this.primaryPointer.y = y;
    this.primaryPointer.isDown = isDown;
    this.primaryPointer.button = button;
    this.primaryPointer.vx = vx;
    this.primaryPointer.vy = vy;
  }

  addPointer(id, x, y) {
    this.pointers.set(id, { x, y, vx: 0, vy: 0, isDown: true, prevX: x, prevY: y });
  }

  updatePointer(id, x, y, vx = 0, vy = 0) {
    const ptr = this.pointers.get(id);
    if (ptr) {
      ptr.vx = vx !== 0 ? vx : (x - ptr.prevX) * 60;
      ptr.vy = vy !== 0 ? vy : (y - ptr.prevY) * 60;
      ptr.prevX = ptr.x;
      ptr.prevY = ptr.y;
      ptr.x = x;
      ptr.y = y;
      ptr.isDown = true;
    } else {
      this.pointers.set(id, { x, y, vx, vy, isDown: true, prevX: x, prevY: y });
    }
  }

  removePointer(id) {
    this.pointers.delete(id);
  }

  setMode(modeIndex) {
    this.currentMode = Math.max(0, Math.min(7, modeIndex | 0));
  }

  setTimeScale(scale) {
    this.targetTimeScale = Math.max(0.0, Math.min(3.0, scale));
  }

  setParticleCount(count) {
    this.particleCount = Math.max(100, Math.min(this.maxParticles, count | 0));
  }

  getParticleBuffer() {
    return this.particles;
  }

  getParticleCount() {
    return this.particleCount;
  }

  triggerShockwave(x, y, strength = 1.0, hue = 180) {
    this.shockwaves.trigger(x, y, strength, hue, this.primaryPointer.vx, this.primaryPointer.vy);
  }

  // ==========================================
  // SIMULATION STEPPING & 120HZ ACCUMULATOR
  // ==========================================

  /**
   * Main simulation frame update.
   * Consumes elapsed frame time through fixed 120Hz substeps.
   * @param {number} dt - Raw frame delta in seconds
   * @returns {number} Interpolation alpha [0, 1] for smooth sub-frame rendering
   */
  update(dt) {
    if (dt <= 0 || isNaN(dt)) return 0;

    // Spiral-of-death frame clamp
    const clampedDt = Math.min(dt, this.MAX_ACCUMULATOR);

    // Bullet-time smooth transition using delta time
    if (this.timeScale !== this.targetTimeScale) {
      const easeSpeed = Math.min(1.0, clampedDt * 6.0);
      this.timeScale += (this.targetTimeScale - this.timeScale) * easeSpeed;
    }

    this.accumulator += clampedDt * this.timeScale;

    // Inner 120Hz fixed substep integration
    while (this.accumulator >= this.FIXED_DT) {
      this.stepFixed(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    return this.accumulator / this.FIXED_DT;
  }

  /**
   * Performs one fixed-timestep simulation step.
   * @param {number} dt - Fixed delta time (1/120s)
   */
  stepFixed(dt) {
    this.globalTime = (this.globalTime + dt) % 100000.0;
    const p = this.particles;
    const count = this.particleCount;

    // 1. Update Autonomous Entities (Shockwaves, Pulsars, Lightning)
    this.shockwaves.update(dt, p, count);
    this.anomalies.update(dt, this.globalTime, p, count, this.shockwaves);

    // 2. Re-populate 1D Spatial Hash Grid
    this.spatialGrid.populate(p, count, PARTICLE_STRIDE);

    // 3. Integrate Particle Physics & Multi-Species Dynamics
    this.integrateParticles(dt);

    // 4. Enforce Numerical Safety Invariants
    this.enforceInvariants();
  }

  /**
   * Core numerical integration kernel for particles.
   */
  integrateParticles(dt) {
    const p = this.particles;
    const count = this.particleCount;
    const mode = this.currentMode;
    const ptr = this.primaryPointer;
    const gTime = this.globalTime;
    const curlGen = this.curl;
    const tempVec = this.tempVec2;
    const grid = this.spatialGrid;

    // Gather active pointers
    const activePointers = [];
    if (ptr.x >= 0 && ptr.y >= 0) activePointers.push(ptr);
    for (const [, pObj] of this.pointers) {
      if (pObj.isDown) activePointers.push(pObj);
    }

    for (let i = 0; i < count; i++) {
      const off = i * PARTICLE_STRIDE;
      let px = p[off + ATTR_X];
      let py = p[off + ATTR_Y];
      let vx = p[off + ATTR_VX];
      let vy = p[off + ATTR_VY];
      const mass = p[off + ATTR_MASS];
      const species = p[off + ATTR_SPECIES] | 0;

      // 1. Life Cycle & Decay
      p[off + ATTR_LIFE] -= dt;
      if (p[off + ATTR_LIFE] <= 0) {
        this.resetParticle(i, false);
        continue;
      }

      // Energy dissipation
      p[off + ATTR_ENERGY] = Math.max(0.0, p[off + ATTR_ENERGY] - 0.4 * dt);

      let ax = 0.0;
      let ay = 0.0;

      // 2. Ambient Divergence-Free Curl Noise Force
      curlGen.sampleCurl2D(px, py, gTime * 0.4, 2, 0.0025, 0.5, 2.0, tempVec);
      const curlMultiplier = (species === SPECIES_PHYTOPLANKTON ? 45.0 : (species === SPECIES_VORTEX_WEAVER ? 75.0 : 25.0)) * this.curlStrength;
      ax += tempVec[0] * curlMultiplier;
      ay += tempVec[1] * curlMultiplier;

      // 3. Multi-Species Cross-Interactions via Spatial Grid
      if (species === SPECIES_STARLING_BOID) {
        // Reynolds Flocking + Cavagna topological limit (k <= 7)
        let flockCount = 0;
        let sumVx = 0, sumVy = 0, sumPx = 0, sumPy = 0;
        let sepX = 0, sepY = 0;
        let panicX = 0, panicY = 0;

        grid.queryNeighborsBuffer(px, py, 60.0, p, PARTICLE_STRIDE, (nId, dx, dy, distSq) => {
          if (nId === i) return;
          const nOff = nId * PARTICLE_STRIDE;
          const nSpecies = p[nOff + ATTR_SPECIES] | 0;
          const d = Math.sqrt(distSq) + 1e-4;

          if (nSpecies === SPECIES_VOID_PREDATOR) {
            // Predator Panic Evasion Wave
            if (distSq < 85.0 * 85.0) {
              const panicScale = (85.0 - d) / d;
              panicX -= (dx * panicScale) * 120.0;
              panicY -= (dy * panicScale) * 120.0;
              p[off + ATTR_ENERGY] = 0.9; // Excitation glow
            }
          } else if (nSpecies === SPECIES_STARLING_BOID && flockCount < 7) {
            flockCount++;
            sumVx += p[nOff + ATTR_VX];
            sumVy += p[nOff + ATTR_VY];
            sumPx += p[nOff + ATTR_X];
            sumPy += p[nOff + ATTR_Y];

            if (distSq < 22.0 * 22.0) {
              const sepScale = (22.0 - d) / d;
              sepX -= dx * sepScale;
              sepY -= dy * sepScale;
            }
          }
        }, 12);

        if (flockCount > 0) {
          // Alignment
          const avgVx = sumVx / flockCount;
          const avgVy = sumVy / flockCount;
          ax += (avgVx - vx) * 2.4;
          ay += (avgVy - vy) * 2.4;

          // Cohesion
          const avgPx = sumPx / flockCount;
          const avgPy = sumPy / flockCount;
          ax += ((avgPx - px) / 60.0) * 1.8 * 60.0;
          ay += ((avgPy - py) / 60.0) * 1.8 * 60.0;

          // Separation
          ax += sepX * 4.2 * 60.0;
          ay += sepY * 4.2 * 60.0;
        }

        // Apply panic force
        ax += panicX;
        ay += panicY;

      } else if (species === SPECIES_VOID_PREDATOR) {
        // Apex Hunter: Hunts Boids & Phytoplankton, repels other predators
        let preyCount = 0;
        let preyComX = 0, preyComY = 0;
        let predSepX = 0, predSepY = 0;

        grid.queryNeighborsBuffer(px, py, 130.0, p, PARTICLE_STRIDE, (nId, dx, dy, distSq) => {
          if (nId === i) return;
          const nOff = nId * PARTICLE_STRIDE;
          const nSpecies = p[nOff + ATTR_SPECIES] | 0;
          const d = Math.sqrt(distSq) + 1e-4;

          if (nSpecies === SPECIES_VOID_PREDATOR) {
            if (distSq < 90.0 * 90.0) {
              const s = (90.0 - d) / d;
              predSepX -= dx * s;
              predSepY -= dy * s;
            }
          } else if (nSpecies === SPECIES_STARLING_BOID || nSpecies === SPECIES_PHYTOPLANKTON) {
            preyCount++;
            preyComX += p[nOff + ATTR_X];
            preyComY += p[nOff + ATTR_Y];

            // Energy Strike
            if (distSq < 12.0 * 12.0) {
              p[off + ATTR_ENERGY] = 1.0;
              p[nOff + ATTR_ENERGY] = 1.0;
              p[nOff + ATTR_LIFE] = Math.min(p[nOff + ATTR_LIFE], 1.0); // Devoured
            }
          }
        }, 16);

        if (preyCount > 0) {
          const targetX = preyComX / preyCount;
          const targetY = preyComY / preyCount;
          const tdx = targetX - px;
          const tdy = targetY - py;
          const tdist = Math.sqrt(tdx * tdx + tdy * tdy) + 1e-4;
          const huntSpeed = 190.0 * this.predatorStrength;
          ax += ((tdx / tdist) * huntSpeed - vx) * 3.5;
          ay += ((tdy / tdist) * huntSpeed - vy) * 3.5;
        }

        ax += predSepX * 6.0 * 60.0;
        ay += predSepY * 6.0 * 60.0;

      } else if (species === SPECIES_VORTEX_WEAVER) {
        // Streamline tracer: weaves across curl noise tangents and leaves excitation
        const weaveSpeed = 220.0;
        const targetVx = -tempVec[1] * weaveSpeed;
        const targetVy = tempVec[0] * weaveSpeed;
        ax += (targetVx - vx) * 2.8;
        ay += (targetVy - vy) * 2.8;
      }

      // 4. Interactive Cosmic Physics Modes (Modes 0..7)
      for (let ptrIdx = 0; ptrIdx < activePointers.length; ptrIdx++) {
        const curPtr = activePointers[ptrIdx];
        const pdx = px - curPtr.x;
        const pdy = py - curPtr.y;
        const distSq = pdx * pdx + pdy * pdy + 1e-4;
        const dist = Math.sqrt(distSq);

        switch (mode) {
          case 0: { // Vortex Typhoon
            const Rv = 360.0;
            const rc = 28.0;
            if (dist < Rv) {
              const s = 1.0 - (dist / Rv);
              const weight = s * s * (3.0 - 2.0 * s);
              const cross = curPtr.vx * pdy - curPtr.vy * pdx;
              const swirlDir = (Math.abs(cross) > 0.01) ? (cross > 0 ? 1 : -1) : 1;

              // Rankine vortex tangential velocity
              const vTan = 320.0 * (dist / (distSq + rc * rc)) * weight;
              const aTanX = -swirlDir * (pdy / dist) * vTan * 60.0;
              const aTanY =  swirlDir * (pdx / dist) * vTan * 60.0;

              // Inward radial suction
              const aRadX = -(pdx / dist) * 120.0 * weight;
              const aRadY = -(pdy / dist) * 120.0 * weight;

              // Coriolis torque
              const omega = 1.8 * weight;
              const aCorX =  2.0 * omega * vy;
              const aCorY = -2.0 * omega * vx;

              // Pointer momentum coupling
              const aInertX = (curPtr.vx * weight * 20.0) / mass;
              const aInertY = (curPtr.vy * weight * 20.0) / mass;

              ax += aTanX + aRadX + aCorX + aInertX;
              ay += aTanY + aRadY + aCorY + aInertY;
              p[off + ATTR_ENERGY] = Math.min(1.0, p[off + ATTR_ENERGY] + weight * 0.2);
            }
            break;
          }

          case 1: { // Kerr Singularity / Black Hole
            const Rkerr = 480.0;
            const M = 4800.0;
            const aSpin = 0.88;
            const rg = 20.0;
            const rH = rg * (1.0 + Math.sqrt(Math.max(0, 1.0 - aSpin * aSpin))); // ~37.3px

            if (dist < Rkerr) {
              const aGrav = (M * 450.0) / (distSq + aSpin * aSpin + 100.0);
              const aRadX = -(pdx / dist) * aGrav;
              const aRadY = -(pdy / dist) * aGrav;

              // Lense-Thirring frame dragging
              const delta = distSq - 2.0 * rg * dist + aSpin * aSpin;
              const omegaDrag = (2.0 * aSpin * rg * dist) / ((distSq + aSpin * aSpin) * (distSq + aSpin * aSpin) - aSpin * aSpin * delta + 100.0);
              const aDragX = -(pdy / dist) * omegaDrag * 1800.0;
              const aDragY =  (pdx / dist) * omegaDrag * 1800.0;

              // Gravitational time dilation damping
              const timeDilation = Math.sqrt(Math.max(0.05, 1.0 - (2.0 * rg / (dist + 1e-4))));
              vx *= (1.0 - (1.0 - timeDilation) * 0.15);
              vy *= (1.0 - (1.0 - timeDilation) * 0.15);

              ax += aRadX + aDragX;
              ay += aRadY + aDragY;

              if (dist < rH) {
                p[off + ATTR_LIFE] = 0; // Event horizon capture
              }
              p[off + ATTR_ENERGY] = Math.min(1.0, p[off + ATTR_ENERGY] + (1.0 - dist / Rkerr) * 0.3);
            }
            break;
          }

          case 2: { // Quantum Repulsor
            const Rshield = 280.0;
            const rCore = 38.0;
            if (dist < Rshield) {
              const s = (Rshield - dist) / Rshield;
              const fYukawa = 520.0 * (s * s) * (1.0 + rCore / dist);
              const nx = pdx / dist;
              const ny = pdy / dist;

              ax += nx * fYukawa;
              ay += ny * fYukawa;

              // Elastic restitution at hard core
              if (dist < rCore) {
                const vDotN = vx * nx + vy * ny;
                if (vDotN < 0) {
                  vx = vx - 1.88 * vDotN * nx + curPtr.vx * 0.4;
                  vy = vy - 1.88 * vDotN * ny + curPtr.vy * 0.4;
                  px = curPtr.x + nx * (rCore + 1.0);
                  py = curPtr.y + ny * (rCore + 1.0);
                  p[off + ATTR_ENERGY] = 1.0;
                }
              }
            }
            break;
          }

          case 3: { // Nebula Drift
            const Rwake = 320.0;
            if (dist < Rwake) {
              const w = Math.pow(1.0 - dist / Rwake, 2);
              const targetVx = curPtr.vx * w * 1.5;
              const targetVy = curPtr.vy * w * 1.5;
              ax += (targetVx - vx) * 1.8;
              ay += (targetVy - vy) * 1.8;
            }
            break;
          }

          case 4: { // Magnetic Dipole
            const Rmag = 440.0;
            if (dist < Rmag) {
              const thetaDipole = gTime * 0.6 + Math.atan2(curPtr.vy || 1, curPtr.vx || 0);
              const mx = 3200.0 * TrigLUT.fastCos(thetaDipole);
              const my = 3200.0 * TrigLUT.fastSin(thetaDipole);

              const rx = pdx / dist;
              const ry = pdy / dist;
              const mDotR = mx * rx + my * ry;

              const denom = distSq * dist + 12000.0;
              const Bx = (3.0 * mDotR * rx - mx) / denom;
              const By = (3.0 * mDotR * ry - my) / denom;

              const q = (species % 2 === 0) ? 1.0 : -1.0;
              ax += q * Bx * 1600.0 - q * By * vy * 0.25;
              ay += q * By * 1600.0 + q * Bx * vx * 0.25;
            }
            break;
          }

          case 5: { // Cryo Freeze (Hexagonal Lattice Crystallization)
            const Rcryo = 280.0;
            const aHex = 26.0;
            if (dist < Rcryo) {
              const quench = Math.pow(1.0 - dist / Rcryo, 2);

              // Hexagonal lattice coordinates
              const u = (0.57735 * px - 0.33333 * py) / aHex;
              const v = (0.66667 * py) / aHex;
              const uSnap = Math.round(u);
              const vSnap = Math.round(v);
              const latX = aHex * 1.73205 * (uSnap + vSnap * 0.5);
              const latY = aHex * 1.5 * vSnap;

              // Harmonic restoring spring + heavy damping
              const fSpringX = -18.0 * (px - latX) * quench * 60.0;
              const fSpringY = -18.0 * (py - latY) * quench * 60.0;
              const fDampX = -4.5 * vx * quench;
              const fDampY = -4.5 * vy * quench;

              ax += fSpringX + fDampX;
              ay += fSpringY + fDampY;

              // Shatter wave on high-speed pointer motion
              const ptrSpeed = Math.sqrt(curPtr.vx * curPtr.vx + curPtr.vy * curPtr.vy);
              if (ptrSpeed > 450.0) {
                vx += (pdx / dist) * ptrSpeed * 0.8 + (this.prng.random() - 0.5) * 80.0;
                vy += (pdy / dist) * ptrSpeed * 0.8 + (this.prng.random() - 0.5) * 80.0;
                p[off + ATTR_ENERGY] = 1.0;
              }
            }
            break;
          }

          case 6: { // Strange Attractor Chaos (Clifford & Lorenz)
            const cdx = pdx / 120.0;
            const cdy = pdy / 120.0;
            const rNorm = Math.sqrt(cdx * cdx + cdy * cdy + 1e-4);
            if (rNorm < 3.5) {
              const w = Math.pow(1.0 - rNorm / 3.5, 2);
              const a = -1.4, b = 1.6, c = 1.0, d = 0.7;
              const nextX = TrigLUT.fastSin(a * cdy) + c * TrigLUT.fastCos(a * cdx);
              const nextY = TrigLUT.fastSin(b * cdx) + d * TrigLUT.fastCos(b * cdy);

              const targetVx = (nextX - cdx) * 160.0;
              const targetVy = (nextY - cdy) * 160.0;

              ax += (targetVx - vx) * 1.6 * w;
              ay += (targetVy - vy) * 1.6 * w;
            }
            break;
          }

          case 7: { // Swarm Flocking (Pointer Shepherd Attraction)
            const Rlead = 450.0;
            if (dist < Rlead) {
              const w = 1.0 - dist / Rlead;
              ax += -(pdx / dist) * 180.0 * w;
              ay += -(pdy / dist) * 180.0 * w;
            }
            break;
          }
        }
      }

      // 5. Semi-Implicit Euler Integration
      vx += (ax / mass) * dt;
      vy += (ay / mass) * dt;

      // Friction & Viscosity drag
      const dragFactor = Math.pow(this.viscosity, dt * 60.0);
      vx *= dragFactor;
      vy *= dragFactor;

      // Update position
      px += vx * dt;
      py += vy * dt;

      p[off + ATTR_X] = px;
      p[off + ATTR_Y] = py;
      p[off + ATTR_VX] = vx;
      p[off + ATTR_VY] = vy;
    }
  }

  /**
   * Enforces 4 strict numerical safety invariants:
   * 1. Finite float validation (replaces NaNs/Infinities)
   * 2. Velocity magnitude clamping to MAX_SPEED
   * 3. Toroidal coordinate boundary wrapping with margins
   * 4. Energy bounded to [0.0, 1.0]
   */
  enforceInvariants() {
    const p = this.particles;
    const count = this.particleCount;
    const maxV_sq = this.MAX_SPEED_SQ;
    const maxV = this.MAX_SPEED;
    const w = this.width;
    const h = this.height;
    const margin = this.BOUND_MARGIN;

    for (let i = 0; i < count; i++) {
      const off = i * PARTICLE_STRIDE;
      let x = p[off + ATTR_X];
      let y = p[off + ATTR_Y];
      let vx = p[off + ATTR_VX];
      let vy = p[off + ATTR_VY];

      // Invariant 1: Finite Float Safety (NaN / Infinity check)
      if (x !== x || y !== y || vx !== vx || vy !== vy ||
          !isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)) {
        this.resetParticle(i, false);
        continue;
      }

      // Invariant 2: Velocity Clamping
      const v_sq = vx * vx + vy * vy;
      if (v_sq > maxV_sq) {
        const scale = maxV / (Math.sqrt(v_sq) + 1e-6);
        p[off + ATTR_VX] = vx * scale;
        p[off + ATTR_VY] = vy * scale;
      }

      // Invariant 3: Toroidal Coordinate Bounds Wrapping
      if (x < -margin) p[off + ATTR_X] = w + margin - 1.0;
      else if (x > w + margin) p[off + ATTR_X] = -margin + 1.0;

      if (y < -margin) p[off + ATTR_Y] = h + margin - 1.0;
      else if (y > h + margin) p[off + ATTR_Y] = -margin + 1.0;

      // Invariant 4: Energy Normalization [0.0, 1.0]
      const energy = p[off + ATTR_ENERGY];
      p[off + ATTR_ENERGY] = energy < 0 ? 0 : (energy > 1.0 ? 1.0 : energy);
    }
  }

  getSparks() {
    return this.shockwaves.sparks;
  }

  getSparkCount() {
    return this.shockwaves.sparkCount;
  }

  getShockwaves() {
    return this.shockwaves.waves;
  }

  getPulsars() {
    return this.anomalies.pulsars;
  }

  getLightningArcs() {
    return this.anomalies.lightningArcs;
  }
}
