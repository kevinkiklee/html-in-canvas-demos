# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A photography portfolio rendered entirely inside a single `<canvas layoutsubtree>` element using the experimental **HTML-in-Canvas** (HiC) API. Real DOM elements live inside the canvas, are captured as WebGL2 textures via `texElementImage2D`, and drawn with custom GLSL shaders — while preserving full interactivity and accessibility.

5 viewing modes, each a vanilla TypeScript module that plugs into a shared render shell. The first four modes apply different shader effects to live HTML content: film burn transitions, spotlight, film curvature, gallery lighting. The fifth mode (gallery-walk) uses Three.js to render a first-person 3D museum with HiC textures injected into Three.js materials. A landing page is shown on boot before any mode is selected.

**Status:** Implemented. All 5 modes, UI chrome, tests, and build pipeline complete.

## Tech Stack

- **Vite** + vanilla **TypeScript** (no runtime frameworks)
- **WebGL2** (single shared context)
- **Three.js** (gallery-walk mode only, code-split)
- **HTML-in-Canvas API** (Chrome flag `chrome://flags/#canvas-draw-element`)
- **Sharp** + **exif-reader** (build-time image processing)
- **Vitest** (testing)
- GLSL imports via `?raw` suffix

## Commands

- `npm run dev` — Start Vite dev server (open in Chrome Canary with flag enabled)
- `npm run build` — TypeScript check + Vite production build
- `npm run preview` — Preview production build
- `npm run manifest` — Process photos: extract EXIF, generate responsive WebP, create `src/photos.json`
- `npm test` — Run Vitest (154 tests)
- `npm run test:watch` — Vitest watch mode

## Assets

- `assets/photographs/` — source photographs (45 JPGs, ~330 MB total). NOT committed to git. Filenames: `YYYYMMDD-NNNN.jpg`.
- `public/photographs/{thumb,med,full}/` — generated responsive WebP images (run `npm run manifest`)
- `public/fonts/` — Playfair Display, Inter, JetBrains Mono (WOFF2)

## Architecture

- **Single canvas root:** One `<canvas layoutsubtree>` owns the WebGL2 context, the `paint` event listener, and the RAF loop. Modes never create their own context or loop.
- **Shell + Mode pattern:** `src/shell.ts` manages the render loop and exposes hooks (`setModeHook`, `setOverlayHook`, `requestDraw`, `setAnimating`). Each mode implements `ModeImpl` (paint, destroy, optional event handlers).
- **Two PaintTracker patterns:** Modes with a single root div (print-table, film-strip, wall-exhibition) use `PaintTracker`. Slideshow manages dual textures manually via `safeTexUpload()`.
- **Single paint listener:** Only ONE `paint` event listener exists on the canvas (in the shell). Modes register a callback via `ctx.setModePaint()` instead of adding their own listener. This prevents GPU crashes from the experimental API mishandling multiple concurrent paint handlers.
- **Dirty-flag RAF loop:** Event-driven, not continuous. Runs only when paint fires, a mode requests a frame, or a mode declares itself animating.
- **Code splitting:** Each mode is a dynamic `import()`, loaded only when activated. Shaders ship with their mode chunk.

## Critical Rules (HTML-in-Canvas)

These come from observed crashes and silent failures during implementation, not preference:

