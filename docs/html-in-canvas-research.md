# HTML-in-Canvas: Production Guide for AI Agents

**Last updated:** 2026-04-12
**Status:** Experimental (Chrome flag `chrome://flags/#canvas-draw-element`). Actively churning — demos have broken in Canary builds. Feature-detect aggressively.
**Spec:** https://github.com/WICG/html-in-canvas
**Validated against:** A 17-mode photography portfolio built entirely on this API (Astro + Preact + vanilla TS + WebGL2 + Three.js).

---

## How to Read This Document

You are an AI agent building an application that uses the HTML-in-Canvas API. This document is organized as:

1. **What it is** — concept and comparison to prior art
2. **API reference** — every primitive, its signatures, and its behavior
3. **Architecture** — proven production patterns from a real app
4. **Render pipeline** — exact frame timing and upload rules
5. **Interactivity** — how hit testing and event passthrough work
6. **Shaders** — patterns for applying GPU effects to HTML textures
7. **TypeScript** — type augmentations for the API
8. **CSS behavior** — what works, what's ignored, what breaks
9. **Gotchas** — consolidated list of every trap, with workarounds
10. **Reference demos** — techniques from open-source implementations

When a section says "MUST" or "CRITICAL", the advice comes from observed crashes, silent failures, or spec requirements — not preference.

---

## 1. What Is HTML-in-Canvas?

HTML-in-Canvas is a WICG proposal that lets you **place real DOM elements inside a `<canvas>` tag** and **draw them onto the canvas surface** as 2D images or WebGL/WebGPU textures. The DOM elements remain live: they receive events, are accessible to screen readers, and update in real time. The canvas captures a pixel snapshot of their rendered output and composites it into the graphics pipeline.

**The key insight:** HTML-in-Canvas doesn't re-implement rendering — it reuses the browser's own layout engine and exposes the rendered pixels to canvas/WebGL contexts.

This is fundamentally different from all prior approaches:

| Approach | How It Works | Limitations |
|----------|-------------|-------------|
| **html2canvas** | Parses DOM + replicates CSS in JS | ~45KB, incomplete CSS, no interactivity, slow |
| **SVG foreignObject** | Wraps HTML in SVG | No interactivity, tainted canvas, limited CSS |
| **Satori** | Converts JSX to SVG (server-side) | Static only, CSS subset, no browser APIs |
| **CSS filters** | `blur()`, `brightness()`, etc. | Limited set, no custom shaders, no compositing |
| **HTML-in-Canvas** | Native browser rendering + direct pixel/texture capture | Full CSS, full interactivity, custom GLSL shaders |

An application "cannot exist without" HTML-in-Canvas when it requires all four of these simultaneously:
1. **Full CSS text/layout fidelity** (fonts, Grid, Flexbox, `<input>`, `contenteditable`, `alt` text, screen reader access)
2. **Custom GLSL shader math** over the HTML pixels each frame
3. **Interactivity preserved** on warped / 3D-projected / scattered surfaces
4. **Real browser affordances** (keyboard focus, tab navigation, text selection, link hovers, accessibility tree)

---

## 2. API Reference

### 2.1 `layoutsubtree` Attribute

```html
<canvas layoutsubtree>
  <div id="my-content">
    <h1>This is real HTML</h1>
    <button onclick="alert('works!')">Click me</button>
    <input type="text" placeholder="Type here..." />
  </div>
</canvas>
```

When `layoutsubtree` is set on a `<canvas>`:
- **Direct children** participate in layout, hit testing, and accessibility
- Children are laid out by the browser but **not visually rendered** until explicitly drawn
- Children behave as if visible (box models, hover states, etc.)
- The canvas's fallback content mechanism is repurposed for structured, interactive content

**Automatic side effects on direct children:**
1. Each child gets a **stacking context**
2. Each child becomes a **containing block** for all descendants
3. Each child gets **paint containment** (equivalent to `contain: paint`)
4. Children are **visible-but-not-rendered-unless-drawn**

This is stronger than a CSS Houdini paint worklet. Paint containment breaks layout tricks that rely on descendants escaping the parent's box.

### 2.2 `drawElementImage()` — 2D Context

```js
const ctx = canvas.getContext('2d');
const element = canvas.firstElementChild;

// Three signature forms (mirror drawImage):
ctx.drawElementImage(element, dx, dy);                           // position
ctx.drawElementImage(element, dx, dy, dw, dh);                  // position + size
ctx.drawElementImage(element, sx, sy, sw, sh, dx, dy, dw, dh);  // crop + position + size
```

**Returns a `DOMMatrix`** (not void). You need the returned matrix to synchronize the source element's CSS `transform` for hit testing. Forgetting this breaks interaction.

The canvas's current transformation matrix (set via `ctx.translate()`, `ctx.rotate()`, `ctx.scale()`, `ctx.setTransform()`) applies when drawing. CSS transforms on the source element are **ignored for drawing** but continue to affect hit testing.

