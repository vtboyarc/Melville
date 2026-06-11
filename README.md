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
- **Drag** (mouse, or right thumb on touch screens) to look around; left thumb is the walk joystick
- **M** (or the Chart View button) toggles a bird's-eye view of the whole island, in the spirit of the original 1982 map
- The compass points to the nearest uncharted site; the Chart Key tracks progress
- Charted sites are remembered between visits; the ♪ button mutes the sound
- Chart all six and the tide turns — watch for it, or skip with any key

## Landmarks

Beyond the six Melville sites, the island carries the landmarks of his New
York — everything shown stood by September 1891: the Statue of Liberty
(1886, her copper still brown), Castle Williams on Governors Island, Castle
Garden, City Hall (1812), Federal Hall with its Washington statue (1883),
Trinity Church (1846), the Tribune (1875) and Western Union (1875)
buildings, the gold-domed World Building (1890), Cooper Union (1859),
Union Square with the equestrian Washington (1856), the Fifth Avenue Hotel
(1859), Madison Square Garden with Saint-Gaudens's Diana, the Brooklyn
Bridge (1883), and the Third Avenue El (1878). Landmark names fade in as
you approach on foot, and all are labeled in the chart view.

## Tech

- [Three.js](https://threejs.org/) (r160, loaded from CDN via an import map)
- Vanilla JS/HTML/CSS — **no build step, no dependencies to install**
- The 1890 streetscape is procedural: brownstone/brick/cast-iron facades with
  per-window variation are drawn to canvas textures (with bump maps) at load
  time, and the whole city is merged into a handful of meshes for performance
- The soundscape is procedural too: wind, harbor surf, the bell buoy, gulls,
  footsteps, the El's whistle, and the ships' horns are all synthesized with
  the Web Audio API — no audio files are shipped
- Coal smoke from the locomotive and the steamers is a single `THREE.Points`
  cloud (one draw call); the sun and clouds are canvas-textured sprites
- Progress is saved to `localStorage`, so the chart survives a reload

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
