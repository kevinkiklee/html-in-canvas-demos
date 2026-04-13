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

const FRAME_WIDTH = 340;
const STRIP_HEIGHT = 420;
const PHOTO_HEIGHT = 240;
const SPROCKET_SIZE = 12;

function createStripHTML(scroller: HTMLElement, photos: Photo[], onImageLoad?: () => void): void {
  const strip = document.createElement('div');
  strip.style.cssText = `
    display: flex;
    align-items: stretch;
    height: ${STRIP_HEIGHT}px;
    background: linear-gradient(180deg, #1c1a17, #1e1c18 50%, #1c1a17);
    border-top: 2px solid #2e2a24;
    border-bottom: 2px solid #2e2a24;
    padding: 0 3rem;
    flex-shrink: 0;
  `;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const frame = document.createElement('div');
    frame.dataset.index = String(i);
    frame.style.cssText = `
      flex: 0 0 ${FRAME_WIDTH}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 12px;
      border-right: 1px solid #2e2a24;
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
    `;

    for (const pos of ['top', 'bottom'] as const) {
      const sprockets = document.createElement('div');
      sprockets.style.cssText = `
        position: absolute;
        ${pos}: 7px;
        left: 0; right: 0;
        display: flex;
        justify-content: space-evenly;
        padding: 0 24px;
      `;
      for (let s = 0; s < 5; s++) {
        const hole = document.createElement('div');
        hole.style.cssText = `
          width: ${SPROCKET_SIZE}px;
          height: ${SPROCKET_SIZE}px;
          border-radius: 2px;
          background: #0d0c0a;
          border: 1px solid #332e28;
        `;
        sprockets.appendChild(hole);
      }
      frame.appendChild(sprockets);
    }

    const frameNum = document.createElement('div');
    frameNum.style.cssText = `
      position: absolute;
      top: 30px; right: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: #5a5040;
    `;
    frameNum.textContent = `${i + 1}A`;
    frame.appendChild(frameNum);

    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      height: ${PHOTO_HEIGHT}px;
      object-fit: cover;
      display: block;
    `;
    loadPhoto(img, photo, 400, onImageLoad);
    frame.appendChild(img);

    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 6px;
      font-family: Inter, system-ui, sans-serif;
      font-size: 9px;
      color: #706858;
      white-space: normal;
      text-align: center;
      line-height: 1.3;
    `;
    caption.textContent = photo.title || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 8px;
      color: #5a5040;
      text-align: center;
    `;
    exif.textContent = formatExif(photo);

    frame.append(caption, exif);
    strip.appendChild(frame);
  }

  scroller.appendChild(strip);
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
  scroller.style.cssText = 'width: 100%; height: 100%; overflow-x: auto; overflow-y: hidden; display: flex; align-items: center; background: #0a0908; scrollbar-width: none;';
  root.appendChild(scroller);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  const onImageLoad = () => {
    canvas.requestPaint?.();
    requestDraw();
  };
  createStripHTML(scroller, photos, onImageLoad);

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
