const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      ROWS_NUMBER: 30,
      COLS_NUMBER: 30,
      trackCells: [],
      startPointCoords: { row: null, col: null },
      finishPointCoords: { row: null, col: null },
      currentCarPosition: { row: null, col: null },
      fastestRoute: [],
      isDrawingRoute: false,
      currentMode: 'Set start point',
      routePresets: [],
      heuristicWeight: 1,
      timeTaken: 0,
      timeTakenHistory: [],
    };
  },
  computed: {
    /* ---------------- COORDS OF ALL CELLS BETWEEN START AND FINISH ----------------- */
    trackCellsWithoutInitialPoints() {
      return this.trackCells.filter(
        (cell) =>
          !(
            cell.row === this.startPointCoords.row &&
            cell.col === this.startPointCoords.col
          ) &&
          !(
            cell.row === this.finishPointCoords.row &&
            cell.col === this.finishPointCoords.col
          )
      );
    },
    /* --------------------------- TRACK COMPLETE CHECKERS --------------------------- */
    isTrackComplete() {
      return (
        this.cellIsNeighbour(
          this.finishPointCoords.row,
          this.finishPointCoords.col,
          true
        ) && this.isTrackContinuous
      );
    },
    isTrackContinuous() {
      return checkInseparability(
        this.startPointCoords,
        this.finishPointCoords,
        this.trackCellsWithoutInitialPoints
      );
    },
    /* ----------------------- CHECK IF TRACK SHOULD BE SAVEABLE ---------------------- */
    trackIsDiffrentThanPresets() {
      return this.routePresets.every((preset) => {
        return (
          JSON.stringify(preset.trackCells) !== JSON.stringify(this.trackCells)
        );
      });
    },
  },
  mounted() {
    /* ----------------------------- GET TRACK PRESETS -------------------------------- */
    fetch('./example_presets.json')
      .then((response) => response.json())
      .then((data) => (this.routePresets = data));
  },
  methods: {
    /* ------------------------- CELL STATE CHECKERS ---------------------------------- */
    cellIsInTrack(row, col) {
      return this.trackCells.some(
        (cell) => cell.row === row && cell.col === col
      );
    },
    cellIsInFastestRoute(row, col) {
      return this.fastestRoute.some(
        (cell) => cell.row === row && cell.col === col
      );
    },
    cellIsStartPoint(row, col) {
      return (
        this.startPointCoords.row === row && this.startPointCoords.col === col
      );
    },
    cellIsFinishPoint(row, col) {
      return (
        this.finishPointCoords.row === row && this.finishPointCoords.col === col
      );
    },
    cellIsNeighbour(row, col, withStartPoints = false) {
      if (
        !withStartPoints &&
        (this.cellIsStartPoint(row, col) || this.cellIsFinishPoint(row, col))
      )
        return false;

      const checker = (array) =>
        array.some(
          (cell) =>
            (cell.row === row && cell.col === col - 1) ||
            (cell.row === row && cell.col === col + 1) ||
            (cell.row === row - 1 && cell.col === col) ||
            (cell.row === row + 1 && cell.col === col)
        );

      if (withStartPoints) {
        return checker(this.trackCellsWithoutInitialPoints);
      } else {
        return checker(this.trackCells);
      }
    },
    /* ------------------------------- HANDLE CELL CLICK -------------------------------- */
    handleClick(event) {
      if (this.isDrawingRoute) return;
      const { row, col } = event.srcElement.dataset;
      const cellRow = Number(row);
      const cellCol = Number(col);

      const coordinates = { row: cellRow, col: cellCol };

      if (this.currentMode === 'Set start point')
        return this.setStartPoint(coordinates);
      if (this.currentMode === 'Set finish point')
        return this.setFinishPoint(coordinates);

      if (this.cellIsInTrack(cellRow, cellCol)) {
        this.trackCells = this.trackCells.filter(
          (cell) => cell.row !== cellRow || cell.col !== cellCol
        );
        return;
      }

      if (
        this.cellIsStartPoint(cellRow, cellCol) ||
        this.cellIsFinishPoint(cellRow, cellCol) ||
        !this.cellIsNeighbour(cellRow, cellCol)
      )
        return;

      this.trackCells.push(coordinates);
    },
    /* -------------------------------- UTILS ------------------------------------- */
    resetTrackCells() {
      if (this.isDrawingRoute) return;
      this.startPointCoords = { row: null, col: null };
      this.finishPointCoords = { row: null, col: null };
      this.trackCells = [this.startPointCoords, this.finishPointCoords];
      this.currentCarPosition = { row: null, col: null };
      this.fastestRoute = [];
      this.currentMode = 'Set start point';
      this.timeTakenHistory = [];
      this.timeTaken = 0;
    },
    savePreset() {
      if (
        !this.isTrackComplete ||
        this.isDrawingRoute ||
        this.currentMode === 'Finding fastest route'
      )
        return;
      this.routePresets.push({
        startPointCoords: { ...this.startPointCoords },
        finishPointCoords: { ...this.finishPointCoords },
        trackCells: [...this.trackCells],
      });
    },
    loadPreset(preset) {
      if (this.isDrawingRoute || this.currentMode === 'Finding fastest route')
        return;

      this.resetTrackCells();
      this.startPointCoords = { ...preset.startPointCoords };
      this.finishPointCoords = { ...preset.finishPointCoords };
      this.trackCells = [...preset.trackCells];
      this.currentMode = 'Drawing route';
    },
    setStartPoint(cell) {
      this.startPointCoords = { ...cell };
      this.currentMode = 'Set finish point';
    },
    setFinishPoint(cell) {
      this.finishPointCoords = { ...cell };
      this.currentMode = 'Drawing route';
      this.trackCells = [this.startPointCoords, this.finishPointCoords];
    },
    createMatrix(trackCells) {
      const maxRow = Math.max(
        this.startPointCoords.row,
        this.finishPointCoords.row,
        ...trackCells.map((p) => p.row)
      );
      const maxCol = Math.max(
        this.startPointCoords.col,
        this.finishPointCoords.col,
        ...trackCells.map((p) => p.col)
      );

      const matrix = Array.from({ length: maxRow + 2 }, () =>
        Array(maxCol + 2).fill(0)
      );

      for (const cell of [
        this.startPointCoords,
        ...trackCells,
        this.finishPointCoords,
      ]) {
        matrix[cell.row][cell.col] = 1;
      }

      return matrix;
    },
    /* ---------------------------- FINDING FASTEST ROUTE ------------------------------- */
    async findAndDrawFastestRoute() {
      if (
        !this.isTrackComplete ||
        this.isDrawingRoute ||
        this.currentMode === 'Finding fastest route'
      )
        return;

      const startTime = performance.now();

      const trackCellsCopy = [...this.trackCellsWithoutInitialPoints];
      const matrix = this.createMatrix(trackCellsCopy);

      this.currentMode = 'Finding fastest route';
      this.timeTaken = 0;
      this.fastestRoute = [];

      this.fastestRoute = await this.aStar(
        matrix,
        this.startPointCoords,
        this.finishPointCoords
      );
      const endTime = performance.now();
      const timeTaken =
        Math.round(((endTime - startTime) / 1000) * 1000) / 1000;
      this.timeTakenHistory.push({
        time: timeTaken,
        length: this.fastestRoute.length,
      });
      this.timeTaken = timeTaken;

      this.isDrawingRoute = true;

      this.currentMode = 'Route preview';

      await this.drawRouteWithDelay(this.fastestRoute).then(() => {
        this.isDrawingRoute = false;
        this.currentMode = 'Track complete';
      });
    },
    async drawRouteWithDelay(route) {
      // Move the car by changing the current position
      for (let i = 0; i < route.length; i++) {
        const { row, col } = route[i];
        this.currentCarPosition = { row, col };
        await sleep(5);
      }
    },
    // A* algorithm implementation
    async aStar(grid, start, end) {
      const openSet = [start]; // The set of nodes to be evaluated
      const cameFrom = {}; // the map of parents of nodes
      const gScore = { [start.row + '-' + start.col]: 0 }; // the map of costs from start to a node
      const fScore = {
        [start.row + '-' + start.col]:
          this.heuristicWeight * heuristic(start, end),
      }; // the map of costs from start to a node + heuristic cost to the end

      while (openSet.length > 0) {
        openSet.sort(
          (a, b) => fScore[a.row + '-' + a.col] - fScore[b.row + '-' + b.col]
        );
        const current = openSet.shift(); // the node in openSet having the lowest fScore[] value (cost)
        await sleep(10);

        this.currentCarPosition = { ...current };

        if (current.row === end.row && current.col === end.col) {
          const path = reconstructPath(cameFrom, end);
          return path;
        } // if current is the end node, return the path

        for (const neighbor of getNeighbors(grid, current)) {
          // getNeighbors(grid, current) - returns the list of neighbors of the current node
          const tentativeGScore = gScore[current.row + '-' + current.col] + 1;

          if (
            !gScore.hasOwnProperty(neighbor.row + '-' + neighbor.col) ||
            tentativeGScore < gScore[neighbor.row + '-' + neighbor.col]
          ) {
            cameFrom[neighbor.row + '-' + neighbor.col] = current;
            gScore[neighbor.row + '-' + neighbor.col] = tentativeGScore;
            fScore[neighbor.row + '-' + neighbor.col] =
              tentativeGScore + this.heuristicWeight * heuristic(neighbor, end);

            if (
              !openSet.some(
                (node) => node.row === neighbor.row && node.col === neighbor.col
              )
            ) {
              openSet.push(neighbor);
            }
          }
        }
      }

      return null;
    },
  },
});

