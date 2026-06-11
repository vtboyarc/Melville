import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SITES, EPILOGUE } from './sites.js';
import { audio } from './audio.js';

/* ============================================================
   Melville's Manhattan — a walkable chart of the author's city
   Parchment-and-ink Manhattan, c. 1880s. North is -z.
   ============================================================ */

const COLORS = {
  parchment: 0xefe6d0,
  islandTop: 0xece2c8,
  islandSide: 0xb3a482,
  outerLand: 0xe2d8bc,
  street: 0xccbf9e,
  park: 0xa9b58a,
  parkTree: 0x76885f,
  water: 0x9dbdb9,
  ink: 0x2b2620,
  red: 0xb23a2c,
  redDark: 0x7d2418,
  brick: 0x9a6b54,
  gold: 0xd4af37,
  wood: 0x8a6f4d,
  woodDark: 0x6e573b,
  sailcloth: 0xefe9da,
  stone: 0xb8a888,
  iron: 0x4a443c,
  trainGreen: 0x44523f,
};

// Island outline as (x, z) pairs, clockwise from the Battery tip.
const ISLAND = [
  [0, 96], [-14, 90], [-24, 76], [-32, 56], [-37, 34], [-40, 12],
  [-42, -14], [-43, -44], [-44, -78], [-44, -112],
  [44, -112], [42, -84], [39, -58], [35, -28], [30, 0], [25, 26],
  [18, 52], [10, 74], [4, 88],
];

// Walkable rectangles besides the island itself (the two customs piers).
const WALK_RECTS = [
  { x0: -58, x1: -39, z0: -15.5, z1: -8.5 },  // Gansevoort pier
  { x0: 39, x1: 58, z0: -98.5, z1: -91.5 },   // East River pier
];

const AVENUES = [-36, -24, -12, 0, 12, 24, 36];
const STREETS = [];
for (let z = 12; z >= -104; z -= 8) STREETS.push(z);

const EL_X = 30; // Third Avenue El runs along x = 30, z in [-109, 0]

const CLEAR_CIRCLES = SITES.map((s) => ({ x: s.pos.x, z: s.pos.z, r: 8.5 }));
CLEAR_CIRCLES.push({ x: 18, z: -84, r: 5.5 });   // the house itself
CLEAR_CIRCLES.push({ x: -8, z: 91, r: 6 });      // Castle Garden
CLEAR_CIRCLES.push({ x: 19, z: 46, r: 7 });      // bridge approach
CLEAR_CIRCLES.push({ x: 2, z: 48, r: 10 });      // City Hall and its park
CLEAR_CIRCLES.push({ x: -2, z: 38.8, r: 6.5 });  // Federal Hall
CLEAR_CIRCLES.push({ x: 12.5, z: 44, r: 5 });    // Tribune Building
CLEAR_CIRCLES.push({ x: -1.5, z: 57, r: 5 });    // Western Union Building
CLEAR_CIRCLES.push({ x: 19, z: -4, r: 6 });      // Cooper Union
CLEAR_CIRCLES.push({ x: -17, z: -76, r: 7 });    // Fifth Avenue Hotel
const CLEAR_RECTS = [
  { x0: -15, x1: 7, z0: -93, z1: -80 },   // Madison Square Garden block
  { x0: -12, x1: 10, z0: -80, z1: -68 },  // Madison Square Park
  { x0: -11, x1: 7, z0: -45, z1: -35 },   // Union Square
];

const DOWNTOWN_PATHS = [
  [[2, 88], [-4, 64], [-10, 38], [-13, 12]],   // Broadway
  [[4, 84], [12, 62], [18, 40], [23, 14]],     // Pearl Street
  [[-22, 46], [24, 40]],                       // Wall Street
];

/* ---------------- basic setup ---------------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
// hazy late-afternoon sky, the kind of light in old albumen photographs.
// warmth slides the same gradient toward the golden dusk of the finale.
const SKY_STOPS = [0, 0.5, 0.75, 1];
const SKY_DAY = ['#93aabd', '#c3c8bb', '#e3d8be', '#ecdfc4'];
const SKY_DUSK = ['#8d7d93', '#c98e5f', '#e8c193', '#ecd3a6'];
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 16;
skyCanvas.height = 256;
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;

function lerpHexCss(a, b, t) {
  const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((ca >> sh) & 255) + (((cb >> sh) & 255) - ((ca >> sh) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function setSky(warmth) {
  const c = skyCanvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  SKY_STOPS.forEach((s, i) => g.addColorStop(s, lerpHexCss(SKY_DAY[i], SKY_DUSK[i], warmth)));
  c.fillStyle = g;
  c.fillRect(0, 0, 16, 256);
  skyTex.needsUpdate = true;
}
setSky(0);
scene.fog = new THREE.Fog(0xe0d7be, 130, 320);
const FOG_VIEWS = { street: { near: 130, far: 320 }, chart: { near: 600, far: 1300 } };

// Image-based environment so window glass and water pick up reflections.
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
} catch {
  // reflections are a nicety; the scene works without them
}

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.4, 1400);
// Third-person follow camera: orbits the player, drag to look around.
// 'chart' view lifts it high over the island like the old map.
const cam = { yaw: 0, height: 5, dist: 11, smoothDist: 11, lastDrag: -10 };
// Chart-view vantage chosen so the full island plus the harbor landmarks
// (z ≈ 122 to -112, x ≈ ±58) fit the 55° frustum even on a portrait phone.
const CHART_CAM_POS = new THREE.Vector3(0, 215, 120);
const CHART_LOOK_AT = new THREE.Vector3(0, 0, 10);
const lookTarget = new THREE.Vector3(0, 1.7, 70); // smoothed camera focus
const occluders = []; // meshes the camera should not clip through

const hemi = new THREE.HemisphereLight(0xd5e0e8, 0xb09a78, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0ac, 2.6);
sun.position.set(70, 100, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);

// Tight shadow frustum at street level for crisp shadows; wide in chart view.
function applyShadowFrustum(view) {
  const c = sun.shadow.camera;
  if (view === 'chart') {
    c.left = -100; c.right = 100; c.top = 140; c.bottom = -140;
  } else {
    c.left = -55; c.right = 55; c.top = 75; c.bottom = -75;
  }
  c.updateProjectionMatrix();
}
applyShadowFrustum('street');

const colliders = []; // axis-aligned boxes {x0,x1,z0,z1}

/* ---------------- helpers ---------------- */

function pointInPoly(x, z, poly = ISLAND) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function isWalkable(x, z) {
  if (pointInPoly(x, z)) return true;
  return WALK_RECTS.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}

function inClearZone(x, z) {
  for (const c of CLEAR_CIRCLES) {
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
  }
  for (const r of CLEAR_RECTS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  if (Math.abs(x - EL_X) < 4 && z < 2 && z > -110) return true;
  return false;
}

function rnd(a, b) { return a + Math.random() * (b - a); }

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

function nearDowntownPath(x, z, d = 2.8) {
  for (const path of DOWNTOWN_PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      if (distToSegment(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]) < d) return true;
    }
  }
  return false;
}

function addCollider(cx, cz, w, d, pad = 0.7) {
  colliders.push({ x0: cx - w / 2 - pad, x1: cx + w / 2 + pad, z0: cz - d / 2 - pad, z1: cz + d / 2 + pad });
}

function lambert(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function box(w, h, d, color, x, y, z, parent = scene, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}

function cylBetween(p1, p2, r, color, parent = scene) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), lambert(color));
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
  return mesh;
}

