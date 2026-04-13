import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaintTracker } from '../paint-tracker';

// ---------------------------------------------------------------------------
// Mock WebGL2 context
// ---------------------------------------------------------------------------

function makeMockGL() {
  let _texCounter = 0;
  const deletedTextures = new Set<object>();

  const gl = {
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    UNPACK_FLIP_Y_WEBGL: 0x9240,

    createTexture: vi.fn(() => ({ _id: ++_texCounter })),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    pixelStorei: vi.fn(),
    deleteTexture: vi.fn((tex: object) => deletedTextures.add(tex)),

    // HiC extension method
    texElementImage2D: vi.fn(),

    _deletedTextures: deletedTextures,
  };

  return gl as unknown as WebGL2RenderingContext & {
    _deletedTextures: Set<object>;
    texElementImage2D: ReturnType<typeof vi.fn>;
  };
}

function makeEl(width = 100, height = 100): HTMLElement {
  const el = document.createElement('div');
  // happy-dom doesn't lay out, so we stub offsetWidth/offsetHeight/isConnected
  Object.defineProperty(el, 'offsetWidth', { get: () => width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { get: () => height, configurable: true });
  Object.defineProperty(el, 'isConnected', { get: () => width > 0 && height > 0, configurable: true });
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaintTracker', () => {
  let gl: ReturnType<typeof makeMockGL>;
  let tracker: PaintTracker;

  beforeEach(() => {
    gl = makeMockGL();
    tracker = new PaintTracker(gl);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register()', () => {
    it('adds a new entry and allocates a texture', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      expect(gl.createTexture).toHaveBeenCalledTimes(1);
      expect(tracker.getTexture('el-1')).not.toBeNull();
    });

    it('is a no-op for duplicate IDs (does not allocate a second texture)', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.register(el, 'el-1');
      expect(gl.createTexture).toHaveBeenCalledTimes(1);
    });

    it('allows multiple different IDs', () => {
      tracker.register(makeEl(), 'a');
      tracker.register(makeEl(), 'b');
      expect(gl.createTexture).toHaveBeenCalledTimes(2);
      expect(tracker.getTexture('a')).not.toBeNull();
      expect(tracker.getTexture('b')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // unregister
  // -------------------------------------------------------------------------

  describe('unregister()', () => {
    it('removes the entry so getTexture returns null', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.unregister('el-1');
      expect(tracker.getTexture('el-1')).toBeNull();
    });

    it('calls gl.deleteTexture on the registered texture', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      const tex = tracker.getTexture('el-1')!;
      tracker.unregister('el-1');
      expect(gl._deletedTextures.has(tex)).toBe(true);
    });

    it('is a no-op for unknown IDs', () => {
      expect(() => tracker.unregister('does-not-exist')).not.toThrow();
      expect(gl.deleteTexture).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getTexture
  // -------------------------------------------------------------------------

  describe('getTexture()', () => {
    it('returns null for unknown IDs', () => {
      expect(tracker.getTexture('nope')).toBeNull();
    });

    it('returns the texture object for a registered ID', () => {
      tracker.register(makeEl(), 'foo');
      expect(tracker.getTexture('foo')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // hasFirstPaint / uploadDirect
  // -------------------------------------------------------------------------

  describe('hasFirstPaint()', () => {
    it('starts as false', () => {
      expect(tracker.hasFirstPaint()).toBe(false);
    });

    it('becomes true after a successful uploadDirect()', () => {
      const el = makeEl(100, 100);
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.hasFirstPaint()).toBe(true);
    });

    it('remains false if uploadDirect is called with an element with zero dimensions', () => {
      const el = makeEl(0, 0);
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.hasFirstPaint()).toBe(false);
    });

    it('remains false if uploadDirect is called with an unregistered element', () => {
      const el = makeEl();
      tracker.uploadDirect(el); // not registered
      expect(tracker.hasFirstPaint()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isDirty / clearDirty
  // -------------------------------------------------------------------------

  describe('isDirty() / clearDirty()', () => {
    it('starts as false', () => {
      expect(tracker.isDirty()).toBe(false);
    });

    it('becomes true after a successful uploadDirect()', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.isDirty()).toBe(true);
    });

    it('clearDirty() resets the flag to false', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      tracker.clearDirty();
      expect(tracker.isDirty()).toBe(false);
    });

    it('does not become dirty when uploadDirect fails (zero size)', () => {
      const el = makeEl(0, 0);
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.isDirty()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe('dispose()', () => {
    it('deletes all textures', () => {
      tracker.register(makeEl(), 'a');
      tracker.register(makeEl(), 'b');
      const texA = tracker.getTexture('a')!;
      const texB = tracker.getTexture('b')!;
      tracker.dispose();
      expect(gl._deletedTextures.has(texA)).toBe(true);
      expect(gl._deletedTextures.has(texB)).toBe(true);
    });

    it('clears all entries — getTexture returns null afterwards', () => {
      tracker.register(makeEl(), 'a');
      tracker.dispose();
      expect(tracker.getTexture('a')).toBeNull();
    });

    it('resets hasFirstPaint to false', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.hasFirstPaint()).toBe(true);
      tracker.dispose();
      expect(tracker.hasFirstPaint()).toBe(false);
    });

    it('resets isDirty to false', () => {
      const el = makeEl();
      tracker.register(el, 'el-1');
      tracker.uploadDirect(el);
      expect(tracker.isDirty()).toBe(true);
      tracker.dispose();
      expect(tracker.isDirty()).toBe(false);
    });

    it('is safe to call on an empty tracker', () => {
      expect(() => tracker.dispose()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // handlePaint
  // -------------------------------------------------------------------------

  describe('handlePaint()', () => {
    it('uploads all provided elements that are registered', () => {
      const el1 = makeEl();
      const el2 = makeEl();
      tracker.register(el1, 'a');
      tracker.register(el2, 'b');
      tracker.handlePaint([el1, el2]);
      expect(tracker.hasFirstPaint()).toBe(true);
      expect(tracker.isDirty()).toBe(true);
    });

    it('ignores unregistered elements without throwing', () => {
      const unregistered = makeEl();
      expect(() => tracker.handlePaint([unregistered])).not.toThrow();
      expect(tracker.hasFirstPaint()).toBe(false);
    });

    it('handles a mix of registered and unregistered elements', () => {
      const registered = makeEl();
      const unregistered = makeEl();
      tracker.register(registered, 'reg');
      expect(() => tracker.handlePaint([unregistered, registered])).not.toThrow();
      expect(tracker.hasFirstPaint()).toBe(true);
    });

    it('handles an empty array without throwing', () => {
      expect(() => tracker.handlePaint([])).not.toThrow();
      expect(tracker.hasFirstPaint()).toBe(false);
    });
  });

  describe('multiple registrations then dispose', () => {
    it('registers many elements, disposes all, then re-registers cleanly', () => {
      const elements = Array.from({ length: 10 }, (_, i) => makeEl(50 + i, 50 + i));
      for (let i = 0; i < elements.length; i++) {
        tracker.register(elements[i], `multi-${i}`);
      }
      expect(gl.createTexture).toHaveBeenCalledTimes(10);
      for (let i = 0; i < elements.length; i++) {
        expect(tracker.getTexture(`multi-${i}`)).not.toBeNull();
      }

      tracker.dispose();

      for (let i = 0; i < elements.length; i++) {
        expect(tracker.getTexture(`multi-${i}`)).toBeNull();
      }
      expect(gl.deleteTexture).toHaveBeenCalledTimes(10);

      // Re-register after dispose should work
      const fresh = makeEl();
      tracker.register(fresh, 'fresh');
      expect(tracker.getTexture('fresh')).not.toBeNull();
    });
  });
});
