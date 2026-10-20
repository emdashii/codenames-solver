// Build data/review.html: each card's photo crop beside a rendering of its transcription.
// The crops come from the source photo, so both inputs and output are gitignored.
// Expects data/source/review-crops/cardNN.jpg (made by the local crop tool).
import { existsSync } from "node:fs";
import { DEFAULT_DATASET } from "../src/datasets";
import { counts, groupSizes, longRuns } from "../src/engine/validate";

const root = new URL("../data/", import.meta.url);
const cropDir = new URL("source/review-crops/", root);
if (!existsSync(cropDir)) {
  console.error("Missing data/source/review-crops/; run the crop tool first.");
  process.exit(1);
}

// Cells where the two independent readings disagreed before being resolved by eye.
const disputed: Record<number, number[]> = { 5: [1] };

const fill = { R: "#e0524a", B: "#4f8fd6", N: "#ece6cf", A: "#1d1d1f" } as const;
const mark = { R: "◆", B: "●", N: "", A: "✕" } as const;

const cards = await Promise.all(
  DEFAULT_DATASET.cards.map(async (card) => {
    const jpg = Buffer.from(await Bun.file(new URL(`card${String(card.card).padStart(2, "0")}.jpg`, cropDir)).arrayBuffer());
    const n = counts(card);
    const notes = [
      ...longRuns(card).map((r) => `${r.length}×${r.color} in ${r.line}`),
      ...(["R", "B"] as const).filter((c) => groupSizes(card, c)[0]! >= 6).map((c) => `6-group ${c}`),
    ];
    const cells = card.grid
      .join("")
      .split("")
      .map((c, i) => {
        const k = c as keyof typeof fill;
        const flag = disputed[card.card]?.includes(i) ? " disputed" : "";
        return `<div class="c${flag}" style="background:${fill[k]};color:${k === "A" ? "#fff" : "rgba(0,0,0,.35)"}">${mark[k]}</div>`;
      })
      .join("");
    return `<figure>
  <figcaption><b>${card.card}</b> <span class="dot" style="background:${fill[card.start]}"></span>${card.start === "R" ? "red" : "blue"} start · ${n.R}R ${n.B}B ${n.N}N ${n.A}A${notes.length ? ` · ${notes.join(", ")}` : ""}</figcaption>
  <div class="pair"><img src="data:image/jpeg;base64,${jpg.toString("base64")}" alt="Photo crop of card ${card.card}"><div class="grid" style="border-color:${fill[card.start]}">${cells}</div></div>
</figure>`;
  }),
);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Key card transcription review</title>
<style>
  :root { color-scheme: light dark; font-family: var(--font-sans, system-ui, sans-serif); color: var(--foreground, CanvasText); background: var(--background, Canvas); }
  body { margin: 0; }
  p { margin: 0 0 12px; color: var(--muted-foreground, GrayText); font-size: 14px; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
  figure { margin: 0; }
  figcaption { font-size: 13px; margin-bottom: 6px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
  img { width: 100%; aspect-ratio: 1; border-radius: 6px; display: block; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; padding: 6px; background: #222; border: 4px solid; border-radius: 8px; }
  .c { aspect-ratio: 1; border-radius: 3px; display: grid; place-items: center; font-size: 11px; }
  .disputed { outline: 3px solid #f5c400; outline-offset: -1px; }
</style></head><body>
<p>Left: photo crop. Right: transcription in the same orientation. Border color = starting team. A yellow outline marks a cell the two independent readings disagreed on (resolved by eye).</p>
<main>
${cards.join("\n")}
</main></body></html>`;

await Bun.write(new URL("review.html", root), html);
console.log(`wrote data/review.html (${(html.length / 1024).toFixed(0)} KB)`);
