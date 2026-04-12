# Photography Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-mode photography portfolio that showcases HTML-in-Canvas (HiC), with each mode being a real browsing experience enhanced by custom WebGL2 shaders applied to live HTML content.

**Architecture:** Single `<canvas layoutsubtree>` with a shared WebGL2 context. A shell manages the paint event listener and RAF loop. Each viewing mode is a code-split TypeScript class that creates DOM inside the canvas, registers it with a PaintTracker for texture upload, and draws via custom GLSL shaders. UI chrome (nav, learn drawer, about, detail view) lives outside the canvas as regular DOM.

**Tech Stack:** Vite + TypeScript (build), vanilla TS + WebGL2 + HTML-in-Canvas API + View Transitions API (runtime), Sharp + exif-reader (build scripts for EXIF/image processing).

**Spec:** `docs/superpowers/specs/2026-04-12-photo-portfolio-design.md`
**HiC API Reference:** `docs/html-in-canvas-research.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "photo-portfolio",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "manifest": "tsx scripts/build-manifest.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.2.0",
    "tsx": "^4.19.0",
    "sharp": "^0.34.0",
    "exif-reader": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  assetsInclude: ['**/*.glsl'],
});
```

- [ ] **Step 4: Update .gitignore**

Append to existing `.gitignore` (or create it):

```
node_modules/
dist/
public/photographs/
.superpowers/
*.local
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts .gitignore
git commit -m "chore: scaffold Vite + TypeScript project"
```

---

### Task 2: Type Definitions & HiC Augmentations

**Files:**
- Create: `src/types.ts`
- Create: `src/glsl.d.ts`
- Create: `src/hic.d.ts`

- [ ] **Step 1: Create src/types.ts**

```ts
// --- Photo manifest types ---

export interface PhotoExif {
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
}

export interface Photo {
  id: string;
  src: string;
  thumb: string;
  medium: string;
  full: string;
  lqip: string;
  width: number;
  height: number;
  exif: PhotoExif;
  title: string;
  description: string;
}

export interface PhotoManifest {
  photos: Photo[];
}

// --- Mode system types ---

export interface ModeContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  photos: Photo[];
  size: { w: number; h: number };
  dpr: number;
  requestDraw: () => void;
  setAnimating: (animating: boolean) => void;
  openDetail: (photoIndex: number) => void;
}

export interface ModeImpl {
  paint(dt: number): void;
  isAnimating?(): boolean;
  onPointer?(ev: PointerEvent): void;
  onResize?(size: { w: number; h: number }): void;
  destroy(): void;
}

export type ModeFactory = (ctx: ModeContext) => ModeImpl;

export type ModeName =
  | 'album'
  | 'slideshow'
  | 'print-table'
  | 'film-strip'
  | 'wall-exhibition'
  | 'stacked-prints'
  | 'collage';

export const MODE_LABELS: Record<ModeName, string> = {
  album: 'Album',
  slideshow: 'Slideshow',
  'print-table': 'Prints',
  'film-strip': 'Strip',
  'wall-exhibition': 'Wall',
  'stacked-prints': 'Stack',
  collage: 'Collage',
};

export const MODE_ORDER: ModeName[] = [
  'album',
  'slideshow',
  'print-table',
  'film-strip',
  'wall-exhibition',
  'stacked-prints',
  'collage',
];
```

- [ ] **Step 2: Create src/glsl.d.ts**

```ts
declare module '*.glsl' {
  const source: string;
  export default source;
}

declare module '*?raw' {
  const source: string;
  export default source;
}
```

- [ ] **Step 3: Create src/hic.d.ts**

```ts
// HTML-in-Canvas API type augmentations
// These APIs only exist behind chrome://flags/#canvas-draw-element

interface HTMLCanvasElement {
  requestPaint?(): void;
  captureElementImage?(element: Element): Transferable;
  getElementTransform?(element: Element, drawTransform?: DOMMatrix): string;
}

interface WebGL2RenderingContext {
  texElementImage2D?(
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    source: Element,
  ): void;
}

interface CanvasRenderingContext2D {
  drawElementImage?(
    element: Element,
    dx: number,
    dy: number,
  ): DOMMatrix;
  drawElementImage?(
    element: Element,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): DOMMatrix;
  drawElementImage?(
    element: Element,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): DOMMatrix;
}

interface HTMLElementEventMap {
  paint: PaintEvent;
}

interface PaintEvent extends Event {
  readonly changedElements: readonly Element[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/glsl.d.ts src/hic.d.ts
git commit -m "feat: add type definitions and HiC API augmentations"
```

---

### Task 3: Build Manifest Script

**Files:**
- Create: `scripts/build-manifest.ts`

This script reads EXIF from the 45 source JPGs in `assets/photographs/`, generates responsive WebP images (thumb 400w, medium 800w, full 1600w), creates LQIP placeholders, and outputs `src/photos.json`.

- [ ] **Step 1: Create scripts/build-manifest.ts**

```ts
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { readdir, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';

const ASSETS_DIR = join(import.meta.dirname, '..', 'assets', 'photographs');
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public', 'photographs');
const MANIFEST_PATH = join(import.meta.dirname, '..', 'src', 'photos.json');

const SIZES = {
  thumb: 400,
  med: 800,
  full: 1600,
} as const;

const LQIP_WIDTH = 20;

interface PhotoEntry {
  id: string;
  src: string;
  thumb: string;
  medium: string;
  full: string;
  lqip: string;
  width: number;
  height: number;
  exif: {
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
  };
  title: string;
  description: string;
}

function formatShutterSpeed(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  const denom = Math.round(1 / seconds);
  return `1/${denom}s`;
}

function formatAperture(fNumber: number): string {
  return `ƒ/${fNumber % 1 === 0 ? fNumber.toFixed(0) : fNumber.toFixed(1)}`;
}

function formatFocalLength(mm: number): string {
  return `${Math.round(mm)}mm`;
}

async function processPhoto(filename: string, existing: Map<string, PhotoEntry>): Promise<PhotoEntry> {
  const id = basename(filename, extname(filename));
  const inputPath = join(ASSETS_DIR, filename);

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Parse EXIF
  let focalLength = '';
  let aperture = '';
  let shutterSpeed = '';
  let iso = '';

  if (metadata.exif) {
    try {
      const exif = exifReader(metadata.exif);
      if (exif.Photo?.FocalLength) focalLength = formatFocalLength(exif.Photo.FocalLength);
      if (exif.Photo?.FNumber) aperture = formatAperture(exif.Photo.FNumber);
      if (exif.Photo?.ExposureTime) shutterSpeed = formatShutterSpeed(exif.Photo.ExposureTime);
      if (exif.Photo?.ISOSpeedRatings) iso = `ISO ${exif.Photo.ISOSpeedRatings}`;
    } catch {
      console.warn(`  EXIF parse failed for ${filename}, using defaults`);
    }
  }

  // Generate responsive sizes
  for (const [dir, width] of Object.entries(SIZES)) {
    const outDir = join(PUBLIC_DIR, dir);
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, `${id}.webp`);
    await sharp(inputPath)
      .resize(width, undefined, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
  }

  // Generate LQIP
  const lqipBuffer = await sharp(inputPath)
    .resize(LQIP_WIDTH)
    .webp({ quality: 20 })
    .toBuffer();
  const lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;

  // Preserve existing title/description
  const prev = existing.get(id);

  return {
    id,
    src: `photographs/${filename}`,
    thumb: `photographs/thumb/${id}.webp`,
    medium: `photographs/med/${id}.webp`,
    full: `photographs/full/${id}.webp`,
    lqip,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    exif: { focalLength, aperture, shutterSpeed, iso },
    title: prev?.title ?? '',
    description: prev?.description ?? '',
  };
}

async function main() {
  console.log('Building photo manifest...');

  // Load existing manifest to preserve titles/descriptions
  const existing = new Map<string, PhotoEntry>();
  if (existsSync(MANIFEST_PATH)) {
    const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
    for (const p of raw.photos) existing.set(p.id, p);
  }

  await mkdir(PUBLIC_DIR, { recursive: true });

  const files = (await readdir(ASSETS_DIR)).filter(f => /\.jpe?g$/i.test(f)).sort();
  console.log(`Found ${files.length} photos`);

  const photos: PhotoEntry[] = [];
  for (const file of files) {
    console.log(`  Processing ${file}...`);
    photos.push(await processPhoto(file, existing));
  }

  await writeFile(MANIFEST_PATH, JSON.stringify({ photos }, null, 2));
  console.log(`Manifest written to ${MANIFEST_PATH} (${photos.length} photos)`);
}

main().catch(console.error);
```

- [ ] **Step 2: Run the manifest script**

Run: `npm run manifest`

Expected: Creates `src/photos.json` with 45 entries, generates WebP images in `public/photographs/{thumb,med,full}/`.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-manifest.ts src/photos.json
git commit -m "feat: add build manifest script for EXIF extraction and responsive images"
```

---

### Task 4: CSS Foundation & Fonts

**Files:**
- Create: `src/styles/reset.css`
- Create: `src/styles/theme.css`
- Create: `public/fonts/` directory with font files

- [ ] **Step 1: Download font files**

Download WOFF2 files for Playfair Display (Regular, Italic), Inter (Regular 400, Medium 500), and JetBrains Mono (Regular 400) into `public/fonts/`. Use Google Fonts helper:

Run:
```bash
mkdir -p public/fonts
# Playfair Display Regular + Italic
curl -o public/fonts/playfair-display-regular.woff2 "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.woff2"
curl -o public/fonts/playfair-display-italic.woff2 "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtbK.woff2"
# Inter Regular + Medium
curl -o public/fonts/inter-regular.woff2 "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
curl -o public/fonts/inter-medium.woff2 "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2"
# JetBrains Mono Regular
curl -o public/fonts/jetbrains-mono-regular.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff2"
```

- [ ] **Step 2: Create src/styles/reset.css**

```css
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

img {
  display: block;
  max-width: 100%;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
```

- [ ] **Step 3: Create src/styles/theme.css**

```css
/* --- Fonts --- */

@font-face {
  font-family: 'Playfair Display';
  src: url('/fonts/playfair-display-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Playfair Display';
  src: url('/fonts/playfair-display-italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* --- Design tokens --- */

:root {
  --color-bg: #0a0a0b;
  --color-surface: #141416;
  --color-elevated: #1e1e21;
  --color-text-primary: #e8e4df;
  --color-text-secondary: #8a8680;
  --color-text-muted: #5a5650;
  --color-border: rgba(255, 255, 255, 0.06);

  --font-heading: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  --nav-height: 56px;
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
}

/* --- Base styles --- */

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-heading);
  font-weight: 400;
}

/* --- App layout --- */

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#app > main {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#app > main > canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* --- Utility --- */

.exif {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  letter-spacing: 0.03em;
}

.exif-separator {
  color: rgba(255, 255, 255, 0.1);
  margin: 0 0.35em;
}

/* --- EXIF fade animation --- */

.exif-container {
  transition: opacity 200ms var(--ease-out-quint), transform 200ms var(--ease-out-quint);
}

.exif-hidden .exif-container {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
}

/* --- Photo load animation --- */

.photo-img {
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}

.photo-img.loading {
  opacity: 0;
  transform: scale(1.02);
}

.photo-img.loaded {
  opacity: 1;
  transform: scale(1);
}
```

- [ ] **Step 4: Commit**

```bash
git add public/fonts/ src/styles/reset.css src/styles/theme.css
git commit -m "feat: add CSS reset, theme tokens, fonts, and animation utilities"
```

---

### Task 5: GL Utilities

**Files:**
- Create: `src/lib/gl.ts`

- [ ] **Step 1: Create src/lib/gl.ts**

```ts
export function initGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed:\n${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`Program link failed:\n${log}`);
  }
  // Shaders can be detached after linking
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export interface QuadVAO {
  vao: WebGLVertexArrayObject;
  draw: () => void;
  dispose: () => void;
}

/**
 * Creates a fullscreen quad VAO with a_pos (-1..1) and a_uv (0..1).
 * Attribute locations: a_pos = 0, a_uv = 1.
 */
export function createQuadVAO(gl: WebGL2RenderingContext): QuadVAO {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  // interleaved: a_pos(x,y), a_uv(s,t)
  const vertices = new Float32Array([
    // pos        uv
    -1, -1,    0, 0,   // bottom-left
     1, -1,    1, 0,   // bottom-right
    -1,  1,    0, 1,   // top-left
     1,  1,    1, 1,   // top-right
  ]);

  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // a_pos at location 0
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

  // a_uv at location 1
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return {
    vao,
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vbo);
    },
  };
}

/**
 * Creates a tessellated quad mesh for vertex displacement effects.
 * segX * segY * 6 vertices. Attribute locations: a_pos = 0, a_uv = 1.
 */
