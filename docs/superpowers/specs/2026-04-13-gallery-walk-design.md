# Gallery Walk Mode — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Mode name:** `gallery-walk`

A first-person 3D museum gallery walk through a figure-8 floor plan. Photos hang on classical museum walls with ornate frames and warm spotlighting. The user explores freely with WASD + mouse look. Five distinct HTML-in-Canvas showcase features demonstrate capabilities impossible without the API: proximity-revealed plaques, interactive detail panels, a wayfinding kiosk, an entrance info panel, and an ambient ticker.

---

## 1. Scene Architecture & Three.js Integration

### Renderer Setup

Three.js `WebGLRenderer` wraps the shell's existing canvas:

```ts
const renderer = new THREE.WebGLRenderer({ canvas: ctx.canvas, antialias: false });
renderer.autoClear = true;
renderer.setPixelRatio(ctx.dpr);
renderer.setSize(ctx.size.w, ctx.size.h, false);
```

**Context strategy:** Pass `canvas` only (let Three.js create its context) or pass both `canvas` and `context: ctx.gl`. **Spike during implementation** to verify which approach lets the shell reclaim the context on mode destroy.

### HiC Texture Bridge

Use the validated injection pattern from `docs/html-in-canvas-research.md` Section 10. Do NOT use `ExternalTexture`.

```ts
const glTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, glTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const texture = new THREE.Texture();
texture.isRenderTargetTexture = true;    // Prevents texStorage2D (Gotcha #19)
texture.colorSpace = THREE.SRGBColorSpace; // Three.js handles sRGB→linear
texture.flipY = false;                   // We flip during upload (Gotcha #7)
(renderer.properties.get(texture) as any).__webglTexture = glTexture;
```

### State Reset (Hard Requirement)

After every `texElementImage2D` call in the paint handler, call `renderer.state.reset()` to re-sync Three.js's GL state cache (Gotcha #4). Call once per paint event after all uploads, not per upload.

### sRGB Handling

`texture.colorSpace = THREE.SRGBColorSpace` makes Three.js auto-linearize when sampling in `MeshStandardMaterial`. Do NOT manually linearize — that would double-linearize. This mode does not use custom GLSL shaders.

### RAF Ownership

Shell's loop drives timing. `renderer.setAnimationLoop` is NOT used. `mode.paint(dt)` calls `renderer.render(scene, camera)`.

### DPR Sync

`renderer.setPixelRatio(ctx.dpr)` and `renderer.setSize(ctx.size.w, ctx.size.h, false)` on init and in `onResize()`. Also update `camera.aspect` and call `camera.updateProjectionMatrix()` on resize.

### Dispose

On `destroy()`: dispose all Three.js geometries, materials, textures, then `renderer.dispose()`. **Spike #1:** verify the shell can reinitialize its GL context afterward. If not, skip `renderer.dispose()` and manually clean up.

---

## 2. Floor Plan, Geometry & Environment

### Layout

Two rectangular rooms (West Wing, East Wing) connected by a central passage. The passage creates the figure-8 crossover. All walls axis-aligned for simple collision detection.

### Dimensions (1 unit = 1 meter)

- Each room: 12m wide x 10m deep x 4m tall
- Passage: 3m wide x 4m deep, ceiling lowered to 3.5m
- Arched header trim at each passage entrance
- Total footprint: ~27m x 10m

### Photo Distribution

**18 photos**, randomized from the 45-photo pool on each mode load:

| Wall Segment | Count | Notes |
|---|---|---|
| North walls (12m, x2) | 3 each = 6 | Mix of hero + standard |
| South walls (12m, x2) | 3 each = 6 | Entrance wall has 2 (entrance takes space) |
| West wall (10m) | 2 | Outer wall |
| East wall (10m) | 2 | Outer wall |
| Passage walls (x2) | 1 each = 2 | Intimate corridor display |
| **Total** | **18** | |

Photo sizes: hero ~1.5m wide, standard ~0.8-1.0m, portrait ~0.6m x 0.9m. Center of photo at 1.5m from floor (eye level).

