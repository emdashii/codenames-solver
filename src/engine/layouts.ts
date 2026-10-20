import { CELLS, SIZE, type Color, type KeyCard, type Layout } from "./types";

export function parseGrid(grid: readonly string[]): Color[] {
  const cells = grid.join("").split("");
  if (grid.length !== SIZE || cells.length !== CELLS || !cells.every((c) => "RBNA".includes(c))) {
    throw new Error(`Bad grid: ${JSON.stringify(grid)}`);
  }
  return cells as Color[];
}

/** Rotate a row-major grid a quarter turn clockwise. */
export function rotate(cells: readonly Color[]): Color[] {
  const out: Color[] = new Array(CELLS);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      // The cell at (r, c) moves to (c, SIZE - 1 - r).
      out[c * SIZE + (SIZE - 1 - r)] = cells[r * SIZE + c]!;
    }
  }
  return out;
}

/** Every card in each of its 4 rotations. */
export function expandLayouts(cards: readonly KeyCard[]): Layout[] {
  const layouts: Layout[] = [];
  for (const card of cards) {
    let cells = parseGrid(card.grid);
    for (const rotation of [0, 1, 2, 3] as const) {
      layouts.push({ card: card.card, rotation, start: card.start, cells });
      cells = rotate(cells);
    }
  }
  return layouts;
}

/** Groups of two or more layouts with identical cells (e.g. a card with 180° symmetry). */
export function coincidentLayouts(layouts: readonly Layout[]): Layout[][] {
  const byKey = new Map<string, Layout[]>();
  for (const l of layouts) {
    const key = l.cells.join("");
    byKey.set(key, [...(byKey.get(key) ?? []), l]);
  }
  return [...byKey.values()].filter((group) => group.length > 1);
}
