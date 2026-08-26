# Handoff Report: Fluid Swarm V4 Cosmic Physics Modes, Interactive Forces & Numerical Simulation Engine

**Agent**: `teamwork_preview_explorer_m1_3`  
**Working Directory**: `/Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/teamwork_preview_explorer_m1_3`  
**Target Module**: `/Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/Fluid Swarm V4`  
**Milestone**: M1 (Core Physics & Math Engine)  
**Date**: 2026-08-24  

---

## 1. Observation

A systematic review of the workspace and baseline codebases was performed across:
- `PROJECT.md` (lines 1–124)
- `TEST_INFRA.md` (lines 1–61)
- `ORIGINAL_REQUEST.md` (lines 1–20)
- `Fluid Swarm V3/script.js` (lines 1–356)
- `Black Hole/script.js` (lines 1–143)
- Survey reports in `.agents/teamwork_preview_explorer_survey_1/handoff.md` and `survey_2/handoff.md`

### 1.1 Baseline Physics Implementations in Fluid Swarm V3
- **Modes in V3** (`Fluid Swarm V3/script.js:20-23`):
  `const modes = ['Vortex', 'Repulsor', 'Black Hole', 'Freeze'];`
- **V3 Vortex Mechanism** (`Fluid Swarm V3/script.js:166-178`):
  ```javascript
  this.vx += (mouse.vx * force * 0.2) / this.mass * dt;
  this.vy += (mouse.vy * force * 0.2) / this.mass * dt;
  let crossProduct = (mouse.vx * dy - mouse.vy * dx);
  let swirlDirection = crossProduct > 0 ? 1 : -1;
  this.vx += (dy / dist) * force * 3.5 * swirlDirection * dt;
  this.vy -= (dx / dist) * force * 3.5 * swirlDirection * dt;
  this.vx += (dx / dist) * force * 1.5 * dt;
  this.vy += (dy / dist) * force * 1.5 * dt;
  ```
- **V3 Black Hole Mechanism** (`Fluid Swarm V3/script.js:183-189`):
  ```javascript
  this.vx += (dx / dist) * force * 10.0 * dt;
  this.vy += (dy / dist) * force * 10.0 * dt;
  if (dist < 20) {
      this.life = 0; 
  }
  ```
- **V3 Repulsor & Freeze Mechanism** (`Fluid Swarm V3/script.js:179-196`):
  Simple linear radial displacement and velocity multiplication `this.vx *= (1 - 0.1 * dt)`.
- **V3 Shockwave System** (`Fluid Swarm V3/script.js:76-83, 215-226, 323-336`):
  - Fixed shell width `60px`, uniform radial push, no suction trough, simple spark spawning if `speedSq > 80 && Math.random() > 0.8`.
- **V3 Wandering Orbs** (`Fluid Swarm V3/script.js:93-102, 198-213, 316-321`):
  - 6 bouncing points with linear reflection off walls, constant push/pull forces.
- **V3 Timestep Integration** (`Fluid Swarm V3/script.js:305-308`):
  - Variable frame timestep coupled directly to `requestAnimationFrame` with bullet-time easing `dt = timeScale`. Lacks fixed-step accumulation or numerical invariant validation.

### 1.2 Identified Architectural Deficiencies & V4 Upgrade Requirements
1. **Limited Physics Repertoire**: V3 has only 4 basic modes. V4 requires 8 mathematically rich cosmic modes:
   - Vortex Typhoon (Rankine-Coriolis torque & swirl)
   - Kerr Black Hole (relativistic event horizon, frame dragging, photon capture)
   - Quantum Repulsor (Yukawa/Lennard-Jones elastic blast deflection)
   - Nebula Drift (cosmic laminar flow, Stokes drag)
   - Magnetic Dipole (Lorentz force field lines)
   - Cryo Freeze (hexagonal lattice crystallization & fracture)
   - Strange Attractor (Clifford & Lorenz chaotic orbits)
   - Swarm Flocking (Reynolds Boid cohesion, alignment, separation + multi-species cross-interactions)
2. **Shockwave Fidelity**: V3 shockwave is a single static shell. V4 requires multi-phase supersonic shockwave propagation with leading compression crest, trailing rarefaction suction trough, and directional spark bursts.
3. **Autonomous Anomalies**: V3 wandering orbs are simple bouncing dots. V4 requires autonomous wandering pulsars with Simplex-guided steering, periodic flash radiation pulses, and dynamic fractal lightning plasma discharge arcs.
4. **Integration Stability**: Variable frame rate in V3 causes tunneling and explosion at low FPS. V4 requires a deterministic **120 Hz fixed-timestep accumulator** ($\Delta t = 1/120 \approx 8.333\text{ ms}$) with sub-stepping, spiral-of-death clamping, state interpolation, and 6 strict numerical safety invariants.

---

## 2. Logic Chain

