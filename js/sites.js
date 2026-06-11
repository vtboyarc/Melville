// The six sites of Melville's Manhattan, after the chart in
// "Plaque Honors Melville, New York's Own," The New York Times, Jan. 19, 1982.
// Positions are in world units; north is -z.

export const SITES = [
  {
    id: 'birthplace',
    num: 2, // numbering follows the source chart's key
    title: 'The Birthplace — 6 Pearl Street',
    dates: 'August 1, 1819',
    pos: { x: 2, z: 82 },
    body: [
      `On this spot, a few steps from the Battery, Herman Melville was born on
       August 1, 1819 — third child of the merchant Allan Melvill and Maria
       Gansevoort Melvill. The harbor was the family business, and it was the
       boy's first horizon: wharves, square-riggers, and the sea-smell of
       Pearl Street.`,
      `When the import firm failed, the family fled the city for Albany, and
       his father died soon after, broken and in debt. Herman went to sea —
       first to Liverpool at nineteen aboard a packet ship, then to the South
       Pacific aboard the whaler <em>Acushnet</em>. A second plaque long
       marked this site near the Battery.`,
    ],
    artifact: 'A brass spyglass — the first horizon',
  },
  {
    id: 'customs-hudson',
    num: 3,
    title: 'The Day Job — Gansevoort Street Pier',
    dates: '1866 – 1885 · District Inspector of Customs',
    pos: { x: -49, z: -12 },
    body: [
      `In December 1866 the author of <em>Moby-Dick</em> took the only steady
       salary of his life: District Inspector of Customs at the Port of New
       York — badge No. 75, four dollars a day, six days a week, and never a
       raise in nineteen years.`,
      `His station was a wooden office at the foot of Gansevoort Street, a
       street that, by a strange tide, bears his mother's family name. The
       Custom House of that era was a swamp of graft; Melville stayed clean —
       a colleague reportedly called him the only honest inspector on the
       docks. By day he counted cargo; by lamplight at home he finished
       <em>Clarel</em>, the longest poem in American literature.`,
    ],
    artifact: 'Customs inspector’s badge, No. 75',
  },
  {
    id: 'house',
    num: 1,
    title: 'The House — 104 East 26th Street',
    dates: '1863 – 1891',
    pos: { x: 18, z: -78 },
    body: [
      `In 1863 Melville bought this three-story brick row house — roughly
       twenty by forty-five feet — from his brother Allan, and lived here for
       twenty-eight years, longer than anywhere else in his life. Here he
       wrote <em>Battle-Pieces</em> (1866), his Civil War poems;
       <em>Clarel</em> (1876); <em>John Marr</em> and <em>Timoleon</em>; and,
       at a desk upstairs in retirement, the manuscript found unfinished at
       his death: <em>Billy Budd, Sailor</em>.`,
      `He died here on September 28, 1891. In January 1982 the Herman
       Melville Society fixed a bronze plaque to the office building that now
       stands on the site: <em>“Herman Melville — The American Author —
       Resided from 1863–1891 at This Site.”</em>`,
    ],
    artifact: 'The manuscript of Billy Budd, tied with ribbon',
    image: {
      src: 'assets/melville-plaque.webp',
      alt: 'The bronze Herman Melville plaque at 104 East 26th Street',
      caption: `The bronze tablet at the site today, placed by the Herman
        Melville Society in January 1982.`,
    },
  },
  {
    id: 'diana',
    num: 5,
    title: 'Diana, Over Madison Square',
    dates: '1890 – 1891',
    pos: { x: -4, z: -73 },
    body: [
      `A block west of Melville's stoop lay Madison Square, where the aging
       inspector liked to walk with his granddaughters. In 1890 Stanford
       White's colossal new Madison Square Garden rose at 26th and Madison,
       and in the autumn of 1891 — only weeks after Melville's death —
       Augustus Saint-Gaudens's gilded <em>Diana</em> was hoisted to the top
       of its tower: an arrow drawn in gold over the rooftops he had known.`,
      `In 1985 the city named the corner of Park Avenue South and 26th Street
       <em>Herman Melville Square</em>. The Diana now stands in the
       Philadelphia Museum of Art.`,
    ],
    artifact: 'A gilded arrow, still warm from the sun',
    image: {
      src: 'assets/diana-tower.jpg',
      alt: 'Saint-Gaudens’s Diana atop the Madison Square Garden tower',
      caption: `Diana drawing her bow atop Stanford White's Madison Square
        Garden tower, high over the rooftops Melville knew.`,
    },
  },
  {
    id: 'el',
    num: 6,
    title: 'The Third Avenue El',
    dates: 'opened 1878',
    pos: { x: 28, z: -58 },
    body: [
      `By the 1880s the old sailor commuted like any other New Yorker: down
       the block to the Third Avenue Elevated, its little steam locomotives
       rattling above the cobblestones on iron stilts.`,
      `A man who had rounded Cape Horn under square sail now rode to the
       docks by elevated train. He kept to himself; almost none of his fellow
       riders knew that the gray-bearded customs inspector had once been
       famous on two continents as the man who lived among cannibals.`,
    ],
    artifact: 'A nickel ticket for the El',
  },
  {
    id: 'customs-east',
    num: 4,
    title: 'The Later Post — East River Docks',
    dates: 'until December 31, 1885',
    pos: { x: 49, z: -95 },
    body: [
      `Inspectors were shuffled from station to station, and in his later
       working years Melville's post moved uptown along the East River, near
       the foot of East 79th Street. From the dockhead he watched the age of
       sail he had written into legend give way, hull by hull, to steam.`,
      `A small family legacy at last let him resign on December 31, 1885,
       after nineteen years on the docks — free to finish his poems, and to
       begin a story about a handsome sailor named Billy Budd.`,
    ],
    artifact: 'A ship’s log, salt-stained',
  },
];

export const EPILOGUE = [
  `When Melville died at 104 East 26th Street on September 28, 1891, he was
   so thoroughly forgotten that one New York obituary notice misspelled his
   masterpiece <em>“Mobie Dick.”</em> The funeral was small. He was buried at
   Woodlawn Cemetery in the Bronx, beside the sons he had outlived.`,
  `Then the tide turned. <em>Billy Budd</em>, found in manuscript on his
   desk, was finally published in 1924 — and lit the fuse of the great
   Melville revival. <em>Moby-Dick</em> rose from failure to stand as the
   American novel.`,
  `Today a bronze plaque (1982) marks the site of the house; the corner of
   Park Avenue South and 26th Street is <em>Herman Melville Square</em>
   (1985); and the Gansevoort dock where he clocked in for nineteen winters
   lies beside a Manhattan park. You have charted all six true places of
   his island.`,
];
