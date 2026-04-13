# Gallery Walk Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-person 3D museum gallery walk mode to the photo portfolio, showcasing five distinct HTML-in-Canvas capabilities impossible without the API.

**Architecture:** Three.js renders a classical museum (figure-8 floor plan, two rooms + passage) inside the existing shell's canvas. HiC textures are injected into Three.js materials via the `__webglTexture` pattern. WASD + pointer lock controls provide free-roam navigation with AABB collision detection. Five HiC showcase features (proximity plaques, detail panel, wayfinding kiosk, entrance info panel, ambient ticker) each demonstrate a unique HiC capability.

**Tech Stack:** Three.js (latest stable), vanilla TypeScript, WebGL2 via Three.js renderer, HTML-in-Canvas API

**Design Spec:** `docs/superpowers/specs/2026-04-13-gallery-walk-design.md`

---

## File Structure

```
src/modes/gallery-walk/
  gallery-walk.ts      — ModeImpl factory, orchestrates all subsystems
  scene.ts             — Three.js scene: geometry, materials, lights, camera
  controls.ts          — Pointer lock, WASD movement, AABB collision
  hic-bridge.ts        — DOM element creation, GL texture injection, paint handling
  interaction.ts       — Raycaster, proximity checks, screen-projection passthrough
  kiosk.ts             — Wayfinding kiosk SVG map + position tracking
  ticker.ts            — Ambient ticker DOM + CSS marquee animation
  gallery-walk.css     — Styles for all HiC DOM elements

Modified files:
  src/types.ts         — Add 'gallery-walk' to ModeName union
  src/main.ts          — Add to modeLoaders, update landing hint
  src/learn/content.ts — Add gallery-walk learn entry
  src/types.test.ts    — Update to expect 5 modes
  src/learn/__tests__/content.test.ts — Update to expect 5 entries
  package.json         — Add three dependency
```

---

### Task 1: Install Three.js and Register the Mode

**Files:**
- Modify: `package.json`
- Modify: `src/types.ts`
- Modify: `src/main.ts`
- Modify: `src/types.test.ts`
- Modify: `src/learn/__tests__/content.test.ts`
- Create: `src/modes/gallery-walk/gallery-walk.ts` (stub)
- Create: `src/modes/gallery-walk/gallery-walk.css` (empty)

- [ ] **Step 1: Install Three.js**

Run: `cd /Users/iser/workspace/photo-portfolio && npm install three && npm install -D @types/three`

Expected: `three` and `@types/three` added to package.json

- [ ] **Step 2: Add gallery-walk to the type system**

In `src/types.ts`, update `ModeName`, `MODE_LABELS`, and `MODE_ORDER`:

```ts
export type ModeName =
  | 'slideshow'
  | 'print-table'
  | 'film-strip'
  | 'wall-exhibition'
  | 'gallery-walk';

export const MODE_LABELS: Record<ModeName, string> = {
  slideshow: 'Slideshow',
  'print-table': 'Prints',
  'film-strip': 'Strip',
  'wall-exhibition': 'Wall',
  'gallery-walk': 'Gallery',
};

export const MODE_ORDER: ModeName[] = [
  'slideshow',
  'print-table',
  'film-strip',
  'wall-exhibition',
  'gallery-walk',
];
```

- [ ] **Step 3: Create the gallery-walk stub**

Create `src/modes/gallery-walk/gallery-walk.ts`:

```ts
import type { ModeImpl, ModeContext } from '../../types';
import './gallery-walk.css';

export default function createGalleryWalk(ctx: ModeContext): ModeImpl {
  const { canvas, requestDraw, setAnimating } = ctx;

  // Placeholder — will be filled in subsequent tasks
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width:100%;height:100%;overflow:hidden;background:#0a0a0b;display:flex;align-items:center;justify-content:center;color:#5a5650;font-family:Inter,system-ui,sans-serif;';
  root.textContent = 'Gallery Walk — loading Three.js...';
  canvas.appendChild(root);
  canvas.requestPaint?.();

  return {
    paint(_dt: number) {},
    destroy() {
      root.remove();
    },
  };
}
```

Create `src/modes/gallery-walk/gallery-walk.css` (empty for now):

```css
/* Gallery Walk HiC element styles */
```

- [ ] **Step 4: Register in main.ts**

In `src/main.ts`, add to `modeLoaders`:

```ts
const modeLoaders: Record<ModeName, () => Promise<{ default: (ctx: ModeContext) => ModeImpl }>> = {
  slideshow: () => import('./modes/slideshow/slideshow'),
  'print-table': () => import('./modes/print-table/print-table'),
  'film-strip': () => import('./modes/film-strip/film-strip'),
  'wall-exhibition': () => import('./modes/wall-exhibition/wall-exhibition'),
  'gallery-walk': () => import('./modes/gallery-walk/gallery-walk'),
};
```

Update the landing page hint text from `'Press 1–4 or select a mode from the navigation bar'` to `'Press 1–5 or select a mode from the navigation bar'`.

- [ ] **Step 5: Update tests to expect 5 modes**

In `src/types.test.ts`:
- Change `expect(MODE_ORDER).toHaveLength(4)` to `expect(MODE_ORDER).toHaveLength(5)`
- Add `'gallery-walk'` to the `expected` array
- Add `expect(MODE_LABELS['gallery-walk']).toBe('Gallery')` to the labels test

In `src/learn/__tests__/content.test.ts`:
- Change `expect(Object.keys(LEARN_CONTENT)).toHaveLength(4)` to `expect(Object.keys(LEARN_CONTENT)).toHaveLength(5)`

- [ ] **Step 6: Add learn content for gallery-walk**

In `src/learn/content.ts`, add to `LEARN_CONTENT`:

```ts
'gallery-walk': {
  title: '3D Gallery Walk',
  description: 'A first-person museum walk through a figure-8 floor plan. Photos hang on classical walls with ornate frames and warm spotlighting. Explore freely with WASD + mouse look.',
  howItWorks: 'Three.js renders a 3D museum scene using the shell\'s canvas. Each photo, plaque, kiosk, and info panel is a live DOM element inside the canvas subtree, captured as a WebGL texture via texElementImage2D in the paint handler. These textures are injected into Three.js materials using the __webglTexture property bridge. The camera is a PerspectiveCamera at eye height (1.6m) driven by pointer lock mouse input and WASD keys, with AABB collision detection against axis-aligned walls.',
  whyHiC: 'This mode requires all four HiC pillars simultaneously: (1) full CSS text and layout fidelity for museum plaques with serif fonts and EXIF data, (2) 3D rendering via Three.js materials receiving live HTML textures, (3) preserved interactivity — buttons on the detail panel, scrolling on the info panel, and clickable elements on the kiosk map all work through screen-projection passthrough that translates 3D raycaster hits back to DOM coordinates, and (4) real browser affordances including keyboard focus, text selection, and accessibility tree integration via the inert attribute on off-screen photos.',
  keyCode: `// Inject HiC texture into Three.js material\nconst texture = new THREE.Texture();\ntexture.isRenderTargetTexture = true;\ntexture.colorSpace = THREE.SRGBColorSpace;\ntexture.flipY = false;\nrenderer.properties.get(texture).__webglTexture = glTex;\n// Upload in paint handler, reset Three.js state\ngl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);\nrenderer.state.reset();`,
},
```

- [ ] **Step 7: Run tests**

Run: `cd /Users/iser/workspace/photo-portfolio && npm test`

Expected: All tests pass (types test expects 5 modes, learn content test expects 5 entries, nav test creates 5 mode buttons).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/types.ts src/types.test.ts src/main.ts \
  src/learn/content.ts src/learn/__tests__/content.test.ts \
  src/modes/gallery-walk/gallery-walk.ts src/modes/gallery-walk/gallery-walk.css
git commit -m "feat(gallery-walk): register mode stub and install Three.js"
```

---

### Task 2: Three.js Scene — Geometry, Materials, and Lights

**Files:**
- Create: `src/modes/gallery-walk/scene.ts`

- [ ] **Step 1: Create scene.ts with gallery geometry**

Create `src/modes/gallery-walk/scene.ts`. This file exports a `createGalleryScene` function that builds the entire Three.js scene graph.

