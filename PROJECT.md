# Project: Fluid Swarm V4 Interactive Wallpaper

## Architecture
Fluid Swarm V4 is a next-generation interactive desktop and web wallpaper featuring hardware-accelerated fluid particle simulation, divergence-free Curl noise fields, multi-species boid flocking and predator-prey dynamics, relativistic singularity physics, multi-pass post-processing (HDR bloom, chromatic aberration, liquid refraction), Web Audio API FFT reactivity, and a glassmorphic HUD control studio.

### Key Architectural Pillars:
1. **Core Simulation Engine**: Fixed-timestep accumulator (120 Hz), flat `Float32Array` Structure-of-Arrays (SoA) particle buffer (supporting 50,000–100,000+ particles with zero GC allocations), zero-allocation 1D Spatial Hash Grid.
2. **Dual-Engine Rendering**: Hardware-accelerated WebGL 2 / WebGL 1 instanced particle shader pipeline with ping-pong FBO fluid trail advection and post-processing, paired with an ultra-optimized Canvas 2D fallback.
3. **Advanced Cosmic Physics**: 8 distinct physics interaction modes, 4 interacting biological/cosmic species, multi-touch gestures, mouse inertia flings, supersonic blast shockwaves, wandering pulsars, and lightning plasma discharges.
4. **Visual Aesthetics & Audio**: 8 curated color themes with smooth interpolation, Dual-Kawase HDR bloom, chromatic dispersion, Web Audio FFT frequency band analyzer with synth fallback.
5. **Interactive HUD & Compatibility**: Translucent glassmorphism UI drawer, live telemetry HUD, preset manager (Save/Export/Import via LocalStorage), keyboard shortcuts, 100% standalone zero-dependency execution in macOS Plash / modern browsers.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Divergence-Free Curl Noise | Multi-octave 3D/4D Simplex Curl noise potential field with zero compression | M1 | Survey |
| 2 | Flat TypedArray SoA Buffer | Zero-GC contiguous `Float32Array` particle buffer supporting up to 100,000 particles | M1 | Survey |
| 3 | 1D Spatial Hash Grid | Zero-allocation spatial acceleration grid for fast $O(N)$ neighbor queries | M1 | Survey |
| 4 | Multi-Species Ecosystem | 4 interacting species (Phytoplankton, Starling Boids, Void Predators, Vortex Weavers) | M1 | Survey |
| 5 | 8 Cosmic & Quantum Physics Modes | Vortex Typhoon, Kerr Singularity, Quantum Repulsor, Nebula Drift, Magnetic Dipole, Cryo Freeze, Strange Attractor, Swarm Flocking | M1 | Survey |
| 6 | Multi-Touch & Kinetic Inertia | Multi-pointer touch tracking, vortex flings, velocity momentum inheritance | M1 | Survey |
| 7 | Supersonic Blast Shockwaves | Expanding kinetic wave with particle displacement, refraction distortion, and spark bursts | M1 | Survey |
| 8 | Wandering Pulsars & Lightning | Autonomous roaming anomaly cores and dynamic electric discharge arcs | M1 | Survey |
| 9 | Fixed Timestep & Invariants | 120Hz physics accumulator, velocity clamping, coordinate bounds, numerical safety epsilon | M1 | Survey |
| 10 | WebGL 2/1 Instanced Renderer | GPU shader-based instanced quad / velocity-aligned particle rendering | M2 | Survey |
| 11 | FBO Ping-Pong Trail Advection | Fluid trail persistence with velocity advection and exponential decay | M2 | Survey |
| 12 | Multi-Pass Post-Processing | Dual-Kawase HDR bloom, Chromatic Aberration, Liquid normal refraction, Film grain | M2 | Survey |
| 13 | Canvas 2D Fallback Engine | High-performance fallback with batched drawing for non-WebGL environments | M2 | Survey |
| 14 | Dynamic DPR & DRS Scaling | Retina scaling ($\le 2.0$) with Dynamic Resolution Scaling under heavy load | M2 | Survey |
| 15 | 8 Master Color Themes | Cyberpunk Neon, Cosmic Supernova, Abyssal Biolum, Quantum Aurora, Liquid Chrome, Volcanic Magma, Synthwave, Matrix | M3 | Survey |
| 16 | Dynamic Color Interpolation | Smooth animated palette transitions with kinetic energy & pressure modulation | M3 | Survey |
| 17 | Web Audio FFT Engine | Microphone audio reactivity with frequency band mapping (Sub-bass, Bass, Mid, High) | M3 | Survey |
| 18 | Procedural Audio Synthesizer | Built-in ambient drone & sub-bass generator fallback when mic is disabled | M3 | Survey |
| 19 | Curated Presets & Manager | 8 one-click presets + LocalStorage save/export/import JSON system | M3 | Survey |
| 20 | Glassmorphic HUD & Telemetry | Translucent control drawer with live FPS, frame latency, particle count, and GPU stats | M4 | Survey |
| 21 | Granular Parameter Sliders | Live tuning of particle count, curl turbulence, viscosity, bloom, shockwave power | M4 | Survey |
| 22 | Comprehensive Keyboard Hotkeys | Space (Bullet Time), 1-8 (Presets), T (Theme), M (Mode), A (Audio), C (Shockwave), R (Reset), H (Hide UI), F (Fullscreen) | M4 | Survey |
| 23 | Standalone Zero-Dependency Build | Fully self-contained `index.html`, `style.css`, and `script.js` executable via `file://` or Plash | M4 | Survey |
| 24 | In-App Diagnostic Benchmark | Built-in 10-second automated benchmark suite with performance score report | M4 | Survey |
| 25 | Comprehensive E2E Verification | Automated headless browser test suite passing 100% of Tiers 1-4 tests | M5 | Survey |
| 26 | Adversarial Coverage Hardening | White-box stress testing, extreme boundary inputs, memory leak validation | M5 | Survey |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Physics & Math Engine | Curl noise, spatial hash grid, SoA buffer, 4 species, 8 physics modes, shockwaves, anomalies, fixed timestep | none | PLANNED |
| M2 | Dual-Engine Renderer & Shaders | WebGL 2/1 instanced particle renderer, FBO trails, HDR bloom, chromatic aberration, Canvas 2D fallback, DPR/DRS | M1 | PLANNED |
| M3 | Visual Themes, Audio & Presets | 8 color palettes, smooth interpolation, Web Audio FFT + synth fallback, 8 presets, JSON save/export | M1, M2 | PLANNED |
| M4 | Glassmorphic HUD, UI & Standalone | Responsive glassmorphic HUD, live telemetry, sliders, hotkeys, standalone bundle, diagnostic benchmark | M1, M2, M3 | PLANNED |
| M5 | E2E Verification & Hardening | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial stress hardening and memory leak validation | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### Math & Physics Engine (`src/math.js`, `src/spatial_grid.js`, `src/physics.js`)
- `SimplexNoise`: `noise2D(x, y)`, `noise3D(x, y, z)`
- `CurlNoise`: `sampleCurl(x, y, t, octaves, scale, frequency)` -> `{vx: number, vy: number}`
- `SpatialHashGrid`: `constructor(width, height, cellSize, maxEntities)`, `clear()`, `insert(id, x, y)`, `queryNeighbors(x, y, radius, callback)`
- `PhysicsEngine`:
  - `init(width, height, maxParticles)`
  - `update(dt)`: updates particle SoA buffer `[x, y, vx, vy, size, mass, life, maxLife, speciesId]`
  - `setMode(modeIndex)` (0..7)
  - `triggerShockwave(x, y, strength)`
  - `setMouse(x, y, isDown, button, vx, vy)`
  - `addPointer(id, x, y)` / `updatePointer(id, x, y)` / `removePointer(id)`
  - `getParticleBuffer()` -> `Float32Array`
  - `getParticleCount()` -> `number`

