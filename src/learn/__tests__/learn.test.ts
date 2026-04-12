import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLearnDrawer } from '../learn';
import { LEARN_CONTENT } from '../content';

describe('createLearnDrawer', () => {
  let drawerEl: HTMLElement;

  beforeEach(() => {
    drawerEl = document.createElement('aside');
    drawerEl.id = 'learn-drawer';
    drawerEl.className = 'drawer-closed';
    document.body.innerHTML = '';
    document.body.appendChild(drawerEl);
    localStorage.clear();
  });

  it('returns an object with toggle and setMode functions', () => {
    const drawer = createLearnDrawer();
    expect(drawer).toHaveProperty('toggle');
    expect(drawer).toHaveProperty('setMode');
    expect(typeof drawer.toggle).toBe('function');
    expect(typeof drawer.setMode).toBe('function');
  });

  it('creates the expected internal DOM structure', () => {
    createLearnDrawer();
    expect(drawerEl.querySelector('.learn-header')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-body')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-title')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-desc')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-how')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-why')).not.toBeNull();
    expect(drawerEl.querySelector('.learn-code code')).not.toBeNull();
  });

  it('defaults to open when localStorage has no entry', () => {
    // When localStorage.getItem('learn-drawer') is null, null !== 'closed'
    // evaluates to true, so the drawer initializes as open.
    createLearnDrawer();
    expect(drawerEl.classList.contains('drawer-open')).toBe(true);
    expect(drawerEl.classList.contains('drawer-closed')).toBe(false);
  });

  it('toggle closes an open drawer', () => {
    // Defaults to open (localStorage is clear)
    const drawer = createLearnDrawer();
    expect(drawerEl.classList.contains('drawer-open')).toBe(true);

    drawer.toggle(); // close
    expect(drawerEl.classList.contains('drawer-closed')).toBe(true);
    expect(drawerEl.classList.contains('drawer-open')).toBe(false);
  });

  it('toggle opens a closed drawer', () => {
    localStorage.setItem('learn-drawer', 'closed');
    const drawer = createLearnDrawer();
    expect(drawerEl.classList.contains('drawer-closed')).toBe(true);

    drawer.toggle(); // open
    expect(drawerEl.classList.contains('drawer-open')).toBe(true);
    expect(drawerEl.classList.contains('drawer-closed')).toBe(false);
  });

  it('toggle persists state to localStorage', () => {
    // Starts open by default
    const drawer = createLearnDrawer();
    drawer.toggle(); // close
    expect(localStorage.getItem('learn-drawer')).toBe('closed');

    drawer.toggle(); // open
    expect(localStorage.getItem('learn-drawer')).toBe('open');
  });

  it('initializes as open when localStorage says it was not closed', () => {
    localStorage.setItem('learn-drawer', 'open');
    createLearnDrawer();
    expect(drawerEl.classList.contains('drawer-open')).toBe(true);
    expect(drawerEl.classList.contains('drawer-closed')).toBe(false);
  });

  it('initializes as closed when localStorage says closed', () => {
    localStorage.setItem('learn-drawer', 'closed');
    createLearnDrawer();
    expect(drawerEl.classList.contains('drawer-closed')).toBe(true);
  });

  it('setMode updates title, description, and code content after timeout', async () => {
    vi.useFakeTimers();
    const drawer = createLearnDrawer();

    drawer.setMode('album');

    // Content is updated after 150ms timeout
    vi.advanceTimersByTime(200);

    const titleEl = drawerEl.querySelector('.learn-title')!;
    const descEl = drawerEl.querySelector('.learn-desc')!;
    const codeEl = drawerEl.querySelector('.learn-code code')!;

    expect(titleEl.textContent).toBe(LEARN_CONTENT.album.title);
    expect(descEl.textContent).toBe(LEARN_CONTENT.album.description);
    expect(codeEl.textContent).toBe(LEARN_CONTENT.album.keyCode);

    vi.useRealTimers();
  });

  it('setMode sets body opacity to 0 then restores to 1 after delay', () => {
    vi.useFakeTimers();
    const drawer = createLearnDrawer();
    const bodyEl = drawerEl.querySelector('.learn-body') as HTMLElement;

    drawer.setMode('collage');
    expect(bodyEl.style.opacity).toBe('0');

    vi.advanceTimersByTime(200);
    expect(bodyEl.style.opacity).toBe('1');

    vi.useRealTimers();
  });

  it('setMode can switch between modes', () => {
    vi.useFakeTimers();
    const drawer = createLearnDrawer();

    drawer.setMode('album');
    vi.advanceTimersByTime(200);
    expect(drawerEl.querySelector('.learn-title')!.textContent).toBe('Album');

    drawer.setMode('collage');
    vi.advanceTimersByTime(200);
    expect(drawerEl.querySelector('.learn-title')!.textContent).toBe('Collage');

    vi.useRealTimers();
  });
});