```ts
import * as THREE from 'three';

/** All dimensions in meters. 1 Three.js unit = 1 meter. */
const ROOM_W = 12;
const ROOM_D = 10;
const ROOM_H = 4;
const WALL_THICKNESS = 0.15;
const PASSAGE_W = 3;
const PASSAGE_D = 4;
const PASSAGE_H = 3.5;
const MOLDING_SIZE = 0.12;

// Material palette — classical museum
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d342b, roughness: 0.8 });
const moldingMat = new THREE.MeshStandardMaterial({ color: 0x5a4f42, roughness: 0.8 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d2620, roughness: 0.6 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xb8960c, roughness: 0.35, metalness: 0.7 });

export interface PhotoSlot {
  /** World position of the photo center */
  position: THREE.Vector3;
  /** Normal direction the photo faces (into the room) */
  normal: THREE.Vector3;
  /** Width of the photo in meters */
  width: number;
  /** Height of the photo in meters */
  height: number;
  /** The Three.js mesh for the photo plane */
  mesh: THREE.Mesh;
  /** The Three.js mesh for the frame */
  frameMesh: THREE.Mesh;
  /** SpotLight aimed at this photo */
  spotLight: THREE.SpotLight;
}

export interface GalleryScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  photoSlots: PhotoSlot[];
  /** Wall AABBs for collision detection: { min: {x,z}, max: {x,z} } */
  wallColliders: Array<{ min: { x: number; z: number }; max: { x: number; z: number } }>;
  /** World position of the kiosk top surface center */
  kioskTopCenter: THREE.Vector3;
  kioskTopMesh: THREE.Mesh;
  /** World position of the info panel center */
  infoPanelCenter: THREE.Vector3;
  infoPanelMesh: THREE.Mesh;
  /** Ticker strip meshes */
  tickerMeshes: THREE.Mesh[];
  /** Detail panel mesh (initially invisible) */
  detailPanelMesh: THREE.Mesh;
  /** All disposable Three.js objects for cleanup */
  disposables: Array<{ dispose(): void }>;
}

export function createGalleryScene(aspect: number): GalleryScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0b);

  const camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 100);
  // Spawn: 1m inside entrance (south wall of west wing), facing north
  // West wing center X = 0, south wall Z = ROOM_D/2
  camera.position.set(0, 1.6, ROOM_D / 2 - 1);
  camera.rotation.order = 'YXZ';

  const disposables: Array<{ dispose(): void }> = [
    wallMat, moldingMat, floorMat, ceilingMat, frameMat,
  ];

  const wallColliders: GalleryScene['wallColliders'] = [];

  // --- Helper: create a wall segment ---
  function addWall(
    x: number, z: number,
    w: number, h: number, d: number,
    rotY = 0,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, h / 2, z);
    if (rotY) mesh.rotation.y = rotY;
    scene.add(mesh);
    disposables.push(geo);
    return mesh;
  }

  // --- Helper: add wall collider (AABB in XZ plane) ---
  function addCollider(cx: number, cz: number, hw: number, hd: number) {
    wallColliders.push({
      min: { x: cx - hw, z: cz - hd },
      max: { x: cx + hw, z: cz + hd },
    });
  }

  // ============================
  // WEST WING (centered at x=0)
  // ============================
  const wxCenter = 0;
  const wzCenter = 0;

  // North wall (full width)
  addWall(wxCenter, wzCenter - ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter, wzCenter - ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // South wall (split for entrance: left segment + right segment, 4m gap center)
  const entranceW = 4;
  const southSegW = (ROOM_W - entranceW) / 2;
  // Left segment
  addWall(wxCenter - ROOM_W / 2 + southSegW / 2, wzCenter + ROOM_D / 2, southSegW, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter - ROOM_W / 2 + southSegW / 2, wzCenter + ROOM_D / 2, southSegW / 2, WALL_THICKNESS / 2);
  // Right segment
  addWall(wxCenter + ROOM_W / 2 - southSegW / 2, wzCenter + ROOM_D / 2, southSegW, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter + ROOM_W / 2 - southSegW / 2, wzCenter + ROOM_D / 2, southSegW / 2, WALL_THICKNESS / 2);

  // West wall (full height)
  addWall(wxCenter - ROOM_W / 2, wzCenter, WALL_THICKNESS, ROOM_H, ROOM_D);
  addCollider(wxCenter - ROOM_W / 2, wzCenter, WALL_THICKNESS / 2, ROOM_D / 2);

  // East wall (split for passage: top segment + bottom segment)
  const passageZStart = -PASSAGE_D / 2;
  const passageZEnd = PASSAGE_D / 2;
  const topSegD = ROOM_D / 2 + passageZStart; // from north wall to passage
  const botSegD = ROOM_D / 2 - passageZEnd;   // from passage to south wall
  // Top segment (north side of passage)
  addWall(wxCenter + ROOM_W / 2, wzCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS, ROOM_H, topSegD);
  addCollider(wxCenter + ROOM_W / 2, wzCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS / 2, topSegD / 2);
  // Bottom segment (south side of passage)
  addWall(wxCenter + ROOM_W / 2, wzCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS, ROOM_H, botSegD);
  addCollider(wxCenter + ROOM_W / 2, wzCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS / 2, botSegD / 2);

  // =============================
  // EAST WING (centered at x = ROOM_W + PASSAGE_W - WALL_THICKNESS)
  // =============================
  // The passage connects the east wall of west wing to the west wall of east wing
  const exCenter = ROOM_W / 2 + PASSAGE_W + ROOM_W / 2 - WALL_THICKNESS;
  // Simplify: east wing offset = ROOM_W + PASSAGE_W
  const exOff = ROOM_W + PASSAGE_W;
  const ezCenter = 0;

  // North wall
  addWall(exOff, ezCenter - ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(exOff, ezCenter - ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // South wall (full)
  addWall(exOff, ezCenter + ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(exOff, ezCenter + ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // East wall (full)
  addWall(exOff + ROOM_W / 2, ezCenter, WALL_THICKNESS, ROOM_H, ROOM_D);
  addCollider(exOff + ROOM_W / 2, ezCenter, WALL_THICKNESS / 2, ROOM_D / 2);

  // West wall (split for passage, mirrors west wing east wall)
  addWall(exOff - ROOM_W / 2, ezCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS, ROOM_H, topSegD);
  addCollider(exOff - ROOM_W / 2, ezCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS / 2, topSegD / 2);
  addWall(exOff - ROOM_W / 2, ezCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS, ROOM_H, botSegD);
  addCollider(exOff - ROOM_W / 2, ezCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS / 2, botSegD / 2);

  // ============================
  // FLOORS & CEILINGS
  // ============================
  // West wing floor
  const floorGeoW = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const floorW = new THREE.Mesh(floorGeoW, floorMat);
  floorW.rotation.x = -Math.PI / 2;
  floorW.position.set(wxCenter, 0, wzCenter);
  scene.add(floorW);
  disposables.push(floorGeoW);

  // East wing floor
  const floorGeoE = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const floorE = new THREE.Mesh(floorGeoE, floorMat);
  floorE.rotation.x = -Math.PI / 2;
  floorE.position.set(exOff, 0, ezCenter);
  scene.add(floorE);
  disposables.push(floorGeoE);

  // Passage floor
  const passFloorGeo = new THREE.PlaneGeometry(PASSAGE_W, PASSAGE_D);
  const passFloor = new THREE.Mesh(passFloorGeo, floorMat);
  passFloor.rotation.x = -Math.PI / 2;
  passFloor.position.set(ROOM_W / 2 + PASSAGE_W / 2, 0, 0);
  scene.add(passFloor);
  disposables.push(passFloorGeo);

  // West wing ceiling
  const ceilGeoW = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const ceilW = new THREE.Mesh(ceilGeoW, ceilingMat);
  ceilW.rotation.x = Math.PI / 2;
  ceilW.position.set(wxCenter, ROOM_H, wzCenter);
  scene.add(ceilW);
  disposables.push(ceilGeoW);

  // East wing ceiling
  const ceilGeoE = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const ceilE = new THREE.Mesh(ceilGeoE, ceilingMat);
  ceilE.rotation.x = Math.PI / 2;
  ceilE.position.set(exOff, ROOM_H, ezCenter);
  scene.add(ceilE);
  disposables.push(ceilGeoE);

  // Passage ceiling (lower)
  const passCeilGeo = new THREE.PlaneGeometry(PASSAGE_W, PASSAGE_D);
  const passCeil = new THREE.Mesh(passCeilGeo, ceilingMat);
  passCeil.rotation.x = Math.PI / 2;
  passCeil.position.set(ROOM_W / 2 + PASSAGE_W / 2, PASSAGE_H, 0);
  scene.add(passCeil);
  disposables.push(passCeilGeo);

  // ============================
  // LIGHTING
  // ============================
  const ambient = new THREE.AmbientLight(0x2a2018, 0.15);
  scene.add(ambient);

  // Passage point light
  const passLight = new THREE.PointLight(0xfff0d0, 0.5, 15);
  passLight.position.set(ROOM_W / 2 + PASSAGE_W / 2, PASSAGE_H - 0.3, 0);
  scene.add(passLight);

  // ============================
  // PHOTO SLOTS
  // ============================
  const photoSlots: PhotoSlot[] = [];

  // Photo placement helper
  function addPhotoSlot(
    cx: number, cy: number, cz: number,
    normalX: number, normalZ: number,
    width: number, height: number,
  ): PhotoSlot {
    const normal = new THREE.Vector3(normalX, 0, normalZ);

    // Photo plane — recessed 0.02m into frame
    const photoGeo = new THREE.PlaneGeometry(width, height);
    const photoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      emissive: new THREE.Color(0x0a0808),
      emissiveIntensity: 0.1,
    });
    const photoMesh = new THREE.Mesh(photoGeo, photoMat);
    photoMesh.position.set(cx + normalX * 0.02, cy, cz + normalZ * 0.02);
    photoMesh.lookAt(cx + normalX, cy, cz + normalZ);
    scene.add(photoMesh);
    disposables.push(photoGeo, photoMat);

    // Frame — extruded rectangle around photo
    const border = 0.08;
    const frameW = width + border * 2;
    const frameH = height + border * 2;
    const frameDepth = 0.04;
    const frameGeo = new THREE.BoxGeometry(frameW, frameH, frameDepth);
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(cx, cy, cz);
    frameMesh.lookAt(cx + normalX, cy, cz + normalZ);
    scene.add(frameMesh);
    disposables.push(frameGeo);

    // SpotLight aimed at photo
    const spot = new THREE.SpotLight(0xfff0d0, 2.0, 8, Math.PI / 6, 0.5);
    spot.position.set(cx, ROOM_H - 0.5, cz + normalZ * 0.5);
    spot.target = photoMesh;
    spot.castShadow = false;
    scene.add(spot);
    scene.add(spot.target);

    const slot: PhotoSlot = {
      position: new THREE.Vector3(cx, cy, cz),
      normal,
      width,
      height,
      mesh: photoMesh,
      frameMesh,
      spotLight: spot,
    };
    photoSlots.push(slot);
    return slot;
  }

  // Photo height center = 1.5m (eye level)
  const photoY = 1.5;

  // --- West Wing photos ---
  // North wall: 3 photos
  const wnWallZ = wzCenter - ROOM_D / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(-3, photoY, wnWallZ, 0, 1, 1.5, 1.0);  // hero
  addPhotoSlot(0, photoY, wnWallZ, 0, 1, 0.9, 0.7);
  addPhotoSlot(3, photoY, wnWallZ, 0, 1, 0.8, 1.0);

  // South wall: 2 photos (entrance takes center space)
  const wsWallZ = wzCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(-4.5, photoY, wsWallZ, 0, -1, 0.9, 0.7);
  addPhotoSlot(4.5, photoY, wsWallZ, 0, -1, 0.8, 0.6);

  // West wall: 2 photos
  const wwWallX = wxCenter - ROOM_W / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(wwWallX, photoY, -2.5, 1, 0, 1.0, 0.8);
  addPhotoSlot(wwWallX, photoY, 2.5, 1, 0, 0.8, 1.0);

  // East wall (north segment, above passage): 2 photos
  const weWallX = wxCenter + ROOM_W / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(weWallX, photoY, -3.5, -1, 0, 0.8, 0.6);
  addPhotoSlot(weWallX, photoY, 3.5, -1, 0, 0.9, 0.7);

  // --- East Wing photos ---
  // North wall: 3 photos
  const enWallZ = ezCenter - ROOM_D / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(exOff - 3, photoY, enWallZ, 0, 1, 0.8, 1.0);
  addPhotoSlot(exOff, photoY, enWallZ, 0, 1, 1.5, 1.0);  // hero
  addPhotoSlot(exOff + 3, photoY, enWallZ, 0, 1, 0.9, 0.7);

  // South wall: 3 photos
  const esWallZ = ezCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(exOff - 3, photoY, esWallZ, 0, -1, 0.9, 0.7);
  addPhotoSlot(exOff, photoY, esWallZ, 0, -1, 1.0, 0.8);
  addPhotoSlot(exOff + 3, photoY, esWallZ, 0, -1, 0.8, 0.6);

  // East wall: 2 photos
  const eeWallX = exOff + ROOM_W / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(eeWallX, photoY, -2.5, -1, 0, 1.0, 0.8);
  addPhotoSlot(eeWallX, photoY, 2.5, -1, 0, 0.8, 1.0);

  // --- Passage photos: 1 per side ---
  const passLeftX = ROOM_W / 2 - WALL_THICKNESS / 2;
  const passRightX = ROOM_W / 2 + PASSAGE_W + WALL_THICKNESS / 2;
  // These face inward (toward passage center)
  addPhotoSlot(passLeftX, photoY, 0, 1, 0, 0.6, 0.9);
  // Right passage wall — note the east wing's west wall
  addPhotoSlot(passRightX, photoY, 0, -1, 0, 0.6, 0.9);

  // ============================
  // KIOSK
  // ============================
  // Pedestal in west wing center
  const kioskBaseGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
  const kioskBase = new THREE.Mesh(kioskBaseGeo, wallMat);
  kioskBase.position.set(0, 0.5, 0);
  scene.add(kioskBase);
  disposables.push(kioskBaseGeo);
  addCollider(0, 0, 0.5, 0.35); // prevent walking through kiosk

  // Angled top surface
  const kioskTopGeo = new THREE.PlaneGeometry(0.7, 0.5);
  const kioskTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const kioskTopMesh = new THREE.Mesh(kioskTopGeo, kioskTopMat);
  kioskTopMesh.position.set(0, 1.05, -0.05);
  kioskTopMesh.rotation.x = -Math.PI / 6; // 30 degrees
  scene.add(kioskTopMesh);
  disposables.push(kioskTopGeo, kioskTopMat);

  // Kiosk spotlight
  const kioskSpot = new THREE.SpotLight(0xfff0d0, 1.5, 6, Math.PI / 5, 0.5);
  kioskSpot.position.set(0, ROOM_H - 0.5, 0);
  kioskSpot.target = kioskTopMesh;
  scene.add(kioskSpot);
  scene.add(kioskSpot.target);

  // ============================
  // BENCH (East Wing center)
  // ============================
  const benchGeo = new THREE.BoxGeometry(1.5, 0.45, 0.5);
  const bench = new THREE.Mesh(benchGeo, wallMat);
  bench.position.set(exOff, 0.225, 0);
  scene.add(bench);
  disposables.push(benchGeo);
  addCollider(exOff, 0, 0.85, 0.35);

  // ============================
  // INFO PANEL
  // ============================
  const infoPanelGeo = new THREE.PlaneGeometry(1.5, 1.2);
  const infoPanelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  // South wall, left of entrance
  const infoPanelX = wxCenter - ROOM_W / 2 + southSegW / 2;
  const infoPanelZ = wzCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  const infoPanelMesh = new THREE.Mesh(infoPanelGeo, infoPanelMat);
  infoPanelMesh.position.set(infoPanelX, 1.5, infoPanelZ);
  infoPanelMesh.rotation.y = Math.PI; // face into room (south wall faces north)
  scene.add(infoPanelMesh);
  disposables.push(infoPanelGeo, infoPanelMat);

  // Info panel spotlight
  const infoSpot = new THREE.SpotLight(0xfff0d0, 1.5, 6, Math.PI / 5, 0.5);
  infoSpot.position.set(infoPanelX, ROOM_H - 0.5, infoPanelZ - 0.5);
  infoSpot.target = infoPanelMesh;
  scene.add(infoSpot);
  scene.add(infoSpot.target);

  // ============================
  // TICKER STRIPS
  // ============================
  const tickerMeshes: THREE.Mesh[] = [];
  const tickerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  disposables.push(tickerMat);

  // West wing — north wall, below crown molding
  const tickerGeoW = new THREE.PlaneGeometry(ROOM_W - 0.5, 0.2);
  const tickerW = new THREE.Mesh(tickerGeoW, tickerMat);
  tickerW.position.set(wxCenter, ROOM_H - MOLDING_SIZE - 0.15, wzCenter - ROOM_D / 2 + WALL_THICKNESS / 2 + 0.01);
  scene.add(tickerW);
  tickerMeshes.push(tickerW);
  disposables.push(tickerGeoW);

  // East wing — north wall
  const tickerGeoE = new THREE.PlaneGeometry(ROOM_W - 0.5, 0.2);
  const tickerE = new THREE.Mesh(tickerGeoE, tickerMat);
  tickerE.position.set(exOff, ROOM_H - MOLDING_SIZE - 0.15, ezCenter - ROOM_D / 2 + WALL_THICKNESS / 2 + 0.01);
  scene.add(tickerE);
  tickerMeshes.push(tickerE);
  disposables.push(tickerGeoE);

  // ============================
  // DETAIL PANEL (initially hidden)
  // ============================
  const detailGeo = new THREE.PlaneGeometry(2.0, 1.5);
  const detailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false });
  const detailPanelMesh = new THREE.Mesh(detailGeo, detailMat);
  detailPanelMesh.visible = false;
  scene.add(detailPanelMesh);
  disposables.push(detailGeo, detailMat);

  return {
    scene,
    camera,
    photoSlots,
    wallColliders,
    kioskTopCenter: new THREE.Vector3(0, 1.05, -0.05),
    kioskTopMesh,
    infoPanelCenter: new THREE.Vector3(infoPanelX, 1.5, infoPanelZ),
    infoPanelMesh,
    tickerMeshes,
    detailPanelMesh,
    disposables,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/modes/gallery-walk/scene.ts
git commit -m "feat(gallery-walk): add Three.js scene geometry, materials, and lights"
```