export function createTessellatedQuad(
  gl: WebGL2RenderingContext,
  segX: number,
  segY: number,
): QuadVAO {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const vertices: number[] = [];
  for (let y = 0; y < segY; y++) {
    for (let x = 0; x < segX; x++) {
      const x0 = x / segX;
      const x1 = (x + 1) / segX;
      const y0 = y / segY;
      const y1 = (y + 1) / segY;

      // Convert to clip space (-1..1)
      const cx0 = x0 * 2 - 1, cx1 = x1 * 2 - 1;
      const cy0 = y0 * 2 - 1, cy1 = y1 * 2 - 1;

      // Two triangles per cell
      // Triangle 1
      vertices.push(cx0, cy0, x0, y0);
      vertices.push(cx1, cy0, x1, y0);
      vertices.push(cx0, cy1, x0, y1);
      // Triangle 2
      vertices.push(cx1, cy0, x1, y0);
      vertices.push(cx1, cy1, x1, y1);
      vertices.push(cx0, cy1, x0, y1);
    }
  }

  const vertCount = segX * segY * 6;
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return {
    vao,
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, vertCount);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vbo);
    },
  };
}

/** Cache for compiled programs, keyed by vertSrc+fragSrc */
const programCache = new Map<string, WebGLProgram>();

export function getCachedProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const key = vertSrc + '\0' + fragSrc;
  let prog = programCache.get(key);
  if (!prog) {
    prog = createProgram(gl, vertSrc, fragSrc);
    programCache.set(key, prog);
  }
  return prog;
}

/** Helper to get uniform location with caching per program */
export function uniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

/**
 * Creates a WebGL texture with standard params for HTML element textures.
 */
export function createElementTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Initialize with 1x1 placeholder
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
    gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]),
  );
  return texture;
}

/**
 * Creates a WebGL texture from an image URL (for photo textures, wall textures, etc.)
 * Returns the texture immediately (1x1 placeholder) and updates it when the image loads.
 */
export function createImageTexture(
  gl: WebGL2RenderingContext,
  url: string,
  onLoad?: () => void,
): WebGLTexture {
  const texture = createElementTexture(gl);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    onLoad?.();
  };
  return texture;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/gl.ts
git commit -m "feat: add WebGL2 utilities — shader compilation, quad VAO, texture helpers"
```

---

### Task 6: Feature Detection & Photo Loading

**Files:**
- Create: `src/lib/detect.ts`
- Create: `src/lib/photos.ts`

- [ ] **Step 1: Create src/lib/detect.ts**

```ts
export type HiCSupport = 'supported' | 'missing-api';

export function detectHtmlInCanvas(): HiCSupport {
  // 1. requestPaint on HTMLCanvasElement prototype
  if (typeof HTMLCanvasElement.prototype.requestPaint !== 'function') {
    return 'missing-api';
  }

  // 2. texElementImage2D on WebGL2 prototype (probe a temporary context)
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const gl = probe.getContext('webgl2');
  if (!gl || typeof (gl as any).texElementImage2D !== 'function') {
    return 'missing-api';
  }

  // 3. drawElementImage on CanvasRenderingContext2D prototype
  if (typeof CanvasRenderingContext2D.prototype.drawElementImage !== 'function') {
    return 'missing-api';
  }

  return 'supported';
}
```

- [ ] **Step 2: Create src/lib/photos.ts**

```ts
import type { Photo, PhotoManifest } from '../types';
import manifest from '../photos.json';

const data = manifest as PhotoManifest;

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Returns a shuffled copy of all photos. */
export function getShuffledPhotos(): Photo[] {
  return shuffle(data.photos);
}

/** Selects the best image src for a given display width. */
export function responsiveSrc(photo: Photo, displayWidth: number): string {
  if (displayWidth <= 400) return photo.thumb;
  if (displayWidth <= 800) return photo.medium;
  return photo.full;
}

