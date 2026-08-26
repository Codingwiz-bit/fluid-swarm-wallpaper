# Technical Investigation & Fix Strategy Report: M1 Gate Iteration 2 Hardening

**Agent**: `teamwork_preview_explorer_m1_iter2_1`  
**Role**: EXPLORER (investigator, synthesizer)  
**Milestone**: Milestone 1 (Core Physics & Math Engine Gate - Iteration 2)  
**Target Files**:
- `Fluid Swarm V4/src/spatial_grid.js`
- `Fluid Swarm V4/src/physics.js`

**Failure Reference**: `.agents/teamwork_preview_challenger_m1_1/handoff.md`  
**Date**: 2026-08-24T22:31:45Z  

---

## 1. Observation

Adversarial stress testing executed by `teamwork_preview_challenger_m1_1` via `Fluid Swarm V4/tests/adversarial_stress_harness.js` yielded 35 passing assertions and 3 empirical failures (`VERDICT: CHALLENGE_FAILED`):

```
======================================================================
ADVERSARIAL STRESS TEST SUMMARY
======================================================================
Total Assertions Passed: 35
Total Assertions Failed: 3
VERDICT: CHALLENGE_FAILED (3 defect(s) discovered)
```

The 3 failing test cases and their exact code locations are:

### Observation 1: `SpatialHashGrid` Uncaught `RangeError` on Non-Positive / Invalid `cellSize`
- **File**: `Fluid Swarm V4/src/spatial_grid.js:18-32`
- **Direct Code**:
  ```javascript
  constructor(width, height, cellSize = 48, maxEntities = 100000) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.maxEntities = maxEntities;

    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width * this.invCellSize));
    this.rows = Math.max(1, Math.ceil(height * this.invCellSize));
    this.numCells = this.cols * this.rows;

    this.cellHead = new Int32Array(this.numCells);
    this.next = new Int32Array(maxEntities);
  ```
- **Observed Behavior**: Instantiating `new SpatialHashGrid(1920, 1080, 0, 1000)` causes `invCellSize = 1.0 / 0 = Infinity`. This propagates to `this.cols = Infinity`, `this.rows = Infinity`, `this.numCells = Infinity`. V8 throws `RangeError: Invalid typed array length: Infinity` when allocating `new Int32Array(this.numCells)`.

### Observation 2: `SpatialHashGrid` False Positive Neighbor Query on Negative Radius
- **File**: `Fluid Swarm V4/src/spatial_grid.js:134-166` and `src/spatial_grid.js:177-199`
- **Direct Code**:
  ```javascript
  queryNeighborsBuffer(x, y, radius, buffer, stride, callback, maxNeighbors = Infinity) {
    const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
    const maxCx = Math.min(this.cols - 1, ((x + radius) * this.invCellSize) | 0);
    const minCy = Math.max(0, ((y - radius) * this.invCellSize) | 0);
    const maxCy = Math.min(this.rows - 1, ((y + radius) * this.invCellSize) | 0);
    const r2 = radius * radius;
  ```
- **Observed Behavior**: When querying with `radius = -20.0`, `r2 = (-20.0)^2 = 400.0 > 0`. For coordinates where `minCx <= maxCx` and `minCy <= maxCy` (e.g., inside cell boundaries), co-located particles evaluate to $d^2 = 0 \le 400.0$. When querying 100,000 co-located particles at $(500, 500)$, the grid returns all 100,000 particles as matches instead of 0.

### Observation 3: `ShockwaveSystem` Zero/Uninitialized Particle Mass Division-by-Zero & Spark Buffer `NaN` Poisoning
- **File**: `Fluid Swarm V4/src/physics.js:145-165` and `src/physics.js:647, 816-817, 987-988`
- **Direct Code in `ShockwaveSystem.update`**:
  ```javascript
  const mass = particlesSoA[offset + ATTR_MASS];
  ...
  const forceCrest = (wForce * TrigLUT.fastCos(frac * Math.PI * 0.5)) / mass;
  particlesSoA[offset + ATTR_VX] += nx * forceCrest * dt * 60.0;
  particlesSoA[offset + ATTR_VY] += ny * forceCrest * dt * 60.0;
  ...
  if (this.prng.random() < 0.003 && this.sparkCount < this.maxSparks) {
    this.emitSpark(px, py, particlesSoA[offset + ATTR_VX] * 0.4, particlesSoA[offset + ATTR_VY] * 0.4, w.hue, 1.6, 0.3);
  }
  ```
