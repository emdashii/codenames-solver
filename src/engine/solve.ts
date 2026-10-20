import { CELLS, COLORS, type Color, type Layout, type Reveals, type Team } from "./types";

export type Odds = Record<Color, number>;

export interface Solution {
  /** Layouts consistent with the starting team and every reveal. */
  candidates: Layout[];
  /**
   * "no-match": no layout fits — a tap is probably wrong.
   * "solved": every remaining candidate has the same cells.
   */
  status: "no-match" | "open" | "solved";
  /** Per board position; null for revealed tiles or when nothing matches. */
  odds: (Odds | null)[];
  /** Unrevealed tiles that are mine in every candidate. */
  certain: number[];
  /** Unrevealed tile most likely to be mine; null when none can be. */
  best: number | null;
  /** The full key when solved. */
  key: Color[] | null;
}

export interface Query {
  start: Team;
  me: Team;
  revealed: Reveals;
}

export function matches(layout: Layout, start: Team, revealed: Reveals): boolean {
  if (layout.start !== start) return false;
  for (const [pos, color] of revealed) {
    if (layout.cells[pos] !== color) return false;
  }
  return true;
}

export function solve(layouts: readonly Layout[], { start, me, revealed }: Query): Solution {
  const candidates = layouts.filter((l) => matches(l, start, revealed));
  const n = candidates.length;
  if (n === 0) {
    return { candidates, status: "no-match", odds: new Array(CELLS).fill(null), certain: [], best: null, key: null };
  }

  const odds: (Odds | null)[] = [];
  // Expected candidate count after revealing a tile: Σ count(color)² / n.
  const expectedLeft: number[] = [];
  for (let pos = 0; pos < CELLS; pos++) {
    if (revealed.has(pos)) {
      odds.push(null);
      expectedLeft.push(n);
      continue;
    }
    const counts: Odds = { R: 0, B: 0, N: 0, A: 0 };
    for (const l of candidates) counts[l.cells[pos]!]++;
    expectedLeft.push(COLORS.reduce((s, c) => s + counts[c] ** 2, 0) / n);
    odds.push({ R: counts.R / n, B: counts.B / n, N: counts.N / n, A: counts.A / n });
  }

  const unrevealed = [...Array(CELLS).keys()].filter((p) => !revealed.has(p));
  const certain = unrevealed.filter((p) => odds[p]![me] === 1);

  let best: number | null = null;
  for (const p of unrevealed) {
    if (odds[p]![me] === 0) continue;
    if (best === null) {
      best = p;
      continue;
    }
    const [a, b] = [odds[p]!, odds[best]!];
    if (
      a[me] > b[me] ||
      (a[me] === b[me] && expectedLeft[p]! < expectedLeft[best]!) ||
      (a[me] === b[me] && expectedLeft[p] === expectedLeft[best] && a.A < b.A)
    ) {
      best = p;
    }
  }

  const first = candidates[0]!.cells;
  const solved = candidates.every((l) => l.cells.every((c, i) => c === first[i]));
  return { candidates, status: solved ? "solved" : "open", odds, certain, best, key: solved ? first : null };
}