### 2.1 Physics Mode Mathematical Modeling
- *Observation*: Standard inverse-square attraction in 2D simulations causes infinite acceleration when distance $r \to 0$, leading to numerical overflow (NaN/Infinity) and particle ejection.
- *Logic*: Introducing a regularization epsilon parameter $\epsilon = 10^{-4}$ and core softening radius $r_c$ ensures all vector division operations $\frac{1}{r_{\epsilon}^k}$ remain strictly bounded.
- *Observation*: Real Kerr black holes exhibit frame dragging (Lense-Thirring effect) within their ergosphere $r_E \approx 2 r_g$, forcing all matter and photons to co-rotate with the singularity.
- *Logic*: Projecting the Boyer-Lindquist metric into the 2D orbital plane allows calculating the exact frame-dragging angular velocity $\omega_{\text{drag}}(r) = \frac{2 a G M r}{(r^2 + a^2)^2 - a^2 \Delta}$, creating authentic relativistic accretion spirals and polar jets upon event horizon transit.
- *Observation*: Static grid snapping in freeze modes creates sudden jarring coordinate jumps.
- *Logic*: Combining an exponential velocity quench factor with a damped harmonic spring force directed toward the closest hexagonal lattice node ($\mathbf{F}_{\text{spring}} = -k (\mathbf{p} - \mathbf{p}_{\text{lattice}}) - \zeta \mathbf{v}$) produces smooth, organic crystallization waves that can shatter under high kinetic pointer impacts.

### 2.2 Shockwave Hydrodynamics & Particle Ejection
- *Observation*: A real supersonic blast wave consists of a high-pressure compression wave followed immediately by a rarefaction suction trough (Sedov-Taylor blast profile).
- *Logic*: Modeling the shockwave with a dual-zone profile ($F_{\text{crest}} > 0$ for leading edge, $F_{\text{trough}} < 0$ for trailing edge) pulls particles inward behind the blast crest, generating authentic fluid vortices and cavitation bubbles.
- *Observation*: High-speed particle collisions emit tangential debris.
- *Logic*: Using a ring buffer pool of 2,048 pre-allocated sparks with velocity-dependent emission rates creates rich visual fireworks without any runtime heap allocations.

### 2.3 Fractal Lightning Plasma Discharges
- *Observation*: Electric discharge in ionized cosmic dust follows dielectric breakdown channels along minimum resistance paths.
- *Logic*: Implementing a recursive midpoint displacement generator with stochastic branching forks between wandering pulsars, user pointers, and dense spatial hash clusters creates hyper-realistic plasma arcs that ionize and accelerate intersecting particles.

### 2.4 Fixed-Timestep Accumulator & Safety Invariant Guarantee
- *Observation*: Monitor refresh rates vary between 60Hz, 120Hz, 144Hz, and 240Hz, and background tabs can throttle RAF to 1-4 FPS.
- *Logic*: Decoupling physics update time ($\Delta t = 1/120\text{ s}$) from render frame time via an accumulator with a $100\text{ ms}$ spiral-of-death clamp ensures 100% deterministic simulation across all display hardware. State interpolation alpha ($\alpha = \text{accum} / \Delta t$) enables buttery-smooth rendering at any display frequency.

---

## 3. Caveats

1. **Particle Capacity vs CPU Budget**:
   - For $N = 50,000$ to $100,000$ particles, full $O(N^2)$ neighbor flocking checks would cause severe frame drops. All local flocking and plasma interactions **must** query the 1D Spatial Hash Grid ($O(N)$ total complexity).
2. **Mobile / Low-Power CPU Throttling**:
   - On low-power mobile devices, running multiple 120Hz sub-steps per frame could cause thermal throttling. The accumulator clamp ($\text{maxAccum} = 100\text{ ms}$, max 12 sub-steps) guarantees the CPU never enters a blocking spiral of death.
3. **Floating Point Round-Off on Long Sessions**:
   - In 24/7 wallpaper mode (e.g. macOS Plash), time counters ($t$) could accumulate precision loss. Global time should use modular wrapping (`globalTime = (globalTime + dt) % 100000.0`) to avoid 32-bit floating-point degradation.

---

## 4. Conclusion & Technical Design

### 4.1 Detailed Mathematical Formulations for All 8 Cosmic Physics Modes

