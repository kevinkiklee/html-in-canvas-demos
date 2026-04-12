/**
 * Shell — the single render controller for the HTML-in-Canvas portfolio.
 *
 * The shell owns the one WebGL2 context and the one RAF loop. Modes never
 * create their own context or loop — they plug render functions into the
 * shell via setModeHook/setOverlayHook. This guarantees a single GPU
 * pipeline and avoids the context-limit (browsers cap WebGL contexts at ~8).
 */
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

  size = { w: 0, h: 0 };
  dpr = 1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    // `layoutsubtree` is the HiC opt-in: it tells the browser that this canvas's
    // children are live DOM that should be laid out, receive events, and participate
    // in accessibility — but NOT visually painted unless explicitly drawn via
    // drawElementImage (2D) or texElementImage2D (WebGL).
    this.canvas.setAttribute('layoutsubtree', '');
    container.appendChild(this.canvas);

    this.gl = initGL(this.canvas);
    this.tracker = new PaintTracker(this.gl);
    this.quad = createQuadVAO(this.gl);
    this.passthroughProgram = getCachedProgram(this.gl, vertexSrc, passthroughSrc);

    // The `paint` event is the ONLY safe place to call texElementImage2D.
    // Calling it outside this handler (e.g., in RAF or a click handler) crashes
    // the GPU process. The browser fires `paint` after layout when subtree
    // children have changed pixels — we upload textures here, then schedule a
    // RAF frame to draw them.
    this.canvas.addEventListener('paint', ((e: PaintEvent) => {
      this.tracker.handlePaint(e.changedElements);
      this.dirty = true;
      this.wake();
    }) as EventListener);

    this.handleResize();
    window.addEventListener('resize', this.debouncedResize);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.sleep();
      else if (this.animating || this.dirty) this.wake();
    });
  }

  private resizeRaf = 0;

  private handleResize = (): void => {
    // HiC rule: size the backing buffer to CSS pixels * DPR, or text captured
    // from subtree children will be blurry on retina displays.
    this.dpr = window.devicePixelRatio || 1;
    this.size.w = this.canvas.clientWidth;
    this.size.h = this.canvas.clientHeight;

    this.canvas.width = Math.max(1, Math.floor(this.size.w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.size.h * this.dpr));

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = true;
    this.wake();
  };

  private debouncedResize = (): void => {
    cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = requestAnimationFrame(this.handleResize);
  };

  // Dirty-flag RAF loop: we only run frames when something changed (paint fired,
  // a mode requested a draw, or a mode declared itself animating). This avoids
  // wasting GPU cycles when the portfolio is static — most modes are idle until
  // user interaction or a transition.
  private draw = (now: number): void => {
    if (document.hidden) {
      this.sleep();
      return;
    }

    // When no mode hook is set, wait for shell's tracker to have paint data.
    // When a mode hook IS set, the mode manages its own PaintTracker.
    if (!this.modeHook && !this.tracker.hasFirstPaint()) {
      this.sleep();
      return;
    }

    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.modeHook) {
      this.modeHook(dt);
    } else {
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

  // Mode hook pattern: the shell owns the GL context and RAF loop; modes inject
  // their render logic as callbacks. This inversion of control lets modes focus
  // purely on drawing while the shell handles timing, dirty tracking, and sleep.
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

  clearCanvas(): void {
    while (this.canvas.firstChild) {
      this.canvas.removeChild(this.canvas.firstChild);
    }
    this.tracker.clear();
  }

  createModeRoot(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'mode-root';
    this.canvas.appendChild(root);
    this.tracker.register(root, 'mode-root');
    return root;
  }

  requestPaint(): void {
    this.canvas.requestPaint?.();
  }

  dispose(): void {
    this.sleep();
    cancelAnimationFrame(this.resizeRaf);
    window.removeEventListener('resize', this.debouncedResize);
    this.tracker.dispose();
    this.quad.dispose();
  }
}