### 2.3 `texElementImage2D()` — WebGL Texture Binding

```js
const gl = canvas.getContext('webgl2');
const element = canvas.firstElementChild;

gl.texElementImage2D(
  gl.TEXTURE_2D,    // target
  0,                 // level
  gl.RGBA,           // internalformat
  gl.RGBA,           // format
  gl.UNSIGNED_BYTE,  // type
  element            // source element
);
```

This captures the element's rendered pixels as a WebGL texture. It means you can apply **any GLSL shader** to live HTML content — distortion, chromatic aberration, noise, film grain, color grading, water ripple, lens effects, etc.

**CRITICAL:** This call MUST happen inside a `paint` event handler. Calling from `requestAnimationFrame` has been observed to crash the GPU process in Canary builds (issues #108, #109). The `paint` handler is when the browser has just taken a fresh snapshot, so the texture data is well-defined.

**Signature is `texImage2D`-like, not `texSubImage2D`-like.** Incompatible with `texStorage2D` immutable textures (issue #33). A `texSubElementImage2D` companion has been requested but not added.

### 2.4 `copyElementImageToTexture()` — WebGPU

```js
const device = await navigator.gpu.requestAdapter().then(a => a.requestDevice());
device.queue.copyElementImageToTexture(
  { element },
  { texture: gpuTexture },
  [element.offsetWidth, element.offsetHeight]
);
```

Lives on `GPUQueue`, not `GPUDevice`.

### 2.5 `paint` Event

```js
canvas.addEventListener('paint', (event) => {
  // event.changedElements — FrozenArray<Element> of children whose rendering changed
  const gl = canvas.getContext('webgl2');
  for (const el of event.changedElements) {
    gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
  }
});

// Manually trigger a paint cycle
canvas.requestPaint();
```

The `paint` event fires when the rendering of canvas children changes. Key behaviors:

- **Snapshot is taken BEFORE `paint` fires** — you always draw a consistent state
- **CSS transform changes on children do NOT trigger `paint`** — by design, for performance
- **`changedElements` is a `FrozenArray<Element>`** — currently a linear list. Issue #95 argues it should be a map; plan for an O(n) scan and key by `id` yourself
- **There is no `removedElements`** (issue #85). Diff `canvas.children` yourself between frames
- **DOM mutations inside the handler are deferred** (applied one frame later), but canvas drawing commands are same-frame
- **Caret blink in a focused `<input>` fires paint every ~500ms** (issue #82) — battery drain and fingerprint vector. Defocus while drawing, or lift inputs out of the canvas subtree while idle
- **`requestPaint()` in a worker gives empty `changedElements`** (issue #96) — track elements manually

`requestPaint()` fires the paint event once on the next rendering update. To keep a loop alive, call `requestPaint()` inside the handler, or drive uploads from a plain RAF loop (but upload inside paint, not RAF — see section 4).

### 2.6 `captureElementImage()` — Transferable Snapshots

```js
const snapshot = canvas.captureElementImage(element);
// snapshot is Transferable — can send to workers
// Returns synchronously (not a Promise)
worker.postMessage({ img: snapshot }, [snapshot]);
```

**Lifetime is undefined** (issue #88). Two debated models: new snapshot per paint, or one live per-element. Rule of thumb: re-capture every frame. Do not cache across frames.

### 2.7 `getElementTransform()` — DOM Synchronization

```js
const cssTransform = canvas.getElementTransform(element, drawTransform);
element.style.transform = cssTransform;
```

Returns a CSS `matrix3d()` transform string positioning the DOM element to match its drawn location. Exists on both `HTMLCanvasElement` and `OffscreenCanvas`.

The sync-transform formula (from the spec README):
`T_origin⁻¹ · S_(css→grid)⁻¹ · T_draw · S_(css→grid) · T_origin`, where `T_draw = CTM · T_(x,y) · S_destScale`.

---

## 3. Architecture — Proven Production Patterns

This section describes the architecture used in a production 17-mode photography portfolio. Every pattern here has been validated against real HTML-in-Canvas behavior.

### 3.1 Single Shared WebGL2 Context

Use ONE WebGL2 context for the entire app:

```ts
// context.ts — singleton
export function initGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  return canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
}
```

**Why:** A canvas can only have one context. Sharing it lets mode transitions blend two textures in the same frame, and shared resources (programs, textures) are created once.

### 3.2 Canvas Root — Shell Owns the Loop

The shell component owns the `<canvas layoutsubtree>`, the GL context, the paint event listener, and the RAF loop. Modes never manage their own RAF loop.

```
<canvas layoutsubtree id="app-canvas">
  <div id="mode-root">   ← mode content lives here
    ...photos, UI, controls...
  </div>
  <div id="hud-root">    ← HUD overlay
    ...navigation, mode switcher...
  </div>
</canvas>
```

The shell exposes hooks for modes to plug into:

```ts
// Mode hook — replaces default passthrough draw
window.__photographyCanvas?.setModeHook((ctx) => myMode.draw(ctx));

// Overlay hook — runs AFTER passthrough draw
window.__photographyCanvas?.setOverlayHook((ctx) => myMode.drawOverlay(ctx));

// Request a single frame
window.__photographyCanvas?.requestDraw();

// Keep loop running continuously
window.__photographyCanvas?.setAnimating(true);
```

**When to use which hook:**
- **Mode hook** — when the mode takes over rendering entirely (custom shader, 3D scene)
- **Overlay hook** — when the mode renders HTML normally (via passthrough) then applies shader effects on top (e.g., darkroom develop curve over photo cards)

### 3.3 Paint Tracker — Per-Child Texture Management

A `PaintTracker` class manages one WebGL texture per direct canvas child:

```ts
class PaintTracker {
  register(el: HTMLElement, id: string): void;    // Create texture + set sampler params
  uploadDirect(el: HTMLElement): void;             // texElementImage2D inside paint handler
  unregister(el: HTMLElement): void;               // Delete texture
  getTextureById(id: string): WebGLTexture | null; // Query by id
  isDirty(): boolean;                              // Anything changed?
  clearDirty(): void;
  hasFirstPaint(): boolean;                        // Has the first paint event fired?
  dispose(): void;                                 // Cleanup everything
}
```

Texture initialization:
```ts
register(el, id) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
```

Upload (MUST be called from paint handler):
```ts
uploadDirect(el) {
  if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return;  // skip 0-size elements
  gl.bindTexture(gl.TEXTURE_2D, entry.texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
}
```

### 3.4 Dirty-Flag RAF Loop

The render loop is event-driven, not continuous:

```ts
let idle = true;
let dirty = false;
let animating = false;

canvas.addEventListener('paint', (e) => {
  for (const el of e.changedElements) {
    tracker.uploadDirect(el);  // Upload inside paint handler
  }
  dirty = true;
  wake();  // Start RAF loop if idle
});

function draw(now: number) {
  if (document.hidden || !tracker.hasFirstPaint()) {
    sleep();
    return;
  }

  // ... draw work (modes, passthrough, overlays) ...

  dirty = false;
  if (animating || dirty) {
    requestAnimationFrame(draw);  // Keep looping
  } else {
    sleep();  // Wait for next paint event
  }
}

function wake() {
  if (idle) {
    idle = false;
    requestAnimationFrame(draw);
  }
  dirty = true;
}

function sleep() {
  cancelAnimationFrame(rafId);
  idle = true;
}
```

The loop only runs when:
1. A paint event fires (new textures to draw)
2. A mode calls `ctx.dirty()` (request a single frame)
3. A mode sets `isAnimating() === true` (continuous animation)

### 3.5 Mode Lifecycle

Each mode is a vanilla TypeScript class implementing:

```ts
interface ModeImpl {
  paint(dt: number): void;                       // Called every frame
  isAnimating?(): boolean;                       // Return true to keep looping
  onPointer?(ev: PointerEvent): void;
  onKey?(ev: KeyboardEvent): void;
  onResize?(size: { w: number; h: number }): void;
  destroy(): void;                               // Cleanup GL resources + DOM
}
```

**Boot sequence:**
1. Feature-detect HTML-in-Canvas
2. Get shared GL context (already initialized by shell)
3. Load photo catalog
4. Dynamic-import the mode class (code-splitting)
5. Build ModeContext (gl, canvas, root, photos, locale, size, dpr, storage, dirty callback)
6. Construct mode instance

**Key rule:** Modes never create their own GL context, never manage their own RAF loop, never directly listen for paint events. The shell handles all of this.

### 3.6 Feature Detection

```ts
function detectHtmlInCanvas(): 'supported' | 'missing-api' | 'broken' | 'server' {
  if (typeof window === 'undefined') return 'server';

  // 1. requestPaint on HTMLCanvasElement prototype
  if (typeof HTMLCanvasElement.prototype.requestPaint !== 'function') return 'missing-api';

  // 2. texElementImage2D on WebGL2 prototype (probe a temporary context)
  const probe = document.createElement('canvas');
  probe.width = 1; probe.height = 1;
  const gl = probe.getContext('webgl2');
  if (!gl || typeof gl.texElementImage2D !== 'function') return 'missing-api';

  // 3. drawElementImage on CanvasRenderingContext2D prototype
  if (typeof CanvasRenderingContext2D.prototype.drawElementImage !== 'function')
    return 'missing-api';

  return 'supported';
}
```

**CRITICAL:** Do NOT try to call `texElementImage2D` synchronously during detection. The spec requires the browser to take a paint snapshot first (via the paint event lifecycle). A synchronous live-call test would always fail even on working builds. You can only detect API presence, not API correctness — runtime failures surface as exceptions in the paint handler.

---

## 4. Render Pipeline — Exact Frame Timing

Understanding the frame timing is essential. Getting it wrong causes crashes or blank frames.

```
Frame N:
  1. Browser lays out canvas children (normal CSS layout)
  2. Browser takes a paint snapshot of each child
  3. `paint` event fires with changedElements list
  4. YOUR CODE: inside paint handler, call texElementImage2D() for each changed child
  5. YOUR CODE: set dirty flag, wake RAF loop
  6. RAF fires: bind textures, draw quads, apply shaders
  7. Canvas composites into page

Between paint events:
  - RAF frames draw using the MOST RECENT snapshot textures
  - texElementImage2D() outside of paint has undefined behavior (observed: GPU crash)
  - Changing a child's CSS transform does NOT trigger paint (efficient for hover effects)
```

**The iron rule:** Upload textures in paint. Draw with textures in RAF. Never mix them.

**The dirty-flag upload pattern:**
```ts
let dirty = true;
canvas.addEventListener('paint', () => { uploadTextures(); dirty = true; });

function renderLoop() {
  if (dirty) {
    // Draw using previously uploaded textures
    drawScene();
    dirty = false;
  }
  if (animating || dirty) requestAnimationFrame(renderLoop);
}
```

### DPR (Device Pixel Ratio) Handling

DPR is NOT automatic. Without explicit handling, text renders blurry on retina displays.

```ts
function resizeCanvas(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Backing buffer: physical pixels
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));

  // CSS size: CSS pixels
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  // GL viewport matches backing buffer
  gl.viewport(0, 0, canvas.width, canvas.height);
}
```

Alternative: use `ResizeObserver` with `device-pixel-content-box`:
```ts
new ResizeObserver(([entry]) => {
  canvas.width = entry.devicePixelContentBoxSize[0].inlineSize;
  canvas.height = entry.devicePixelContentBoxSize[0].blockSize;
}).observe(canvas, { box: 'device-pixel-content-box' });
```

---

## 5. Interactivity — Hit Testing & Event Passthrough

This is what makes HTML-in-Canvas fundamentally different from all prior approaches.

### How It Works

1. Children are **real DOM elements** — they receive native events (click, hover, focus, input)
2. CSS transforms on children affect **hit testing** but are **ignored for texture capture**
3. A shader can visually distort content (refraction, rotation, etc.) but clicks still register on the actual DOM positions

This means: links, buttons, inputs, selects, contenteditable, scrollable areas — all work natively inside canvas compositions with full accessibility. Even when the content is shader-warped.

### 2D Passthrough (Most Modes)

For flat 2D modes, the browser automatically routes events to DOM elements. No special handling needed — pointer events land on the correct HTML elements because their layout positions are preserved.

Modes listen to `canvas` events for shader-specific behavior (e.g., cursor position for effects):
```ts
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;   // Normalized 0..1
  const y = (e.clientY - rect.top) / rect.height;
  // Pass x, y to shader as uniform
});
```

### 3D Passthrough (Raycasting)

For 3D modes (content mapped onto meshes), use raycasting to translate pointer → UV → DOM transform:

```ts
const updateElementPosition = (clientX: number, clientY: number) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hit = raycaster.intersectObject(mesh)[0];
  if (!hit?.uv) return;

  const el = canvas.firstElementChild as HTMLElement;
  const texX = hit.uv.x * el.offsetWidth;
  const texY = (1 - hit.uv.y) * el.offsetHeight;
  el.style.transform = `translate(${clientX - rect.left - texX}px, ${clientY - rect.top - texY}px)`;
};
```

**Why this works:** The spec guarantees CSS transforms affect hit testing but NOT texture capture. The DOM element is positioned where the user's pointer is, so native click/input/selection events route correctly, while the shader continues reading the unrotated texture.

### Screen-Projection Passthrough (Simpler Than Raycasting)

For simple 3D cases where the mesh is a flat quad:

```ts
function applyScreenTransform(camera: Camera, wrapper: HTMLElement) {
  const bounds = getScreenBounds(camera);  // Project 3D quad corners to viewport
  const scaleX = bounds.width / window.innerWidth;
  const scaleY = bounds.height / window.innerHeight;
  wrapper.style.transformOrigin = '0 0';
  wrapper.style.transform = `translate(${bounds.x}px, ${bounds.y}px) scale(${scaleX}, ${scaleY})`;
  wrapper.style.pointerEvents = 'auto';
}
```

**Pattern:** Set `pointerEvents: 'none'` when the user isn't interacting with the content, flip to `'auto'` when they are (e.g., "seated" in a virtual room).

---

## 6. Shader Patterns

### 6.1 Y-Flip Strategy

HTML's origin is top-left; WebGL's is bottom-left. Pick ONE strategy and be consistent:

**Strategy A (recommended): Flip during texture upload, use standard UVs**
```ts
// During upload:
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);

// Quad UVs are standard 0..1:
const vertices = new Float32Array([
  // a_pos     a_uv
  -1, -1,     0, 0,    // bottom-left
   1, -1,     1, 0,
  -1,  1,     0, 1,
   1,  1,     1, 1,    // top-right
]);
```

**Strategy B: Flip in vertex shader**
```glsl
v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
```

### 6.2 sRGB Color Space Handling

**CRITICAL:** HTML textures are sRGB-encoded. You MUST linearize before any shader math or your colors will be wrong.

```glsl
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 html = srgbToLinear(texture(u_tex, v_uv).rgb);  // Linearize
  // ... all shader math in linear space ...
  frag_color = vec4(linearToSrgb(result), 1.0);         // Back to sRGB
}
```

Every shader in the production codebase includes these functions. Omitting them causes visibly incorrect gamma in blending, mixing, and power operations.

### 6.3 Universal Vertex Shader

All modes can share one vertex shader. Only fragment shaders differ.

```glsl
#version 300 es
precision highp float;

in vec2 a_pos;   // -1..1 quad corners
in vec2 a_uv;    // 0..1 UV (pre-flipped if using Strategy A)
out vec2 v_uv;

uniform vec4 u_dst;  // (x, y, w, h) in clip space

void main() {
  vec2 clip = u_dst.xy + (a_pos * 0.5 + 0.5) * u_dst.zw;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
}
```

### 6.4 Passthrough Fragment Shader

The simplest shader — draw HTML texture 1:1:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;
uniform sampler2D u_tex;

void main() {
  frag_color = texture(u_tex, v_uv);
}
```

### 6.5 Common Uniform Conventions

| Uniform | Type | Purpose |
|---------|------|---------|
| `u_tex` / `u_screen` | `sampler2D` | HTML texture |
| `u_photo` | `sampler2D` | Photo image texture (separate from HTML) |
| `u_resolution` | `vec2` | Canvas size in physical pixels (`w * dpr, h * dpr`) |
| `u_time` | `float` | Seconds since mode mounted |
| `u_dst` | `vec4` | Destination rect in clip space (x, y, w, h) |
| `u_mousePos` | `vec2` | Normalized cursor position (0..1) |

Mode-specific uniforms follow the pattern `u_<name>` (e.g., `u_drops[12]`, `u_dissolve`, `u_temperature`).

### 6.6 Clip-Space Rect Conversion

Converting a CSS pixel rect to clip space for the `u_dst` uniform:

```ts
const x0 = (rect.left / canvasWidth) * 2 - 1;
const y0 = -((rect.top + rect.height) / canvasHeight) * 2 + 1;  // Y flipped
const w = (rect.width / canvasWidth) * 2;
const h = (rect.height / canvasHeight) * 2;
gl.uniform4f(program.uniform('u_dst'), x0, y0, w, h);
```

### 6.7 Common Shader Utility Functions

**Film grain:**
```glsl
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// Usage: time-varying grain
float grain = hash21(v_uv * u_resolution + u_time * 0.2) - 0.5;
col += grain * grainStrength;
```

**Chromatic aberration (per-channel UV offsets):**
```glsl
vec2 dir = v_uv - center;
float r = texture(u_tex, v_uv + dir * 0.003).r;
float g = texture(u_tex, v_uv).g;
float b = texture(u_tex, v_uv - dir * 0.003).b;
frag_color = vec4(r, g, b, 1.0);
```

**Barrel distortion:**
```glsl
vec2 center = v_uv - 0.5;
float r2 = dot(center, center);
vec2 distorted = v_uv + center * r2 * distortionStrength;
```

**Vignette:**
```glsl
float vignette = 1.0 - smoothstep(0.4, 0.8, length(v_uv - 0.5));
col *= vignette;
```

### 6.8 Shader Compilation

Always check compile and link status synchronously. A broken shader silently produces an unlinked program, `useProgram()` is a no-op, and the canvas renders blank with no error:

```ts
gl.compileShader(shader);
if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
  throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
}

gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`Link failed: ${gl.getProgramInfoLog(program)}`);
}
```

### 6.9 Texture Placeholder Pattern

Load textures asynchronously with a placeholder to prevent shader crashes:

```ts
// 1x1 placeholder initially
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
              gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));

// Real image asynchronously
const img = new Image();
img.src = photoUrl;
img.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  requestDraw();
};
```

---

## 7. TypeScript Type Augmentations

The HTML-in-Canvas API is not in TypeScript's lib. You need these type augmentations:

```ts
// canvas-hic.d.ts