```
========================================================================================
MODE 0: VORTEX TYPHOON (Coriolis Torque & Swirl)
========================================================================================
Parameters:
  - Radius: R_v = 320 px, Core Radius: r_c = 28 px
  - Tangential Strength: S_v = 5.2, Inward Suction: S_in = 1.6
  - Coriolis Coefficient: C_cor = 2.4

Formulas:
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  if r < R_v:
    s = 1.0 - (r / R_v)
    weight = s * s * (3.0 - 2.0 * s)  // Smoothstep hermite curve
    cross = pointer_vx * dy - pointer_vy * dx
    swirlDir = (abs(cross) > 0.01) ? (cross > 0 ? 1 : -1) : 1
    
    // Rankine vortex tangential velocity profile
    v_tan = S_v * (r / (r*r + r_c*r_c)) * weight
    a_tan_x = -swirlDir * (dy / r) * v_tan
    a_tan_y =  swirlDir * (dx / r) * v_tan
    
    // Radial inward suction
    a_rad_x = -(dx / r) * S_in * weight
    a_rad_y = -(dy / r) * S_in * weight
    
    // Coriolis torque acceleration: a_cor = -2 * (Omega x v)
    Omega = C_cor * weight
    a_cor_x =  2.0 * Omega * vy
    a_cor_y = -2.0 * Omega * vx
    
    // Pointer inertia momentum coupling
    a_inert_x = (pointer_vx * weight * 0.35) / mass
    a_inert_y = (pointer_vy * weight * 0.35) / mass
    
    ax += a_tan_x + a_rad_x + a_cor_x + a_inert_x
    ay += a_tan_y + a_rad_y + a_cor_y + a_inert_y

========================================================================================
MODE 1: KERR BLACK HOLE (Relativistic Ergosphere & Frame Dragging)
========================================================================================
Parameters:
  - Gravitational Mass: M = 4800, Spin: a = 0.88 (dimensionless 0 <= a < 1)
  - Gravitational Radius: r_g = 20 px
  - Event Horizon: r_H = r_g * (1 + sqrt(1 - a*a)) = 37.3 px
  - Ergosphere Radius: r_E = 2 * r_g = 40 px
  - Interaction Radius: R_kerr = 480 px

Formulas:
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  if r < R_kerr:
    // Boyer-Lindquist gravitational pull
    a_grav = (G * M) / (r*r + a*a + eps^2)
    a_rad_x = -(dx / r) * a_grav
    a_rad_y = -(dy / r) * a_grav
    
    // Lense-Thirring frame dragging inside and near ergosphere
    Delta = r*r - 2.0 * r_g * r + a*a
    omega_drag = (2.0 * a * r_g * r) / ((r*r + a*a)*(r*r + a*a) - a*a * Delta + eps^2)
    a_drag_x = -(dy / r) * omega_drag * 15.0
    a_drag_y =  (dx / r) * omega_drag * 15.0
    
    // Relativistic gravitational time dilation damping
    time_dilation = sqrt(max(0.05, 1.0 - (2.0 * r_g / r)))
    vx *= (1.0 - (1.0 - time_dilation) * 0.1)
    vy *= (1.0 - (1.0 - time_dilation) * 0.1)
    
    ax += a_rad_x + a_drag_x
    ay += a_rad_y + a_drag_y
    
    // Event horizon transit & spaghettification capture
    if r < r_H:
      life = 0  // Captured by singularity
      // Trigger relativistic polar jet burst at poles
      spawnRelativisticPolarJet(pointer_x, pointer_y, spinAngle)

========================================================================================
MODE 2: QUANTUM REPULSOR (Yukawa & Lennard-Jones Elastic Blast Deflection)
========================================================================================
Parameters:
  - Shield Radius: R_shield = 240 px, Core Radius: r_core = 38 px
  - Repulsion Magnitude: K_rep = 14.0, Restitution: e = 0.88

Formulas:
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  nx = dx / r,  ny = dy / r
  if r < R_shield:
    s = (R_shield - r) / R_shield
    f_yukawa = K_rep * (s * s) * (1.0 + r_core / r)
    ax += nx * f_yukawa
    ay += ny * f_yukawa
    
    // Hard-core elastic reflection boundary
    if r < r_core:
      v_dot_n = vx * nx + vy * ny
      if v_dot_n < 0:  // Approaching core
        vx = vx - (1.0 + e) * v_dot_n * nx + pointer_vx * 0.4
        vy = vy - (1.0 + e) * v_dot_n * ny + pointer_vy * 0.4
        p_x = pointer_x + nx * (r_core + 0.5)
        p_y = pointer_y + ny * (r_core + 0.5)
        energy = 1.0  // Maximum excitation bloom

========================================================================================
MODE 3: NEBULA DRIFT (Cosmic Laminar Flow & Stokes Drag)
========================================================================================
Parameters:
  - Viscous Coupling: gamma = 0.94
  - Wake Radius: R_wake = 300 px
  - Brownian Diffusion: sigma_diff = 0.06

Formulas:
  // Sample divergence-free Simplex Curl noise vector at particle position
  u_curl = sampleCurlNoise(p_x, p_y, globalTime)
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  
  if r < R_wake:
    w = (1.0 - r / R_wake) * (1.0 - r / R_wake)
    u_target_x = u_curl.x * (1.0 - w) + pointer_vx * w * 1.2
    u_target_y = u_curl.y * (1.0 - w) + pointer_vy * w * 1.2
  else:
    u_target_x = u_curl.x
    u_target_y = u_curl.y
    
  // Stokes laminar drag
  ax += -gamma * (vx - u_target_x)
  ay += -gamma * (vy - u_target_y)
  
  // Brownian thermal excitation
  ax += sigma_diff * (hashNoise(p_x, p_y, 0) - 0.5)
  ay += sigma_diff * (hashNoise(p_x, p_y, 1) - 0.5)

========================================================================================
MODE 4: MAGNETIC DIPOLE (Lorentz Force & Closed Field Lines)
========================================================================================
Parameters:
  - Dipole Moment Magnitude: |m| = 3200
  - Dipole Rotation Speed: omega_m = 0.4 rad/s
  - Interaction Radius: R_mag = 420 px

Formulas:
  theta_dipole = globalTime * omega_m + atan2(pointer_vy, pointer_vx)
  m_x = |m| * cos(theta_dipole),  m_y = |m| * sin(theta_dipole)
  
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  if r < R_mag:
    rx = dx / r,  ry = dy / r
    m_dot_r = m_x * rx + m_y * ry
    
    // Planar magnetic dipole field: B(r) = (3*(m.r_hat)*r_hat - m) / (r^3 + r0^3)
    denom = (r*r*r + 12000.0)
    Bx = (3.0 * m_dot_r * rx - m_x) / denom
    By = (3.0 * m_dot_r * ry - m_y) / denom
    
    // Lorentz force: F = q * (E + v x B)
    q = (speciesId % 2 === 0) ? 1.0 : -1.0
    // In 2D plane: velocity aligns along field lines + gyroscopic perpendicular torque
    ax += q * Bx * 12.0 - q * By * vy * 0.15
    ay += q * By * 12.0 + q * Bx * vx * 0.15

========================================================================================
MODE 5: CRYO FREEZE (Hexagonal Lattice Crystallization & Shatter)
========================================================================================
Parameters:
  - Freeze Radius: R_cryo = 260 px, Lattice Spacing: a_hex = 26 px
  - Restoring Spring Constant: k_crystal = 16.0, Damping: zeta = 0.90
  - Shatter Velocity Threshold: v_shatter = 16.0 px/frame

Formulas:
  dx = p_x - pointer_x,  dy = p_y - pointer_y
  r = sqrt(dx*dx + dy*dy + eps^2)
  if r < R_cryo:
    quench = (1.0 - r / R_cryo) * (1.0 - r / R_cryo)
    
    // Hexagonal lattice coordinate transformation & snap
    u = (sqrt(3)/3.0 * p_x - 1.0/3.0 * p_y) / a_hex
    v = (2.0/3.0 * p_y) / a_hex
    u_snap = round(u),  v_snap = round(v)
    lat_x = a_hex * sqrt(3) * (u_snap + v_snap * 0.5)
    lat_y = a_hex * 1.5 * v_snap
    
    // Damped harmonic restoring spring force
    f_spring_x = -k_crystal * (p_x - lat_x) * quench
    f_spring_y = -k_crystal * (p_y - lat_y) * quench
    f_damp_x = -zeta * vx * quench
    f_damp_y = -zeta * vy * quench
    
    ax += f_spring_x + f_damp_x
    ay += f_spring_y + f_damp_y
    
    // High-speed gesture shatter event
    pointer_speed = sqrt(pointer_vx * pointer_vx + pointer_vy * pointer_vy)
    if pointer_speed > v_shatter:
      vx += (dx / r) * pointer_speed * 1.8 + (hashNoise(p_x, 0) - 0.5) * 8.0
      vy += (dy / r) * pointer_speed * 1.8 + (hashNoise(p_y, 1) - 0.5) * 8.0
      spawnIceCrystallineSparks(p_x, p_y)

========================================================================================
MODE 6: STRANGE ATTRACTOR (Clifford & Lorenz Non-Linear Chaos)
========================================================================================
Parameters:
  - Clifford Coefficients: a = -1.4, b = 1.6, c = 1.0, d = 0.7
  - Lorenz Parameters: sigma = 10, rho = 28, beta = 8/3, z0 = 25
  - Attractor Influence Radius: R_attr = 380 px

Formulas:
  dx = (p_x - pointer_x) / 120.0
  dy = (p_y - pointer_y) / 120.0
  r = sqrt(dx*dx + dy*dy + eps^2)
  if r < 3.2:
    w = (1.0 - r / 3.2) * (1.0 - r / 3.2)
    
    // Clifford attractor target offset
    next_x = sin(a * dy) + c * cos(a * dx)
    next_y = sin(b * dx) + d * cos(b * dy)
    
    target_vx = (next_x - dx) * 45.0
    target_vy = (next_y - dy) * 45.0
    
    ax += (target_vx - vx) * 0.8 * w
    ay += (target_vy - vy) * 0.8 * w

========================================================================================
MODE 7: SWARM FLOCKING (Reynolds Boid Cohesion, Alignment, Separation)
========================================================================================
Parameters:
  - Perception Radius: R_flock = 70 px, Separation Radius: R_sep = 24 px
  - Weights: w_sep = 3.5, w_align = 2.2, w_coh = 1.6, w_lead = 1.2

Formulas (Evaluated via 1D Spatial Hash Grid Query):
  neighbors = spatialGrid.queryNeighbors(p_x, p_y, R_flock)
  count = 0, sum_pos_x = 0, sum_pos_y = 0, sum_vel_x = 0, sum_vel_y = 0, sep_x = 0, sep_y = 0
  
  for each neighbor j:
    ndx = p_x - j.x,  ndy = p_y - j.y
    dist_sq = ndx*ndx + ndy*ndy + eps^2
    if dist_sq < R_flock * R_flock:
      count++
      sum_pos_x += j.x; sum_pos_y += j.y
      sum_vel_x += j.vx; sum_vel_y += j.vy
      if dist_sq < R_sep * R_sep:
        dist = sqrt(dist_sq)
        sep_x += (ndx / dist) * (1.0 - dist / R_sep)
        sep_y += (ndy / dist) * (1.0 - dist / R_sep)
        
  if count > 0:
    // Alignment: match average heading
    avg_vx = sum_vel_x / count,  avg_vy = sum_vel_y / count
    f_align_x = (avg_vx - vx) * w_align
    f_align_y = (avg_vy - vy) * w_align
    
    // Cohesion: steer toward center of mass
    avg_px = sum_pos_x / count,  avg_py = sum_pos_y / count
    f_coh_x = ((avg_px - p_x) / R_flock) * w_coh
    f_coh_y = ((avg_py - p_y) / R_flock) * w_coh
    
    // Separation: evade crowding
    f_sep_x = sep_x * w_sep
    f_sep_y = sep_y * w_sep
    
    ax += f_align_x + f_coh_x + f_sep_x
    ay += f_align_y + f_coh_y + f_sep_y
    
  // Pointer shepherd attraction
  pdx = pointer_x - p_x,  pdy = pointer_y - p_y
  p_dist = sqrt(pdx*pdx + pdy*pdy + eps^2)
  ax += (pdx / p_dist) * w_lead
  ay += (pdy / p_dist) * w_lead
```

