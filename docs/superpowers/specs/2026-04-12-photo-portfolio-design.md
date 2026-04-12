# Photography Portfolio — Design Spec

**Date:** 2026-04-12
**Status:** Approved

A photography portfolio that doubles as an educational demo for HTML-in-Canvas (HiC). Seven browsing modes, each a real portfolio experience enhanced by HiC in ways impossible with CSS/JS alone. Desktop Chrome Canary only (`chrome://flags/#canvas-draw-element`).

---

## 1. Goals

- **Primary audience:** Web developers / tech audience coming to see HiC in action
- **Secondary:** Photographers who appreciate technical craft
- **Tertiary:** Potential clients browsing the work
- Serve as a reusable template other photographers could adapt
- Educate via a per-mode learn panel explaining HiC techniques
- Optimize for performance (CWV) and SEO despite canvas-based rendering

## 2. Constraints

- **No runtime third-party libraries or frameworks.** Vanilla TypeScript + WebGL2 + browser APIs only. Build tools (Vite, Sharp, TypeScript compiler) are fine.
- **Desktop Chrome Canary only.** No mobile support. No polyfill or fallback — feature detection gate with instructions to enable the flag.
- **No full keyboard accessibility.** No tab navigation, focus management, or screen reader support. Basic arrow key navigation is included where natural (detail view photo browsing, slideshow advance).
- **No deep linking.** Single page, no URL routing.

## 3. Tech Stack

- **Runtime:** Vanilla TypeScript, WebGL2, HTML-in-Canvas API, View Transitions API
- **Build:** Vite (bundler, dev server, GLSL `?raw` imports), TypeScript compiler
- **Build scripts:** Node.js + Sharp (EXIF extraction, responsive image generation)
- **Fonts:** Playfair Display (headings), Inter (body/captions), JetBrains Mono (EXIF/code)

## 4. Architecture

### 4.1 DOM Structure

```
<body>
  <nav>                           ← regular DOM: mode switcher, controls
  <main>
    <canvas layoutsubtree>
      <div id="mode-root">        ← mode content (photos, captions, etc.)
    </canvas>
  </main>
  <aside id="learn-drawer">      ← regular DOM: educational side panel
  <div id="about-panel">         ← regular DOM: about/contact overlay
  <div id="detail-view">         ← regular DOM: photo detail zoom view
</body>
```

- **Canvas sits below the fixed nav bar** (not behind it). Nav is fixed-height (~56px), canvas fills the remaining viewport.
- Chrome (nav, learn drawer, about, detail view) is regular DOM outside the canvas.
- All HiC rendering happens inside the canvas.

### 4.2 Render Pipeline

- **Single WebGL2 context** on the canvas, shared across all 7 modes.
- **Shell** (`shell.ts`) owns the `<canvas layoutsubtree>`, the GL context, the `paint` event listener, and the RAF loop.
- **PaintTracker** manages one WebGL texture per direct canvas child. Uploads happen exclusively inside the `paint` event handler via `texElementImage2D`.
- **Dirty-flag RAF loop** — event-driven, not continuous. Runs only when:
  1. A `paint` event fires (new textures to upload)
  2. A mode calls `requestDraw()` (request a single frame)
  3. A mode declares `isAnimating() === true` (continuous animation)
- **DPR handling:** Backing buffer sized to `width * devicePixelRatio`. CSS size set to logical pixels. GL viewport matches backing buffer.
- **sRGB:** All shaders linearize HTML texture samples before math, convert back to sRGB at output.
- **Y-flip:** `UNPACK_FLIP_Y_WEBGL = true` on texture upload. Standard UV coordinates.

### 4.3 Mode Lifecycle

Each mode is a vanilla TypeScript class implementing:

```ts
interface ModeImpl {
  paint(dt: number): void;
  isAnimating?(): boolean;
  onPointer?(ev: PointerEvent): void;
  onResize?(size: { w: number; h: number }): void;
  destroy(): void;
}
```