---

### Task 3: Controls — Pointer Lock, WASD, Collision Detection

**Files:**
- Create: `src/modes/gallery-walk/controls.ts`

- [ ] **Step 1: Create controls.ts**

```ts
import * as THREE from 'three';

const MOVE_SPEED = 3.0;
const SPRINT_SPEED = 5.0;
const PLAYER_RADIUS = 0.3;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = (80 * Math.PI) / 180; // ±80 degrees

interface Collider {
  min: { x: number; z: number };
  max: { x: number; z: number };
}

export interface Controls {
  update(dt: number): void;
  lockPointer(): void;
  unlockPointer(): void;
  isLocked(): boolean;
  onKeydown(e: KeyboardEvent): void;
  onKeyup(e: KeyboardEvent): void;
  onMouseMove(e: MouseEvent): void;
  dispose(): void;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  colliders: Collider[],
): Controls {
  const keys = new Set<string>();
  let yaw = 0;    // horizontal rotation (radians)
  let pitch = 0;  // vertical rotation (radians)
  let locked = false;

  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
  };
  document.addEventListener('pointerlockchange', onLockChange);

  function lockPointer() {
    canvas.requestPointerLock();
  }

  function unlockPointer() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function isLocked() {
    return locked;
  }

  function onKeydown(e: KeyboardEvent) {
    keys.add(e.code);
  }

  function onKeyup(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function onMouseMove(e: MouseEvent) {
    if (!locked) return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  function checkCollision(x: number, z: number): boolean {
    for (const c of colliders) {
      // Expand AABB by player radius
      if (
        x + PLAYER_RADIUS > c.min.x &&
        x - PLAYER_RADIUS < c.max.x &&
        z + PLAYER_RADIUS > c.min.z &&
        z - PLAYER_RADIUS < c.max.z
      ) {
        return true;
      }
    }
    return false;
  }

  function update(dt: number) {
    if (!locked) return;

    // Apply rotation
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    // Movement direction in XZ plane
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : MOVE_SPEED;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    );

    let dx = 0;
    let dz = 0;
    if (keys.has('KeyW')) { dx += forward.x; dz += forward.z; }
    if (keys.has('KeyS')) { dx -= forward.x; dz -= forward.z; }
    if (keys.has('KeyD')) { dx += right.x; dz += right.z; }
    if (keys.has('KeyA')) { dx -= right.x; dz -= right.z; }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      const newX = camera.position.x + dx;
      const newZ = camera.position.z + dz;

      // Try full movement, then slide along axes
      if (!checkCollision(newX, newZ)) {
        camera.position.x = newX;
        camera.position.z = newZ;
      } else if (!checkCollision(newX, camera.position.z)) {
        camera.position.x = newX;
      } else if (!checkCollision(camera.position.x, newZ)) {
        camera.position.z = newZ;
      }
      // else: stuck in corner, don't move
    }
  }

  function dispose() {
    document.removeEventListener('pointerlockchange', onLockChange);
    keys.clear();
  }

  return { update, lockPointer, unlockPointer, isLocked, onKeydown, onKeyup, onMouseMove, dispose };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modes/gallery-walk/controls.ts
git commit -m "feat(gallery-walk): add pointer lock, WASD, and AABB collision controls"
```

