import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "./style.css";
import { DEFAULT_DATASET } from "./datasets";
import { expandLayouts } from "./engine/layouts";
import { solve } from "./engine/solve";
import { CELLS, SIZE, type Color, type Team } from "./engine/types";

interface State {
  start: Team;
  me: Team;
  /** Board position → revealed color. */
  revealed: Record<number, Color>;
}

const STORAGE_KEY = "key-card-finder/v1";
const layouts = expandLayouts(DEFAULT_DATASET.cards);
const CYCLE: (Color | undefined)[] = [undefined, "R", "B", "N", "A"];
const NAMES: Record<Color, string> = { R: "red agent", B: "blue agent", N: "bystander", A: "assassin" };
const TEAM: Record<Team, string> = { R: "red", B: "blue" };

const GLYPHS: Record<Color, string> = {
  R: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 18 17H2Z"/></svg>',
  B: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="13" rx="2"/></svg>',
  N: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="8.5" width="14" height="3" rx="1.5"/></svg>',
  A: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 4.5 15.5 15.5M15.5 4.5 4.5 15.5" stroke-width="3" stroke-linecap="round"/></svg>',
};

function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as State;
    if ((saved.start === "R" || saved.start === "B") && (saved.me === "R" || saved.me === "B") && saved.revealed) return saved;
  } catch {
    // No saved game.
  }
  return { start: "R", me: "R", revealed: {} };
}

let state = load();
const history: State[] = [];

function commit(next: State) {
  history.push(state);
  if (history.length > 500) history.shift();
  state = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

const board = document.querySelector<HTMLDivElement>("#board")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const legendEl = document.querySelector<HTMLParagraphElement>("#legend")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undo")!;
const newGameButton = document.querySelector<HTMLButtonElement>("#new-game")!;

const tiles: HTMLButtonElement[] = [];
for (let row = 0; row < SIZE; row++) {
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  rowEl.setAttribute("role", "row");
  for (let col = 0; col < SIZE; col++) {
    const pos = row * SIZE + col;
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.setAttribute("role", "gridcell");
    tile.addEventListener("click", () => {
      const current = state.revealed[pos];
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      const revealed = { ...state.revealed };
      if (next) revealed[pos] = next;
      else delete revealed[pos];
      commit({ ...state, revealed });
    });
    tiles.push(tile);
    rowEl.append(tile);
  }
  board.append(rowEl);
}

for (const group of document.querySelectorAll<HTMLElement>(".segmented")) {
  const setting = group.dataset.setting as "start" | "me";
  for (const button of group.querySelectorAll<HTMLButtonElement>("button")) {
    button.addEventListener("click", () => {
      const value = button.dataset.value as Team;
      if (state[setting] !== value) commit({ ...state, [setting]: value });
    });
  }
}

undoButton.addEventListener("click", () => {
  const prev = history.pop();
  if (!prev) return;
  state = prev;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
});

newGameButton.addEventListener("click", () => {
  if (Object.keys(state.revealed).length) commit({ ...state, revealed: {} });
});

function percent(p: number): string {
  if (p > 0 && p < 0.01) return "<1";
  if (p < 1 && p > 0.99) return ">99";
  return String(Math.round(p * 100));
}

function render() {
  const revealed = new Map(Object.entries(state.revealed).map(([k, v]) => [Number(k), v]));
  const s = solve(layouts, { start: state.start, me: state.me, revealed });
  const mine = state.me;
  document.body.dataset.me = mine;
  document.body.dataset.status = s.status;

  for (const group of document.querySelectorAll<HTMLElement>(".segmented")) {
    const setting = group.dataset.setting as "start" | "me";
    for (const button of group.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute("aria-checked", String(button.dataset.value === state[setting]));
    }
  }
  undoButton.disabled = history.length === 0;
  newGameButton.disabled = revealed.size === 0;

  for (let pos = 0; pos < CELLS; pos++) {
    const tile = tiles[pos]!;
    const where = `Row ${Math.floor(pos / SIZE) + 1}, column ${(pos % SIZE) + 1}`;
    const color = revealed.get(pos);
    const odds = s.odds[pos];
    tile.classList.toggle("best", s.best === pos && s.status !== "solved");
    tile.classList.toggle("certain", s.certain.includes(pos));
    delete tile.dataset.color;
    delete tile.dataset.key;
    tile.style.removeProperty("--p");

    if (color) {
      tile.dataset.color = color;
      tile.innerHTML = GLYPHS[color];
      tile.setAttribute("aria-label", `${where}: revealed ${NAMES[color]}. Tap to change.`);
    } else if (s.key) {
      const keyColor = s.key[pos]!;
      tile.dataset.key = keyColor;
      tile.innerHTML = GLYPHS[keyColor];
      tile.setAttribute("aria-label", `${where}: ${NAMES[keyColor]} on the key.`);
    } else if (odds) {
      const p = odds[mine];
      tile.style.setProperty("--p", String(p));
      const risk = odds.A >= 0.1 ? `<span class="risk" title="Chance of the assassin">${GLYPHS.A}${percent(odds.A)}</span>` : "";
      tile.innerHTML = `<span class="pct">${percent(p)}<small>%</small></span>${risk}`;
      tile.setAttribute(
        "aria-label",
        `${where}: ${percent(p)}% chance it's yours${odds.A > 0 ? `, ${percent(odds.A)}% assassin` : ""}${s.best === pos ? ". Best next guess" : ""}.`,
      );
    } else {
      tile.innerHTML = "";
      tile.setAttribute("aria-label", `${where}: unrevealed.`);
    }
  }

  const left = s.candidates.length;
  if (s.status === "no-match") {
    statusEl.textContent = "No key card matches these taps. Undo the last tap or check the colors and starting team.";
  } else if (s.status === "solved") {
    const remaining = s.key!.filter((c, p) => c === mine && !revealed.has(p)).length;
    statusEl.textContent =
      remaining === 0
        ? `Key found. All your agents are revealed.`
        : `Key found. Your ${remaining} remaining agent${remaining === 1 ? " is" : "s are"} marked in ${TEAM[mine]}.`;
  } else if (revealed.size === 0) {
    statusEl.textContent = `Tap each tile as it's revealed. ${left} key layouts fit so far.`;
  } else {
    const sure = s.certain.length;
    statusEl.textContent = `${left} key layouts still fit.${sure ? ` ${sure} tile${sure === 1 ? " is" : "s are"} certainly yours.` : ""}`;
  }

  legendEl.textContent =
    s.status === "open"
      ? "Numbers show the chance a tile is yours. The ringed tile is the best next guess."
      : s.status === "solved"
        ? "Faded tiles show the rest of the key."
        : "";
}

render();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js");
}