### Geometry

| Element | Geometry | Material |
|---|---|---|
| Walls | `BoxGeometry`, 0.15m thick | `MeshStandardMaterial` color:#3d342b, roughness:0.8, metalness:0.0 |
| Crown molding | `ExtrudeGeometry`, L-profile | color:#5a4f42, roughness:0.8 |
| Baseboards | `ExtrudeGeometry`, small profile | color:#5a4f42, roughness:0.8 |
| Floor | `PlaneGeometry` | color:#2d2620, roughness:0.6, metalness:0.0 |
| Ceiling | `PlaneGeometry` | color:#e8e0d0, roughness:0.9 |
| Photo frames | `ExtrudeGeometry`, ornate profile | color:#b8960c, roughness:0.35, metalness:0.7 (gold/brass) |
| Photo planes | `PlaneGeometry`, recessed 0.02m in frame | `MeshStandardMaterial` with HiC texture |
| Kiosk pedestal | `BoxGeometry` base + angled top | Wall material, 0.8m x 0.5m x 1.0m |
| Bench (East Wing) | `BoxGeometry`, 1.5m x 0.5m x 0.45m | Wall material |
| Info panel bezel | Thin frame, 1.5m x 1.2m | Molding material |
| Ticker strips | `PlaneGeometry`, 12m x 0.2m (x2) | `MeshBasicMaterial` with HiC texture |

### Special Elements

- **Entrance:** Open archway in south wall of West Wing, ~4m wide, with trim.
- **Player spawn:** 1m inside entrance, facing north.
- **Kiosk:** Center of West Wing. Angled top surface (~30 degrees).
- **Bench:** Center of East Wing.
- **Info panel:** South wall, left of entrance. 1.5m x 1.2m, wall-mounted.
- **Ticker strips:** Below crown molding, north wall of each room.

---

## 3. HiC Texture Pipeline

### DOM Structure

Each photo position gets a dedicated `<div>` inside the canvas `layoutsubtree` subtree:

```html
<canvas layoutsubtree>
  <!-- 18 photo elements -->
  <div id="photo-0" style="overflow:hidden; width:512px; height:384px;">
    <img src="..." style="width:100%; object-fit:contain;" />
    <div class="plaque" style="display:none;">
      <div class="plaque-title">Title</div>
      <div class="plaque-exif">24mm  f/3.5  1/1250s  ISO 3200</div>
    </div>
  </div>
  <!-- ... photo-1 through photo-17 ... -->

  <!-- Interactive elements -->
  <div id="kiosk-map" style="overflow:hidden; width:400px; height:300px;">
    <svg><!-- floor plan SVG --></svg>
  </div>

  <div id="info-panel" style="overflow:hidden; width:600px; height:480px;">
    <div style="overflow-y:auto; width:100%; height:100%;">
      <!-- scrollable exhibition info -->
    </div>
  </div>

  <div id="ticker-west" style="overflow:hidden; width:100%; height:40px;">
    <div class="ticker-content" style="animation: marquee 30s linear infinite;">
      <!-- scrolling text -->
    </div>
  </div>

  <div id="ticker-east" style="overflow:hidden; width:100%; height:40px;">
    <!-- same pattern -->
  </div>

  <div id="detail-panel" style="overflow:hidden; display:none; width:800px; height:600px;">
    <!-- large photo, full info, prev/next buttons -->
  </div>
</canvas>
```