---

### Task 4: HiC Bridge — DOM Creation, Texture Injection, Paint Handling

**Files:**
- Create: `src/modes/gallery-walk/hic-bridge.ts`
- Modify: `src/modes/gallery-walk/gallery-walk.css`

- [ ] **Step 1: Create hic-bridge.ts**

This is the core HiC integration module. It creates DOM elements for each photo, injects GL textures into Three.js materials, and handles the paint callback.

```ts
import * as THREE from 'three';
import type { Photo } from '../../types';
import { formatExif } from '../../lib/photos';

export interface HiCEntry {
  id: string;
  dom: HTMLElement;
  glTexture: WebGLTexture;
  threeTexture: THREE.Texture;
  lastUploadTime: number;
  /** Minimum ms between uploads (0 = no throttle) */
  uploadThrottleMs: number;
}

export interface HiCBridge {
  entries: Map<string, HiCEntry>;
  paintCallback: (changedElements: readonly Element[]) => void;
  /** Set the material map for a photo slot */
  bindToMaterial(entryId: string, material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial): void;
  /** Toggle plaque visibility for a photo */
  showPlaque(index: number, visible: boolean): void;
  /** Set inert on a photo element */
  setInert(index: number, inert: boolean): void;
  /** Create and return the detail panel DOM element */
  getDetailDom(): HTMLElement;
  /** Update detail panel content for a specific photo */
  setDetailPhoto(photo: Photo): void;
  dispose(): void;
}

export function createHiCBridge(
  gl: WebGL2RenderingContext,
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  photos: Photo[],
  requestDraw: () => void,
): HiCBridge {
  const entries = new Map<string, HiCEntry>();

  function createGLTexture(): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 1x1 placeholder
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
    return tex;
  }

  function createThreeTexture(glTex: WebGLTexture): THREE.Texture {
    const texture = new THREE.Texture();
    texture.isRenderTargetTexture = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    (renderer.properties.get(texture) as any).__webglTexture = glTex;
    return texture;
  }

  function registerEntry(id: string, dom: HTMLElement, throttleMs = 0): HiCEntry {
    const glTexture = createGLTexture();
    const threeTexture = createThreeTexture(glTexture);
    const entry: HiCEntry = {
      id, dom, glTexture, threeTexture,
      lastUploadTime: 0,
      uploadThrottleMs: throttleMs,
    };
    entries.set(id, entry);
    return entry;
  }

  // --- Create photo DOM elements ---
  const pendingPaintRequests = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const div = document.createElement('div');
    div.id = `gallery-photo-${i}`;
    div.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:512px;height:384px;background:#0a0a0b;';

    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:auto;max-height:280px;object-fit:contain;display:block;margin:0 auto;';
    img.src = photo.medium || photo.thumb;
    img.onload = () => {
      canvas.requestPaint?.();
      requestDraw();
    };

    const plaque = document.createElement('div');
    plaque.className = 'gallery-plaque';
    plaque.style.cssText = 'display:none;padding:8px 12px;text-align:center;';

    const title = document.createElement('div');
    title.className = 'gallery-plaque-title';
    title.textContent = photo.title || `Photograph ${i + 1}`;

    const exif = document.createElement('div');
    exif.className = 'gallery-plaque-exif';
    exif.textContent = formatExif(photo);

    plaque.append(title, exif);
    div.append(img, plaque);
    canvas.appendChild(div);

    registerEntry(`photo-${i}`, div);
  }

  // --- Detail panel DOM ---
  const detailDom = document.createElement('div');
  detailDom.id = 'gallery-detail';
  detailDom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:800px;height:600px;background:#0a0a0b;display:none;';

  const detailImg = document.createElement('img');
  detailImg.style.cssText = 'width:100%;max-height:400px;object-fit:contain;display:block;margin:0 auto;';
  const detailTitle = document.createElement('div');
  detailTitle.className = 'gallery-detail-title';
  const detailDesc = document.createElement('div');
  detailDesc.className = 'gallery-detail-desc';
  const detailExif = document.createElement('div');
  detailExif.className = 'gallery-detail-exif';

  const detailNav = document.createElement('div');
  detailNav.className = 'gallery-detail-nav';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'gallery-detail-btn';
  prevBtn.textContent = '← Previous';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'gallery-detail-btn';
  nextBtn.textContent = 'Next →';
  detailNav.append(prevBtn, nextBtn);

  detailDom.append(detailImg, detailTitle, detailDesc, detailExif, detailNav);
  canvas.appendChild(detailDom);
  registerEntry('detail', detailDom);

  // --- Info panel DOM ---
  const infoDom = document.createElement('div');
  infoDom.id = 'gallery-info';
  infoDom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:600px;height:480px;background:#0a0a0b;';

  const infoScroller = document.createElement('div');
  infoScroller.style.cssText = 'width:100%;height:100%;overflow-y:auto;padding:24px;';

  const infoTitle = document.createElement('h2');
  infoTitle.className = 'gallery-info-title';
  infoTitle.textContent = 'Photography Exhibition';

  const infoStatement = document.createElement('p');
  infoStatement.className = 'gallery-info-statement';
  infoStatement.textContent = 'A curated collection of photographs rendered through the experimental HTML-in-Canvas API. Each image is a live DOM element captured as a WebGL texture, hung on classical museum walls with Three.js lighting and materials.';

  infoScroller.append(infoTitle, infoStatement);

  // Add thumbnail list of works
  const worksList = document.createElement('div');
  worksList.className = 'gallery-info-works';
  for (let i = 0; i < photos.length; i++) {
    const item = document.createElement('div');
    item.className = 'gallery-info-work-item';
    const thumb = document.createElement('img');
    thumb.src = photos[i].thumb;
    thumb.style.cssText = 'width:60px;height:45px;object-fit:cover;';
    const label = document.createElement('span');
    label.textContent = photos[i].title || `Photograph ${i + 1}`;
    item.append(thumb, label);
    worksList.appendChild(item);
  }
  infoScroller.appendChild(worksList);
  infoDom.appendChild(infoScroller);
  canvas.appendChild(infoDom);
  registerEntry('info-panel', infoDom);

  // --- Paint callback ---
  const paintCallback = (changedElements: readonly Element[]) => {
    const now = performance.now();
    let anyUploaded = false;

    for (const [_id, entry] of entries) {
      const isChanged = changedElements.some(
        el => el === entry.dom || entry.dom.contains(el),
      );
      if (!isChanged) continue;

      // Throttle check
      if (entry.uploadThrottleMs > 0 && now - entry.lastUploadTime < entry.uploadThrottleMs) {
        continue;
      }

      // Guard: element must be connected and have size
      if (!entry.dom.isConnected || entry.dom.offsetWidth <= 0 || entry.dom.offsetHeight <= 0) {
        continue;
      }

      gl.bindTexture(gl.TEXTURE_2D, entry.glTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      (gl as any).texElementImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.dom,
      );
      entry.lastUploadTime = now;
      anyUploaded = true;
    }

    if (anyUploaded) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      renderer.state.reset();
    }
    requestDraw();
  };

  function bindToMaterial(entryId: string, material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) {
    const entry = entries.get(entryId);
    if (entry) {
      material.map = entry.threeTexture;
      material.needsUpdate = true;
    }
  }

  function showPlaque(index: number, visible: boolean) {
    const entry = entries.get(`photo-${index}`);
    if (!entry) return;
    const plaque = entry.dom.querySelector('.gallery-plaque') as HTMLElement | null;
    if (!plaque) return;
    if (visible && plaque.style.display === 'none') {
      plaque.style.display = 'block';
      // Gotcha #14: DOM mutation is 1 frame late. Wait 1 RAF then requestPaint.
      requestAnimationFrame(() => {
        canvas.requestPaint?.();
      });
    } else if (!visible && plaque.style.display !== 'none') {
      plaque.style.display = 'none';
      requestAnimationFrame(() => {
        canvas.requestPaint?.();
      });
    }
  }

  function setInert(index: number, inert: boolean) {
    const entry = entries.get(`photo-${index}`);
    if (!entry) return;
    if (inert) {
      entry.dom.setAttribute('inert', '');
    } else {
      entry.dom.removeAttribute('inert');
    }
  }

  function getDetailDom() {
    return detailDom;
  }

  function setDetailPhoto(photo: Photo) {
    detailImg.src = photo.full || photo.medium;
    detailTitle.textContent = photo.title || '';
    detailDesc.textContent = photo.description || '';
    detailExif.textContent = formatExif(photo);
    detailImg.onload = () => {
      canvas.requestPaint?.();
      requestDraw();
    };
  }

  function dispose() {
    for (const [_id, entry] of entries) {
      gl.deleteTexture(entry.glTexture);
      entry.threeTexture.dispose();
      entry.dom.remove();
    }
    entries.clear();
  }

  return {
    entries,
    paintCallback,
    bindToMaterial,
    showPlaque,
    setInert,
    getDetailDom,
    setDetailPhoto,
    dispose,
  };
}
```