function makeTextTexture(text, { size = 72, color = 'rgba(43,38,32,0.55)', italic = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 144;
  const ctx = cv.getContext('2d');
  ctx.font = `${italic ? 'italic ' : ''}600 ${size}px 'EB Garamond', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '14px';
  ctx.fillText(text, 512, 76);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function waterLabel(text, x, z, rotY = 0, width = 42) {
  const geo = new THREE.PlaneGeometry(width, width * 144 / 1024);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: makeTextTexture(text), transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.25, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
}

function makeNumberSprite(n) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fillStyle = '#b23a2c';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#efe6d0';
  ctx.stroke();
  ctx.font = `600 64px 'EB Garamond', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#efe6d0';
  ctx.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.scale.set(3.6, 3.6, 1);
  return sprite;
}

/* ---------------- water & land ---------------- */

const waterGeo = new THREE.PlaneGeometry(440, 500, 60, 68);
waterGeo.rotateX(-Math.PI / 2);
const waterBase = waterGeo.attributes.position.array.slice();
const water = new THREE.Mesh(
  waterGeo,
  new THREE.MeshStandardMaterial({
    color: 0x86aca8,
    roughness: 0.32,
    metalness: 0.08,
    flatShading: true,
    envMapIntensity: 1.1,
  })
);
water.position.set(0, -0.55, -8);
water.receiveShadow = true;
scene.add(water);

function extrudeLand(points, topColor, sideColor, depth = 1.8) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // shape (x, y) -> world (x, z); extrudes downward
  const mesh = new THREE.Mesh(geo, [lambert(topColor), lambert(sideColor)]);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

extrudeLand(ISLAND, COLORS.islandTop, COLORS.islandSide);

// Outer shores: New Jersey and Brooklyn, as plainer paper slabs.
const nj = box(96, 2, 180, COLORS.outerLand, -114, -0.9, -42, scene, false);
nj.receiveShadow = true;
const bk = box(96, 2, 160, COLORS.outerLand, 106, -0.9, 48, scene, false);
bk.receiveShadow = true;
// A modest skyline hint on each far shore.
for (let i = 0; i < 14; i++) {
  const zb = -110 + i * 13 + Math.random() * 5;
  box(3 + Math.random() * 3, 2 + Math.random() * 4, 3 + Math.random() * 3, COLORS.outerLand, -69 + Math.random() * 4, 1.2, zb, scene, false);
}
for (let i = 0; i < 12; i++) {
  const zb = -18 + i * 11 + Math.random() * 5;
  box(3 + Math.random() * 3, 2 + Math.random() * 4, 3 + Math.random() * 3, COLORS.outerLand, 61 + Math.random() * 4, 1.2, zb, scene, false);
}

waterLabel('HUDSON RIVER', -58, 8, -Math.PI / 2);
waterLabel('EAST RIVER', 50, -42, -Math.PI / 2, 34);
waterLabel('NEW JERSEY', -92, -40, 0, 36);
waterLabel('BROOKLYN', 92, 50, 0, 34);
waterLabel('THE BATTERY', -2, 108, 0, 30);

/* ---------------- streets ---------------- */

// Belgian-block (cobblestone) paving, drawn once and tiled.
function makeCobbleTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c5b896';
  ctx.fillRect(0, 0, 128, 128);
  const rowH = 16;
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 16;
    for (let col = -1; col < 5; col++) {
      const x = col * 32 + off, y = row * rowH;
      const shade = 0.92 + Math.random() * 0.13;
      ctx.fillStyle = `rgb(${Math.round(190 * shade)},${Math.round(177 * shade)},${Math.round(143 * shade)})`;
      ctx.fillRect(x + 1.5, y + 1.5, 29, 13);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
const cobbleTex = makeCobbleTexture();
const streetMat = new THREE.MeshLambertMaterial({ map: cobbleTex, color: 0xfFf6e2 });

function scaleUV(geo, ru, rv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
}

function streetPlane(len, wide) {
  const geo = new THREE.PlaneGeometry(len, wide);
  scaleUV(geo, len / 3.2, wide / 3.2);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, streetMat);
  m.receiveShadow = true;
  return m;
}

const streetSegs = []; // east-west: { z, x0, x1 }
const aveSegs = [];    // north-south: { x, z0, z1 }
for (const z of STREETS) {
  let xmin = Infinity, xmax = -Infinity;
  for (let x = -45; x <= 45; x += 0.5) {
    if (pointInPoly(x, z)) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
  }
  if (xmax - xmin > 6) {
    const m = streetPlane(xmax - xmin - 2, 2.2);
    m.position.set((xmin + xmax) / 2, 0.06, z);
    scene.add(m);
    streetSegs.push({ z, x0: xmin + 1, x1: xmax - 1 });
  }
}
for (const x of AVENUES) {
  let zmin = Infinity, zmax = -Infinity;
  for (let z = -111; z <= 13; z += 0.5) {
    if (pointInPoly(x, z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
  }
  if (zmax - zmin > 6) {
    const geo = new THREE.PlaneGeometry(2.8, zmax - zmin - 2);
    scaleUV(geo, 2.8 / 3.2, (zmax - zmin - 2) / 3.2);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, streetMat);
    m.receiveShadow = true;
    m.position.set(x, 0.05, (zmin + zmax) / 2);
    scene.add(m);
    aveSegs.push({ x, z0: zmin + 1, z1: zmax - 1 });
  }
}

// Bluestone sidewalks flanking every paved street and avenue.
{
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#979c94';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 64; i += 16) ctx.fillRect(i, 0, 1.5, 64);
  ctx.fillRect(0, 31, 64, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 60, Math.random() * 60, 5, 3);
  const walkTex = new THREE.CanvasTexture(cv);
  walkTex.colorSpace = THREE.SRGBColorSpace;
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
  const geos = [];
  function walkStrip(len, cx, cz, alongX) {
    const geo = new THREE.PlaneGeometry(alongX ? len : 0.95, alongX ? 0.95 : len);
    scaleUV(geo, (alongX ? len : 0.95) / 1.9, (alongX ? 0.95 : len) / 1.9);
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0.085, cz);
    geos.push(geo);
  }
  for (const s of streetSegs) {
    walkStrip(s.x1 - s.x0, (s.x0 + s.x1) / 2, s.z - 1.62, true);
    walkStrip(s.x1 - s.x0, (s.x0 + s.x1) / 2, s.z + 1.62, true);
  }
  for (const a of aveSegs) {
    walkStrip(a.z1 - a.z0, a.x - 1.92, (a.z0 + a.z1) / 2, false);
    walkStrip(a.z1 - a.z0, a.x + 1.92, (a.z0 + a.z1) / 2, false);
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshLambertMaterial({ map: walkTex })
  );
  mesh.receiveShadow = true;
  scene.add(mesh);
}
for (const path of DOWNTOWN_PATHS) {
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const m = streetPlane(len, 2.4);
    m.position.set((ax + bx) / 2, 0.07, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    scene.add(m);
  }
}

/* ---------------- buildings: 1890 New York ----------------
   Brownstone and brick rowhouses with cornices and stoops line the grid;
   cast-iron lofts and older walk-ups crowd downtown; Trinity Church and the
   new gold-domed World Building (1890) mark the skyline. Everything is
   merged into a handful of meshes for performance. */

const FLOOR_H = 3.0;     // one storey
const BAY_W = 2.0;       // one window bay
const TEX_BAYS = 4;      // facade textures hold a 4-bay × 4-floor patch
const TEX_FLOORS = 4;    // so window variation doesn't visibly tile

function makeFacadeMaps(p) {
  const CW = 128 * TEX_BAYS, CH = 160 * TEX_FLOORS;
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const bv = document.createElement('canvas'); // bump/height map
  bv.width = CW; bv.height = CH;
  const btx = bv.getContext('2d');
  const rv = document.createElement('canvas'); // G = roughness, B = metalness
  rv.width = CW; rv.height = CH;
  const rtx = rv.getContext('2d');

  ctx.fillStyle = p.wall;
  ctx.fillRect(0, 0, CW, CH);
  btx.fillStyle = '#7f7f7f';
  btx.fillRect(0, 0, CW, CH);
  rtx.fillStyle = 'rgb(0,235,0)'; // masonry: rough, non-metal
  rtx.fillRect(0, 0, CW, CH);

  if (p.style === 'brick') {
    // individual bricks vary in tone
    for (let y = 0; y < CH; y += 10) {
      const off = ((y / 10) % 2) * 16;
      for (let x = -16; x < CW; x += 32) {
        if (Math.random() < 0.45) {
          ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,232,205'},${rnd(0.03, 0.1).toFixed(3)})`;
          ctx.fillRect(x + off, y, 32, 10);
        }
      }
    }
    ctx.fillStyle = p.joint;
    btx.fillStyle = '#6a6a6a';
    for (let y = 0; y < CH; y += 10) {
      ctx.fillRect(0, y, CW, 1);
      btx.fillRect(0, y, CW, 1);
      const off = ((y / 10) % 2) * 16;
      for (let x = -16; x < CW; x += 32) {
        ctx.fillRect(x + off, y, 1, 10);
        btx.fillRect(x + off, y, 1, 10);
      }
    }
  } else if (p.style === 'stone') {
    for (let y = 0; y < CH; y += 26) {
      for (let x = 0; x < CW; x += 42) {
        if (Math.random() < 0.5) {
          ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,240'},${rnd(0.02, 0.06).toFixed(3)})`;
          ctx.fillRect(x, y, 42, 26);
        }
      }
    }
    ctx.fillStyle = p.joint;
    btx.fillStyle = '#666666';
    for (let y = 0; y < CH; y += 26) { ctx.fillRect(0, y, CW, 1.5); btx.fillRect(0, y, CW, 1.5); }
    for (let x = 0; x < CW; x += 42) { ctx.fillRect(x, 0, 1.5, CH); btx.fillRect(x, 0, 1.5, CH); }
  } else if (p.style === 'brownstone') {
    for (let y = 0; y < CH; y += 32) {
      ctx.fillStyle = `rgba(0,0,0,${rnd(0, 0.05).toFixed(3)})`;
      ctx.fillRect(0, y, CW, 32);
    }
    ctx.fillStyle = p.joint;
    btx.fillStyle = '#6e6e6e';
    for (let y = 0; y < CH; y += 32) { ctx.fillRect(0, y, CW, 1.5); btx.fillRect(0, y, CW, 1.5); }
    // party-wall seams between houses in the row
    for (let x = 0; x < CW; x += 128) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, 0, 2, CH);
      btx.fillStyle = '#5a5a5a';
      btx.fillRect(x, 0, 2, CH);
    }
  } else if (p.style === 'castiron') {
    for (let x = 0; x < CW; x += 128) {
      ctx.fillStyle = p.joint;
      ctx.fillRect(x, 0, 9, CH);
      ctx.fillRect(x + 119, 0, 9, CH);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 9, 0, 2, CH);
      ctx.fillRect(x + 117, 0, 2, CH);
      btx.fillStyle = '#a8a8a8';
      btx.fillRect(x, 0, 9, CH);
      btx.fillRect(x + 119, 0, 9, CH);
    }
  }

  // windows, each one slightly different — shades, curtains, glass tone
  for (let f = 0; f < TEX_FLOORS; f++) {
    for (let b = 0; b < TEX_BAYS; b++) {
      const ox = b * 128, oy = f * 160;
      const inset = p.style === 'castiron' ? 24 : 36;
      const wx = ox + inset, wx2 = ox + 128 - inset;
      const wy = oy + 30, wy2 = oy + 126;
      ctx.fillStyle = p.trim;
      ctx.fillRect(wx - 8, wy - 13, wx2 - wx + 16, 11);  // lintel
      ctx.fillRect(wx - 7, wy2 + 2, wx2 - wx + 14, 9);   // sill
      btx.fillStyle = '#bcbcbc';
      btx.fillRect(wx - 8, wy - 13, wx2 - wx + 16, 11);
      btx.fillRect(wx - 7, wy2 + 2, wx2 - wx + 14, 9);
      ctx.fillStyle = '#2c2824';
      ctx.fillRect(wx - 3, wy - 3, wx2 - wx + 6, wy2 - wy + 6);
      btx.fillStyle = '#2f2f2f';
      btx.fillRect(wx - 3, wy - 3, wx2 - wx + 6, wy2 - wy + 6);
      const hue = Math.round(rnd(-12, 10));
      const glass = ctx.createLinearGradient(0, wy, 0, wy2);
      glass.addColorStop(0, `rgb(${108 + hue},${122 + hue},${134 + hue})`);
      glass.addColorStop(0.5, `rgb(${64 + hue},${76 + hue},${88 + hue})`);
      glass.addColorStop(1, `rgb(${50 + hue},${60 + hue},${72 + hue})`);
      ctx.fillStyle = glass;
      ctx.fillRect(wx, wy, wx2 - wx, wy2 - wy);
      rtx.fillStyle = 'rgb(0,55,120)'; // glass: smooth, reflective
      rtx.fillRect(wx, wy, wx2 - wx, wy2 - wy);
      const v = Math.random();
      if (v < 0.3) { // half-drawn shade
        const drop = rnd(0.2, 0.55);
        ctx.fillStyle = '#cfc3a6';
        ctx.fillRect(wx, wy, wx2 - wx, (wy2 - wy) * drop);
        rtx.fillStyle = 'rgb(0,215,8)';
        rtx.fillRect(wx, wy, wx2 - wx, (wy2 - wy) * drop);
      } else if (v < 0.5) { // parted curtains
        ctx.fillStyle = 'rgba(222,214,192,0.85)';
        ctx.fillRect(wx, wy, (wx2 - wx) * 0.22, wy2 - wy);
        ctx.fillRect(wx2 - (wx2 - wx) * 0.22, wy, (wx2 - wx) * 0.22, wy2 - wy);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; // shadow under the lintel
      ctx.fillRect(wx, wy, wx2 - wx, 4);
      const midY = (wy + wy2) / 2, midX = (wx + wx2) / 2;
      ctx.fillStyle = '#221f1b';
      ctx.fillRect(wx, midY - 2, wx2 - wx, 4);
      ctx.fillRect(midX - 1, wy, 2, wy2 - wy);
      ctx.fillStyle = 'rgba(255,250,240,0.16)'; // sky glint
      ctx.beginPath();
      ctx.moveTo(wx + 2, wy + 5);
      ctx.lineTo(midX, wy + 5);
      ctx.lineTo(wx + 2, wy + (wy2 - wy) * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(40,34,28,0.07)'; // grime streaks under the sill
      ctx.fillRect(wx - 2, wy2 + 11, 3, 24);
      ctx.fillRect(wx2 - 1, wy2 + 11, 3, 24);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; // floor-slab shadow line
    ctx.fillRect(0, f * 160, CW, 5);
  }
  // weathering: soot gathers at the base
  const age = ctx.createLinearGradient(0, 0, 0, CH);
  age.addColorStop(0, 'rgba(255,250,235,0.05)');
  age.addColorStop(0.85, 'rgba(0,0,0,0)');
  age.addColorStop(1, 'rgba(20,16,10,0.16)');
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, CW, CH);

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(bv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const rough = new THREE.CanvasTexture(rv);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, bump, rough };
}

const FACADES = [
  { style: 'brownstone', wall: '#7a5644', joint: 'rgba(0,0,0,0.13)', trim: '#5e4233' },
  { style: 'brick', wall: '#8f4c3a', joint: 'rgba(0,0,0,0.16)', trim: '#cfc2a4' },
  { style: 'brick', wall: '#a8643f', joint: 'rgba(0,0,0,0.14)', trim: '#d8cbab' },
  { style: 'castiron', wall: '#cfc2a4', joint: 'rgba(0,0,0,0.2)', trim: '#bdb091' },
  { style: 'stone', wall: '#9b9183', joint: 'rgba(0,0,0,0.15)', trim: '#b3a995' },
];
const facadeMats = FACADES.map((p) => {
  const { map, bump, rough } = makeFacadeMaps(p);
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.5,
    roughnessMap: rough,
    metalnessMap: rough,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.15,
  });
});

// Ground floors: paneled doors for the rowhouses, glazed shopfronts with
// painted sign-boards for the commercial streets.
function makeGroundMaps(kind) {
  const CW = 512, CH = 160;
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  const bv = document.createElement('canvas');
  bv.width = CW; bv.height = CH;
  const btx = bv.getContext('2d');
  btx.fillStyle = '#7f7f7f';
  btx.fillRect(0, 0, CW, CH);
  const rv = document.createElement('canvas'); // G = roughness, B = metalness
  rv.width = CW; rv.height = CH;
  const rtx = rv.getContext('2d');
  rtx.fillStyle = 'rgb(0,235,0)';
  rtx.fillRect(0, 0, CW, CH);

  if (kind === 'row') {
    ctx.fillStyle = '#6e5443'; // rusticated brownstone base
    ctx.fillRect(0, 0, CW, CH);
    for (let y = 0; y < CH; y += 24) {
      ctx.fillStyle = `rgba(0,0,0,${rnd(0.02, 0.08).toFixed(3)})`;
      ctx.fillRect(0, y, CW, 24);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, y, CW, 2);
      btx.fillStyle = '#5e5e5e';
      btx.fillRect(0, y, CW, 2);
    }
    for (let b = 0; b < 4; b++) {
      const ox = b * 128;
      if (b % 2 === 0) {
        // paneled front door under a stone hood
        ctx.fillStyle = '#8a7058';
        ctx.fillRect(ox + 36, 18, 56, 12);
        ctx.fillStyle = '#241a12';
        ctx.fillRect(ox + 42, 28, 44, 124);
        ctx.fillStyle = '#3a2a1e';
        ctx.fillRect(ox + 46, 34, 36, 52);
        ctx.fillRect(ox + 46, 94, 36, 52);
        ctx.fillStyle = '#191210';
        ctx.fillRect(ox + 48, 36, 32, 48);
        ctx.fillRect(ox + 48, 96, 32, 48);
        ctx.fillStyle = '#c9a857';
        ctx.fillRect(ox + 78, 86, 4, 4); // brass knob
        btx.fillStyle = '#3a3a3a';
        btx.fillRect(ox + 42, 28, 44, 124);
      } else {
        // parlor window
        ctx.fillStyle = '#8a7058';
        ctx.fillRect(ox + 30, 20, 68, 10);
        ctx.fillStyle = '#2c2824';
        ctx.fillRect(ox + 34, 28, 60, 110);
        const glass = ctx.createLinearGradient(0, 28, 0, 138);
        glass.addColorStop(0, '#5d6a76');
        glass.addColorStop(1, '#39434d');
        ctx.fillStyle = glass;
        ctx.fillRect(ox + 38, 32, 52, 102);
        ctx.fillStyle = '#221f1b';
        ctx.fillRect(ox + 38, 81, 52, 4);
        btx.fillStyle = '#2f2f2f';
        btx.fillRect(ox + 34, 28, 60, 110);
        rtx.fillStyle = 'rgb(0,55,120)';
        rtx.fillRect(ox + 38, 32, 52, 102);
      }
    }
  } else {
    ctx.fillStyle = '#4e463c'; // cast-iron shopfront framing
    ctx.fillRect(0, 0, CW, CH);
    const signColors = ['#5a2420', '#2e4034', '#3a3328', '#46251c'];
    for (let b = 0; b < 4; b++) {
      const ox = b * 128;
      // painted sign-board with ghost lettering
      ctx.fillStyle = signColors[b];
      ctx.fillRect(ox + 4, 6, 120, 28);
      ctx.fillStyle = 'rgba(232,220,194,0.75)';
      let lx = ox + 14 + Math.random() * 8;
      while (lx < ox + 108) {
        const lw = rnd(6, 16);
        ctx.fillRect(lx, 15, lw, 9);
        lx += lw + rnd(4, 9);
      }
      // display glass with a diagonal reflection
      ctx.fillStyle = '#1d2229';
      ctx.fillRect(ox + 10, 42, 108, 92);
      const refl = ctx.createLinearGradient(ox, 42, ox + 108, 134);
      refl.addColorStop(0, 'rgba(180,195,205,0.25)');
      refl.addColorStop(0.45, 'rgba(180,195,205,0.05)');
      refl.addColorStop(0.55, 'rgba(220,230,235,0.18)');
      refl.addColorStop(1, 'rgba(120,135,150,0.04)');
      ctx.fillStyle = refl;
      ctx.fillRect(ox + 10, 42, 108, 92);
      btx.fillStyle = '#2a2a2a';
      btx.fillRect(ox + 10, 42, 108, 92);
      rtx.fillStyle = 'rgb(0,45,130)'; // plate glass: very reflective
      rtx.fillRect(ox + 10, 42, 108, 92);
      if (b % 2 === 1) { // recessed shop door
        ctx.fillStyle = '#15110d';
        ctx.fillRect(ox + 48, 52, 32, 82);
        ctx.fillStyle = 'rgba(160,175,185,0.18)';
        ctx.fillRect(ox + 52, 56, 24, 40);
      }
      // kick panel and iron piers
      ctx.fillStyle = '#33291e';
      ctx.fillRect(ox + 10, 134, 108, 20);
      ctx.fillStyle = '#5d5347';
      ctx.fillRect(ox, 0, 8, CH);
      ctx.fillRect(ox + 120, 0, 8, CH);
      btx.fillStyle = '#a8a8a8';
      btx.fillRect(ox, 0, 8, CH);
      btx.fillRect(ox + 120, 0, 8, CH);
    }
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(bv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const rough = new THREE.CanvasTexture(rv);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.5,
    roughnessMap: rough,
    metalnessMap: rough,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.15,
  });
}
const groundMats = { row: makeGroundMaps('row'), shop: makeGroundMaps('shop') };
const groundGeos = { row: [], shop: [] };