- **Observed Behavior**: In `ShockwaveSystem.update`, when interacting with a particle having `mass = 0` (e.g. newly allocated or uninitialized buffer slot), `forceCrest` calculates `wForce / 0 = Infinity`. Velocity is updated to `Infinity`, which is passed to `emitSpark`. During subsequent spark dampening (`sparks[idx+2] *= damp`), `Infinity` dampening arithmetic collapses into `NaN`, corrupting spark coordinates ($x=\text{NaN}, y=\text{NaN}$) and permanently poisoning the spark ring buffer.

---

## 2. Logic Chain

1. **Defect 1 Root Cause & Impact**:
   - *Cause*: Constructor and `resize()` methods in `SpatialHashGrid` perform arithmetic `1.0 / cellSize` and `width * invCellSize` without defensive type, finiteness, and positive bounds checks.
   - *Mechanism*: Non-positive, zero, or non-finite `cellSize` (`<= 0`, `NaN`, `Infinity`) produces non-finite `invCellSize`, which results in `cols = Infinity` and `numCells = Infinity`. V8 forbids creating TypedArrays of non-integer or infinite lengths.
   - *Fix Rationale*: Enforce a strict fallback default `safeCellSize = (isFinite(cellSize) && cellSize > 0) ? cellSize : 48`. Similarly sanitize `width`, `height`, and `maxEntities` across `constructor` and `resize()`.

2. **Defect 2 Root Cause & Impact**:
   - *Cause*: A negative search radius is physically invalid (empty set in metric geometry). Squaring `radius` ($r^2 = (-r)^2 > 0$) turns negative radii into positive squared distance thresholds.
   - *Mechanism*: Because `r2 > 0`, any particle whose distance $d \le |r|$ passes the `d2 <= r2` test.
   - *Fix Rationale*: Insert immediate guards at entry of `queryNeighborsBuffer` and `queryNeighbors`: `if (radius < 0 || !isFinite(radius)) return 0;`. This immediately halts search and returns 0 without cell iteration.

3. **Defect 3 Root Cause & Impact**:
   - *Cause*: Newton's Second Law $a = F / m$ requires positive regularized mass ($m > 0$). In `ShockwaveSystem.update` and `PhysicsEngine.integrateParticles`, particle mass is directly used as divisor without an epsilon lower bound.
   - *Mechanism*: Zero or uninitialized mass ($m = 0$) results in division by zero ($F / 0 = \infty$). Particles gain infinite velocity. When emitted as sparks, dampening arithmetic `Infinity * damp` and velocity integration evaluate to `NaN` ($0 \times \infty = \text{NaN}$).
   - *Fix Rationale*: Regularize mass before division using a safe minimum threshold: `const safeMass = (isFinite(rawMass) && rawMass > 0.01) ? rawMass : 1.0;`. Additionally, harden `emitSpark()` with velocity bounds clamping and `isFinite()` checks, and sanitize spark buffer entries during integration.

---

## 3. Caveats

- **Scope Boundary**: This investigation is strictly focused on Milestone 1 modules (`src/spatial_grid.js` and `src/physics.js`). Milestone 2 GPU shaders (`renderer_webgl.js`, `renderer_canvas.js`) and UI components will consume these APIs but are outside M1 gate scope.
- **Zero-GC Invariant**: All defensive sanitization and regularization logic must avoid object instantiation or heap allocations inside hot loops (`queryNeighborsBuffer`, `ShockwaveSystem.update`, `integrateParticles`, `enforceInvariants`).
- **Bitwise Determinism**: Using ternary regularizations with exact scalar defaults preserves bitwise determinism for valid simulation inputs.

---

## 4. Conclusion & Exact Fix Strategy

The exact fix specifications for `Fluid Swarm V4/src/spatial_grid.js` and `Fluid Swarm V4/src/physics.js` are formulated below.

### 4.1 Fix Specification for `Fluid Swarm V4/src/spatial_grid.js`

#### A. Constructor & Resize Hardening (Lines 18–58)
**Before**:
```javascript
constructor(width, height, cellSize = 48, maxEntities = 100000) {
  this.cellSize = cellSize;
  this.invCellSize = 1.0 / cellSize;
  this.maxEntities = maxEntities;

  this.width = width;
  this.height = height;
  this.cols = Math.max(1, Math.ceil(width * this.invCellSize));
  this.rows = Math.max(1, Math.ceil(height * this.invCellSize));
  this.numCells = this.cols * this.rows;

  this.cellHead = new Int32Array(this.numCells);
  this.next = new Int32Array(maxEntities);
  this.cellHead.fill(-1);
  this.next.fill(-1);
}

resize(width, height) {
  this.width = width;
  this.height = height;
  const newCols = Math.max(1, Math.ceil(width * this.invCellSize));
  const newRows = Math.max(1, Math.ceil(height * this.invCellSize));
  const newNumCells = newCols * newRows;

  if (newNumCells !== this.numCells) {
    this.cols = newCols;
    this.rows = newRows;
    this.numCells = newNumCells;
    this.cellHead = new Int32Array(this.numCells);
    this.cellHead.fill(-1);
  } else {
    this.cols = newCols;
    this.rows = newRows;
  }
}
```