/** Formats EXIF as a display string: "85mm · ƒ/2.8 · 1/250s · ISO 400" */
export function formatExif(photo: Photo): string {
  const parts = [
    photo.exif.focalLength,
    photo.exif.aperture,
    photo.exif.shutterSpeed,
    photo.exif.iso,
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Loads an image progressively: shows LQIP immediately, then loads the
 * appropriate responsive size. Calls onLoad when the real image is ready.
 */
export function loadPhoto(
  img: HTMLImageElement,
  photo: Photo,
  displayWidth: number,
  onLoad?: () => void,
): void {
  // Start with LQIP
  img.src = photo.lqip;
  img.width = photo.width;
  img.height = photo.height;
  img.alt = photo.title || photo.description || `Photograph ${photo.id}`;
  img.classList.add('photo-img', 'loading');

  // Load real image
  const realSrc = responsiveSrc(photo, displayWidth);
  const loader = new Image();
  loader.src = realSrc;
  loader.onload = () => {
    img.src = realSrc;
    img.classList.remove('loading');
    img.classList.add('loaded');
    onLoad?.();
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/detect.ts src/lib/photos.ts
git commit -m "feat: add HiC feature detection and photo loading utilities"
```

---

### Task 7: Paint Tracker

**Files:**
- Create: `src/lib/paint-tracker.ts`

- [ ] **Step 1: Create src/lib/paint-tracker.ts**

```ts
import { createElementTexture } from './gl';

interface TrackedElement {
  element: HTMLElement;
  texture: WebGLTexture;
  dirty: boolean;
}

/**
 * Manages one WebGL texture per tracked DOM element.
 * Textures are uploaded via texElementImage2D inside the paint event handler.
 */
export class PaintTracker {
  private gl: WebGL2RenderingContext;
  private entries = new Map<string, TrackedElement>();
  private _dirty = false;
  private _hasFirstPaint = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /** Register a DOM element for texture tracking. */
  register(el: HTMLElement, id: string): void {
    if (this.entries.has(id)) return;
    const texture = createElementTexture(this.gl);
    this.entries.set(id, { element: el, texture, dirty: true });
  }

  /** Unregister and delete the texture for an element. */
  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.gl.deleteTexture(entry.texture);
      this.entries.delete(id);
    }
  }

  /**
   * Upload a single element's texture. MUST be called inside the paint handler.
   * Returns true if the upload succeeded.
   */
  uploadDirect(el: HTMLElement): boolean {
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;

    // Find entry by element reference
    for (const entry of this.entries.values()) {
      if (entry.element === el) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, entry.texture);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        (this.gl as any).texElementImage2D(
          this.gl.TEXTURE_2D, 0, this.gl.RGBA,
          this.gl.RGBA, this.gl.UNSIGNED_BYTE, el,
        );
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
        entry.dirty = false;
        this._dirty = true;
        this._hasFirstPaint = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Handle the paint event — upload textures for all changed elements.
   * Call this inside the canvas 'paint' event listener.
   */
  handlePaint(changedElements: readonly Element[]): void {
    for (const el of changedElements) {
      this.uploadDirect(el as HTMLElement);
    }
  }

  /** Get a texture by its registered id. */
  getTexture(id: string): WebGLTexture | null {
    return this.entries.get(id)?.texture ?? null;
  }

  /** Returns true if any texture was uploaded since last clearDirty(). */
  isDirty(): boolean {
    return this._dirty;
  }

  clearDirty(): void {
    this._dirty = false;
  }

  /** Returns true after the first successful texture upload. */
  hasFirstPaint(): boolean {
    return this._hasFirstPaint;
  }

  /** Clean up all textures. */
  dispose(): void {
    for (const entry of this.entries.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.entries.clear();
    this._dirty = false;
    this._hasFirstPaint = false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/paint-tracker.ts
git commit -m "feat: add PaintTracker for per-element WebGL texture management"
```

---

### Task 8: Render Shell

**Files:**
- Create: `src/shell.ts`

The shell owns the `<canvas layoutsubtree>`, the WebGL2 context, the paint event listener, and the dirty-flag RAF loop. Modes plug into it via hooks.

- [ ] **Step 1: Create src/shell.ts**

```ts
import { initGL, createQuadVAO, getCachedProgram, uniform, type QuadVAO } from './lib/gl';
import { PaintTracker } from './lib/paint-tracker';
import vertexSrc from './shaders/vertex.glsl?raw';
import passthroughSrc from './shaders/passthrough.frag?raw';

export type ModeHook = (dt: number) => void;

export class Shell {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly tracker: PaintTracker;
  readonly quad: QuadVAO;

  private rafId = 0;
  private idle = true;
  private dirty = false;
  private animating = false;
  private lastTime = 0;
  private modeHook: ModeHook | null = null;
  private overlayHook: ModeHook | null = null;
  private passthroughProgram: WebGLProgram;

  // Current viewport size in CSS pixels
  size = { w: 0, h: 0 };
  dpr = 1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('layoutsubtree', '');
    container.appendChild(this.canvas);

    this.gl = initGL(this.canvas);
    this.tracker = new PaintTracker(this.gl);
    this.quad = createQuadVAO(this.gl);
    this.passthroughProgram = getCachedProgram(this.gl, vertexSrc, passthroughSrc);

    // Paint event — upload textures
    this.canvas.addEventListener('paint', ((e: PaintEvent) => {
      this.tracker.handlePaint(e.changedElements);
      this.dirty = true;
      this.wake();
    }) as EventListener);

    // Resize handling
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    // Visibility — pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.sleep();
      else if (this.animating || this.dirty) this.wake();
    });
  }

  private handleResize = (): void => {
    this.dpr = window.devicePixelRatio || 1;
    this.size.w = this.canvas.clientWidth;
    this.size.h = this.canvas.clientHeight;

    this.canvas.width = Math.max(1, Math.floor(this.size.w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.size.h * this.dpr));

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = true;
    this.wake();
  };

  private draw = (now: number): void => {
    if (document.hidden || !this.tracker.hasFirstPaint()) {
      this.sleep();
      return;
    }

    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.modeHook) {
      // Mode takes full control of rendering
      this.modeHook(dt);
    } else {
      // Default passthrough — draw main texture 1:1
      this.drawPassthrough();
    }

    if (this.overlayHook) {
      this.overlayHook(dt);
    }

    this.dirty = false;
    this.tracker.clearDirty();

    if (this.animating || this.dirty) {
      this.rafId = requestAnimationFrame(this.draw);
    } else {
      this.sleep();
    }
  };

  private drawPassthrough(): void {
    const gl = this.gl;
    const tex = this.tracker.getTexture('mode-root');
    if (!tex) return;

    gl.useProgram(this.passthroughProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniform(gl, this.passthroughProgram, 'u_tex'), 0);

    // Fullscreen quad
    gl.uniform4f(
      uniform(gl, this.passthroughProgram, 'u_dst'),
      -1, -1, 2, 2,
    );

    this.quad.draw();
  }

  private wake(): void {
    if (this.idle) {
      this.idle = false;
      this.lastTime = 0;
      this.rafId = requestAnimationFrame(this.draw);
    }
    this.dirty = true;
  }

  private sleep(): void {
    if (!this.idle) {
      cancelAnimationFrame(this.rafId);
      this.idle = true;
    }
  }

  // --- Public API for modes ---

  setModeHook(hook: ModeHook | null): void {
    this.modeHook = hook;
  }

  setOverlayHook(hook: ModeHook | null): void {
    this.overlayHook = hook;
  }

  requestDraw(): void {
    this.dirty = true;
    this.wake();
  }

  setAnimating(animating: boolean): void {
    this.animating = animating;
    if (animating) this.wake();
  }

  /** Remove all direct children from the canvas. */
  clearCanvas(): void {
    while (this.canvas.firstChild) {
      this.canvas.removeChild(this.canvas.firstChild);
    }
    this.tracker.dispose();
  }

  /**
   * Creates a mode-root div as a direct child of the canvas,
   * registers it with the tracker, and returns it.
   */
  createModeRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'mode-root';
    this.canvas.appendChild(root);
    this.tracker.register(root, 'mode-root');
    return root;
  }

  /** Request the canvas to take a fresh paint snapshot. */
  requestPaint(): void {
    this.canvas.requestPaint?.();
  }

  dispose(): void {
    this.sleep();
    window.removeEventListener('resize', this.handleResize);
    this.tracker.dispose();
    this.quad.dispose();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shell.ts
git commit -m "feat: add render shell — canvas, GL context, paint handler, RAF loop"
```

---

### Task 9: Shared Shaders

**Files:**
- Create: `src/shaders/common.glsl`
- Create: `src/shaders/vertex.glsl`
- Create: `src/shaders/passthrough.frag`

- [ ] **Step 1: Create src/shaders/common.glsl**

```glsl
// sRGB linearization — MUST use for all shader math on HTML textures
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Pseudo-random hash
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// Film grain
float grain(vec2 uv, vec2 resolution, float time, float strength) {
  float n = hash21(uv * resolution + time * 0.2) - 0.5;
  return n * strength;
}

// Vignette
float vignette(vec2 uv, float radius, float softness) {
  float d = length(uv - 0.5);
  return 1.0 - smoothstep(radius, radius + softness, d);
}

// Smooth disc blur (13-tap Poisson disc)
vec4 discBlur(sampler2D tex, vec2 uv, float radius, vec2 texelSize) {
  if (radius < 0.001) return texture(tex, uv);

  const vec2 offsets[13] = vec2[13](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
    vec2(0.0, 2.0), vec2(0.0, -2.0), vec2(2.0, 0.0), vec2(-2.0, 0.0)
  );

  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 offset = offsets[i] * radius * texelSize;
    float w = 1.0 - length(offsets[i]) / 2.83;
    sum += texture(tex, uv + offset) * w;
    total += w;
  }
  return sum / total;
}
```

- [ ] **Step 2: Create src/shaders/vertex.glsl**

```glsl
#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;

out vec2 v_uv;

uniform vec4 u_dst; // (x, y, w, h) in clip space

void main() {
  vec2 clip = u_dst.xy + (a_pos * 0.5 + 0.5) * u_dst.zw;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
}
```

- [ ] **Step 3: Create src/shaders/passthrough.frag**

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

- [ ] **Step 4: Commit**

```bash
git add src/shaders/
git commit -m "feat: add shared shaders — common utilities, vertex shader, passthrough"
```

---

## Phase 2: UI Chrome

### Task 10: Entry Point & HTML

**Files:**
- Create: `src/index.html`
- Create: `src/main.ts`

- [ ] **Step 1: Create src/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Photography Portfolio</title>
  <meta name="description" content="A photography portfolio built with HTML-in-Canvas — live HTML rendered through custom WebGL2 shaders." />

  <!-- Open Graph -->
  <meta property="og:title" content="Photography Portfolio" />
  <meta property="og:description" content="Seven viewing modes, each enhanced by HTML-in-Canvas — an experimental web API that lets you apply custom GLSL shaders to live HTML content." />
  <meta property="og:type" content="website" />

  <!-- Preload heading font for LCP -->
  <link rel="preload" href="/fonts/playfair-display-italic.woff2" as="font" type="font/woff2" crossorigin />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "name": "Photography Portfolio",
    "description": "A photography portfolio showcasing HTML-in-Canvas technology",
    "author": {
      "@type": "Person",
      "name": "Photographer"
    }
  }
  </script>

  <script type="module" src="/main.ts"></script>
</head>
<body>
  <div id="app">
    <nav id="main-nav"></nav>
    <main id="canvas-container"></main>
    <aside id="learn-drawer" class="drawer-closed"></aside>
    <div id="about-panel" class="panel-hidden"></div>
    <div id="detail-view" class="detail-hidden"></div>
  </div>

  <!-- Feature detection fallback (visible if JS fails) -->
  <noscript>
    <style>
      #app { display: none; }
      .noscript-fallback { padding: 2rem; color: #e8e4df; background: #0a0a0b; font-family: system-ui; }
    </style>
    <div class="noscript-fallback">
      <h1>Photography Portfolio</h1>
      <p>This portfolio requires JavaScript and Chrome Canary with the HTML-in-Canvas flag enabled.</p>
    </div>
  </noscript>
</body>
</html>
```

- [ ] **Step 2: Create src/main.ts**

```ts
import './styles/reset.css';
import './styles/theme.css';
import './styles/nav.css';
import './styles/learn.css';
import './styles/about.css';
import './styles/detail.css';

import { detectHtmlInCanvas } from './lib/detect';
import { getShuffledPhotos } from './lib/photos';
import { Shell } from './shell';
import { createNav } from './nav/nav';
import { createLearnDrawer } from './learn/learn';
import { createAboutPanel } from './about/about';
import { createDetailView } from './detail/detail';
import type { ModeName, ModeImpl, ModeContext } from './types';

// --- Feature detection gate ---
const support = detectHtmlInCanvas();
if (support !== 'supported') {
  document.getElementById('app')!.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:2rem;text-align:center;">
      <h1 style="font-family:var(--font-heading);font-size:2rem;margin-bottom:1rem;">Photography Portfolio</h1>
      <p style="color:var(--color-text-secondary);max-width:480px;line-height:1.7;">
        This portfolio uses <strong>HTML-in-Canvas</strong>, an experimental web API.
        To view it, open <strong>Chrome Canary</strong> and enable:
      </p>
      <code style="display:block;margin:1rem 0;padding:0.75rem 1.5rem;background:var(--color-surface);border-radius:8px;font-family:var(--font-mono);color:var(--color-text-primary);">
        chrome://flags/#canvas-draw-element
      </code>
      <p style="color:var(--color-text-muted);font-size:0.85rem;">Then reload this page.</p>
    </div>
  `;
  throw new Error('HTML-in-Canvas not supported');
}

// --- App initialization ---
const photos = getShuffledPhotos();
const container = document.getElementById('canvas-container')!;
const shell = new Shell(container);

let currentMode: ModeImpl | null = null;
let currentModeName: ModeName = 'album';

// Mode loader map — dynamic imports for code splitting
const modeLoaders: Record<ModeName, () => Promise<{ default: (ctx: ModeContext) => ModeImpl }>> = {
  album: () => import('./modes/album/album'),
  slideshow: () => import('./modes/slideshow/slideshow'),
  'print-table': () => import('./modes/print-table/print-table'),
  'film-strip': () => import('./modes/film-strip/film-strip'),
  'wall-exhibition': () => import('./modes/wall-exhibition/wall-exhibition'),
  'stacked-prints': () => import('./modes/stacked-prints/stacked-prints'),
  collage: () => import('./modes/collage/collage'),
};

function openDetail(photoIndex: number): void {
  detail.open(photos, photoIndex);
}

async function switchMode(name: ModeName): Promise<void> {
  if (name === currentModeName && currentMode) return;

  const doSwitch = async () => {
    // Tear down
    if (currentMode) {
      currentMode.destroy();
      currentMode = null;
    }
    shell.setModeHook(null);
    shell.setOverlayHook(null);
    shell.setAnimating(false);
    shell.clearCanvas();

    // Load new mode
    const module = await modeLoaders[name]();
    const ctx: ModeContext = {
      gl: shell.gl,
      canvas: shell.canvas,
      photos,
      size: { ...shell.size },
      dpr: shell.dpr,
      requestDraw: () => shell.requestDraw(),
      setAnimating: (a) => shell.setAnimating(a),
      openDetail,
    };

    currentMode = module.default(ctx);
    currentModeName = name;

    // Request initial paint
    shell.requestPaint();

    // Update UI
    nav.setActiveMode(name);
    learn.setMode(name);
  };

  // Wrap in View Transition if available
  if (document.startViewTransition) {
    document.startViewTransition(doSwitch);
  } else {
    await doSwitch();
  }
}

// --- UI components ---
const nav = createNav({
  onModeSwitch: switchMode,
  onToggleExif: () => {
    document.body.classList.toggle('exif-hidden');
    const hidden = document.body.classList.contains('exif-hidden');
    localStorage.setItem('exif-hidden', hidden ? '1' : '0');
  },
  onToggleLearn: () => learn.toggle(),
  onOpenAbout: () => about.open(),
});

const learn = createLearnDrawer();
const about = createAboutPanel();
const detail = createDetailView();

// --- Restore persisted state ---
if (localStorage.getItem('exif-hidden') === '1') {
  document.body.classList.add('exif-hidden');
}

// --- Pointer events from canvas to current mode ---
shell.canvas.addEventListener('pointermove', (e) => currentMode?.onPointer?.(e));
shell.canvas.addEventListener('pointerdown', (e) => currentMode?.onPointer?.(e));
shell.canvas.addEventListener('pointerup', (e) => currentMode?.onPointer?.(e));

// --- Resize events to current mode ---
window.addEventListener('resize', () => {
  currentMode?.onResize?.(shell.size);
});

// --- Boot default mode ---
switchMode('album');
```

- [ ] **Step 3: Commit**

```bash
git add src/index.html src/main.ts
git commit -m "feat: add entry point with feature detection, mode routing, and app bootstrap"
```

---

### Task 11: Nav Bar

**Files:**
- Create: `src/nav/nav.ts`
- Create: `src/styles/nav.css`

- [ ] **Step 1: Create src/nav/nav.ts**

```ts
import { MODE_ORDER, MODE_LABELS, type ModeName } from '../types';

interface NavOptions {
  onModeSwitch: (name: ModeName) => void;
  onToggleExif: () => void;
  onToggleLearn: () => void;
  onOpenAbout: () => void;
}

interface Nav {
  setActiveMode: (name: ModeName) => void;
}

export function createNav(opts: NavOptions): Nav {
  const el = document.getElementById('main-nav')!;

  // Left: site title
  const title = document.createElement('div');
  title.className = 'nav-title';
  title.innerHTML = '<span class="nav-title-text">Photography Portfolio</span>';

  // Center: mode switcher
  const modes = document.createElement('div');
  modes.className = 'nav-modes';

  const buttons = new Map<ModeName, HTMLButtonElement>();
  const indicator = document.createElement('div');
  indicator.className = 'nav-indicator';
  modes.appendChild(indicator);

  for (const name of MODE_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'nav-mode-btn';
    btn.textContent = MODE_LABELS[name];
    btn.dataset.mode = name;
    btn.addEventListener('click', () => opts.onModeSwitch(name));
    modes.appendChild(btn);
    buttons.set(name, btn);
  }

  // Right: controls
  const controls = document.createElement('div');
  controls.className = 'nav-controls';

  const exifBtn = document.createElement('button');
  exifBtn.className = 'nav-ctrl-btn';
  exifBtn.textContent = 'EXIF';
  exifBtn.addEventListener('click', opts.onToggleExif);

  const learnBtn = document.createElement('button');
  learnBtn.className = 'nav-ctrl-btn';
  learnBtn.textContent = 'Learn';
  learnBtn.addEventListener('click', opts.onToggleLearn);

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'nav-ctrl-btn';
  aboutBtn.textContent = 'About';
  aboutBtn.addEventListener('click', opts.onOpenAbout);

  controls.append(exifBtn, learnBtn, aboutBtn);
  el.append(title, modes, controls);

  function updateIndicator(name: ModeName): void {
    const btn = buttons.get(name);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const navRect = modes.getBoundingClientRect();
    indicator.style.left = `${rect.left - navRect.left}px`;
    indicator.style.width = `${rect.width}px`;
  }

  return {
    setActiveMode(name: ModeName) {
      for (const [n, btn] of buttons) {
        btn.classList.toggle('active', n === name);
      }
      updateIndicator(name);
    },
  };
}
```

- [ ] **Step 2: Create src/styles/nav.css**

```css
#main-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 1.5rem;
  background: rgba(10, 10, 11, 0.85);
  border-bottom: 1px solid var(--color-border);
  position: relative;
  z-index: 100;
}

