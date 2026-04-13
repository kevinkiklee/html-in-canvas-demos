/**
 * PaintTracker — manages one WebGL texture per tracked canvas child.
 *
 * The core HiC constraint: texElementImage2D (the call that captures a DOM
 * element's pixels into a WebGL texture) MUST be called inside the canvas's
 * `paint` event handler. Calling it anywhere else — RAF, click, setTimeout —
 * crashes the GPU process with no recovery. This class encapsulates that
 * upload-on-paint pattern so modes don't need to manage it manually.
 */
import { createElementTexture } from './gl';

interface TrackedElement {
  element: HTMLElement;
  texture: WebGLTexture;
  dirty: boolean;
}

export class PaintTracker {
  private gl: WebGL2RenderingContext;
  private entries = new Map<string, TrackedElement>();
  private _dirty = false;
  private _hasFirstPaint = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  register(el: HTMLElement, id: string): void {
    if (this.entries.has(id)) return;
    const texture = createElementTexture(this.gl);
    this.entries.set(id, { element: el, texture, dirty: true });
  }

  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      this.gl.deleteTexture(entry.texture);
      this.entries.delete(id);
    }
  }

  uploadDirect(el: HTMLElement): boolean {
    // Guard: element must be in the DOM and have non-zero layout.
    // Zero-size or disconnected elements crash the GPU process.
    if (!el.isConnected || el.offsetWidth <= 0 || el.offsetHeight <= 0) {
      console.warn('[PaintTracker] uploadDirect skipped:', { connected: el.isConnected, w: el.offsetWidth, h: el.offsetHeight });
      return false;
    }

    for (const entry of this.entries.values()) {
      if (entry.element === el) {
        try {
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
          // DEBUG: read back pixels to check texture content
          const fb = this.gl.createFramebuffer();
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
          this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, entry.texture, 0);
          const px = new Uint8Array(16);
          this.gl.readPixels(50, 50, 2, 2, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
          const px2 = new Uint8Array(4);
          this.gl.readPixels(Math.floor(el.offsetWidth / 2), Math.floor(el.offsetHeight / 2), 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px2);
          console.log('[PaintTracker] pixel@(50,50):', Array.from(px.slice(0, 4)), 'pixel@center:', Array.from(px2));
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
          this.gl.deleteFramebuffer(fb);
          return true;
        } catch (e) {
          console.warn('[PaintTracker] texElementImage2D failed:', e);
          return false;
        }
      }
    }
    return false;
  }

  handlePaint(changedElements: readonly Element[]): void {
    // HiC paint events report the specific elements that changed (e.g. an <img>
    // that finished loading), not necessarily the registered root. We need to
    // re-upload a tracked element whenever it OR any of its descendants changed.
    for (const [id, entry] of this.entries) {
      const directMatch = changedElements.some(el => el === entry.element);
      const descendantMatch = !directMatch && changedElements.some(el => entry.element.contains(el));
      if (directMatch || descendantMatch) {
        console.log('[PaintTracker] handlePaint match for', id, { directMatch, descendantMatch });
        this.uploadDirect(entry.element);
      } else {
        console.log('[PaintTracker] handlePaint NO match for', id, 'among', changedElements.length, 'elements');
      }
    }
  }

  getTexture(id: string): WebGLTexture | null {
    return this.entries.get(id)?.texture ?? null;
  }

  isDirty(): boolean {
    return this._dirty;
  }

  clearDirty(): void {
    this._dirty = false;
  }

  hasFirstPaint(): boolean {
    return this._hasFirstPaint;
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.entries.clear();
    this._dirty = false;
    this._hasFirstPaint = false;
  }

  dispose(): void {
    this.clear();
  }
}
