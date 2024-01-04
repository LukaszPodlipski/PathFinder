const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      test: 'hihihihi',
      ROWS_NUMBER: 30,
      COLS_NUMBER: 30,
      trackCells: [],
      startPointCoords: { row: 20, col: 8 },
      finishPointCoords: { row: 17, col: 10 },
    };
  },
  mounted() {
    this.trackCells = [this.startPointCoords, this.finishPointCoords];
  },
  computed: {
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
    isTrackComplete() {
      return (
        this.cellIsNeighbour(
          this.finishPointCoords.row,
          this.finishPointCoords.col,
          true
        ) && this.trackIsContinuous
      );
    },
    trackIsContinuous() {
      return (
        this.trackCellsWithoutInitialPoints.length &&
        this.trackCellsWithoutInitialPoints.every((cell, index, array) => {
          if (index === 0) return true;
          const previousCell = array[index - 1];
          return (
            (cell.row === previousCell.row &&
              cell.col === previousCell.col - 1) ||
            (cell.row === previousCell.row &&
              cell.col === previousCell.col + 1) ||
            (cell.row === previousCell.row - 1 &&
              cell.col === previousCell.col) ||
            (cell.row === previousCell.row + 1 && cell.col === previousCell.col)
          );
        })
      );
    },
  },
  methods: {
    handleClick(event) {
      const { row, col } = event.srcElement.dataset;
      const cellRow = Number(row);
      const cellCol = Number(col);

      if (this.cellIsInTrack(cellRow, cellCol)) {
        this.trackCells = this.trackCells.filter(
          (cell) => cell.row !== cellRow || cell.col !== cellCol
        );
        return;
      }

      if (
        this.cellIsStartPoint(row, col) ||
        this.cellIsFinishPoint(row, col) ||
        !this.cellIsNeighbour(cellRow, cellCol)
      )
        return false;

      this.trackCells.push({ row: cellRow, col: cellCol });
    },
    cellIsInTrack(row, col) {
      return this.trackCells.some(
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
    resetTrackCells() {
      this.trackCells = [this.startPointCoords, this.finishPointCoords];
    },
  },
});

app.mount('#app');