// --- JSX attributes (for frameworks) ---
// Astro:
declare namespace astroHTML.JSX {
  interface CanvasHTMLAttributes {
    layoutsubtree?: boolean | '' | 'true' | undefined;
  }
}
// Preact:
declare namespace preact.JSX {
  interface HTMLAttributes<RefType extends EventTarget = EventTarget> {
    layoutsubtree?: boolean | '' | 'true' | undefined;
  }
}
// React: extend React.CanvasHTMLAttributes<HTMLCanvasElement> similarly

// --- Runtime DOM augmentations ---
interface HTMLCanvasElement {
  requestPaint?(): void;
  captureElementImage?(element: Element): Transferable;
  getElementTransform?(element: Element, drawTransform?: DOMMatrix): string;
}

interface WebGL2RenderingContext {
  texElementImage2D?(
    target: number, level: number, internalformat: number,
    format: number, type: number, source: Element,
  ): void;
}

interface OffscreenCanvas {
  requestPaint?(): void;
  captureElementImage?(element: Element): Transferable;
  getElementTransform?(element: Element, drawTransform?: DOMMatrix): string;
}

interface CanvasRenderingContext2D {
  drawElementImage?(element: Element, dx: number, dy: number): DOMMatrix;
  drawElementImage?(element: Element, dx: number, dy: number, dw: number, dh: number): DOMMatrix;
  drawElementImage?(
    element: Element,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): DOMMatrix;
}

