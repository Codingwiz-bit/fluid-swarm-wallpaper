/**
 * Fluid Swarm V4 - Zero-Allocation 1D TypedArray Spatial Hash Grid
 * Module: src/spatial_grid.js
 * 
 * High-performance spatial acceleration structure for O(N) neighbor queries
 * using flat Int32Array linked-list chains (cellHead, next).
 * 
 * Zero heap allocations during runtime clear, insert, and neighbor queries.
 */

export class SpatialHashGrid {
  /**
   * @param {number} width - World boundary width in pixels
   * @param {number} height - World boundary height in pixels
   * @param {number} cellSize - Square dimension of each grid cell (default 48px)
   * @param {number} maxEntities - Maximum particle capacity (default 100,000)
   */
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

  /**
   * Resizes the grid dimensions if display resolution changes.
   * Only re-allocates cellHead if the required cell count changes.
   * @param {number} width
   * @param {number} height
   */
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

  /**
   * Resets all cell linked-list heads. Zero heap allocations (C++ level memset).
   */
  clear() {
    this.cellHead.fill(-1);
  }

  /**
   * Inserts an entity into the grid.
   * Strictly O(1) constant time with zero heap allocation.
   * @param {number} id - Entity index (0 <= id < maxEntities)
   * @param {number} x - Entity X coordinate
   * @param {number} y - Entity Y coordinate
   */
  insert(id, x, y) {
    if (id < 0 || id >= this.maxEntities) return;

    let cx = (x * this.invCellSize) | 0;
    let cy = (y * this.invCellSize) | 0;

    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;

    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;

    const cellIndex = cy * this.cols + cx;
    this.next[id] = this.cellHead[cellIndex];
    this.cellHead[cellIndex] = id;
  }

  /**
   * Clears the grid and bulk inserts active particles from a contiguous SoA buffer.
   * @param {Float32Array} particleBuffer - SoA Float32Array
   * @param {number} count - Active particle count
   * @param {number} stride - Attributes per particle (default 10)
   */
  populate(particleBuffer, count, stride = 10) {
    this.cellHead.fill(-1);
    const n = Math.min(count, this.maxEntities);
    for (let i = 0; i < n; i++) {
      const off = i * stride;
      const x = particleBuffer[off + 0];
      const y = particleBuffer[off + 1];

      let cx = (x * this.invCellSize) | 0;
      let cy = (y * this.invCellSize) | 0;

      if (cx < 0) cx = 0;
      else if (cx >= this.cols) cx = this.cols - 1;

      if (cy < 0) cy = 0;
      else if (cy >= this.rows) cy = this.rows - 1;

      const cellIndex = cy * this.cols + cx;
      this.next[i] = this.cellHead[cellIndex];
      this.cellHead[cellIndex] = i;
    }
  }

  /**
   * Queries all entities within a circular radius using a particle buffer.
   * Invokes callback(neighborId, dx, dy, distSq).
   * Supports early termination if callback returns false or maxNeighbors is reached.
   * 
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius in pixels
   * @param {Float32Array} buffer - Particle SoA buffer
   * @param {number} stride - Stride in floats (default 10)
   * @param {Function} callback - (neighborId, dx, dy, distSq) => void|boolean
   * @param {number} maxNeighbors - Maximum neighbors to process (default Infinity)
   * @returns {number} Number of neighbors processed
   */
  queryNeighborsBuffer(x, y, radius, buffer, stride, callback, maxNeighbors = Infinity) {
    const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
    const maxCx = Math.min(this.cols - 1, ((x + radius) * this.invCellSize) | 0);
    const minCy = Math.max(0, ((y - radius) * this.invCellSize) | 0);
    const maxCy = Math.min(this.rows - 1, ((y + radius) * this.invCellSize) | 0);
    const r2 = radius * radius;
    let foundCount = 0;

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let pId = this.cellHead[rowOffset + cx];
        while (pId !== -1) {
          const off = pId * stride;
          const px = buffer[off + 0];
          const py = buffer[off + 1];
          const dx = px - x;
          const dy = py - y;
          const d2 = dx * dx + dy * dy;

          if (d2 <= r2) {
            foundCount++;
            const res = callback(pId, dx, dy, d2);
            if (res === false || foundCount >= maxNeighbors) {
              return foundCount;
            }
          }
          pId = this.next[pId];
        }
      }
    }
    return foundCount;
  }

  /**
   * Generic neighbor query by calling callback(neighborId) for entities in cells overlapping radius.
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @param {Function} callback - (neighborId) => void|boolean
   * @param {number} maxNeighbors - Max neighbor count
   * @returns {number}
   */
  queryNeighbors(x, y, radius, callback, maxNeighbors = Infinity) {
    const minCx = Math.max(0, ((x - radius) * this.invCellSize) | 0);
    const maxCx = Math.min(this.cols - 1, ((x + radius) * this.invCellSize) | 0);
    const minCy = Math.max(0, ((y - radius) * this.invCellSize) | 0);
    const maxCy = Math.min(this.rows - 1, ((y + radius) * this.invCellSize) | 0);
    let foundCount = 0;

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let pId = this.cellHead[rowOffset + cx];
        while (pId !== -1) {
          foundCount++;
          const res = callback(pId);
          if (res === false || foundCount >= maxNeighbors) {
            return foundCount;
          }
          pId = this.next[pId];
        }
      }
    }
    return foundCount;
  }
}
