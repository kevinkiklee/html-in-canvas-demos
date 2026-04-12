# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A photography portfolio rendered entirely inside a single `<canvas layoutsubtree>` element using the experimental **HTML-in-Canvas** API. Real DOM elements (text, links, inputs) live inside the canvas, are captured as WebGL2 textures, and drawn with custom GLSL shaders — while preserving full interactivity and accessibility.

The app has 17 distinct viewing modes, each a vanilla TypeScript class that plugs into a shared render shell. Modes range from flat gallery layouts to 3D scenes (Three.js), all applying shader effects (film grain, chromatic aberration, vignette, color grading, etc.) to live HTML content.

**Status:** Pre-implementation. The `docs/html-in-canvas-research.md` is the authoritative reference for API behavior, architecture patterns, and known gotchas.

## Planned Tech Stack

- **Astro** + **Preact** (islands) + vanilla **TypeScript**
- **WebGL2** (single shared context) + **Three.js** (for 3D modes)
- **HTML-in-Canvas API** (Chrome flag `chrome://flags/#canvas-draw-element`)
- **Vite** (via Astro) for bundling, GLSL imports via `?raw` suffix

## Assets

- `assets/photographs/` — source photographs (45 JPGs, ~330 MB total). These are NOT committed to git. Filenames follow `YYYYMMDD-NNNN.jpg` convention.

## Architecture (from research doc)

- **Single canvas root:** One `<canvas layoutsubtree>` owns the WebGL2 context, the `paint` event listener, and the RAF loop. Modes never create their own context or loop.
- **Shell + Mode pattern:** The shell manages the render loop and exposes hooks (`setModeHook`, `setOverlayHook`, `requestDraw`, `setAnimating`). Each mode implements `ModeImpl` (paint, destroy, optional event handlers).
- **PaintTracker:** Manages one WebGL texture per direct canvas child. Uploads happen exclusively inside the `paint` event handler.
- **Dirty-flag RAF loop:** Event-driven, not continuous. Runs only when paint fires, a mode requests a frame, or a mode declares itself animating.

## Critical Rules (HTML-in-Canvas)

These come from observed crashes and silent failures, not preference:

1. **Upload textures in `paint`, draw in RAF.** Calling `texElementImage2D` outside the paint handler crashes the GPU process.
2. **Always linearize sRGB** before shader math (`srgbToLinear` / `linearToSrgb`). Omitting produces incorrect gamma.
3. **Handle DPR explicitly.** Size the backing buffer to `width * dpr` or text is blurry on retina.
4. **Use `UNPACK_FLIP_Y_WEBGL = true`** on upload. HTML origin is top-left, GL is bottom-left.
5. **Feature-detect, don't live-test.** Check API presence on prototypes (`requestPaint`, `texElementImage2D`, `drawElementImage`). A synchronous call test always fails.
6. **All assets must be same-origin or CORS-whitelisted.** Cross-origin content silently becomes transparent with no error.
7. **Avoid `backdrop-filter` and `mix-blend-mode`** on subtree children — ignored or doubled. Implement in shaders instead.
8. **After `texElementImage2D` with Three.js**, call `renderer.state.reset()` to re-sync Three's GL state cache.
9. **Mark undrawn subtrees `inert` or `aria-hidden`** — the accessibility tree doesn't know which children are drawn.

## Key References

- `docs/html-in-canvas-research.md` — Complete API reference, architecture patterns, shader recipes, TypeScript augmentations, CSS behavior, and all known gotchas
- WICG spec: https://github.com/WICG/html-in-canvas