// --- Paint event ---
interface HTMLElementEventMap {
  paint: PaintEvent;
}

interface PaintEvent extends Event {
  readonly changedElements: readonly Element[];
}
```

All methods are declared with `?` because they only exist behind a flag. Your code must always check for their existence before calling.

For GLSL imports with bundlers (Vite, etc.):
```ts
// glsl.d.ts
declare module '*.glsl' {
  const source: string;
  export default source;
}
declare module '*?raw' {
  const source: string;
  export default source;
}
```

---

## 8. CSS Behavior Inside `layoutsubtree`

### What Works (Everything)

HTML-in-Canvas uses the browser's real layout engine:
- Flexbox, Grid, multi-column layout
- `position: absolute/relative/fixed/sticky`
- `overflow: scroll` (scrollable regions)
- `transform`, `transition`, `animation` (for layout — ignored for canvas drawing)
- `@font-face`, variable fonts, `font-feature-settings`
- `border-radius`, `box-shadow`, `clip-path`, `mask`
- Media queries, container queries
- `contenteditable`, `<input>`, `<select>`, `<textarea>`
- `<video>`, `<img>`, `<svg>` — nested media
- CSS custom properties
- `:hover`, `:focus`, `:active` pseudo-classes
- Find-in-page highlights, text-fragment highlights, scrollbars, `forced-colors`

### What's Ignored or Broken

| Feature | Behavior | Workaround |
|---------|----------|------------|
| `backdrop-filter` | **Completely ignored** (#47) | Implement blur/glass in shaders |
| `mix-blend-mode` | **Applied twice** (#47) | Avoid on subtree children; blend in shader |
| Subpixel text AA | Suppressed — always grayscale-AA | Accept slightly thicker text |
| Visited-link colors | Suppressed (timing-attack fix #29) | None needed |
| System colors, spelling markers, autofill previews | Privacy-suppressed | None |
| `<dialog>`, `popover`, `requestFullscreen()` | **Escape to top layer**, invisible to draw (#53) | Avoid inside subtree |
| `display: contents` on subtree root | **Throws** (#48) | Wrap in a concrete `<div>` |
| Cross-origin content | **Silently becomes transparent** (#77) | All assets same-origin or CORS-whitelisted |
| Overflow | **Clipped to border box** including ink overflow | Reserve larger box or render shadows in shader |

### Cross-Origin Gotcha (Important)

Cross-origin iframes, `<img crossorigin>` failing CORS, SVG `<use>` across origins, and `background-image: url(...)` without CORS headers all become transparent silently. There is NO developer signal — no error, no warning. Every asset you draw must be same-origin or CORS-whitelisted.

---

## 9. Consolidated Gotchas

Every trap discovered during development, with workarounds. Organized by severity.

### Will Crash or Silently Fail

1. **`texElementImage2D` outside paint handler** — crashes GPU process in Canary. Always call inside `paint` event handler.
2. **Calling `texElementImage2D` before first paint** — undefined behavior. Wait for `hasFirstPaint()`.
3. **`display: contents` on subtree root** — throws. Wrap in a concrete `<div>`, not a Fragment.
4. **Three.js state cache after `texElementImage2D`** — Three's internal GL state desyncs. Call `renderer.state.reset()` after upload, OR inject your own GL texture: `renderer.properties.get(texture).__webglTexture = glTexture` and set `texture.isRenderTargetTexture = true`.
5. **Shader compile failure with no error check** — renders blank forever. Always check compile/link status synchronously.

### Will Produce Wrong Results

6. **Not linearizing sRGB** — shader math in sRGB space produces incorrect gamma. Use `srgbToLinear()` / `linearToSrgb()`.
7. **Wrong Y orientation** — HTML is top-left, GL is bottom-left. Use `UNPACK_FLIP_Y_WEBGL=true` on upload AND compensate in clip-space math.
8. **`backdrop-filter` ignored** — glass/blur effects must be implemented in shaders.
9. **`mix-blend-mode` doubles** — avoid on subtree children.
10. **Cross-origin images silently transparent** — every asset same-origin or CORS-enabled.
11. **No DPR handling** — text renders blurry on retina. Size backing buffer to `width * dpr`.
12. **Overflow clipped to border box** — `box-shadow`, `filter: drop-shadow`, and absolutely positioned children outside the box are cut off.

### Will Cause Subtle Bugs

13. **No `removedElements` in paint event** — diff `canvas.children` yourself to detect removals.
14. **DOM mutations in paint handler are 1 frame late** — canvas draws are same-frame, but DOM changes apply next frame. Plan two-frame reactions if measuring then reacting.
15. **Caret blink fires paint every ~500ms** — battery drain. Defocus inputs while idle.
16. **`requestPaint()` in workers gives empty `changedElements`** — track elements manually.
17. **`dialog`, `popover`, fullscreen escape to top layer** — invisible to `drawElementImage`.
18. **Accessibility tree doesn't know which children are drawn** — mark undrawn subtrees `inert` or `aria-hidden`.
19. **No `texSubElementImage2D`** — can't use `texStorage2D` immutable textures with HTML content.
20. **No hit-test regions for WebGL** — raycasting is your responsibility.
21. **Text is always grayscale-AA** — slightly thicker than regular DOM text.
22. **`ElementImage` lifetime is undefined** — re-capture every frame, don't cache across frames.

### Discovered During Implementation (2026-04-12)

23. **`#version 300 es` must be the absolute first line in GLSL shaders** — no comments, no whitespace before it. When importing GLSL via Vite's `?raw` suffix, the file content is used verbatim. Any leading comments before `#version` cause `ERROR: '#' : #version directive must occur on the first line of the shader`. Put doc comments AFTER the `#version` and `precision` declarations.
24. **View Transitions API crashes the GPU process** — `document.startViewTransition()` captures before/after snapshots of the page. During this capture, the browser can trigger `texElementImage2D` outside the paint handler, causing Chrome Error code: 11 (GPU process crash). Do NOT use View Transitions with HiC canvases. Use instant DOM switches instead.
25. **Modes managing their own PaintTracker must fully clean up in destroy()** — if a mode adds a `paint` event listener to the canvas but doesn't remove it in `destroy()`, the listener fires after mode switch with stale element references, calling `texElementImage2D` on removed elements → GPU crash.
26. **Shell's RAF guard must account for mode-managed trackers** — if the shell's `draw()` gates on `this.tracker.hasFirstPaint()`, it will sleep forever after a mode switch because `clearCanvas()` resets the shell's tracker. Modes that use their own PaintTracker bypass the shell's tracker entirely. The guard should only apply when no mode hook is set.
27. **Vite `?raw` imports have no `#include` mechanism** — GLSL utility functions (srgbToLinear, hash21, etc.) cannot be shared via `#include`. Each `.frag` file must inline the functions it needs. Maintain a `common.glsl` reference file and keep inlined copies in sync manually.

