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
  islandTop: 0xece2c8,
  islandSide: 0xb3a482,
  outerLand: 0xe2d8bc,
  park: 0xa9b58a,
  parkTree: 0x76885f,
  ink: 0x2b2620,
  red: 0xb23a2c,
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

// The harbor end of the chart. The statue stands on Bedloe's Island, off
// the Battery; a boat crosses to it between two landing stages. Each
// landing has its planked `pier`, the `gangway` at its end (the boat can be
// boarded from within three paces of it), the spot where a passenger is
// set `ashore`, and the boat's `berth`.
const LIBERTY = { x: -44, z: 109.5 };
const CASTLE_GARDEN = { x: -13.5, z: 82.5 }; // up the west shore, clear of the view to the statue
const START = { x: -1, z: 91 };               // where the walker steps ashore: the head of the Battery landing
const LANDINGS = {
  battery: { pier: { x0: -3, x1: 1, z0: 93, z1: 103.3 }, gangway: [-1.3, 101.6], ashore: [-1.8, 101.5], berth: [-8.1, 101.5] },
  bedloes: { pier: { x0: -35, x1: -30.25, z0: 102.2, z1: 105.8 }, gangway: [-32, 104], ashore: [-31.5, 104], berth: [-25.15, 104] },
};

// Walkable rectangles besides the island itself: the two customs piers,
// the two landings, and Bedloe's Island. `planks` are wood underfoot.
const WALK_RECTS = [
  { x0: -58, x1: -39, z0: -15.5, z1: -8.5, planks: true },  // Gansevoort pier
  { x0: 39, x1: 58, z0: -98.5, z1: -91.5, planks: true },   // East River pier
  { ...LANDINGS.battery.pier, planks: true },
  { ...LANDINGS.bedloes.pier, planks: true },
  { x0: LIBERTY.x - 9.1, x1: LIBERTY.x + 9.1, z0: LIBERTY.z - 8.6, z1: LIBERTY.z + 8.6 }, // Bedloe's Island, inside its seawall
];

const AVENUES = [-36, -24, -12, 0, 12, 24, 36];
const STREETS = [];
for (let z = 12; z >= -104; z -= 8) STREETS.push(z);

const EL_X = 30; // Third Avenue El runs along x = 30, z in [-109, 0]

const CLEAR_CIRCLES = SITES.map((s) => ({ x: s.pos.x, z: s.pos.z, r: 6 }));
CLEAR_CIRCLES.push({ x: 18, z: -88.5, r: 4.5 }); // the house itself
CLEAR_CIRCLES.push({ x: CASTLE_GARDEN.x, z: CASTLE_GARDEN.z, r: 6 });
CLEAR_CIRCLES.push({ x: 19, z: 46, r: 7 });      // bridge approach
CLEAR_CIRCLES.push({ x: 2, z: 48, r: 10 });      // City Hall and its park
CLEAR_CIRCLES.push({ x: -2, z: 37.4, r: 6.5 });  // Federal Hall
CLEAR_CIRCLES.push({ x: 12.5, z: 44, r: 5 });    // Tribune Building
CLEAR_CIRCLES.push({ x: -1.5, z: 57, r: 5 });    // Western Union Building
CLEAR_CIRCLES.push({ x: 19, z: -4, r: 6 });      // Cooper Union
CLEAR_CIRCLES.push({ x: -17, z: -76, r: 7 });    // Fifth Avenue Hotel
const CLEAR_RECTS = [
  { x0: -15, x1: 7, z0: -93, z1: -80 },   // Madison Square Garden block
  { x0: -12, x1: 10, z0: -80, z1: -68 },  // Madison Square Park
  { x0: -11, x1: 7, z0: -45, z1: -35 },   // Union Square
];
// Footprints that interrupt the street grid — the landmarks and parks that
// take more than a block. Roads and sidewalks stop at their edges instead
// of running underneath them.
const STREET_CUTS = [
  { x0: -13, x1: 5, z0: -91, z1: -81 },          // Madison Square Garden and its tower
  { x0: -10.5, x1: 8.9, z0: -79.5, z1: -69 },    // Madison Square Park
  { x0: -20.5, x1: -13.5, z0: -78.75, z1: -73.25 }, // Fifth Avenue Hotel
  { x0: 16, x1: 22, z0: -8, z1: 0 },             // Cooper Union
  { x0: -10, x1: 6, z0: -42.8, z1: -37.2 },      // Union Square
];

// The other shores, as slabs of plainer paper: { x0, x1, z0, z1 }. The
// water reads these too, to know where its shallows are.
const OUTER_LAND = {
  jersey: { x0: -162, x1: -66, z0: -132, z1: 48 },
  brooklyn: { x0: 58, x1: 154, z0: -32, z1: 128 },
  bedloes: { x0: LIBERTY.x - 9.5, x1: LIBERTY.x + 9.5, z0: LIBERTY.z - 9, z1: LIBERTY.z + 9 },
  governors: { x0: 26.5, x1: 39.5, z0: 102, z1: 110 },
};

const DOWNTOWN_PATHS = [
  [[2, 88], [-4, 64], [-10, 38], [-13, 12]],   // Broadway
  [[4, 84], [12, 62], [18, 40], [23, 14]],     // Pearl Street
  [[-22, 46], [24, 40]],                       // Wall Street
];

/* ---------------- basic setup ---------------- */

const canvas = document.getElementById('scene');
const renderer = (() => {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    window.loadFailed?.('This browser could not start WebGL, which the island needs. Try turning on hardware acceleration, or another browser.');
    throw err;
  }
})();
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
const [skyCanvas, skyCtx] = canvas2d(16, 256);
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;

