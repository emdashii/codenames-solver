// Print a validation report for data/keycards.json. Exits non-zero on any problem.
import { DEFAULT_DATASET } from "../src/datasets";
import { coincidentLayouts, expandLayouts } from "../src/engine/layouts";
import { groupSizes, longRuns, validateCards } from "../src/engine/validate";

const cards = DEFAULT_DATASET.cards;
const layouts = expandLayouts(cards);
console.log(`${cards.length} cards → ${layouts.length} layouts`);
console.log(`start: ${cards.filter((c) => c.start === "R").length} red, ${cards.filter((c) => c.start === "B").length} blue`);

const groups = coincidentLayouts(layouts);
console.log(
  groups.length === 0
    ? "coinciding rotations: none (all 160 layouts are distinct)"
    : `coinciding rotations:\n${groups.map((g) => "  " + g.map((l) => `card ${l.card} r${l.rotation}`).join(" = ")).join("\n")}`,
);

console.log("runs of 4+ (rows/columns):");
for (const card of cards) {
  for (const run of longRuns(card)) console.log(`  card ${card.card} (${card.start} start): ${run.length} ${run.color} in ${run.line}`);
}
console.log("cards with 6+ connected tiles of one team:");
for (const card of cards) {
  for (const color of ["R", "B"] as const) {
    const largest = groupSizes(card, color)[0]!;
    if (largest >= 6) console.log(`  card ${card.card} (${card.start} start): ${largest} connected ${color}`);
  }
}

const problems = validateCards(cards);
console.log(problems.length ? `PROBLEMS:\n  ${problems.join("\n  ")}` : "validation: all checks pass");
process.exit(problems.length ? 1 : 0);
