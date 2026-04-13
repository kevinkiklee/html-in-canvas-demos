import type { ModeImpl, ModeContext } from '../../types';
import './gallery-walk.css';

export default function createGalleryWalk(ctx: ModeContext): ModeImpl {
  const { canvas } = ctx;

  // Placeholder — will be filled in subsequent tasks
  const root = document.createElement('div');
  root.id = 'mode-root';
  root.style.cssText = 'width:100%;height:100%;overflow:hidden;background:#0a0a0b;display:flex;align-items:center;justify-content:center;color:#5a5650;font-family:Inter,system-ui,sans-serif;';
  root.textContent = 'Gallery Walk — loading Three.js...';
  canvas.appendChild(root);
  canvas.requestPaint?.();

  return {
    paint(_dt: number) {},
    destroy() {
      root.remove();
    },
  };
}