**After (Proposed)**:
```javascript
constructor(width, height, cellSize = 48, maxEntities = 100000) {
  const safeCellSize = (isFinite(cellSize) && cellSize > 0) ? cellSize : 48;
  this.cellSize = safeCellSize;
  this.invCellSize = 1.0 / safeCellSize;
  const safeMaxEntities = (isFinite(maxEntities) && maxEntities > 0) ? (maxEntities | 0) : 100000;
  this.maxEntities = safeMaxEntities;

  const safeW = (isFinite(width) && width > 0) ? width : 1920;
  const safeH = (isFinite(height) && height > 0) ? height : 1080;
  this.width = safeW;
  this.height = safeH;
  this.cols = Math.max(1, Math.ceil(safeW * this.invCellSize));
  this.rows = Math.max(1, Math.ceil(safeH * this.invCellSize));
  this.numCells = this.cols * this.rows;

  this.cellHead = new Int32Array(this.numCells);
  this.next = new Int32Array(this.maxEntities);
  this.cellHead.fill(-1);
  this.next.fill(-1);
}

resize(width, height) {
  const safeW = (isFinite(width) && width > 0) ? width : (this.width > 0 ? this.width : 1920);
  const safeH = (isFinite(height) && height > 0) ? height : (this.height > 0 ? this.height : 1080);
  this.width = safeW;
  this.height = safeH;
  const newCols = Math.max(1, Math.ceil(safeW * this.invCellSize));
  const newRows = Math.max(1, Math.ceil(safeH * this.invCellSize));
  const newNumCells = newCols * newRows;

  if (newNumCells !== this.numCells) {
    this.cols = newCols;
    this.rows = newRows;
    this.numCells = newNumCells;
    this.cellHead = new Int32Array(this.numCells);
    this.cellHead.fill(-1);
  } else {
    this.cols = newCols;
    this.rows = newRows;
  }
}
```

#### B. Query Negative Radius Guards (Lines 134 & 177)
**Before**:
```javascript
queryNeighborsBuffer(x, y, radius, buffer, stride, callback, maxNeighbors = Infinity) {
  const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
  ...
}

queryNeighbors(x, y, radius, callback, maxNeighbors = Infinity) {
  const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
  ...
}
```

**After (Proposed)**:
```javascript
queryNeighborsBuffer(x, y, radius, buffer, stride, callback, maxNeighbors = Infinity) {
  if (radius < 0 || !isFinite(radius)) return 0;
  const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
  ...
}

queryNeighbors(x, y, radius, callback, maxNeighbors = Infinity) {
  if (radius < 0 || !isFinite(radius)) return 0;
  const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
  ...
}
```

---

### 4.2 Fix Specification for `Fluid Swarm V4/src/physics.js`

#### A. `ShockwaveSystem.update` Mass Regularization & Spark Protection (Lines 145–190)
**Before**:
```javascript
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
```

**After (Proposed)**:
```javascript
const rawMass = particlesSoA[offset + ATTR_MASS];
const safeMass = (isFinite(rawMass) && rawMass > 0.01) ? rawMass : 1.0;

if (delta >= 0) {
  // Leading Compression Crest: Outward blast push (Maximum at wavefront delta = 0)
  const frac = delta / halfThick;
  const forceCrest = (wForce * TrigLUT.fastCos(frac * Math.PI * 0.5)) / safeMass;
  particlesSoA[offset + ATTR_VX] += nx * forceCrest * dt * 60.0;
  particlesSoA[offset + ATTR_VY] += ny * forceCrest * dt * 60.0;
  particlesSoA[offset + ATTR_ENERGY] = Math.min(1.0, particlesSoA[offset + ATTR_ENERGY] + 0.4);
} else {
  // Trailing Rarefaction Trough: Inward cavitation suction
  const frac = Math.abs(delta) / halfThick;
  const forceTrough = (-0.25 * wForce * TrigLUT.fastSin(frac * Math.PI)) / safeMass;
  particlesSoA[offset + ATTR_VX] += nx * forceTrough * dt * 60.0;
  particlesSoA[offset + ATTR_VY] += ny * forceTrough * dt * 60.0;
}

// Occasional spark generation on high-speed impact
if (this.prng.random() < 0.003 && this.sparkCount < this.maxSparks) {
  const pVx = particlesSoA[offset + ATTR_VX];
  const pVy = particlesSoA[offset + ATTR_VY];
  const safePvx = isFinite(pVx) ? pVx * 0.4 : 0;
  const safePvy = isFinite(pVy) ? pVy * 0.4 : 0;
  this.emitSpark(px, py, safePvx, safePvy, w.hue, 1.6, 0.3);
}
```