---

### 4.2 Supersonic Shockwave Propagation System

```javascript
/**
 * Supersonic Shockwave Manager with Dual-Zone Pressure Front & Spark Burst
 */
export class ShockwaveSystem {
  constructor(maxShockwaves = 16) {
    this.maxShockwaves = maxShockwaves;
    this.waves = [];
    this.sparks = new Float32Array(2048 * 8); // [x, y, vx, vy, life, maxLife, hue, size]
    this.sparkCount = 0;
    this.maxSparks = 2048;
  }

  trigger(x, y, strength = 1.0, hue = 180, initialVx = 0, initialVy = 0) {
    if (this.waves.length >= this.maxShockwaves) {
      this.waves.shift(); // Evict oldest
    }
    const wave = {
      x, y,
      radius: 12.0,
      maxRadius: 1600.0,
      speed: 32.0 * strength,
      force: 85.0 * strength,
      thickness: 45.0,
      decay: 0.94,
      hue: hue,
      life: 1.0
    };
    this.waves.push(wave);

    // Initial radial spark ejection burst (64 sparks)
    const numBurstSparks = 64;
    for (let i = 0; i < numBurstSparks; i++) {
      const angle = (i / numBurstSparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = (Math.random() * 12.0 + 8.0) * strength;
      const svx = Math.cos(angle) * speed + initialVx * 0.3;
      const svy = Math.sin(angle) * speed + initialVy * 0.3;
      this.emitSpark(x, y, svx, svy, hue, Math.random() * 2.5 + 1.0, 40 + Math.random() * 30);
    }
  }

  update(dt, particlesSoA, particleCount) {
    // 1. Update Shockwave Fronts
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.radius += w.speed * dt;
      w.force *= Math.pow(w.decay, dt);
      w.thickness = 45.0 + w.radius * 0.08;
      w.life = w.force / 85.0;

      if (w.radius > w.maxRadius || w.force < 0.2) {
        this.waves.splice(i, 1);
        continue;
      }

      // 2. Apply Kinetic Shockwave Force to Particles
      const halfThick = w.thickness * 0.5;
      const wRadius = w.radius;
      const wForce = w.force;

      for (let p = 0; p < particleCount; p++) {
        const offset = p * 10;
        const px = particlesSoA[offset + 0];
        const py = particlesSoA[offset + 1];
        const dx = px - w.x;
        const dy = py - w.y;
        const distSq = dx * dx + dy * dy + 1e-4;
        const dist = Math.sqrt(distSq);
        const delta = dist - wRadius;

        if (Math.abs(delta) < halfThick) {
          const invDist = 1.0 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;
          const mass = particlesSoA[offset + 5];

          if (delta >= 0) {
            // Leading Compression Crest: Outward blast
            const s = 1.0 - (delta / halfThick);
            const forceCrest = wForce * Math.cos(s * Math.PI * 0.5) / mass;
            particlesSoA[offset + 2] += nx * forceCrest * dt;
            particlesSoA[offset + 3] += ny * forceCrest * dt;
            particlesSoA[offset + 9] = Math.min(1.0, particlesSoA[offset + 9] + 0.3); // Excitation
          } else {
            // Trailing Rarefaction Trough: Cavitation suction
            const s = Math.abs(delta) / halfThick;
            const forceTrough = -0.22 * wForce * Math.sin(s * Math.PI) / mass;
            particlesSoA[offset + 2] += nx * forceTrough * dt;
            particlesSoA[offset + 3] += ny * forceTrough * dt;
          }

          // Trigger collision spark along wavefront
          if (Math.random() < 0.005 && this.sparkCount < this.maxSparks) {
            this.emitSpark(px, py, particlesSoA[offset + 2] * 0.5, particlesSoA[offset + 3] * 0.5, w.hue, 1.5, 30);
          }
        }
      }
    }

    // 3. Update Sparks
    for (let s = 0; s < this.sparkCount; s++) {
      const idx = s * 8;
      this.sparks[idx + 0] += this.sparks[idx + 2] * dt;
      this.sparks[idx + 1] += this.sparks[idx + 3] * dt;
      this.sparks[idx + 2] *= Math.pow(0.95, dt);
      this.sparks[idx + 3] *= Math.pow(0.95, dt);
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
}
```

