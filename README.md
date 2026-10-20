# Key Card Finder

An unofficial helper for the Codenames board game, built for <https://codenames.mazzaella.com>.

The base game ships with 40 key cards, and each card can sit in its stand in four rotations, so the spymaster holds one of 160 layouts. As tiles are revealed, the guessing team taps them in. The app keeps only the layouts that still fit and shows, for each unrevealed tile, the chance that it belongs to your team. Once a single layout remains, it shows the whole key.

The idea comes from Dan Luu's [Codenames essay](https://danluu.com/codenames/) and CodeSlate's [video](https://www.youtube.com/watch?v=UYCgGDSUnB0).

## Use it

1. Set **Starts** to the team whose color the border lights show.
2. Set **My team**.
3. Each time a tile is revealed, tap it: one tap for red, two for blue, three for a bystander, four for the assassin. A fifth tap clears it.

Hold the phone in any orientation, but keep that orientation for the whole game. Each tile shows the percent chance it is yours. Tiles certain to be yours get a solid edge. The ringed tile is the best next guess: the highest chance of being yours, with ties going to the tile that rules out the most layouts. If no layout fits your taps, the app says so; use **Undo** to step back.

The app runs in the browser with no backend. It works offline after the first visit, and the current game survives a reload.

## Develop

Use [Bun](https://bun.sh) for everything.

```sh
bun install
bun run dev        # Vite dev server
bun test           # engine tests
bun run validate   # check data/keycards.json
bun run simulate   # reveal-order simulation over all 160 layouts
bun run build      # type-check and build to dist/
```

| Path | Contents |
|---|---|
| `data/keycards.json` | The 40 key cards: number, starting team, and a 5×5 grid of `R`/`B`/`N`/`A`. |
| `src/engine/` | Pure TypeScript solver: layout expansion, filtering, odds, best guess, validation. No UI. |
| `src/datasets.ts` | The list of key-card sets. Add other editions here. |
| `src/main.ts`, `src/style.css` | The single-screen UI. |
| `vite.config.ts` | Build config, plus a small plugin that writes the offline service worker. |
| `scripts/` | Validation report, simulation, and the transcription review page. |

## Key card data

The cards were transcribed from one photo of all 40 cards. Each card was cropped and perspective-corrected, then read twice: once by a pixel color classifier, and once by eye from the crops. The two readings disagreed on a single cell (card 5, where glare hid the assassin), which was resolved by looking at the crop again.

`bun run validate` checks every card:

- Each card has 9 tiles for the starting team, 8 for the other team, 7 bystanders and 1 assassin.
- The border color is the color with 9 tiles.
- No two cards are the same under rotation, and no card matches itself under a rotation, so all 160 layouts are distinct.
- No card has 5 in a row in any row or column.
- Every 4-in-a-row (7 cards) belongs to the starting team.
- Exactly one card (card 2, red start) has a connected group of 6 tiles of one team. It is a red group: 2 in a row centered next to 4 in a row, the shape Luu describes.

The photo, crops and review page (`data/source/`, `data/review.html`) are gitignored and never committed. `bun run review` rebuilds the review page from local crops.

## How quickly it narrows down

These figures come from `bun run simulate`, which plays 100 random reveal orders for each of the 160 layouts (16,000 games). The true layout was never eliminated.

| Scenario | Reveals needed (mean / median / worst) |
|---|---|
| Any tiles revealed in random order, until one layout remains | 4.59 / 4 / 13 |
| Same, until all your remaining tiles are certain | 4.59 / 4 / 13 |
| Only your own tiles revealed (starting team) | 4.62 / 5 / 8 |
| Only your own tiles revealed (other team) | 4.27 / 4 / 7 |

The first two rows are identical because no two layouts give either team the same set of tiles. Your remaining tiles are therefore certain exactly when a single layout remains.

Luu wrote that three guesses narrow the space enough to win with one more. With this data, three correct reveals leave every remaining tile certain in 4.8% of games for the starting team and 13.6% for the other team. On average 3.7 and 2.8 layouts remain, and the ringed best guess is yours about 78% of the time. Four correct reveals make everything certain in about half (starting team) to two thirds (other team) of games.

## Hosting

Netlify builds the site from GitHub on every push, using its Git integration (no tokens or Actions). `netlify.toml` runs `bun run build` and publishes `dist/`. Netlify's docs say it installs dependencies with Bun when the repository contains `bun.lockb`. Bun 1.3 writes a text `bun.lock` by default, so `bunfig.toml` sets `saveTextLockfile = false` to keep the binary lockfile, and `netlify.toml` pins `BUN_VERSION`.

## License

Code is MIT-licensed. data/keycards.json records the layouts of the key cards from Codenames (Czech Games Edition) for interoperability. It is not covered by the MIT license, and no rights to it are claimed. Codenames is a trademark of Czech Games Edition; this is an unofficial fan project.