#### B. `ShockwaveSystem.emitSpark` & Spark Ring Buffer Protection (Lines 195–213)
**Before**:
```javascript
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
```

**After (Proposed)**:
```javascript
emitSpark(x, y, vx, vy, hue, size, maxLife) {
  if (this.sparkCount >= this.maxSparks) return;
  if (!isFinite(x) || !isFinite(y)) return;
  const safeVx = isFinite(vx) ? Math.max(-1000.0, Math.min(1000.0, vx)) : 0.0;
  const safeVy = isFinite(vy) ? Math.max(-1000.0, Math.min(1000.0, vy)) : 0.0;
  const safeMaxLife = (isFinite(maxLife) && maxLife > 0) ? maxLife : 0.3;
  const safeHue = isFinite(hue) ? hue : 180;
  const safeSize = (isFinite(size) && size > 0) ? size : 1.5;

  const idx = this.sparkCount * 8;
  this.sparks[idx + 0] = x;
  this.sparks[idx + 1] = y;
  this.sparks[idx + 2] = safeVx;
  this.sparks[idx + 3] = safeVy;
  this.sparks[idx + 4] = safeMaxLife;
  this.sparks[idx + 5] = safeMaxLife;
  this.sparks[idx + 6] = safeHue;
  this.sparks[idx + 7] = safeSize;
  this.sparkCount++;
}
```

#### C. `PhysicsEngine.integrateParticles` & `enforceInvariants` Mass Regularization (Lines 647, 816, 987, 1030)
**Before**:
```javascript
const mass = p[off + ATTR_MASS];
...
const aInertX = (curPtr.vx * weight * 20.0) / mass;
const aInertY = (curPtr.vy * weight * 20.0) / mass;
...
vx += (ax / mass) * dt;
vy += (ay / mass) * dt;
...
// In enforceInvariants:
if (x !== x || y !== y || vx !== vx || vy !== vy ||
    !isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)) {
  this.resetParticle(i, false);
  continue;
}
```

**After (Proposed)**:
```javascript
const rawMass = p[off + ATTR_MASS];
const safeMass = (isFinite(rawMass) && rawMass > 0.01) ? rawMass : 1.0;
...
const aInertX = (curPtr.vx * weight * 20.0) / safeMass;
const aInertY = (curPtr.vy * weight * 20.0) / safeMass;
...
vx += (ax / safeMass) * dt;
vy += (ay / safeMass) * dt;
...
// In enforceInvariants:
const mass = p[off + ATTR_MASS];
if (x !== x || y !== y || vx !== vx || vy !== vy ||
    !isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy) ||
    !isFinite(mass) || mass <= 0.01) {
  this.resetParticle(i, false);
  continue;
}
```

---

## 5. Verification Method

To independently verify that the proposed changes eliminate all 3 defects and maintain 100% test passing:

1. **Full Adversarial Stress Suite**:
   ```bash
   node "Fluid Swarm V4/tests/adversarial_stress_harness.js"
   ```
   *Pass Condition*: `VERDICT: APPROVE (ALL ADVERSARIAL STRESS CHALLENGES PASSED WITH ZERO DEFECTS)`, exit code 0, 38/38 passed.

2. **Core Unit & Numerical Invariant Test Suite**:
   ```bash
   node "Fluid Swarm V4/tests/test_physics_math.js"
   ```
   *Pass Condition*: `Total Passed: 35 | Total Failed: 0`, exit code 0.

3. **Empirical Reviewer & Challenge Suite**:
   ```bash
   node "Fluid Swarm V4/tests/empirical_challenge_m1.js"
   ```
   *Pass Condition*: `16/16 PASSED (100% OF ADVERSARIAL STRESS CHECKS PASSED WITH ZERO DEFECTS)`, exit code 0.

4. **100,000 Particle Stress Benchmark**:
   ```bash
   node "Fluid Swarm V4/tests/benchmark_stress.js"
   ```
   *Pass Condition*: `100k Particle Numerical Stability Confirmed!`, exit code 0.
