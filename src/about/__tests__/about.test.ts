import { describe, it, expect, beforeEach } from 'vitest';
import { createAboutPanel } from '../about';

describe('createAboutPanel', () => {
  let panelEl: HTMLElement;

  beforeEach(() => {
    panelEl = document.createElement('div');
    panelEl.id = 'about-panel';
    panelEl.className = 'panel-hidden';
    document.body.innerHTML = '';
    document.body.appendChild(panelEl);
  });

  it('returns an object with open and close functions', () => {
    const panel = createAboutPanel();
    expect(panel).toHaveProperty('open');
    expect(panel).toHaveProperty('close');
    expect(typeof panel.open).toBe('function');
    expect(typeof panel.close).toBe('function');
  });

  it('creates expected DOM structure (backdrop, card, close button)', () => {
    createAboutPanel();
    expect(panelEl.querySelector('.about-backdrop')).not.toBeNull();
    expect(panelEl.querySelector('.about-card')).not.toBeNull();
    expect(panelEl.querySelector('.about-title')).not.toBeNull();
    expect(panelEl.querySelector('.about-close')).not.toBeNull();
    expect(panelEl.querySelector('.about-links')).not.toBeNull();
  });

  it('open() adds panel-visible and removes panel-hidden', () => {
    const panel = createAboutPanel();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);

    panel.open();
    expect(panelEl.classList.contains('panel-visible')).toBe(true);
    expect(panelEl.classList.contains('panel-hidden')).toBe(false);
  });

  it('close() adds panel-hidden and removes panel-visible', () => {
    const panel = createAboutPanel();
    panel.open();
    expect(panelEl.classList.contains('panel-visible')).toBe(true);

    panel.close();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);
    expect(panelEl.classList.contains('panel-visible')).toBe(false);
  });

  it('backdrop click closes the panel', () => {
    const panel = createAboutPanel();
    panel.open();
    expect(panelEl.classList.contains('panel-visible')).toBe(true);

    const backdrop = panelEl.querySelector('.about-backdrop') as HTMLElement;
    backdrop.click();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);
    expect(panelEl.classList.contains('panel-visible')).toBe(false);
  });

  it('close button click closes the panel', () => {
    const panel = createAboutPanel();
    panel.open();

    const closeBtn = panelEl.querySelector('.about-close') as HTMLButtonElement;
    closeBtn.click();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);
    expect(panelEl.classList.contains('panel-visible')).toBe(false);
  });

  it('multiple open/close cycles work correctly', () => {
    const panel = createAboutPanel();

    panel.open();
    expect(panelEl.classList.contains('panel-visible')).toBe(true);
    panel.close();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);

    panel.open();
    expect(panelEl.classList.contains('panel-visible')).toBe(true);
    panel.close();
    expect(panelEl.classList.contains('panel-hidden')).toBe(true);
  });
});
