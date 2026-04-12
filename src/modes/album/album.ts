import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createTessellatedQuad, createElementTexture } from '../../lib/gl';
import { loadPhoto } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import pageCurlSrc from './page-curl.frag?raw';

const TURN_DURATION = 800;

function createPageHTML(container: HTMLElement, photo: Photo | null, isCover: boolean): void {
  container.innerHTML = '';
  container.style.cssText = `
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: #141416; padding: 2rem;
  `;

  if (isCover) {
    container.innerHTML = `
      <div style="text-align:center;">
        <h1 style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:2.5rem;color:#e8e4df;margin-bottom:0.75rem;">
          Photography Portfolio
        </h1>
        <p style="font-family:Inter,system-ui,sans-serif;font-size:0.9rem;color:#5a5650;">
          Turn the page to begin →
        </p>
      </div>
    `;
    return;
  }

  if (!photo) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex; gap: 2rem; align-items: center;
    width: 100%; height: 100%; max-width: 900px;
  `;

  const imgWrap = document.createElement('div');
  imgWrap.style.cssText = `flex: 1; display: flex; align-items: center; justify-content: center;`;
  const img = document.createElement('img');
  img.style.cssText = `max-width: 100%; max-height: 70vh; object-fit: contain;`;
  loadPhoto(img, photo, 800);
  imgWrap.appendChild(img);

  const info = document.createElement('div');
  info.style.cssText = `flex: 0 0 220px;`;

  const title = document.createElement('h3');
  title.style.cssText = `
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.3rem; color: #e8e4df; margin-bottom: 0.5rem;
  `;
  title.textContent = photo.title || '';

  const desc = document.createElement('p');
  desc.style.cssText = `font-size: 0.85rem; color: #8a8680; line-height: 1.6; margin-bottom: 1rem;`;
  desc.textContent = photo.description || '';

  const exif = document.createElement('div');
  exif.className = 'exif-container';
  exif.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem; color: #5a5650; line-height: 1.8;
  `;
  const e = photo.exif;
  exif.innerHTML = [e.focalLength, e.aperture, e.shutterSpeed, e.iso]
    .filter(Boolean)
    .map(s => `<div>${s}</div>`)
    .join('');

  info.append(title, desc, exif);
  wrapper.append(imgWrap, info);
  container.appendChild(wrapper);
}

export default function createAlbum(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  const pages = [null, ...photos];
  let currentPage = 0;

  const pageEl = document.createElement('div');
  pageEl.id = 'album-page';
  canvas.appendChild(pageEl);

  const nextPageEl = document.createElement('div');
  nextPageEl.id = 'album-next';
  nextPageEl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
  canvas.appendChild(nextPageEl);

  const texCurrent = createElementTexture(gl);
  const texNext = createElementTexture(gl);

  const onPaint = ((e: PaintEvent) => {
    for (const el of e.changedElements) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (el === pageEl) {
        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pageEl);
      }
      if (el === nextPageEl) {
        gl.bindTexture(gl.TEXTURE_2D, texNext);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextPageEl);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, pageCurlSrc);
  const mesh = createTessellatedQuad(gl, 40, 30);

  createPageHTML(pageEl, null, true);
  canvas.requestPaint?.();

  let turning = false;
  let turnStart = 0;
  let turnDirection = 1;

  function turnPage(direction: number): void {
    const nextIdx = currentPage + direction;
    if (nextIdx < 0 || nextIdx >= pages.length || turning) return;
    const photo = pages[nextIdx];
    createPageHTML(nextPageEl, photo, nextIdx === 0);
    canvas.requestPaint?.();
    turning = true;
    turnStart = performance.now();
    turnDirection = direction;
    setAnimating(true);
  }

  const pageNum = document.createElement('div');
  pageNum.style.cssText = `
    position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%);
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #5a5650;
    pointer-events: none;
  `;
  pageNum.textContent = `1 / ${pages.length}`;
  canvas.parentElement?.appendChild(pageNum);

  const mode: ModeImpl = {
    paint(_dt: number) {
      const now = performance.now();
      let curlProgress = 0;

      if (turning) {
        curlProgress = Math.min((now - turnStart) / TURN_DURATION, 1.0);
        const easedProgress = 1.0 - Math.pow(1.0 - curlProgress, 3);

        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texNext);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();

        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), easedProgress);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        mesh.draw();

        if (curlProgress >= 1.0) {
          turning = false;
          currentPage += turnDirection;
          createPageHTML(pageEl, pages[currentPage], currentPage === 0);
          canvas.requestPaint?.();
          setAnimating(false);
          pageNum.textContent = `${currentPage + 1} / ${pages.length}`;
        }
      } else {
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texCurrent);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform1f(uniform(gl, program, 'u_curlProgress'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();
      }
    },

    isAnimating() { return turning; },

    onPointer(ev: PointerEvent) {
      if (ev.type !== 'pointerdown' || turning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      if (x > 0.65) turnPage(1);
      else if (x < 0.35) turnPage(-1);
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      gl.deleteTexture(texCurrent);
      gl.deleteTexture(texNext);
      mesh.dispose();
      pageEl.remove();
      nextPageEl.remove();
      pageNum.remove();
    },
  };

  return mode;
}