Shell exposes hooks for modes:
- `setModeHook(fn)` — replaces default passthrough draw
- `setOverlayHook(fn)` — runs after passthrough draw
- `requestDraw()` — request a single frame
- `setAnimating(bool)` — keep loop running continuously

Modes are **code-split** — each mode directory is a dynamic import, loaded only when the mode is activated.

### 4.4 Mode Switching

- Tear down current mode (`destroy()`)
- Clear `mode-root` DOM
- Dynamic-import the new mode class
- Construct mode with `ModeContext` (gl, canvas, root, photos, size, dpr, dirty callback)
- Wrap the transition in the **View Transitions API** for a smooth cross-fade between the old canvas frame and the new mode's first render

### 4.5 Feature Detection

```ts
function detectHtmlInCanvas(): 'supported' | 'missing-api' {
  if (typeof HTMLCanvasElement.prototype.requestPaint !== 'function') return 'missing-api';
  const probe = document.createElement('canvas');
  probe.width = 1; probe.height = 1;
  const gl = probe.getContext('webgl2');
  if (!gl || typeof gl.texElementImage2D !== 'function') return 'missing-api';
  if (typeof CanvasRenderingContext2D.prototype.drawElementImage !== 'function') return 'missing-api';
  return 'supported';
}
```

When HiC is not available: show the site title, a message explaining the Canary flag requirement, and a static grid of photos (the semantic HTML renders without enhancement).

## 5. Seven Viewing Modes

### 5.1 Album

**Experience:** A photo book with a cover. Opens with a cover page showing "Photography Portfolio." Each spread has a photograph on one side, caption and EXIF data on the other. Click the page edge or swipe to turn. The page curls and bends like real paper — the HTML content (text, photo, metadata) deforms together as part of the page surface.

Even when pages are flat (not turning), the shader renders paper texture overlay (subtle fiber texture composited with the HTML) and a spine shadow (soft gradient darkening near the center fold).

**HiC technique:** `texElementImage2D` captures each page spread (an HTML layout with photo, styled caption, EXIF) as a WebGL texture. The page-turn shader displaces vertices along a curl curve, mapping the texture onto the bending surface. The back of a turning page shows the next spread's texture.

**Why impossible without HiC:** CSS 3D transforms can do rigid `rotateY` page flips (flat card turning). They cannot curl or bend content along a curve — that requires per-vertex displacement on page geometry with the HTML content mapped as a texture. Additionally, the paper texture overlay and spine shadow are shader compositing effects on the live HTML texture. Without HiC, you'd need to pre-render all text as images (losing accessibility, text selection, and crisp scaling) or use html2canvas (incomplete CSS, no interactivity, slow).

**Interactions:** Click near page edges to turn forward/backward. Swipe on trackpad. Page number indicator at bottom.

### 5.2 Cinematic Slideshow

**Experience:** Full-screen, one photo at a time. The photo fills the viewport with caption and EXIF placed elegantly at the bottom. Advance with arrow clicks or swipe. Transitions between slides are cinematic GLSL effects where the entire composition (photo + caption) participates as one unified surface.

**Transitions (randomly selected per advance):**
- **Film burn** — bright areas eat into the frame from the edges, like a projector burning the film stock
- **Rack focus** — outgoing slide blurs out (defocuses) while incoming slide sharpens in, simulating a camera focus pull
- **Luminance dissolve** — highlights transition first, shadows last, creating a dreamy high-key reveal

**HiC technique:** The outgoing and incoming slides are both HTML layouts captured as separate textures via the PaintTracker. The `paint` event fires for the incoming slide as it's populated, providing its texture. The transition shader blends both textures at the pixel level.

**Why impossible without HiC:** The closest CSS alternative is the View Transitions API, which can fade/slide/clip-path between DOM snapshots. But VT only supports CSS animations on the snapshots — it cannot do per-pixel noise-pattern dissolves, directional motion blur, or luminance-keyed blending. Those require custom GLSL sampling of both textures simultaneously. The caption text participates in the dissolve (not floating above it), because photo and caption are one texture.

**Interactions:** Click left/right edges or swipe to advance/retreat.

### 5.3 Print Table