// striped canvas awnings
function makeAwningMat(c1, c2) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  for (let x = 0; x < 64; x += 16) {
    ctx.fillStyle = c1;
    ctx.fillRect(x, 0, 8, 64);
    ctx.fillStyle = c2;
    ctx.fillRect(x + 8, 0, 8, 64);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshLambertMaterial({ map: tex });
}
const awnMats = [makeAwningMat('#9c3a2e', '#e3d7b9'), makeAwningMat('#41584a', '#e3d7b9')];
const awnGeos = [[], []];
const facadeGeos = FACADES.map(() => []);
const trimGeos = [];  // cornices, chimneys, stoops — one dark material
const tankGeos = [];  // rooftop water tanks

// Scale a box's UVs so the texture shows `bays` bays wide and `floors`
// floors high; faces order is +x, -x, +y, -y, +z, -z (4 verts each).
function uvBox(geo, baysW, baysD, floors) {
  const uv = geo.attributes.uv;
  const reps = [
    [baysD / TEX_BAYS, floors / TEX_FLOORS],
    [baysD / TEX_BAYS, floors / TEX_FLOORS],
    [0.01, 0.01], [0.01, 0.01],
    [baysW / TEX_BAYS, floors / TEX_FLOORS],
    [baysW / TEX_BAYS, floors / TEX_FLOORS],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 4 * f; v < 4 * f + 4; v++) {
      uv.setXY(v, uv.getX(v) * reps[f][0], uv.getY(v) * reps[f][1]);
    }
  }
  return geo;
}

function facadeBox(x, z, w, d, floors, yBase = 0) {
  const h = floors * FLOOR_H;
  const geo = uvBox(
    new THREE.BoxGeometry(w, h, d),
    Math.max(1, Math.round(w / BAY_W)),
    Math.max(1, Math.round(d / BAY_W)),
    floors
  );
  geo.translate(x, yBase + h / 2, z);
  return geo;
}

function canStand(x, z, w, d) {
  const corners = [
    [x - w / 2, z - d / 2], [x + w / 2, z - d / 2],
    [x - w / 2, z + d / 2], [x + w / 2, z + d / 2],
  ];
  if (!corners.every(([cx, cz]) => pointInPoly(cx, cz))) return false;
  if (corners.some(([cx, cz]) => inClearZone(cx, cz)) || inClearZone(x, z)) return false;
  if (z > 13 && (nearDowntownPath(x, z) || corners.some(([cx, cz]) => nearDowntownPath(cx, cz)))) return false;
  return true;
}

function addBuilding(x, z, w, d, floors, pi, { stoop = false, tank = 'auto', ground = 'row', face = 'south' } = {}) {
  if (!canStand(x, z, w, d)) return false;
  const h = floors * FLOOR_H;
  const baysW = Math.max(1, Math.round(w / BAY_W));
  const baysD = Math.max(1, Math.round(d / BAY_W));
  // street level: door bays or a glazed shopfront
  const gGeo = uvBox(new THREE.BoxGeometry(w, FLOOR_H, d), baysW, baysD, TEX_FLOORS); // v-repeat 1
  gGeo.translate(x, FLOOR_H / 2, z);
  groundGeos[ground].push(gGeo);
  // upper floors
  if (floors > 1) {
    facadeGeos[pi].push(facadeBox(x, z, w, d, floors - 1, FLOOR_H));
    const belt = new THREE.BoxGeometry(w + 0.24, 0.22, d + 0.24); // beltcourse
    belt.translate(x, FLOOR_H + 0.04, z);
    trimGeos.push(belt);
  }
  // striped awning over a shopfront
  if (ground === 'shop' && Math.random() < 0.5) {
    const aw = new THREE.BoxGeometry(Math.min(w - 0.4, 3.2), 0.07, 1.05);
    aw.rotateX(face === 'north' ? -0.42 : 0.42);
    aw.translate(x, 2.5, z + (d / 2 + 0.42) * (face === 'north' ? -1 : 1));
    awnGeos[Math.random() < 0.5 ? 0 : 1].push(aw);
  }
  // heavy Italianate cornice; its top doubles as the (hidden) roof
  const cornice = new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4);
  cornice.translate(x, h + 0.1, z);
  trimGeos.push(cornice);
  // chimneys
  const nCh = Math.floor(Math.random() * 3);
  for (let c = 0; c < nCh; c++) {
    const ch = new THREE.BoxGeometry(0.32, 0.8, 0.32);
    ch.translate(x + (Math.random() - 0.5) * (w - 0.8), h + 0.7, z + (Math.random() - 0.5) * (d - 0.8));
    trimGeos.push(ch);
  }
  // high stoop on the street side
  if (stoop && Math.random() < 0.55) {
    const st = new THREE.BoxGeometry(1.1, 0.6, 0.9);
    st.translate(x + (Math.random() - 0.5) * (w - 1.4), 0.3, z + (d / 2 + 0.42) * (stoop === 'north' ? -1 : 1));
    trimGeos.push(st);
  }
  // wooden water tank on the taller blocks
  if ((tank === 'auto' && floors >= 5 && Math.random() < 0.3) || tank === true) {
    const tx = x + (Math.random() - 0.5) * (w - 1.6), tz = z + (Math.random() - 0.5) * (d - 1.6);
    const base = new THREE.BoxGeometry(1.5, 0.5, 1.5);
    base.translate(tx, h + 0.55, tz);
    trimGeos.push(base);
    const drum = new THREE.CylinderGeometry(0.62, 0.68, 1.2, 9);
    drum.translate(tx, h + 1.4, tz);
    tankGeos.push(drum);
    const cap = new THREE.ConeGeometry(0.74, 0.5, 9);
    cap.translate(tx, h + 2.25, tz);
    tankGeos.push(cap);
  }
  addCollider(x, z, w, d, 0.5);
  return true;
}

// Rowhouse strips along every gridded block, facing the streets.
for (let ai = 0; ai < AVENUES.length - 1; ai++) {
  for (let si = 0; si < STREETS.length - 1; si++) {
    const x0 = AVENUES[ai] + 1.9, x1 = AVENUES[ai + 1] - 1.9;
    const zN = STREETS[si + 1] + 1.4, zS = STREETS[si] - 1.4; // north has smaller z
    if (x1 - x0 < 2.5 || zS - zN < 4.6) continue;
    for (const side of ['north', 'south']) {
      const depth = 2.4;
      const zc = side === 'north' ? zN + depth / 2 : zS - depth / 2;
      let cursor = x0;
      while (cursor < x1 - 1.6) {
        let w = 2.2 + Math.random() * 2.2;
        if (cursor + w > x1) w = x1 - cursor;
        if (w < 1.6) break;
        const floors = 3 + Math.floor(Math.random() * 3); // 3–5 storeys
        const pi = Math.floor(Math.random() * FACADES.length);
        // corner lots get shops; mid-block keeps its stoops and parlors
        const corner = cursor <= x0 + 0.01 || cursor + w >= x1 - 1.6;
        addBuilding(cursor + w / 2, zc, w - 0.15, depth, floors, pi === 3 ? 0 : pi, {
          stoop: corner ? false : side,
          ground: corner ? 'shop' : 'row',
          face: side,
        });
        cursor += w;
      }
    }
  }
}
// Crooked downtown: older, lower walk-ups and cast-iron lofts.
for (let k = 0; k < 150; k++) {
  const x = -40 + Math.random() * 70;
  const z = 15 + Math.random() * 76;
  const w = 2.6 + Math.random() * 2.2;
  const d = 2.4 + Math.random() * 1.8;
  const floors = 3 + Math.floor(Math.random() * 3);
  const pi = Math.random() < 0.3 ? 3 : Math.floor(Math.random() * FACADES.length);
  addBuilding(x, z, w, d, floors, pi, { ground: Math.random() < 0.65 ? 'shop' : 'row' });
}

// Trinity Church (its spire ruled the skyline until 1890).
{
  const tx = -15, tz = 40;
  const dark = lambert(0x6b5240);
  const nave = box(4, 9, 6.5, 0x6b5240, tx, 4.5, tz + 1.5);
  nave.castShadow = true;
  const towerT = box(2.6, 17, 2.6, 0x6b5240, tx, 8.5, tz - 2.6);
  towerT.castShadow = true;
  const spireT = new THREE.Mesh(new THREE.ConeGeometry(1.9, 9, 8), dark);
  spireT.position.set(tx, 21.5, tz - 2.6);
  spireT.castShadow = true;
  scene.add(spireT);
  addCollider(tx, tz, 4.5, 11);
  occluders.push(nave, towerT);
}
// The New York World (Pulitzer) Building, 1890 — its gilded dome brand new.
{
  const wx = 8, wz = 34;
  if (addBuilding(wx, wz, 5, 5, 9, 4, { ground: 'shop', tank: false })) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 2.2, 12), lambert(0xb59478));
    drum.position.set(wx, 28.5, wz);
    drum.castShadow = true;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.75, 14, 10),
      new THREE.MeshPhongMaterial({ color: COLORS.gold, emissive: 0x4a3a0c, shininess: 90 })
    );
    dome.position.set(wx, 30.4, wz);
    dome.scale.y = 1.25;
    dome.castShadow = true;
    scene.add(drum, dome);
  }
}
// Two parish churches uptown.
for (const [cx, cz] of [[-26, -56], [16, -16]]) {
  if (!canStand(cx, cz, 3.6, 5.5)) continue;
  const body = box(3.6, 7.5, 5.5, 0x8d8474, cx, 3.75, cz);
  body.castShadow = true;
  const sp = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.5, 4), lambert(0x77705f));
  sp.position.set(cx, 10.7, cz - 1);
  sp.castShadow = true;
  scene.add(sp);
  addCollider(cx, cz, 3.6, 5.5);
  occluders.push(body);
}

/* ---------------- landmarks of Melville's New York ----------------
   Everything here stood within his lifetime (by September 1891). */

const landmarkLabels = [];
// `range` is how far away the name fades in on foot — harbor landmarks
// are visible from the Battery, so theirs reach across the water.
// Drawn at high resolution so chart view stays crisp.
function landmarkLabel(text, x, y, z, range = 34) {
  const cv = document.createElement('canvas');
  const font = `500 84px 'EB Garamond', Georgia, serif`;
  let ctx = cv.getContext('2d');
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
  // size the canvas to the text (resizing resets context state)
  const w = Math.ceil(Math.max(440, (ctx.measureText(text).width || 960) + 96));
  cv.width = w;
  cv.height = 160;
  ctx = cv.getContext('2d');
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(239,230,208,0.85)';
  ctx.strokeText(text, w / 2, 84);
  ctx.fillStyle = 'rgba(43,38,32,0.95)';
  ctx.fillText(text, w / 2, 84);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 5;
  sprite.position.set(x, y, z);
  const sh = 2.03, sw = sh * (w / 160);
  sprite.scale.set(sw, sh, 1);
  scene.add(sprite);
  landmarkLabels.push({ sprite, x, z, w: sw, h: sh, range });
  return sprite;
}

// Every landmark is tappable — in the street or from the chart — and
// opens a short history card. The label sprite and an invisible volume
// around the structure both catch the tap.
const tapTargets = [];
function landmarkInfo(name, year, blurb, x, z, labelY, { range = 34, w = 8, h = 0, d = 8 } = {}) {
  const sprite = landmarkLabel(year ? `${name} · ${year}` : name, x, labelY, z, range);
  const info = { name, year, blurb };
  sprite.userData.landmark = info;
  tapTargets.push(sprite);
  const hitH = h || labelY;
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(w, hitH, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.set(x, hitH / 2, z);
  hit.userData.landmark = info;
  scene.add(hit);
  tapTargets.push(hit);
}

// The Statue of Liberty (1886) — five years old, her copper still brown.
{
  const lx = -34, lz = 107;
  box(15, 1.6, 14, COLORS.outerLand, lx, -0.6, lz, scene, false); // Bedloe's Island
  // the star-shaped ramparts of Fort Wood
  const starPts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rad = i % 2 === 0 ? 6 : 4;
    starPts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
  }
  const starGeo = new THREE.ExtrudeGeometry(new THREE.Shape(starPts), { depth: 2.2, bevelEnabled: false });
  starGeo.rotateX(Math.PI / 2);
  const star = new THREE.Mesh(starGeo, lambert(0xa39782));
  star.position.set(lx, 2.2, lz);
  star.castShadow = star.receiveShadow = true;
  scene.add(star);
  // stepped granite pedestal
  box(5.4, 1.3, 5.4, 0xa89c85, lx, 2.85, lz);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 7.6, 4), lambert(0xb9ad97));
  ped.rotation.y = Math.PI / 4;
  ped.position.set(lx, 7.3, lz);
  ped.castShadow = true;
  scene.add(ped);
  box(4.5, 0.7, 4.5, 0xcabfa6, lx, 11.4, lz); // cornice
  box(3.2, 1.5, 3.2, 0xb3a78f, lx, 12.4, lz); // statue plinth

  // Liberty Enlightening the World, facing southeast toward the Narrows
  const fig = new THREE.Group();
  const copper = new THREE.MeshStandardMaterial({ color: 0x7a5b46, roughness: 0.55, metalness: 0.35, envMapIntensity: 1.1 });
  const gold = new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.25, metalness: 0.85, emissive: 0x3a2c08 });
  const part = (geo, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, copper);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    m.castShadow = true;
    fig.add(m);
    return m;
  };
  part(new THREE.CylinderGeometry(1.55, 2.75, 7.4, 16), 0, 3.7, 0);              // flowing robe
  part(new THREE.CylinderGeometry(1.7, 2.2, 2.2, 16), 0.18, 5.2, 0.2, 0.06, 0.05); // drape fold
  part(new THREE.CylinderGeometry(1.0, 1.6, 4.0, 14), 0, 9.2, 0);                // torso
  const shoulders = part(new THREE.SphereGeometry(1.12, 12, 10), 0, 11.15, 0);
  shoulders.scale.set(1.35, 0.75, 0.85);
  part(new THREE.SphereGeometry(0.78, 12, 10), 0, 12.45, 0);                     // head
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.1, 8, 16), copper); // diadem band
  band.position.set(0, 12.8, 0);
  band.rotation.x = Math.PI / 2.4;
  fig.add(band);
  for (let i = 0; i < 7; i++) { // crown rays fanned ear to ear
    const a = (i / 6) * Math.PI;
    const ray = part(new THREE.ConeGeometry(0.13, 1.35, 6), Math.cos(a) * 0.95, 12.9 + Math.sin(a) * 0.8, -0.1);
    ray.rotation.z = a - Math.PI / 2;
  }
  // left arm cradling the tablet — JULY IV MDCCLXXVI
  part(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 8), -1.15, 10.3, 0.5, 0.35, 0.8);
  const tablet = part(new THREE.BoxGeometry(1.15, 2.0, 0.34), -1.5, 10.6, 0.75, 0.18, 0.22);
  tablet.castShadow = true;
  // raised right arm with flared sleeve, torch, and gilded flame
  part(new THREE.ConeGeometry(0.85, 1.9, 10), 1.15, 11.7, 0.15, 0, -0.33);       // sleeve flares from the shoulder
  part(new THREE.CylinderGeometry(0.26, 0.4, 4.6, 10), 1.75, 13.3, 0.25, 0.05, -0.33); // arm
  part(new THREE.CylinderGeometry(0.13, 0.17, 1.4, 8), 2.5, 15.9, 0.35);         // torch handle
  const balcony = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 14), copper);
  balcony.position.set(2.5, 16.5, 0.35);
  balcony.rotation.x = Math.PI / 2;
  fig.add(balcony);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 9), gold);
  flame.position.set(2.5, 17.5, 0.35);
  flame.castShadow = true;
  fig.add(flame);
  fig.position.set(lx, 13.15, lz);
  fig.rotation.y = Math.PI / 4; // facing the harbor mouth
  scene.add(fig);
  landmarkInfo('Statue of Liberty', 1886,
    `Bartholdi's colossus was dedicated on October 28, 1886, when Melville was
     67 — in his day her copper still gleamed brown, not green; the patina came
     decades later. The old sailor's harbor of square-riggers now had a new
     light at its gate.`,
    lx, lz, 33.5, { range: 70, w: 12, h: 31, d: 12 });
}