- [ ] **Step 2: Add CSS styles for HiC elements**

In `src/modes/gallery-walk/gallery-walk.css`:

```css
/* Gallery Walk HiC element styles */

/* Photo plaques */
.gallery-plaque {
  opacity: 0;
  transition: opacity 300ms ease;
  background: rgba(10, 10, 11, 0.85);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.gallery-plaque[style*="display: block"],
.gallery-plaque[style*="display:block"] {
  opacity: 1;
}

.gallery-plaque-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 14px;
  color: #e8e4df;
  margin-bottom: 4px;
}

.gallery-plaque-exif {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #5a5650;
}

/* Detail panel */
.gallery-detail-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 24px;
  color: #e8e4df;
  text-align: center;
  padding: 16px 24px 4px;
}

.gallery-detail-desc {
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  color: #8a8680;
  text-align: center;
  padding: 0 24px 8px;
}

.gallery-detail-exif {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #5a5650;
  text-align: center;
  padding: 0 24px 16px;
}

.gallery-detail-nav {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 8px;
}

.gallery-detail-btn {
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  color: #e8e4df;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 20px;
  cursor: pointer;
}

/* Info panel */
.gallery-info-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22px;
  color: #e8e4df;
  margin-bottom: 12px;
}

.gallery-info-statement {
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  color: #8a8680;
  line-height: 1.6;
  margin-bottom: 20px;
}

.gallery-info-works {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gallery-info-work-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-family: Inter, system-ui, sans-serif;
  font-size: 12px;
  color: #8a8680;
}

/* Ticker */
.gallery-ticker-content {
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #8a8680;
  line-height: 40px;
}

@keyframes gallery-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Crosshair overlay (outside layoutsubtree) */
.gallery-crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  pointer-events: none;
  z-index: 100;
}

.gallery-crosshair.interactive {
  width: 12px;
  height: 12px;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.6);
}

.gallery-prompt {
  position: fixed;
  top: calc(50% + 16px);
  left: 50%;
  transform: translateX(-50%);
  font-family: Inter, system-ui, sans-serif;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
  z-index: 100;
}

.gallery-enter-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 200;
  cursor: pointer;
}

.gallery-enter-overlay h2 {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2rem;
  color: #e8e4df;
  margin-bottom: 0.5rem;
}

.gallery-enter-overlay p {
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.9rem;
  color: #8a8680;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/modes/gallery-walk/hic-bridge.ts src/modes/gallery-walk/gallery-walk.css
git commit -m "feat(gallery-walk): add HiC bridge with DOM creation, texture injection, and paint handling"
```