### May Break in Future Canary Builds

28. **Feature-detect both `canvas.requestPaint` AND `gl.texElementImage2D`** — Canary builds have broken individually.
29. **Demos may break without warning** — the spec is actively churning. Issues #108/#109 broke working demos around 2026-04-07/08.

---

## 10. Three.js Integration

### Injecting Your Own GL Texture

Three.js manages its own texture cache. To use `texElementImage2D` with Three.js, inject your GL texture into Three's property map:

```ts
const glTexture = gl.createTexture()!;
gl.bindTexture(gl.TEXTURE_2D, glTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const texture = new THREE.Texture();
texture.isRenderTargetTexture = true;  // Prevent Three.js from uploading
texture.colorSpace = THREE.SRGBColorSpace;
(renderer.properties.get(texture) as any).__webglTexture = glTexture;
```

### State Reset After Upload

```ts
canvas.addEventListener('paint', () => {
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
  renderer.state.reset();  // CRITICAL — re-sync Three.js GL state cache
});
```

### HDR Pipeline

HDR works on HTML-sourced textures. The Canvas Room demo uses:
- `THREE.HalfFloatType` render targets
- ACES tonemapping: `aces(x) = (x * (2.51x + 0.03)) / (x * (2.43x + 0.59) + 0.14)`
- 4x4 Bayer dithering to break banding
- sRGB gamma as final step