**Experience:** Photographs laid out on a dark surface in a grid (3-4 columns, medium-sized). A soft spotlight follows the cursor — the print under the light is bright and sharp, prints further away darken and soften with a depth-of-field-like blur. Feels like browsing physical prints on a studio table with a desk lamp. Scrollable if the grid exceeds the viewport.

**HiC technique:** The entire HTML grid (photos, captions, EXIF badges) is captured as one composite texture via `texElementImage2D`. The spotlight fragment shader applies radial brightness falloff and distance-based Gaussian blur in a single pass on the composite texture.

**Why impossible without HiC:** CSS can dim individual elements with `filter: brightness()`, but the blur crosses element boundaries — the blur from one photo bleeds into the gap between cards, into the caption text of a neighboring photo, seamlessly. This is per-pixel variable-radius blur on the composite rendered output of the entire HTML grid. CSS `filter: blur()` is uniform per-element and can't vary by distance from a point, nor can it blur across element boundaries.

**Interactions:** Mouse movement drives spotlight position. Click a photo to open it in the detail view. Scroll to browse the full grid.

### 5.4 Film Strip

**Experience:** A horizontal strip of photographs with CSS-styled sprocket holes, frame numbers, and captions — like a roll of developed film on a light table. Scroll horizontally to slide through. Center frames lie flat and sharp; frames toward the edges curl gently away, like film bowing under its own weight.

**HiC technique:** The HTML strip (photos, sprocket holes, frame counters, captions — all CSS-styled DOM elements) is captured as a texture via `texElementImage2D`. A curvature shader bends the flat layout into a 3D surface via per-pixel displacement. `getElementTransform` synchronizes CSS transforms on the DOM elements to match their drawn positions, preserving click/hover hit testing on the curved surface.

**Why impossible without HiC:** CSS 3D transforms can rotate or skew individual elements, but can't smoothly bend a continuous layout along a curve. The sprocket holes, the gap between two frames, the frame counter text — these all curve together as part of the same surface because they're all part of one composite texture being displaced by the shader. And hit testing is preserved on the curved content via `getElementTransform`, which has no CSS equivalent.

**Interactions:** Horizontal scroll (wheel, trackpad, drag). Click a frame to open in detail view. Click navigation arrows at edges.

### 5.5 Wall Exhibition

**Experience:** Vertical scroll through photos hung at varying sizes and positions on a gallery wall — like walking through a photography exhibition. Layout alternates between hero photos (large, centered) and companion clusters (2-3 smaller photos grouped together). Each photo has a small plaque beneath it with caption and EXIF. The wall surface (dark plaster/concrete texture) is visible between and around photos.

**HiC technique:** The full HTML composition is captured as a texture via `texElementImage2D`. The fragment shader composites the HTML content onto a wall texture and applies physically-based gallery lighting:
- Per-pixel directional lighting from overhead spots (inverse-square falloff — top of a photo is brighter, bottom is dimmer)
- Position-dependent cast shadows from each photo onto the wall beneath it
- Light spill that crosses element boundaries (a spotlight cone illuminates the bottom of one photo, the plaque, and the top of the next photo as one continuous gradient)

**Why impossible without HiC:** Three things are impossible with CSS:
1. Compositing HTML content onto a background texture (the gallery wall) in a fragment shader
2. Per-pixel lighting within a single element (CSS `brightness()` is uniform per-element)
3. Cast shadows whose direction and intensity vary by position relative to overhead light sources (CSS `box-shadow` is static and uniform)

**Interactions:** Vertical scroll. Click a photo to open in detail view. Gallery lighting shifts as you scroll, keeping the "sweet spot" centered on the viewport.

### 5.6 Stacked Prints

**Experience:** A pile of prints on a surface. The top photo is fully visible with its caption. Click or drag to toss it aside — it lifts, warps like real paper, spins off with momentum, and lands scattered to the side. Tossed prints accumulate as a messy spread, showing everything you've already browsed. "Reset" re-stacks them all.

The front of each print shows the photo + caption. The back shows EXIF data and technical details. During a toss, the print tumbles and both sides are visible — two different HTML layouts on one deforming mesh.

