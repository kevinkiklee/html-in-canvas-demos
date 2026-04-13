import './styles/reset.css';
import './styles/theme.css';
import './styles/nav.css';
import './styles/learn.css';
import './styles/about.css';
import './styles/detail.css';

import { detectHtmlInCanvas } from './lib/detect';
import { getShuffledPhotos } from './lib/photos';
import { Shell } from './shell';
import { createNav } from './nav/nav';
import { createLearnDrawer } from './learn/learn';
import { createAboutPanel } from './about/about';
import { createDetailView } from './detail/detail';
import type { ModeName, ModeImpl, ModeContext } from './types';
import { MODE_ORDER } from './types';

// Feature detection gate: HiC requires three browser APIs (requestPaint,
// texElementImage2D, drawElementImage). Without all three, we show a graceful
// fallback explaining how to enable the Chrome flag. This runs synchronously
// before any WebGL setup to avoid wasting resources on unsupported browsers.
const support = detectHtmlInCanvas();
if (support !== 'supported') {
  document.getElementById('app')!.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:2rem;text-align:center;">
      <h1 style="font-family:var(--font-heading);font-size:2rem;margin-bottom:1rem;">Photography Portfolio</h1>
      <p style="color:var(--color-text-secondary);max-width:480px;line-height:1.7;">
        This portfolio uses <strong>HTML-in-Canvas</strong>, an experimental web API.
        To view it, open <strong>Chrome Canary</strong> and enable:
      </p>
      <code style="display:block;margin:1rem 0;padding:0.75rem 1.5rem;background:var(--color-surface);border-radius:8px;font-family:var(--font-mono);color:var(--color-text-primary);">
        chrome://flags/#canvas-draw-element
      </code>
      <p style="color:var(--color-text-muted);font-size:0.85rem;">Then reload this page.</p>
    </div>
  `;
  throw new Error('HTML-in-Canvas not supported');
}

// --- App initialization ---
const photos = getShuffledPhotos();
if (photos.length === 0) {
  document.getElementById('app')!.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:2rem;text-align:center;">
      <p style="color:var(--color-text-secondary);">No photographs found. Run <code>npm run manifest</code> to generate the photo manifest.</p>
    </div>
  `;
  throw new Error('Photo manifest is empty');
}
const container = document.getElementById('canvas-container')!;
const shell = new Shell(container);

let currentMode: ModeImpl | null = null;
let currentModeName: ModeName = 'album';
let switching = false;

// Modes are dynamically imported so each mode's shader GLSL, HTML templates,
// and logic are code-split into separate chunks. The user only downloads the
// mode they're viewing — important because each mode includes 1-3 GLSL shaders
// that would bloat the initial bundle if statically imported.
const modeLoaders: Record<ModeName, () => Promise<{ default: (ctx: ModeContext) => ModeImpl }>> = {
  album: () => import('./modes/album/album'),
  slideshow: () => import('./modes/slideshow/slideshow'),
  'print-table': () => import('./modes/print-table/print-table'),
  'film-strip': () => import('./modes/film-strip/film-strip'),
  'wall-exhibition': () => import('./modes/wall-exhibition/wall-exhibition'),
  'stacked-prints': () => import('./modes/stacked-prints/stacked-prints'),
  collage: () => import('./modes/collage/collage'),
};

function openDetail(photoIndex: number): void {
  detail.open(photos, photoIndex);
}

async function switchMode(name: ModeName): Promise<void> {
  if (name === currentModeName && currentMode) return;
  if (switching) return; // Prevent concurrent mode switches
  switching = true;

  const doSwitch = async () => {
    if (currentMode) {
      currentMode.destroy();
      currentMode = null;
    }
    shell.setModeHook(null);
    shell.setOverlayHook(null);
    shell.setAnimating(false);
    shell.clearCanvas();

    // Allow the browser compositor to settle after clearing canvas children.
    // Without this, the new mode's paint handler can fire before the old
    // mode's elements are fully detached, crashing the GPU process.
    await new Promise(r => requestAnimationFrame(r));

    const module = await modeLoaders[name]();
    const ctx: ModeContext = {
      gl: shell.gl,
      canvas: shell.canvas,
      photos,
      size: { ...shell.size },
      dpr: shell.dpr,
      requestDraw: () => shell.requestDraw(),
      setAnimating: (a) => shell.setAnimating(a),
      openDetail,
    };

    currentMode = module.default(ctx);
    currentModeName = name;

    // Wire mode's paint into shell's render loop
    shell.setModeHook((dt) => currentMode?.paint(dt));

    shell.requestPaint();

    nav.setActiveMode(name);
    learn.setMode(name);
  };

  // NOTE: View Transitions API is intentionally NOT used here. It conflicts
  // with HTML-in-Canvas — the transition's snapshot capture can trigger
  // texElementImage2D calls outside the paint handler, crashing the GPU process.
  try {
    await doSwitch();
  } finally {
    switching = false;
  }
}

// --- UI components ---
const nav = createNav({
  onModeSwitch: switchMode,
  onToggleExif: () => {
    document.body.classList.toggle('exif-hidden');
    const hidden = document.body.classList.contains('exif-hidden');
    localStorage.setItem('exif-hidden', hidden ? '1' : '0');
  },
  onToggleLearn: () => learn.toggle(),
  onOpenAbout: () => about.open(),
});

const learn = createLearnDrawer();
const about = createAboutPanel();
const detail = createDetailView();

// --- Restore persisted state ---
if (localStorage.getItem('exif-hidden') === '1') {
  document.body.classList.add('exif-hidden');
}

// --- Pointer events from canvas to current mode ---
shell.canvas.addEventListener('pointermove', (e) => currentMode?.onPointer?.(e));
shell.canvas.addEventListener('pointerdown', (e) => currentMode?.onPointer?.(e));
shell.canvas.addEventListener('pointerup', (e) => currentMode?.onPointer?.(e));

// --- Wheel events to current mode ---
shell.canvas.addEventListener('wheel', (e) => {
  if (currentMode?.onWheel) {
    currentMode.onWheel(e);
  }
}, { passive: true });

// --- Keyboard events: forward to mode + mode shortcuts ---
document.addEventListener('keydown', (e) => {
  // Don't intercept when detail view is open (it has its own handler)
  if (detail.isOpen()) return;

  // Mode shortcut keys: 1-7
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= MODE_ORDER.length) {
    e.preventDefault();
    switchMode(MODE_ORDER[num - 1]);
    return;
  }

  // Forward to current mode
  currentMode?.onKeydown?.(e);
});

// --- Debounced resize events to current mode ---
let resizeTimer = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => {
    currentMode?.onResize?.(shell.size);
  });
});

// --- Boot default mode ---
switchMode('album');
