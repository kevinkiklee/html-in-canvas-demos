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

// @ts-ignore unused during debug
function _createWallHTML(root: HTMLElement, photos: Photo[], onImageLoad?: () => void): void {
  // Merge styles instead of overwriting cssText — the caller may have set
  // layout-critical properties (height, overflow) that must survive.
  Object.assign(root.style, {
    padding: '4rem 0',
    background: '#0a0a0b',
  });

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

      img.style.cssText = `
        width: 100%; object-fit: contain; cursor: pointer;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      `;
      loadPhoto(img, photo, 800, onImageLoad);

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
  
        img.style.cssText = `
          width: 100%; object-fit: contain;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        `;
        loadPhoto(img, photo, 600, onImageLoad);

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
  const { gl, canvas, photos: _photos, requestDraw, openDetail: _openDetail } = ctx;

  // Root must have overflow:hidden — texElementImage2D crashes the GPU process
  // when called on elements with overflow:auto/scroll. The scroller div inside
  // handles actual scrolling; root is the texture capture target.
  // DEBUG TEST: three variants to find what breaks texture capture
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width: 100%; height: 100%; overflow: hidden; background: red;';
  canvas.appendChild(root);

  // Test A: text directly on root (no scroller)
  const textOnRoot = document.createElement('div');
  textOnRoot.style.cssText = 'color: yellow; font-size: 3rem; padding: 1rem;';
  textOnRoot.textContent = 'A: text on root';
  root.appendChild(textOnRoot);

  // Test B: scroller with text
  const scroller = document.createElement('div');
  scroller.style.cssText = 'width: 100%; height: 50%; overflow-y: auto; background: blue; color: white; font-size: 3rem; padding: 1rem;';
  scroller.textContent = 'B: text on scroller (overflow-y:auto)';
  root.appendChild(scroller);

  // Test C: plain div (no overflow) with text
  const plain = document.createElement('div');
  plain.style.cssText = 'width: 100%; height: 25%; background: green; color: black; font-size: 3rem; padding: 1rem;';
  plain.textContent = 'C: text on plain div';
  root.appendChild(plain);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  ctx.setModePaint((changedElements) => {
    console.log('[wall] paint fired, changedElements:', changedElements.length,
      changedElements.map(el => `${el.tagName}#${(el as HTMLElement).id || '?'}`));
    tracker.handlePaint(changedElements);
    console.log('[wall] hasFirstPaint:', tracker.hasFirstPaint());
    requestDraw();
  });

  const program = getCachedProgram(gl, vertexSrc, lightingSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

  const mode: ModeImpl = {
    paint(_dt: number) {
      if (!tracker.hasFirstPaint()) {
        console.log('[wall] paint(): no first paint yet');
        return;
      }
      const tex = tracker.getTexture('mode-root');
      if (!tex) return;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
      gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
      quad.draw();
    },

    onResize() { requestDraw(); },

    destroy() {
      ctx.setModePaint(null);
      tracker.dispose();
      quad.dispose();
      root.remove();
    },
  };

  return mode;
}
