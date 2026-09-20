# Mordekaiser Bible — Companion

A desktop app that puts the Bible inside your League client. At champ select you
click whichever enemy you think is going top; it pushes that matchup's rune page
into the client, saves the build as an in-shop item set, and can set your
summoner spells. In game a small always-on-top card shows the build order and
the writeup's tips, and switches itself to the real enemy top laner once the
game knows who that is.

![picker](docs/picker.png) ![overlay](docs/overlay.png)

---

## Installing it

### Option A — download the app (easiest, no Node.js needed)

Go to the **[latest release](https://github.com/aliz2007/morde-builder/releases/latest)**
and download the file for your system:

| Your system | File to download | Then |
|---|---|---|
| **Windows** | `Mordekaiser Bible Companion Setup x.y.z.exe` | Run it — it installs like any app. Or grab the other `.exe` (portable): no install, just double-click. Windows SmartScreen will warn because the app is unsigned: click **More info → Run anyway**. |
| **macOS** | `Mordekaiser Bible Companion x.y.z-arm64.dmg` | Open the `.dmg`, drag the app to Applications. It's unsigned, so the first launch is **right-click → Open** (not a double-click), then confirm. |
| **Linux** | `Mordekaiser Bible Companion x.y.z.AppImage` | `chmod +x` the file and run it. |

**Launching it:** start the app whenever — before or after League. It puts a
crown in your tray (Windows) or menu bar (macOS) and waits; you don't need to
do anything else. When champ select starts, the picker window pops up — click
the enemy you think is going top and your runes, item set and the in-game
overlay card are handled for you.

### Option B — run from source

You need [Node.js](https://nodejs.org) 20 or newer (the LTS installer is fine;
on Windows just click through it).

```bash
git clone -b claude/companion-app https://github.com/aliz2007/morde-builder.git
cd morde-builder/companion
npm install
npm start
```

`-b claude/companion-app` matters — the companion lives on that branch, not on
the repository's default branch. After the first time, `npm start` from
`morde-builder/companion` is all you need.

### Cutting a new release (maintainers)

Push a `companion-v*` tag on a branch that contains `companion/`:

```bash
git checkout claude/companion-app
git tag companion-v0.3.0
git push origin companion-v0.3.0
```

That fires the `companion-release` workflow, which builds all three platforms
and attaches them to a GitHub release.

---

## Using it

**Start the companion whenever — before or after League.** It puts a crown in
your tray (Windows) or menu bar (macOS) and waits. The picker window's status
dot lights up teal when it finds your client.

**At champ select** the picker lists the enemy team as they lock in. Click the
one you think is going top. Champions the Bible has a writeup for are the ones
worth clicking; the rest say so.

That one click, depending on your toggles:

| | What it does |
|---|---|
| **Push runes** | Creates a page called `MB: <champion>` in your client and selects it. Re-picking replaces it instead of stacking new pages. |
| **Save item set** | Saves the matchup's build — both paths, with the author's notes as row labels — as an item set named `MB: <champion>`, visible in the in-game shop. Your own item sets are left alone. |
| **Set summoners** | Off by default. Sets the matchup's summoner spells. Only works during champ select. |
| **Show overlay** | Opens the overlay card. |

Every toggle is in the picker window and the tray menu, and your choice sticks
between launches.

**In game**, the overlay shows the difficulty ratings, summoners, both build
paths and the tips:

- `Ctrl+Shift+M` (`Cmd+Shift+M` on macOS) shows and hides it
- drag it anywhere by its title bar
- **drag the bottom-right corner** to resize it — shrink it down to just the
  title bar if you like; size and position are remembered between games
- **the dropdown in the title bar picks what the card shows** — Everything,
  TL;DR, Early game, How to trade, Watch out for, Tips, Items or Summoners —
  so you can read just the section you want; your choice sticks between launches
- **pin** makes it click-through, so you can play straight through it
- **hide** puts it away; the hotkey or the tray brings it back

Once the game tells the app who the enemy top laner actually is, the overlay
switches to that matchup on its own — so a wrong guess at champ select fixes
itself.

**Run League borderless or windowed.** A fullscreen-exclusive game covers every
other window on the OS, including this one. Borderless is what most players use
already.

### If something does not work

**The status dot never lights up.** The app looks for League's `lockfile` in the
usual places (`C:/Riot Games/…`, `D:/Riot Games/…`, `C:/Program Files/Riot Games/…`,
`/Applications/League of Legends.app/…`, and your home folder). If yours is
somewhere else, point it there:

```bash
MB_LOCKFILE="D:/Games/League of Legends/lockfile" npm start
```

On Windows PowerShell: `$env:MB_LOCKFILE="D:/Games/League of Legends/lockfile"; npm start`

**Rune pages full?** They aren't a problem any more. When the client has no free
slot, the app deletes the oldest deletable page it isn't using (never one called
`MB: …` — those are replaced, and never the page currently selected) and says in
the log which page it removed. Only if every single page is undeletable will it
ask you to free one yourself.

