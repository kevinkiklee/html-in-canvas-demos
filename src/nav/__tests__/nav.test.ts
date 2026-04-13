import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNav } from '../nav';
import { MODE_ORDER, MODE_LABELS } from '../../types';

describe('createNav', () => {
  let navEl: HTMLElement;

  beforeEach(() => {
    navEl = document.createElement('nav');
    navEl.id = 'main-nav';
    document.body.innerHTML = '';
    document.body.appendChild(navEl);
  });

  function makeNav(overrides: Partial<Parameters<typeof createNav>[0]> = {}) {
    return createNav({
      onModeSwitch: overrides.onModeSwitch ?? vi.fn(),
      onToggleExif: overrides.onToggleExif ?? vi.fn(),
      onToggleLearn: overrides.onToggleLearn ?? vi.fn(),
      onOpenAbout: overrides.onOpenAbout ?? vi.fn(),
    });
  }

  it('returns an object with setActiveMode function', () => {
    const nav = makeNav();
    expect(nav).toHaveProperty('setActiveMode');
    expect(typeof nav.setActiveMode).toBe('function');
  });

  it('creates expected DOM structure with title, mode buttons, and controls', () => {
    makeNav();
    const title = navEl.querySelector('.nav-title');
    expect(title).not.toBeNull();

    const modesContainer = navEl.querySelector('.nav-modes');
    expect(modesContainer).not.toBeNull();

    const modeButtons = navEl.querySelectorAll('.nav-mode-btn');
    expect(modeButtons).toHaveLength(MODE_ORDER.length);

    const controls = navEl.querySelector('.nav-controls');
    expect(controls).not.toBeNull();

    const ctrlButtons = navEl.querySelectorAll('.nav-ctrl-btn');
    expect(ctrlButtons).toHaveLength(3); // EXIF, Learn, About
  });

  it('creates mode buttons with correct labels and data-mode attributes', () => {
    makeNav();
    const modeButtons = navEl.querySelectorAll('.nav-mode-btn');
    for (let i = 0; i < MODE_ORDER.length; i++) {
      const btn = modeButtons[i] as HTMLButtonElement;
      const modeName = MODE_ORDER[i];
      expect(btn.textContent).toBe(MODE_LABELS[modeName]);
      expect(btn.dataset.mode).toBe(modeName);
    }
  });

  it('creates a nav-indicator element inside the modes container', () => {
    makeNav();
    const indicator = navEl.querySelector('.nav-indicator');
    expect(indicator).not.toBeNull();
  });

  it('calls onModeSwitch callback with the mode name when a mode button is clicked', () => {
    const onModeSwitch = vi.fn();
    makeNav({ onModeSwitch });

    const slideshowBtn = navEl.querySelector('[data-mode="slideshow"]') as HTMLButtonElement;
    slideshowBtn.click();
    expect(onModeSwitch).toHaveBeenCalledWith('slideshow');

    const stripBtn = navEl.querySelector('[data-mode="film-strip"]') as HTMLButtonElement;
    stripBtn.click();
    expect(onModeSwitch).toHaveBeenCalledWith('film-strip');
  });

  it('calls onToggleExif when the EXIF button is clicked', () => {
    const onToggleExif = vi.fn();
    makeNav({ onToggleExif });

    const ctrlButtons = navEl.querySelectorAll('.nav-ctrl-btn');
    const exifBtn = ctrlButtons[0] as HTMLButtonElement;
    expect(exifBtn.textContent).toBe('EXIF');
    exifBtn.click();
    expect(onToggleExif).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleLearn when the Learn button is clicked', () => {
    const onToggleLearn = vi.fn();
    makeNav({ onToggleLearn });

    const ctrlButtons = navEl.querySelectorAll('.nav-ctrl-btn');
    const learnBtn = ctrlButtons[1] as HTMLButtonElement;
    expect(learnBtn.textContent).toBe('Learn');
    learnBtn.click();
    expect(onToggleLearn).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenAbout when the About button is clicked', () => {
    const onOpenAbout = vi.fn();
    makeNav({ onOpenAbout });

    const ctrlButtons = navEl.querySelectorAll('.nav-ctrl-btn');
    const aboutBtn = ctrlButtons[2] as HTMLButtonElement;
    expect(aboutBtn.textContent).toBe('About');
    aboutBtn.click();
    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('setActiveMode adds "active" class to the matching button and removes from others', () => {
    const nav = makeNav();

    nav.setActiveMode('slideshow');
    const slideshowBtn = navEl.querySelector('[data-mode="slideshow"]') as HTMLButtonElement;
    const stripBtn = navEl.querySelector('[data-mode="film-strip"]') as HTMLButtonElement;
    expect(slideshowBtn.classList.contains('active')).toBe(true);
    expect(stripBtn.classList.contains('active')).toBe(false);

    nav.setActiveMode('film-strip');
    expect(slideshowBtn.classList.contains('active')).toBe(false);
    expect(stripBtn.classList.contains('active')).toBe(true);
  });

  it('setActiveMode only has one active button at a time', () => {
    const nav = makeNav();

    for (const mode of MODE_ORDER) {
      nav.setActiveMode(mode);
      const activeButtons = navEl.querySelectorAll('.nav-mode-btn.active');
      expect(activeButtons).toHaveLength(1);
      expect((activeButtons[0] as HTMLButtonElement).dataset.mode).toBe(mode);
    }
  });
});