// Governors Island with round Castle Williams (1811).
{
  box(13, 1.6, 8, COLORS.outerLand, 33, -0.6, 106, scene, false);
  const fort = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 4.2, 16), lambert(0xb08d6e));
  fort.position.set(31, 2.3, 105);
  fort.castShadow = true;
  scene.add(fort);
  landmarkInfo('Governors Island', 1811,
    `Round Castle Williams (1811) guarded the harbor from Governors Island,
     an army post throughout Melville's lifetime, across the Buttermilk
     Channel from Brooklyn. With Castle Clinton at the Battery it formed the
     harbor's old stone defenses.`,
    33, 106, 10, { range: 58, w: 13, h: 8, d: 8 });
}

// City Hall (1812) in its park.
{
  const geo = new THREE.CircleGeometry(4.5, 18);
  geo.rotateX(-Math.PI / 2);
  const green = new THREE.Mesh(geo, lambert(COLORS.park));
  green.receiveShadow = true;
  green.position.set(2, 0.1, 44);
  scene.add(green);
  tree(-1, 43, 0.8);
  tree(5, 45, 0.9);
  const hall = box(10, 10, 6, 0xded6c2, 2, 5, 52);
  hall.castShadow = true;
  box(10.6, 0.6, 6.6, 0xc7bda5, 2, 10.3, 52);
  box(3.6, 3, 3.6, 0xded6c2, 2, 11.8, 52); // attic pavilion
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2.2, 10), lambert(0xd5ccb6));
  drum.position.set(2, 14.4, 52);
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xb3a479));
  cupola.position.set(2, 15.5, 52);
  scene.add(drum, cupola);
  addCollider(2, 52, 10, 6);
  occluders.push(hall);
  landmarkInfo('City Hall', 1812,
    `The marble French-Renaissance City Hall opened in 1812, seven years
     before Melville was born around the corner on Pearl Street. In 1865
     Lincoln lay in state under its rotunda while the city he had carried
     filed past.`,
    2, 52, 19, { w: 10, h: 17, d: 6 });
}

// Federal Hall (1842), Washington's statue (1883) on its steps.
{
  const fx = -2, fz = 38.8;
  box(8, 1.8, 6.4, 0xcfc8b4, fx, 0.9, fz);                 // plinth
  box(8.4, 1.2, 2.2, 0xc2bba6, fx, 0.6, fz + 3.9);         // steps
  const cella = box(7.6, 5.6, 4.4, 0xcfc8b4, fx, 4.6, fz - 0.8);
  cella.castShadow = true;
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 5, 8), lambert(0xd8d1bd));
    col.position.set(fx + i * 1.5, 4.3, fz + 1.7);
    col.castShadow = true;
    scene.add(col);
  }
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 2.2, 4), lambert(0xcfc8b4));
  ped.rotation.y = Math.PI / 4;
  ped.position.set(fx, 2.9, fz + 4);
  const gw = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 2.1, 7), lambert(0x3a4138));
  gw.position.set(fx, 5.05, fz + 4);
  const gwHead = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6), lambert(0x3a4138));
  gwHead.position.set(fx, 6.35, fz + 4);
  scene.add(ped, gw, gwHead);
  // pediment
  const shape = new THREE.Shape([
    new THREE.Vector2(-4.1, 0), new THREE.Vector2(4.1, 0), new THREE.Vector2(0, 1.9),
  ]);
  const pedi = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: false }), lambert(0xd8d1bd));
  pedi.position.set(fx, 6.8, fz + 0.6);
  pedi.castShadow = true;
  scene.add(pedi);
  addCollider(fx, fz, 8, 6.4);
  occluders.push(cella);
  landmarkInfo('Federal Hall', 1842,
    `On this Wall Street corner Washington took the first presidential oath
     in 1789; J. Q. A. Ward's bronze of him was set on the steps in 1883.
     The Greek Revival building itself served as the Custom House until
     1862 — the very service in which Melville later spent nineteen years —
     and then as the Sub-Treasury, its vaults full of gold.`,
    fx, fz, 12, { w: 8.4, h: 9.5, d: 7 });
}

// The Tribune Building (1875) — tall brick, clock tower over Park Row.
{
  const tx = 12.5, tz = 44;
  const tower = box(5, 18, 5, 0x7e4034, tx, 9, tz);
  tower.castShadow = true;
  box(5.5, 0.6, 5.5, 0x5e3026, tx, 18.3, tz);
  const upper = box(2.8, 7, 2.8, 0x7e4034, tx, 22.1, tz);
  upper.castShadow = true;
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), new THREE.MeshBasicMaterial({ color: 0xefe6d0 }));
  clock.position.set(tx, 23.8, tz + 1.42);
  scene.add(clock);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 4), lambert(0x4a3a30));
  cap.rotation.y = Math.PI / 4;
  cap.position.set(tx, 27.2, tz);
  cap.castShadow = true;
  scene.add(cap);
  addCollider(tx, tz, 5, 5);
  occluders.push(tower);
  landmarkInfo('Tribune Building', 1875,
    `Richard Morris Hunt's brick clock tower for Horace Greeley's New-York
     Tribune was one of the first elevator towers in the world — at 260 feet
     it loomed over Newspaper Row, where every great daily watched City Hall
     across the park.`,
    tx, tz, 31, { w: 5.5, h: 29, d: 5.5 });
}

// The Western Union Telegraph Building (1875) on lower Broadway.
{
  const wx = -1.5, wz = 57;
  const main = box(5.5, 15, 5, 0x6d5b4d, wx, 7.5, wz);
  main.castShadow = true;
  box(6, 0.6, 5.5, 0x53453a, wx, 15.3, wz);
  const mansard = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.2, 3.4, 4), lambert(0x3f3630));
  mansard.rotation.y = Math.PI / 4;
  mansard.position.set(wx, 17.3, wz);
  mansard.castShadow = true;
  scene.add(mansard);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 5), lambert(0x33302c));
  pole.position.set(wx, 20.8, wz);
  scene.add(pole);
  addCollider(wx, wz, 5.5, 5);
  occluders.push(main);
  landmarkInfo('Western Union Building', 1875,
    `George B. Post's ten-storey telegraph palace on Broadway was, with the
     Tribune, the city's first true skyscraper. Every day at noon a time-ball
     dropped from its mast so the harbor's ships — and the customs men on
     the piers — could set their chronometers.`,
    wx, wz, 24.5, { w: 6, h: 22, d: 5.5 });
}

// Cooper Union (1859), in whose Great Hall Lincoln spoke in 1860.
{
  const cx = 19, cz = -4;
  const block = box(6, 11, 8, 0x6a4a39, cx, 5.5, cz);
  block.castShadow = true;
  box(6.5, 0.7, 8.5, 0x52382b, cx, 11.35, cz);
  for (let i = -1; i <= 1; i++) { // round-arched bays hinted with piers
    box(0.6, 9.5, 0.35, 0x7d5a46, cx + i * 2, 4.75, cz + 4.05, scene, false);
  }
  addCollider(cx, cz, 6, 8);
  occluders.push(block);
  landmarkInfo('Cooper Union', 1859,
    `Peter Cooper's free college of art and science, brownstone over an
     iron frame. In its Great Hall in February 1860 an Illinois lawyer named
     Lincoln gave the speech — “right makes might” — that carried him toward
     the presidency.`,
    cx, cz, 15.5, { w: 6.5, h: 12.5, d: 8.5 });
}

// Union Square (1839), with the equestrian Washington of 1856.
{
  const geo = new THREE.PlaneGeometry(16, 9);
  geo.rotateX(-Math.PI / 2);
  const green = new THREE.Mesh(geo, lambert(COLORS.park));
  green.receiveShadow = true;
  green.position.set(-2, 0.1, -40);
  scene.add(green);
  for (let i = 0; i < 7; i++) {
    const tx2 = -9 + Math.random() * 14, tz2 = -43.6 + Math.random() * 7.2;
    if (Math.hypot(tx2 + 2, tz2 + 40) > 2.6) tree(tx2, tz2, 0.7 + Math.random() * 0.5);
  }
  const bronze = lambert(0x3a4138);
  box(3, 2.2, 2, 0xb9ad97, -2, 1.2, -40); // pedestal
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 2.3), bronze);
  hb.position.set(-2, 3.1, -40);
  hb.castShadow = true;
  const neckW = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.48), bronze);
  neckW.position.set(-2, 3.7, -39.15);
  neckW.rotation.x = 0.5;
  const headW = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.7), bronze);
  headW.position.set(-2, 4.05, -38.8);
  scene.add(hb, neckW, headW);
  for (const [lx2, lz2] of [[-2.24, -40.85], [-1.76, -40.85], [-2.24, -39.3], [-1.76, -39.3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), bronze);
    leg.position.set(lx2, 2.65, lz2);
    scene.add(leg);
  }
  const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.05, 7), bronze);
  rider.position.set(-2, 4.0, -40.35);
  const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), bronze);
  riderHead.position.set(-2, 4.7, -40.35);
  scene.add(rider, riderHead);
  addCollider(-2, -40, 3, 2);
  landmarkInfo('Union Square', 1839,
    `The first of the great squares on Melville's walks uptown. Henry Kirke
     Brown's equestrian Washington (1856) — the city's oldest outdoor
     statue — marks where New Yorkers met the general on Evacuation Day,
     1783.`,
    -2, -40, 9, { w: 6, h: 6.5, d: 5 });
}

// The Fifth Avenue Hotel (1859), white marble, facing Madison Square.
{
  const hx = -17, hz = -76;
  const hotel = box(7, 16, 5.5, 0xe8e0cd, hx, 8, hz);
  hotel.castShadow = true;
  box(7.5, 0.7, 6, 0xcdc4ab, hx, 16.35, hz);
  box(7.1, 0.4, 5.7, 0xb9ad97, hx, 3.4, hz);   // beltcourse
  box(7.2, 3.4, 5.7, 0xd5ccb6, hx, 1.7, hz);   // arcaded base
  const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), lambert(0x33302c));
  flag.position.set(hx + 2.6, 18.2, hz + 1.8);
  scene.add(flag);
  addCollider(hx, hz, 7, 5.5);
  occluders.push(hotel);
  landmarkInfo('Fifth Avenue Hotel', 1859,
    `Amos Eno's white-marble palace on Madison Square — mocked as “Eno's
     Folly,” then the most celebrated hotel in America, with the first
     passenger elevator in any hotel. Princes, presidents, and the
     Republican bosses of the Gilded Age held court a block from Melville's
     front door.`,
    hx, hz, 21, { w: 7.5, h: 18, d: 6 });
}

// Info for the landmarks that were already on the island.
landmarkInfo('Trinity Church', 1846,
  `Richard Upjohn's brownstone Gothic spire was the tallest thing in New
   York for most of Melville's life — mariners steered by it, and its bells
   rang over Wall Street. Alexander Hamilton lies in its churchyard.`,
  -15, 40, 28, { w: 7, h: 26, d: 12 });
landmarkInfo('Brooklyn Bridge', 1883,
  `The Roeblings' “eighth wonder” opened in May 1883, its towers taller
   than anything but Trinity's spire. The old sailor saw the age of sail
   framed in steel cable — ships passed beneath a roadway in the sky.`,
  40, 51, 27, { w: 44, h: 24, d: 10 });
landmarkInfo('Castle Garden', null,
  `Built as a fort before the War of 1812, then the concert hall where all
   New York heard Jenny Lind in 1850 — Melville's brother got him a ticket
   line — and from 1855 to 1890 the landing depot where eight million
   immigrants first touched America.`,
  -8, 91, 9.5, { w: 9, h: 7, d: 9 });
landmarkInfo('Madison Square Garden', 1890,
  `Stanford White's colossal amphitheater of yellow brick and terra cotta
   opened in 1890, its arcaded tower the second-tallest thing in the city.
   Saint-Gaudens's gilded Diana was hoisted to its top in 1891 — see site
   No. 5 for her story.`,
  2, -84, 41, { w: 14, h: 37, d: 12 });
landmarkInfo('The World Building', 1890,
  `Joseph Pulitzer's gold-domed tower on Park Row — at 309 feet the
   tallest building on earth when it opened in 1890, the year before
   Melville died. From its dome you could see forty miles of the harbor
   he had sailed out of as a boy.`,
  8, 34, 35.5, { w: 6, h: 33, d: 6 });

