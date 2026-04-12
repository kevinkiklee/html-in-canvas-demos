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
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;

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

  handlePaint(changedElements: readonly Element[]): void {
    for (const el of changedElements) {
      this.uploadDirect(el as HTMLElement);
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
