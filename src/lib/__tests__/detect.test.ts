import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectHtmlInCanvas } from '../detect';

// happy-dom provides HTMLCanvasElement but not WebGL2RenderingContext or
// CanvasRenderingContext2D as named globals. We manipulate prototypes and
// getContext() directly.

// Patch canvas.getContext to return a fake webgl2 context with texElementImage2D
function patchGetContext(hasTexElementImage2D: boolean) {
  const fakeGL = hasTexElementImage2D
    ? { texElementImage2D: vi.fn() }
    : {};
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
    if (contextId === 'webgl2') return fakeGL as any;
    return (original as any).call(this, contextId, ...args);
  } as any;
  return { restore: () => { HTMLCanvasElement.prototype.getContext = original; } };
}

afterEach(() => {
  // Remove any stubs on HTMLCanvasElement.prototype
  delete (HTMLCanvasElement.prototype as any).requestPaint;
  // drawElementImage — only exists on 2D context, accessed via CanvasRenderingContext2D
  // which is not a global in happy-dom; we patch it through a 2D context instance
  // (see tests below).
});

describe('detectHtmlInCanvas', () => {
  it('returns "missing-api" with no stubs (baseline: APIs absent)', () => {
    expect(detectHtmlInCanvas()).toBe('missing-api');
  });

  it('returns "missing-api" when only requestPaint is present (texElementImage2D missing)', () => {
    (HTMLCanvasElement.prototype as any).requestPaint = vi.fn();
    const patch = patchGetContext(false); // no texElementImage2D on gl
    try {
      expect(detectHtmlInCanvas()).toBe('missing-api');
    } finally {
      patch.restore();
    }
  });

  it('returns "missing-api" when requestPaint is absent (first guard)', () => {
    delete (HTMLCanvasElement.prototype as any).requestPaint;
    expect(detectHtmlInCanvas()).toBe('missing-api');
  });

  it('returns "missing-api" when requestPaint + texElementImage2D present but drawElementImage absent', () => {
    (HTMLCanvasElement.prototype as any).requestPaint = vi.fn();
    const patch = patchGetContext(true);
    // CanvasRenderingContext2D exists as a global but drawElementImage is NOT on prototype
    (globalThis as any).CanvasRenderingContext2D = { prototype: {} };
    try {
      expect(detectHtmlInCanvas()).toBe('missing-api');
    } finally {
      patch.restore();
      delete (globalThis as any).CanvasRenderingContext2D;
    }
  });

  it('returns "supported" when all three APIs are present', () => {
    (HTMLCanvasElement.prototype as any).requestPaint = vi.fn();
    const patch = patchGetContext(true);

    // drawElementImage lives on CanvasRenderingContext2D.prototype.
    // happy-dom doesn't expose CanvasRenderingContext2D as a global, but
    // detect.ts checks it via the named global — so we must define it on
    // globalThis temporarily.
    const fakeCtx2dProto = { drawElementImage: vi.fn() };
    (globalThis as any).CanvasRenderingContext2D = { prototype: fakeCtx2dProto };

    try {
      expect(detectHtmlInCanvas()).toBe('supported');
    } finally {
      patch.restore();
      delete (globalThis as any).CanvasRenderingContext2D;
    }
  });

  it('returns "missing-api" when CanvasRenderingContext2D.prototype.drawElementImage is absent', () => {
    (HTMLCanvasElement.prototype as any).requestPaint = vi.fn();
    const patch = patchGetContext(true);
    // Define CanvasRenderingContext2D but WITHOUT drawElementImage
    (globalThis as any).CanvasRenderingContext2D = { prototype: {} };

    try {
      expect(detectHtmlInCanvas()).toBe('missing-api');
    } finally {
      patch.restore();
      delete (globalThis as any).CanvasRenderingContext2D;
    }
  });

  it('returns "missing-api" when getContext("webgl2") returns null (WebGL2 not available)', () => {
    (HTMLCanvasElement.prototype as any).requestPaint = vi.fn();
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
      if (contextId === 'webgl2') return null as any;
      return (original as any).call(this, contextId, ...args);
    } as any;

    try {
      expect(detectHtmlInCanvas()).toBe('missing-api');
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
