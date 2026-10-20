import { describe, expect, test } from "bun:test";
import { DEFAULT_DATASET } from "../src/datasets";
import { coincidentLayouts, expandLayouts, parseGrid, rotate } from "../src/engine/layouts";
import { solve } from "../src/engine/solve";
import type { Color, KeyCard, Team } from "../src/engine/types";
import { validateCards } from "../src/engine/validate";

const layouts = expandLayouts(DEFAULT_DATASET.cards);
const reveal = (cells: Color[], positions: number[]) => new Map(positions.map((p) => [p, cells[p]!]));

describe("dataset", () => {
  test("passes every card check", () => {
    expect(validateCards(DEFAULT_DATASET.cards)).toEqual([]);
  });

  test("expands to 160 distinct layouts", () => {
    expect(layouts).toHaveLength(160);
    expect(coincidentLayouts(layouts)).toEqual([]);
  });
});

describe("validation catches bad transcriptions", () => {
  const good = DEFAULT_DATASET.cards[0]!;
  test("wrong counts", () => {
    const bad: KeyCard = { ...good, grid: [good.grid[0]!.replace("N", "R"), ...good.grid.slice(1)] };
    expect(validateCards([bad, ...DEFAULT_DATASET.cards.slice(1)]).join()).toContain("card 1: counts");
  });

  test("wrong border color", () => {
    const bad: KeyCard = { ...good, start: good.start === "R" ? "B" : "R" };
    expect(validateCards([bad, ...DEFAULT_DATASET.cards.slice(1)]).join()).toContain("card 1: counts");
  });

  test("duplicate card under rotation", () => {
    const rotated = rotate(parseGrid(good.grid)).join("");
    const grid = [0, 1, 2, 3, 4].map((r) => rotated.slice(r * 5, r * 5 + 5));
    const cards = DEFAULT_DATASET.cards.map((c) => (c.card === 2 ? { ...c, start: good.start, grid } : c));
    expect(validateCards(cards).join()).toContain("card 2 equals card 1");
  });

  test("a 4-in-a-row of the non-starting team", () => {
    // Card 15 has BBBB in row 3; claiming red starts must flag the run.
    const cards = DEFAULT_DATASET.cards.map((c) => (c.card === 15 ? { ...c, start: "R" as const } : c));
    expect(validateCards(cards).join()).toContain("card 15: 4 B in a row (row 3) but R starts");
  });
});

describe("rotation", () => {
  test("four quarter turns return to the start; one turn moves the top-left corner to top-right", () => {
    const cells = parseGrid(DEFAULT_DATASET.cards[0]!.grid);
    expect(rotate(rotate(rotate(rotate(cells))))).toEqual(cells);
    expect(rotate(cells)[4]).toBe(cells[0]!);
    expect(rotate(cells)[24]).toBe(cells[4]!);
  });
});

describe("solve", () => {
  test("no reveals: only the starting team filters, 80 candidates", () => {
    const s = solve(layouts, { start: "R", me: "R", revealed: new Map() });
    expect(s.candidates).toHaveLength(80);
    expect(s.status).toBe("open");
    // Every tile is red in some layout, so odds sum to 1 and best exists.
    for (const o of s.odds) expect(o!.R + o!.B + o!.N + o!.A).toBeCloseTo(1);
    expect(s.best).not.toBeNull();
  });

  test("the true layout always survives its own reveals, and all reveals solve it", () => {
    for (const truth of layouts) {
      const all = reveal(truth.cells, [...Array(25).keys()]);
      const s = solve(layouts, { start: truth.start, me: truth.start, revealed: all });
      expect(s.status).toBe("solved");
      expect(s.candidates).toEqual([truth]);
    }
  });

  test("solved state exposes the key and marks every unrevealed tile of mine as certain", () => {
    const truth = layouts[37]!;
    const me: Team = truth.start === "R" ? "B" : "R";
    // Reveal tiles until solved.
    const revealed = new Map<number, Color>();
    for (let p = 0; p < 25; p++) {
      revealed.set(p, truth.cells[p]!);
      if (solve(layouts, { start: truth.start, me, revealed }).status === "solved") break;
    }
    const s = solve(layouts, { start: truth.start, me, revealed });
    expect(s.key).toEqual(truth.cells);
    const mine = [...Array(25).keys()].filter((p) => !revealed.has(p) && truth.cells[p] === me);
    expect(s.certain).toEqual(mine);
    expect(s.best !== null && mine.includes(s.best)).toBe(true);
  });

  test("contradictory taps give a no-match state", () => {
    const truth = layouts[0]!;
    const a = truth.cells.indexOf("A");
    const b = truth.cells.indexOf("N");
    // Two assassins can never both be true.
    const s = solve(layouts, { start: truth.start, me: "R", revealed: new Map<number, Color>([[a, "A"], [b, "A"]]) });
    expect(s.status).toBe("no-match");
    expect(s.candidates).toHaveLength(0);
    expect(s.best).toBeNull();
    expect(s.certain).toEqual([]);
  });

  test("starting team filters candidates", () => {
    const red = solve(layouts, { start: "R", me: "R", revealed: new Map() });
    expect(red.candidates.every((l) => l.start === "R")).toBe(true);
  });

  test("best guess maximizes my odds and breaks ties by expected candidates left", () => {
    const truth = layouts[10]!;
    const revealed = reveal(truth.cells, [0, 6, 12]);
    const me = truth.start;
    const s = solve(layouts, { start: truth.start, me, revealed });
    const top = Math.max(...s.odds.map((o) => o?.[me] ?? -1));
    expect(s.odds[s.best!]![me]).toBe(top);
    const left = (p: number) => {
      const n: Record<string, number> = {};
      for (const l of s.candidates) n[l.cells[p]!] = (n[l.cells[p]!] ?? 0) + 1;
      return Object.values(n).reduce((t, k) => t + k * k, 0);
    };
    for (let p = 0; p < 25; p++) {
      if (s.odds[p]?.[me] === top) expect(left(s.best!)).toBeLessThanOrEqual(left(p));
    }
  });

  test("tap orientation does not matter: the same reveals on a turned board still find the card", () => {
    const truth = layouts[21]!;
    const order = [3, 17, 9, 22, 1, 13, 5, 20, 11, 7, 15, 24];
    for (const rotation of [0, 1, 2, 3]) {
      const board = layouts.find((l) => l.card === truth.card && l.rotation === rotation)!;
      const s = solve(layouts, { start: truth.start, me: "B", revealed: reveal(board.cells, order) });
      expect(s.candidates).toContainEqual(board);
    }
  });
});