---

## 11. Reference Demos & Their Techniques

### Curved Markup (Jake Archibald)

Maps interactive HTML onto a curved 3D surface.

- `PlaneGeometry` with vertex displacement: `z = -depth * (x² + y²)`
- `texElementImage2D` captures HTML as WebGL texture in paint handler
- Raycaster → UV → CSS translate for interactivity
- VHS shader chain (5 passes): luma/chroma separation at real VHS ratios (1/2 and 1/32 res), unsharp mask via mipmap LOD bias (`texture(ch, uv, lodBias)`), ping-pong feedback, bottom-edge tracking warp, scanlines + vignette

**Source:** https://github.com/jakearchibald/random-stuff/tree/main/apps/curved-markup

### Canvas Room (Sawyer Hood)

Chrome extension: renders any webpage on a 3D CRT monitor in a virtual room.

- WXT extension injects `<canvas layoutsubtree>` wrapper around page DOM
- Entire page captured as WebGL texture every frame
- CRT barrel distortion: `uv += center * r² * 0.12`
- Phosphor RGB sub-pixel triad: `fract(uv.x * resX / 3.0) * 3.0`
- Scanlines: `0.88 + 0.12 * sin(uv.y * resY * π)`
- PS1 ordered dither + color quantization: 4×4 Bayer, levels ramp 5→48 via `smoothstep(brightness)`
- 2D screen-projection passthrough: `translate(x,y) scale(sx,sy)` for interaction