### Renderer Interface (`src/renderer_webgl.js`, `src/renderer_canvas.js`)
- `Renderer`:
  - `init(canvasElement, width, height, dpr)`
  - `resize(width, height, dpr)`
  - `render(physicsEngine, interpolationAlpha, themeConfig, postConfig)`
  - `setPostProcessing(options: { bloom: number, chromatic: number, trails: number, liquid: boolean })`
  - `destroy()`

### Audio & Theme Engine (`src/audio.js`, `src/config.js`)
- `AudioEngine`:
  - `init()`
  - `toggleMicrophone()` -> `Promise<boolean>`
  - `getFrequencyData()` -> `{ subBass: number, bass: number, mids: number, highs: number, raw: Uint8Array }`
- `ThemeManager`:
  - `setTheme(themeIndex, transitionDurationMs)`
  - `getColorForParticle(speciesId, speed, energy, lifeRatio)` -> `[r, g, b, a]`

### UI & Preset Manager (`src/ui.js`)
- `UIManager`:
  - `init(app)`
  - `updateTelemetry(fps, latencyMs, particleCount, gpuMode)`
  - `exportPreset()` -> `string (JSON)`
  - `importPreset(jsonString)` -> `boolean`
  - `loadPreset(presetIndex)`

---

## Code Layout
```
Fluid Swarm V4/
├── index.html              # Standalone entry point with glassmorphism layout & HUD
├── style.css               # Modern glassmorphism CSS, animations, responsive design
├── script.js               # Self-contained standalone production bundle
├── src/                    # Modular ES6 component sources
│   ├── config.js           # Presets, color themes, constants
│   ├── math.js             # Vector arithmetic, Simplex & Curl Noise
│   ├── spatial_grid.js     # Zero-allocation 1D Spatial Hash Grid
│   ├── physics.js          # Swarm physics, Boids, predator-prey, singularities, shockwaves
│   ├── renderer_webgl.js   # WebGL 2/1 instanced particle renderer + FBO post-processing
│   ├── renderer_canvas.js  # High-performance Canvas 2D fallback renderer
│   ├── audio.js            # Web Audio API analyzer + procedural synthesizer
│   ├── input.js            # Multi-pointer, touch gestures, mouse inertia, keyboard shortcuts
│   ├── ui.js               # Glassmorphic HUD, telemetry, sliders, preset manager
│   └── app.js              # Application coordinator & fixed-timestep loop
├── test/
│   ├── test_runner.js      # Headless test runner & automated assertion suite
│   ├── e2e_suite.js        # E2E test cases (Tiers 1-4)
│   └── test_harness.html   # In-browser test runner UI with real-time pass/fail matrix
└── README.md               # Complete user manual, features guide, shortcuts, Plash setup
```
