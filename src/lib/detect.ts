/**
 * Feature detection for the HTML-in-Canvas API.
 *
 * We check prototypes rather than calling methods because HiC methods fail
 * synchronously when called outside their expected context (e.g., outside
 * a `paint` event). A direct call test would always return false even when
 * the API is fully available. Checking the prototype tells us the method
 * exists without triggering it.
 *
 * Three APIs must ALL exist for HiC to work:
 *   1. HTMLCanvasElement.prototype.requestPaint — triggers the paint event
 *   2. WebGL2RenderingContext.prototype.texElementImage2D — captures DOM to texture
 *   3. CanvasRenderingContext2D.prototype.drawElementImage — captures DOM to 2D canvas
 */
export type HiCSupport = 'supported' | 'missing-api';

export function detectHtmlInCanvas(): HiCSupport {
  // Check #1: requestPaint on canvas — the entry point for the paint cycle
  if (typeof HTMLCanvasElement.prototype.requestPaint !== 'function') {
    return 'missing-api';
  }

  // Check #2: texElementImage2D on WebGL2 — the WebGL texture upload path
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const gl = probe.getContext('webgl2');
  if (!gl || typeof (gl as any).texElementImage2D !== 'function') {
    return 'missing-api';
  }

  // Check #3: drawElementImage on 2D context — the Canvas 2D drawing path
  if (typeof CanvasRenderingContext2D.prototype.drawElementImage !== 'function') {
    return 'missing-api';
  }

  return 'supported';
}