.nav-title-text {
  font-family: var(--font-heading);
  font-style: italic;
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.nav-modes {
  display: flex;
  gap: 1.5rem;
  position: relative;
}

.nav-mode-btn {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  padding: 0.25rem 0;
  transition: color 150ms var(--ease-out-quint);
}

.nav-mode-btn:hover {
  color: var(--color-text-secondary);
}

.nav-mode-btn.active {
  color: var(--color-text-primary);
}

.nav-indicator {
  position: absolute;
  bottom: -1px;
  height: 1px;
  background: var(--color-text-primary);
  transition: left 300ms var(--ease-out-quint), width 300ms var(--ease-out-quint);
}

.nav-controls {
  display: flex;
  gap: 1rem;
}

.nav-ctrl-btn {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  transition: color 150ms var(--ease-out-quint);
}

.nav-ctrl-btn:hover {
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/nav/nav.ts src/styles/nav.css
git commit -m "feat: add nav bar with mode switcher, sliding indicator, and controls"
```

---

### Task 12: Learn Drawer

**Files:**
- Create: `src/learn/learn.ts`
- Create: `src/learn/content.ts`
- Create: `src/styles/learn.css`

- [ ] **Step 1: Create src/learn/content.ts**

```ts
import type { ModeName } from '../types';

interface LearnContent {
  title: string;
  description: string;
  howItWorks: string;
  whyHiC: string;
  keyCode: string;
}

export const LEARN_CONTENT: Record<ModeName, LearnContent> = {
  album: {
    title: 'Album',
    description: 'A photo book you flip through — pages curl and bend like real paper.',
    howItWorks: 'Each page spread is live HTML (real text, real images) captured as a WebGL texture via <code>texElementImage2D</code>. The page-turn shader displaces vertices along a curl curve, mapping the texture onto the bending surface. A paper texture overlay and spine shadow are composited by the shader even on flat pages.',
    whyHiC: 'CSS 3D transforms can do rigid <code>rotateY</code> page flips. They cannot curl or bend content along a curve — that requires per-vertex displacement on page geometry with the HTML content mapped as a texture. Without HiC, you\'d need to pre-render all text as images, losing accessibility, text selection, and crisp scaling.',
    keyCode: `gl.texElementImage2D(\n  gl.TEXTURE_2D, 0,\n  gl.RGBA, gl.RGBA,\n  gl.UNSIGNED_BYTE, pageElement\n);`,
  },
  slideshow: {
    title: 'Cinematic Slideshow',
    description: 'Full-screen photos with cinematic GLSL transitions between slides.',
    howItWorks: 'Both outgoing and incoming slides (photo + caption) are captured as separate textures via the PaintTracker. A randomly-selected transition shader blends them at the pixel level — film burn, rack focus, or luminance dissolve.',
    whyHiC: 'The View Transitions API can fade or slide between DOM snapshots, but can\'t do per-pixel noise-pattern dissolves, directional motion blur, or luminance-keyed blending. Those require custom GLSL sampling of both textures simultaneously. The caption participates in the dissolve because photo and caption are one texture.',
    keyCode: `// Two textures blended in fragment shader\nvec4 from = texture(u_from, v_uv);\nvec4 to = texture(u_to, v_uv);\nfrag_color = mix(from, to, progress);`,
  },
  'print-table': {
    title: 'Print Table',
    description: 'Photos on a dark surface with a cursor-following spotlight.',
    howItWorks: 'The entire HTML grid is captured as one composite texture. The spotlight fragment shader applies radial brightness falloff and distance-based Gaussian blur in a single pass — the effect flows seamlessly across element boundaries.',
    whyHiC: 'CSS can dim individual elements with <code>filter: brightness()</code>, but the blur crosses element boundaries — it flows from one photo into the gap and into the next caption. Per-pixel variable-radius blur on a composite HTML rendering is only possible via a fragment shader on the HTML texture.',
    keyCode: `float dist = distance(v_uv, u_mousePos);\nfloat brightness = smoothstep(0.5, 0.0, dist);\nvec4 blurred = discBlur(u_tex, v_uv, dist * 20.0, texelSize);`,
  },
  'film-strip': {
    title: 'Film Strip',
    description: 'A horizontal filmstrip with sprocket holes that curves like real film.',
    howItWorks: 'The HTML strip (photos, sprocket holes, frame counters) is captured as one texture. A curvature shader bends the flat layout into a 3D surface. <code>getElementTransform</code> synchronizes hit testing so clicks land correctly on the curved content.',
    whyHiC: 'CSS 3D can angle individual elements, but the gap between frames, the sprocket holes, and the counters all need to curve together as one continuous surface. Only a shader on the composite texture achieves this. Hit testing via <code>getElementTransform</code> has no CSS equivalent.',
    keyCode: `// Curvature: y-displacement based on x-distance from center\nfloat curve = pow(abs(center.x), 2.0) * u_curvature;\nvec2 curved_uv = v_uv + vec2(0.0, curve);`,
  },
  'wall-exhibition': {
    title: 'Wall Exhibition',
    description: 'Photos hung on a gallery wall with overhead directional lighting.',
    howItWorks: 'The HTML composition is captured as a texture. The shader composites it onto a procedural wall texture and applies overhead gallery lighting — per-pixel brightness falloff, position-dependent shadows, and light spill that crosses element boundaries.',
    whyHiC: 'Three CSS impossibilities: compositing HTML onto a background texture in a shader, per-pixel lighting within a single element (CSS brightness is uniform per-element), and cast shadows whose direction varies by position relative to light sources.',
    keyCode: `// Gallery lighting: overhead spot, inverse-square falloff\nfloat lighting = 1.0 / (1.0 + dist_to_light * dist_to_light);\nvec3 wall = texture(u_wallTex, v_uv).rgb;\nvec3 html = texture(u_tex, v_uv).rgb;\nfrag_color = vec4(mix(wall, html, htmlAlpha) * lighting, 1.0);`,
  },
  'stacked-prints': {
    title: 'Stacked Prints',
    description: 'A pile of prints you toss aside — paper warps and flexes as you interact.',
    howItWorks: 'Each print is a separate canvas child with its own texture. The paper warp is vertex displacement responding to grab position and drag velocity. Front shows the photo, back shows EXIF — two HTML textures on one deforming mesh.',
    whyHiC: 'CSS transforms are affine — they rotate, scale, and skew, but cannot bend or curl within a single element. The paper warp is non-linear deformation of live HTML. The double-sided print needs two HTML textures on one mesh. No CSS achieves this.',
    keyCode: `// Paper warp: curl from grab point\nfloat d = distance(a_uv, u_grabPoint);\nfloat warp = sin(d * 3.14) * u_curlAmount;\nvec2 displaced = a_pos + vec2(0.0, warp);`,
  },
  collage: {
    title: 'Collage',
    description: 'An editorial collage rendered through a tilt-shift miniature effect.',
    howItWorks: 'The collage layout (overlapping, rotated photos) is captured as one composite texture. A tilt-shift shader applies a horizontal band of sharpness with progressive blur above and below — varying per-pixel, crossing element boundaries.',
    whyHiC: 'CSS <code>filter: blur()</code> applies uniformly per-element. A photo spanning the tilt-shift boundary is sharp in its center and blurred at its edges — within the same element. The blur crosses overlapping photos and caption text seamlessly. Only a fragment shader on the composite texture can do this.',
    keyCode: `// Tilt-shift: blur increases with distance from focus band\nfloat blurAmount = abs(v_uv.y - u_focusY) * u_blurStrength;\nvec4 color = discBlur(u_tex, v_uv, blurAmount, texelSize);`,
  },
};
```

- [ ] **Step 2: Create src/learn/learn.ts**

```ts
import { LEARN_CONTENT } from './content';
import type { ModeName } from '../types';

interface LearnDrawer {
  toggle: () => void;
  setMode: (name: ModeName) => void;
}

export function createLearnDrawer(): LearnDrawer {
  const el = document.getElementById('learn-drawer')!;

  // Restore persisted state
  const wasOpen = localStorage.getItem('learn-drawer') !== 'closed';
  if (wasOpen) {
    el.classList.remove('drawer-closed');
    el.classList.add('drawer-open');
  }

  // Build structure
  el.innerHTML = `
    <div class="learn-header">
      <span class="learn-label">How This Mode Works</span>
    </div>
    <div class="learn-body">
      <h3 class="learn-title"></h3>
      <p class="learn-desc"></p>
      <div class="learn-section">
        <span class="learn-section-label">How It Works</span>
        <div class="learn-how"></div>
      </div>
      <div class="learn-section">
        <span class="learn-section-label">Why HTML-in-Canvas?</span>
        <div class="learn-why"></div>
      </div>
      <div class="learn-section">
        <span class="learn-section-label">Key Code</span>
        <pre class="learn-code"><code></code></pre>
      </div>
    </div>
  `;

  const titleEl = el.querySelector('.learn-title')!;
  const descEl = el.querySelector('.learn-desc')!;
  const howEl = el.querySelector('.learn-how')!;
  const whyEl = el.querySelector('.learn-why')!;
  const codeEl = el.querySelector('.learn-code code')!;
  const bodyEl = el.querySelector('.learn-body')! as HTMLElement;

  return {
    toggle() {
      const isOpen = el.classList.contains('drawer-open');
      el.classList.toggle('drawer-open', !isOpen);
      el.classList.toggle('drawer-closed', isOpen);
      localStorage.setItem('learn-drawer', isOpen ? 'closed' : 'open');
    },

    setMode(name: ModeName) {
      const content = LEARN_CONTENT[name];
      if (!content) return;

      // Fade content
      bodyEl.style.opacity = '0';
      setTimeout(() => {
        titleEl.textContent = content.title;
        descEl.textContent = content.description;
        howEl.innerHTML = content.howItWorks;
        whyEl.innerHTML = content.whyHiC;
        codeEl.textContent = content.keyCode;
        bodyEl.style.opacity = '1';
      }, 150);
    },
  };
}
```

- [ ] **Step 3: Create src/styles/learn.css**

```css
#learn-drawer {
  position: fixed;
  top: var(--nav-height);
  right: 0;
  bottom: 0;
  width: 340px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  z-index: 90;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 300ms var(--ease-out-quint);
}

#learn-drawer.drawer-open {
  transform: translateX(0);
}

#learn-drawer.drawer-closed {
  transform: translateX(100%);
}

.learn-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.learn-label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.learn-body {
  padding: 1.25rem;
  transition: opacity 150ms var(--ease-out-quint);
}

.learn-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.learn-desc {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.learn-section {
  margin-bottom: 1.5rem;
}

.learn-section-label {
  display: block;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.learn-section p,
.learn-how,
.learn-why {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.learn-section code {
  font-family: var(--font-mono);
  font-size: 0.8em;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.learn-code {
  background: var(--color-bg);
  border-radius: 6px;
  padding: 0.75rem;
  overflow-x: auto;
}

.learn-code code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  white-space: pre;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/learn/ src/styles/learn.css
git commit -m "feat: add learn drawer with per-mode educational content"
```

---

### Task 13: About Panel

**Files:**
- Create: `src/about/about.ts`
- Create: `src/styles/about.css`

- [ ] **Step 1: Create src/about/about.ts**

```ts
interface AboutPanel {
  open: () => void;
  close: () => void;
}

export function createAboutPanel(): AboutPanel {
  const el = document.getElementById('about-panel')!;

  el.innerHTML = `
    <div class="about-backdrop"></div>
    <div class="about-card">
      <h2 class="about-title">Photography Portfolio</h2>
      <p class="about-text">
        A photography portfolio built with <strong>HTML-in-Canvas</strong>, an experimental web API
        that lets you place live HTML inside a canvas and render it through custom WebGL2 shaders.
      </p>
      <p class="about-text">
        Every viewing mode is a real portfolio experience — the kind photographers use to present
        their work — enhanced by HiC in ways that are impossible with CSS and JavaScript alone.
      </p>
      <div class="about-links">
        <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noopener">
          HiC Spec ↗
        </a>
      </div>
      <button class="about-close">Close</button>
    </div>
  `;

  const backdrop = el.querySelector('.about-backdrop')!;
  const closeBtn = el.querySelector('.about-close')!;

  function close() {
    el.classList.remove('panel-visible');
    el.classList.add('panel-hidden');
  }

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  return {
    open() {
      el.classList.remove('panel-hidden');
      el.classList.add('panel-visible');
    },
    close,
  };
}
```

- [ ] **Step 2: Create src/styles/about.css**

```css
#about-panel {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

#about-panel.panel-visible {
  pointer-events: auto;
}

.about-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  opacity: 0;
  transition: opacity 200ms var(--ease-out-quint);
}

.panel-visible .about-backdrop {
  opacity: 1;
}

.about-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2.5rem;
  max-width: 480px;
  width: 90%;
  opacity: 0;
  transform: scale(0.97);
  transition: opacity 250ms var(--ease-out-quint), transform 250ms var(--ease-out-quint);
}

.panel-visible .about-card {
  opacity: 1;
  transform: scale(1);
}

.panel-hidden .about-backdrop,
.panel-hidden .about-card {
  opacity: 0;
  pointer-events: none;
}

.about-title {
  font-family: var(--font-heading);
  font-style: italic;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.about-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 1rem;
}

.about-text strong {
  color: var(--color-text-primary);
}

.about-links {
  margin: 1.5rem 0;
}

.about-links a {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 150ms var(--ease-out-quint);
}

.about-links a:hover {
  color: var(--color-text-primary);
}

.about-close {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  transition: color 150ms var(--ease-out-quint), border-color 150ms var(--ease-out-quint);
}

.about-close:hover {
  color: var(--color-text-secondary);
  border-color: rgba(255, 255, 255, 0.12);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/about/ src/styles/about.css
git commit -m "feat: add about panel overlay"
```

---

### Task 14: Detail View

**Files:**
- Create: `src/detail/detail.ts`
- Create: `src/styles/detail.css`

- [ ] **Step 1: Create src/detail/detail.ts**

```ts
import type { Photo } from '../types';
import { formatExif } from '../lib/photos';

interface DetailView {
  open: (photos: Photo[], index: number) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createDetailView(): DetailView {
  const el = document.getElementById('detail-view')!;
  let photos: Photo[] = [];
  let currentIndex = 0;
  let isVisible = false;

  el.innerHTML = `
    <div class="detail-backdrop"></div>
    <div class="detail-content">
      <img class="detail-img" />
      <div class="detail-info">
        <h3 class="detail-title"></h3>
        <p class="detail-desc"></p>
        <div class="detail-exif exif-container">
          <span class="exif detail-exif-text"></span>
        </div>
      </div>
    </div>
    <button class="detail-nav detail-prev" aria-label="Previous">‹</button>
    <button class="detail-nav detail-next" aria-label="Next">›</button>
  `;

  const backdrop = el.querySelector('.detail-backdrop') as HTMLElement;
  const content = el.querySelector('.detail-content') as HTMLElement;
  const img = el.querySelector('.detail-img') as HTMLImageElement;
  const titleEl = el.querySelector('.detail-title')!;
  const descEl = el.querySelector('.detail-desc')!;
  const exifEl = el.querySelector('.detail-exif-text')!;
  const prevBtn = el.querySelector('.detail-prev')!;
  const nextBtn = el.querySelector('.detail-next')!;

  function show(index: number): void {
    const photo = photos[index];
    if (!photo) return;
    currentIndex = index;

    img.src = photo.full;
    img.alt = photo.title || photo.description || `Photograph ${photo.id}`;
    img.width = photo.width;
    img.height = photo.height;

    titleEl.textContent = photo.title || '';
    descEl.textContent = photo.description || '';
    exifEl.textContent = formatExif(photo);

    // Hide prev/next if at bounds
    prevBtn.classList.toggle('hidden', index === 0);
    nextBtn.classList.toggle('hidden', index === photos.length - 1);
  }

  function close(): void {
    if (!isVisible) return;
    isVisible = false;
    el.classList.remove('detail-visible');
    el.classList.add('detail-hidden');
  }

  // Events
  backdrop.addEventListener('click', close);
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) show(currentIndex - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex < photos.length - 1) show(currentIndex + 1);
  });

  document.addEventListener('keydown', (e) => {
    if (!isVisible) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && currentIndex > 0) show(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) show(currentIndex + 1);
  });

  return {
    open(p: Photo[], index: number) {
      photos = p;
      show(index);
      isVisible = true;
      el.classList.remove('detail-hidden');
      el.classList.add('detail-visible');
    },
    close,
    isOpen: () => isVisible,
  };
}
```

- [ ] **Step 2: Create src/styles/detail.css**

```css
#detail-view {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