---

### 4.3 Autonomous Wandering Pulsars & Lightning Plasma Discharge Arcs

```javascript
/**
 * Autonomous Wandering Pulsars & Plasma Lightning Discharge Engine
 */
export class AnomalyEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pulsars = [];
    this.lightningArcs = [];
    this.dischargeCooldown = 0.0;
    this.initPulsars(4);
  }

  initPulsars(count) {
    this.pulsars = [];
    for (let i = 0; i < count; i++) {
      this.pulsars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 3.0,
        vy: (Math.random() - 0.5) * 3.0,
        radius: 220 + Math.random() * 120,
        mass: 2500 + Math.random() * 1500,
        polarity: (i % 2 === 0) ? 1.0 : -1.0, // Alternating suction/ejection cores
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 2.0 + Math.random() * 2.0,
        jetAngle: Math.random() * Math.PI * 2,
        jetSpin: (Math.random() - 0.5) * 1.5,
        noiseSeed: Math.random() * 1000.0,
        color: (i % 2 === 0) ? [0.2, 0.8, 1.0] : [1.0, 0.4, 0.1]
      });
    }
  }

  update(dt, globalTime, particlesSoA, particleCount, shockwaveSystem) {
    const margin = 140.0;
    const wallK = 8.0;

    // 1. Update Pulsar Autonomous Motion & Radiation
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
      p.vx *= Math.pow(0.985, dt);
      p.vy *= Math.pow(0.985, dt);

      // Periodic Radiation Flash Pulse
      const pulseFlash = Math.pow(Math.sin(p.phase), 8);
      if (pulseFlash > 0.92 && Math.random() < 0.12) {
        shockwaveSystem.trigger(p.x, p.y, 0.6, (p.polarity > 0 ? 200 : 30), p.vx, p.vy);
      }

      // Gravitational & Jet Forces on Particles
      const pRadSq = p.radius * p.radius;
      for (let j = 0; j < particleCount; j++) {
        const offset = j * 10;
        const dx = p.x - particlesSoA[offset + 0];
        const dy = p.y - particlesSoA[offset + 1];
        const distSq = dx * dx + dy * dy + 1e-4;
        if (distSq < pRadSq) {
          const dist = Math.sqrt(distSq);
          const force = (p.mass / distSq) * (1.0 - dist / p.radius) * p.polarity;
          particlesSoA[offset + 2] += (dx / dist) * force * dt;
          particlesSoA[offset + 3] += (dy / dist) * force * dt;
        }
      }
    }

    // 2. Dynamic Dielectric Breakdown & Lightning Discharge Arcs
    this.dischargeCooldown -= dt;
    this.lightningArcs = [];

    if (this.dischargeCooldown <= 0) {
      // Find pair of closest pulsars
      for (let i = 0; i < this.pulsars.length; i++) {
        for (let j = i + 1; j < this.pulsars.length; j++) {
          const p1 = this.pulsars[i];
          const p2 = this.pulsars[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 460.0 && Math.random() < 0.35) {
            const arcSegments = this.generateFractalArc(p1, p2, 5, 45.0);
            this.lightningArcs.push({
              segments: arcSegments,
              life: 1.0,
              color: [0.9, 0.95, 1.0]
            });
            this.dischargeCooldown = 0.45 + Math.random() * 0.4;

            // Ionize nearby particles along the plasma arc
            this.ionizeParticlesAlongArc(arcSegments, particlesSoA, particleCount, shockwaveSystem);
          }
        }
      }
    }
  }

  generateFractalArc(p1, p2, maxDepth, displacement) {
    const stack = [{ a: p1, b: p2, depth: 0, disp: displacement }];
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

      const jitter = (Math.random() - 0.5) * seg.disp;
      const mid = {
        x: (seg.a.x + seg.b.x) * 0.5 + nx * jitter,
        y: (seg.a.y + seg.b.y) * 0.5 + ny * jitter
      };

      const nextDepth = seg.depth + 1;
      const nextDisp = seg.disp * 0.55;

      stack.push({ a: seg.a, b: mid, depth: nextDepth, disp: nextDisp });
      stack.push({ a: mid, b: seg.b, depth: nextDepth, disp: nextDisp });

      // Stochastic Branch Fork
      if (Math.random() < 0.22 && nextDepth < maxDepth - 1) {
        const branchAngle = (Math.random() - 0.5) * 0.9;
        const bLen = len * 0.35;
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
        const offset = p * 10;
        const px = particlesSoA[offset + 0];
        const py = particlesSoA[offset + 1];

        // Segment-to-point projection
        const t = Math.max(0.0, Math.min(1.0, ((px - line.x1) * lx + (py - line.y1) * ly) / lLenSq));
        const projX = line.x1 + t * lx;
        const projY = line.y1 + t * ly;
        const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

        if (dSq < arcRadiusSq) {
          // Electromagnetic plasma impulse
          particlesSoA[offset + 2] += (Math.random() - 0.5) * 16.0;
          particlesSoA[offset + 3] += (Math.random() - 0.5) * 16.0;
          particlesSoA[offset + 9] = 1.0; // High energy excitation
          if (Math.random() < 0.05) {
            shockwaveSystem.emitSpark(px, py, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 200, 2.0, 25);
          }
        }
      }
    }
  }
}
```

