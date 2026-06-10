# Melville's Manhattan 🐋

A small browser game: walk Herman Melville's New York, 1819–1891.

Explore a parchment-and-ink, low-poly Manhattan of the 1880s as the old
customs inspector himself. Find the six red markers — the true places of
Melville's island — read their stories, collect their artifacts, and chart
them all to unlock the epilogue.

**The six sites** (after the chart in *"Plaque Honors Melville, New York's
Own,"* The New York Times, January 19, 1982):

1. **The house, 104 East 26th Street** (1863–1891) — where he wrote
   *Battle-Pieces*, *Clarel*, and *Billy Budd*, and where he died.
2. **The birthplace, 6 Pearl Street** (August 1, 1819) — near the Battery.
3. **The day job** — District Inspector of Customs at the Gansevoort Street
   pier, $4 a day from 1866 to 1885, and never a raise.
4. **The later post** — his station moved uptown along the East River late
   in his career.
5. **Diana** (1890–91) — Saint-Gaudens's gilded archer atop Stanford White's
   new Madison Square Garden, a block from his stoop.
6. **The Third Avenue El** — the old square-rig sailor's commute.

## Playing

- **W A S D** / arrow keys to walk; **E** or the on-screen button to visit a site
- On touch screens, drag anywhere to walk
- The compass points to the nearest uncharted site; the Chart Key tracks progress

## Tech

- [Three.js](https://threejs.org/) (r160, loaded from CDN via an import map)
- Vanilla JS/HTML/CSS — **no build step, no dependencies to install**

## Run locally

Any static file server works:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy on Vercel

Import the GitHub repository in Vercel and choose:

- **Framework preset:** Other
- **Build command:** none
- **Output directory:** `./` (the repo root)

Vercel will serve `index.html` as a static site.

## Sources

- Aljean Harmetz, ["Plaque Honors Melville, New York's Own,"](https://www.nytimes.com/1982/01/19/books/plaque-honors-melville-new-york-s-own.html) *The New York Times*, Jan. 19, 1982
- [Herman Melville's New York — NYC Department of Records](https://www.archives.nyc/blog/2024/9/13/herman-melvilles-new-york)
- [Moby Dick: Herman Melville's Epic Journey Began on Gansevoort Street — Village Preservation](https://www.villagepreservation.org/2017/11/14/moby-dick-herman-melvilles-epic-journey-began-on-gansevoort-street/)
- [Herman Melville — Flatiron NoMad history](https://flatironnomad.nyc/history/herman-melville/)
- [Birthplace of Herman Melville historical marker](https://www.hmdb.org/m.asp?m=127940)