#detail-view.detail-visible {
  pointer-events: auto;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  opacity: 0;
  transition: opacity 300ms var(--ease-out-quint);
}

.detail-visible .detail-backdrop {
  opacity: 1;
}

.detail-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 90vw;
  max-height: 85vh;
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 400ms var(--ease-out-quint), transform 400ms var(--ease-out-quint);
}

.detail-visible .detail-content {
  opacity: 1;
  transform: scale(1);
}

.detail-hidden .detail-backdrop,
.detail-hidden .detail-content {
  opacity: 0;
  pointer-events: none;
}

.detail-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 2px;
}

.detail-info {
  margin-top: 1rem;
  text-align: center;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 200ms var(--ease-out-quint) 200ms, transform 200ms var(--ease-out-quint) 200ms;
}

.detail-visible .detail-info {
  opacity: 1;
  transform: translateY(0);
}

.detail-title {
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.detail-desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.detail-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.3);
  padding: 1rem;
  transition: color 150ms var(--ease-out-quint);
  z-index: 10;
}

.detail-nav:hover {
  color: rgba(255, 255, 255, 0.7);
}

.detail-prev { left: 1rem; }
.detail-next { right: 1rem; }
.detail-nav.hidden { display: none; }
```

- [ ] **Step 3: Commit**

```bash
git add src/detail/ src/styles/detail.css
git commit -m "feat: add photo detail view with zoom animation and arrow navigation"
```

---

## Phase 3: Viewing Modes

Each mode follows this pattern:
1. Receive `ModeContext` with GL context, canvas, photos, size, etc.
2. Create DOM elements as direct children of the canvas (or inside a mode-root)
3. Register elements with the shell's PaintTracker
4. Set a mode hook that draws using uploaded textures and the mode's shader
5. Handle pointer events and resize
6. Clean up in `destroy()`

### Task 15: Print Table Mode

**Files:**
- Create: `src/modes/print-table/print-table.ts`
- Create: `src/modes/print-table/spotlight.frag`

The simplest mode — validates the entire HiC pipeline end-to-end.

- [ ] **Step 1: Create src/modes/print-table/spotlight.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_mousePos;     // normalized 0..1
uniform vec2 u_resolution;   // physical pixels

// --- common.glsl inlined (GLSL doesn't support #include) ---
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec4 discBlur(sampler2D tex, vec2 uv, float radius, vec2 texelSize) {
  if (radius < 0.001) return texture(tex, uv);
  const vec2 offsets[13] = vec2[13](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
    vec2(0.0, 2.0), vec2(0.0, -2.0), vec2(2.0, 0.0), vec2(-2.0, 0.0)
  );
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 offset = offsets[i] * radius * texelSize;
    float w = 1.0 - length(offsets[i]) / 2.83;
    sum += texture(tex, uv + offset) * w;
    total += w;
  }
  return sum / total;
}
// --- end common ---

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  float dist = distance(v_uv, u_mousePos);

  // Spotlight brightness: bright at center, dark at edges
  float brightness = smoothstep(0.55, 0.0, dist) * 0.85 + 0.15;

  // Distance-based blur: sharp at spotlight, blurry far away
  float blurRadius = smoothstep(0.0, 0.4, dist) * 16.0;

  vec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);
  vec3 linear = srgbToLinear(color.rgb);

  // Apply spotlight brightness
  linear *= brightness;

  // Subtle vignette
  float vig = 1.0 - smoothstep(0.4, 0.85, length(v_uv - 0.5));
  linear *= vig;

  frag_color = vec4(linearToSrgb(linear), 1.0);
}
```

- [ ] **Step 2: Create src/modes/print-table/print-table.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, type QuadVAO, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import spotlightSrc from './spotlight.frag?raw';

function createGridHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    padding: 2rem;
    width: 100%;
    min-height: 100%;
    background: #0a0a0b;
  `;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const card = document.createElement('article');
    card.className = 'print-card';
    card.dataset.index = String(i);
    card.style.cssText = `cursor: pointer;`;

    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      border-radius: 2px;
      background: #141416;
    `;
    loadPhoto(img, photo, 400);

    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 0.5rem;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      color: #8a8680;
    `;
    caption.textContent = photo.title || photo.description || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      margin-top: 0.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #5a5650;
    `;
    exif.textContent = formatExif(photo);

    card.append(img, caption, exif);
    root.appendChild(card);
  }
}

export default function createPrintTable(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating, openDetail } = ctx;

  // Create mode root as direct canvas child
  const root = document.createElement('div');
  root.id = 'mode-root';
  canvas.appendChild(root);

  // Register with tracker
  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  // Build HTML grid
  createGridHTML(root, photos);

  // Paint handler
  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  // Shader program
  const program = getCachedProgram(gl, vertexSrc, spotlightSrc);
  const quad = createQuadVAO(gl);

  // Mouse position (normalized 0..1)
  let mouseX = 0.5;
  let mouseY = 0.5;

  // Request initial paint
  canvas.requestPaint?.();

  const mode: ModeImpl = {
    paint(_dt: number) {
      if (!tracker.hasFirstPaint()) return;

      const tex = tracker.getTexture('mode-root');
      if (!tex) return;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
      gl.uniform2f(uniform(gl, program, 'u_mousePos'), mouseX, mouseY);
      gl.uniform2f(uniform(gl, program, 'u_resolution'),
        canvas.width, canvas.height);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);

      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointermove') {
        const rect = canvas.getBoundingClientRect();
        mouseX = (ev.clientX - rect.left) / rect.width;
        mouseY = 1.0 - (ev.clientY - rect.top) / rect.height; // flip Y for GL
        requestDraw();
      }
      if (ev.type === 'pointerdown') {
        // Check if a card was clicked
        const target = ev.target as HTMLElement;
        const card = target.closest('[data-index]') as HTMLElement | null;
        if (card) {
          openDetail(parseInt(card.dataset.index!, 10));
        }
      }
    },

    onResize() {
      requestDraw();
    },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  // Set shell hook
  // We access the shell through a closure — the mode hook is set by main.ts
  // Actually, we use the paint method directly
  return mode;
}
```

- [ ] **Step 3: Update main.ts to wire mode hooks**

In `src/main.ts`, the `switchMode` function needs to set the shell's mode hook to call the mode's `paint` method. Update the `doSwitch` function inside `switchMode`:

Replace the mode construction section in `main.ts`:

```ts
    currentMode = module.default(ctx);
    currentModeName = name;

    // Wire mode's paint into shell's render loop
    shell.setModeHook((dt) => currentMode?.paint(dt));
```

- [ ] **Step 4: Verify**

Run: `npm run dev`

Open Chrome Canary with `chrome://flags/#canvas-draw-element` enabled. Navigate to `http://localhost:5173`. You should see:
- A 4-column grid of photos on a dark background
- A soft spotlight following your cursor
- Photos further from the cursor are dimmer and blurred
- Clicking a photo opens the detail view

- [ ] **Step 5: Commit**

```bash
git add src/modes/print-table/
git commit -m "feat: add Print Table mode — spotlight shader on HTML photo grid"
```

---

### Task 16: Collage Mode

**Files:**
- Create: `src/modes/collage/collage.ts`
- Create: `src/modes/collage/tilt-shift.frag`