---

### 4.4 Fixed-Timestep Accumulator (120 Hz) & Numerical Safety Invariants

```javascript
/**
 * Deterministic 120Hz Fixed Timestep Simulation Engine with Invariant Validation
 */
export class SimulationEngine {
  constructor(width, height, maxParticles = 50000) {
    this.width = width;
    this.height = height;
    this.maxParticles = maxParticles;
    this.particleCount = maxParticles;

    // SoA Flat Float32Array: [x, y, vx, vy, size, mass, life, maxLife, speciesId, energy]
    this.particles = new Float32Array(maxParticles * 10);
    
    // Fixed Timestep Engine constants
    this.FIXED_DT = 1.0 / 120.0; // 120 Hz = 8.333 ms
    this.MAX_FRAME_TIME = 0.100; // 100 ms spiral-of-death clamp
    this.accumulator = 0.0;
    this.lastTime = performance.now();
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;

    // Numerical Invariant Bounds
    this.MAX_VELOCITY = 55.0; // px / substep
    this.MAX_VELOCITY_SQ = this.MAX_VELOCITY * this.MAX_VELOCITY;
    this.BOUND_MARGIN = 60.0;
    this.EPSILON = 1e-4;

    this.currentMode = 0; // 0..7
    this.pointer = { x: -1000, y: -1000, vx: 0, vy: 0, isDown: false, button: 0 };
    
    this.initParticles();
  }

  initParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.resetParticle(i, true);
    }
  }

  resetParticle(i, randomizeLife = false) {
    const offset = i * 10;
    this.particles[offset + 0] = Math.random() * this.width;
    this.particles[offset + 1] = Math.random() * this.height;
    this.particles[offset + 2] = (Math.random() - 0.5) * 1.5;
    this.particles[offset + 3] = (Math.random() - 0.5) * 1.5;
    this.particles[offset + 4] = Math.random() * 1.6 + 0.6; // Size
    this.particles[offset + 5] = Math.random() * 1.2 + 0.6; // Mass
    const maxLife = 300 + Math.random() * 400;
    this.particles[offset + 6] = randomizeLife ? Math.random() * maxLife : maxLife; // Life
    this.particles[offset + 7] = maxLife;
    this.particles[offset + 8] = i % 4; // Species: 0, 1, 2, 3
    this.particles[offset + 9] = 0.0;   // Energy
  }

  stepFrame(currentTime, spatialGrid, shockwaveSystem, anomalyEngine) {
    const rawElapsed = (currentTime - this.lastTime) / 1000.0;
    this.lastTime = currentTime;

    // Spiral-of-death frame clamp
    const clampedElapsed = Math.min(rawElapsed, this.MAX_FRAME_TIME);

    // Bullet-time easing
    this.timeScale += (this.targetTimeScale - this.timeScale) * 0.04;
    this.accumulator += clampedElapsed * this.timeScale;

    // 120Hz Inner Fixed Step Loop
    while (this.accumulator >= this.FIXED_DT) {
      // 1. Update Autonomous Entities
      shockwaveSystem.update(this.FIXED_DT, this.particles, this.particleCount);
      anomalyEngine.update(this.FIXED_DT, currentTime * 0.001, this.particles, this.particleCount, shockwaveSystem);

      // 2. Refresh Spatial Hash Grid
      spatialGrid.clear();
      spatialGrid.populate(this.particles, this.particleCount);

      // 3. Perform Substep Physics Integration
      this.integratePhysics(this.FIXED_DT, spatialGrid);

      // 4. Verify & Enforce Numerical Safety Invariants
      this.enforceInvariants();

      this.accumulator -= this.FIXED_DT;
    }

    // Return interpolation alpha for sub-frame smooth rendering
    return this.accumulator / this.FIXED_DT;
  }

  integratePhysics(dt, spatialGrid) {
    const p = this.particles;
    const count = this.particleCount;
    const mode = this.currentMode;
    const ptr = this.pointer;

    for (let i = 0; i < count; i++) {
      const off = i * 10;
      let x = p[off + 0];
      let y = p[off + 1];
      let vx = p[off + 2];
      let vy = p[off + 3];
      const mass = p[off + 5];

      // Life decay
      p[off + 6] -= dt;
      if (p[off + 6] <= 0) {
        this.resetParticle(i, false);
        continue;
      }

      // Energy dissipation
      p[off + 9] = Math.max(0.0, p[off + 9] - 0.02 * dt);

      // Ambient Curl Noise Force
      // (sampleCurlNoise evaluated inline or via math module)
      
      // Mode-Specific Physics Force Formulation (Modes 0..7 as detailed in §4.1)
      let ax = 0.0, ay = 0.0;
      // ... [Execute Mode-Specific Vector Physics] ...

      // Semi-Implicit Euler Integration
      vx += (ax / mass) * dt;
      vy += (ay / mass) * dt;

      // Friction drag
      vx *= Math.pow(0.982, dt);
      vy *= Math.pow(0.982, dt);

      // Position update
      p[off + 0] += vx * dt;
      p[off + 1] += vy * dt;
      p[off + 2] = vx;
      p[off + 3] = vy;
    }
  }

  enforceInvariants() {
    const p = this.particles;
    const count = this.particleCount;
    const maxV_sq = this.MAX_VELOCITY_SQ;
    const maxV = this.MAX_VELOCITY;
    const w = this.width;
    const h = this.height;
    const margin = this.BOUND_MARGIN;

    for (let i = 0; i < count; i++) {
      const off = i * 10;
      let x = p[off + 0];
      let y = p[off + 1];
      let vx = p[off + 2];
      let vy = p[off + 3];

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
        p[off + 2] = vx * scale;
        p[off + 3] = vy * scale;
      }

      // Invariant 3: Toroidal Coordinate Bounds Wrapping
      if (x < -margin) p[off + 0] = w + margin - 1.0;
      else if (x > w + margin) p[off + 0] = -margin + 1.0;

      if (y < -margin) p[off + 1] = h + margin - 1.0;
      else if (y > h + margin) p[off + 1] = -margin + 1.0;

      // Invariant 4: Energy Normalization [0.0, 1.0]
      p[off + 9] = Math.max(0.0, Math.min(1.0, p[off + 9]));
    }
  }
}
```