**Source:** https://github.com/SawyerHood/html-in-canvas-room

### Compiz-Web (Max Leiter)

Desktop-cube / wobbly / burn / genie / magnetic / dissolve SPA transitions.

- Two HTML textures (`u_from`, `u_to`), one `u_progress`, one click point (`u_click`)
- Both old and new pages exist as canvas children during effect; old removed after transition ends
- Cube: per-pixel ray-cast intersection with face planes, each face from a different texture
- Wobbly: expanding circular wavefront, radial displacement with 3-channel chromatic aberration
- Burn: FBM-driven flame front, five zones (smoke→heat distortion→ember→char→reveal), ember particles via hash
- Genie: accelerated squeeze `progress²`, inverse warp, `sin(uv.y*π)` bottle bulge
- Dissolve: multi-octave simplex noise, threshold ramped by progress + distance from click

**Source:** https://github.com/MaxLeiter/compiz-web

---

## 12. Browser Support

| Browser | Status |
|---------|--------|
| Chrome/Chromium | Behind flag: `chrome://flags/#canvas-draw-element` |
| Firefox | No implementation |
| Safari | No implementation |
| Edge | Shares Chromium flag |

Not yet in any stable release. The flag has been available since approximately Chrome 130+ (late 2024).

---

## 13. Security Model