app.mount('#app');

/* --------------------------------- UTILS -------------------------------------------- */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------- CHECKING INSEPARABILITY OF TRACK ------------------------ */
// Depth-First Search (DFS) algorithm
// row, col - current point coordinates
// targetRow, targetCol - finish point coordinates
// matrix - representing the grid
function dfs(row, col, targetRow, targetCol, matrix) {
  if (
    row < 0 ||
    row >= matrix.length ||
    col < 0 ||
    col >= matrix[0].length ||
    matrix[row][col] !== 1
  ) {
    return false;
  }

  if (row === targetRow && col === targetCol) {
    return true;
  }

  matrix[row][col] = 0; // Mark point as visited

  // Check all possible directions
  return (
    dfs(row - 1, col, targetRow, targetCol, matrix) ||
    dfs(row + 1, col, targetRow, targetCol, matrix) ||
    dfs(row, col - 1, targetRow, targetCol, matrix) ||
    dfs(row, col + 1, targetRow, targetCol, matrix)
  );
}

function checkInseparability(startPointCoords, finishPointCoords, trackCells) {
  // Find max row and col
  const maxRow = Math.max(
    startPointCoords.row,
    finishPointCoords.row,
    ...trackCells.map((p) => p.row)
  );
  const maxCol = Math.max(
    startPointCoords.col,
    finishPointCoords.col,
    ...trackCells.map((p) => p.col)
  );

  // Create matrix with dimensions bigger than the biggest point coordinates
  const matrix = Array.from({ length: maxRow + 2 }, () =>
    Array(maxCol + 2).fill(0)
  );

  // Fill the matrix with track coordinates represented as 1
  for (const cell of [startPointCoords, finishPointCoords, ...trackCells]) {
    matrix[cell.row][cell.col] = 1;
  }

  // Check inseparability with DFS algorithm
  return dfs(
    startPointCoords.row,
    startPointCoords.col,
    finishPointCoords.row,
    finishPointCoords.col,
    matrix
  );
}

/* ------------------------------------ A** ---------------------------------- */

function heuristic(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
} // calcualtes the cost of moving from point a to point b

function getNeighbors(grid, { row, col }) {
  const neighbors = [];

  if (row > 0 && grid[row - 1][col] === 1) {
    neighbors.push({ row: row - 1, col });
  }

  if (row < grid.length - 1 && grid[row + 1][col] === 1) {
    neighbors.push({ row: row + 1, col });
  }

  if (col > 0 && grid[row][col - 1] === 1) {
    neighbors.push({ row, col: col - 1 });
  }

  if (col < grid[0].length - 1 && grid[row][col + 1] === 1) {
    neighbors.push({ row, col: col + 1 });
  }

  return neighbors;
}

function reconstructPath(cameFrom, current) {
  const path = [current];

  while (cameFrom.hasOwnProperty(current.row + '-' + current.col)) {
    current = cameFrom[current.row + '-' + current.col];
    path.unshift(current);
  }

  return path;
}
