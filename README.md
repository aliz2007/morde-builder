# The Mordekaiser Bible

A website built from Meowdekaiser's Mordekaiser matchup spreadsheet — 139 matchups,
the itemization and rune guides, alternate setups, and creator credits.

Static HTML, CSS and vanilla ES modules. No framework, no build step, no dependencies.
Open `index.html` through any static server and it runs.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | The spreadsheet's introduction, contents, the V26.11–V26.14 patch changelog, credits |
| `matchups.html` | Instant search across all 139 champions, plus a browse grid; a matchup opens as a routed overlay |
| `guides.html` | Itemization by slot, the rune trees, alternate builds, creator table |

## Running it locally

```bash
python3 -m http.server 8765
# then open http://127.0.0.1:8765/
```

A server is required — the pages `fetch()` their data, which browsers block on `file://`.

## Deploying to GitHub Pages

The site is static at the repository root, so no Action is needed:

1. **Settings → Pages**
2. **Source: Deploy from a branch**
3. Branch: this branch (or `main` once merged), folder `/ (root)`

## Where the data comes from

Everything is generated from the source `.xlsx`. Nothing was rewritten, summarised or
invented — the writeups render exactly as authored.

- `data/matchups.json` — 139 records: ratings, runes, item paths, the full writeup parsed
  into its four authored sections (`Early Game`, `How to trade`, `What to watch out for`, `Tips`)
- `data/guides.json` — introduction, patch notes, itemization guide, rune guide,
  alternate setups, creators
- `assets/img/` — 319 champion, item, rune and summoner icons extracted from the
  workbook's embedded media

The workbook stores each matchup as a fixed 8-row block: champion portrait and keystone on
the anchor row, a six-slot item strip on the next, build commentary two rows down, and the
rune string four rows down. Slot 1 of the item strip is the starting item — Bramble Vest on
127 of 139 matchups, otherwise Doran's Helm, Shield or Ring.

### Icon identification

Item icons carry no names in the workbook. Roughly 33 were resolved exactly by pairing each
icon in the Itemization Guide with the prose beside it, which names the item; the rest were
cross-checked against the build text. **Icons whose identity is not certain get a generic
`alt` rather than a guessed name** — the icon and the author's own build text are always
shown, so nothing depends on the inference being right.

## Regenerating the data

`tools/build_data.py` reads the workbook and rewrites `data/` and `assets/img/`:

```bash
pip install openpyxl
python3 tools/build_data.py path/to/Mordekaiser_Matchup_Spreadsheet.xlsx
```

## Design notes

The look is a single locked system — near-black oxidised iron, one necrotic green accent
under a strict pixel budget, and four typefaces with one job each: Cinzel for monumental
headings, Barlow Condensed for chrome, Libre Franklin for prose, IBM Plex Mono for every
number. Spacing runs on a Fibonacci-derived scale rather than the usual 4px grid, corners
never exceed 3px, and all texture — grain, patina, rivets, weld seams, the sawtooth edges —
is pure CSS and SVG with no binary assets.

The writeups are never hidden. No tabs, no accordions, no "read more" — the source is
sequential narrative, so the fix for length is measure, rhythm and navigation: a 664px
column, a scroll-spy table of contents, and per-section anchors.

## Credits

All writing is by **Meowdekaiser**. This repository only reformats it.
Creator and contributor credits are listed on the site footer and the guides page.