- Children must be **direct children** of the canvas element
- Canvas with `layoutsubtree` follows **same-origin** rules for pixel reading
- No "tainted canvas" for HTML-sourced pixels — the privacy filter strips sensitive bits before they reach canvas memory, so `getImageData()` and `toBlob()` work normally
- Cross-origin content is silently omitted (see gotcha #10)
- Fingerprinting surface: rendering HTML to canvas could fingerprint devices via font rendering differences (acknowledged in spec, not yet mitigated)
- Scrollbar appearance and `forced-colors` are still observable
- Visited-link colors, system theme colors, caret blink rate are privacy-suppressed

---

## 14. Worker Support

```js
// Main thread:
canvas.onpaint = () => {
  const img = canvas.captureElementImage(form);
  worker.postMessage({ img }, [img]);  // Transferable
};

// Worker:
worker.onmessage = ({ data }) => {
  // Process ElementImage
  form.style.transform = data.transform.toString();
};
```

`captureElementImage()` returns synchronously. The `ElementImage` is `Transferable` and `[Exposed=(Window,Worker)]`.

`requestPaint()` on an `OffscreenCanvas` currently delivers empty `changedElements` (issue #96) — track elements manually in workers.

---

## 15. Nested Canvases

Nested `<canvas layoutsubtree>` inside another IS supported (issue #46, closed). This enables multi-layer compositing where each canvas captures its own subtree independently.

---

## 16. Quick Start Checklist

For an AI agent building an HTML-in-Canvas application:

1. **Chrome Canary** with `chrome://flags/#canvas-draw-element` enabled
2. **Feature detect** — check `requestPaint`, `texElementImage2D`, `drawElementImage` on prototypes
3. **One `<canvas layoutsubtree>`** — wrap your content in direct child `<div>`s (never `display: contents`)
4. **One WebGL2 context** — `getContext('webgl2', { alpha: false, premultipliedAlpha: false })`
5. **Paint listener** — upload textures via `texElementImage2D` inside the `paint` handler only
6. **RAF loop** — draw using uploaded textures; dirty-flag driven, not continuous
7. **Y-flip** — `UNPACK_FLIP_Y_WEBGL=true` on upload; compensate in clip-space math
8. **sRGB** — linearize HTML texture samples before shader math; convert back to sRGB at output
9. **DPR** — size backing buffer to `width * devicePixelRatio`
10. **All assets same-origin** or CORS-whitelisted (cross-origin content silently disappears)
11. **TypeScript** — add the type augmentations from section 7
12. **Accessibility** — mark non-drawn subtrees `inert` or `aria-hidden`; keep `alt` text real on images