1. **Upload textures in `paint`, draw in RAF.** Calling `texElementImage2D` outside the paint handler crashes the GPU process (Chrome Error code: 11). This is the #1 cause of hard crashes.
2. **`#version 300 es` MUST be the first line in every GLSL shader.** No comments, no whitespace before it. Vite's `?raw` import preserves the file verbatim — any leading content before `#version` causes a shader compile error at runtime.
3. **Do NOT use View Transitions API with HiC.** `document.startViewTransition()` captures page snapshots which can trigger `texElementImage2D` outside the paint handler, crashing the GPU process. Use instant switches instead.
4. **Always linearize sRGB** before shader math (`srgbToLinear` / `linearToSrgb`). Omitting produces washed-out highlights and crushed shadows.
5. **Handle DPR explicitly.** Size the backing buffer to `width * dpr` or text is blurry on retina.
6. **Use `UNPACK_FLIP_Y_WEBGL = true`** on upload. HTML origin is top-left, GL is bottom-left.
7. **Feature-detect, don't live-test.** Check API presence on prototypes (`requestPaint`, `texElementImage2D`, `drawElementImage`). A synchronous call test always fails.
8. **All assets must be same-origin or CORS-whitelisted.** Cross-origin content silently becomes transparent with no error.
9. **Avoid `backdrop-filter` and `mix-blend-mode`** on subtree children — ignored or doubled. Implement in shaders instead.
10. **GLSL `common.glsl` is a reference file only.** Vite's `?raw` import has no `#include` mechanism. Each `.frag` file must inline the functions it needs (srgbToLinear, etc.). Keep inlined copies in sync with `common.glsl`.
11. **Modes must clean up fully in destroy().** Clear paint callback (`ctx.setModePaint(null)`), dispose tracker, delete textures, stop animations, remove DOM elements. Stale paint callbacks cause `texElementImage2D` calls on removed elements → GPU crash.
12. **Only ONE paint listener on the canvas.** The shell owns the single `paint` event listener. Modes register a callback via `ctx.setModePaint()` — never call `canvas.addEventListener('paint', ...)` directly. Chrome's experimental HiC API crashes the GPU process (Error code: 11) when multiple paint listeners coexist on the same canvas during mode switches.
13. **Never use `overflow:auto` or `overflow:scroll` on elements passed to `texElementImage2D`.** This crashes the GPU process (Error code: 11). Use a two-layer structure: the root (texture capture target) has `overflow: hidden`, and a nested child div has `overflow-y: auto` for scrolling. The texture still captures the visible scrolled content correctly.

## File Structure

```
src/
  main.ts              — Entry point, feature detection, mode routing
  shell.ts             — Single WebGL2 context, RAF loop, paint handler
  types.ts             — Shared types (Photo, ModeImpl, ModeName, etc.)
  hic.d.ts             — TypeScript augmentations for HiC APIs
  photos.json          — Generated photo manifest (from npm run manifest)
  lib/
    gl.ts              — WebGL2 utilities (shaders, quads, textures)
    detect.ts          — HiC feature detection
    photos.ts          — Photo loading, EXIF formatting, shuffling
    paint-tracker.ts   — Per-element texture management
  nav/nav.ts           — Mode navigation bar
  learn/{content,learn}.ts — Educational panel with per-mode HiC explanations
  about/about.ts       — About overlay
  detail/detail.ts     — Full-screen photo detail view
  modes/
    slideshow/         — 3 GLSL transitions (film burn, rack focus, lum dissolve)
    print-table/       — Cursor-following spotlight
    film-strip/        — Horizontal curvature shader
    wall-exhibition/   — Gallery overhead lighting
    gallery-walk/      — First-person 3D museum (Three.js + HiC textures)
  shaders/
    common.glsl        — Reference: srgbToLinear, linearToSrgb, hash21, etc.
    vertex.glsl        — Shared vertex shader
    passthrough.frag   — No-effect texture draw
  styles/              — CSS for nav, learn, about, detail, theme
scripts/
  build-manifest.ts    — EXIF extraction, responsive WebP generation
```

## Workflow: Documenting HiC Learnings

Whenever you fix a bug related to HTML-in-Canvas, or discover new behavior / gotchas / crashes, **always** update both:

1. **This file (`CLAUDE.md`)** — Add a new numbered entry to the "Critical Rules (HTML-in-Canvas)" section if it's a rule others must follow, or update an existing entry if it refines one.
2. **`docs/html-in-canvas-research.md`** — Add the finding to the appropriate section (Gotchas, API behavior, CSS quirks, etc.) with enough detail that someone unfamiliar can understand and avoid the issue.

This ensures hard-won knowledge about this experimental API is preserved for future sessions and contributors.

## Key References

- `docs/html-in-canvas-research.md` — Complete API reference, architecture patterns, shader recipes, TypeScript augmentations, CSS behavior, and all known gotchas
- `docs/superpowers/specs/2026-04-12-photo-portfolio-design.md` — Full design spec (original 4 modes)
- `docs/superpowers/plans/2026-04-12-photo-portfolio.md` — Implementation plan (23 tasks, original 4 modes)
- `docs/superpowers/specs/2026-04-13-gallery-walk-design.md` — Gallery walk mode design spec
- `docs/superpowers/plans/2026-04-13-gallery-walk.md` — Gallery walk implementation plan (9 tasks)
- WICG spec: https://github.com/WICG/html-in-canvas
