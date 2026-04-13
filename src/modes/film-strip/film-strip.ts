/**
 * Film Strip mode — a horizontal filmstrip that curves like real film.
 *
 * Demonstrates UV-space curvature on a composite HTML texture. The strip
 * (photos, sprocket holes, frame counters) is captured as one texture, and
 * the curvature shader bends UV coordinates to simulate a 3D film surface.
 * CSS 3D can angle individual elements, but cannot curve an entire continuous
 * layout as one surface — the gaps, sprockets, and text must all bend together.
 */
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

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      display: block;
    `;
    loadPhoto(img, photo, 400);
    frame.appendChild(img);

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

  // Root must have overflow:hidden — texElementImage2D crashes the GPU process
  // when called on elements with overflow:auto/scroll. The scroller div inside
  // handles actual scrolling; root is the texture capture target.
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';
  canvas.appendChild(root);

  const scroller = document.createElement('div');
  scroller.style.cssText = 'width: 100%; height: 100%; overflow-x: auto; overflow-y: hidden;';
  root.appendChild(scroller);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createStripHTML(scroller, photos);

  ctx.setModePaint((changedElements) => {
    tracker.handlePaint(changedElements);
    requestDraw();
  });

  const program = getCachedProgram(gl, vertexSrc, curvatureSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  const onScroll = () => {
    canvas.requestPaint?.();
    requestDraw();
  };
  scroller.addEventListener('scroll', onScroll);

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
      // u_curvature: how much the film bends (higher = more dramatic curve)
      gl.uniform1f(uniform(gl, program, 'u_curvature'), 0.12);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const frame = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (frame) openDetail(parseInt(frame.dataset.index!, 10));
      }
    },

    onWheel(ev: WheelEvent) {
      // Convert vertical scroll to horizontal scroll for the film strip
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
        scroller.scrollLeft += ev.deltaY;
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      ctx.setModePaint(null);
      scroller.removeEventListener('scroll', onScroll);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