- [ ] **Step 1: Create src/modes/collage/tilt-shift.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform float u_focusY;        // normalized Y of sharp band center (default ~0.5)
uniform float u_blurStrength;  // blur multiplier (default ~20.0)

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec4 discBlur(sampler2D tex, vec2 uv, float radius, vec2 texelSize) {
  if (radius < 0.001) return texture(tex, uv);
  const vec2 offsets[13] = vec2[13](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
    vec2(0.0, 2.0), vec2(0.0, -2.0), vec2(2.0, 0.0), vec2(-2.0, 0.0)
  );
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 offset = offsets[i] * radius * texelSize;
    float w = 1.0 - length(offsets[i]) / 2.83;
    sum += texture(tex, uv + offset) * w;
    total += w;
  }
  return sum / total;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Tilt-shift: blur increases with distance from focus band
  float dist = abs(v_uv.y - u_focusY);
  float blurRadius = smoothstep(0.0, 0.3, dist) * u_blurStrength;

  vec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);
  vec3 linear = srgbToLinear(color.rgb);

  // Slight brightness boost in focus band
  float focusBright = 1.0 + (1.0 - smoothstep(0.0, 0.15, dist)) * 0.08;
  linear *= focusBright;

  // Subtle warm vignette
  float vig = 1.0 - smoothstep(0.35, 0.9, length(v_uv - 0.5));
  linear *= vig;

  frag_color = vec4(linearToSrgb(linear), 1.0);
}
```

- [ ] **Step 2: Create src/modes/collage/collage.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import tiltShiftSrc from './tilt-shift.frag?raw';

// Predefined collage layout templates
// Each template defines normalized positions/sizes/rotations for N photos
interface SlotDef {
  x: string; y: string; w: string; rot: number; z: number;
}

const TEMPLATES: SlotDef[][] = [
  // Template A: staggered editorial (8 slots)
  [
    { x: '2%',  y: '3%',  w: '38%', rot: -2,  z: 1 },
    { x: '35%', y: '8%',  w: '30%', rot: 1.5, z: 2 },
    { x: '60%', y: '2%',  w: '36%', rot: -1,  z: 1 },
    { x: '5%',  y: '38%', w: '32%', rot: 1,   z: 3 },
    { x: '30%', y: '42%', w: '35%', rot: -1.5,z: 2 },
    { x: '58%', y: '36%', w: '38%', rot: 2,   z: 1 },
    { x: '10%', y: '68%', w: '36%', rot: -1,  z: 2 },
    { x: '45%', y: '72%', w: '32%', rot: 1,   z: 3 },
  ],
  // Template B: asymmetric cluster (8 slots)
  [
    { x: '0%',  y: '5%',  w: '45%', rot: -1,  z: 1 },
    { x: '40%', y: '0%',  w: '28%', rot: 2,   z: 2 },
    { x: '65%', y: '10%', w: '33%', rot: -2,  z: 1 },
    { x: '8%',  y: '40%', w: '30%', rot: 1.5, z: 2 },
    { x: '35%', y: '35%', w: '40%', rot: -0.5,z: 3 },
    { x: '62%', y: '45%', w: '35%', rot: 1,   z: 1 },
    { x: '3%',  y: '70%', w: '35%', rot: -1.5,z: 2 },
    { x: '38%', y: '68%', w: '30%', rot: 2,   z: 3 },
  ],
];

function createCollageHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    background: #0a0a0b;
    overflow: hidden;
  `;

  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const count = Math.min(photos.length, template.length);

  for (let i = 0; i < count; i++) {
    const photo = photos[i];
    const slot = template[i];

    const card = document.createElement('article');
    card.dataset.index = String(i);
    card.style.cssText = `
      position: absolute;
      left: ${slot.x};
      top: ${slot.y};
      width: ${slot.w};
      transform: rotate(${slot.rot}deg);
      z-index: ${slot.z};
      cursor: pointer;
      background: #141416;
      padding: 0.75rem;
      border-radius: 2px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    `;

    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      display: block;
    `;
    loadPhoto(img, photo, 600);

    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 0.5rem;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #8a8680;
    `;
    caption.textContent = photo.title || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #5a5650;
      margin-top: 0.25rem;
    `;
    exif.textContent = formatExif(photo);

    card.append(img, caption, exif);
    root.appendChild(card);
  }
}

export default function createCollage(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  const root = document.createElement('div');
  root.id = 'mode-root';
  canvas.appendChild(root);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createCollageHTML(root, photos);

  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, tiltShiftSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  const mode: ModeImpl = {
    paint(_dt: number) {
      if (!tracker.hasFirstPaint()) return;
      const tex = tracker.getTexture('mode-root');
      if (!tex) return;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
      gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(uniform(gl, program, 'u_focusY'), 0.5);
      gl.uniform1f(uniform(gl, program, 'u_blurStrength'), 18.0);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);

      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const card = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (card) openDetail(parseInt(card.dataset.index!, 10));
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Verify**

Run dev server, switch to Collage mode. Photos arranged in editorial layout, tilt-shift blur creates miniature effect.

- [ ] **Step 4: Commit**

```bash
git add src/modes/collage/
git commit -m "feat: add Collage mode — editorial layout with tilt-shift shader"
```

---

### Task 17: Cinematic Slideshow Mode

**Files:**
- Create: `src/modes/slideshow/slideshow.ts`
- Create: `src/modes/slideshow/film-burn.frag`
- Create: `src/modes/slideshow/rack-focus.frag`
- Create: `src/modes/slideshow/luminance-dissolve.frag`

- [ ] **Step 1: Create the three transition shaders**

`src/modes/slideshow/film-burn.frag`:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;   // 0..1
uniform vec2 u_resolution;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec3 fromColor = srgbToLinear(texture(u_from, v_uv).rgb);
  vec3 toColor = srgbToLinear(texture(u_to, v_uv).rgb);

  // Film burn: bright areas burn first, eating in from edges
  float luma = dot(fromColor, vec3(0.2126, 0.7152, 0.0722));
  float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));
  float noise = hash21(v_uv * u_resolution * 0.1) * 0.15;

  float burnThreshold = u_progress * 1.8 - 0.4;
  float burn = smoothstep(burnThreshold - 0.15, burnThreshold + 0.05,
                          luma * 0.5 + (1.0 - edgeDist) * 0.5 + noise);

  // Hot white edge at burn front
  float burnEdge = smoothstep(burnThreshold - 0.02, burnThreshold, luma * 0.5 + (1.0 - edgeDist) * 0.5 + noise)
                 - burn;
  vec3 hot = vec3(1.0, 0.95, 0.8) * burnEdge * 2.0;

  vec3 result = mix(fromColor + hot, toColor, burn);
  frag_color = vec4(linearToSrgb(result), 1.0);
}
```

`src/modes/slideshow/rack-focus.frag`:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec4 discBlur(sampler2D tex, vec2 uv, float radius, vec2 texelSize) {
  if (radius < 0.001) return texture(tex, uv);
  const vec2 offsets[13] = vec2[13](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
    vec2(0.0, 2.0), vec2(0.0, -2.0), vec2(2.0, 0.0), vec2(-2.0, 0.0)
  );
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 offset = offsets[i] * radius * texelSize;
    float w = 1.0 - length(offsets[i]) / 2.83;
    sum += texture(tex, uv + offset) * w;
    total += w;
  }
  return sum / total;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Outgoing blurs out, incoming sharpens in
  float fromBlur = smoothstep(0.0, 0.6, u_progress) * 20.0;
  float toBlur = smoothstep(1.0, 0.4, u_progress) * 20.0;

  vec4 fromColor = discBlur(u_from, v_uv, fromBlur, texelSize);
  vec4 toColor = discBlur(u_to, v_uv, toBlur, texelSize);

  vec3 fromLinear = srgbToLinear(fromColor.rgb);
  vec3 toLinear = srgbToLinear(toColor.rgb);

  // Crossfade with smooth S-curve
  float t = smoothstep(0.3, 0.7, u_progress);
  vec3 result = mix(fromLinear, toLinear, t);

  frag_color = vec4(linearToSrgb(result), 1.0);
}
```

`src/modes/slideshow/luminance-dissolve.frag`:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 fromColor = srgbToLinear(texture(u_from, v_uv).rgb);
  vec3 toColor = srgbToLinear(texture(u_to, v_uv).rgb);

  // Luminance of outgoing frame
  float luma = dot(fromColor, vec3(0.2126, 0.7152, 0.0722));

  // Highlights dissolve first, shadows last
  float threshold = u_progress * 1.4 - 0.2;
  float t = smoothstep(threshold - 0.15, threshold + 0.15, luma);

  // Slight glow at dissolve edge
  float edge = smoothstep(threshold - 0.02, threshold, luma)
             - smoothstep(threshold, threshold + 0.02, luma);
  vec3 glow = vec3(1.0, 0.98, 0.95) * edge * 0.3;

  vec3 result = mix(fromColor + glow, toColor, t);
  frag_color = vec4(linearToSrgb(result), 1.0);
}
```

- [ ] **Step 2: Create src/modes/slideshow/slideshow.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO, createElementTexture } from '../../lib/gl';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import filmBurnSrc from './film-burn.frag?raw';
import rackFocusSrc from './rack-focus.frag?raw';
import lumDissolveSrc from './luminance-dissolve.frag?raw';

const TRANSITION_DURATION = 1200; // ms

function createSlideHTML(container: HTMLElement, photo: Photo): void {
  container.innerHTML = '';
  container.style.cssText = `
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #0a0a0b; padding: 2rem;
  `;

  const img = document.createElement('img');
  img.style.cssText = `
    max-width: 90%; max-height: 75%;
    object-fit: contain;
  `;
  loadPhoto(img, photo, 1600);

  const info = document.createElement('div');
  info.style.cssText = `
    margin-top: 1.5rem; text-align: center;
  `;

  const title = document.createElement('h3');
  title.style.cssText = `
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.2rem; color: #e8e4df; margin-bottom: 0.35rem;
  `;
  title.textContent = photo.title || '';

  const desc = document.createElement('p');
  desc.style.cssText = `font-size: 0.85rem; color: #8a8680; margin-bottom: 0.35rem;`;
  desc.textContent = photo.description || '';

  const exif = document.createElement('div');
  exif.className = 'exif-container';
  exif.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem; color: #5a5650;
  `;
  exif.textContent = formatExif(photo);

  info.append(title, desc, exif);
  container.append(img, info);
}

export default function createSlideshow(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  // Two slide containers as direct canvas children
  const slideA = document.createElement('div');
  slideA.id = 'slide-a';
  const slideB = document.createElement('div');
  slideB.id = 'slide-b';
  canvas.append(slideA, slideB);

  // Textures
  const texA = createElementTexture(gl);
  const texB = createElementTexture(gl);

  // Paint tracking (manual, since we have two textures)
  const onPaint = ((e: PaintEvent) => {
    for (const el of e.changedElements) {
      const target = el as HTMLElement;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (target === slideA || target.id === 'slide-a') {
        gl.bindTexture(gl.TEXTURE_2D, texA);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, slideA);
      }
      if (target === slideB || target.id === 'slide-b') {
        gl.bindTexture(gl.TEXTURE_2D, texB);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, slideB);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  // Transition shaders (randomly selected)
  const shaders = [
    getCachedProgram(gl, vertexSrc, filmBurnSrc),
    getCachedProgram(gl, vertexSrc, rackFocusSrc),
    getCachedProgram(gl, vertexSrc, lumDissolveSrc),
  ];

  const quad = createQuadVAO(gl);
  let currentIndex = 0;
  let transitioning = false;
  let transitionStart = 0;
  let transitionProgram: WebGLProgram = shaders[0];
  // Which slide is "current": true = A, false = B
  let currentIsA = true;

  // Show first photo
  createSlideHTML(slideA, photos[0]);
  canvas.requestPaint?.();

  function startTransition(newIndex: number): void {
    if (transitioning || newIndex < 0 || newIndex >= photos.length) return;
    currentIndex = newIndex;

    // Load new slide into the non-current container
    const target = currentIsA ? slideB : slideA;
    createSlideHTML(target, photos[currentIndex]);
    canvas.requestPaint?.();

    // Pick random transition
    transitionProgram = shaders[Math.floor(Math.random() * shaders.length)];
    transitioning = true;
    transitionStart = performance.now();
    setAnimating(true);
  }

  const mode: ModeImpl = {
    paint(dt: number) {
      const now = performance.now();

      if (transitioning) {
        let progress = Math.min((now - transitionStart) / TRANSITION_DURATION, 1.0);

        const fromTex = currentIsA ? texA : texB;
        const toTex = currentIsA ? texB : texA;

        gl.useProgram(transitionProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fromTex);
        gl.uniform1i(uniform(gl, transitionProgram, 'u_from'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, toTex);
        gl.uniform1i(uniform(gl, transitionProgram, 'u_to'), 1);
        gl.uniform1f(uniform(gl, transitionProgram, 'u_progress'), progress);
        gl.uniform2f(uniform(gl, transitionProgram, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, transitionProgram, 'u_dst'), -1, -1, 2, 2);

        quad.draw();

        if (progress >= 1.0) {
          transitioning = false;
          currentIsA = !currentIsA;
          setAnimating(false);
        }
      } else {
        // Static: draw current slide with passthrough
        const tex = currentIsA ? texA : texB;
        // Use rack-focus shader with progress=0 as passthrough (no blur)
        const prog = shaders[1]; // rack-focus at progress 0 = sharp from
        gl.useProgram(prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(uniform(gl, prog, 'u_from'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tex); // same texture for both
        gl.uniform1i(uniform(gl, prog, 'u_to'), 1);
        gl.uniform1f(uniform(gl, prog, 'u_progress'), 0.0);
        gl.uniform2f(uniform(gl, prog, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, prog, 'u_dst'), -1, -1, 2, 2);
        quad.draw();
      }
    },

    isAnimating() { return transitioning; },

    onPointer(ev: PointerEvent) {
      if (ev.type !== 'pointerdown' || transitioning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      if (x < 0.3) startTransition(currentIndex - 1);
      else if (x > 0.7) startTransition(currentIndex + 1);
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      gl.deleteTexture(texA);
      gl.deleteTexture(texB);
      quad.dispose();
      slideA.remove();
      slideB.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modes/slideshow/
git commit -m "feat: add Cinematic Slideshow mode — three GLSL transition shaders"
```

---

### Task 18: Album Mode

**Files:**
- Create: `src/modes/album/album.ts`
- Create: `src/modes/album/page-curl.frag`

The Album uses a tessellated quad mesh for vertex displacement during page turns. Pages are rendered as textures with paper texture overlay and spine shadow.

- [ ] **Step 1: Create src/modes/album/page-curl.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;      // page content (HTML texture)
uniform float u_curlProgress; // 0 = flat, 1 = fully turned
uniform float u_isBack;       // 1.0 if drawing back side
uniform vec2 u_resolution;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;

  // Back of page: mirror horizontally
  if (u_isBack > 0.5) {
    uv.x = 1.0 - uv.x;
  }

  vec3 color = srgbToLinear(texture(u_tex, uv).rgb);

  // Paper texture: subtle fiber noise
  float paperNoise = hash21(v_uv * u_resolution * 0.5) * 0.03;
  color += paperNoise;

  // Spine shadow: darken near left edge (the binding)
  float spineShadow = smoothstep(0.0, 0.12, uv.x);
  color *= mix(0.7, 1.0, spineShadow);

  // Page edge shadow during curl
  float curlShadow = 1.0 - u_curlProgress * 0.2 * (1.0 - uv.x);
  color *= curlShadow;

  // Slight warm tint for paper feel
  color *= vec3(1.0, 0.995, 0.985);

  frag_color = vec4(linearToSrgb(color), 1.0);
}
```

- [ ] **Step 2: Create src/modes/album/album.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createTessellatedQuad, createElementTexture } from '../../lib/gl';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import pageCurlSrc from './page-curl.frag?raw';

const TURN_DURATION = 800; // ms

function createPageHTML(container: HTMLElement, photo: Photo | null, isCover: boolean): void {
  container.innerHTML = '';
  container.style.cssText = `
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: #141416; padding: 2rem;
  `;

  if (isCover) {
    container.innerHTML = `
      <div style="text-align:center;">
        <h1 style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:2.5rem;color:#e8e4df;margin-bottom:0.75rem;">
          Photography Portfolio
        </h1>
        <p style="font-family:Inter,system-ui,sans-serif;font-size:0.9rem;color:#5a5650;">
          Turn the page to begin →
        </p>
      </div>
    `;
    return;
  }

  if (!photo) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex; gap: 2rem; align-items: center;
    width: 100%; height: 100%; max-width: 900px;
  `;

  // Left: photo
  const imgWrap = document.createElement('div');
  imgWrap.style.cssText = `flex: 1; display: flex; align-items: center; justify-content: center;`;
  const img = document.createElement('img');
  img.style.cssText = `max-width: 100%; max-height: 70vh; object-fit: contain;`;
  loadPhoto(img, photo, 800);
  imgWrap.appendChild(img);

  // Right: caption + exif
  const info = document.createElement('div');
  info.style.cssText = `flex: 0 0 220px;`;

  const title = document.createElement('h3');
  title.style.cssText = `
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.3rem; color: #e8e4df; margin-bottom: 0.5rem;
  `;
  title.textContent = photo.title || '';

  const desc = document.createElement('p');
  desc.style.cssText = `font-size: 0.85rem; color: #8a8680; line-height: 1.6; margin-bottom: 1rem;`;
  desc.textContent = photo.description || '';

  const exif = document.createElement('div');
  exif.className = 'exif-container';
  exif.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem; color: #5a5650; line-height: 1.8;
  `;
  const e = photo.exif;
  exif.innerHTML = [e.focalLength, e.aperture, e.shutterSpeed, e.iso]
    .filter(Boolean)
    .map(s => `<div>${s}</div>`)
    .join('');

  info.append(title, desc, exif);
  wrapper.append(imgWrap, info);
  container.appendChild(wrapper);
}

export default function createAlbum(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  // Pages: cover + one page per photo
  const pages = [null, ...photos]; // null = cover
  let currentPage = 0;

  // Two page containers (current left/right visible spread)
  const pageEl = document.createElement('div');
  pageEl.id = 'album-page';
  canvas.appendChild(pageEl);

  const nextPageEl = document.createElement('div');
  nextPageEl.id = 'album-next';
  nextPageEl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
  canvas.appendChild(nextPageEl);

  // Textures
  const texCurrent = createElementTexture(gl);
  const texNext = createElementTexture(gl);

  const onPaint = ((e: PaintEvent) => {
    for (const el of e.changedElements) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (el === pageEl) {
        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pageEl);
      }
      if (el === nextPageEl) {
        gl.bindTexture(gl.TEXTURE_2D, texNext);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextPageEl);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, pageCurlSrc);
  const mesh = createTessellatedQuad(gl, 40, 30);

  // Show cover
  createPageHTML(pageEl, null, true);
  canvas.requestPaint?.();

  // Turning state
  let turning = false;
  let turnStart = 0;
  let turnDirection = 1; // 1 = forward, -1 = backward

  function turnPage(direction: number): void {
    const nextIdx = currentPage + direction;
    if (nextIdx < 0 || nextIdx >= pages.length || turning) return;

    const photo = pages[nextIdx];
    createPageHTML(nextPageEl, photo, nextIdx === 0);
    canvas.requestPaint?.();

    turning = true;
    turnStart = performance.now();
    turnDirection = direction;
    setAnimating(true);
  }

  // Page number display
  const pageNum = document.createElement('div');
  pageNum.style.cssText = `
    position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%);
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #5a5650;
    pointer-events: none;
  `;
  pageNum.textContent = `1 / ${pages.length}`;
  // Page number is outside canvas (regular DOM), appended to main
  canvas.parentElement?.appendChild(pageNum);

  const mode: ModeImpl = {
    paint(_dt: number) {
      const now = performance.now();
      let curlProgress = 0;

      if (turning) {
        curlProgress = Math.min((now - turnStart) / TURN_DURATION, 1.0);
        const easedProgress = 1.0 - Math.pow(1.0 - curlProgress, 3); // ease-out cubic

        // Draw the page beneath (next page, flat)
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texNext);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();

        // Draw the curling page on top
        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), easedProgress);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        mesh.draw();

        if (curlProgress >= 1.0) {
          turning = false;
          currentPage += turnDirection;
          createPageHTML(pageEl, pages[currentPage], currentPage === 0);
          canvas.requestPaint?.();
          setAnimating(false);
          pageNum.textContent = `${currentPage + 1} / ${pages.length}`;
        }
      } else {
        // Static: draw current page flat
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();
      }
    },

    isAnimating() { return turning; },

    onPointer(ev: PointerEvent) {
      if (ev.type !== 'pointerdown' || turning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      if (x > 0.65) turnPage(1);
      else if (x < 0.35) turnPage(-1);
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      gl.deleteTexture(texCurrent);
      gl.deleteTexture(texNext);
      mesh.dispose();
      pageEl.remove();
      nextPageEl.remove();
      pageNum.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modes/album/
git commit -m "feat: add Album mode — page-curl shader with paper texture and spine shadow"
```