**HiC technique:** Each print (photo + caption HTML) is a separate direct child of the canvas, captured as its own texture via `texElementImage2D`. The paper warp is a vertex displacement shader applied to each print's texture:
- **Grab:** print lifts and curls from the grab point (corner grab → corner curl, center grab → upward bow)
- **Drag:** print flexes and wobbles with momentum, deformation responds to drag velocity
- **Toss:** print spins and flexes with paper-like deformation throughout the flight arc
- **Double-sided:** front texture (photo) and back texture (EXIF) on the same mesh, both captured from live HTML

Prints in the stack cast depth-based shadows on prints below. Shadow intensity varies with z-distance and updates dynamically as prints are lifted.

**Why impossible without HiC:** CSS transforms are affine — they can rotate, scale, skew, and translate, but cannot bend or curl within a single element. The paper warp (non-linear deformation of an HTML layout) requires per-vertex displacement on a mesh mapped with the HTML texture. The double-sided print requires two live HTML textures (front and back) on one deforming mesh. No combination of CSS 3D transforms achieves non-linear surface deformation of live HTML content.

**Interactions:** Click to toss the top print. Drag from a specific point for directional toss with grab-point warp. Swipe for quick toss. "Reset" button re-stacks all prints.

### 5.7 Collage

**Experience:** Photos arranged in an editorial collage — overlapping, varied sizes, some slightly rotated. Uses predefined layout templates (3-4 arrangements designed to look editorial, not random) that photos fill. The whole composition is rendered through a tilt-shift shader that creates a miniature/diorama effect, making the collage look like a physical object you're peering down at.

**HiC technique:** The HTML collage layout (CSS Grid + absolute positioning with rotations, overlapping photos with captions) is captured as one composite texture via `texElementImage2D`. The tilt-shift fragment shader applies a horizontal band of sharpness at the viewport center with progressive Gaussian blur above and below — varying per-pixel, crossing element boundaries.

**Why impossible without HiC:** CSS `filter: blur()` applies uniformly to an entire element. A photo that spans the tilt-shift boundary is sharp in its center and blurred at its top/bottom — within the same element. The blur varies continuously per-pixel by Y-position, flows across overlapping photo edges, through caption text, across gaps. This per-pixel position-dependent variable blur on a composite HTML rendering is exclusively a fragment shader operation on the HTML texture.

**Interactions:** Scroll to pan if the collage extends beyond viewport. Hover a photo to see its caption prominently. Click for detail view.

## 6. Photo Detail View

Available in multi-photo modes: Print Table, Film Strip, Wall Exhibition, Collage, Stacked Prints.

