import { LEARN_CONTENT } from './content';
import type { ModeName } from '../types';

interface LearnDrawer {
  toggle: () => void;
  setMode: (name: ModeName) => void;
}

export function createLearnDrawer(): LearnDrawer {
  const el = document.getElementById('learn-drawer')!;

  const wasOpen = localStorage.getItem('learn-drawer') !== 'closed';
  if (wasOpen) {
    el.classList.remove('drawer-closed');
    el.classList.add('drawer-open');
  }

  el.innerHTML = `
    <div class="learn-header">
      <span class="learn-label">How This Mode Works</span>
    </div>
    <div class="learn-body">
      <h3 class="learn-title"></h3>
      <p class="learn-desc"></p>
      <div class="learn-section">
        <span class="learn-section-label">How It Works</span>
        <div class="learn-how"></div>
      </div>
      <div class="learn-section">
        <span class="learn-section-label">Why HTML-in-Canvas?</span>
        <div class="learn-why"></div>
      </div>
      <div class="learn-section">
        <span class="learn-section-label">Key Code</span>
        <pre class="learn-code"><code></code></pre>
      </div>
    </div>
  `;

  const titleEl = el.querySelector('.learn-title')!;
  const descEl = el.querySelector('.learn-desc')!;
  const howEl = el.querySelector('.learn-how')!;
  const whyEl = el.querySelector('.learn-why')!;
  const codeEl = el.querySelector('.learn-code code')!;
  const bodyEl = el.querySelector('.learn-body')! as HTMLElement;

  return {
    toggle() {
      const isOpen = el.classList.contains('drawer-open');
      el.classList.toggle('drawer-open', !isOpen);
      el.classList.toggle('drawer-closed', isOpen);
      localStorage.setItem('learn-drawer', isOpen ? 'closed' : 'open');
    },

    setMode(name: ModeName) {
      const content = LEARN_CONTENT[name];
      if (!content) return;

      bodyEl.style.opacity = '0';
      setTimeout(() => {
        titleEl.textContent = content.title;
        descEl.textContent = content.description;
        howEl.innerHTML = content.howItWorks;
        whyEl.innerHTML = content.whyHiC;
        codeEl.textContent = content.keyCode;
        bodyEl.style.opacity = '1';
      }, 150);
    },
  };
}