function lerpHexCss(a, b, t) {
  const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((ca >> sh) & 255) + (((cb >> sh) & 255) - ((ca >> sh) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function setSky(warmth) {
  const g = skyCtx.createLinearGradient(0, 0, 0, 256);
  SKY_STOPS.forEach((s, i) => g.addColorStop(s, lerpHexCss(SKY_DAY[i], SKY_DUSK[i], warmth)));
  skyCtx.fillStyle = g;
  skyCtx.fillRect(0, 0, 16, 256);
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
const lookTarget = new THREE.Vector3(START.x, 1.7, START.z); // smoothed camera focus
// The opening view (see `opening`, below) looks past the walker to the
// statue. The camera sits low, so that all of her fits under the top of
// the frame, and a little off her bearing, so that she stands to one side
// of the title and the opening note rather than behind them (by a share
// of the view's width, which on an upright phone is not much).
const OPENING_HEIGHT = 2.4;
const OPENING_YAW = Math.atan2(START.x - LIBERTY.x, START.z - LIBERTY.z)
  - 0.45 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
const OPENING_CAM = { x: START.x + Math.sin(OPENING_YAW) * cam.dist, z: START.z + Math.cos(OPENING_YAW) * cam.dist };
const occluders = []; // meshes the camera should not clip through

const hemi = new THREE.HemisphereLight(0xd5e0e8, 0xb09a78, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0ac, 2.6);
const SUN_OFFSET = new THREE.Vector3(70, 100, 45); // from whatever the light is aimed at, up to the light
sun.position.copy(SUN_OFFSET);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);

// The sun never changes its bearing, so the shadow camera's own sideways
// and upward axes are fixed in the world. They are what its frustum is
// measured along — which is not the island's east and north.
const SHADOW_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_OFFSET).normalize();
const SHADOW_UP = new THREE.Vector3().crossVectors(SUN_OFFSET, SHADOW_RIGHT).normalize();
const CHART_FOCUS = new THREE.Vector3(0, 0, 4); // the middle of everything the chart shows
const shadowFocus = new THREE.Vector3();
const shadowTexel = { x: 1, y: 1 }; // world units per shadow-map texel, along those axes

// Tight shadow frustum at street level for crisp shadows. In chart view it
// is fitted around the whole chart — the island, both piers, the harbor's
// islands and the tallest tower — wherever the walker happens to stand.
function applyShadowFrustum(view) {
  const c = sun.shadow.camera;
  let halfW = 55, halfH = 75;
  if (view === 'chart') {
    halfW = halfH = 0;
    const corner = new THREE.Vector3();
    for (const x of [-66, 66]) for (const y of [0, 40]) for (const z of [-116, 124]) {
      corner.set(x, y, z).sub(CHART_FOCUS);
      halfW = Math.max(halfW, Math.abs(corner.dot(SHADOW_RIGHT)));
      halfH = Math.max(halfH, Math.abs(corner.dot(SHADOW_UP)));
    }
  }
  c.left = -halfW; c.right = halfW; c.top = halfH; c.bottom = -halfH;
  c.updateProjectionMatrix();
  shadowTexel.x = (2 * halfW) / sun.shadow.mapSize.x;
  shadowTexel.y = (2 * halfH) / sun.shadow.mapSize.y;
}
applyShadowFrustum('street');

// Aim the sun. On foot the light follows the walker, but only in whole
// shadow-map texels: moved by fractions, every shadow edge in the street
// would crawl as he walks. From the chart it holds still over the island.
function aimSun(view, px, pz) {
  if (view === 'chart') {
    shadowFocus.copy(CHART_FOCUS);
  } else {
    shadowFocus.set(px, 0, pz);
    const r = shadowFocus.dot(SHADOW_RIGHT), u = shadowFocus.dot(SHADOW_UP);
    shadowFocus
      .addScaledVector(SHADOW_RIGHT, Math.round(r / shadowTexel.x) * shadowTexel.x - r)
      .addScaledVector(SHADOW_UP, Math.round(u / shadowTexel.y) * shadowTexel.y - u);
  }
  sun.target.position.copy(shadowFocus);
  sun.position.copy(shadowFocus).add(SUN_OFFSET);
}

const colliders = []; // axis-aligned boxes {x0,x1,z0,z1}
const roundColliders = []; // and round ones {x,z,r}, for round buildings

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

// on a pier's or a landing's planking, rather than on the ground
function onPlanks(x, z) {
  return !pointInPoly(x, z) && WALK_RECTS.some((r) => r.planks && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
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

function canvas2d(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
}

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

// Every canvas label is inked at load, usually before the web font has
// arrived; each keeps its draw routine so it can be inked again afterwards.
const labelRedraws = [];

function makeTextTexture(text, { size = 72, color = 'rgba(43,38,32,0.55)', italic = true } = {}) {
  const [cv, ctx] = canvas2d(1024, 144);
  const draw = () => {
    ctx.clearRect(0, 0, 1024, 144);
    ctx.font = `${italic ? 'italic ' : ''}600 ${size}px 'EB Garamond', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '14px';
    ctx.fillText(text, 512, 76);
  };
  draw();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  labelRedraws.push({ tex, draw });
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
  const [cv, ctx] = canvas2d(128, 128);
  const draw = () => {
    ctx.clearRect(0, 0, 128, 128);
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
  };
  draw();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelRedraws.push({ tex, draw });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.scale.set(3.6, 3.6, 1);
  return sprite;
}

/* ---------------- water & land ---------------- */

// The harbor: a long swell with wind-chop riding on top. The same wave
// runs in the water's vertex shader (so the plane can be fine and wide
// for free) and here in JS, so the ships ride the swell they float on.
// Three terms: the harbor swell, the wind-chop across it, and a fine
// ripple. Crests reach about 0.65 above the mean, which keeps them just
// under the island's top at y = 0. Keep the GLSL below in step with this.
const WATER_Y = -0.75, WATER_Z = -8;
function waveHeight(wx, wz, t) {
  const x = wx, z = wz - WATER_Z; // the plane's local frame
  return WATER_Y +
    Math.sin(x * 0.09 + t * 0.9) * Math.cos(z * 0.07 + t * 0.7) * 0.42 +
    Math.sin(x * 0.23 - t * 1.6) * Math.sin(z * 0.19 + t * 1.2) * 0.16 +
    Math.sin(x * 0.41 + z * 0.37 + t * 2.1) * 0.07;
}
// How far each patch of water lies from the nearest land, baked once into
// a small texture (one texel per 1.5 units, 0 at the shore and 1 from
// SHOAL_REACH outward). The water's shader reads it to pale the shallows
// along every shore.
const SHOAL_REACH = 9;
const shoreField = (() => {
  const X0 = -176, Z0 = -150, STEP = 1.5, W = 236, H = 198;
  // RGBA, though only red is read: a one-channel texture has no format
  // that a WebGL 1 context (which Three.js still falls back to) can upload
  const data = new Uint8Array(W * H * 4).fill(255);
  const slabs = Object.values(OUTER_LAND);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = X0 + (i + 0.5) * STEP, z = Z0 + (j + 0.5) * STEP;
      let d = SHOAL_REACH;
      for (const r of slabs) {
        d = Math.min(d, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1)));
      }
      // the island's outline is the costly test; skip it far from the island
      if (d > 0 && x > -50 - SHOAL_REACH && x < 50 + SHOAL_REACH && z > -118 - SHOAL_REACH && z < 100 + SHOAL_REACH) {
        d = pointInPoly(x, z) ? 0 : Math.min(d, shoreDistance(x, z));
      }
      data[(j * W + i) * 4] = Math.round(255 * Math.min(1, d / SHOAL_REACH));
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { tex, origin: new THREE.Vector2(X0, Z0), size: new THREE.Vector2(W * STEP, H * STEP) };
})();

// uSkyTint is the sky the water mirrors where it is seen at a glancing
// angle; it warms with the dusk of the finale (see applyDusk).
const WATER_SKY_DAY = new THREE.Color(0xb7c4c8), WATER_SKY_DUSK = new THREE.Color(0xe6b98a);
const waterUniforms = {
  uTime: { value: 0 },
  uShore: { value: shoreField.tex },
  uShoreOrigin: { value: shoreField.origin },
  uShoreSize: { value: shoreField.size },
  uShallow: { value: new THREE.Color(0x86aa9c) },
  uSkyTint: { value: WATER_SKY_DAY.clone() },
};
const waterGeo = new THREE.PlaneGeometry(600, 640, 240, 256);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x456f74, // the grey-green of the harbor, not a swimming pool
  roughness: 0.3,
  metalness: 0.05,
  flatShading: true, // normals come from screen derivatives, so displacement needs no recompute
  envMapIntensity: 0.3, // the room reflection washes the water pale if left strong; the sky tint below does that job
});
waterMat.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, waterUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uTime;
      uniform vec2 uShoreOrigin;
      uniform vec2 uShoreSize;
      varying float vCrest;
      varying vec2 vShoreUv;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float wave = sin(transformed.x * 0.09 + uTime * 0.9) * cos(transformed.z * 0.07 + uTime * 0.7) * 0.42
                 + sin(transformed.x * 0.23 - uTime * 1.6) * sin(transformed.z * 0.19 + uTime * 1.2) * 0.16
                 + sin(transformed.x * 0.41 + transformed.z * 0.37 + uTime * 2.1) * 0.07;
      transformed.y += wave;
      vCrest = wave / 0.65;
      vShoreUv = ((modelMatrix * vec4(transformed, 1.0)).xz - uShoreOrigin) / uShoreSize;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2D uShore;
      uniform vec3 uShallow;
      uniform vec3 uSkyTint;
      varying float vCrest;
      varying vec2 vShoreUv;`)
    // the shallows along every shore run paler and greener; crests run
    // paler and troughs deeper, so the swell reads even where the light is
    // flat; and the tallest crests break into a fleck of white
    .replace('#include <color_fragment>', `#include <color_fragment>
      float shoal = 1.0 - texture2D(uShore, vShoreUv).r;
      diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, shoal * shoal * 0.62);
      diffuseColor.rgb *= 0.9 + 0.16 * vCrest;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.9, 0.84), smoothstep(0.8, 1.0, vCrest) * 0.4);`)
    // seen at a glancing angle water is a mirror: each facet takes on the
    // sky by how far it tilts away from the eye, so the harbor deepens at
    // the walker's feet and silvers toward the horizon
    .replace('#include <opaque_fragment>', `
      float glance = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0);
      outgoingLight = mix(outgoingLight, uSkyTint, glance * 0.72);
      #include <opaque_fragment>`);
};
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.set(0, WATER_Y, WATER_Z);
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

// Surf: a ribbon of foam breaking along the island's shore, scrolling in
// toward the land and breathing with the swell.
const foam = (() => {
  const [cv, c] = canvas2d(128, 64);
  const g = c.createLinearGradient(0, 64, 0, 0); // bright at the shore (canvas bottom = v 0)
  g.addColorStop(0, 'rgba(255,253,245,0.9)');
  g.addColorStop(0.4, 'rgba(255,253,245,0.35)');
  g.addColorStop(1, 'rgba(255,253,245,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 64);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) c.fillRect(Math.random() * 128, 20 + Math.random() * 44, 2 + Math.random() * 10, 1.5);
  c.fillStyle = 'rgba(74,115,119,0.4)'; // gaps, in the water's own colour
  for (let i = 0; i < 30; i++) c.fillRect(Math.random() * 128, 34 + Math.random() * 30, 3 + Math.random() * 8, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const pos = [], uv = [], idx = [];
  const W = 1.5;
  for (let i = 0; i < ISLAND.length; i++) {
    const [ax, az] = ISLAND[i], [bx, bz] = ISLAND[(i + 1) % ISLAND.length];
    const len = Math.hypot(bx - ax, bz - az);
    let nx = -(bz - az) / len, nz = (bx - ax) / len; // a perpendicular, flipped if it points inland
    if (pointInPoly((ax + bx) / 2 + nx * 0.5, (az + bz) / 2 + nz * 0.5)) { nx = -nx; nz = -nz; }
    const base = pos.length / 3;
    pos.push(ax, -0.2, az, bx, -0.2, bz, bx + nx * W, -0.2, bz + nz * W, ax + nx * W, -0.2, az + nz * W);
    uv.push(0, 0, len / 4, 0, len / 4, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  scene.add(mesh);
  return { mat, tex };
})();

// Outer shores: New Jersey and Brooklyn, as plainer paper slabs.
function landSlab(r, h, y) {
  const m = box(r.x1 - r.x0, h, r.z1 - r.z0, COLORS.outerLand, (r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2, scene, false);
  m.receiveShadow = true;
  return m;
}
landSlab(OUTER_LAND.jersey, 2, -0.9);
landSlab(OUTER_LAND.brooklyn, 2, -0.9);
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
waterLabel('THE BATTERY', 5, 113, 0, 30); // south of the boat's crossing

/* ---------------- streets ---------------- */

// Belgian-block paving, drawn once and tiled: small granite setts in
// staggered courses, each a slightly different stone, worn paler along
// the crown of the block and dark in the joints.
function makeCobbleTexture() {
  const S = 256, COLS = 8, ROWS = 16;
  const [cv, ctx] = canvas2d(S, S);
  ctx.fillStyle = '#8f8570'; // the joints
  ctx.fillRect(0, 0, S, S);
  const bw = S / COLS, bh = S / ROWS;
  for (let row = 0; row < ROWS; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col < COLS; col++) {
      const x = col * bw + off, y = row * bh;
      const shade = 0.9 + Math.random() * 0.16;
      const warm = Math.random() * 10 - 4; // some setts run tan, some grey
      const r = Math.round((186 + warm) * shade), g = Math.round(176 * shade), b = Math.round((150 - warm) * shade);
      // a sett that wraps past the right edge is drawn again on the left,
      // so the tile repeats without a seam
      for (const dx of x + bw > S ? [0, -S] : [0]) {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + dx + 1, y + 1, bw - 2, bh - 2);
        ctx.fillStyle = 'rgba(255,250,235,0.16)'; // worn crown
        ctx.fillRect(x + dx + 3, y + 2, bw - 7, bh - 6);
        ctx.fillStyle = 'rgba(40,32,20,0.14)';   // the low side holds the dirt
        ctx.fillRect(x + dx + 1, y + bh - 3, bw - 2, 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
const cobbleTex = makeCobbleTexture();
const streetMat = new THREE.MeshLambertMaterial({ map: cobbleTex, color: 0xfff6e2 });

function scaleUV(geo, ru, rv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
}

// One strip of paving, laid flat and moved into place. Every strip goes
// into a single merged mesh, so the whole street grid is one draw call.
const streetGeos = [];
function streetPlane(len, wide, cx, y, cz, { alongX = true, rotY = 0 } = {}) {
  const geo = alongX ? new THREE.PlaneGeometry(len, wide) : new THREE.PlaneGeometry(wide, len);
  scaleUV(geo, (alongX ? len : wide) / 3.2, (alongX ? wide : len) / 3.2);
  geo.rotateX(-Math.PI / 2);
  if (rotY) geo.rotateY(rotY);
  geo.translate(cx, y, cz);
  streetGeos.push(geo);
}

// Split the span [a, b] of a road whose centre line sits at `line` on the
// other axis around every STREET_CUTS rect that straddles that line; stubs
// shorter than three units are dropped rather than left as slivers.
function cutSpan(a, b, line, alongX) {
  let spans = [[a, b]];
  for (const c of STREET_CUTS) {
    const [l0, l1, s0, s1] = alongX ? [c.z0, c.z1, c.x0, c.x1] : [c.x0, c.x1, c.z0, c.z1];
    if (line < l0 || line > l1) continue;
    spans = subtractSpan(spans, s0, s1);
  }
  return spans.filter(([p, q]) => q - p >= 3);
}

// Take the interval [s0, s1] out of a list of [p, q] spans.
function subtractSpan(spans, s0, s1) {
  const next = [];
  for (const [p, q] of spans) {
    if (s1 <= p || s0 >= q) { next.push([p, q]); continue; }
    if (s0 > p) next.push([p, s0]);
    if (s1 < q) next.push([s1, q]);
  }
  return next;
}

const STREET_HALF = 1.1, AVENUE_HALF = 1.4; // half-widths of the roadways
const WALK_W = 0.95;                         // a sidewalk's width
const STREET_WALK = 1.62, AVENUE_WALK = 1.92; // sidewalk centre lines, from the road's
const streetSegs = []; // east-west: { z, x0, x1 }
const aveSegs = [];    // north-south: { x, z0, z1 }
function addStreet(z, x0, x1) {
  streetPlane(x1 - x0, STREET_HALF * 2, (x0 + x1) / 2, 0.06, z);
  streetSegs.push({ z, x0, x1 });
}
function addAvenue(x, z0, z1) {
  streetPlane(z1 - z0, AVENUE_HALF * 2, x, 0.05, (z0 + z1) / 2, { alongX: false });
  aveSegs.push({ x, z0, z1 });
}
for (const z of STREETS) {
  let xmin = Infinity, xmax = -Infinity;
  for (let x = -45; x <= 45; x += 0.5) {
    if (pointInPoly(x, z)) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
  }
  if (xmax - xmin > 6) {
    for (const [x0, x1] of cutSpan(xmin + 1, xmax - 1, z, true)) addStreet(z, x0, x1);
  }
}
for (const x of AVENUES) {
  let zmin = Infinity, zmax = -Infinity;
  for (let z = -111; z <= 13; z += 0.5) {
    if (pointInPoly(x, z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
  }
  if (zmax - zmin > 6) {
    for (const [z0, z1] of cutSpan(zmin + 1, zmax - 1, x, false)) addAvenue(x, z0, z1);
  }
}
// Third Avenue itself, under the El: the pillars stand in the roadway.
addAvenue(EL_X, -108, -1);

// Bluestone sidewalks flanking every paved street and avenue. They stop at
// each crossing: a street's sidewalk runs up to the avenue's kerb and turns
// the corner there, and the avenue's picks up again on the far side of the
// street — so the roadway is clear through every intersection.
{
  const [cv, ctx] = canvas2d(64, 64);
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
  walkTex.anisotropy = 4;
  const geos = [];
  function walkStrip(a, b, cx, cz, alongX) {
    const len = b - a;
    if (len < 0.3) return;
    const geo = new THREE.PlaneGeometry(alongX ? len : WALK_W, alongX ? WALK_W : len);
    scaleUV(geo, (alongX ? len : WALK_W) / 1.9, (alongX ? WALK_W : len) / 1.9);
    geo.rotateX(-Math.PI / 2);
    geo.translate(alongX ? (a + b) / 2 : cx, 0.085, alongX ? cz : (a + b) / 2);
    geos.push(geo);
  }
  const streetReach = STREET_WALK + WALK_W / 2; // a street and its sidewalks, from the centre line
  for (const s of streetSegs) {
    let spans = [[s.x0, s.x1]];
    for (const a of aveSegs) {
      if (s.z >= a.z0 - streetReach && s.z <= a.z1 + streetReach) spans = subtractSpan(spans, a.x - AVENUE_HALF, a.x + AVENUE_HALF);
    }
    for (const [p, q] of spans) {
      walkStrip(p, q, 0, s.z - STREET_WALK, true);
      walkStrip(p, q, 0, s.z + STREET_WALK, true);
    }
  }
  for (const a of aveSegs) {
    for (const side of [-AVENUE_WALK, AVENUE_WALK]) {
      const x = a.x + side;
      let spans = [[a.z0, a.z1]];
      for (const s of streetSegs) {
        if (x >= s.x0 && x <= s.x1) spans = subtractSpan(spans, s.z - streetReach, s.z + streetReach);
      }
      for (const [p, q] of spans) walkStrip(p, q, x, 0, false);
    }
  }
  // Third Avenue sits a few paces from its neighbours on either hand; the
  // slivers left between their sidewalks are flagged over, so the El stands
  // on one broad pavement instead of over strips of bare ground.
  {
    const el = aveSegs[aveSegs.length - 1];
    const inner = AVENUE_WALK + WALK_W / 2;
    for (const a of aveSegs) {
      const gap = Math.abs(a.x - el.x) - 2 * inner;
      if (a === el || gap <= 0 || gap > 3) continue;
      const mx = (a.x + el.x) / 2;
      let spans = [[Math.max(a.z0, el.z0), Math.min(a.z1, el.z1)]];
      for (const st of streetSegs) { // the cross streets still run through
        if (mx >= st.x0 && mx <= st.x1) spans = subtractSpan(spans, st.z - STREET_HALF, st.z + STREET_HALF);
      }
      for (const [z0, z1] of spans) {
        const geo = new THREE.PlaneGeometry(gap + 0.1, z1 - z0);
        scaleUV(geo, (gap + 0.1) / 1.9, (z1 - z0) / 1.9);
        geo.rotateX(-Math.PI / 2);
        geo.translate(mx, 0.08, (z0 + z1) / 2);
        geos.push(geo);
      }
    }
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
    streetPlane(Math.hypot(bx - ax, bz - az), 2.4, (ax + bx) / 2, 0.07, (az + bz) / 2, { rotY: -Math.atan2(bz - az, bx - ax) });
  }
}
{
  const mesh = new THREE.Mesh(mergeGeometries(streetGeos, false), streetMat);
  mesh.receiveShadow = true;
  scene.add(mesh);
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
  const [cv, ctx] = canvas2d(CW, CH);
  const [bv, btx] = canvas2d(CW, CH); // bump/height map
  const [rv, rtx] = canvas2d(CW, CH); // G = roughness, B = metalness

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
  // the last two are reserved for landmarks: Stanford White's yellow brick
  // and the white marble of the hotel and City Hall
  { style: 'brick', wall: '#c8a583', joint: 'rgba(0,0,0,0.11)', trim: '#e4d3b2' },
  { style: 'stone', wall: '#d9d2c0', joint: 'rgba(0,0,0,0.09)', trim: '#c9c1ad' },
];
const ROW_FACADES = 5; // how many of the FACADES the ordinary streets draw from
// masonry PBR setup shared by the facades and the ground floors
function masonryMat({ map, bump, rough }) {
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
const facadeMats = FACADES.map((p) => masonryMat(makeFacadeMaps(p)));

// Ground floors: paneled doors for the rowhouses, glazed shopfronts with
// painted sign-boards for the commercial streets.
function makeGroundMaps(kind) {
  const CW = 512, CH = 160;
  const [cv, ctx] = canvas2d(CW, CH);
  const [bv, btx] = canvas2d(CW, CH);
  btx.fillStyle = '#7f7f7f';
  btx.fillRect(0, 0, CW, CH);
  const [rv, rtx] = canvas2d(CW, CH); // G = roughness, B = metalness
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
  return { map, bump, rough };
}
const groundMats = { row: masonryMat(makeGroundMaps('row')), shop: masonryMat(makeGroundMaps('shop')) };
const groundGeos = { row: [], shop: [] };

// striped canvas awnings
function makeAwningMat(c1, c2) {
  const [cv, ctx] = canvas2d(64, 64);
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
const ROOF_TONES = [0x57514a, 0x7f7466, 0x6b6a66]; // tar, tin, slate
const roofGeos = ROOF_TONES.map(() => []);

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
  // heavy Italianate cornice, and above it the roof itself — tar, tin or
  // slate — so the city reads as a roofscape from the chart
  const cornice = new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4);
  cornice.translate(x, h + 0.1, z);
  trimGeos.push(cornice);
  const roof = new THREE.BoxGeometry(w - 0.2, 0.16, d - 0.2);
  roof.translate(x, h + 0.45, z);
  roofGeos[Math.floor(Math.random() * roofGeos.length)].push(roof);
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
    const sx = x + (Math.random() - 0.5) * (w - 1.4), sz = z + (d / 2 + 0.42) * (stoop === 'north' ? -1 : 1);
    st.translate(sx, 0.3, sz);
    trimGeos.push(st);
    addCollider(sx, sz, 1.1, 0.9, 0.05); // it reaches out past the housefront's own collider
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
        const pi = Math.floor(Math.random() * ROW_FACADES);
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
  const pi = Math.random() < 0.3 ? 3 : Math.floor(Math.random() * ROW_FACADES);
  addBuilding(x, z, w, d, floors, pi, { ground: Math.random() < 0.65 ? 'shop' : 'row' });
}

// A windowed landmark block: the facade texture on the upper floors and,
// optionally, a shopfront or rowhouse ground floor. Both meshes occlude the
// camera; the upper one is returned so callers can hang ornament off it.
function landmarkBox(w, floors, d, pi, x, z, { ground = null, yBase = 0 } = {}) {
  const baysW = Math.max(1, Math.round(w / BAY_W));
  const baysD = Math.max(1, Math.round(d / BAY_W));
  let y = yBase, upper = floors;
  if (ground) {
    const g = uvBox(new THREE.BoxGeometry(w, FLOOR_H, d), baysW, baysD, TEX_FLOORS);
    g.translate(x, y + FLOOR_H / 2, z);
    const gm = new THREE.Mesh(g, groundMats[ground]);
    gm.castShadow = gm.receiveShadow = true;
    scene.add(gm);
    occluders.push(gm);
    y += FLOOR_H;
    upper -= 1;
  }
  const m = new THREE.Mesh(facadeBox(x, z, w, d, upper, y), facadeMats[pi]);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  occluders.push(m);
  return m;
}

// Trinity Church (its spire ruled the skyline until 1890).
{
  const tx = -15, tz = 40;
  const brownstone = 0x6b5240;
  const nave = box(4, 9, 6.5, brownstone, tx, 4.5, tz + 1.5);
  nave.castShadow = true;
  const towerT = box(2.6, 17, 2.6, brownstone, tx, 8.5, tz - 2.6);
  towerT.castShadow = true;
  const spireT = new THREE.Mesh(new THREE.ConeGeometry(1.9, 9, 8), lambert(brownstone));
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
const chartLabelsEl = document.getElementById('chart-labels');
// `range` is how far away the name fades in on foot — harbor landmarks
// are visible from the Battery, so theirs reach across the water.
// On foot the name is a sprite in the scene. From the chart's altitude a
// sprite would be shrunk so far that its mipmaps blur the ink into the
// halo, so there each name is set as HTML type pinned over its landmark.
function landmarkLabel(text, x, y, z, range = 34, chart = {}) {
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
  const draw = () => {
    ctx.clearRect(0, 0, w, 160);
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
  };
  draw();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  labelRedraws.push({ tex, draw });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 5;
  sprite.position.set(x, y, z);
  const sh = 2.03, sw = sh * (w / 160);
  sprite.scale.set(sw, sh, 1);
  scene.add(sprite);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'chart-label';
  el.textContent = text;
  chartLabelsEl.appendChild(el);
  // chart.dx / chart.dz nudge the label in chart view so the downtown
  // cluster does not pile up; on foot every label sits over its landmark.
  // elW is the HTML label's width, measured the first time the chart shows.
  landmarkLabels.push({ sprite, el, elW: 0, x, y, z, range, cdx: chart.dx || 0, cdz: chart.dz || 0 });
  return { sprite, el };
}

// Every landmark is tappable — in the street or from the chart — and
// opens a short history card. The label (sprite or chart type) and an
// invisible volume around the structure all catch the tap.
const tapTargets = [];
function landmarkInfo(name, year, blurb, x, z, labelY, { range = 34, w = 8, h = 0, d = 8, chart = {} } = {}) {
  const { sprite, el } = landmarkLabel(year ? `${name} · ${year}` : name, x, labelY, z, range, chart);
  const info = { name, year, blurb };
  sprite.userData.landmark = info;
  tapTargets.push(sprite);
  el.addEventListener('click', () => { if (!state.modal) openLandmarkCard(info); });
  releasePointerFocus(el);
  const hitH = h || labelY;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w, hitH, d), new THREE.MeshBasicMaterial());
  hit.visible = false; // never drawn; the raycaster still finds hidden meshes
  hit.position.set(x, hitH / 2, z);
  hit.userData.landmark = info;
  scene.add(hit);
  tapTargets.push(hit);
}

// The Statue of Liberty (1886) — five years old, her copper still brown.
{
  const lx = LIBERTY.x, lz = LIBERTY.z;
  landSlab(OUTER_LAND.bedloes, 1.6, -0.8); // Bedloe's Island, its top level with the Battery's: it is walked on
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
  roundColliders.push({ x: lx, z: lz, r: 6.4 }); // the walk goes round the ramparts
  parkGreen(new THREE.CircleGeometry(8.3, 28), lx, lz); // on a collar of lawn
  // stepped granite pedestal
  box(5.4, 1.3, 5.4, 0xa89c85, lx, 2.85, lz);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 7.6, 4), lambert(0xb9ad97));
  ped.rotation.y = Math.PI / 4;
  ped.position.set(lx, 7.3, lz);
  ped.castShadow = true;
  scene.add(ped);
  occluders.push(star, ped);
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
  landSlab(OUTER_LAND.governors, 1.6, -0.6);
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
  // its lawn lies between the hall's front and Wall Street, short of
  // Federal Hall's steps on the far side of the street
  parkGreen(new THREE.CircleGeometry(2.2, 20).scale(2.3, 1, 1), 3, 46.6);
  tree(0.4, 46.4, 0.8);
  tree(6, 46.9, 0.9);
  landmarkBox(10, 3, 6, 6, 2, 52); // marble, three tall storeys
  box(10.6, 0.6, 6.6, 0xc7bda5, 2, 9.3, 52);
  box(3.6, 3, 3.6, 0xded6c2, 2, 10.8, 52); // attic pavilion
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2.2, 10), lambert(0xd5ccb6));
  drum.position.set(2, 13.4, 52);
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xb3a479));
  cupola.position.set(2, 14.5, 52);
  scene.add(drum, cupola);
  addCollider(2, 52, 10, 6);
  landmarkInfo('City Hall', 1812,
    `The marble French-Renaissance City Hall opened in 1812, seven years
     before Melville was born downtown by the Battery, on Pearl Street. In 1865
     Lincoln lay in state under its rotunda while the city he had carried
     filed past.`,
    2, 52, 18, { w: 10, h: 16, d: 6 });
}

// Federal Hall (1842), Washington's statue (1883) on its steps.
{
  const fx = -2, fz = 37.2; // the foot of its steps meets Wall Street's kerb
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
  addCollider(fx, fz + 3.9, 8.4, 2.2, 0.3); // the steps, and Washington on them
  occluders.push(cella);
  landmarkInfo('Federal Hall', 1842,
    `On this Wall Street corner Washington took the first presidential oath
     in 1789; J. Q. A. Ward's bronze of him was set on the steps in 1883.
     The Greek Revival building itself served as the Custom House until
     1862 — the very service in which Melville later spent nineteen years —
     and then as the Sub-Treasury, its vaults full of gold.`,
    fx, fz, 12, { w: 8.4, h: 9.5, d: 7, chart: { dz: 2 } });
}

// The Tribune Building (1875) — tall brick, clock tower over Park Row.
{
  const tx = 12.5, tz = 44;
  landmarkBox(5, 6, 5, 1, tx, tz, { ground: 'shop' }); // red brick, six storeys
  box(5.5, 0.6, 5.5, 0x5e3026, tx, 18.3, tz);
  landmarkBox(2.8, 2, 2.8, 1, tx, tz, { yBase: 18.6 }); // the clock tower
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), new THREE.MeshBasicMaterial({ color: 0xefe6d0 }));
  clock.position.set(tx, 23.8, tz + 1.42);
  scene.add(clock);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 4), lambert(0x4a3a30));
  cap.rotation.y = Math.PI / 4;
  cap.position.set(tx, 26.2, tz);
  cap.castShadow = true;
  scene.add(cap);
  addCollider(tx, tz, 5, 5);
  landmarkInfo('Tribune Building', 1875,
    `Richard Morris Hunt's brick clock tower for Horace Greeley's New-York
     Tribune was one of the first elevator towers in the world — at 260 feet
     it loomed over Newspaper Row, where every great daily watched City Hall
     across the park.`,
    tx, tz, 31, { w: 5.5, h: 29, d: 5.5, chart: { dx: 8 } });
}

// The Western Union Telegraph Building (1875) on lower Broadway.
{
  const wx = -1.5, wz = 57;
  landmarkBox(5.5, 5, 5, 4, wx, wz, { ground: 'shop' }); // granite, five storeys
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
  landmarkInfo('Western Union Building', 1875,
    `George B. Post's ten-storey telegraph palace on Broadway was, with the
     Tribune, the city's first true skyscraper. Every day at noon a time-ball
     dropped from its mast so the harbor's ships — and the customs men on
     the piers — could set their chronometers.`,
    wx, wz, 24.5, { w: 6, h: 22, d: 5.5, chart: { dx: -6, dz: 4 } });
}

// Cooper Union (1859), in whose Great Hall Lincoln spoke in 1860.
{
  const cx = 19, cz = -4;
  landmarkBox(6, 4, 8, 0, cx, cz); // brownstone, four storeys
  box(6.5, 0.7, 8.5, 0x52382b, cx, 12.35, cz);
  for (let i = -1; i <= 1; i++) { // round-arched bays hinted with piers
    box(0.6, 11.5, 0.35, 0x7d5a46, cx + i * 2, 5.75, cz + 4.05, scene, false);
  }
  addCollider(cx, cz, 6, 8);
  landmarkInfo('Cooper Union', 1859,
    `Peter Cooper's free college of art and science, brownstone over an
     iron frame. In its Great Hall in February 1860 an Illinois lawyer named
     Lincoln gave the speech — “right makes might” — that carried him toward
     the presidency.`,
    cx, cz, 16.5, { w: 6.5, h: 13.5, d: 8.5 });
}

// Union Square (1839), with the equestrian Washington of 1856.
{
  parkGreen(new THREE.PlaneGeometry(16, 5.6), -2, -40); // fills its block; 14th and 17th run past
  for (let i = 0; i < 7; i++) {
    const tx2 = -9 + Math.random() * 14, tz2 = -42.4 + Math.random() * 4.8;
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
  landmarkBox(7, 5, 5.5, 6, hx, hz, { ground: 'shop' }); // white marble over an arcaded base
  box(7.5, 0.7, 6, 0xcdc4ab, hx, 15.35, hz);
  box(7.1, 0.4, 5.7, 0xb9ad97, hx, 3.2, hz);   // beltcourse
  const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), lambert(0x33302c));
  flag.position.set(hx + 2.6, 17.2, hz + 1.8);
  scene.add(flag);
  addCollider(hx, hz, 7, 5.5);
  landmarkInfo('Fifth Avenue Hotel', 1859,
    `Amos Eno's white-marble palace on Madison Square — mocked as “Eno's
     Folly,” then the most celebrated hotel in America, with the first
     passenger elevator in any hotel. Princes, presidents, and the
     Republican bosses of the Gilded Age held court a block from Melville's
     front door.`,
    hx, hz, 20, { w: 7.5, h: 17, d: 6, chart: { dx: -6 } });
}

// Info for the landmarks that were already on the island.
landmarkInfo('Trinity Church', 1846,
  `Richard Upjohn's brownstone Gothic spire was the tallest thing in New
   York for most of Melville's life — mariners steered by it, and its bells
   rang over Wall Street. Alexander Hamilton lies in its churchyard.`,
  -15, 40, 28, { w: 7, h: 26, d: 12, chart: { dx: -4 } });
landmarkInfo('Brooklyn Bridge', 1883,
  `The Roeblings' “eighth wonder” opened in May 1883, its towers taller
   than anything but Trinity's spire. The old sailor saw the age of sail
   framed in steel cable — ships passed beneath a roadway in the sky.`,
  40, 51, 27, { w: 44, h: 24, d: 10 });
landmarkInfo('Castle Garden', null,
  `Built as a fort before the War of 1812, then the concert hall where all
   New York heard Jenny Lind in 1850, and from 1855 to 1890 the landing
   depot where eight million immigrants first touched America.`,
  CASTLE_GARDEN.x, CASTLE_GARDEN.z, 9.5, { w: 9, h: 7, d: 9 });
landmarkInfo('Madison Square Garden', 1890,
  `Stanford White's colossal amphitheater of yellow brick and terra cotta
   opened in 1890, its arcaded tower the second-tallest thing in the city.
   Saint-Gaudens's gilded Diana was hoisted to its top in 1891 — see site
   No. 5 for her story.`,
  2, -84, 41, { w: 14, h: 37, d: 12 });
landmarkInfo('The World Building', 1890,
  `Joseph Pulitzer's gold-domed tower on Park Row — at 309 feet the
   tallest building in New York when it opened in 1890, the year before
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
roofGeos.forEach((geos, i) => {
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), lambert(ROOF_TONES[i]));
  mesh.receiveShadow = true;
  scene.add(mesh);
});

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
    addCollider(lx, lz, 0.2, 0.2, 0.14);
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
    // along the kerb: the housefronts' colliders reach out over the
    // sidewalk itself, and a figure set walking there is stopped at the
    // first wall and never gets anywhere
    const lane = Math.random() < 0.5 ? -1.15 : 1.15;
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

// a lawn: any flat geometry laid down in park green
function parkGreen(geo, x, z) {
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, lambert(COLORS.park));
  m.receiveShadow = true;
  m.position.set(x, 0.1, z);
  scene.add(m);
}

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
  addCollider(x, z, 0.4 * s, 0.4 * s, 0.25);
}

// Madison Square Park
{
  parkGreen(new THREE.PlaneGeometry(19.4, 10.4), -0.8, -74.3); // 23rd to 26th, over the cut street
  for (let i = 0; i < 11; i++) {
    const tx = -9.5 + Math.random() * 17.5;
    const tz = -78.6 + Math.random() * 8.6;
    if (Math.hypot(tx - (-4), tz - (-73)) > 3.2) tree(tx, tz, 0.8 + Math.random() * 0.5);
  }
}
// Battery green
{
  parkGreen(new THREE.CircleGeometry(7, 20), -2, 88);
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 4;
    const tx = -2 + Math.cos(a) * r, tz = 88 + Math.sin(a) * r;
    // not on the birthplace marker, nor on the landing, nor anywhere between
    // the opening camera and the statue it is looking at
    const inShot = distToSegment(tx, tz, OPENING_CAM.x, OPENING_CAM.z, LIBERTY.x, LIBERTY.z) < 3;
    if (Math.hypot(tx - 2, tz - 82) > 3 && tz < 92.4 && !inShot) tree(tx, tz, 0.7 + Math.random() * 0.5);
  }
}
// Castle Garden
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 5, 14), lambert(COLORS.stone));
  m.position.set(CASTLE_GARDEN.x, 2.5, CASTLE_GARDEN.z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  roundColliders.push({ x: CASTLE_GARDEN.x, z: CASTLE_GARDEN.z, r: 5 });
  occluders.push(m);
}

/* ---------------- landmarks ---------------- */

// Melville's house, 104 E 26th St — brick row house on the north side of
// the street, its stoop stepping down onto the sidewalk.
{
  const hx = 18, hz = -88.5;
  landmarkBox(4.4, 3, 5, 1, hx, hz, { ground: 'row' }); // three storeys of red brick
  addCollider(hx, hz, 4.4, 5);
  box(4.9, 0.6, 5.5, 0x6e4a3a, hx, 9.25, hz); // cornice
  box(1.2, 2.6, 0.3, 0x274029, hx - 1.1, 1.5, hz + 2.55); // green door
  box(2.4, 0.6, 0.7, 0xb5a98c, hx - 1.1, 0.3, hz + 3.05); // high stoop
  addCollider(hx - 1.1, hz + 3.05, 2.4, 0.7, 0.05);
}

// Madison Square Garden (1890) with its tower and the gilded Diana.
let diana;
{
  landmarkBox(17, 4, 9.5, 5, -4, -86.5); // yellow brick and terra cotta
  addCollider(-4, -86.5, 17, 9.5);
  box(17.6, 0.8, 10.1, 0xa9886a, -4, 12.4, -86.5);
  landmarkBox(4.6, 10, 4.6, 5, 2, -84); // the tower
  addCollider(2, -84, 4.6, 4.6);
  box(3.4, 3.2, 3.4, 0xb59478, 2, 31.6, -84); // loggia
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3, 8), lambert(0xa9886a));
  cap.position.set(2, 34.8, -84);
  cap.castShadow = true;
  scene.add(cap);
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
// The train shuttles between the two ends of the line: it brakes into each
// terminus, stands a moment, and pulls out again behind its whistle.
let train, trainDir = -1, trainWay = 1, trainHalt = 0;
const TRAIN_NORTH = -99.3, TRAIN_SOUTH = -9.7, TRAIN_SPEED = 9, TRAIN_STAND = 3.5;
{
  const trackLen = 109;
  const bed = box(4, 0.6, trackLen, COLORS.iron, EL_X, 6.3, -54.5);
  bed.castShadow = true;
  for (let z = -108; z <= 0; z += 10) {
    box(0.7, 6, 0.7, COLORS.iron, EL_X, 3, z);
    box(4.4, 0.5, 0.7, COLORS.iron, EL_X, 5.85, z);
    addCollider(EL_X, z, 0.7, 0.7, 0.3);
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
  addCollider(EL_X - 6.4, -55.2, 3.6, 1.8, 0.3); // the foot of the stair
  // train: a tank locomotive and two cars, centred on the group's origin
  // so that turning it end for end at a terminus leaves it where it stood
  train = new THREE.Group();
  const loco = box(2, 2.2, 4.2, 0x3a352e, 0, 7.6, 7.1, train);
  loco.castShadow = true;
  box(2.1, 0.9, 1.5, 0x2e2a25, 0, 9.1, 5.7, train);   // cab roof, over the footplate
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.3, 8), lambert(0x26221d));
  stack.position.set(0, 9.3, 8.3);
  train.add(stack);
  for (const off of [0, -6.8]) {
    const car = box(2, 2.5, 5.8, COLORS.trainGreen, 0, 7.8, 0.5 + off, train);
    car.castShadow = true;
    box(2.04, 0.7, 5.2, 0x2b3038, 0, 8.25, 0.5 + off, train, false); // the window band
    box(2.3, 0.3, 6.1, 0xd8cdb2, 0, 9.2, 0.5 + off, train);
  }
  train.position.set(EL_X, 0, -20);
  train.rotation.y = Math.PI; // setting out northward
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

function pier(cx, cz, alongX = true, len = 18, wide = 6) {
  const deck = box(alongX ? len : wide, 0.3, alongX ? wide : len, COLORS.wood, cx, -0.03, cz);
  deck.castShadow = true;
  const n = Math.max(2, Math.round(len / 4.5) + 1); // a pair of piles every few paces
  const along = len / 2 - 1, across = wide / 2 - 0.5;
  for (let i = 0; i < n; i++) {
    const t = (-1 + (2 * i) / (n - 1)) * along;
    for (const side of [-across, across]) {
      box(0.5, 1.6, 0.5, COLORS.woodDark, cx + (alongX ? t : side), -0.6, cz + (alongX ? side : t), scene, false);
    }
  }
}

function barrels(cx, cz) {
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 8), lambert(0x7a5c3e));
    b.position.set(cx + Math.random() * 1.6 - 0.8, 0.57, cz + Math.random() * 1.6 - 0.8);
    b.castShadow = true;
    scene.add(b);
    addCollider(b.position.x, b.position.z, 1, 1, 0.15);
  }
}

// Gansevoort Street pier (Hudson) with the wooden customs office.
pier(-49, -12);
{
  const office = box(3.6, 2.8, 3, 0xa8a092, -53.5, 1.5, -12);
  office.castShadow = true;
  box(4, 0.4, 3.4, 0x6e6457, -53.5, 3.05, -12);
  addCollider(-53.5, -12, 3.6, 3, 0.3); // leaves a walk down either side to the pier's end
  barrels(-45, -10.5);
}
// East River pier
pier(49, -95);
barrels(45, -93.5);
// The landing stages of the boat to the statue: one running out from the
// tip of the Battery, one on the near side of Bedloe's Island.
pier(-1, 98.5, false, 10, 4);
pier(-32.4, 104, true, 4.7, 4);

const bobbers = []; // things that ride the water

// A hull seen from above: full in the belly, drawn to a sharp stem and
// narrowed at the transom. `stern` is the transom's width as a fraction of
// the beam; the bow points toward +z. Drawn into a Shape or a Path, so the
// same outline serves for hulls, decks, and the hole in a bulwark.
function hullOutline(path, beam, len, stern) {
  const h = beam / 2, a = -len / 2, b = len / 2;
  path.moveTo(-h * stern, a);
  path.lineTo(h * stern, a);
  path.bezierCurveTo(h * 1.02, a + len * 0.12, h, a + len * 0.3, h, a + len * 0.45);
  path.bezierCurveTo(h, a + len * 0.72, h * 0.55, b - len * 0.1, 0, b);
  path.bezierCurveTo(-h * 0.55, b - len * 0.1, -h, a + len * 0.72, -h, a + len * 0.45);
  path.bezierCurveTo(-h, a + len * 0.3, -h * 1.02, a + len * 0.12, -h * stern, a);
  return path;
}

// A slab in the shape of a hull, its top face at `top`; with `wall` it is
// only the rim, that thick — a bulwark around the deck.
function hullSlab(beam, len, stern, depth, top, color, parent, wall = 0) {
  const shape = hullOutline(new THREE.Shape(), beam, len, stern);
  if (wall) shape.holes.push(hullOutline(new THREE.Path(), beam - wall * 2, len - wall * 2.4, stern));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 });
  geo.rotateX(Math.PI / 2); // shape (x, y) -> (x, z); the slab hangs down from y = 0
  const m = new THREE.Mesh(geo, lambert(color));
  m.position.y = top;
  m.castShadow = true;
  parent.add(m);
  return m;
}

// The hull common to every ship: a dark body, a buff strake along the
// rail, and a holystoned deck inside it. Returns the deck's height.
function shipHull(g, beam, len, stern, hullColor) {
  hullSlab(beam, len, stern, 1.6, 1.3, hullColor, g);
  hullSlab(beam + 0.14, len + 0.16, stern, 0.4, 1.62, 0xcdbf9d, g, 0.2); // the rail
  hullSlab(beam - 0.3, len - 0.4, stern, 0.06, 1.36, 0xa89069, g).castShadow = false; // the deck
  return 1.36;
}

const sailMat = new THREE.MeshLambertMaterial({ color: COLORS.sailcloth, side: THREE.DoubleSide });
// A square sail bellied forward by the wind, hung from its yard.
function squareSail(g, w, h, y, z, belly) {
  const geo = new THREE.PlaneGeometry(w, h, 4, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2);          // -1..1 across the sail
    const drop = 0.5 - pos.getY(i) / h;       // 0 at the yard, 1 at the foot
    // pinned along the yard and at both leeches, fullest two-thirds of the way down
    pos.setZ(i, belly * (1 - u * u) * Math.sin(drop * Math.PI * 0.75));
  }
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(geo, sailMat);
  sail.position.set(0, y, z);
  sail.castShadow = true;
  g.add(sail);
}

// a flat piece of canvas between any corners — jibs, spankers, pennants
function canvasPanel(g, pts, mat = sailMat) {
  const geo = new THREE.BufferGeometry();
  const v = [];
  for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
}
const pennantMat = new THREE.MeshLambertMaterial({ color: COLORS.red, side: THREE.DoubleSide });

// A brig: two square-rigged masts, a jib on the bowsprit, a spanker aft.
// Under way she carries everything; moored at a pier her canvas is furled
// along the yards.
function sailShip(x, z, scale = 1, rotY = 0, { furled = false } = {}) {
  const g = new THREE.Group();
  const deck = shipHull(g, 3.2, 14, 0.62, 0x3f362d);
  g.children.forEach((m) => { m.position.z = 0.8; }); // the stem reaches forward of the masts
  box(2.2, 0.85, 2.6, 0x5d5043, 0, deck + 0.42, -4.3, g); // stern cabin
  box(2.4, 0.1, 2.8, 0x8a7b62, 0, deck + 0.9, -4.3, g);
  const v3 = (px, py, pz) => new THREE.Vector3(px, py, pz);
  const spar = (p1, p2, r) => { cylBetween(p1, p2, r, COLORS.woodDark, g).castShadow = true; };
  const line = (p1, p2) => cylBetween(p1, p2, 0.03, COLORS.ink, g); // standing rigging
  const top = deck + 10.4;
  spar(v3(0, 1.75, 7.6), v3(0, 2.9, 11.4), 0.1); // bowsprit
  for (const mz of [3.1, -1.5]) {
    spar(v3(0, deck, mz), v3(0, top, mz), 0.14);
    // course, topsail, topgallant: [yard height, width, drop]
    for (const [sy, w, h] of [[deck + 4.5, 4.4, 2.7], [deck + 7.1, 3.6, 2.3], [deck + 9.3, 2.8, 1.8]]) {
      spar(v3(-w / 2 - 0.2, sy, mz + 0.16), v3(w / 2 + 0.2, sy, mz + 0.16), 0.07); // the yard
      if (furled) {
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, w, 6).rotateZ(Math.PI / 2), sailMat);
        roll.position.set(0, sy - 0.17, mz + 0.2);
        g.add(roll);
      } else {
        squareSail(g, w, h, sy - h / 2 - 0.08, mz + 0.2, 0.55);
      }
    }
    line(v3(1.5, deck + 0.3, mz - 0.9), v3(0, top - 1.2, mz)); // shrouds
    line(v3(-1.5, deck + 0.3, mz - 0.9), v3(0, top - 1.2, mz));
  }
  line(v3(0, 2.85, 11.2), v3(0, top - 0.6, 3.1));   // forestay
  line(v3(0, top - 0.3, 3.1), v3(0, top - 0.3, -1.5)); // triatic stay, masthead to masthead
  if (!furled) {
    canvasPanel(g, [[0, 2.75, 10.6], [0, deck + 6.2, 4.4], [0, deck + 1.6, 5.2]]);                        // jib
    canvasPanel(g, [[0, deck + 1.3, -1.9], [0, deck + 5.6, -1.9], [0, deck + 5.0, -5.2], [0, deck + 1.3, -5.9]]); // spanker
  }
  canvasPanel(g, [[0, top + 0.05, -1.5], [0, top - 0.45, -1.5], [0, top - 0.2, -3.1]], pennantMat);
  g.position.set(x, 0, z);
  g.rotation.order = 'YXZ'; // heading first, so pitch and roll stay in the hull's frame
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  g.userData.stern = -6.2; // where the wake starts, in local units
  scene.add(g);
  bobbers.push({ obj: g, half: 6 * scale, beam: 1.5 * scale });
  return g;
}

// A side-wheel steamer of the harbor: black hull, white house, paddle
// boxes amidships, and a tall banded funnel.
function steamShip(x, z, rotY = 0) {
  const g = new THREE.Group();
  const deck = shipHull(g, 3.6, 15, 0.74, 0x2f2d2a);
  const cabin = box(2.5, 1.3, 7, 0xe5dcc4, 0, deck + 0.65, -0.4, g);
  cabin.castShadow = true;
  box(2.54, 0.42, 6.4, 0x3a4046, 0, deck + 0.8, -0.4, g, false);  // a band of cabin windows
  box(3, 0.12, 7.6, 0xcabfa6, 0, deck + 1.36, -0.4, g);           // the hurricane deck
  box(1.5, 0.95, 1.5, 0xe5dcc4, 0, deck + 1.9, 2.1, g);           // pilot house
  box(1.54, 0.3, 1.54, 0x3a4046, 0, deck + 2.0, 2.1, g, false);
  box(1.8, 0.1, 1.8, 0xcabfa6, 0, deck + 2.42, 2.1, g);
  for (const side of [-1, 1]) { // paddle boxes
    const pb = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 0.75, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2),
      lambert(0xd8cdb2)
    );
    pb.position.set(side * 2.0, deck - 0.25, -0.2);
    pb.castShadow = true;
    g.add(pb);
  }
  const funnelY = deck + 2.9, funnelZ = -1.2;
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 3, 10), lambert(0x26221d));
  stack.position.set(0, funnelY, funnelZ);
  stack.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.51, 0.5, 10), lambert(COLORS.red));
  band.position.set(0, funnelY + 0.8, funnelZ);
  g.add(stack, band);
  cylBetween(new THREE.Vector3(0, deck, 5.2), new THREE.Vector3(0, deck + 4.2, 5.2), 0.07, COLORS.woodDark, g); // jackstaff
  canvasPanel(g, [[0, deck + 4.15, 5.2], [0, deck + 3.6, 5.2], [0, deck + 3.87, 4.0]], pennantMat);
  g.position.set(x, 0, z);
  g.rotation.order = 'YXZ';
  g.rotation.y = rotY;
  g.userData.stern = -7.4;
  g.userData.funnel = { y: funnelY + 1.55, z: funnelZ }; // where the smoke leaves
  scene.add(g);
  bobbers.push({ obj: g, half: 7, beam: 1.8 });
  return g;
}

sailShip(-53, -26.5, 0.9, 0, { furled: true });   // moored at the customs pier
sailShip(52.5, -85.8, 0.85, 0, { furled: true }); // moored at the East River pier
// Ships under way. Each works one reach of water between two marks `a`
// and `b` on one axis: she slows as she nears a mark, comes about, and
// stands back the way she came. The reaches are chosen to keep every hull
// in open water with room to swing. The steamers trail coal smoke.
function drifter(obj, axis, a, b, speed, smokes = false) {
  const dir = Math.sign(b - obj.position[axis]); // she sets out for `b`
  obj.rotation.y = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir * Math.PI / 2;
  return { obj, axis, a, b, speed, smokes, mark: b, way: 1, turn: 0, fromYaw: 0 };
}
const drifters = [
  drifter(sailShip(-62, 60, 1), 'z', 78, -150, 3.2),          // beating up the Hudson, past the customs pier
  drifter(steamShip(42.5, 40), 'z', 64, -22, 4, true),        // the East River boat, under the bridge and back
];
const COME_ABOUT = 9; // seconds to swing a hull end for end
function updateDrifters(dt) {
  for (const d of drifters) {
    const p = d.obj.position;
    if (d.turn > 0) {
      d.turn = Math.max(0, d.turn - dt / COME_ABOUT);
      d.obj.rotation.y = d.fromYaw + Math.PI * smoothstep01(1 - d.turn);
      d.way = 0;
      continue;
    }
    const left = Math.abs(d.mark - p[d.axis]);
    // she carries her way until the last few lengths, then loses it
    const goal = Math.min(1, 0.12 + left / 16);
    d.way += (goal - d.way) * Math.min(1, dt * (goal > d.way ? 0.45 : 3));
    const step = d.speed * d.way * dt;
    if (step < left) {
      p[d.axis] += Math.sign(d.mark - p[d.axis]) * step;
    } else { // at the mark: put the helm over
      p[d.axis] = d.mark;
      d.turn = 1;
      d.fromYaw = d.obj.rotation.y;
      d.mark = d.mark === d.b ? d.a : d.b;
    }
  }
}

// The boat to the Statue of Liberty: an open steam launch, built to the
// walker's own scale because he stands in her bow. She lies at whichever
// landing he is at, stern to the stage; boarding her starts the crossing,
// and once she has set him ashore she swings round to be ready to return.
const LAUNCH_DECK = 0.8;
function steamLaunch() {
  const g = new THREE.Group();
  hullSlab(2.6, 9, 0.7, 1.0, 0.75, 0x2f2d2a, g);
  hullSlab(2.74, 9.16, 0.7, 0.32, 0.97, 0xcdbf9d, g, 0.17);                       // the rail
  hullSlab(2.3, 8.6, 0.7, 0.06, LAUNCH_DECK, 0xa89069, g).castShadow = false;     // the deck
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), lambert(0x3a352e));
  boiler.position.set(0, LAUNCH_DECK + 0.5, 0.2);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8), lambert(0x26221d));
  funnel.position.set(0, LAUNCH_DECK + 2.25, 0.2);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.35, 8), lambert(COLORS.red));
  band.position.set(0, LAUNCH_DECK + 2.95, 0.2);
  boiler.castShadow = funnel.castShadow = true;
  g.add(boiler, funnel, band);
  box(2.3, 0.08, 3.6, 0xd8cdb2, 0, LAUNCH_DECK + 2.45, -2.5, g);                  // an awning over the benches aft
  for (const sx of [-1.05, 1.05]) {
    box(0.4, 0.3, 3.2, 0x8a6f4d, sx * 0.76, LAUNCH_DECK + 0.2, -2.5, g, false);
    for (const sz of [-4.2, -0.8]) {
      cylBetween(new THREE.Vector3(sx, LAUNCH_DECK, sz), new THREE.Vector3(sx, LAUNCH_DECK + 2.45, sz), 0.04, COLORS.woodDark, g);
    }
  }
  cylBetween(new THREE.Vector3(0, LAUNCH_DECK, 4), new THREE.Vector3(0, LAUNCH_DECK + 2.6, 4), 0.05, COLORS.woodDark, g); // jackstaff
  canvasPanel(g, [[0, LAUNCH_DECK + 2.55, 4], [0, LAUNCH_DECK + 2.05, 4], [0, LAUNCH_DECK + 2.3, 2.95]], pennantMat);
  g.rotation.order = 'YXZ';
  g.userData.stern = -4.6;
  g.userData.funnel = { y: LAUNCH_DECK + 3.55, z: 0.2 };
  scene.add(g);
  bobbers.push({ obj: g, half: 4.5, beam: 1.3 });
  return g;
}
const LAUNCH_CROSSING = 10; // seconds from one landing to the other
const LAUNCH_SWING = 6;     // and to swing her end for end afterwards
const launch = { obj: steamLaunch(), at: 'battery', dest: 'bedloes', phase: 'moored', u: 0, way: 0, fromYaw: 0, greeted: false };
{
  const [ax, az] = LANDINGS.battery.berth, [bx, bz] = LANDINGS.bedloes.berth;
  launch.obj.position.set(ax, 0, az);
  launch.obj.rotation.y = Math.atan2(bx - ax, bz - az); // bow toward the statue
}
function boardLaunch() {
  if (launch.phase !== 'moored' || state.modal) return;
  launch.phase = 'crossing';
  launch.dest = launch.at === 'battery' ? 'bedloes' : 'battery';
  launch.u = 0;
  state.riding = true;
  vel.x = vel.z = 0;
  audio.play('horn', { freq: 147, gain: 0.2, dur: 1.2 });
}
const _rider = new THREE.Vector3();
function updateLaunch(dt) {
  const L = launch;
  if (L.phase === 'crossing') {
    L.u = Math.min(1, L.u + dt / LAUNCH_CROSSING);
    const [fx, fz] = LANDINGS[L.at].berth, [tx, tz] = LANDINGS[L.dest].berth;
    const e = smoothstep01(L.u);
    L.obj.position.x = fx + (tx - fx) * e;
    L.obj.position.z = fz + (tz - fz) * e;
    L.way = Math.min(1, 6 * L.u * (1 - L.u)); // she gathers way, and loses it coming alongside
    if (L.u >= 1) { // alongside: the passenger steps onto the stage, and she swings
      L.at = L.dest;
      L.phase = 'swinging';
      L.u = 0;
      L.way = 0;
      L.fromYaw = L.obj.rotation.y;
      state.riding = false;
      const [sx, sz] = LANDINGS[L.at].ashore;
      player.position.set(sx, 0, sz);
      if (L.at === 'bedloes' && !L.greeted) {
        L.greeted = true;
        toast('Bedloe’s Island. Walk round the ramparts — tap the statue to read her story. The boat waits at the landing.', 6500);
      }
    }
  } else if (L.phase === 'swinging') {
    L.u = Math.min(1, L.u + dt / LAUNCH_SWING);
    L.obj.rotation.y = L.fromYaw + Math.PI * smoothstep01(L.u);
    if (L.u >= 1) L.phase = 'moored';
  }
  if (state.riding) { // he stands in the bow, and rides the swell with her
    L.obj.updateMatrixWorld();
    player.position.copy(L.obj.localToWorld(_rider.set(0, LAUNCH_DECK, 2.4)));
    player.rotation.y = L.obj.rotation.y;
  }
}

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
  const [cv, c] = canvas2d(256, 256);
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
    const [cv, c] = canvas2d(256, 128);
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

// A cloud of soft particles in one draw call: coal smoke over the harbor,
// foam churned up behind the ships. Each system has its own tint, size,
// lifetime and drift; `emit` seeds one particle at a point on a prop.
function makeParticles({ count, color, size, alpha, life, drift, jitter }) {
  const N = count;
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
  const [cv, c] = canvas2d(64, 64);
  const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: new THREE.CanvasTexture(cv) },
      color: { value: new THREE.Color(color) },
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
    p.life = life[0] + Math.random() * (life[1] - life[0]);
    p.x = tip.x + (Math.random() - 0.5) * jitter;
    p.y = tip.y;
    p.z = tip.z + (Math.random() - 0.5) * jitter;
    p.vx = drift[0] + Math.random() * (drift[1] - drift[0]);
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
      aSize[i] = size[0] + k * (size[1] - size[0]);
      aAlpha[i] = k < 0.12 ? (k / 0.12) * alpha : alpha * (1 - (k - 0.12) / 0.88);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }
  return { emit, update };
}
const smoke = makeParticles({
  count: 130, color: 0x6b655c, size: [1.4, 5.6], alpha: 0.4, life: [3.2, 4.6],
  drift: [0.5, 0.9], jitter: 0.3, // downwind, with the clouds
});
const wake = makeParticles({
  count: 160, color: 0xf4f1e6, size: [0.9, 3.4], alpha: 0.5, life: [2.4, 3.8],
  drift: [0, 0], jitter: 1.4, // foam stays where the hull churned it
});
// every smoking prop: emit cadence and the funnel tip in local coordinates
const smokeSources = [
  { obj: train, period: 0.3, tipY: 9.95, tipZ: 8.3, vy: 2.4, t: 0 },
  ...drifters
    .filter((d) => d.smokes)
    .map((d) => ({ obj: d.obj, period: 0.45, tipY: d.obj.userData.funnel.y, tipZ: d.obj.userData.funnel.z, vy: 1.7, t: 0 })),
];
smokeSources.push({ obj: launch.obj, period: 0.6, tipY: launch.obj.userData.funnel.y, tipZ: launch.obj.userData.funnel.z, vy: 1.3, t: 0 });
// every ship under way trails foam from its stern — as much as she has way on
const wakeSources = [...drifters, launch].map((d) => ({ ship: d, obj: d.obj, period: 0.14, tipY: 0.45, tipZ: d.obj.userData.stern, t: 0 }));

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
  waterUniforms.uSkyTint.value.lerpColors(WATER_SKY_DAY, WATER_SKY_DUSK, w);
}

/* ---------------- site markers ---------------- */

const markers = SITES.map((site, i) => {
  const g = new THREE.Group();
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
  g.position.set(site.pos.x, 0, site.pos.z); // both piers have decks near y 0
  scene.add(g);
  return {
    site,
    shortTitle: site.title.split('—')[0].trim(), // for the visit prompt
    g, pin, ring, sprite, pinMat, phase: i * 1.1, visited: false,
  };
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
// coat sleeves, hinged at the shoulder so they swing with the stride
const armGeo = new THREE.BoxGeometry(0.22, 0.95, 0.22);
armGeo.translate(0, -0.42, 0);
const armL = new THREE.Mesh(armGeo, lambert(0x33302c));
const armR = armL.clone();
armL.position.set(-0.74, 2.35, 0);
armR.position.set(0.74, 2.35, 0);
armL.castShadow = armR.castShadow = true;
player.add(armL, armR);
player.rotation.order = 'YXZ'; // heading first, so the walking lean stays in his own frame
player.scale.setScalar(0.58); // a man among five-storey buildings
player.position.set(START.x, 0, START.z);
player.rotation.y = Math.PI; // facing north, up the island
scene.add(player);

// The opening view looks past him, out across the harbor to the statue —
// so it is plain from the first frame that she is there, and that the
// landing behind him is the way to her. A moment later the camera swings
// round to the city, unless the walker has already taken charge of it.
cam.height = OPENING_HEIGHT;
cam.yaw = OPENING_YAW;
let opening = 0; // seconds since stepping ashore; -1 once the view is the walker's own

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
  if (e.repeat) return; // a held key walks, but toggles and visits fire once
  if (e.code === 'Escape') { closeCard(); closeEpilogue(); return; }
  // Enter on a focused button belongs to that button, not to the visit
  if (e.code === 'Enter' && e.target.closest && e.target.closest('button')) return;
  if ((e.code === 'KeyE' || e.code === 'Enter') && state.started) tryVisit();
  if (e.code === 'KeyM' && state.started && !state.modal) toggleView();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
// a key held while the tab loses focus would otherwise stay "down" forever
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

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
  // a right- or middle-button press is the browser's (its menu, its scroll), not a look-drag
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  // keep receiving the drag even if the pointer leaves the window
  try { e.target.setPointerCapture(e.pointerId); } catch { /* not a capturable target */ }
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
// a mouse wheel brings the camera in close or lets it hang back
window.addEventListener('wheel', (e) => {
  if (!state.started || state.modal || state.view !== 'street' || onUi(e)) return;
  cam.dist = Math.min(16, Math.max(6, cam.dist + e.deltaY * 0.012));
}, { passive: true });

/* ---------------- UI ---------------- */

const state = { started: false, modal: false, visitedCount: 0, nearSite: null, nearBoat: false, riding: false, epilogueShown: false, view: 'street' };

// The chart remembers: visited sites persist across sessions.
const SAVE_KEY = 'melville-charted-v1';
const save = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch { /* private mode */ }
  const out = Object.assign({ charted: [], epilogueShown: false, muted: false }, s);
  if (!Array.isArray(out.charted)) out.charted = []; // a hand-edited or damaged save
  return out;
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
const cardNum = document.getElementById('card-num');
const cardTitle = document.getElementById('card-title');
const cardDates = document.getElementById('card-dates');
const cardMedia = document.getElementById('card-media');
const cardBody = document.getElementById('card-body');
const cardArtifact = document.getElementById('card-artifact');
const epilogueEl = document.getElementById('epilogue');
const progressEl = document.getElementById('progress');
const compassEl = document.getElementById('compass');
const compassArrow = document.getElementById('compass-arrow');

const viewBtn = document.getElementById('view-btn');
function toggleView() {
  state.view = state.view === 'street' ? 'chart' : 'street';
  viewBtn.textContent = state.view === 'street' ? 'Chart View' : 'Street View';
  hudEl.classList.toggle('chart', state.view === 'chart'); // the title steps back from the map
  applyShadowFrustum(state.view);
}
// A mouse or touch click shouldn't leave a HUD button holding focus, or the
// next Enter (meant as "visit") would press it again. Keyboard users who
// tab to a button keep their focus.
function releasePointerFocus(btn) {
  btn.addEventListener('click', (e) => { if (e.detail > 0) btn.blur(); });
}
viewBtn.addEventListener('click', toggleView);
releasePointerFocus(viewBtn);

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
  const note = document.createElement('p');
  note.className = 'save-note';
  note.textContent = `${save.charted.length} of ${SITES.length} sites already charted · `;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset-link';
  reset.textContent = 'begin a new chart';
  reset.addEventListener('click', () => {
    // a new chart, but the sound stays the way the walker left it
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ muted: save.muted })); } catch { /* private mode */ }
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
  // phones, upright or sideways, start with the key folded so it doesn't cover the street
  if (window.innerWidth < 700 || window.innerHeight < 500) document.getElementById('chart-key').removeAttribute('open');
  toast(save.charted.length > 0
    ? 'Back ashore. The chart remembers what you have already found.'
    : 'You step ashore at the Battery. Six red markers wait on the island — the compass points to the nearest. The boat at the landing crosses to the Statue of Liberty.',
    save.charted.length > 0 ? 4200 : 7500);
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
releasePointerFocus(muteBtn);
audio.setMuted(save.muted);
reflectMute();

// The one prompt serves both: a site to visit, or the boat to board.
function tryVisit() {
  if (state.modal || state.riding) return;
  if (state.nearBoat) boardLaunch();
  else if (state.nearSite) openCard(state.nearSite);
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
  // a label faded out on foot (or set aside for the chart's type) is not
  // there to be tapped; the hidden volumes around the landmarks always are
  const hits = tapRay.intersectObjects(tapTargets, false).filter((h) => !h.object.isSprite || h.object.visible);
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

// Modal-open bookkeeping shared by every card: the ghost-click timestamp,
// the ducked ambience, the page-turn, and the header fields.
function beginCard(num, title, dates) {
  state.modal = true;
  modalOpenedAt = performance.now();
  audio.play('pageTurn');
  cardNum.textContent = num;
  cardTitle.textContent = title;
  cardDates.textContent = dates;
  cardMedia.innerHTML = '';
}

function openLandmarkCard(info) {
  if (!info) return;
  beginCard('★', info.name, info.year
    ? `${info.year} · a landmark of Melville’s city`
    : 'a landmark of Melville’s city');
  cardBody.innerHTML = `<p>${info.blurb}</p>`;
  cardArtifact.style.display = 'none';
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
  const s = marker.site;
  beginCard(s.num, s.title, s.dates);
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
    cardMedia.appendChild(fig);
  }
  cardBody.innerHTML = s.body.map((p) => `<p>${p}</p>`).join('');
  cardArtifact.style.display = '';
  // The story can be read from anywhere — the chart, or across the street —
  // but a site is charted only on foot, standing at its marker.
  const charting = !marker.visited && state.nearSite === marker;
  cardArtifact.innerHTML = marker.visited
    ? `<b>Collected:</b> ${s.artifact}`
    : charting
      ? `<b>Artifact found:</b> ${s.artifact}`
      : `<b>Uncharted</b> — walk to this marker to collect its artifact.`;
  cardArtifact.classList.toggle('stamped', charting);
  cardEl.classList.remove('hidden');
  if (charting) chartSite(marker);
}

function closeCard() {
  if (cardEl.classList.contains('hidden')) return;
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
}
document.getElementById('card-close').addEventListener('click', () => {
  if (!ghostClick()) closeCard();
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
const LIBERTY_LOOK = new THREE.Vector3(LIBERTY.x + 1, 15, LIBERTY.z);
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
    horns: [
      { at: 2, freq: 82, gain: 0.4 },
      { at: 5, freq: 116, gain: 0.28 },
      { at: 8.2, freq: 96, gain: 0.34 },
    ],
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
  while (finale.horns.length && finale.t >= finale.horns[0].at) {
    const { freq, gain } = finale.horns.shift();
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
function closeEpilogue() {
  if (epilogueEl.classList.contains('hidden')) return;
  epilogueEl.classList.add('hidden');
  state.modal = false;
  toast('The island is yours now. Revisit any marker to reread its story.');
}
document.getElementById('epilogue-close').addEventListener('click', () => {
  if (!ghostClick()) closeEpilogue();
});

/* ---------------- movement & loop ---------------- */

const SPEED = 7.5;
const vel = { x: 0, z: 0 }; // the walker's eased velocity, as a fraction of SPEED
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
// scratch vectors reused every frame, so the camera path allocates nothing
const _camPos = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _head = new THREE.Vector3();
const _toCam = new THREE.Vector3();

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

// Push a point out of every collider it has strayed into, by the shortest
// way out of each. Two passes: being pushed out of one box can land the
// point just inside a neighbour already checked (an inside corner between
// two stoops, say), and the second pass settles that the same frame.
function collide(px, pz) {
  for (let pass = 0; pass < 2; pass++) {
    let hit = false;
    for (const c of colliders) {
      if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) {
        const dxl = px - c.x0, dxr = c.x1 - px, dzl = pz - c.z0, dzr = c.z1 - pz;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) px = c.x0;
        else if (m === dxr) px = c.x1;
        else if (m === dzl) pz = c.z0;
        else pz = c.z1;
        hit = true;
      }
    }
    for (const c of roundColliders) { // straight out from the centre
      const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz);
      if (d < c.r) {
        px = d > 1e-6 ? c.x + (dx / d) * c.r : c.x + c.r;
        pz = d > 1e-6 ? c.z + (dz / d) * c.r : c.z;
        hit = true;
      }
    }
    if (!hit) break;
  }
  return [px, pz];
}

// One step of the walk from (px, pz) by (dx, dz), kept on dry land. Most
// of the shoreline runs at a slant, so a step that would leave the island
// is turned to run along the nearest stretch of shore — the walker slides
// along the seawall instead of stopping dead against it. Failing that
// (a corner of the island, the square edge of a pier) the step is tried
// one axis at a time.
function shoreStep(px, pz, dx, dz) {
  if (isWalkable(px + dx, pz + dz)) return [px + dx, pz + dz];
  if (pointInPoly(px, pz)) {
    let best = Infinity, tx = 0, tz = 0;
    for (let i = 0; i < ISLAND.length; i++) {
      const [ax, az] = ISLAND[i];
      const [bx, bz] = ISLAND[(i + 1) % ISLAND.length];
      const d = distToSegment(px, pz, ax, az, bx, bz);
      if (d < best) {
        best = d;
        const len = Math.hypot(bx - ax, bz - az);
        tx = (bx - ax) / len;
        tz = (bz - az) / len;
      }
    }
    const along = dx * tx + dz * tz;
    if (isWalkable(px + tx * along, pz + tz * along)) return [px + tx * along, pz + tz * along];
  }
  let nx = px + dx, nz = pz + dz;
  if (!isWalkable(nx, pz)) nx = px;
  if (!isWalkable(nx, nz)) nz = pz;
  return [nx, nz];
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const _fore = new THREE.Vector2(), _beam = new THREE.Vector2();
const _lv = new THREE.Vector3();

// Pin a chart label's HTML type over its landmark. On a narrow portrait
// screen the harbor landmarks sit near the edges, so a label is slid
// sideways until the whole name fits on screen — and on phones, where the
// compass, chart key and buttons crowd the top and bottom, it is kept out
// of those bands too (the breakpoint matches the stylesheet's).
function placeChartLabel(L) {
  if (!L.elW) L.elW = L.el.offsetWidth; // measured once, when first shown
  _lv.set(L.x + L.cdx, L.y, L.z + L.cdz).project(camera);
  const vw = window.innerWidth, vh = window.innerHeight, half = L.elW / 2 + 6;
  let sx = (_lv.x * 0.5 + 0.5) * vw;
  if (vw > half * 2) sx = Math.max(half, Math.min(vw - half, sx));
  let sy = (-_lv.y * 0.5 + 0.5) * vh;
  if (vw <= 700) sy = Math.max(118, Math.min(vh - 110, sy));
  L.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
}

// The title card is opaque, so nothing behind it needs drawing: a few
// frames are rendered to compile the shaders and upload the textures (so
// stepping ashore does not stutter), and then the loop idles until the
// walk begins.
let warmupFrames = 4;

// Resolution follows the machine. If the frame rate stays poor the canvas
// is drawn at a lower pixel ratio, a step at a time, and as a last resort
// the shadow map is halved; a machine that keeps up is never touched.
// (A display capped at 30 Hz to save power sits above the trigger.)
const perf = { time: 0, frames: 0, grace: 3, ratio: Math.min(window.devicePixelRatio || 1, 2) };
function watchFrameRate(rawDt) {
  if (rawDt > 0.25) return; // a hitch, or the tab was hidden: not the machine's pace
  if (perf.grace > 0) { perf.grace -= rawDt; return; }
  perf.time += rawDt;
  perf.frames++;
  if (perf.time < 2.5) return;
  const fps = perf.frames / perf.time;
  perf.time = perf.frames = 0;
  if (fps >= 24) return;
  if (perf.ratio > 1) {
    perf.ratio = Math.max(1, perf.ratio - 0.5);
    renderer.setPixelRatio(perf.ratio);
  } else if (sun.shadow.mapSize.x > 1024) {
    sun.shadow.mapSize.set(1024, 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } // rebuilt at the new size
    applyShadowFrustum(state.view);
  }
  perf.grace = 1.5; // let the change settle before judging again
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  if (!state.started) {
    if (warmupFrames <= 0) return;
    warmupFrames--;
  } else if (!finale) {
    watchFrameRate(rawDt);
  }
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;

  // --- player (movement is camera-relative; chart view is north-up) ---
  const effYaw = state.view === 'chart' ? 0 : cam.yaw;
  // the camera's ground-plane basis, shared by movement and the compass
  const fwdX = -Math.sin(effYaw), fwdZ = -Math.cos(effYaw);
  const rightX = Math.cos(effYaw), rightZ = -Math.sin(effYaw);
  // the input is a goal velocity; the walker eases into his stride and
  // takes a short step to stop, rather than snapping between the two
  let goalX = 0, goalZ = 0;
  if (state.started && !state.modal && !state.riding) {
    const [mx, mz] = moveInput();
    goalX = rightX * mx + fwdX * -mz;
    goalZ = rightZ * mx + fwdZ * -mz;
  }
  const wantsToMove = Math.hypot(goalX, goalZ) > 0.01;
  const ease = 1 - Math.pow(wantsToMove ? 0.0001 : 0.000001, dt);
  vel.x += (goalX - vel.x) * ease;
  vel.z += (goalZ - vel.z) * ease;
  let moving = Math.hypot(vel.x, vel.z);
  if (moving < 0.01) { vel.x = vel.z = 0; moving = 0; }
  if (moving > 0) {
    let [nx, nz] = shoreStep(player.position.x, player.position.z, vel.x * SPEED * dt, vel.z * SPEED * dt);
    [nx, nz] = collide(nx, nz);
    if (isWalkable(nx, nz)) player.position.set(nx, 0, nz);
    player.rotation.y = angleLerp(player.rotation.y, Math.atan2(vel.x, vel.z), 1 - Math.pow(0.00001, dt));
  }
  walkPhase += dt * (4 + moving * 7);
  const swing = moving > 0.01 ? 0.62 * Math.min(1, moving * 1.5) : 0;
  legL.rotation.x = Math.sin(walkPhase) * swing;
  legR.rotation.x = -Math.sin(walkPhase) * swing;
  armL.rotation.x = -Math.sin(walkPhase) * swing * 0.7; // arms swing against the legs
  armR.rotation.x = Math.sin(walkPhase) * swing * 0.7;
  player.rotation.x = moving * 0.07; // a slight lean into the walk
  player.position.y = moving > 0.01 ? Math.abs(Math.sin(walkPhase)) * 0.1 * Math.min(1, moving * 1.5) : 0;
  // each leg-swing crossing is a footfall — planks on the piers, stone ashore
  const stepSign = Math.sin(walkPhase) >= 0;
  if (moving > 0.01 && stepSign !== lastStepSign) {
    audio.play(onPlanks(player.position.x, player.position.z) ? 'stepWood' : 'step');
  }
  lastStepSign = stepSign;

  // --- camera: street view orbits behind him; chart view frames the whole
  // island from a fixed vantage, like the 1982 map ---
  const chartView = state.view === 'chart';
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
    finale.curve.getPoint(u, _camPos);
    const lookK = smoothstep01(Math.min(1, finale.t / 5));
    _lookGoal.set(player.position.x, 1.9, player.position.z).lerp(LIBERTY_LOOK, lookK);
  } else if (chartView) {
    _camPos.copy(CHART_CAM_POS);
    _lookGoal.copy(CHART_LOOK_AT);
  } else {
    if (opening >= 0) {
      opening += dt;
      if (wantsToMove || state.riding || cam.lastDrag >= 0) {
        opening = -1; // the walker has taken charge of the view
      } else if (opening > 2.6) {
        const k = 1 - Math.pow(0.3, dt);
        cam.yaw = angleLerp(cam.yaw, 0, k); // round to the city, behind him
        cam.height += (5 - cam.height) * k; // and up to the usual vantage
        if (Math.abs(Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw))) < 0.02) { opening = -1; cam.height = 5; }
      }
    }
    // aboard the boat the camera rides astern of her
    if (state.riding && t - cam.lastDrag > 2.2) {
      cam.yaw = angleLerp(cam.yaw, launch.obj.rotation.y + Math.PI, 1 - Math.pow(0.2, dt));
    }
    if (moving > 0.05 && t - cam.lastDrag > 2.2) {
      // The camera swings in behind the walker — but only as far as he is
      // walking away from it or across its view. His heading is steered
      // relative to the camera, so swinging behind a man who is walking
      // toward the lens turns him as it turns, and he circles for ever.
      const away = (vel.x * fwdX + vel.z * fwdZ) / moving; // 1 walking away, -1 straight at the camera
      const follow = smoothstep01(Math.max(0, Math.min(1, (away + 0.85) / 0.85)));
      cam.yaw = angleLerp(cam.yaw, Math.atan2(vel.x, vel.z) + Math.PI, (1 - Math.pow(0.55, dt)) * follow);
    }
    _head.set(player.position.x, 1.9, player.position.z);
    _toCam.set(
      player.position.x + Math.sin(cam.yaw) * cam.dist,
      cam.height,
      player.position.z + Math.cos(cam.yaw) * cam.dist
    ).sub(_head);
    const fullDist = _toCam.length();
    _toCam.normalize();
    camRay.set(_head, _toCam);
    camRay.far = fullDist;
    const blocked = camRay.intersectObjects(occluders, false);
    const targetDist = blocked.length ? Math.max(2.2, blocked[0].distance - 0.5) : fullDist;
    // ease the occlusion pull-in: snap in quickly, recover gently, never pop
    const k = targetDist < cam.smoothDist ? Math.min(1, dt * 14) : Math.min(1, dt * 3);
    cam.smoothDist += (targetDist - cam.smoothDist) * k;
    _camPos.copy(_head).addScaledVector(_toCam, cam.smoothDist);
    // only near the very bottom of the drag range does the view crane up
    // (quadratic, so it eases in) — normal heights behave as before
    const lowness = Math.max(0, 2.8 - cam.height);
    _lookGoal.set(player.position.x, player.position.y + 1.7 + lowness * lowness * 4, player.position.z);
  }
  const camK = 1 - Math.pow(0.0008, dt);
  camera.position.lerp(_camPos, camK);
  lookTarget.lerp(_lookGoal, camK);
  camera.lookAt(lookTarget);
  const fv = FOG_VIEWS[state.view];
  scene.fog.near += (fv.near - scene.fog.near) * Math.min(1, dt * 2);
  scene.fog.far += (fv.far - scene.fog.far) * Math.min(1, dt * 2);
  aimSun(state.view, player.position.x, player.position.z);

  // --- the sun's disc and the clouds belong to the street sky only;
  // from the chart's altitude they would hang between camera and island ---
  sunSprite.position.copy(player.position).addScaledVector(sunDirCur, 850);
  sunSprite.material.opacity += ((chartView ? 0 : 0.95) - sunSprite.material.opacity) * Math.min(1, dt * 3);
  for (const cl of clouds) {
    cl.sp.position.x += cl.speed * dt;
    if (cl.sp.position.x > 290) cl.sp.position.x = -290;
    cl.sp.material.opacity += ((chartView ? 0 : cl.peak) - cl.sp.material.opacity) * Math.min(1, dt * 2);
  }

  // --- proximity: one pass finds the nearest site (visit prompt) and the
  // nearest uncharted site (compass target) ---
  let near = null, nearD = 8, target = null, targetD = Infinity;
  for (const m of markers) {
    const d = Math.hypot(player.position.x - m.site.pos.x, player.position.z - m.site.pos.z);
    if (d < nearD) { near = m; nearD = d; }
    if (!m.visited && d < targetD) { target = m; targetD = d; }
  }
  state.nearSite = near;

  // --- visit prompt, recomputed from proximity + modal state each frame ---
  // the boat can be boarded from the end of whichever landing she lies at
  const [gx, gz] = LANDINGS[launch.at].gangway;
  state.nearBoat = launch.phase === 'moored' && Math.hypot(player.position.x - gx, player.position.z - gz) < 3;
  const promptOn = (state.nearBoat || !!near) && state.started && !state.modal && !state.riding;
  visitBtn.classList.toggle('hidden', !promptOn);
  if (promptOn) {
    const label = state.nearBoat
      ? (launch.at === 'battery' ? 'Boat to the Statue of Liberty' : 'Boat back to the Battery')
      : `${near.visited ? 'Revisit' : 'Visit'}: ${near.shortTitle}`;
    if (visitLabel.textContent !== label) visitLabel.textContent = label;
    if (!visitPulsed) {
      // the very first prompt glows so nobody walks past it
      visitPulsed = true;
      visitBtn.classList.add('pulse');
      setTimeout(() => visitBtn.classList.remove('pulse'), 4400);
    }
  }
  // Guide needle: the arrow points toward the nearest uncharted site
  // relative to the current view — walk the way it points. (In chart view
  // the view is north-up, so it doubles as a map bearing.) The angle is
  // kept continuous and smoothed in JS so the needle never spins the long
  // way around when the target passes behind the camera.
  if (target) {
    const dx = target.site.pos.x - player.position.x;
    const dz = target.site.pos.z - player.position.z;
    const rel = Math.atan2(dx * rightX + dz * rightZ, dx * fwdX + dz * fwdZ);
    needleAngle = angleLerp(needleAngle, rel, Math.min(1, dt * 9));
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
  const spriteScale = chartView ? 12 : 3.6;
  const spriteY = chartView ? 16 : 6.6;
  for (const m of markers) {
    m.sprite.scale.set(spriteScale, spriteScale, 1);
    m.pin.scale.setScalar((chartView ? 2.8 : 1) * (m.fxScale || 1));
    if (!m.visited) {
      const bob = Math.sin(t * 2 + m.phase) * 0.4;
      m.pin.position.y = bob + 0.2;
      m.pin.rotation.y = t * 0.8;
      m.sprite.position.y = spriteY + bob;
    } else {
      m.pin.position.y = 0;
      m.sprite.position.y = spriteY;
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
  // (from the chart the names are HTML type; see placeChartLabel)
  camera.updateMatrixWorld(); // this frame's view, for pinning the chart labels
  for (const L of landmarkLabels) {
    if (chartView) {
      L.sprite.visible = false;
      placeChartLabel(L);
      continue;
    }
    const d = Math.hypot(player.position.x - L.x, player.position.z - L.z);
    const fadeIn = L.range - 16;
    const o = d < fadeIn ? 1 : d > L.range ? 0 : 1 - (d - fadeIn) / 16;
    L.sprite.material.opacity = o;
    L.sprite.visible = o > 0.02;
  }

  // --- street life (pedestrians respect walls like everyone else) ---
  for (const w of wanderers) {
    const nz = w.z + w.dir * w.speed * dt;
    const [cx2, cz2] = collide(w.x, nz);
    const blocked = Math.abs(cz2 - nz) > 1e-4 || Math.abs(cx2 - w.x) > 1e-4;
    if (blocked && !w.hemmed) {
      w.dir *= -1; // blocked by a wagon, a lamp, or a wall — turn back, keep the lane
    } else {
      w.z = nz; // (blocked both ways, he was set down inside something: he walks out of it)
    }
    w.hemmed = blocked;
    if (w.z < w.z0) { w.z = w.z0; w.dir = 1; }
    if (w.z > w.z1) { w.z = w.z1; w.dir = -1; }
    w.g.position.set(w.x, Math.abs(Math.sin(t * 7 + w.ph)) * 0.04, w.z);
    w.g.rotation.y = w.dir > 0 ? 0 : Math.PI;
  }

  // --- water: the swell runs on the GPU; the surf breathes with it ---
  waterUniforms.uTime.value = t;
  foam.tex.offset.y = (t * 0.22) % 1;
  foam.mat.opacity = 0.62 + 0.18 * Math.sin(t * 1.1);

  // --- moving props: every hull rides the swell, pitching over the crests
  // fore-and-aft and rolling with the chop across the beam ---
  for (const b of bobbers) {
    const p = b.obj.position, yaw = b.obj.rotation.y;
    _fore.set(Math.sin(yaw), Math.cos(yaw));     // local +z (the bow) in world x/z
    _beam.set(Math.cos(yaw), -Math.sin(yaw));    // local +x (starboard)
    const hF = waveHeight(p.x + _fore.x * b.half, p.z + _fore.y * b.half, t);
    const hA = waveHeight(p.x - _fore.x * b.half, p.z - _fore.y * b.half, t);
    const hR = waveHeight(p.x + _beam.x * b.beam, p.z + _beam.y * b.beam, t);
    const hL = waveHeight(p.x - _beam.x * b.beam, p.z - _beam.y * b.beam, t);
    p.y = (hF + hA + hR + hL) / 4 - 0.2; // the waterline a third of the way up the hull
    b.obj.rotation.x = Math.atan2(hF - hA, 2 * b.half) * 0.8;
    b.obj.rotation.z = Math.atan2(hR - hL, 2 * b.beam) * 0.6;
  }
  updateDrifters(dt);
  updateLaunch(dt);

  if (trainHalt > 0) {
    trainHalt -= dt;
    if (trainHalt <= 0) {
      // the locomotive sits at local +z, so it faces -z (north) when turned about
      trainDir = -trainDir;
      train.rotation.y = trainDir > 0 ? 0 : Math.PI;
      trainWhistle();
    }
  } else {
    const end = trainDir > 0 ? TRAIN_SOUTH : TRAIN_NORTH;
    const left = Math.abs(end - train.position.z);
    const goal = Math.min(1, 0.06 + left / 14); // brakes on over the last few car-lengths
    trainWay += (goal - trainWay) * Math.min(1, dt * (goal > trainWay ? 0.5 : 4));
    const step = TRAIN_SPEED * trainWay * dt;
    if (step < left) {
      train.position.z += trainDir * step;
    } else {
      train.position.z = end;
      trainWay = 0;
      trainHalt = TRAIN_STAND;
    }
  }

  // --- coal smoke from the locomotive and the two moving steamers ---
  for (const s of smokeSources) {
    s.t += dt;
    while (s.t > s.period) { s.t -= s.period; smoke.emit(s.obj, 0, s.tipY, s.tipZ, s.vy); }
  }
  smoke.update(dt);
  for (const s of wakeSources) {
    s.t += dt * s.ship.way;
    while (s.t > s.period) { s.t -= s.period; wake.emit(s.obj, 0, s.tipY, s.tipZ, 0); }
  }
  wake.update(dt);

  diana.rotation.y = t * 0.4;

  whale.position.y = waveHeight(whale.position.x, whale.position.z, t) - 0.15 + Math.sin(t * 0.5) * 0.35;
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

/* ---------------- one last pass: fewer draw calls ----------------
   Everything above is built the readable way — one mesh, one material per
   box — which leaves several hundred little props each costing a draw
   call, and a second one in the shadow pass. None of the fixed ones ever
   moves, so they are folded together here: every plain single-colour mesh
   under `root` goes into one vertex-coloured mesh per kind of shading and
   shadow, and meshes that share any other material are joined under it.
   Things that move as a body (a ship, the train) are baked within their
   own group, so the group still moves as before. */

function bake(root, skip = new Set()) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  (function visit(o) {
    if (o !== root && skip.has(o)) return;
    for (const c of o.children) visit(c);
    if (!o.isMesh || !o.visible || o.children.length || o.renderOrder !== 0) return;
    const m = o.material, g = o.geometry;
    if (Array.isArray(m) || m.transparent || !g.attributes.position || !g.attributes.normal) return;
    const plain = m.isMeshLambertMaterial && !m.map && m.emissive.getHex() === 0;
    const key = `${plain ? `plain|${m.flatShading}|${m.side}` : m.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { plain, meshes: [] });
    buckets.get(key).meshes.push(o);
  })(root);

  const rel = new THREE.Matrix4();
  for (const { plain, meshes } of buckets.values()) {
    if (meshes.length < 2) continue;
    if (!plain && !meshes.every((o) => o.geometry.attributes.uv)) continue;
    const first = meshes[0];
    const geos = meshes.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && (plain || name !== 'uv')) g.deleteAttribute(name);
      }
      g.applyMatrix4(rel.multiplyMatrices(toRoot, o.matrixWorld));
      if (plain) {
        const n = g.attributes.position.count, c = o.material.color;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      return g;
    });
    const material = plain
      ? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: first.material.flatShading, side: first.material.side })
      : first.material;
    const merged = new THREE.Mesh(mergeGeometries(geos, false), material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    for (const o of meshes) {
      let parent = o.parent;
      parent.remove(o);
      o.geometry.dispose();
      // a group emptied by this is only a husk
      while (parent !== root && parent.type === 'Group' && !parent.children.length && !skip.has(parent)) {
        const up = parent.parent;
        up.remove(parent);
        parent = up;
      }
    }
    for (const g of geos) g.dispose();
    root.add(merged);
  }
}
{
  // whatever is animated, or is asked after by name later, is left alone
  const moving = [
    player, beacon, diana, train, whale,
    ...markers.map((m) => m.g), ...gulls.map((gl) => gl.g),
    ...bobbers.map((b) => b.obj), ...wanderers.map((w) => w.g),
  ];
  bake(scene, new Set([...moving, ...occluders]));
  for (const group of [train, diana, whale, ...bobbers.map((b) => b.obj), ...wanderers.map((w) => w.g)]) bake(group);
}

// Restore a returning walker's chart before the first frame.
for (const id of save.charted) {
  const m = markers.find((mk) => mk.site.id === id);
  if (m) chartSite(m, { silent: true });
}
if (save.epilogueShown) {
  state.epilogueShown = true;
  applyDusk(1); // the tide turned in an earlier session; the dusk holds
}

// The web font usually lands after the labels were first inked; ink them again.
if (document.fonts) {
  Promise.all([
    document.fonts.load("italic 600 72px 'EB Garamond'"),
    document.fonts.load("500 84px 'EB Garamond'"),
    document.fonts.load("600 64px 'EB Garamond'"),
  ]).catch(() => {}).then(() => document.fonts.ready).then(() => {
    for (const r of labelRedraws) { r.draw(); r.tex.needsUpdate = true; }
    for (const L of landmarkLabels) L.elW = 0; // the chart's type has changed width
  });
}

// The island is built; the gangway can open.
{
  const startBtn = document.getElementById('start-btn');
  startBtn.textContent = save.charted.length > 0 ? 'Return ashore' : 'Go ashore';
  startBtn.disabled = false;
  document.getElementById('load-note').classList.add('hidden'); // in case the slow-load note had appeared
}

animate();