// Merge and add the city.
const trimMat = lambert(0x4a4039);
const tankMat = lambert(0x8a6f4d);
facadeGeos.forEach((geos, i) => {
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), facadeMats[i]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  occluders.push(mesh);
});
for (const k of ['row', 'shop']) {
  if (!groundGeos[k].length) continue;
  const mesh = new THREE.Mesh(mergeGeometries(groundGeos[k], false), groundMats[k]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  occluders.push(mesh);
}
awnGeos.forEach((geos, i) => {
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), awnMats[i]);
  mesh.castShadow = true;
  scene.add(mesh);
});
if (trimGeos.length) {
  const mesh = new THREE.Mesh(mergeGeometries(trimGeos, false), trimMat);
  mesh.castShadow = true;
  scene.add(mesh);
}
if (tankGeos.length) {
  const mesh = new THREE.Mesh(mergeGeometries(tankGeos, false), tankMat);
  mesh.castShadow = true;
  scene.add(mesh);
}

/* ---------------- gas lamps ---------------- */
{
  const poleGeos = [], lampGeos = [];
  const lampSpots = [];
  for (const x of AVENUES) {
    for (let z = -104; z <= 8; z += 16) {
      lampSpots.push([x + 1.7, z + 4], [x - 1.7, z - 4]);
    }
  }
  for (const [lx, lz] of lampSpots) {
    if (!pointInPoly(lx, lz) || inClearZone(lx, lz)) continue;
    if (Math.random() < 0.5) continue;
    const pole = new THREE.CylinderGeometry(0.06, 0.09, 2.7, 5);
    pole.translate(lx, 1.35, lz);
    poleGeos.push(pole);
    const lamp = new THREE.BoxGeometry(0.26, 0.34, 0.26);
    lamp.translate(lx, 2.85, lz);
    lampGeos.push(lamp);
  }
  if (poleGeos.length) {
    scene.add(new THREE.Mesh(mergeGeometries(poleGeos, false), lambert(0x33302c)));
    scene.add(new THREE.Mesh(
      mergeGeometries(lampGeos, false),
      new THREE.MeshLambertMaterial({ color: 0xf5e9c0, emissive: 0x8a7430 })
    ));
  }
}

/* ---------------- street life ---------------- */

const wanderers = [];
function makeFigure(lady) {
  const g = new THREE.Group();
  const coatCol = [0x33302c, 0x3d3a35, 0x2e3438, 0x4a3f33, 0x55483a][Math.floor(Math.random() * 5)];
  const body = lady
    ? new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.3, 10), lambert(coatCol))
    : new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.74, 1.9, 10), lambert(coatCol));
  body.position.y = lady ? 1.15 : 1.5;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lambert(0xd9b08c));
  head.position.y = lady ? 2.6 : 2.85;
  head.castShadow = true;
  g.add(body, head);
  if (lady) {
    const bonnet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), lambert(0x6e5747));
    bonnet.position.y = 2.82;
    g.add(bonnet);
  } else {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 10), lambert(0x26221d));
    brim.position.y = 3.16;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.45, 10), lambert(0x26221d));
    top.position.y = 3.42;
    g.add(brim, top);
  }
  g.scale.setScalar(0.52);
  scene.add(g);
  return g;
}
{
  const usable = aveSegs.filter((a) => a.z1 - a.z0 > 30);
  for (let i = 0; i < 9 && usable.length; i++) {
    const a = usable[Math.floor(Math.random() * usable.length)];
    const lane = Math.random() < 0.5 ? -1.9 : 1.9;
    wanderers.push({
      g: makeFigure(Math.random() < 0.4),
      x: a.x + lane,
      z0: a.z0 + 3,
      z1: a.z1 - 3,
      z: rnd(a.z0 + 3, a.z1 - 3),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rnd(1.1, 2.3),
      ph: Math.random() * 6,
    });
  }
}

// Parked delivery wagons, horses dozing in their traces.
function wagon(x, z) {
  const g = new THREE.Group();
  const bed = box(1.5, 0.45, 3.1, 0x6e5234, 0, 1.05, 0, g);
  bed.castShadow = true;
  box(1.5, 0.55, 0.16, 0x5d4429, 0, 1.55, 1.45, g);  // seat back
  box(1.4, 0.12, 0.6, 0x5d4429, 0, 1.4, 1.1, g);     // bench
  for (const [wx, wz, r] of [[-0.84, -1.0, 0.58], [0.84, -1.0, 0.58], [-0.84, 1.15, 0.45], [0.84, 1.15, 0.45]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.09, 12).rotateZ(Math.PI / 2), lambert(0x4a3a28));
    wheel.position.set(wx, r, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  for (const sx of [-0.5, 0.5]) box(0.09, 0.09, 2.2, 0x5d4429, sx, 0.95, 2.7, g); // shafts
  // a blocky, patient horse
  const horse = new THREE.Group();
  const hide = lambert(0x4a3526);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 1.55), hide);
  hb.position.y = 1.3;
  hb.castShadow = true;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.42), hide);
  neck.position.set(0, 1.78, 0.78);
  neck.rotation.x = 0.5;
  const headH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.3), hide);
  headH.position.set(0, 1.95, 1.12);
  headH.rotation.x = 0.25;
  horse.add(hb, neck, headH);
  for (const [lx, lz] of [[-0.2, -0.55], [0.2, -0.55], [-0.2, 0.55], [0.2, 0.55]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1, 0.13), hide);
    leg.position.set(lx, 0.5, lz);
    horse.add(leg);
  }
  horse.position.z = 3.6;
  g.add(horse);
  g.position.set(x, 0, z);
  scene.add(g);
  addCollider(x, z + 1, 2, 7.5, 0.4);
  return g;
}
for (const [wx, wz] of [[-13, -44], [13, -20], [-1, -64]]) {
  if (isWalkable(wx, wz) && isWalkable(wx, wz + 4) && !inClearZone(wx, wz)) wagon(wx, wz);
}

/* ---------------- parks & trees ---------------- */

function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.1 * s, 5), lambert(COLORS.woodDark));
  trunk.position.y = 0.55 * s;
  const fol = new THREE.Mesh(new THREE.SphereGeometry(0.95 * s, 7, 6), new THREE.MeshLambertMaterial({ color: COLORS.parkTree, flatShading: true }));
  fol.position.y = 1.7 * s;
  fol.scale.y = 1.18;
  trunk.castShadow = fol.castShadow = true;
  g.add(trunk, fol);
  g.position.set(x, 0, z);
  scene.add(g);
}

// Madison Square Park
{
  const geo = new THREE.PlaneGeometry(20, 11);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, lambert(COLORS.park));
  m.receiveShadow = true;
  m.position.set(-1, 0.1, -74);
  scene.add(m);
  for (let i = 0; i < 11; i++) {
    const tx = -10 + Math.random() * 18;
    const tz = -78.6 + Math.random() * 9;
    if (Math.hypot(tx - (-4), tz - (-73)) > 3.2) tree(tx, tz, 0.8 + Math.random() * 0.5);
  }
}
// Battery green
{
  const geo = new THREE.CircleGeometry(7, 20);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, lambert(COLORS.park));
  m.receiveShadow = true;
  m.position.set(-2, 0.1, 88);
  scene.add(m);
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 4;
    const tx = -2 + Math.cos(a) * r, tz = 88 + Math.sin(a) * r;
    if (Math.hypot(tx - 2, tz - 82) > 3 && Math.hypot(tx + 8, tz - 91) > 4.5) tree(tx, tz, 0.7 + Math.random() * 0.5);
  }
}
// Castle Garden
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 5, 14), lambert(COLORS.stone));
  m.position.set(-8, 2.5, 91);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  addCollider(-8, 91, 8.5, 8.5);
  occluders.push(m);
}

/* ---------------- landmarks ---------------- */

// Melville's house, 104 E 26th St — brick row house facing the street.
{
  const hx = 18, hz = -83.5;
  const house = box(4.4, 9.6, 6, COLORS.brick, hx, 4.8, hz);
  addCollider(hx, hz, 4.4, 6);
  box(4.9, 0.6, 6.5, 0x6e4a3a, hx, 9.85, hz); // cornice
  box(1.2, 2.6, 0.3, 0x274029, hx - 0.9, 1.5, hz + 3.05); // green door
  box(2.4, 0.6, 1.7, 0xb5a98c, hx - 0.9, 0.3, hz + 3.75); // high stoop
  // window lintels and sashes on the street face
  for (const fy of [2.4, 5.4, 8.2]) {
    for (let wx = -1.3; wx <= 1.3; wx += 1.3) {
      if (fy < 3 && wx < 0) continue; // door occupies that bay
      box(0.82, 1.4, 0.12, 0x36302a, hx + wx, fy, hz + 3.02, scene, false);
      box(0.6, 1.1, 0.13, 0x46525c, hx + wx, fy, hz + 3.03, scene, false);
    }
  }
  house.castShadow = true;
  occluders.push(house);
}

// Madison Square Garden (1890) with its tower and the gilded Diana.
let diana;
{
  const g = box(17, 12, 9.5, 0xc8a583, -4, 6, -86.5);
  g.castShadow = true;
  addCollider(-4, -86.5, 17, 9.5);
  box(17.6, 0.8, 10.1, 0xa9886a, -4, 12.4, -86.5);
  const tower = box(4.6, 30, 4.6, 0xc8a583, 2, 15, -84);
  tower.castShadow = true;
  addCollider(2, -84, 4.6, 4.6);
  box(3.4, 3.2, 3.4, 0xb59478, 2, 31.6, -84); // loggia
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 8), lambert(0xa9886a));
  cap.position.set(2, 34.8, -84);
  cap.castShadow = true;
  scene.add(cap);
  occluders.push(g, tower);
  // Diana, gilded, turning like a weathervane
  diana = new THREE.Group();
  const goldMat = new THREE.MeshPhongMaterial({ color: COLORS.gold, emissive: 0x6b5410, shininess: 100 });
  const bodyD = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.7, 6), goldMat);
  bodyD.position.y = 0.85;
  const headD = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), goldMat);
  headD.position.y = 1.95;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 14, Math.PI), goldMat);
  bow.position.set(0.55, 1.25, 0);
  bow.rotation.z = Math.PI / 2;
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), goldMat);
  arrow.position.set(0.55, 1.25, 0);
  arrow.rotation.x = Math.PI / 2;
  diana.add(bodyD, headD, bow, arrow);
  diana.position.set(2, 36.3, -84);
  scene.add(diana);
}

// The Third Avenue El: pillars, track, a station, and a little steam train.
let train, trainDir = -1;
{
  const trackLen = 109;
  const bed = box(4, 0.6, trackLen, COLORS.iron, EL_X, 6.3, -54.5);
  bed.castShadow = true;
  for (let z = -108; z <= 0; z += 10) {
    box(0.7, 6, 0.7, COLORS.iron, EL_X, 3, z);
    box(4.4, 0.5, 0.7, COLORS.iron, EL_X, 5.85, z);
  }
  // station at 26th-ish street: side platforms so the train passes between
  box(1.8, 0.5, 10, COLORS.wood, EL_X - 2.9, 6.85, -58);
  box(1.8, 0.5, 10, COLORS.wood, EL_X + 2.9, 6.85, -58);
  box(7.5, 0.3, 8, 0x6e573b, EL_X, 10.3, -58);
  for (const [px, pz] of [[-3, -61.5], [3, -61.5], [-3, -54.5], [3, -54.5]]) {
    box(0.3, 3.2, 0.3, COLORS.woodDark, EL_X + px, 8.7, pz);
  }
  const stair = box(8, 0.35, 1.8, COLORS.wood, EL_X - 5.2, 3.4, -55.2);
  stair.rotation.z = 0.72;
  // train
  train = new THREE.Group();
  const loco = box(2, 2.2, 4.2, 0x3a352e, 0, 7.6, 4.8, train);
  loco.castShadow = true;
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.3, 8), lambert(0x26221d));
  stack.position.set(0, 9.3, 6);
  train.add(stack);
  for (const off of [0, -6.8]) {
    const car = box(2, 2.5, 5.8, COLORS.trainGreen, 0, 7.8, -1.8 + off, train);
    car.castShadow = true;
    box(2.3, 0.3, 6.1, 0xd8cdb2, 0, 9.2, -1.8 + off, train);
  }
  train.position.set(EL_X, 0, -20);
  scene.add(train);
}

// Brooklyn Bridge (1883), stylized.
{
  const A = new THREE.Vector3(19, 0, 46), B = new THREE.Vector3(62, 0, 56);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const angle = -Math.atan2(dir.z, dir.x);
  const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
  const deck = box(len, 0.7, 4, 0x8d8270, mid.x, 7.5, mid.z);
  deck.rotation.y = angle;
  deck.castShadow = true;
  const towers = [];
  for (const t of [0.32, 0.68]) {
    const p = new THREE.Vector3().copy(A).addScaledVector(dir, t);
    const tw = box(3, 23, 6.5, COLORS.stone, p.x, 11.5 - 1, p.z);
    tw.rotation.y = angle;
    tw.castShadow = true;
    towers.push(new THREE.Vector3(p.x, 21.5, p.z));
  }
  const ends = [new THREE.Vector3(A.x, 8.2, A.z), new THREE.Vector3(B.x, 8.2, B.z)];
  const sag = new THREE.Vector3(mid.x, 13.5, mid.z);
  for (const pts of [[ends[0], towers[0]], [towers[0], sag], [sag, towers[1]], [towers[1], ends[1]]]) {
    cylBetween(pts[0], pts[1], 0.14, COLORS.iron);
  }
}

/* ---------------- piers & ships ---------------- */

function pier(cx, cz, alongX = true) {
  const deck = box(alongX ? 18 : 6, 0.3, alongX ? 6 : 18, COLORS.wood, cx, -0.03, cz);
  deck.castShadow = true;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = -1 + (2 * i) / (n - 1);
    box(0.5, 1.6, 0.5, COLORS.woodDark, cx + (alongX ? t * 8 : 2.5), -0.6, cz + (alongX ? 2.5 : t * 8), scene, false);
    box(0.5, 1.6, 0.5, COLORS.woodDark, cx + (alongX ? t * 8 : -2.5), -0.6, cz + (alongX ? -2.5 : t * 8), scene, false);
  }
}

function barrels(cx, cz) {
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 8), lambert(0x7a5c3e));
    b.position.set(cx + Math.random() * 1.6 - 0.8, 0.57, cz + Math.random() * 1.6 - 0.8);
    b.castShadow = true;
    scene.add(b);
  }
}

