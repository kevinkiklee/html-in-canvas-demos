/**
 * Wall Exhibition mode — photos hung on a gallery wall with overhead lighting.
 *
 * Demonstrates shader-based compositing and lighting on live HTML. The HTML
 * layout is captured as a texture and composited onto a procedural wall
 * surface. Per-pixel gallery lighting (overhead spots, inverse-square falloff)
 * varies brightness within individual elements — impossible with CSS, which
 * applies brightness uniformly per-element. Shadows and light spill cross
 * element boundaries because the shader operates on the composite texture.
 */
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import lightingSrc from './gallery-lighting.frag?raw';

function createWallHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    width: 100%;
    padding: 4rem 0;
    background: #0a0a0b;
  `;

  let i = 0;
  while (i < photos.length) {
    if (i % 3 === 0) {
      const photo = photos[i];
      const section = document.createElement('section');
      section.style.cssText = `
        display: flex; flex-direction: column; align-items: center;
        margin: 4rem auto; max-width: 700px; padding: 0 2rem;
      `;
      section.dataset.index = String(i);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.style.cssText = `
        width: 100%; object-fit: contain; cursor: pointer;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      `;
      loadPhoto(img, photo, 800);

      const plaque = document.createElement('div');
      plaque.style.cssText = `
        margin-top: 1.25rem; text-align: center;
        padding: 0.75rem 1.5rem;
        border: 1px solid rgba(255,255,255,0.04);
        background: rgba(20,20,22,0.5);
      `;
      const plaqueTitle = document.createElement('div');
      plaqueTitle.style.cssText = `font-family:'Playfair Display',Georgia,serif;font-size:1rem;color:#e8e4df;`;
      plaqueTitle.textContent = photo.title || '';
      const plaqueDesc = document.createElement('div');
      plaqueDesc.style.cssText = `font-size:0.8rem;color:#8a8680;margin-top:0.25rem;`;
      plaqueDesc.textContent = photo.description || '';
      const plaqueExif = document.createElement('div');
      plaqueExif.className = 'exif-container';
      plaqueExif.style.cssText = `font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#5a5650;margin-top:0.35rem;`;
      plaqueExif.textContent = formatExif(photo);
      plaque.append(plaqueTitle, plaqueDesc, plaqueExif);

      section.append(img, plaque);
      root.appendChild(section);
      i++;
    } else {
      const cluster = document.createElement('div');
      cluster.style.cssText = `
        display: flex; gap: 2rem; justify-content: center;
        margin: 3rem auto; max-width: 800px; padding: 0 2rem;
      `;

      for (let j = 0; j < 2 && i < photos.length; j++, i++) {
        const photo = photos[i];
        const card = document.createElement('div');
        card.dataset.index = String(i);
        card.style.cssText = `flex: 1; max-width: 360px; cursor: pointer;`;

        const img = document.createElement('img');
        img.loading = 'lazy';
        img.style.cssText = `
          width: 100%; object-fit: contain;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        `;
        loadPhoto(img, photo, 600);

        const plaque = document.createElement('div');
        plaque.style.cssText = `margin-top: 0.75rem; text-align: center;`;
        const clusterTitle = document.createElement('div');
        clusterTitle.style.cssText = `font-family:Inter,system-ui,sans-serif;font-size:0.85rem;color:#8a8680;`;
        clusterTitle.textContent = photo.title || '';
        const clusterExif = document.createElement('div');
        clusterExif.className = 'exif-container';
        clusterExif.style.cssText = `font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:#5a5650;margin-top:0.2rem;`;
        clusterExif.textContent = formatExif(photo);
        plaque.append(clusterTitle, clusterExif);

        card.append(img, plaque);
        cluster.appendChild(card);
      }

      root.appendChild(cluster);
    }
  }
}

export default function createWallExhibition(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden;';
  canvas.appendChild(root);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createWallHTML(root, photos);

  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, lightingSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  let scrollY = 0;
  root.addEventListener('scroll', () => {
    scrollY = root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight);
    canvas.requestPaint?.();
    requestDraw();
  });

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
      // u_scrollY: normalized scroll position — shifts which overhead lights are active
      gl.uniform1f(uniform(gl, program, 'u_scrollY'), scrollY);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
      quad.draw();
    },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const card = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
        if (card) openDetail(parseInt(card.dataset.index!, 10));
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
