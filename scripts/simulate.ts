// Simulate games over every layout with random reveal orders and report how fast
// the engine pins down the key. Usage: bun scripts/simulate.ts [trialsPerLayout] [seed]
import { DEFAULT_DATASET } from "../src/datasets";
import { expandLayouts } from "../src/engine/layouts";
import { solve } from "../src/engine/solve";
import type { Color, Layout, Team } from "../src/engine/types";

const trials = Number(process.argv[2] ?? 100);
let seed = Number(process.argv[3] ?? 1);
// mulberry32: small seeded PRNG so runs are reproducible.
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const layouts = expandLayouts(DEFAULT_DATASET.cards);
const other = (t: Team): Team => (t === "R" ? "B" : "R");

/** All my unrevealed tiles are known (the engine's certain set equals them). */
function allMineCertain(truth: Layout, me: Team, revealed: Map<number, Color>) {
  const s = solve(layouts, { start: truth.start, me, revealed });
  if (!s.candidates.includes(truth)) throw new Error(`true layout card ${truth.card} r${truth.rotation} eliminated`);
  const mine = truth.cells.flatMap((c, p) => (c === me && !revealed.has(p) ? [p] : []));
  return { s, certain: mine.length === s.certain.length && mine.every((p) => s.certain.includes(p)) };
}

function stats(xs: number[]) {
  const a = [...xs].sort((x, y) => x - y);
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const median = a.length % 2 ? a[(a.length - 1) / 2]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2;
  return `mean ${mean.toFixed(2)}, median ${median}, worst ${a[a.length - 1]}, best ${a[0]}`;
}
function histogram(xs: number[]) {
  const h = new Map<number, number>();
  for (const x of xs) h.set(x, (h.get(x) ?? 0) + 1);
  return [...h.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${((100 * v) / xs.length).toFixed(1)}%`).join("  ");
}

// 1. Random reveal order over all 25 tiles (both teams' guesses reveal tiles).
const toUnique: number[] = [];
const toCertain: Record<"starting" | "other", number[]> = { starting: [], other: [] };
let checks = 0;
for (const truth of layouts) {
  for (let t = 0; t < trials; t++) {
    const order = shuffle([...Array(25).keys()]);
    const revealed = new Map<number, Color>();
    let unique = -1;
    const certainAt = { starting: -1, other: -1 };
    for (let k = 0; k <= 25 && (unique < 0 || certainAt.starting < 0 || certainAt.other < 0); k++) {
      if (k > 0) revealed.set(order[k - 1]!, truth.cells[order[k - 1]!]!);
      const a = allMineCertain(truth, truth.start, revealed);
      const b = allMineCertain(truth, other(truth.start), revealed);
      checks += 2;
      if (unique < 0 && a.s.status === "solved") unique = k;
      if (certainAt.starting < 0 && a.certain) certainAt.starting = k;
      if (certainAt.other < 0 && b.certain) certainAt.other = k;
    }
    toUnique.push(unique);
    toCertain.starting.push(certainAt.starting);
    toCertain.other.push(certainAt.other);
  }
}

console.log(`${layouts.length} layouts × ${trials} random reveal orders = ${toUnique.length} games (${checks} engine calls)`);
console.log("true layout eliminated: never (checked after every reveal)");
console.log(`reveals to a unique layout:           ${stats(toUnique)}`);
console.log(`  ${histogram(toUnique)}`);
console.log(`reveals until starting team's remaining tiles are all certain: ${stats(toCertain.starting)}`);
console.log(`  ${histogram(toCertain.starting)}`);
console.log(`reveals until other team's remaining tiles are all certain:    ${stats(toCertain.other)}`);
console.log(`  ${histogram(toCertain.other)}`);

// 2. Luu's scenario: only correct guesses (my own tiles) are revealed.
for (const [label, pick] of [["starting team", (l: Layout) => l.start], ["other team", (l: Layout) => other(l.start)]] as const) {
  const needed: number[] = [];
  const leftAfter3: number[] = [];
  const bestHitAfter3: number[] = [];
  for (const truth of layouts) {
    const me = pick(truth);
    const mine = truth.cells.flatMap((c, p) => (c === me ? [p] : []));
    for (let t = 0; t < trials; t++) {
      const order = shuffle(mine);
      const revealed = new Map<number, Color>();
      let k = 0;
      while (!allMineCertain(truth, me, revealed).certain) {
        revealed.set(order[k]!, me);
        k++;
      }
      needed.push(k);
      const after3 = solve(layouts, { start: truth.start, me, revealed: new Map(order.slice(0, 3).map((p) => [p, me])) });
      leftAfter3.push(after3.candidates.length);
      bestHitAfter3.push(after3.odds[after3.best!]![me]);
    }
  }
  const within = (n: number) => ((100 * needed.filter((k) => k <= n).length) / needed.length).toFixed(1);
  console.log(`\ncorrect reveals only (${label}): reveals until every remaining ${label} tile is certain: ${stats(needed)}`);
  console.log(`  ${histogram(needed)}`);
  console.log(`  certain after ≤2: ${within(2)}%  ≤3: ${within(3)}%  ≤4: ${within(4)}%`);
  console.log(`  after exactly 3 correct reveals: layouts left ${stats(leftAfter3)}`);
  console.log(`    best guess is mine with probability: mean ${(bestHitAfter3.reduce((a, b) => a + b, 0) / bestHitAfter3.length).toFixed(3)}, 100% sure in ${((100 * bestHitAfter3.filter((x) => x === 1).length) / bestHitAfter3.length).toFixed(1)}% of games`);
}

// 3. Guided play: always reveal the engine's best guess (deterministic, one game per layout).
// A miss ends a real turn, but the tile is still revealed, so play continues here.
for (const [label, pick] of [["starting team", (l: Layout) => l.start], ["other team", (l: Layout) => other(l.start)]] as const) {
  const reveals: number[] = [];
  const correctBefore: number[] = [];
  let missesBeforeCertain = 0;
  let firstThreeAllHit = 0;
  for (const truth of layouts) {
    const me = pick(truth);
    const revealed = new Map<number, Color>();
    let hits = 0;
    let missed = false;
    while (true) {
      const { s, certain } = allMineCertain(truth, me, revealed);
      if (certain) break;
      const p = s.best!;
      revealed.set(p, truth.cells[p]!);
      if (truth.cells[p] === me) hits++;
      else missed = true;
      if (revealed.size === 3 && hits === 3) firstThreeAllHit++;
    }
    reveals.push(revealed.size);
    correctBefore.push(hits);
    if (missed) missesBeforeCertain++;
  }
  const within = (n: number) => ((100 * reveals.filter((k) => k <= n).length) / reveals.length).toFixed(1);
  console.log(`\nguided by best guess (${label}): reveals until every remaining tile is certain: ${stats(reveals)}`);
  console.log(`  ${histogram(reveals)}`);
  console.log(`  certain after ≤3 reveals: ${within(3)}%  ≤4: ${within(4)}%`);
  console.log(`  games with a wrong guess before certainty: ${missesBeforeCertain}/${layouts.length}; first 3 guesses all correct: ${firstThreeAllHit}/${layouts.length}`);
}