// Gansevoort Street pier (Hudson) with the wooden customs office.
pier(-49, -12);
{
  const office = box(3.6, 2.8, 3, 0xa8a092, -53.5, 1.5, -12);
  office.castShadow = true;
  box(4, 0.4, 3.4, 0x6e6457, -53.5, 3.05, -12);
  barrels(-45, -10.5);
}
// East River pier
pier(49, -95);
barrels(45, -93.5);

const bobbers = []; // things that ride the water

function sailShip(x, z, scale = 1, rotY = 0) {
  const g = new THREE.Group();
  const hull = box(3, 1.5, 11, 0x4e4338, 0, 0.6, 0, g);
  hull.castShadow = true;
  box(2.6, 0.8, 2.6, 0x5d5043, 0, 1.7, -3.8, g); // stern cabin
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 4), lambert(0x4e4338));
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.6, 7);
  g.add(bow);
  for (const mz of [2.4, -1.6]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 10, 6), lambert(COLORS.woodDark));
    mast.position.set(0, 6, mz);
    g.add(mast);
    for (const sy of [4.2, 6.8, 8.8]) {
      const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6 - (sy - 4) * 0.3, 2),
        new THREE.MeshLambertMaterial({ color: COLORS.sailcloth, side: THREE.DoubleSide })
      );
      sail.position.set(0, sy, mz);
      sail.castShadow = true;
      g.add(sail);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  scene.add(g);
  bobbers.push({ obj: g, phase: Math.random() * 6 });
  return g;
}

function steamShip(x, z, rotY = 0) {
  const g = new THREE.Group();
  const hull = box(3.4, 1.6, 13, 0x3c3a36, 0, 0.6, 0, g);
  hull.castShadow = true;
  box(2.6, 1.4, 6, 0xe5dcc4, 0, 2, -0.5, g);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.6, 8), lambert(0x26221d));
  stack.position.set(0, 3.8, 0.5);
  g.add(stack);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  bobbers.push({ obj: g, phase: Math.random() * 6 });
  return g;
}

sailShip(-53, -20, 0.9);            // moored at the customs pier
sailShip(52.5, -88, 0.85);          // moored at the East River pier
const driftA = sailShip(-62, 70, 1, Math.PI);    // beating up the Hudson
const driftB = steamShip(40.5, 55, Math.PI);     // steaming up the East River
const driftC = steamShip(-60, 98, Math.PI / 2); // harbor ferry, hugging the Battery

// The whale, off the Battery. Of course there is a whale.
let whale, spout;
{
  whale = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x39404a, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), bodyMat);
  body.scale.set(5.5, 1.5, 2);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 2.6), bodyMat);
  tail.position.set(-5.6, 0.5, 0);
  tail.rotation.y = 0.4;
  const tail2 = tail.clone();
  tail2.rotation.y = -0.4;
  whale.add(body, tail, tail2);
  spout = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.4, 7),
    new THREE.MeshBasicMaterial({ color: 0xf3efe2, transparent: true, opacity: 0.85 })
  );
  spout.position.set(3.6, 2.2, 0);
  whale.add(spout);
  whale.position.set(-34, -0.6, 84);
  whale.rotation.y = -0.5;
  scene.add(whale);
}

// Gulls over the harbor. Wings hinge at the body and the birds spend
// most of their time gliding, the way real gulls do.
const gulls = [];
{
  const gullMat = new THREE.MeshBasicMaterial({ color: 0x3a352e, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.55), gullMat);
    // wing roots at the origin so rotation.z flaps them up and down
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.3).translate(-0.525, 0, 0).rotateX(-Math.PI / 2), gullMat);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.3).translate(0.525, 0, 0).rotateX(-Math.PI / 2), gullMat);
    g.add(body, w1, w2);
    scene.add(g);
    const h = 9 + Math.random() * 6;
    gulls.push({
      g, w1, w2, h,
      y: h,
      r: 12 + Math.random() * 14,
      a: Math.random() * Math.PI * 2,
      s: 0.25 + Math.random() * 0.25,
      p: Math.random() * Math.PI * 2, // flap phase
      flap: 0,
      gliding: Math.random() < 0.5,
      st: 1 + Math.random() * 3, // time until the next glide/flap switch
    });
  }
}

/* ---------------- atmosphere: sun, clouds, coal smoke ---------------- */

// The pale veiled sun of an albumen print — a world-space billboard that
// keeps its bearing as the walker moves. (The sky canvas itself is a
// screen-fixed background, so the sun cannot live there.)
const SUN_DIR_DAY = new THREE.Vector3(70, 62, 45).normalize();
const SUN_DIR_DUSK = new THREE.Vector3(70, 30, 45).normalize();
const sunDirCur = SUN_DIR_DAY.clone();
const sunSprite = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,248,225,1)');
  g.addColorStop(0.12, 'rgba(255,243,210,0.9)');
  g.addColorStop(0.35, 'rgba(248,231,190,0.32)');
  g.addColorStop(1, 'rgba(248,231,190,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0,
  }));
  sp.scale.setScalar(110);
  sp.renderOrder = -10;
  scene.add(sp);
  return sp;
})();

// A few slow clouds, ivory toward the fog so they read as harbor haze.
const clouds = [];
{
  const cloudTexture = () => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 40 + Math.random() * 176, y = 48 + Math.random() * 38, r = 22 + Math.random() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(245,239,222,0.55)');
      g.addColorStop(1, 'rgba(245,239,222,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 128);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const texes = [cloudTexture(), cloudTexture(), cloudTexture()];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texes[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0,
    }));
    const w = 70 + Math.random() * 60;
    sp.scale.set(w, w * 0.42, 1);
    sp.position.set(-260 + Math.random() * 520, 135 + Math.random() * 40, -180 + Math.random() * 320);
    sp.renderOrder = -9;
    scene.add(sp);
    clouds.push({ sp, speed: 0.8 + Math.random() * 0.9, peak: 0.4 + Math.random() * 0.25 });
  }
}

// Coal smoke: one Points cloud shared by the El locomotive and the two
// moving steamers — a single draw call for every plume in the harbor.
const smoke = (() => {
  const N = 130;
  const pos = new Float32Array(N * 3);
  const aSize = new Float32Array(N);
  const aAlpha = new Float32Array(N);
  const parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({ age: Infinity, life: 1, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0 });
    pos[i * 3 + 1] = -50;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: new THREE.CanvasTexture(cv) },
      color: { value: new THREE.Color(0x6b655c) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vA;
      void main() {
        vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(aSize * (240.0 / -mv.z), 220.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 color;
      varying float vA;
      void main() {
        gl_FragColor = vec4(color, texture2D(map, gl_PointCoord).a * vA);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // particles roam the whole harbor
  scene.add(points);

  const tip = new THREE.Vector3();
  let cursor = 0;
  function emit(obj, lx, ly, lz, vy) {
    tip.set(lx, ly, lz);
    obj.localToWorld(tip);
    const p = parts[cursor];
    cursor = (cursor + 1) % N;
    p.age = 0;
    p.life = 3.2 + Math.random() * 1.4;
    p.x = tip.x + (Math.random() - 0.5) * 0.3;
    p.y = tip.y;
    p.z = tip.z + (Math.random() - 0.5) * 0.3;
    p.vx = 0.5 + Math.random() * 0.4; // downwind, with the clouds
    p.vy = vy * (0.85 + Math.random() * 0.3);
    p.vz = (Math.random() - 0.5) * 0.3;
  }
  function update(dt) {
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      if (p.age > p.life) { aAlpha[i] = 0; continue; }
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy *= 1 - dt * 0.25;
      const k = p.age / p.life;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      aSize[i] = 1.4 + k * 4.2;
      aAlpha[i] = k < 0.12 ? (k / 0.12) * 0.4 : 0.4 * (1 - (k - 0.12) / 0.88);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }
  return { emit, update };
})();
let smokeTrainT = 0, smokeShipBT = 0, smokeShipCT = 0;

// "The Tide Turns": once the chart is complete the whole island settles
// into a permanent golden hour. warmth runs 0 (day) to 1 (dusk).
let duskW = 0;
let lastSkyW = 0;
const FOG_DAY = new THREE.Color(0xe0d7be), FOG_DUSK = new THREE.Color(0xdcb27e);
const SUNLIGHT_DAY = new THREE.Color(0xffe0ac), SUNLIGHT_DUSK = new THREE.Color(0xffb070);
const SUNDISC_DAY = new THREE.Color(0xffffff), SUNDISC_DUSK = new THREE.Color(0xffc890);
function applyDusk(w) {
  duskW = w;
  if (Math.abs(w - lastSkyW) > 0.02 || ((w === 0 || w === 1) && w !== lastSkyW)) {
    setSky(w);
    lastSkyW = w;
  }
  scene.fog.color.lerpColors(FOG_DAY, FOG_DUSK, w);
  sun.color.lerpColors(SUNLIGHT_DAY, SUNLIGHT_DUSK, w);
  sun.intensity = 2.6 - 0.5 * w;
  hemi.intensity = 1.15 - 0.2 * w;
  renderer.toneMappingExposure = 1.08 + 0.06 * w;
  sunDirCur.lerpVectors(SUN_DIR_DAY, SUN_DIR_DUSK, w).normalize();
  sunSprite.material.color.lerpColors(SUNDISC_DAY, SUNDISC_DUSK, w);
  sunSprite.scale.setScalar(110 * (1 + 0.45 * w));
}

/* ---------------- site markers ---------------- */

const markers = SITES.map((site, i) => {
  const g = new THREE.Group();
  const baseY = 0; // both piers have decks near y 0
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.3, 28),
    new THREE.MeshBasicMaterial({ color: COLORS.red, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.18;
  const pinMat = new THREE.MeshPhongMaterial({ color: COLORS.red, emissive: 0x3a0e08, shininess: 60 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 12), pinMat);
  cone.rotation.x = Math.PI;
  cone.position.y = 2.5;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 12), pinMat);
  ball.position.y = 4.05;
  ball.castShadow = true;
  const sprite = makeNumberSprite(site.num);
  sprite.position.y = 6.6;
  const pin = new THREE.Group();
  pin.add(cone, ball);
  g.add(ring, pin, sprite);
  g.position.set(site.pos.x, baseY, site.pos.z);
  scene.add(g);
  return { site, g, pin, ring, sprite, pinMat, phase: i * 1.1, visited: false };
});

/* ---------------- the man himself ---------------- */

const player = new THREE.Group();
{
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.8, 1.9, 10), lambert(0x33302c));
  coat.position.y = 1.55;
  coat.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), lambert(0xd9b08c));
  head.position.y = 2.95;
  head.castShadow = true;
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), lambert(0xb9b3a8));
  beard.position.set(0, 2.66, 0.26);
  beard.scale.set(1, 1.05, 0.8);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 14), lambert(0x26221d));
  brim.position.y = 3.32;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.55, 12), lambert(0x26221d));
  top.position.y = 3.62;
  player.add(coat, head, beard, brim, top);
}
const legGeo = new THREE.BoxGeometry(0.3, 0.95, 0.3);
legGeo.translate(0, -0.45, 0);
const legL = new THREE.Mesh(legGeo, lambert(0x26221d));
const legR = legL.clone();
legL.position.set(-0.24, 0.95, 0);
legR.position.set(0.24, 0.95, 0);
legL.castShadow = legR.castShadow = true;
player.add(legL, legR);
player.scale.setScalar(0.58); // a man among five-storey buildings
player.position.set(0, 0, 70);
player.rotation.y = Math.PI; // facing north, up the island
scene.add(player);

camera.position.set(
  player.position.x + Math.sin(cam.yaw) * cam.dist,
  cam.height,
  player.position.z + Math.cos(cam.yaw) * cam.dist
);
camera.lookAt(player.position);

// Gilded "you are here" marker, shown over Melville in chart view.
const beacon = new THREE.Group();
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
const beaconCone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.6, 4), beaconMat);
beaconCone.geometry.rotateX(Math.PI); // apex down
beaconCone.position.y = 7;
const beaconRing = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3, 24),
  new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
);
beaconRing.rotation.x = -Math.PI / 2;
beaconRing.position.y = 0.3;
beacon.add(beaconCone, beaconRing);
beacon.visible = false;
scene.add(beacon);

/* ---------------- input ---------------- */

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (finale) { skipFinale(); return; }
  if ((e.code === 'KeyE' || e.code === 'Enter') && state.started) tryVisit();
  if (e.code === 'KeyM' && state.started) toggleView();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Touch: left side of the screen is a walk joystick, everywhere else
// (and the mouse on desktop) drags the camera around the player.
const joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const look = { id: null, lx: 0, ly: 0, sx: 0, sy: 0 };
const joyEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');

function onUi(e) {
  return e.target.closest && e.target.closest('button, #chart-key, .overlay, #compass');
}

window.addEventListener('pointerdown', (e) => {
  if (finale) { skipFinale(); return; }
  if (!state.started || state.modal || onUi(e)) return;
  const wantsJoy = e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45;
  if (wantsJoy && joy.id === null) {
    if (touchHintHide) touchHintHide();
    joy.id = e.pointerId;
    joy.ox = e.clientX;
    joy.oy = e.clientY;
    joy.dx = joy.dy = 0;
    joyEl.classList.remove('hidden');
    joyEl.style.left = `${e.clientX - 55}px`;
    joyEl.style.top = `${e.clientY - 55}px`;
    stickEl.style.transform = 'translate(0,0)';
  } else if (look.id === null) {
    look.id = e.pointerId;
    look.lx = e.clientX;
    look.ly = e.clientY;
    look.sx = e.clientX; // remembered so a motionless release counts as a tap
    look.sy = e.clientY;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, 42);
    joy.dx = (dx / len) * (cl / 42);
    joy.dy = (dy / len) * (cl / 42);
    stickEl.style.transform = `translate(${(dx / len) * cl}px, ${(dy / len) * cl}px)`;
  } else if (e.pointerId === look.id && state.view === 'street') {
    cam.yaw -= (e.clientX - look.lx) * 0.0055;
    cam.height = Math.min(13, Math.max(1.5, cam.height + (e.clientY - look.ly) * 0.035));
    look.lx = e.clientX;
    look.ly = e.clientY;
    cam.lastDrag = clock.elapsedTime;
  }
});
function endPointer(e) {
  if (e.pointerId === joy.id) {
    joy.id = null;
    joy.dx = joy.dy = 0;
    joyEl.classList.add('hidden');
    // a motionless touch in the walk zone is a tap, not a walk
    if (Math.hypot(e.clientX - joy.ox, e.clientY - joy.oy) < 8) handleTap(e.clientX, e.clientY);
  }
  if (e.pointerId === look.id) {
    look.id = null;
    if (Math.hypot(e.clientX - look.sx, e.clientY - look.sy) < 8) handleTap(e.clientX, e.clientY);
  }
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

/* ---------------- UI ---------------- */

const state = { started: false, modal: false, visitedCount: 0, nearSite: null, epilogueShown: false, view: 'street' };

// The chart remembers: visited sites persist across sessions.
const SAVE_KEY = 'melville-charted-v1';
const save = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch { /* private mode */ }
  return Object.assign({ charted: [], epilogueShown: false, muted: false }, s);
})();
function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