**DOM rules (from gotchas):**
- All outer divs use `overflow:hidden` (Gotcha #28 — `overflow:auto/scroll` crashes)
- Scrollable content uses nested inner div with `overflow-y:auto`
- No `<dialog>` or `popover` (Gotcha #17 — escapes to top layer)
- No `backdrop-filter` or `mix-blend-mode` (Gotchas #8, #9)
- No `box-shadow` on HiC elements (Gotcha #12 — clips to border box). Use `border` instead.
- No `<input>`, `<textarea>`, or `contenteditable` (Gotcha #15 — caret blink fires paint)
- All photo assets same-origin (Gotcha #10)

### Texture Injection

One injected Three.js texture per DOM element:
- 18 photo textures (512x384 CSS → 1024x768 at 2x DPR, ~3MB each)
- 1 kiosk texture (400x300 CSS → 800x600, ~1.9MB)
- 1 info panel texture (600x480 CSS → 1200x960, ~4.6MB)
- 2 ticker textures (viewport-width x 40px CSS → ~2560x80, ~0.8MB each)
- 1 detail panel texture (800x600 CSS → 1600x1200, ~7.7MB, only when open)

Each uses the `THREE.Texture` + `__webglTexture` injection pattern with `isRenderTargetTexture = true`, `colorSpace = SRGBColorSpace`, `flipY = false`.

### Paint Callback

Registered via `ctx.setModePaint()` (single paint listener, Gotcha #29):

```ts
ctx.setModePaint((changedElements) => {
  for (const [id, entry] of trackedElements) {
    if (changedElements.some(el => el === entry.dom || entry.dom.contains(el))) {
      if (entry.dom.isConnected && entry.dom.offsetWidth > 0 && entry.dom.offsetHeight > 0) {
        gl.bindTexture(gl.TEXTURE_2D, entry.glTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.dom);
      }
    }
  }
  renderer.state.reset(); // Once after all uploads (Gotcha #4)
  requestDraw();
});
```

### Staggered Initial Uploads

On first load, only upload 4-5 photos nearest spawn. Expand upload radius by ~3m per frame over subsequent frames until all visible photos are uploaded. Prevents ~54MB GPU upload spike.

### `requestPaint()` Discipline

Call only when DOM content changes:
- Image loads → `requestPaint()`
- Plaque toggled → wait 1 RAF frame (Gotcha #14 — DOM mutations are 1 frame late), then `requestPaint()`
- Kiosk position update → `requestPaint()`
- Ticker: CSS animation fires paint automatically — no manual `requestPaint()` needed

Do NOT call `requestPaint()` every frame. `setAnimating(true)` keeps the render loop alive for camera movement; paint events are independent.

### Accessibility

Photos outside the visibility radius (~15m) get `inert` attribute set (Gotcha #18). Prevents screen readers from announcing invisible photos. Remove `inert` when photo enters the radius.

### Title Generation

Hardcode curator-style titles and descriptions in the photo manifest (`src/photos.json`). The 45 title/description fields are currently empty — fill them in as a one-time task. Each plaque shows: title + EXIF line.

---

## 4. HiC Showcase Features

Five distinct demonstrations, each showing something impossible without HiC.

### 4a. Photo Plaques (Proximity Reveal)

- Hidden when camera >3m (`display:none`), shown when <3m (`display:block`)
- CSS `opacity` transition (0→1 over 300ms) — captured live by HiC into texture
- **1-frame delay:** Toggle display → wait 1 RAF → `requestPaint()` (Gotcha #14)
- Proximity checks throttled to every ~200ms
- **Demonstrates:** CSS transitions running live on 3D-projected surfaces

### 4b. Interactive Detail Panel

- Triggered by pressing E when crosshair is on a photo within 3m
- Persistent `<div>` (NOT `<dialog>`) toggled visible via `display`
- Contains: large photo, full title, description, EXIF, prev/next `<button>` elements
- Rendered as HiC texture on `PlaneGeometry` that animates from wall toward camera
- **Interaction via screen-projection passthrough:** When active, project panel mesh corners to screen coords, apply CSS `transform: translate(x,y) scale(sx,sy)` on DOM element, set `pointerEvents: 'auto'`. Buttons receive native DOM events.
- Pointer lock releases when detail opens. Press Escape or E to dismiss — animates back, `pointerEvents: 'none'`, re-locks pointer.
- **Demonstrates:** Interactive buttons on 3D surface, animation of HiC-textured geometry

### 4c. Wayfinding Kiosk

- Freestanding pedestal, center of West Wing
- Interactive SVG floor plan on angled top surface
- Blinking dot shows player position, updated every ~500ms (CSS transition smooths between)
- **Interaction via raycaster:** Angled surface is not screen-aligned, so use raycaster → UV → CSS transform positioning. Set `pointerEvents: 'auto'` when within 2m and E pressed.
- **Demonstrates:** Live SVG with CSS animations on non-flat 3D surface, real-time data binding through HiC

### 4d. Entrance Info Panel

- 1.5m x 1.2m wall-mounted panel, south wall left of entrance
- Two-layer overflow: outer `overflow:hidden`, inner `overflow-y:auto`
- Contains: exhibition title, artist statement, scrollable work list with thumbnails
- **Interaction via screen-projection passthrough:** Flat wall surface. `pointerEvents: 'auto'` when within 2m and E pressed. Scrolling works natively.
- **Demonstrates:** Scrollable content on 3D wall, full CSS typography through HiC

### 4e. Ambient Ticker

- Two horizontal strips below crown molding, north wall of each room
- CSS `animation: marquee` with `translateX` — continuous scroll within fixed-width frame
- Content: photo titles and EXIF cycling, decorative dividers
- **Throttled uploads:** CSS animation fires continuous paint. Throttle ticker texture uploads to every ~100ms (10fps). Track last upload timestamp per ticker element, skip if <100ms elapsed.
- **Demonstrates:** CSS keyframe animations captured live by HiC on 3D geometry

---

## 5. Navigation & Controls

### Pointer Lock

`canvas.requestPointerLock()` on first click. Show "Click to explore" overlay (regular DOM outside `layoutsubtree`) on mode entry. While locked, `mousemove` delta drives camera yaw (horizontal) and pitch (vertical, clamped ±80 degrees).

### Movement

- W/S: forward/back along camera look direction (XZ plane only — no flying)
- A/D: strafe left/right
- Speed: ~3m/s. Shift: sprint ~5m/s.
- Camera Y fixed at 1.6m (eye height). No jump, no crouch.

### Collision Detection

AABB checks against wall segments. Player bounding circle radius 0.3m. On collision, slide along wall face (project movement onto wall normal) — smooth wall-sliding, not dead stop. No physics engine needed — all walls are axis-aligned rectangles.

### Crosshair & Interaction Prompts

- 4px semi-transparent white dot, HTML overlay outside `layoutsubtree`, always screen-center
- Ring style when pointing at interactive element within range
- "Press E to view" text below crosshair when in range
- "Requires keyboard and mouse" note in entrance overlay

### Interaction State Machine

```
WALKING (pointer locked, all HiC pointerEvents:'none')
  │
  ├─ E on photo (within 3m) ──→ DETAIL_VIEW
  ├─ E on kiosk (within 2m) ──→ KIOSK_VIEW
  ├─ E on info (within 2m)  ──→ INFO_VIEW
  │
DETAIL_VIEW (pointer unlocked, detail panel pointerEvents:'auto')
  ├─ Escape / E ──→ WALKING
  │
KIOSK_VIEW (pointer unlocked, kiosk pointerEvents:'auto')
  ├─ Escape / E ──→ WALKING
  │
INFO_VIEW (pointer unlocked, info panel pointerEvents:'auto')
  ├─ Escape / E ──→ WALKING
```

### Raycaster

Throttled to every ~100ms. Cast from camera center. Check intersections with: photo frame meshes (within 3m), kiosk top (within 2m), info panel (within 2m).

### Screen-Projection Passthrough (for flat surfaces)

Project mesh quad corners to screen coordinates via `camera.projectionMatrix * camera.matrixWorldInverse * mesh.matrixWorld`. Map to CSS `transform: translate(x,y) scale(sx,sy)` on the DOM element. Set `pointerEvents: 'auto'`. Native browser events route correctly.

Used for: detail panel, info panel, photo plaques.

### Raycaster Passthrough (for angled surfaces)

For the kiosk's angled top: raycaster → intersection UV → map to DOM coords → CSS `transform` positioning.

### Desktop Only

No touch controls. HiC flag already limits to Chrome Canary desktop.

---

## 6. Lighting & Atmosphere

| Light | Type | Color | Intensity | Notes |
|---|---|---|---|---|
| Ambient | `AmbientLight` | #2a2018 | 0.15 | Warm fill, prevents pure black |
| Photo spots (x18) | `SpotLight` | #fff0d0 | 2.0 | angle:30deg, penumbra:0.5, castShadow:false |
| Kiosk spot | `SpotLight` | #fff0d0 | 1.5 | Highlights interactive map |
| Info panel spot | `SpotLight` | #fff0d0 | 1.5 | Highlights panel |
| Passage fill | `PointLight` | #fff0d0 | 0.5 | Center of passage, gentle fill |

Photo spots positioned ~0.5m below ceiling, aimed at photo center. No shadow mapping (18 shadow maps is too expensive).

### Materials Summary

| Surface | Color | Roughness | Metalness | Emissive |
|---|---|---|---|---|
| Photo planes | HiC texture | 0.4 | 0.0 | #0a0808 @ 0.1 |
| Frames | #b8960c | 0.35 | 0.7 | — |
| Walls | #3d342b | 0.8 | 0.0 | — |
| Molding | #5a4f42 | 0.8 | 0.0 | — |
| Floor | #2d2620 | 0.6 | 0.0 | — |
| Ceiling | #e8e0d0 | 0.9 | 0.0 | — |

---

## 7. Performance

### Texture Upload LOD

Only upload HiC textures for photos within ~15m of camera. Photos outside keep their last texture or placeholder. Check distance per photo each frame (cheap vector length from camera position to photo world position).

### Staggered Initial Load

First frame: upload 4-5 nearest photos. Expand radius by ~3m per subsequent frame until steady state. Prevents ~54MB upload spike on mode entry.

### Throttling

| System | Interval | Reason |
|---|---|---|
| Proximity checks | ~200ms | Plaque show/hide doesn't need 60fps |
| Kiosk position dot | ~500ms | CSS transition smooths between updates |
| Ticker uploads | ~100ms | 10fps is smooth enough for scrolling text |
| Raycaster | ~100ms | Interaction detection doesn't need 60fps |

### VRAM Budget

| Element | Size (at 2x DPR) | Count | Active VRAM |
|---|---|---|---|
| Photo textures | 1024x768 (~3MB) | ~8-10 active | ~24-30MB |
| Kiosk | 800x600 (~1.9MB) | 1 | ~1.9MB |
| Info panel | 1200x960 (~4.6MB) | 1 | ~4.6MB |
| Ticker strips | 2560x80 (~0.8MB) | 2 | ~1.6MB |
| Detail panel | 1600x1200 (~7.7MB) | 0-1 | 0-7.7MB |
| **Total** | | | **~32-46MB** |

Well within GPU limits.

### Frame Budget

Target 60fps on mid-range desktop. Scene is ~30 meshes + ~10 active textures. Three.js frustum culls automatically. Bottleneck is texture uploads — mitigated by LOD radius and throttling.

### Texture Filtering

`gl.LINEAR` only. No mipmaps — `texElementImage2D` doesn't support mipmap levels, and HiC textures aren't power-of-two.

---

## 8. Integration with Mode System

### Registration

- Add `'gallery-walk'` to `ModeName` union in `src/types.ts`
- Add to `MODE_LABELS`: `'gallery-walk': 'Gallery'`
- Add to `MODE_ORDER` (position 5)
- Add dynamic import to `modeLoaders` in `src/main.ts`
- Update landing page hint: "Press 1–5"

### File Structure

```
src/modes/gallery-walk/
  gallery-walk.ts      — ModeImpl factory (orchestrator)
  scene.ts             — Three.js scene setup (geometry, materials, lights)
  controls.ts          — Pointer lock, WASD, collision detection
  hic-bridge.ts        — DOM creation, texture injection, paint handling
  interaction.ts       — Raycaster, proximity, passthrough, detail panel
  kiosk.ts             — Wayfinding kiosk logic + SVG map
  ticker.ts            — Ambient ticker CSS animation
  gallery-walk.css     — Styles for HiC elements
```

### Dependencies

- `three` (npm, pinned exact version). Tree-shakeable — import only used modules.
- No other new dependencies.

### Code Splitting

Dynamic `import()` in `modeLoaders`. Three.js ships only with this mode's chunk.

### Learn Drawer

New entry in `src/learn/content.ts` explaining gallery walk HiC techniques.

### Destroy Checklist

1. Set `pointerEvents: 'none'` on all HiC elements
2. Remove `inert` from all elements
3. Clear paint callback: `ctx.setModePaint(null)`
4. Release pointer lock if held
5. Remove event listeners (keydown, etc.)
6. Dispose all Three.js geometries, materials, textures
7. Dispose PaintTracker entries
8. Call `renderer.dispose()` (or manual cleanup — see Spike #1)
9. Remove all DOM elements from canvas
10. Call `setAnimating(false)`

---

## 9. Gotcha Cross-Reference

Every research doc gotcha verified against this design:

| # | Gotcha | Mitigation |
|---|---|---|
| 1 | texElementImage2D outside paint | All uploads in paint callback |
| 2 | Upload before first paint | hasFirstPaint() guard + staggered uploads |
| 3 | display:contents on root | All roots are concrete divs |
| 4 | Three.js state desync | renderer.state.reset() after uploads |
| 5 | Shader compile failure | Three.js built-in shaders; no custom GLSL |
| 5a | overflow:auto/scroll crashes | Two-layer pattern everywhere |
| 5b | Multiple paint listeners | Shell's single listener + callback |
| 6 | sRGB linearization | texture.colorSpace = SRGBColorSpace |
| 7 | Y-flip | UNPACK_FLIP_Y_WEBGL=true + texture.flipY=false |
| 8 | backdrop-filter ignored | Not used |
| 9 | mix-blend-mode doubles | Not used |
| 10 | Cross-origin transparent | All assets same-origin |
| 11 | DPR handling | renderer.setPixelRatio(ctx.dpr) |
| 12 | Overflow clips box-shadow | Use border, not box-shadow |
| 13 | No removedElements | Toggle display, no element removal |
| 14 | DOM mutations 1 frame late | 1-RAF delay before requestPaint on toggles |
| 15 | Caret blink | No input/textarea in HiC elements |
| 17 | dialog/popover escape | Use div, not dialog |
| 18 | Accessibility | inert on invisible photos |
| 19 | No texSubElementImage2D | isRenderTargetTexture=true prevents texStorage2D |
| 20 | No hit-test regions | Raycaster + screen-projection |
| 23 | #version 300 es first line | No custom GLSL |
| 24 | View Transitions crash | Not used |
| 25 | Cleanup in destroy | 10-step checklist |
| 26 | Shell RAF guard | Shell skips guard when modeHook set |
| 27 | Vite ?raw no #include | No custom GLSL |
| 28 | overflow crash | Two-layer pattern |
| 29 | Multiple paint listeners | Shell callback pattern |

---

## 10. Implementation Spikes

Two items require early validation:

1. **Context sharing:** Can Three.js accept the shell's existing WebGL2 context via `{ canvas, context: gl }`, or must it create its own? If it creates its own, can the shell reinitialize afterward?

2. **Dispose behavior:** Does `renderer.dispose()` destroy the GL context? If so, we skip it and manually dispose Three.js objects.

Both should be spiked in the first implementation task before building the full scene.

---

## 11. Design Advantages

- **No custom GLSL:** Entire mode uses Three.js built-in `MeshStandardMaterial`. Eliminates gotchas #5, #23, #27 and the `common.glsl` sync burden.
- **Proven patterns:** Every HiC pattern (paint callback, texture injection, overflow workaround, single listener) is validated in the research doc.
- **Incremental HiC showcase:** Five distinct HiC features, each demonstrating a different capability. The gallery walk cannot exist without HiC because it requires all four HiC pillars simultaneously: full CSS fidelity, custom shader math (via Three.js materials), preserved interactivity, and real browser affordances.