---

### Task 5: Interaction — Raycaster, Proximity, and Screen-Projection Passthrough

**Files:**
- Create: `src/modes/gallery-walk/interaction.ts`

- [ ] **Step 1: Create interaction.ts**

```ts
import * as THREE from 'three';
import type { PhotoSlot } from './scene';

export type InteractionState = 'walking' | 'detail' | 'kiosk' | 'info';

export interface InteractionTarget {
  type: 'photo' | 'kiosk' | 'info';
  index?: number; // photo index
  distance: number;
}

export interface InteractionSystem {
  state: InteractionState;
  /** Current target the crosshair is on (or null) */
  target: InteractionTarget | null;
  /** Run proximity + raycaster checks (throttled externally) */
  update(camera: THREE.PerspectiveCamera): void;
  /** Handle E key press */
  interact(): InteractionTarget | null;
  /** Dismiss current interaction */
  dismiss(): void;
  /** Get photo indices within proximity for plaque reveal */
  getProximityPhotos(camera: THREE.PerspectiveCamera, radius: number): Set<number>;
  /** Project a mesh to screen coords for CSS passthrough */
  projectToScreen(
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null;
  dispose(): void;
}

export function createInteractionSystem(
  photoSlots: PhotoSlot[],
  kioskMesh: THREE.Mesh,
  kioskCenter: THREE.Vector3,
  infoPanelMesh: THREE.Mesh,
  infoPanelCenter: THREE.Vector3,
): InteractionSystem {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 5;

  // Build list of interactable meshes
  const photoMeshes = photoSlots.map(s => s.frameMesh);
  const allTargets = [...photoMeshes, kioskMesh, infoPanelMesh];

  let state: InteractionState = 'walking';
  let target: InteractionTarget | null = null;
  let activePhotoIndex = -1;

  function update(camera: THREE.PerspectiveCamera) {
    if (state !== 'walking') return;

    // Cast ray from camera center
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(allTargets, false);

    target = null;
    if (hits.length > 0) {
      const hit = hits[0];
      const obj = hit.object;
      const dist = hit.distance;

      const photoIdx = photoMeshes.indexOf(obj as THREE.Mesh);
      if (photoIdx >= 0 && dist <= 3) {
        target = { type: 'photo', index: photoIdx, distance: dist };
      } else if (obj === kioskMesh && dist <= 2) {
        target = { type: 'kiosk', distance: dist };
      } else if (obj === infoPanelMesh && dist <= 2) {
        target = { type: 'info', distance: dist };
      }
    }
  }

  function interact(): InteractionTarget | null {
    if (state !== 'walking' || !target) return null;
    if (target.type === 'photo') {
      state = 'detail';
      activePhotoIndex = target.index!;
    } else if (target.type === 'kiosk') {
      state = 'kiosk';
    } else if (target.type === 'info') {
      state = 'info';
    }
    return target;
  }

  function dismiss() {
    state = 'walking';
    activePhotoIndex = -1;
    target = null;
  }

  function getProximityPhotos(camera: THREE.PerspectiveCamera, radius: number): Set<number> {
    const near = new Set<number>();
    const camPos = camera.position;
    for (let i = 0; i < photoSlots.length; i++) {
      const dist = camPos.distanceTo(photoSlots[i].position);
      if (dist <= radius) {
        near.add(i);
      }
    }
    return near;
  }

  function projectToScreen(
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null {
    // Get mesh world position
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);

    // Project to NDC
    const ndc = pos.clone().project(camera);
    if (ndc.z < 0 || ndc.z > 1) return null; // behind camera or too far

    // NDC to screen
    const x = (ndc.x * 0.5 + 0.5) * canvasWidth;
    const y = (-ndc.y * 0.5 + 0.5) * canvasHeight;

    // Approximate scale from mesh size and camera distance
    const dist = camera.position.distanceTo(pos);
    if (dist < 0.1) return null;

    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const meshW = box.max.x - box.min.x;
    const meshH = box.max.y - box.min.y;

    // Pixels per meter at this distance (approximate)
    const vFov = camera.fov * (Math.PI / 180);
    const pixelsPerMeter = canvasHeight / (2 * dist * Math.tan(vFov / 2));

    const screenW = meshW * pixelsPerMeter;
    const screenH = meshH * pixelsPerMeter;

    return {
      x: x - screenW / 2,
      y: y - screenH / 2,
      scaleX: screenW / canvasWidth,
      scaleY: screenH / canvasHeight,
    };
  }

  function dispose() {
    // No persistent resources to clean
  }

  return {
    get state() { return state; },
    set state(s) { state = s; },
    get target() { return target; },
    update,
    interact,
    dismiss,
    getProximityPhotos,
    projectToScreen,
    dispose,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modes/gallery-walk/interaction.ts
git commit -m "feat(gallery-walk): add raycaster interaction, proximity checks, and screen-projection"
```

---

### Task 6: Kiosk and Ticker Modules

**Files:**
- Create: `src/modes/gallery-walk/kiosk.ts`
- Create: `src/modes/gallery-walk/ticker.ts`

- [ ] **Step 1: Create kiosk.ts**

```ts
import type { Photo } from '../../types';

const ROOM_W = 12;
const ROOM_D = 10;
const PASSAGE_W = 3;
const EX_OFF = ROOM_W + PASSAGE_W;

/**
 * Creates the kiosk SVG floor plan DOM element.
 * Returns the element and an update function for the player dot.
 */
export function createKioskDom(
  canvas: HTMLCanvasElement,
): { dom: HTMLElement; updatePosition: (x: number, z: number) => void } {
  const dom = document.createElement('div');
  dom.id = 'gallery-kiosk';
  dom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:400px;height:300px;background:#1a1815;padding:16px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-family:"Playfair Display",Georgia,serif;font-size:14px;color:#e8e4df;text-align:center;margin-bottom:8px;';
  title.textContent = 'Gallery Map';

  // SVG floor plan — scale: 1m = ~10px in SVG viewbox
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 140');
  svg.setAttribute('width', '368');
  svg.setAttribute('height', '172');
  svg.style.cssText = 'display:block;margin:0 auto;';

  // West wing room
  const westRoom = document.createElementNS(svgNS, 'rect');
  westRoom.setAttribute('x', '10');
  westRoom.setAttribute('y', '10');
  westRoom.setAttribute('width', '120');
  westRoom.setAttribute('height', '100');
  westRoom.setAttribute('fill', 'none');
  westRoom.setAttribute('stroke', '#5a4f42');
  westRoom.setAttribute('stroke-width', '2');

  // East wing room
  const eastRoom = document.createElementNS(svgNS, 'rect');
  eastRoom.setAttribute('x', '160');
  eastRoom.setAttribute('y', '10');
  eastRoom.setAttribute('width', '120');
  eastRoom.setAttribute('height', '100');
  eastRoom.setAttribute('fill', 'none');
  eastRoom.setAttribute('stroke', '#5a4f42');
  eastRoom.setAttribute('stroke-width', '2');

  // Passage
  const passage = document.createElementNS(svgNS, 'rect');
  passage.setAttribute('x', '130');
  passage.setAttribute('y', '35');
  passage.setAttribute('width', '30');
  passage.setAttribute('height', '40');
  passage.setAttribute('fill', '#1a1815');
  passage.setAttribute('stroke', '#5a4f42');
  passage.setAttribute('stroke-width', '1');

  // Labels
  const westLabel = document.createElementNS(svgNS, 'text');
  westLabel.setAttribute('x', '70');
  westLabel.setAttribute('y', '130');
  westLabel.setAttribute('text-anchor', 'middle');
  westLabel.setAttribute('fill', '#5a5650');
  westLabel.setAttribute('font-size', '10');
  westLabel.setAttribute('font-family', 'Inter, sans-serif');
  westLabel.textContent = 'West Wing';

  const eastLabel = document.createElementNS(svgNS, 'text');
  eastLabel.setAttribute('x', '220');
  eastLabel.setAttribute('y', '130');
  eastLabel.setAttribute('text-anchor', 'middle');
  eastLabel.setAttribute('fill', '#5a5650');
  eastLabel.setAttribute('font-size', '10');
  eastLabel.setAttribute('font-family', 'Inter, sans-serif');
  eastLabel.textContent = 'East Wing';

  // Player dot
  const dot = document.createElementNS(svgNS, 'circle');
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', '#e05050');
  dot.setAttribute('cx', '70');
  dot.setAttribute('cy', '90'); // default: near entrance
  dot.style.cssText = 'transition: cx 500ms ease, cy 500ms ease;';

  // Blinking animation
  const animate = document.createElementNS(svgNS, 'animate');
  animate.setAttribute('attributeName', 'opacity');
  animate.setAttribute('values', '1;0.3;1');
  animate.setAttribute('dur', '1.5s');
  animate.setAttribute('repeatCount', 'indefinite');
  dot.appendChild(animate);

  svg.append(westRoom, eastRoom, passage, westLabel, eastLabel, dot);
  dom.append(title, svg);
  canvas.appendChild(dom);

  // Map world coords to SVG coords
  function updatePosition(worldX: number, worldZ: number) {
    // World X: west wing center=0, east wing center=EX_OFF
    // World Z: -ROOM_D/2 (north) to +ROOM_D/2 (south)
    // SVG: west wing 10-130 x, east wing 160-280 x, y 10-110
    let svgX: number;
    if (worldX < ROOM_W / 2 + PASSAGE_W / 2) {
      // West wing or passage left
      svgX = 10 + ((worldX + ROOM_W / 2) / ROOM_W) * 120;
    } else {
      // East wing
      svgX = 160 + ((worldX - EX_OFF + ROOM_W / 2) / ROOM_W) * 120;
    }
    const svgY = 10 + ((worldZ + ROOM_D / 2) / ROOM_D) * 100;

    dot.setAttribute('cx', String(Math.max(10, Math.min(290, svgX))));
    dot.setAttribute('cy', String(Math.max(10, Math.min(110, svgY))));
  }

  return { dom, updatePosition };
}
```

