## 2026-08-24T22:23:29Z
You are teamwork_preview_worker_m1_1.
Your working directory is: /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/teamwork_preview_worker_m1_1
Authoritative request file: /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/ORIGINAL_REQUEST.md
Scope document: /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/PROJECT.md

Explorer Reports to follow:
- /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/teamwork_preview_explorer_m1_1/handoff.md
- /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/teamwork_preview_explorer_m1_2/handoff.md
- /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/.agents/teamwork_preview_explorer_m1_3/handoff.md

Write Ownership:
You exclusively own and must implement the following files in /Users/karthikreddydubbaka/AG Folders/Wallpapers - Custom for Monitor/Fluid Swarm V4/:
1. `src/math.js`:
   - SimplexNoise implementation (2D, 3D, 4D) with analytical partial derivatives
   - Divergence-Free Curl Noise with multi-octave support
   - TrigLUT (4096-entry lookup table for high speed)
   - OKLab/Oklch perceptual color conversion and palette LUT generators
   - Vector utilities (fastInvSqrt, normalize, distSq, clamp, boundary wrap)
2. `src/spatial_grid.js`:
   - Zero-allocation 1D TypedArray Spatial Hash Grid (`SpatialHashGrid`) using flat `Int32Array` linked lists (`cellHead`, `next`)
   - `clear()`, `insert(id, x, y)`, `queryNeighbors(x, y, radius, callback, maxNeighbors)`
3. `src/physics.js`:
   - Structure-of-Arrays (SoA) particle buffer using `Float32Array` (supporting up to 100,000 particles with attributes: `[x, y, vx, vy, size, mass, life, maxLife, speciesId, energy]`)
   - 4-species ecosystem dynamics (Phytoplankton, Starling Boids, Void Predators, Vortex Weavers) with Reynolds flocking and predator-prey dynamics
   - 8 cosmic/quantum physics modes: (0) Vortex Typhoon, (1) Kerr Singularity / Black Hole, (2) Quantum Repulsor, (3) Nebula Drift, (4) Magnetic Dipole, (5) Cryo Freeze, (6) Strange Attractor Chaos, (7) Swarm Flocking
   - Supersonic blast shockwaves system (expanding wave, impulse displacement, spark emissions)
   - Wandering pulsars & lightning plasma discharge arcs
   - Fixed-timestep accumulator (120 Hz) with numerical safety invariants (no NaNs, coordinate bounds, velocity clamping, division epsilon)