const introEl = document.getElementById('intro');
const hudEl = document.getElementById('hud');
const visitBtn = document.getElementById('visit-btn');
const visitLabel = document.getElementById('visit-label');
const toastEl = document.getElementById('toast');
const cardEl = document.getElementById('card');
const epilogueEl = document.getElementById('epilogue');
const progressEl = document.getElementById('progress');
const compassEl = document.getElementById('compass');
const compassArrow = document.getElementById('compass-arrow');

const viewBtn = document.getElementById('view-btn');
function toggleView() {
  state.view = state.view === 'street' ? 'chart' : 'street';
  viewBtn.textContent = state.view === 'street' ? 'Chart View' : 'Street View';
  applyShadowFrustum(state.view);
}
viewBtn.addEventListener('click', toggleView);

const keyList = document.getElementById('key-list');
[...SITES].sort((a, b) => a.num - b.num).forEach((s) => {
  const li = document.createElement('li');
  li.id = `key-${s.id}`;
  li.innerHTML = `<span class="knum">${s.num}</span><span>${s.title.replace('—', '·')}</span>`;
  keyList.appendChild(li);
});

let toastTimer = null;
function toast(msg, ms = 4200) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastEl.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.classList.add('hidden'), 500);
  }, ms);
}

// A returning walker is greeted as one — and may tear up the old chart.
if (save.charted.length > 0) {
  document.getElementById('start-btn').textContent = 'Return ashore';
  const note = document.createElement('p');
  note.className = 'save-note';
  note.textContent = `${save.charted.length} of ${SITES.length} sites already charted · `;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-link';
  reset.textContent = 'begin a new chart';
  reset.addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
    location.reload();
  });
  note.appendChild(reset);
  document.getElementById('start-btn').after(note);
}

// First-time touch players get a moment of ghosted guidance.
let touchHintHide = null;
function showTouchHint() {
  if (!('ontouchstart' in window) || save.charted.length > 0) return;
  const hint = document.getElementById('touch-hint');
  hint.classList.remove('hidden');
  touchHintHide = () => {
    touchHintHide = null;
    hint.style.opacity = '0';
    setTimeout(() => hint.classList.add('hidden'), 600);
  };
  setTimeout(() => { if (touchHintHide) touchHintHide(); }, 6500);
}

document.getElementById('start-btn').addEventListener('click', () => {
  introEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  state.started = true;
  audio.init(); // the user gesture browsers require before sound
  audio.setMuted(save.muted);
  if (window.innerWidth < 700) document.getElementById('chart-key').removeAttribute('open');
  toast(save.charted.length > 0
    ? 'Back ashore. The chart remembers what you have already found.'
    : 'You step ashore at the Battery. Six red markers wait on the island — the compass points to the nearest.');
  showTouchHint();
});

const muteBtn = document.getElementById('mute-btn');
function reflectMute() {
  muteBtn.classList.toggle('muted', save.muted);
  muteBtn.title = save.muted ? 'Sound is off — tap to unmute' : 'Sound is on — tap to mute';
}
muteBtn.addEventListener('click', () => {
  save.muted = !save.muted;
  persistSave();
  audio.setMuted(save.muted);
  reflectMute();
});
audio.setMuted(save.muted);
reflectMute();

function tryVisit() {
  if (!state.nearSite || state.modal) return;
  openCard(state.nearSite);
}
visitBtn.addEventListener('click', tryVisit);

// Tap a red site pin or any landmark — on foot or from the chart — to read about it.
const tapRay = new THREE.Raycaster();
function handleTap(cx, cy) {
  if (!state.started || state.modal) return;
  tapRay.setFromCamera(
    new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1),
    camera
  );
  for (const m of markers) {
    if (tapRay.intersectObject(m.g, true).length) {
      openCard(m);
      return;
    }
  }
  const hits = tapRay.intersectObjects(tapTargets, false);
  if (hits.length) openLandmarkCard(hits[0].object.userData.landmark);
}

// Ghost-click guard: on touch screens the tap that opens a card is followed
// by a synthetic click at the same spot a moment later. If the close button
// happens to appear under the fingertip, that click would shut the card
// before it could be read — so closes are ignored for an instant after open.
let modalOpenedAt = 0;
function ghostClick() {
  return performance.now() - modalOpenedAt < 350;
}

function openLandmarkCard(info) {
  if (!info) return;
  state.modal = true;
  modalOpenedAt = performance.now();
  audio.play('pageTurn');
  document.getElementById('card-num').textContent = '★';
  document.getElementById('card-title').textContent = info.name;
  document.getElementById('card-dates').textContent = info.year
    ? `${info.year} · a landmark of Melville’s city`
    : 'a landmark of Melville’s city';
  document.getElementById('card-media').innerHTML = '';
  document.getElementById('card-body').innerHTML = `<p>${info.blurb}</p>`;
  document.getElementById('card-artifact').style.display = 'none';
  cardEl.classList.remove('hidden');
}

// Settle a pin into its final "charted" look (also used after the pop FX).
function settlePin(m) {
  m.pinMat.color.set(COLORS.ink);
  m.pinMat.emissive.set(0x000000);
  m.ring.material.color.set(COLORS.ink);
  m.ring.material.opacity = 0.4;
  m.ring.scale.setScalar(1);
  m.fxScale = 1;
}

// Chart a site: bookkeeping shared by a live visit and a restored save.
// A live visit keeps the pin red until the card closes, so the player
// actually sees it being inked onto the chart (the FX runs in animate).
let pendingPinFx = null;
const pinFx = [];
const PIN_RED = new THREE.Color(COLORS.red);
const PIN_INK = new THREE.Color(COLORS.ink);
const PIN_EMBER = new THREE.Color(0x3a0e08);
const PIN_BLACK = new THREE.Color(0x000000);
function chartSite(marker, { silent = false } = {}) {
  if (marker.visited) return;
  marker.visited = true;
  state.visitedCount++;
  document.getElementById(`key-${marker.site.id}`).classList.add('done');
  progressEl.textContent = `${state.visitedCount} of ${SITES.length} sites charted`;
  if (!save.charted.includes(marker.site.id)) {
    save.charted.push(marker.site.id);
    persistSave();
  }
  if (silent) {
    settlePin(marker);
  } else {
    pendingPinFx = marker;
    audio.play('chime');
  }
}

function openCard(marker) {
  state.modal = true;
  modalOpenedAt = performance.now();
  audio.play('pageTurn');
  const s = marker.site;
  document.getElementById('card-num').textContent = s.num;
  document.getElementById('card-title').textContent = s.title;
  document.getElementById('card-dates').textContent = s.dates;
  const mediaEl = document.getElementById('card-media');
  mediaEl.innerHTML = '';
  if (s.image) {
    const fig = document.createElement('figure');
    fig.className = 'card-figure';
    const img = document.createElement('img');
    img.src = s.image.src;
    img.alt = s.image.alt;
    img.loading = 'lazy';
    img.onerror = () => fig.remove();
    const cap = document.createElement('figcaption');
    cap.textContent = s.image.caption.replace(/\s+/g, ' ').trim();
    fig.append(img, cap);
    mediaEl.appendChild(fig);
  }
  document.getElementById('card-body').innerHTML = s.body.map((p) => `<p>${p}</p>`).join('');
  const artifactEl = document.getElementById('card-artifact');
  artifactEl.style.display = '';
  const firstVisit = !marker.visited;
  artifactEl.innerHTML = firstVisit
    ? `<b>Artifact found:</b> ${s.artifact}`
    : `<b>Collected:</b> ${s.artifact}`;
  artifactEl.classList.toggle('stamped', firstVisit);
  cardEl.classList.remove('hidden');
  if (firstVisit) chartSite(marker);
}

document.getElementById('card-close').addEventListener('click', () => {
  if (ghostClick()) return;
  cardEl.classList.add('hidden');
  state.modal = false;
  if (pendingPinFx) {
    pinFx.push({ m: pendingPinFx, t: 0 });
    audio.play('bell');
    pendingPinFx = null;
  }
  if (state.visitedCount === SITES.length && !state.epilogueShown) {
    state.epilogueShown = true;
    // wait for the sixth pin's pop, so the player sees it inked
    // onto the chart before the camera lifts away
    finaleQueued = true;
  }
});

function showEpilogue() {
  modalOpenedAt = performance.now();
  // persisted only now — a reload during the finale lets it play again
  save.epilogueShown = true;
  persistSave();
  document.getElementById('epilogue-body').innerHTML = EPILOGUE.map((p) => `<p>${p}</p>`).join('');
  epilogueEl.classList.remove('hidden');
  state.modal = true;
}

/* ---------------- finale: the tide turns ---------------- */

// When the sixth site is charted the camera lifts off the streets,
// crosses the rooftops and the harbor, and settles before the Statue of
// Liberty while the horns answer and the light goes to gold. Any key or
// tap skips it; the dusk it leaves behind is permanent.
let finale = null;
let finaleQueued = false; // armed on the sixth card-close; lifts off once the pin FX has played
const LIBERTY_LOOK = new THREE.Vector3(-33, 15, 107);
function startFinale() {
  if (state.view === 'chart') toggleView();
  state.modal = true; // freezes the walker and hides the visit button
  hudEl.classList.add('hidden');
  const p = player.position;
  finale = {
    t: 0,
    dur: 14,
    curve: new THREE.CatmullRomCurve3([
      camera.position.clone(),
      new THREE.Vector3(p.x, 38, p.z + 25),
      new THREE.Vector3(8, 55, 55),
      new THREE.Vector3(-10, 26, 86),
    ]),
    horns: [[2, 82, 0.4], [5, 116, 0.28], [8.2, 96, 0.34]],
    gullsAt: 3.5,
  };
}

function skipFinale() {
  if (!finale || finale.t < 1) return;
  finale.t = finale.dur;
  finale.horns = [];
  finale.gullsAt = 0;
}

function smoothstep01(x) {
  return x * x * (3 - 2 * x);
}

function updateFinale(dt) {
  finale.t += dt;
  applyDusk(Math.min(1, finale.t / 8));
  while (finale.horns.length && finale.t >= finale.horns[0][0]) {
    const [, freq, gain] = finale.horns.shift();
    audio.play('horn', { freq, gain });
  }
  if (finale.gullsAt && finale.t >= finale.gullsAt) {
    finale.gullsAt = 0;
    audio.play('gull');
  }
  if (finale.t >= finale.dur) {
    finale = null;
    applyDusk(1);
    hudEl.classList.remove('hidden');
    showEpilogue();
  }
}
document.getElementById('epilogue-close').addEventListener('click', () => {
  if (ghostClick()) return;
  epilogueEl.classList.add('hidden');
  state.modal = false;
  toast('The island is yours now. Revisit any marker to reread its story.');
});

/* ---------------- movement & loop ---------------- */

const SPEED = 7.5;
let needleAngle = 0; // continuous compass-needle angle, radians
let walkPhase = 0;
let lastStepSign = true; // footstep trigger: sign of the leg swing
let visitPulsed = false; // the first visit prompt glows once
let shoreTimer = 0;
let shoreCached = 50; // distance to the nearest stretch of shoreline

function shoreDistance(px, pz) {
  let d = Infinity;
  for (let i = 0; i < ISLAND.length; i++) {
    const [ax, az] = ISLAND[i];
    const [bx, bz] = ISLAND[(i + 1) % ISLAND.length];
    d = Math.min(d, distToSegment(px, pz, ax, az, bx, bz));
  }
  return d;
}

// the El announces its turnarounds, louder the closer you stand
function trainWhistle() {
  if (!state.started) return;
  const d = Math.hypot(player.position.x - EL_X, player.position.z - train.position.z);
  const g = Math.max(0, 1 - d / 140);
  if (g > 0.03) audio.play('whistle', { gain: 0.02 + 0.28 * g * g });
}
const clock = new THREE.Clock();
const camRay = new THREE.Raycaster();

function moveInput() {
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  mx += joy.dx;
  mz += joy.dy;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  return [mx, mz];
}