- [ ] **Step 2: Create ticker.ts**

```ts
import type { Photo } from '../../types';
import { formatExif } from '../../lib/photos';

/**
 * Creates ticker DOM elements for both wings.
 */
export function createTickerDom(
  canvas: HTMLCanvasElement,
  photos: Photo[],
): { westDom: HTMLElement; eastDom: HTMLElement } {
  function makeTicker(id: string, startIndex: number): HTMLElement {
    const dom = document.createElement('div');
    dom.id = id;
    dom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:1280px;height:40px;background:#0a0a0b;';

    const content = document.createElement('div');
    content.className = 'gallery-ticker-content';

    // Build ticker text — duplicate for seamless loop
    let text = '';
    for (let i = 0; i < photos.length; i++) {
      const idx = (startIndex + i) % photos.length;
      const photo = photos[idx];
      const title = photo.title || `Photograph ${idx + 1}`;
      const exif = formatExif(photo);
      text += `  ◆  ${title}  ·  ${exif}`;
    }
    // Duplicate for seamless marquee
    content.textContent = text + text;
    content.style.animation = 'gallery-marquee 60s linear infinite';

    dom.appendChild(content);
    canvas.appendChild(dom);
    return dom;
  }

  return {
    westDom: makeTicker('gallery-ticker-west', 0),
    eastDom: makeTicker('gallery-ticker-east', Math.floor(photos.length / 2)),
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/modes/gallery-walk/kiosk.ts src/modes/gallery-walk/ticker.ts
git commit -m "feat(gallery-walk): add kiosk SVG map and ticker marquee modules"
```

---

### Task 7: Wire Everything Together — gallery-walk.ts Orchestrator

**Files:**
- Modify: `src/modes/gallery-walk/gallery-walk.ts` (replace stub)

- [ ] **Step 1: Replace gallery-walk.ts with full orchestrator**

Replace the stub in `src/modes/gallery-walk/gallery-walk.ts` with the full implementation that wires scene, controls, HiC bridge, interaction, kiosk, and ticker together. This is the main ModeImpl factory.