- **Open:** Click a photo → it animates from its grid position to fill the screen via a CSS animation (scale + translate from the photo's bounding rect to full screen). View Transitions are NOT used here because the source photo lives inside a `<canvas layoutsubtree>` and VT capture of canvas children is unreliable. The mode's shader effect is NOT applied to the detail view — the photo is shown clean and unprocessed.
- **Display:** Large photo with caption and EXIF data positioned below (landscape) or beside (portrait).
- **Navigate:** Arrow keys or click left/right edges to move to the next/previous photo in the current shuffled order. Photo transitions with a cross-fade or slide.
- **Close:** Click the backdrop or press Escape → photo animates back to its position in the current mode.

## 7. Nav Bar

Fixed at top, regular DOM. ~56px height. Semi-transparent dark background.

**Layout:**
- **Left:** "Photography Portfolio" (Playfair Display, italic)
- **Center:** Mode switcher — 7 short labels: Album · Slideshow · Prints · Strip · Wall · Stack · Collage. Active mode: primary text color + subtle underline. Inactive: muted text.
- **Right:** EXIF toggle, Learn drawer toggle, About link

Mode switching wraps the canvas transition in the View Transitions API.

## 8. Learn Drawer

Right-side slide-out panel, regular DOM. ~340px wide. Overlays the canvas content with a subtle backdrop.

**Per-mode content:**
- Mode name and one-line description
- **"How it works"** — plain-language explanation of the HiC technique
- **"Why HTML-in-Canvas?"** — what makes this impossible with CSS/JS alone
- **"Key code"** — relevant shader or API call snippets, syntax-highlighted
- Links to spec sections or reference demos

**State:** Toggle via nav bar icon. Open/closed state persisted to `localStorage`. Remembers last state across page reloads. Content updates automatically when switching modes.

## 9. About Panel

Centered overlay triggered from the nav bar. Semi-transparent backdrop.

Contains:
- Brief bio / artist statement
- Contact info or links
- Social links

Closed by clicking backdrop or close button.

## 10. EXIF Display

- **Fields:** Focal length, aperture, shutter speed, ISO
- **Format:** Monospace (JetBrains Mono), muted color (`#5a5650`), small size. Fields separated by mid-dots: `85mm · ƒ/2.8 · 1/250s · ISO 400`
- **Toggle:** Global toggle in the nav bar. Applies to all modes. State persisted to `localStorage`.
- **Placement:** Below captions or alongside metadata areas, depending on mode context.

## 11. Visual Design

### 11.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0b` | Page background |
| Surface | `#141416` | Cards, panels, nav |
| Elevated | `#1e1e21` | Hover states, raised elements |
| Primary text | `#e8e4df` | Headings, active labels |
| Secondary text | `#8a8680` | Body text, captions |
| Muted | `#5a5650` | EXIF data, tertiary info |
| Border | `rgba(255,255,255,0.06)` | Dividers, card edges |

Warm neutral grays — not blue-tinted. No accent color; photographs provide all the color.

### 11.2 Typography

- **Headings:** Playfair Display (serif, italic for site title)
- **Body/captions:** Inter (sans-serif)
- **EXIF/code:** JetBrains Mono (monospace)
- **Loading:** `font-display: swap` with system fallbacks. Preload heading font for LCP.

### 11.3 Design Principles

- Photos are the brightest elements — everything else recedes
- Generous whitespace (darkspace) around photos
- Minimal UI chrome — the nav and controls should feel nearly invisible
- No decorative elements — the photography is the design

### 11.4 Animations & Transitions

The entire application should feel fluid and polished. Every state change is animated — nothing snaps.

**Global easing:** `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint) for most transitions. Smooth deceleration that feels natural and unhurried.

**Nav bar:**
- Mode labels: color and underline transition on hover/active (`150ms`)
- EXIF/Learn/About controls: subtle opacity fade on hover (`150ms`)
- Nav background: opacity transition when content scrolls behind it in scrollable modes (`200ms`)

**Mode switching:**
- View Transitions API wraps the canvas swap — the old mode's last frame cross-fades into the new mode's first frame (`400ms ease-out`)
- Nav active indicator slides to the new mode label (not instant jump) (`300ms`)

**Learn drawer:**
- Slides in/out with transform (`300ms ease-out-quint`)
- Content fades in slightly after the drawer reaches position (`150ms delay`)
- Backdrop fades in/out (`200ms`)

**About panel:**
- Fades in with slight scale-up from `0.97` to `1.0` (`250ms`)
- Backdrop fades in (`200ms`)

**Photo detail view:**
- Open: photo scales + translates from its grid position to full-screen (`400ms ease-out-quint`). Caption and EXIF fade in after the photo lands (`200ms delay, 200ms duration`).
- Navigate (arrow keys): cross-fade between photos (`300ms`). Caption/EXIF text transitions with a subtle fade (`150ms`).
- Close: reverse of open — photo scales back to its grid position (`350ms`), caption fades out immediately.

**EXIF toggle:**
- EXIF data fades in/out across all visible photos (`200ms`). Slight vertical slide (4px) accompanies the fade for a polished feel.

**Photo loading (within modes):**
- LQIP → real image: crossfade with a subtle scale from `1.02` to `1.0` (`500ms ease-out`). The slight zoom-settle makes loading feel intentional, not jarring.

**Hover states (where applicable):**
- Photo cards in grid modes: subtle brightness lift or border glow (`150ms`)
- Nav and control elements: opacity/color transitions (`150ms`)
- No transform-based hovers (scale, translate) on photos — the photos should feel grounded, not floaty.

**Scroll-driven (where applicable):**
- Wall Exhibition: gallery lighting shifts smoothly as you scroll (driven by scroll position, interpolated per-frame in the shader — no CSS transition needed).
- Film Strip: curvature responds to scroll position with smooth interpolation in the shader.

**Principle:** Transitions should feel like physical movement — smooth deceleration, no bouncing, no overshoot. The cinematic/darkroom aesthetic calls for deliberate, unhurried motion. Nothing should feel snappy or playful.

## 12. Photo Data

### 12.1 Photo Ordering

All modes receive a **randomly shuffled** copy of the photo array on each page load. The Album starts with the cover, then the shuffled sequence.

### 12.2 Build-Time Manifest

A Node script (`scripts/build-manifest.ts`) processes `assets/photographs/`:

1. Read EXIF from each JPG (via Sharp)
2. Generate responsive sizes as WebP: thumbnail (400w), medium (800w), full (1600w)
3. Generate LQIP — ~20px wide blurred placeholder, base64-encoded
4. Extract dimensions (width, height)
5. Output `src/photos.json`

```json
{
  "photos": [
    {
      "id": "20251001-8901",
      "src": "photographs/20251001-8901.jpg",
      "thumb": "photographs/thumb/20251001-8901.webp",
      "medium": "photographs/med/20251001-8901.webp",
      "full": "photographs/full/20251001-8901.webp",
      "lqip": "data:image/webp;base64,UklGR...",
      "width": 4000,
      "height": 2667,
      "exif": {
        "focalLength": "85mm",
        "aperture": "ƒ/2.8",
        "shutterSpeed": "1/250s",
        "iso": "400"
      },
      "title": "",
      "description": ""
    }
  ]
}
```

Title and description start empty — filled in manually. The build script preserves existing values on re-run.

## 13. Performance & Core Web Vitals

### LCP (Largest Contentful Paint)
- Responsive images via `srcset` — thumbnails (400w), medium (800w), full (1600w)
- First visible photos: `loading="eager"` + `fetchpriority="high"`. Remainder: `loading="lazy"`.
- LQIP (base64-inlined) for instant layout rendering
- Inline critical CSS. Defer non-critical JS.
- Mode classes are dynamic imports — only the active mode's JS/GLSL is loaded.
- Preload Playfair Display heading font.

### CLS (Cumulative Layout Shift)
- All `<img>` tags get explicit `width` and `height` attributes (from manifest dimensions)
- Canvas is sized to fill its container from initial render
- Nav bar is fixed height — no content injection shifts

### INP (Interaction to Next Paint)
- Event handlers are lightweight — set uniforms or flags, actual work deferred to next RAF
- Debounce resize. Throttle `pointermove` to RAF cadence.
- Mode switching is async (dynamic import) but the View Transition keeps the old frame visible during the load.

### GPU Performance
- Dirty-flag RAF loop — zero rendering when nothing changes
- Non-animating modes go fully idle (no RAF, no paint overhead)
- Texture uploads only in `paint` handler, only for `changedElements`
- Shared shader programs where possible (universal vertex shader, common sRGB/utility functions)
- Resize textures to display size, not source image size

### Asset Loading
- Dynamic import each mode class — code-split per mode
- Photos load progressively: LQIP (instant) → thumbnail → medium/full as needed
- WebP with AVIF consideration for further size reduction
- Shader source bundled inline via Vite `?raw` — no extra network requests

## 14. SEO

### Semantic HTML
The content inside `<canvas layoutsubtree>` is real semantic HTML — crawlers see it even if they don't execute JS:
- `<main>`, `<nav>`, `<article>`, `<figure>`, `<figcaption>`, `<time>`
- `alt` text on every `<img>` (from the caption field in the manifest)
- Proper heading hierarchy: `h1` (site title) → `h2` (mode name) → `h3` (photo titles)

### Structured Data
- JSON-LD `ImageGallery` schema with each photo as an `ImageObject` (name, description, EXIF as `exifData`, date, thumbnail URL)
- `Person` schema for the photographer

### Meta Tags
- `<title>`: "Photography Portfolio — [Photographer Name]"
- `<meta name="description">`: brief portfolio description
- Open Graph tags (title, description, image)
- Twitter Card tags

### No-JS / No-HiC State
The semantic HTML inside the canvas is the fallback. It's rendered by the browser's layout engine as standard HTML. Without HiC, users see a functional photo grid with captions — just without shader enhancements.

## 15. Error Handling

- **Photo load failure:** Show the LQIP placeholder permanently. Don't break the grid layout.
- **Shader compile failure:** Fall back to the passthrough shader (draw HTML texture 1:1 without effects). Log a console warning. The mode still works, just without its shader enhancement.
- **HiC not available:** Feature detection gate with instructions. Static photo grid visible below.

## 16. Project Structure

```
photo-portfolio/
├── assets/photographs/              ← source JPGs (gitignored, ~330MB)
├── public/
│   └── photographs/                 ← generated responsive images
│       ├── thumb/                   ← 400w WebP
│       ├── med/                     ← 800w WebP
│       └── full/                    ← 1600w WebP
├── src/
│   ├── index.html                   ← entry point, semantic HTML, JSON-LD
│   ├── main.ts                      ← bootstrap, feature detection, mode router
│   ├── shell.ts                     ← canvas, GL context, RAF loop, paint handler
│   ├── types.ts                     ← ModeImpl, Photo, HiC type augmentations
│   ├── glsl.d.ts                    ← module declarations for *.glsl / ?raw imports
│   ├── photos.json                  ← generated manifest
│   ├── styles/
│   │   ├── reset.css                ← minimal reset
│   │   ├── theme.css                ← color tokens, typography, base styles
│   │   ├── nav.css
│   │   ├── learn.css
│   │   ├── about.css
│   │   └── detail.css
│   ├── nav/
│   │   └── nav.ts                   ← mode switcher, EXIF toggle, about trigger
│   ├── learn/
│   │   └── learn.ts                 ← side drawer, per-mode content, localStorage
│   ├── about/
│   │   └── about.ts                 ← about panel overlay
│   ├── detail/
│   │   └── detail.ts                ← photo detail view, zoom, arrow navigation
│   ├── shaders/
│   │   ├── common.glsl              ← sRGB, vignette, grain, noise utilities
│   │   ├── vertex.glsl              ← universal vertex shader
│   │   └── passthrough.frag         ← basic texture draw (fallback)
│   ├── modes/
│   │   ├── album/
│   │   │   ├── album.ts
│   │   │   └── page-curl.frag
│   │   ├── slideshow/
│   │   │   ├── slideshow.ts
│   │   │   ├── film-burn.frag
│   │   │   ├── rack-focus.frag
│   │   │   └── luminance-dissolve.frag
│   │   ├── print-table/
│   │   │   ├── print-table.ts
│   │   │   └── spotlight.frag
│   │   ├── film-strip/
│   │   │   ├── film-strip.ts
│   │   │   └── curvature.frag
│   │   ├── wall-exhibition/
│   │   │   ├── wall-exhibition.ts
│   │   │   └── gallery-lighting.frag
│   │   ├── stacked-prints/
│   │   │   ├── stacked-prints.ts
│   │   │   └── paper-warp.frag
│   │   └── collage/
│   │       ├── collage.ts
│   │       └── tilt-shift.frag
│   └── lib/
│       ├── gl.ts                    ← GL context init, shader compilation, program cache
│       ├── paint-tracker.ts         ← per-element texture management
│       ├── detect.ts                ← HiC feature detection
│       └── photos.ts                ← photo loading, shuffle, responsive src selection
├── scripts/
│   └── build-manifest.ts            ← EXIF extraction + responsive image generation
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 17. Reference

- `docs/html-in-canvas-research.md` — Complete HiC API reference, architecture patterns, shader recipes, TypeScript augmentations, CSS behavior, and all known gotchas
- WICG spec: https://github.com/WICG/html-in-canvas