function collide(px, pz) {
  for (const c of colliders) {
    if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) {
      const dxl = px - c.x0, dxr = c.x1 - px, dzl = pz - c.z0, dzr = c.z1 - pz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) px = c.x0;
      else if (m === dxr) px = c.x1;
      else if (m === dzl) pz = c.z0;
      else pz = c.z1;
    }
  }
  return [px, pz];
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const wPos = water.geometry.attributes.position;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // --- player (movement is camera-relative; chart view is north-up) ---
  const effYaw = state.view === 'chart' ? 0 : cam.yaw;
  let moving = 0, dirX = 0, dirZ = 0;
  if (state.started && !state.modal) {
    const [mx, mz] = moveInput();
    moving = Math.hypot(mx, mz);
    if (moving > 0.01) {
      const fx = -Math.sin(effYaw), fz = -Math.cos(effYaw);   // camera forward
      const rx = Math.cos(effYaw), rz = -Math.sin(effYaw);    // camera right
      dirX = rx * mx + fx * -mz;
      dirZ = rz * mx + fz * -mz;
      let nx = player.position.x + dirX * SPEED * dt;
      let nz = player.position.z + dirZ * SPEED * dt;
      if (!isWalkable(nx, player.position.z)) nx = player.position.x;
      if (!isWalkable(nx, nz)) nz = player.position.z;
      [nx, nz] = collide(nx, nz);
      if (isWalkable(nx, nz)) player.position.set(nx, 0, nz);
      player.rotation.y = angleLerp(player.rotation.y, Math.atan2(dirX, dirZ), 0.2);
    }
  }
  walkPhase += dt * (4 + moving * 9);
  const swing = moving > 0.01 ? 0.62 : 0;
  legL.rotation.x = Math.sin(walkPhase) * swing;
  legR.rotation.x = -Math.sin(walkPhase) * swing;
  player.position.y = moving > 0.01 ? Math.abs(Math.sin(walkPhase)) * 0.1 : 0;
  // each leg-swing crossing is a footfall — planks on the piers, stone ashore
  const stepSign = Math.sin(walkPhase) >= 0;
  if (moving > 0.01 && stepSign !== lastStepSign) {
    audio.play(pointInPoly(player.position.x, player.position.z) ? 'step' : 'stepWood');
  }
  lastStepSign = stepSign;

  // --- camera: street view orbits behind him; chart view frames the whole
  // island from a fixed vantage, like the 1982 map ---
  const chartView = state.view === 'chart';
  let camPos, lookGoal;
  if (finaleQueued && pinFx.length === 0 && !state.modal) {
    finaleQueued = false;
    startFinale();
  }
  if (finale) {
    updateFinale(dt);
  }
  if (finale) {
    // the long crane shot out to the harbor; settles 3 s before the card
    const u = smoothstep01(Math.min(1, finale.t / (finale.dur - 3)));
    camPos = finale.curve.getPoint(u);
    const lookK = smoothstep01(Math.min(1, finale.t / 5));
    lookGoal = new THREE.Vector3(player.position.x, 1.9, player.position.z).lerp(LIBERTY_LOOK, lookK);
  } else if (chartView) {
    camPos = CHART_CAM_POS;
    lookGoal = CHART_LOOK_AT;
  } else {
    if (moving > 0.01 && t - cam.lastDrag > 2.2) {
      cam.yaw = angleLerp(cam.yaw, Math.atan2(dirX, dirZ) + Math.PI, 1 - Math.pow(0.55, dt));
    }
    const head = new THREE.Vector3(player.position.x, 1.9, player.position.z);
    const desired = new THREE.Vector3(
      player.position.x + Math.sin(cam.yaw) * cam.dist,
      cam.height,
      player.position.z + Math.cos(cam.yaw) * cam.dist
    );
    const toCam = desired.clone().sub(head);
    const fullDist = toCam.length();
    toCam.normalize();
    camRay.set(head, toCam);
    camRay.far = fullDist;
    const blocked = camRay.intersectObjects(occluders, false);
    const targetDist = blocked.length ? Math.max(2.2, blocked[0].distance - 0.5) : fullDist;
    // ease the occlusion pull-in: snap in quickly, recover gently, never pop
    const k = targetDist < cam.smoothDist ? Math.min(1, dt * 14) : Math.min(1, dt * 3);
    cam.smoothDist += (targetDist - cam.smoothDist) * k;
    camPos = head.clone().addScaledVector(toCam, cam.smoothDist);
    // only near the very bottom of the drag range does the view crane up
    // (quadratic, so it eases in) — normal heights behave as before
    const lowness = Math.max(0, 2.8 - cam.height);
    lookGoal = new THREE.Vector3(player.position.x, player.position.y + 1.7 + lowness * lowness * 4, player.position.z);
  }
  const camK = 1 - Math.pow(0.0008, dt);
  camera.position.lerp(camPos, camK);
  lookTarget.lerp(lookGoal, camK);
  camera.lookAt(lookTarget);
  const fv = FOG_VIEWS[state.view];
  scene.fog.near += (fv.near - scene.fog.near) * Math.min(1, dt * 2);
  scene.fog.far += (fv.far - scene.fog.far) * Math.min(1, dt * 2);
  sun.position.set(player.position.x + 70, 100, player.position.z + 45);
  sun.target.position.set(player.position.x, 0, player.position.z);

  // --- the sun's disc and the clouds belong to the street sky only;
  // from the chart's altitude they would hang between camera and island ---
  sunSprite.position.copy(player.position).addScaledVector(sunDirCur, 850);
  sunSprite.material.opacity += ((chartView ? 0 : 0.95) - sunSprite.material.opacity) * Math.min(1, dt * 3);
  for (const cl of clouds) {
    cl.sp.position.x += cl.speed * dt;
    if (cl.sp.position.x > 290) cl.sp.position.x = -290;
    cl.sp.material.opacity += ((chartView ? 0 : cl.peak) - cl.sp.material.opacity) * Math.min(1, dt * 2);
  }

  // --- proximity / visit prompt ---
  let near = null, nearD = 8;
  for (const m of markers) {
    const d = Math.hypot(player.position.x - m.site.pos.x, player.position.z - m.site.pos.z);
    if (d < nearD) { near = m; nearD = d; }
  }
  if (near !== state.nearSite) {
    state.nearSite = near;
    if (near && state.started && !state.modal) {
      visitLabel.textContent = `${near.visited ? 'Revisit' : 'Visit'}: ${near.site.title.split('—')[0].trim()}`;
      visitBtn.classList.remove('hidden');
      if (!visitPulsed) {
        // the very first prompt glows so nobody walks past it
        visitPulsed = true;
        visitBtn.classList.add('pulse');
        setTimeout(() => visitBtn.classList.remove('pulse'), 4400);
      }
    } else {
      visitBtn.classList.add('hidden');
    }
  }
  if (state.modal && !visitBtn.classList.contains('hidden')) visitBtn.classList.add('hidden');
  if (!state.modal && state.nearSite && state.started && visitBtn.classList.contains('hidden')) {
    const n = state.nearSite;
    visitLabel.textContent = `${n.visited ? 'Revisit' : 'Visit'}: ${n.site.title.split('—')[0].trim()}`;
    visitBtn.classList.remove('hidden');
  }

  // --- compass to nearest uncharted site ---
  let target = null, best = Infinity;
  for (const m of markers) {
    if (m.visited) continue;
    const d = Math.hypot(player.position.x - m.site.pos.x, player.position.z - m.site.pos.z);
    if (d < best) { best = d; target = m; }
  }
  // Guide needle: the arrow points toward the nearest uncharted site
  // relative to the current view — walk the way it points. (In chart view
  // the view is north-up, so it doubles as a map bearing.) The angle is
  // kept continuous and smoothed in JS so the needle never spins the long
  // way around when the target passes behind the camera.
  if (target) {
    const dx = target.site.pos.x - player.position.x;
    const dz = target.site.pos.z - player.position.z;
    const fx = -Math.sin(effYaw), fz = -Math.cos(effYaw);
    const rx = Math.cos(effYaw), rz = -Math.sin(effYaw);
    const rel = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    let dAng = (((rel - needleAngle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    needleAngle += dAng * Math.min(1, dt * 9);
    compassArrow.style.transform = `rotate(${(needleAngle * 180) / Math.PI}deg)`;
    compassArrow.style.opacity = '1';
  } else if (!compassEl.classList.contains('compass-done')) {
    // all six charted: the needle turns gold and idles
    compassEl.classList.add('compass-done');
    compassEl.title = 'All six sites charted';
    compassArrow.style.opacity = '';
    compassArrow.style.transform = '';
  }

  // --- the moment of charting: pin pops and settles to ink, ring ripples ---
  for (let i = pinFx.length - 1; i >= 0; i--) {
    const fx = pinFx[i];
    fx.t += dt;
    const k = Math.min(1, fx.t / 1.2);
    fx.m.fxScale = 1 + Math.sin(Math.min(1, fx.t / 0.5) * Math.PI) * 0.5;
    fx.m.ring.scale.setScalar(1 + k * 2.2);
    fx.m.ring.material.opacity = 0.85 * (1 - k);
    fx.m.pinMat.color.lerpColors(PIN_RED, PIN_INK, k);
    fx.m.pinMat.emissive.lerpColors(PIN_EMBER, PIN_BLACK, k);
    if (k >= 1) {
      settlePin(fx.m);
      pinFx.splice(i, 1);
    }
  }

  // --- markers bob (and swell so they read from the chart view) ---
  for (const m of markers) {
    const ss = chartView ? 12 : 3.6;
    m.sprite.scale.set(ss, ss, 1);
    m.pin.scale.setScalar((chartView ? 2.8 : 1) * (m.fxScale || 1));
    if (!m.visited) {
      m.pin.position.y = Math.sin(t * 2 + m.phase) * 0.4 + 0.2;
      m.pin.rotation.y = t * 0.8;
      m.sprite.position.y = (chartView ? 16 : 6.6) + Math.sin(t * 2 + m.phase) * 0.4;
    } else {
      m.pin.position.y = 0;
      m.sprite.position.y = chartView ? 16 : 6.6;
    }
  }

  // --- "you are here" beacon, only meaningful from altitude ---
  beacon.visible = chartView && state.started;
  if (beacon.visible) {
    beacon.position.set(player.position.x, 0, player.position.z);
    beaconCone.position.y = 7 + Math.sin(t * 2.4) * 0.7;
    beaconCone.rotation.y = t;
  }

  // --- landmark labels: always legible from the chart, discreet on foot ---
  for (const L of landmarkLabels) {
    let o, s;
    if (chartView) {
      o = 0.95;
      s = 2.6;
    } else {
      const d = Math.hypot(player.position.x - L.x, player.position.z - L.z);
      const fadeIn = L.range - 16;
      o = d < fadeIn ? 1 : d > L.range ? 0 : 1 - (d - fadeIn) / 16;
      s = 1;
    }
    L.sprite.material.opacity = o;
    L.sprite.visible = o > 0.02;
    if (L.sprite.visible) L.sprite.scale.set(L.w * s, L.h * s, 1);
  }

  // --- street life (pedestrians respect walls like everyone else) ---
  for (const w of wanderers) {
    const nz = w.z + w.dir * w.speed * dt;
    const [cx2, cz2] = collide(w.x, nz);
    if (Math.abs(cz2 - nz) > 1e-4) {
      w.dir *= -1; // blocked by a stoop, wagon, or wall — turn back
    } else {
      w.z = cz2;
      w.x = cx2;
    }
    if (w.z < w.z0) { w.z = w.z0; w.dir = 1; }
    if (w.z > w.z1) { w.z = w.z1; w.dir = -1; }
    w.g.position.set(w.x, Math.abs(Math.sin(t * 7 + w.ph)) * 0.04, w.z);
    w.g.rotation.y = w.dir > 0 ? 0 : Math.PI;
  }

  // --- water: a long swell with wind-chop riding on top ---
  for (let i = 0; i < wPos.count; i++) {
    const x = waterBase[i * 3], z = waterBase[i * 3 + 2];
    wPos.array[i * 3 + 1] =
      Math.sin(x * 0.09 + t * 0.9) * Math.cos(z * 0.07 + t * 0.7) * 0.28 +
      Math.sin(x * 0.23 - t * 1.6) * Math.sin(z * 0.19 + t * 1.2) * 0.11;
  }
  wPos.needsUpdate = true;
  water.geometry.computeVertexNormals();

  // --- moving props ---
  for (const b of bobbers) {
    b.obj.position.y = Math.sin(t * 0.9 + b.phase) * 0.18;
    b.obj.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.02;
  }
  driftA.position.z -= dt * 3.2;
  if (driftA.position.z < -115) driftA.position.z = 95;
  driftB.position.z -= dt * 4;
  if (driftB.position.z < -38) driftB.position.z = 62;
  driftC.position.x += dt * 4.5;
  if (driftC.position.x > 110) driftC.position.x = -110;

  train.position.z += trainDir * dt * 9;
  if (train.position.z < -103) { train.position.z = -103; trainDir = 1; train.rotation.y = Math.PI; trainWhistle(); }
  if (train.position.z > -8) { train.position.z = -8; trainDir = -1; train.rotation.y = 0; trainWhistle(); }

  // --- coal smoke from the locomotive and the two moving steamers ---
  smokeTrainT += dt;
  while (smokeTrainT > 0.3) { smokeTrainT -= 0.3; smoke.emit(train, 0, 9.95, 6, 2.4); }
  smokeShipBT += dt;
  while (smokeShipBT > 0.45) { smokeShipBT -= 0.45; smoke.emit(driftB, 0, 5.1, 0.5, 1.7); }
  smokeShipCT += dt;
  while (smokeShipCT > 0.45) { smokeShipCT -= 0.45; smoke.emit(driftC, 0, 5.1, 0.5, 1.7); }
  smoke.update(dt);

  diana.rotation.y = t * 0.4;

  whale.position.y = -0.7 + Math.sin(t * 0.5) * 0.35;
  const spoutT = (t % 7) / 7;
  spout.visible = spoutT < 0.3;
  if (spout.visible) {
    const s = Math.sin((spoutT / 0.3) * Math.PI);
    spout.scale.set(s, 0.4 + s, s);
    spout.material.opacity = 0.85 * s;
  }

  for (const gl of gulls) {
    gl.a += dt * gl.s;
    // gulls mostly glide; flap comes in bursts, downstroke faster than up
    gl.st -= dt;
    if (gl.st <= 0) {
      gl.gliding = !gl.gliding;
      gl.st = gl.gliding ? 1.6 + Math.random() * 2.6 : 0.9 + Math.random() * 1.6;
      if (!gl.gliding && Math.random() < 0.3) audio.play('gull');
    }
    if (!gl.gliding) gl.p += dt * 10 * (Math.sin(gl.p) > 0 ? 1.5 : 0.75);
    const flapGoal = gl.gliding ? -0.16 : Math.sin(gl.p) * 0.85;
    gl.flap += (flapGoal - gl.flap) * Math.min(1, dt * 12);
    gl.w1.rotation.z = gl.flap;
    gl.w2.rotation.z = -gl.flap;
    // sink on the glide, climb on the burst; the circle itself breathes
    gl.y = Math.max(gl.h - 1.5, Math.min(gl.h + 2, gl.y + (gl.gliding ? -0.35 : 0.55) * dt));
    const r = gl.r + Math.sin(t * 0.13 + gl.r) * 2.5;
    gl.g.position.set(Math.cos(gl.a) * r - 2, gl.y + Math.sin(t + gl.r) * 0.4, 88 + Math.sin(gl.a) * r);
    gl.g.rotation.y = -gl.a;
    gl.g.rotation.z = -0.24; // banked into the turn
  }

  // --- the soundscape follows the walk: surf swells by the shore ---
  shoreTimer -= dt;
  if (shoreTimer <= 0) {
    shoreTimer = 0.25;
    shoreCached = pointInPoly(player.position.x, player.position.z)
      ? shoreDistance(player.position.x, player.position.z)
      : 0; // on a pier, the water is right under the planks
  }
  audio.update(dt, {
    px: player.position.x,
    pz: player.position.z,
    shore: shoreCached,
    ducked: state.modal && !finale,
  });

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Restore a returning walker's chart before the first frame.
for (const id of save.charted) {
  const m = markers.find((mk) => mk.site.id === id);
  if (m) chartSite(m, { silent: true });
}
if (save.epilogueShown) {
  state.epilogueShown = true;
  applyDusk(1); // the tide turned in an earlier session; the dusk holds
}

animate();