**A champion pushes nothing and logs an error.** The app refuses to push a page
it cannot resolve completely, rather than pushing a wrong one. The log line
names exactly which rune or item it could not find.

**Nothing appears over the game.** See the borderless note above.

---

## How it talks to League

Two local, Riot-provided interfaces — the same ones every build companion uses:

- the **LCU API** (the client's own local REST/WebSocket service, credentials
  read from the client's lockfile) for champ select state, rune pages, item
  sets and summoner spells;
- the **Live Client Data API** (`https://127.0.0.1:2999`) for who is in the
  game and what position they hold.

No game memory is read, nothing plays the game for you, and nothing leaves your
machine — there is no server. The overlay shows static guide text.

**No rune, item or spell ID is hardcoded.** On every launch the app reads the
catalog your own client serves (`/lol-game-data/assets/v1/…`) and resolves the
Bible's names against it. Whatever the current patch renamed, the app follows;
whatever it cannot match, it refuses to push and tells you, rather than pushing
a wrong page.

---

## Development

```bash
npm test              # full flow against a bundled mock client — no League needed
npm run audit         # resolve all 139 matchups against the real patch catalog
npm run smoke         # boots the real app against the mock and screenshots it
npm run fetch-catalog # refresh the catalog snapshot to the current patch
npm run dist          # build an installer for the machine you are on
```

`mock/` contains a faithful fake of the LCU (lockfile, auth, REST, WebSocket
events) and of the Live Client API. The test suite drives the whole flow
through it: connect → champ select → pick → verify the exact rune page, item
set and spell payloads the client would receive → in-game top-laner detection.

### Testing against real Riot data

`test/realdata/` holds a trimmed Data Dragon snapshot — every item, summoner
spell, champion and rune of a real patch, reduced to the fields the resolver
looks at. `test/realdata.js` reshapes it into the layout the LCU serves and
`npm run audit` runs the entire Bible through it, reporting anything that fails
to resolve or resolves to the wrong thing.

This is worth doing because the real catalog is far nastier than any handmade
fixture: 868 items where 214 names are shared by several ids (Arena copies,
Ornn upgrades, mode variants), several champions duplicated as game-mode clones,
and three different summoner spells called "Flash". The audit against it found
and fixed the following, none of which the mock could have caught:

- ties between identically-named items made every abbreviated build step
  ("Rocketbelt", "Liandry's", "Rylai's") resolve to nothing — 256 build rows,
  and four matchups produced an empty item set that the client would reject;
- `Scaling Health` resolved to the *flat* Health shard in 65 matchups, because
  substring containment outranked a full word-set match — the worst kind of
  failure, since a wrong rune is pushed silently;
- `Flash` resolved to the Arena spell rather than the Summoner's Rift one;
- game-mode champion clones could shadow the real champion, which would have
  attached item sets to a Mordekaiser nobody plays;
- a one-letter typo in the source spreadsheet sank a whole rune page;
- a matchup listing three secondary runes produced a ten-perk page;
- two secondary runes from the same row were pushed instead of refused.

Two caveats, stated because the audit's output is only as honest as its inputs:
Data Dragon does not publish the stat-shard rows, so those come from
`mock/stat-shards.js` — kept in sync with the rows and names the live client
actually serves (`Move Speed`, not `Movement Speed`; flex row is Adaptive
Force / Move Speed / Health Scaling) — and the snapshot is a patch-in-time, so
a rename after it was taken would show up on a live client before it shows up
here.

**Status:** verified end-to-end against the mock client, including headless runs
of the real Electron app — and of the **packaged** build, which exercises the
same file layout the installers ship. Name resolution is verified against real
Data Dragon files. **It has not yet been run against a live League client**; any
breakage there will be in lockfile discovery or endpoint shape, both of which
log loudly. If the client boots slower than the app, the companion retries every
3 seconds until the client answers.

---

## A note on Riot policy

Rune/item importers and passive information overlays are the category Riot has
long tolerated (Blitz, Mobalytics, Porofessor and company operate publicly on
exactly these APIs). This app stays inside that: sanctioned local APIs only, no
memory reading, no automation of play. Use it at your own discretion all the
same.