---

### Task 19: Film Strip Mode

**Files:**
- Create: `src/modes/film-strip/film-strip.ts`
- Create: `src/modes/film-strip/curvature.frag`

- [ ] **Step 1: Create src/modes/film-strip/curvature.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform float u_curvature;   // curvature strength (default ~0.15)
uniform float u_scrollOffset; // normalized scroll position

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Center of viewport in UV space
  vec2 center = v_uv - 0.5;

  // Curvature: y-displacement based on x-distance from center
  // Creates a film-bowing-under-gravity effect
  float xDist = center.x * 2.0; // -1..1
  float curve = xDist * xDist * u_curvature;

  // Also slight x-compression at edges (perspective)
  float xScale = 1.0 - abs(xDist) * 0.03;

  vec2 curved_uv = vec2(
    0.5 + center.x * xScale,
    v_uv.y + curve
  );

  // Out of bounds check
  if (curved_uv.x < 0.0 || curved_uv.x > 1.0 || curved_uv.y < 0.0 || curved_uv.y > 1.0) {
    frag_color = vec4(0.04, 0.04, 0.043, 1.0);
    return;
  }

  vec3 color = srgbToLinear(texture(u_tex, curved_uv).rgb);

  // Edge darkening: simulate depth — edges are further from viewer
  float edgeDark = 1.0 - abs(xDist) * 0.25;
  color *= edgeDark;

  // Light table glow: subtle brightness at center
  float centerGlow = 1.0 + (1.0 - xDist * xDist) * 0.1;
  color *= centerGlow;

  frag_color = vec4(linearToSrgb(color), 1.0);
}
```

- [ ] **Step 2: Create src/modes/film-strip/film-strip.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import curvatureSrc from './curvature.frag?raw';

const FRAME_WIDTH = 280;
const SPROCKET_SIZE = 12;

function createStripHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    display: flex;
    align-items: center;
    height: 100%;
    padding: 2rem 4rem;
    background: #0a0a0b;
    gap: 0;
    white-space: nowrap;
  `;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    const frame = document.createElement('div');
    frame.dataset.index = String(i);
    frame.style.cssText = `
      flex: 0 0 ${FRAME_WIDTH}px;
      background: #181818;
      border-left: 2px solid #222;
      border-right: 2px solid #222;
      padding: 2rem 0.75rem;
      position: relative;
      cursor: pointer;
    `;

    // Sprocket holes (top and bottom)
    for (const pos of ['top', 'bottom'] as const) {
      const sprockets = document.createElement('div');
      sprockets.style.cssText = `
        position: absolute;
        ${pos}: 6px;
        left: 0; right: 0;
        display: flex;
        justify-content: space-evenly;
        padding: 0 1rem;
      `;
      for (let s = 0; s < 4; s++) {
        const hole = document.createElement('div');
        hole.style.cssText = `
          width: ${SPROCKET_SIZE}px;
          height: ${SPROCKET_SIZE}px;
          border-radius: 2px;
          background: #0a0a0b;
          border: 1px solid #333;
        `;
        sprockets.appendChild(hole);
      }
      frame.appendChild(sprockets);
    }

    // Frame number
    const frameNum = document.createElement('div');
    frameNum.style.cssText = `
      position: absolute;
      top: 22px; right: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: #444;
    `;
    frameNum.textContent = `${i + 1}A`;
    frame.appendChild(frameNum);

    // Photo
    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      display: block;
    `;
    loadPhoto(img, photo, 400);
    frame.appendChild(img);

    // Caption below photo
    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 0.5rem;
      font-family: Inter, system-ui, sans-serif;
      font-size: 10px;
      color: #666;
      white-space: normal;
    `;
    caption.textContent = photo.title || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; color: #5a5650;
    `;
    exif.textContent = formatExif(photo);

    frame.append(caption, exif);
    root.appendChild(frame);
  }
}

export default function createFilmStrip(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow-x: auto; overflow-y: hidden;';
  canvas.appendChild(root);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createStripHTML(root, photos);

  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, curvatureSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  // Track scroll for curvature offset
  let scrollOffset = 0;
  root.addEventListener('scroll', () => {
    scrollOffset = root.scrollLeft / (root.scrollWidth - root.clientWidth);
    canvas.requestPaint?.();
    requestDraw();
  });

  const mode: ModeImpl = {
    paint(_dt: number) {
      if (!tracker.hasFirstPaint()) return;
      const tex = tracker.getTexture('mode-root');
      if (!tex) return;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
      gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(uniform(gl, program, 'u_curvature'), 0.12);
      gl.uniform1f(uniform(gl, program, 'u_scrollOffset'), scrollOffset);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);

      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const frame = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (frame) openDetail(parseInt(frame.dataset.index!, 10));
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modes/film-strip/
git commit -m "feat: add Film Strip mode — horizontal strip with curvature shader"
```

---

### Task 20: Wall Exhibition Mode

**Files:**
- Create: `src/modes/wall-exhibition/wall-exhibition.ts`
- Create: `src/modes/wall-exhibition/gallery-lighting.frag`

- [ ] **Step 1: Create src/modes/wall-exhibition/gallery-lighting.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform float u_scrollY;      // normalized scroll position 0..1

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec3 htmlColor = srgbToLinear(texture(u_tex, v_uv).rgb);

  // Procedural wall texture (dark plaster)
  float wallNoise1 = hash21(v_uv * u_resolution * 0.3) * 0.02;
  float wallNoise2 = hash21(v_uv * u_resolution * 0.05 + 100.0) * 0.03;
  vec3 wallColor = vec3(0.045, 0.043, 0.05) + wallNoise1 + wallNoise2;

  // Detect if this pixel is "wall" (very dark in the HTML) or "content"
  float htmlLuma = dot(htmlColor, vec3(0.2126, 0.7152, 0.0722));
  float isContent = smoothstep(0.02, 0.06, htmlLuma);

  // Composite: wall where HTML is dark/empty, HTML content where it's not
  vec3 composited = mix(wallColor, htmlColor, isContent);

  // Gallery lighting: overhead spots
  // Lights positioned at regular intervals along Y
  float lightSpacing = 0.25;
  float nearestLight = round(v_uv.y / lightSpacing) * lightSpacing;
  float lightDist = abs(v_uv.y - nearestLight);

  // Horizontal center bias for lights
  float hCenter = 1.0 - abs(v_uv.x - 0.5) * 0.6;

  // Inverse-square-ish falloff from overhead
  float lighting = hCenter * (1.0 / (1.0 + lightDist * lightDist * 40.0));

  // Base ambient so nothing is pure black
  float ambient = 0.25;
  float totalLight = ambient + lighting * 0.85;

  composited *= totalLight;

  // Subtle warm gallery tone
  composited *= vec3(1.0, 0.98, 0.96);

  frag_color = vec4(linearToSrgb(composited), 1.0);
}
```

- [ ] **Step 2: Create src/modes/wall-exhibition/wall-exhibition.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import lightingSrc from './gallery-lighting.frag?raw';

function createWallHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    width: 100%;
    padding: 4rem 0;
    background: #0a0a0b;
  `;

  let i = 0;
  while (i < photos.length) {
    // Alternating: hero photo, then companion cluster
    if (i % 3 === 0) {
      // Hero
      const photo = photos[i];
      const section = document.createElement('section');
      section.style.cssText = `
        display: flex; flex-direction: column; align-items: center;
        margin: 4rem auto; max-width: 700px; padding: 0 2rem;
      `;
      section.dataset.index = String(i);

      const img = document.createElement('img');
      img.style.cssText = `
        width: 100%; object-fit: contain; cursor: pointer;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      `;
      loadPhoto(img, photo, 800);

      const plaque = document.createElement('div');
      plaque.style.cssText = `
        margin-top: 1.25rem; text-align: center;
        padding: 0.75rem 1.5rem;
        border: 1px solid rgba(255,255,255,0.04);
        background: rgba(20,20,22,0.5);
      `;
      plaque.innerHTML = `
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:1rem;color:#e8e4df;">${photo.title || ''}</div>
        <div style="font-size:0.8rem;color:#8a8680;margin-top:0.25rem;">${photo.description || ''}</div>
        <div class="exif-container" style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#5a5650;margin-top:0.35rem;">${formatExif(photo)}</div>
      `;

      section.append(img, plaque);
      root.appendChild(section);
      i++;
    } else {
      // Companion cluster: 2 smaller photos side by side
      const cluster = document.createElement('div');
      cluster.style.cssText = `
        display: flex; gap: 2rem; justify-content: center;
        margin: 3rem auto; max-width: 800px; padding: 0 2rem;
      `;

      for (let j = 0; j < 2 && i < photos.length; j++, i++) {
        const photo = photos[i];
        const card = document.createElement('div');
        card.dataset.index = String(i);
        card.style.cssText = `flex: 1; max-width: 360px; cursor: pointer;`;

        const img = document.createElement('img');
        img.style.cssText = `
          width: 100%; object-fit: contain;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        `;
        loadPhoto(img, photo, 600);

        const plaque = document.createElement('div');
        plaque.style.cssText = `
          margin-top: 0.75rem; text-align: center;
        `;
        plaque.innerHTML = `
          <div style="font-family:Inter,system-ui,sans-serif;font-size:0.85rem;color:#8a8680;">${photo.title || ''}</div>
          <div class="exif-container" style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:#5a5650;margin-top:0.2rem;">${formatExif(photo)}</div>
        `;

        card.append(img, plaque);
        cluster.appendChild(card);
      }

      root.appendChild(cluster);
    }
  }
}

