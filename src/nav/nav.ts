import { MODE_ORDER, MODE_LABELS, type ModeName } from '../types';

interface NavOptions {
  onModeSwitch: (name: ModeName) => void;
  onToggleExif: () => void;
  onToggleLearn: () => void;
  onOpenAbout: () => void;
}

interface Nav {
  setActiveMode: (name: ModeName) => void;
}

export function createNav(opts: NavOptions): Nav {
  const el = document.getElementById('main-nav')!;

  const title = document.createElement('div');
  title.className = 'nav-title';
  title.innerHTML = '<span class="nav-title-text">Photography Portfolio</span>';

  const modes = document.createElement('div');
  modes.className = 'nav-modes';

  const buttons = new Map<ModeName, HTMLButtonElement>();
  const indicator = document.createElement('div');
  indicator.className = 'nav-indicator';
  modes.appendChild(indicator);

  for (const name of MODE_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'nav-mode-btn';
    btn.textContent = MODE_LABELS[name];
    btn.dataset.mode = name;
    btn.addEventListener('click', () => opts.onModeSwitch(name));
    modes.appendChild(btn);
    buttons.set(name, btn);
  }

  const controls = document.createElement('div');
  controls.className = 'nav-controls';

  const exifBtn = document.createElement('button');
  exifBtn.className = 'nav-ctrl-btn';
  exifBtn.textContent = 'EXIF';
  exifBtn.addEventListener('click', opts.onToggleExif);

  const learnBtn = document.createElement('button');
  learnBtn.className = 'nav-ctrl-btn';
  learnBtn.textContent = 'Learn';
  learnBtn.addEventListener('click', opts.onToggleLearn);

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'nav-ctrl-btn';
  aboutBtn.textContent = 'About';
  aboutBtn.addEventListener('click', opts.onOpenAbout);

  controls.append(exifBtn, learnBtn, aboutBtn);
  el.append(title, modes, controls);

  function updateIndicator(name: ModeName): void {
    const btn = buttons.get(name);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const navRect = modes.getBoundingClientRect();
    indicator.style.left = `${rect.left - navRect.left}px`;
    indicator.style.width = `${rect.width}px`;
  }

  return {
    setActiveMode(name: ModeName) {
      for (const [n, btn] of buttons) {
        btn.classList.toggle('active', n === name);
      }
      updateIndicator(name);
    },
  };
}
