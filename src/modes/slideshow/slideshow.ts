/**
 * Slideshow mode — cinematic transitions between full-screen slides.
 *
 * Demonstrates dual-texture blending: both outgoing and incoming slides
 * (photo + caption as one unit) are captured as separate HiC textures.
 * A randomly-chosen transition shader (film burn, rack focus, luminance
 * dissolve) blends them at the pixel level. The View Transitions API can
 * fade between snapshots but cannot do per-pixel noise dissolves, motion
 * blur, or luminance-keyed blending — those require custom GLSL.
 */
import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO, createElementTexture, safeTexUpload } from '../../lib/gl';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import passthroughSrc from '../../shaders/passthrough.frag?raw';
import filmBurnSrc from './film-burn.frag?raw';
import rackFocusSrc from './rack-focus.frag?raw';
import lumDissolveSrc from './luminance-dissolve.frag?raw';

const TRANSITION_DURATION = 1200;

function createSlideHTML(container: HTMLElement, photo: Photo): void {
  container.innerHTML = '';
  container.style.cssText = `
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #0a0a0b; padding: 2rem;
  `;

  const img = document.createElement('img');
  img.style.cssText = `max-width: 90%; max-height: 75%; object-fit: contain;`;
  loadPhoto(img, photo, 1600);

  const info = document.createElement('div');
  info.style.cssText = `margin-top: 1.5rem; text-align: center;`;

  const title = document.createElement('h3');
  title.style.cssText = `
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.2rem; color: #e8e4df; margin-bottom: 0.35rem;
  `;
  title.textContent = photo.title || '';

  const desc = document.createElement('p');
  desc.style.cssText = `font-size: 0.85rem; color: #8a8680; margin-bottom: 0.35rem;`;
  desc.textContent = photo.description || '';

  const exif = document.createElement('div');
  exif.className = 'exif-container';
  exif.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem; color: #5a5650;
  `;
  exif.textContent = formatExif(photo);

  info.append(title, desc, exif);
  container.append(img, info);
}

export default function createSlideshow(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, setAnimating } = ctx;

  const slideA = document.createElement('div');
  slideA.id = 'slide-a';
  const slideB = document.createElement('div');
  slideB.id = 'slide-b';
  canvas.append(slideA, slideB);

  const texA = createElementTexture(gl);
  const texB = createElementTexture(gl);

  // safeTexUpload guards against disconnected/zero-size elements that crash the GPU.
  // Uses the shell's single paint listener via ctx.setModePaint to avoid multiple
  // paint listeners on the canvas (which crashes Chrome's experimental HiC API).
  ctx.setModePaint((changedElements) => {
    for (const el of changedElements) {
      const target = el as HTMLElement;
      if (target === slideA || target.id === 'slide-a') {
        safeTexUpload(gl, texA, slideA);
      }
      if (target === slideB || target.id === 'slide-b') {
        safeTexUpload(gl, texB, slideB);
      }
    }
    requestDraw();
  });

  const passthroughProgram = getCachedProgram(gl, vertexSrc, passthroughSrc);
  const shaders = [
    getCachedProgram(gl, vertexSrc, filmBurnSrc),
    getCachedProgram(gl, vertexSrc, rackFocusSrc),
    getCachedProgram(gl, vertexSrc, lumDissolveSrc),
  ];

  const quad = createQuadVAO(gl);
  let currentIndex = 0;
  let transitioning = false;
  let transitionStart = 0;
  let transitionProgram: WebGLProgram = shaders[0];
  let currentIsA = true;

  createSlideHTML(slideA, photos[0]);
  canvas.requestPaint?.();

  function startTransition(newIndex: number): void {
    if (transitioning || newIndex < 0 || newIndex >= photos.length) return;
    currentIndex = newIndex;
    const target = currentIsA ? slideB : slideA;
    createSlideHTML(target, photos[currentIndex]);
    canvas.requestPaint?.();
    transitionProgram = shaders[Math.floor(Math.random() * shaders.length)];
    transitioning = true;
    transitionStart = performance.now();
    setAnimating(true);
  }

  const mode: ModeImpl = {
    paint(_dt: number) {
      const now = performance.now();

      if (transitioning) {
        let progress = Math.min((now - transitionStart) / TRANSITION_DURATION, 1.0);
        const fromTex = currentIsA ? texA : texB;
        const toTex = currentIsA ? texB : texA;

        gl.useProgram(transitionProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fromTex);
        // u_from/u_to: the two HTML textures the transition shader blends between.
        // u_progress: 0..1 transition completion — drives the shader's mix logic.
        gl.uniform1i(uniform(gl, transitionProgram, 'u_from'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, toTex);
        gl.uniform1i(uniform(gl, transitionProgram, 'u_to'), 1);
        gl.uniform1f(uniform(gl, transitionProgram, 'u_progress'), progress);
        gl.uniform2f(uniform(gl, transitionProgram, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(uniform(gl, transitionProgram, 'u_dst'), -1, -1, 2, 2);
        quad.draw();

        if (progress >= 1.0) {
          transitioning = false;
          currentIsA = !currentIsA;
          setAnimating(false);
        }
      } else {
        const tex = currentIsA ? texA : texB;
        gl.useProgram(passthroughProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(uniform(gl, passthroughProgram, 'u_tex'), 0);
        gl.uniform4f(uniform(gl, passthroughProgram, 'u_dst'), -1, -1, 2, 2);
        quad.draw();
      }
    },

    isAnimating() { return transitioning; },

    onPointer(ev: PointerEvent) {
      if (ev.type === 'pointermove') {
        const rect = canvas.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width;
        canvas.style.cursor = (x < 0.3 || x > 0.7) ? 'pointer' : 'default';
        return;
      }
      if (ev.type !== 'pointerdown' || transitioning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      if (x < 0.3) startTransition(currentIndex - 1);
      else if (x > 0.7) startTransition(currentIndex + 1);
    },

    onKeydown(ev: KeyboardEvent) {
      if (ev.key === 'ArrowRight') startTransition(currentIndex + 1);
      else if (ev.key === 'ArrowLeft') startTransition(currentIndex - 1);
    },

    onResize() { requestDraw(); },

    destroy() {
      // Stop any in-progress transition
      transitioning = false;
      setAnimating(false);

      ctx.setModePaint(null);
      canvas.style.cursor = '';
      gl.deleteTexture(texA);
      gl.deleteTexture(texB);
      quad.dispose();
      slideA.remove();
      slideB.remove();
    },
  };

  return mode;
}