```ts
import * as THREE from 'three';
import type { ModeImpl, ModeContext } from '../../types';
import { getShuffledPhotos } from '../../lib/photos';
import { createGalleryScene } from './scene';
import { createControls } from './controls';
import { createHiCBridge } from './hic-bridge';
import { createInteractionSystem } from './interaction';
import { createKioskDom } from './kiosk';
import { createTickerDom } from './ticker';
import './gallery-walk.css';

const PLAQUE_RADIUS = 3;
const LOD_RADIUS = 15;
const PROXIMITY_INTERVAL = 200;
const RAYCASTER_INTERVAL = 100;
const KIOSK_UPDATE_INTERVAL = 500;

export default function createGalleryWalk(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos: allPhotos, size, dpr, requestDraw, setAnimating } = ctx;

  // Randomize and select 18 photos
  const photos = allPhotos.slice(0, 18);

  // --- Three.js setup ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.autoClear = true;
  renderer.setPixelRatio(dpr);
  renderer.setSize(size.w, size.h, false);

  const gallery = createGalleryScene(size.w / size.h);

  // --- Controls ---
  const controls = createControls(gallery.camera, canvas, gallery.wallColliders);

  // --- HiC Bridge ---
  const hic = createHiCBridge(gl, renderer, canvas, photos, requestDraw);

  // Bind photo textures to scene materials
  for (let i = 0; i < photos.length && i < gallery.photoSlots.length; i++) {
    const slot = gallery.photoSlots[i];
    hic.bindToMaterial(`photo-${i}`, slot.mesh.material as THREE.MeshStandardMaterial);
  }

  // --- Kiosk ---
  const kiosk = createKioskDom(canvas);
  const kioskEntry = hic.entries.get('kiosk-map');
  // Register kiosk DOM with HiC bridge manually
  const kioskGlTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, kioskGlTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
    gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
  const kioskThreeTex = new THREE.Texture();
  kioskThreeTex.isRenderTargetTexture = true;
  kioskThreeTex.colorSpace = THREE.SRGBColorSpace;
  kioskThreeTex.flipY = false;
  (renderer.properties.get(kioskThreeTex) as any).__webglTexture = kioskGlTex;
  hic.entries.set('kiosk', {
    id: 'kiosk', dom: kiosk.dom, glTexture: kioskGlTex,
    threeTexture: kioskThreeTex, lastUploadTime: 0, uploadThrottleMs: 0,
  });
  (gallery.kioskTopMesh.material as THREE.MeshStandardMaterial).map = kioskThreeTex;
  (gallery.kioskTopMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;

  // --- Ticker ---
  const ticker = createTickerDom(canvas, photos);
  // Register ticker entries
  function registerTickerEntry(id: string, dom: HTMLElement, mesh: THREE.Mesh) {
    const gltex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, gltex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
    const threeTex = new THREE.Texture();
    threeTex.isRenderTargetTexture = true;
    threeTex.colorSpace = THREE.SRGBColorSpace;
    threeTex.flipY = false;
    (renderer.properties.get(threeTex) as any).__webglTexture = gltex;
    hic.entries.set(id, {
      id, dom, glTexture: gltex, threeTexture: threeTex,
      lastUploadTime: 0, uploadThrottleMs: 100,
    });
    (mesh.material as THREE.MeshBasicMaterial).map = threeTex;
    (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }
  registerTickerEntry('ticker-west', ticker.westDom, gallery.tickerMeshes[0]);
  registerTickerEntry('ticker-east', ticker.eastDom, gallery.tickerMeshes[1]);

  // Bind info panel texture
  hic.bindToMaterial('info-panel', gallery.infoPanelMesh.material as THREE.MeshStandardMaterial);

  // Bind detail panel texture
  hic.bindToMaterial('detail', gallery.detailPanelMesh.material as THREE.MeshBasicMaterial);

  // --- Interaction system ---
  const interaction = createInteractionSystem(
    gallery.photoSlots,
    gallery.kioskTopMesh,
    gallery.kioskTopCenter,
    gallery.infoPanelMesh,
    gallery.infoPanelCenter,
  );

  // --- UI overlays (outside layoutsubtree) ---
  const crosshair = document.createElement('div');
  crosshair.className = 'gallery-crosshair';
  document.body.appendChild(crosshair);

  const prompt = document.createElement('div');
  prompt.className = 'gallery-prompt';
  prompt.style.display = 'none';
  document.body.appendChild(prompt);

  const enterOverlay = document.createElement('div');
  enterOverlay.className = 'gallery-enter-overlay';
  enterOverlay.innerHTML = '<h2>Gallery Walk</h2><p>Click to explore · WASD to move · Mouse to look</p><p style="margin-top:0.5rem;font-size:0.75rem;color:#5a5650;">Requires keyboard and mouse</p>';
  document.body.appendChild(enterOverlay);

  enterOverlay.addEventListener('click', () => {
    enterOverlay.remove();
    controls.lockPointer();
    setAnimating(true);
  });

  // --- Register paint callback ---
  ctx.setModePaint(hic.paintCallback);
  canvas.requestPaint?.();

  // --- Throttle timers ---
  let lastProximityCheck = 0;
  let lastRaycastCheck = 0;
  let lastKioskUpdate = 0;
  const visiblePlaques = new Set<number>();

  // --- Staggered load tracking ---
  let loadRadius = 5; // Start uploading photos within 5m
  const maxLoadRadius = LOD_RADIUS;

  // --- Event handlers ---
  function onKeydown(e: KeyboardEvent) {
    controls.onKeydown(e);

    if (e.code === 'KeyE') {
      if (interaction.state === 'walking') {
        const result = interaction.interact();
        if (result) {
          controls.unlockPointer();
          if (result.type === 'photo' && result.index != null) {
            hic.setDetailPhoto(photos[result.index]);
            const detailDom = hic.getDetailDom();
            detailDom.style.display = 'block';
            gallery.detailPanelMesh.visible = true;
            (gallery.detailPanelMesh.material as THREE.MeshBasicMaterial).visible = true;
            requestAnimationFrame(() => canvas.requestPaint?.());
          }
          crosshair.style.display = 'none';
          prompt.style.display = 'none';
        }
      } else {
        dismissInteraction();
      }
    }

    if (e.code === 'Escape' && interaction.state !== 'walking') {
      dismissInteraction();
    }
  }

  function dismissInteraction() {
    interaction.dismiss();
    controls.lockPointer();
    crosshair.style.display = '';
    // Hide detail panel
    const detailDom = hic.getDetailDom();
    detailDom.style.display = 'none';
    gallery.detailPanelMesh.visible = false;
    (gallery.detailPanelMesh.material as THREE.MeshBasicMaterial).visible = false;
    // Reset pointer events on all HiC elements
    for (const [_id, entry] of hic.entries) {
      entry.dom.style.pointerEvents = 'none';
    }
  }

  function onKeyup(e: KeyboardEvent) {
    controls.onKeyup(e);
  }

  function onMouseMove(e: MouseEvent) {
    controls.onMouseMove(e);
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('keyup', onKeyup);
  document.addEventListener('mousemove', onMouseMove);

  // --- Main paint loop ---
  const mode: ModeImpl = {
    paint(dt: number) {
      const now = performance.now();

      // Update controls
      controls.update(dt);

      // Expand staggered load radius
      if (loadRadius < maxLoadRadius) {
        loadRadius = Math.min(loadRadius + 3, maxLoadRadius);
      }

      // Throttled proximity checks
      if (now - lastProximityCheck > PROXIMITY_INTERVAL) {
        lastProximityCheck = now;
        const nearby = interaction.getProximityPhotos(gallery.camera, PLAQUE_RADIUS);

        // Show/hide plaques
        for (let i = 0; i < photos.length; i++) {
          if (nearby.has(i) && !visiblePlaques.has(i)) {
            hic.showPlaque(i, true);
            visiblePlaques.add(i);
          } else if (!nearby.has(i) && visiblePlaques.has(i)) {
            hic.showPlaque(i, false);
            visiblePlaques.delete(i);
          }
        }

        // Accessibility: set inert on distant photos
        const inLOD = interaction.getProximityPhotos(gallery.camera, LOD_RADIUS);
        for (let i = 0; i < photos.length; i++) {
          hic.setInert(i, !inLOD.has(i));
        }
      }

      // Throttled raycaster
      if (now - lastRaycastCheck > RAYCASTER_INTERVAL) {
        lastRaycastCheck = now;
        interaction.update(gallery.camera);

        // Update crosshair
        if (interaction.state === 'walking') {
          if (interaction.target) {
            crosshair.classList.add('interactive');
            prompt.style.display = '';
            prompt.textContent = interaction.target.type === 'photo'
              ? 'Press E to view'
              : interaction.target.type === 'kiosk'
                ? 'Press E for gallery map'
                : 'Press E to read';
          } else {
            crosshair.classList.remove('interactive');
            prompt.style.display = 'none';
          }
        }
      }

      // Throttled kiosk update
      if (now - lastKioskUpdate > KIOSK_UPDATE_INTERVAL) {
        lastKioskUpdate = now;
        kiosk.updatePosition(gallery.camera.position.x, gallery.camera.position.z);
        canvas.requestPaint?.();
      }

      // Render
      renderer.render(gallery.scene, gallery.camera);
    },

    isAnimating() { return true; },

    onResize(newSize: { w: number; h: number }) {
      renderer.setSize(newSize.w, newSize.h, false);
      gallery.camera.aspect = newSize.w / newSize.h;
      gallery.camera.updateProjectionMatrix();
      requestDraw();
    },

    destroy() {
      // 1. Pointer events
      for (const [_id, entry] of hic.entries) {
        entry.dom.style.pointerEvents = 'none';
        entry.dom.removeAttribute('inert');
      }

      // 2. Clear paint callback
      ctx.setModePaint(null);

      // 3. Release pointer lock
      controls.unlockPointer();

      // 4. Remove event listeners
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keyup', onKeyup);
      document.removeEventListener('mousemove', onMouseMove);

      // 5. Dispose Three.js objects
      for (const d of gallery.disposables) {
        d.dispose();
      }

      // 6. Dispose HiC bridge
      hic.dispose();

      // 7. Dispose subsystems
      controls.dispose();
      interaction.dispose();

      // 8. Remove UI overlays
      crosshair.remove();
      prompt.remove();
      enterOverlay.remove();

      // 9. Dispose renderer (may invalidate GL context — spike item)
      renderer.dispose();

      // 10. Stop animation
      setAnimating(false);
    },
  };

  return mode;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/photo-portfolio && npx tsc --noEmit`

- [ ] **Step 3: Run all tests**

Run: `cd /Users/iser/workspace/photo-portfolio && npm test`

Expected: All tests pass. (The gallery-walk module itself isn't unit-tested — it requires a browser with HiC. The tests validate type integration and learn content.)

- [ ] **Step 4: Commit**

```bash
git add src/modes/gallery-walk/gallery-walk.ts
git commit -m "feat(gallery-walk): wire orchestrator connecting scene, controls, HiC, and interaction"
```

---

### Task 8: Build Verification and Final Integration Test

**Files:**
- Modify: `src/nav/__tests__/nav.test.ts` (if hardcoded to 4)

- [ ] **Step 1: Fix nav test if needed**

Check if the nav test hardcodes button count. The test at line `expect(modeButtons).toHaveLength(MODE_ORDER.length)` is dynamic — it uses `MODE_ORDER.length`, so it should auto-adjust. But line `expect(ctrlButtons).toHaveLength(3)` is for control buttons, not mode buttons — that's fine.

No changes needed if the test uses `MODE_ORDER.length` for mode button count.

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/iser/workspace/photo-portfolio && npm test`

Expected: All tests pass.

- [ ] **Step 3: Run production build**

Run: `cd /Users/iser/workspace/photo-portfolio && npm run build`

Expected: Build succeeds. Three.js is code-split into the gallery-walk chunk.

- [ ] **Step 4: Commit any fixes**

If any test or build fixes were needed:

```bash
git add -A
git commit -m "fix(gallery-walk): fix test and build integration issues"
```

---

### Task 9: Documentation Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add `gallery-walk` to the mode list in the project overview. Update the mode count from 4 to 5. Add Three.js to the tech stack. Update the file structure to include the gallery-walk directory.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for gallery-walk mode"
```
