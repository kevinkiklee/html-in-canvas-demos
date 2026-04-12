export type HiCSupport = 'supported' | 'missing-api';

export function detectHtmlInCanvas(): HiCSupport {
  if (typeof HTMLCanvasElement.prototype.requestPaint !== 'function') {
    return 'missing-api';
  }

  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const gl = probe.getContext('webgl2');
  if (!gl || typeof (gl as any).texElementImage2D !== 'function') {
    return 'missing-api';
  }

  if (typeof CanvasRenderingContext2D.prototype.drawElementImage !== 'function') {
    return 'missing-api';
  }

  return 'supported';
}
