# E2E Test Infra: Fluid Swarm V4

## Test Philosophy
- Opaque-box, requirement-driven testing derived from `ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory`.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Pass/Fail Semantics: Strict exit code 0 for automated runners, 100% assertions passing across all tiers.

## Feature Inventory Coverage Matrix
| # | Feature | Requirement Source | Tier 1 (Coverage) | Tier 2 (BVA/Corner) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---------|-------------------|:-----------------:|:-------------------:|:-----------------:|:-------------------:|
| 1 | Divergence-Free Curl Noise | PROJECT.md § F1 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Flat TypedArray SoA Buffer | PROJECT.md § F2 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | 1D Spatial Hash Grid | PROJECT.md § F3 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Multi-Species Ecosystem | PROJECT.md § F4 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | 8 Cosmic Physics Modes | PROJECT.md § F5 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Multi-Touch & Kinetic Inertia | PROJECT.md § F6 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Supersonic Blast Shockwaves | PROJECT.md § F7 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Wandering Pulsars & Lightning | PROJECT.md § F8 | 5 tests | 5 tests | ✓ | ✓ |
| 9 | Fixed Timestep & Invariants | PROJECT.md § F9 | 5 tests | 5 tests | ✓ | ✓ |
| 10 | WebGL 2/1 Instanced Renderer | PROJECT.md § F10 | 5 tests | 5 tests | ✓ | ✓ |
| 11 | FBO Ping-Pong Trail Advection | PROJECT.md § F11 | 5 tests | 5 tests | ✓ | ✓ |
| 12 | Multi-Pass Post-Processing | PROJECT.md § F12 | 5 tests | 5 tests | ✓ | ✓ |
| 13 | Canvas 2D Fallback Engine | PROJECT.md § F13 | 5 tests | 5 tests | ✓ | ✓ |
| 14 | Dynamic DPR & DRS Scaling | PROJECT.md § F14 | 5 tests | 5 tests | ✓ | ✓ |
| 15 | 8 Master Color Themes | PROJECT.md § F15 | 5 tests | 5 tests | ✓ | ✓ |
| 16 | Dynamic Color Interpolation | PROJECT.md § F16 | 5 tests | 5 tests | ✓ | ✓ |
| 17 | Web Audio FFT Engine | PROJECT.md § F17 | 5 tests | 5 tests | ✓ | ✓ |
| 18 | Procedural Audio Synthesizer | PROJECT.md § F18 | 5 tests | 5 tests | ✓ | ✓ |
| 19 | Curated Presets & Manager | PROJECT.md § F19 | 5 tests | 5 tests | ✓ | ✓ |
| 20 | Glassmorphic HUD & Telemetry | PROJECT.md § F20 | 5 tests | 5 tests | ✓ | ✓ |
| 21 | Granular Parameter Sliders | PROJECT.md § F21 | 5 tests | 5 tests | ✓ | ✓ |
| 22 | Comprehensive Keyboard Hotkeys | PROJECT.md § F22 | 5 tests | 5 tests | ✓ | ✓ |
| 23 | Standalone Zero-Dependency Build | PROJECT.md § F23 | 5 tests | 5 tests | ✓ | ✓ |
| 24 | In-App Diagnostic Benchmark | PROJECT.md § F24 | 5 tests | 5 tests | ✓ | ✓ |

## Test Architecture
- **Automated CLI Runner**: `node test/test_runner.js` (executes headless Node & browser harness verification).
- **In-Browser Test Harness**: `test/test_harness.html` with real-time UI test visualizer, assertion logs, and benchmark profiling.
- **Coverage Thresholds**:
  - Tier 1: $\ge 5 \times 24 = 120$ feature tests
  - Tier 2: $\ge 5 \times 24 = 120$ boundary & corner tests
  - Tier 3: $\ge 24$ cross-feature pairwise tests
  - Tier 4: $\ge 12$ real-world application & workload scenarios
  - Tier 5: Adversarial white-box stress & memory leak verification

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Plash macOS Wallpaper Hosting | F9, F14, F20, F23 | High |
| 2 | High-Refresh Display Switching (60Hz <-> 120Hz <-> 144Hz) | F2, F9, F10 | Medium |
| 3 | Long-Duration Stability (30-Minute Soak Simulation) | F2, F3, F9, F11 | High |
| 4 | Rapid Cosmic Physics Mode Switching | F4, F5, F7, F8 | Medium |
| 5 | Preset Customization, Save, Export & Import Round-trip | F19, F20, F21 | Medium |
| 6 | Audio Reactivity Bass Shockwave Cascade | F7, F17, F18, F12 | High |
| 7 | Multi-Touch Pinch Vortex Gestures | F5, F6, F7 | Medium |
| 8 | Dynamic Resolution Downscaling under Extreme Particle Counts (100k) | F2, F10, F14, F24 | High |
| 9 | Fallback from WebGL context loss to Canvas 2D | F10, F13, F14 | High |
| 10 | Keyboard Hotkey Rapid Traversal | F5, F15, F19, F22 | Low |
| 11 | Color Palette Interpolation under Particle Energy Surges | F15, F16, F12 | Medium |
| 12 | Autonomous Idle Wandering Pulsars & Lightning Discharges | F1, F4, F8 | Medium |
