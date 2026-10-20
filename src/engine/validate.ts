import { expandLayouts, parseGrid } from "./layouts";
import { SIZE, type Color, type KeyCard } from "./types";

export interface Run {
  color: Color;
  length: number;
  /** "row 2" or "col 4" (1-based), in the transcribed orientation. */
  line: string;
}

/** Maximal straight runs of 4 or more same-colored cells along rows and columns. */
export function longRuns(card: KeyCard, min = 4): Run[] {
  const cells = parseGrid(card.grid);
  const at = (r: number, c: number) => cells[r * SIZE + c]!;
  const runs: Run[] = [];
  for (const [kind, get] of [
    ["row", (i: number, j: number) => at(i, j)],
    ["col", (i: number, j: number) => at(j, i)],
  ] as const) {
    for (let i = 0; i < SIZE; i++) {
      let j = 0;
      while (j < SIZE) {
        let k = j;
        while (k + 1 < SIZE && get(i, k + 1) === get(i, j)) k++;
        if (k - j + 1 >= min) runs.push({ color: get(i, j), length: k - j + 1, line: `${kind} ${i + 1}` });
        j = k + 1;
      }
    }
  }
  return runs;
}

/** Sizes of orthogonally connected groups of one color, largest first. */
export function groupSizes(card: KeyCard, color: Color): number[] {
  const cells = parseGrid(card.grid);
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== color || seen.has(start)) continue;
    let size = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const [r, c] = [Math.floor(p / SIZE), p % SIZE];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const [nr, nc] = [r + dr, c + dc];
        const q = nr * SIZE + nc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && cells[q] === color && !seen.has(q)) {
          seen.add(q);
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

export function counts(card: KeyCard): Record<Color, number> {
  const out: Record<Color, number> = { R: 0, B: 0, N: 0, A: 0 };
  for (const c of parseGrid(card.grid)) out[c]++;
  return out;
}

/**
 * Check every card against the base-game rules and the patterns in Dan Luu's
 * essay. Returns human-readable problems; empty means the dataset is consistent.
 */
export function validateCards(cards: readonly KeyCard[]): string[] {
  const problems: string[] = [];
  const numbers = cards.map((c) => c.card).sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 1)) problems.push(`card numbers are not 1..${cards.length}`);

  for (const card of cards) {
    const id = `card ${card.card}`;
    try {
      parseGrid(card.grid);
    } catch (e) {
      problems.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    const n = counts(card);
    const other = card.start === "R" ? "B" : "R";
    if (n[card.start] !== 9 || n[other] !== 8 || n.N !== 7 || n.A !== 1) {
      problems.push(`${id}: counts ${JSON.stringify(n)}; expected 9 ${card.start}, 8 ${other}, 7 N, 1 A`);
    }
    for (const run of longRuns(card)) {
      if (run.length >= 5) problems.push(`${id}: ${run.length} ${run.color} in a row (${run.line})`);
      else if (run.color !== card.start && run.color !== "N") {
        problems.push(`${id}: 4 ${run.color} in a row (${run.line}) but ${card.start} starts`);
      }
    }
  }

  const seen = new Map<string, number>();
  for (const layout of expandLayouts(cards)) {
    const key = layout.cells.join("");
    const prev = seen.get(key);
    if (prev !== undefined && prev !== layout.card) {
      problems.push(`card ${layout.card} equals card ${prev} under rotation`);
    }
    seen.set(key, layout.card);
  }

  const big = cards.filter((c) => groupSizes(c, "R")[0]! >= 6 || groupSizes(c, "B")[0]! >= 6);
  if (big.length !== 1) {
    problems.push(`expected exactly one card with 6+ connected team tiles; found ${big.map((c) => c.card).join(", ") || "none"}`);
  } else if (big[0]!.start !== "R" || groupSizes(big[0]!, "R")[0]! < 6) {
    problems.push(`card ${big[0]!.card} has the 6-tile group but it is not a red-start red group`);
  }
  return problems;
}
