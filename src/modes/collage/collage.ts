import type { ModeImpl, ModeContext, Photo } from '../../types';
import { getCachedProgram, uniform, createQuadVAO } from '../../lib/gl';
import { PaintTracker } from '../../lib/paint-tracker';
import { loadPhoto, formatExif } from '../../lib/photos';
import vertexSrc from '../../shaders/vertex.glsl?raw';
import tiltShiftSrc from './tilt-shift.frag?raw';

interface SlotDef {
  x: string; y: string; w: string; rot: number; z: number;
}

const TEMPLATES: SlotDef[][] = [
  [
    { x: '2%',  y: '3%',  w: '38%', rot: -2,  z: 1 },
    { x: '35%', y: '8%',  w: '30%', rot: 1.5, z: 2 },
    { x: '60%', y: '2%',  w: '36%', rot: -1,  z: 1 },
    { x: '5%',  y: '38%', w: '32%', rot: 1,   z: 3 },
    { x: '30%', y: '42%', w: '35%', rot: -1.5,z: 2 },
    { x: '58%', y: '36%', w: '38%', rot: 2,   z: 1 },
    { x: '10%', y: '68%', w: '36%', rot: -1,  z: 2 },
    { x: '45%', y: '72%', w: '32%', rot: 1,   z: 3 },
  ],
  [
    { x: '0%',  y: '5%',  w: '45%', rot: -1,  z: 1 },
    { x: '40%', y: '0%',  w: '28%', rot: 2,   z: 2 },
    { x: '65%', y: '10%', w: '33%', rot: -2,  z: 1 },
    { x: '8%',  y: '40%', w: '30%', rot: 1.5, z: 2 },
    { x: '35%', y: '35%', w: '40%', rot: -0.5,z: 3 },
    { x: '62%', y: '45%', w: '35%', rot: 1,   z: 1 },
    { x: '3%',  y: '70%', w: '35%', rot: -1.5,z: 2 },
    { x: '38%', y: '68%', w: '30%', rot: 2,   z: 3 },
  ],
];

function createCollageHTML(root: HTMLElement, photos: Photo[]): void {
  root.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    background: #0a0a0b;
    overflow: hidden;
  `;

  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const count = Math.min(photos.length, template.length);

  for (let i = 0; i < count; i++) {
    const photo = photos[i];
    const slot = template[i];

    const card = document.createElement('article');
    card.dataset.index = String(i);
    card.style.cssText = `
      position: absolute;
      left: ${slot.x};
      top: ${slot.y};
      width: ${slot.w};
      transform: rotate(${slot.rot}deg);
      z-index: ${slot.z};
      cursor: pointer;
      background: #141416;
      padding: 0.75rem;
      border-radius: 2px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    `;

    const img = document.createElement('img');
    img.style.cssText = `
      width: 100%;
      aspect-ratio: ${photo.width} / ${photo.height};
      object-fit: cover;
      display: block;
    `;
    loadPhoto(img, photo, 600);

    const caption = document.createElement('div');
    caption.style.cssText = `
      margin-top: 0.5rem;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #8a8680;
    `;
    caption.textContent = photo.title || '';

    const exif = document.createElement('div');
    exif.className = 'exif-container';
    exif.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #5a5650;
      margin-top: 0.25rem;
    `;
    exif.textContent = formatExif(photo);

    card.append(img, caption, exif);
    root.appendChild(card);
  }
}

export default function createCollage(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos, requestDraw, openDetail } = ctx;

  const root = document.createElement('div');
  root.id = 'mode-root';
  canvas.appendChild(root);

  const tracker = new PaintTracker(gl);
  tracker.register(root, 'mode-root');

  createCollageHTML(root, photos);

  const onPaint = ((e: PaintEvent) => {
    tracker.handlePaint(e.changedElements);
    requestDraw();
  }) as EventListener;
  canvas.addEventListener('paint', onPaint);

  const program = getCachedProgram(gl, vertexSrc, tiltShiftSrc);
  const quad = createQuadVAO(gl);

  canvas.requestPaint?.();

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
      gl.uniform1f(uniform(gl, program, 'u_focusY'), 0.5);
      gl.uniform1f(uniform(gl, program, 'u_blurStrength'), 18.0);
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
