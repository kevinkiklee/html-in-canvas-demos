/**
 * Print Table mode — photos on a dark surface with a cursor-following spotlight.
 *
 * Demonstrates composite-texture post-processing: the entire HTML grid is
 * captured as one texture, and the spotlight shader applies per-pixel
 * brightness falloff and distance-based blur in a single pass. The effect
 * crosses element boundaries seamlessly — blur flows from one photo through
 * the gap into the next caption. CSS brightness/blur are per-element only.
 */
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import spotlightSrc from './spotlight.frag?raw';

function createGridHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    padding: 2rem;
    width: 100%;
    min-height: 100%;
    background: #0a0a0b;
  `;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const card = document.createElement('article');
    card.className = 'print-card';
    card.dataset.index = String(i);
    card.style.cssText = `cursor: pointer;`;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      border-radius: 2px;
      background: #141416;
    `;
    loadPhoto(img, photo, 400);

    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 0.5rem;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      color: #8a8680;
    `;
    caption.textContent = photo.title || photo.description || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      margin-top: 0.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #5a5650;
    `;
    exif.textContent = formatExif(photo);

    card.append(img, caption, exif);
    root.appendChild(card);
  }
}

export default function createPrintTable(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  // Root must have overflow:hidden — texElementImage2D crashes the GPU process
  // when called on elements with overflow:auto/scroll. The scroller div inside
  // handles actual scrolling; root is the texture capture target.
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';
  canvas.appendChild(root);

  const scroller = document.createElement('div');
  scroller.style.cssText = 'width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden;';
  root.appendChild(scroller);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createGridHTML(scroller, photos);

  ctx.setModePaint((changedElements) => {
    tracker.handlePaint(changedElements);
    requestDraw();
  });

  const program = getCachedProgram(gl, vertexSrc, spotlightSrc);
  const quad = createQuadVAO(gl);

  let mouseX = 0.5;
  let mouseY = 0.5;

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
      // u_mousePos: normalized cursor position — the spotlight center point
      gl.uniform2f(uniform(gl, program, 'u_mousePos'), mouseX, mouseY);
      gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointermove') {
        const rect = canvas.getBoundingClientRect();
        mouseX = (ev.clientX - rect.left) / rect.width;
        mouseY = 1.0 - (ev.clientY - rect.top) / rect.height;
        requestDraw();
      }
      if (ev.type === 'pointerdown') {
        const target = ev.target as HTMLElement;
        const card = target.closest('[data-index]') as HTMLElement | null;
        if (card) {
          openDetail(parseInt(card.dataset.index!, 10));
        }
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
