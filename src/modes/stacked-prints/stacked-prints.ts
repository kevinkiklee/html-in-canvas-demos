import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createTessellatedQuad, createElementTexture } from '../../lib/gl';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import paperWarpSrc from './paper-warp.frag?raw';

function createPrintFrontHTML(el: HTMLElement, photo: Photo): void {
  el.innerHTML = '';
  el.style.cssText = `
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #141416; padding: 3rem;
  `;

  const img = document.createElement('img');
  img.style.cssText = `max-width: 80%; max-height: 65vh; object-fit: contain; box-shadow: 0 4px 30px rgba(0,0,0,0.4);`;
  loadPhoto(img, photo, 1200);

  const caption = document.createElement('div');
  caption.style.cssText = `margin-top: 1.5rem; text-align: center;`;
  caption.innerHTML = `
    <h3 style="font-family:'Playfair Display',Georgia,serif;font-size:1.3rem;color:#e8e4df;">${photo.title || ''}</h3>
    <p style="font-size:0.85rem;color:#8a8680;margin-top:0.35rem;">${photo.description || ''}</p>
    <div class="exif-container" style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#5a5650;margin-top:0.5rem;">
      ${formatExif(photo)}
    </div>
  `;

  el.append(img, caption);
}

function createPrintBackHTML(el: HTMLElement, photo: Photo): void {
  el.innerHTML = '';
  el.style.cssText = `
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: #1a1a1c; padding: 3rem;
  `;

  const info = document.createElement('div');
  info.style.cssText = `text-align: center; max-width: 400px;`;
  info.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#5a5650;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.5rem;">Technical Details</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:#8a8680;line-height:2.2;">
      ${photo.exif.focalLength ? `<div>${photo.exif.focalLength}</div>` : ''}
      ${photo.exif.aperture ? `<div>${photo.exif.aperture}</div>` : ''}
      ${photo.exif.shutterSpeed ? `<div>${photo.exif.shutterSpeed}</div>` : ''}
      ${photo.exif.iso ? `<div>${photo.exif.iso}</div>` : ''}
    </div>
    <div style="margin-top:2rem;font-family:Inter,system-ui,sans-serif;font-size:0.85rem;color:#5a5650;">
      ${photo.id}
    </div>
  `;

  el.appendChild(info);
}

export default function createStackedPrints(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  const frontEl = document.createElement('div');
  frontEl.id = 'print-front';
  const backEl = document.createElement('div');
  backEl.id = 'print-back';
  canvas.append(frontEl, backEl);

  const texFront = createElementTexture(gl);
  const texBack = createElementTexture(gl);

  const onPaint = ((e: PaintEvent) => {
    for (const el of e.changedElements) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (el === frontEl) {
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frontEl);
      }
      if (el === backEl) {
        gl.bindTexture(gl.TEXTURE_2D, texBack);
        (gl as any).texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backEl);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, paperWarpSrc);
  const mesh = createTessellatedQuad(gl, 30, 25);

  let currentIndex = 0;
  let grabPoint = { x: 0.5, y: 0.5 };
  let liftAmount = 0;
  let tossing = false;
  let tossStart = 0;
  const TOSS_DURATION = 600;

  function showPrint(index: number): void {
    if (index >= photos.length) return;
    currentIndex = index;
    createPrintFrontHTML(frontEl, photos[index]);
    createPrintBackHTML(backEl, photos[index]);
    canvas.requestPaint?.();
  }

  showPrint(0);

  const counter = document.createElement('div');
  counter.style.cssText = `
    position: absolute; bottom: 1.5rem; right: 1.5rem;
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #5a5650;
    pointer-events: none;
  `;
  counter.textContent = `1 / ${photos.length}`;
  canvas.parentElement?.appendChild(counter);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Stack';
  resetBtn.style.cssText = `
    position: absolute; bottom: 1.5rem; left: 1.5rem;
    font-family: Inter, system-ui, sans-serif; font-size: 0.8rem;
    color: #5a5650; background: none; border: 1px solid rgba(255,255,255,0.06);
    padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;
    transition: color 150ms, border-color 150ms;
  `;
  resetBtn.addEventListener('click', () => {
    currentIndex = 0;
    showPrint(0);
    counter.textContent = `1 / ${photos.length}`;
    liftAmount = 0;
    tossing = false;
    setAnimating(false);
  });
  resetBtn.addEventListener('mouseenter', () => {
    resetBtn.style.color = '#8a8680';
    resetBtn.style.borderColor = 'rgba(255,255,255,0.12)';
  });
  resetBtn.addEventListener('mouseleave', () => {
    resetBtn.style.color = '#5a5650';
    resetBtn.style.borderColor = 'rgba(255,255,255,0.06)';
  });
  canvas.parentElement?.appendChild(resetBtn);

  function toss(): void {
    if (tossing || currentIndex >= photos.length - 1) return;
    tossing = true;
    tossStart = performance.now();
    setAnimating(true);
  }

  const mode: ModeImpl = {
    paint(_dt: number) {
      const now = performance.now();

      if (tossing) {
        const progress = Math.min((now - tossStart) / TOSS_DURATION, 1.0);
        liftAmount = Math.sin(progress * Math.PI) * 1.5;

        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform2f(uniform(gl, program, 'u_grabPoint'), grabPoint.x, grabPoint.y);
        gl.uniform1f(uniform(gl, program, 'u_liftAmount'), liftAmount);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();

        if (progress >= 1.0) {
          tossing = false;
          liftAmount = 0;
          currentIndex++;
          showPrint(currentIndex);
          counter.textContent = `${currentIndex + 1} / ${photos.length}`;
          setAnimating(false);
        }
      } else {
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texFront);
        gl.uniform1i(uniform(gl, program, 'u_tex'), 0);
        gl.uniform2f(uniform(gl, program, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform2f(uniform(gl, program, 'u_grabPoint'), 0.5, 0.5);
        gl.uniform1f(uniform(gl, program, 'u_liftAmount'), 0.0);
        gl.uniform1f(uniform(gl, program, 'u_isBack'), 0.0);
        gl.uniform4f(uniform(gl, program, 'u_dst'), -1, -1, 2, 2);
        mesh.draw();
      }
    },

    isAnimating() { return tossing; },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointerdown') {
        const rect = canvas.getBoundingClientRect();
        grabPoint.x = (ev.clientX - rect.left) / rect.width;
        grabPoint.y = 1.0 - (ev.clientY - rect.top) / rect.height;
        toss();
      }
    },

    onResize() { requestDraw(); },

    destroy() {
      canvas.removeEventListener('paint', onPaint);
      gl.deleteTexture(texFront);
      gl.deleteTexture(texBack);
      mesh.dispose();
      frontEl.remove();
      backEl.remove();
      counter.remove();
      resetBtn.remove();
    },
  };

  return mode;
}