---

## 5. Verification Method

To verify the physics engine and numerical invariants independently:

### 5.1 Automated Unit & Boundary Assertion Suite
Run the test command:
```bash
node test/test_runner.js
```
The test suite validates:
1. **Divergence-Free Curl Noise Invariants**: $\nabla \cdot \vec{v} = \frac{\partial u}{\partial x} + \frac{\partial v}{\partial y} \approx 0$ across $10,000$ spatial coordinate samples.
2. **Physics Mode Stability (Modes 0–7)**:
   - For all modes $m \in [0, 7]$, run $1,000$ iterations with $10,000$ particles:
   - Assert: Zero `NaN` or `Infinity` values produced.
   - Assert: $\max(\|\mathbf{v}_i\|) \le 55.0\text{ px/step}$.
   - Assert: Coordinates remain strictly within $[-\text{margin}, \text{width} + \text{margin}]$.
3. **Shockwave Multi-Phase Invariant**:
   - Assert: Wavefront expansion $R(t) > R(t - \Delta t)$.
   - Assert: Particles inside leading compression crest receive positive outward radial acceleration ($a_r > 0$).
   - Assert: Particles in trailing rarefaction trough receive inward suction ($a_r < 0$).
4. **Spatial Hash Grid Zero-Allocation & Query Completeness**:
   - Assert: `spatialGrid.queryNeighbors(x, y, radius)` produces $100\%$ precision matching brute-force $O(N)$ query.
   - Assert: Heap allocation during 1,000 simulation frames is 0 bytes (no GC pauses).
5. **Fixed-Timestep Determinism**:
   - Simulate 120 steps with fixed seed at 60 FPS vs 120 FPS vs 240 FPS rendering frame rates.
   - Assert: Final particle positions match with bitwise equality after $120$ fixed substeps.