export default function createWallExhibition(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden;';
  canvas.appendChild(root);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createWallHTML(root, photos);

  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, lightingSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  let scrollY = 0;
  root.addEventListener('scroll', () => {
    scrollY = root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight);
    canvas.requestPaint?.();
    requestDraw();
  });

  const mode: ModeImpl = {
    paint(_dt: number) {
      if (!tracker.hasFirstPaint()) return;
      const tex = tracker.getTexture('mode-root');
      if (!tex) return;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
      gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(uniform(gl, program, 'u_scrollY'), scrollY);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);

      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const card = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (card) openDetail(parseInt(card.dataset.index!, 10));
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modes/wall-exhibition/
git commit -m "feat: add Wall Exhibition mode — gallery lighting and wall texture compositing"
```

---

### Task 21: Stacked Prints Mode

**Files:**
- Create: `src/modes/stacked-prints/stacked-prints.ts`
- Create: `src/modes/stacked-prints/paper-warp.frag`

- [ ] **Step 1: Create src/modes/stacked-prints/paper-warp.frag**

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_grabPoint;    // normalized grab position (0..1)
uniform float u_liftAmount;  // 0 = flat, 1 = fully lifted
uniform float u_isBack;      // 1.0 if drawing back side (EXIF)

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;

  // Paper warp: lift and curl from grab point
  float dist = distance(uv, u_grabPoint);
  float warp = sin(dist * 3.14159) * u_liftAmount * 0.08;

  // Directional warp: UV displacement radiates from grab point
  vec2 dir = normalize(uv - u_grabPoint + 0.001);
  uv += dir * warp;

  if (u_isBack > 0.5) {
    uv.x = 1.0 - uv.x; // Mirror for back side
  }

  // Clamp
  uv = clamp(uv, 0.0, 1.0);

  vec3 color = srgbToLinear(texture(u_tex, uv).rgb);

  // Paper texture
  float paper = hash21(v_uv * u_resolution * 0.4) * 0.025;
  color += paper;

  // Shadow from lift: darker at base, lighter when lifted
  float shadow = 1.0 - u_liftAmount * 0.15 * (1.0 - dist);
  color *= shadow;

  // Slight paper warmth
  color *= vec3(1.0, 0.995, 0.985);

  frag_color = vec4(linearToSrgb(color), 1.0);
}
```

- [ ] **Step 2: Create src/modes/stacked-prints/stacked-prints.ts**

```ts
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createTessellatedQuad, createElementTexture } from '../../lib/gl';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import paperWarpSrc from './paper-warp.frag?raw';

function createPrintFrontHTML(el: HTMLElement, photo: Photo): void {
  el.innerHTML = '';
  el.style.cssText = `
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #141416; padding: 3rem;
  `;

  const img = document.createElement('img');
  img.style.cssText = `max-width: 80%; max-height: 65vh; object-fit: contain; box-shadow: 0 4px 30px rgba(0,0,0,0.4);`;
  loadPhoto(img, photo, 1200);

  const caption = document.createElement('div');
  caption.style.cssText = `margin-top: 1.5rem; text-align: center;`;
  caption.innerHTML = `
    <h3 style="font-family:'Playfair Display',Georgia,serif;font-size:1.3rem;color:#e8e4df;">${photo.title || ''}</h3>
    <p style="font-size:0.85rem;color:#8a8680;margin-top:0.35rem;">${photo.description || ''}</p>
    <div class="exif-container" style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#5a5650;margin-top:0.5rem;">
      ${formatExif(photo)}
    </div>
  `;

  el.append(img, caption);
}

function createPrintBackHTML(el: HTMLElement, photo: Photo): void {
  el.innerHTML = '';
  el.style.cssText = `
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: #1a1a1c; padding: 3rem;
  `;

  const info = document.createElement('div');
  info.style.cssText = `text-align: center; max-width: 400px;`;
  info.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#5a5650;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.5rem;">Technical Details</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:#8a8680;line-height:2.2;">
      ${photo.exif.focalLength ? `<div>${photo.exif.focalLength}</div>` : ''}
      ${photo.exif.aperture ? `<div>${photo.exif.aperture}</div>` : ''}
      ${photo.exif.shutterSpeed ? `<div>${photo.exif.shutterSpeed}</div>` : ''}
      ${photo.exif.iso ? `<div>${photo.exif.iso}</div>` : ''}
    </div>
    <div style="margin-top:2rem;font-family:Inter,system-ui,sans-serif;font-size:0.85rem;color:#5a5650;">
      ${photo.id}
    </div>
  `;

  el.appendChild(info);
}

export default function createStackedPrints(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  // Front and back elements
  const frontEl = document.createElement('div');
  frontEl.id = 'print-front';
  const backEl = document.createElement('div');
  backEl.id = 'print-back';
  canvas.append(frontEl, backEl);

  const texFront = createElementTexture(gl);
  const texBack = createElementTexture(gl);

  const onPaint = ((e: PaintEvent) => {
    for (const el of e.changedElements) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (el === frontEl) {
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frontEl);
      }
      if (el === backEl) {
        gl.bindTexture(gl.TEXTURE_2D, texBack);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backEl);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, paperWarpSrc);
  const mesh = createTessellatedQuad(gl, 30, 25);

  let currentIndex = 0;
  let grabPoint = { x: 0.5, y: 0.5 };
  let liftAmount = 0;
  let tossing = false;
  let tossStart = 0;
  const TOSS_DURATION = 600;

  function showPrint(index: number): void {
    if (index >= photos.length) return;
    currentIndex = index;
    createPrintFrontHTML(frontEl, photos[index]);
    createPrintBackHTML(backEl, photos[index]);
    canvas.requestPaint?.();
  }

  showPrint(0);

  // Stack counter
  const counter = document.createElement('div');
  counter.style.cssText = `
    position: absolute; bottom: 1.5rem; right: 1.5rem;
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #5a5650;
    pointer-events: none;
  `;
  counter.textContent = `1 / ${photos.length}`;
  canvas.parentElement?.appendChild(counter);

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Stack';
  resetBtn.style.cssText = `
    position: absolute; bottom: 1.5rem; left: 1.5rem;
    font-family: Inter, system-ui, sans-serif; font-size: 0.8rem;
    color: #5a5650; background: none; border: 1px solid rgba(255,255,255,0.06);
    padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;
    transition: color 150ms, border-color 150ms;
  `;
  resetBtn.addEventListener('click', () => {
    currentIndex = 0;
    showPrint(0);
    counter.textContent = `1 / ${photos.length}`;
    liftAmount = 0;
    tossing = false;
    setAnimating(false);
  });
  resetBtn.addEventListener('mouseenter', () => {
    resetBtn.style.color = '#8a8680';
    resetBtn.style.borderColor = 'rgba(255,255,255,0.12)';
  });
  resetBtn.addEventListener('mouseleave', () => {
    resetBtn.style.color = '#5a5650';
    resetBtn.style.borderColor = 'rgba(255,255,255,0.06)';
  });
  canvas.parentElement?.appendChild(resetBtn);

  function toss(): void {
    if (tossing || currentIndex >= photos.length - 1) return;
    tossing = true;
    tossStart = performance.now();
    setAnimating(true);
  }

  const mode: ModeImpl = {
    paint(_dt: number) {
      const now = performance.now();

      if (tossing) {
        const progress = Math.min((now - tossStart) / TOSS_DURATION, 1.0);
        liftAmount = Math.sin(progress * Math.PI) * 1.5; // arc up then down

        // Draw current print with warp
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform2f(uniform(gl, program, 'u_grabPoint'), grabPoint.x, grabPoint.y);
        gl.uniform1f(uniform(gl, program, 'u_liftAmount'), liftAmount);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();

        if (progress >= 1.0) {
          tossing = false;
          liftAmount = 0;
          currentIndex++;
          showPrint(currentIndex);
          counter.textContent = `${currentIndex + 1} / ${photos.length}`;
          setAnimating(false);
        }
      } else {
        // Static: draw flat
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform2f(uniform(gl, program, 'u_grabPoint'), 0.5, 0.5);
        gl.uniform1f(uniform(gl, program, 'u_liftAmount'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();
      }
    },

    isAnimating() { return tossing; },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const rect = canvas.getBoundingClientRect();
        grabPoint.x = (ev.clientX - rect.left) / rect.width;
        grabPoint.y = 1.0 - (ev.clientY - rect.top) / rect.height;
        toss();
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      gl.deleteTexture(texFront);
      gl.deleteTexture(texBack);
      mesh.dispose();
      frontEl.remove();
      backEl.remove();
      counter.remove();
      resetBtn.remove();
    },
  };

  return mode;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modes/stacked-prints/
git commit -m "feat: add Stacked Prints mode — paper warp shader with grab-point deformation"
```

---

## Phase 4: Integration & Polish

### Task 22: Final Integration

**Files:**
- Modify: `src/main.ts` (ensure all modes wire correctly)
- Modify: `src/index.html` (add JSON-LD with photo data)

- [ ] **Step 1: Verify all mode imports in main.ts**

Ensure the dynamic import paths in `modeLoaders` match the actual file exports. Each mode file must have a `default` export:

```ts
// Each mode file should export:
// export default function createModeName(ctx: ModeContext): ModeImpl { ... }
```

Verify each mode file in `src/modes/*/` has this pattern.

- [ ] **Step 2: Add JSON-LD photo data to index.html**

This should be generated at build time. Add a small Vite plugin or a build step that injects photo data into the HTML. For now, the base JSON-LD in `index.html` is sufficient. The `ImageGallery` schema was already added in Task 10.

- [ ] **Step 3: Run full integration test**

Run: `npm run dev`

Open Chrome Canary with the flag enabled. Test:
1. Album loads by default with cover page
2. Switch to each mode via nav — View Transition animates
3. Nav indicator slides to active mode
4. Learn drawer opens/closes, content updates per mode
5. EXIF toggle shows/hides EXIF across all modes
6. About panel opens/closes
7. Photo detail view opens on click, arrows navigate, Escape closes
8. Each mode's shader effect is visible and correct
9. Persisted state (learn drawer, EXIF toggle) survives reload

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete integration — all 7 modes, UI chrome, and state management"
```

---

### Task 23: Visual Polish Pass

**Files:**
- Modify: various CSS and TS files as needed

- [ ] **Step 1: Verify all animations from spec section 11.4**

Walk through each animation specified in the design:

- [ ] Nav mode labels: color transition on hover (150ms) ✓ (in nav.css)
- [ ] Nav indicator: slides between modes (300ms) ✓ (in nav.css)
- [ ] Mode switching: View Transition cross-fade ✓ (in main.ts)
- [ ] Learn drawer: slide in/out (300ms) ✓ (in learn.css)
- [ ] Learn content: fade on mode switch ✓ (in learn.ts)
- [ ] About panel: fade + scale-up ✓ (in about.css)
- [ ] Detail view: scale/translate open, cross-fade navigate ✓ (in detail.css)
- [ ] EXIF toggle: fade + vertical slide ✓ (in theme.css)
- [ ] Photo loading: LQIP → real crossfade ✓ (in theme.css)
- [ ] Hover states: brightness lift on nav/controls ✓ (in nav.css)

- [ ] **Step 2: Test timing and easing feel**

Open each mode and interact. Verify transitions feel "deliberate and unhurried" per spec — smooth deceleration, no bouncing, no overshoot. Adjust durations if anything feels too fast or too slow.

- [ ] **Step 3: Commit any adjustments**

```bash
git add -A
git commit -m "polish: refine animation timing and transitions"
```

---

## Verification Checklist

After all tasks are complete, verify against the spec:

- [ ] 7 viewing modes, each with distinct HiC technique
- [ ] Album loads by default, cover page first
- [ ] Random photo order on each visit
- [ ] View Transitions between modes
- [ ] Learn drawer with per-mode content, persisted state
- [ ] EXIF toggle, persisted state
- [ ] About panel
- [ ] Photo detail view with arrow navigation
- [ ] Semantic HTML for SEO (figure, figcaption, alt text)
- [ ] JSON-LD structured data
- [ ] Feature detection gate for non-Canary browsers
- [ ] Responsive images (thumb/med/full WebP)
- [ ] LQIP placeholders
- [ ] Dark/cinematic visual theme with warm neutrals
- [ ] Playfair Display / Inter / JetBrains Mono fonts
- [ ] No runtime third-party dependencies
- [ ] Code-split mode loading
