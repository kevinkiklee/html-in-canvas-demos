import { describe, it, expect, beforeEach } from 'vitest';
import { createDetailView } from '../detail';
import type { Photo } from '../../types';

const makePhoto = (overrides: Partial<Photo> = {}): Photo => ({
  id: 'test-001',
  src: 'photographs/test-001.jpg',
  thumb: 'photographs/thumb/test-001.webp',
  medium: 'photographs/med/test-001.webp',
  full: 'photographs/full/test-001.webp',
  lqip: 'data:image/webp;base64,ABC=',
  width: 3000,
  height: 2000,
  exif: {
    focalLength: '50mm',
    aperture: '\u0192/1.8',
    shutterSpeed: '1/500s',
    iso: 'ISO 400',
  },
  title: 'Test Photo',
  description: 'A test photograph',
  ...overrides,
});

describe('createDetailView', () => {
  let detailEl: HTMLElement;

  beforeEach(() => {
    detailEl = document.createElement('div');
    detailEl.id = 'detail-view';
    detailEl.className = 'detail-hidden';
    document.body.innerHTML = '';
    document.body.appendChild(detailEl);
  });

  it('returns an object with open, close, and isOpen functions', () => {
    const view = createDetailView();
    expect(view).toHaveProperty('open');
    expect(view).toHaveProperty('close');
    expect(view).toHaveProperty('isOpen');
    expect(typeof view.open).toBe('function');
    expect(typeof view.close).toBe('function');
    expect(typeof view.isOpen).toBe('function');
  });

  it('creates expected DOM structure', () => {
    createDetailView();
    expect(detailEl.querySelector('.detail-backdrop')).not.toBeNull();
    expect(detailEl.querySelector('.detail-content')).not.toBeNull();
    expect(detailEl.querySelector('.detail-img')).not.toBeNull();
    expect(detailEl.querySelector('.detail-title')).not.toBeNull();
    expect(detailEl.querySelector('.detail-desc')).not.toBeNull();
    expect(detailEl.querySelector('.detail-exif-text')).not.toBeNull();
    expect(detailEl.querySelector('.detail-prev')).not.toBeNull();
    expect(detailEl.querySelector('.detail-next')).not.toBeNull();
  });

  it('open sets the visible photo and adds detail-visible class', () => {
    const view = createDetailView();
    const photos = [makePhoto({ id: 'p1', title: 'First' }), makePhoto({ id: 'p2', title: 'Second' })];

    view.open(photos, 0);

    expect(detailEl.classList.contains('detail-visible')).toBe(true);
    expect(detailEl.classList.contains('detail-hidden')).toBe(false);
    expect(view.isOpen()).toBe(true);

    const img = detailEl.querySelector('.detail-img') as HTMLImageElement;
    expect(img.src).toContain('photographs/full/test-001.webp');

    const title = detailEl.querySelector('.detail-title')!;
    expect(title.textContent).toBe('First');
  });

  it('open at specific index shows the correct photo', () => {
    const view = createDetailView();
    const photos = [
      makePhoto({ id: 'p1', title: 'First' }),
      makePhoto({ id: 'p2', title: 'Second', full: 'photographs/full/p2.webp' }),
    ];

    view.open(photos, 1);

    const title = detailEl.querySelector('.detail-title')!;
    expect(title.textContent).toBe('Second');
  });

  it('close hides the panel', () => {
    const view = createDetailView();
    const photos = [makePhoto()];

    view.open(photos, 0);
    expect(view.isOpen()).toBe(true);

    view.close();
    expect(view.isOpen()).toBe(false);
    expect(detailEl.classList.contains('detail-hidden')).toBe(true);
    expect(detailEl.classList.contains('detail-visible')).toBe(false);
  });

  it('close is a no-op when already closed', () => {
    const view = createDetailView();
    expect(view.isOpen()).toBe(false);
    // Should not throw
    view.close();
    expect(view.isOpen()).toBe(false);
  });

  it('isOpen returns false initially', () => {
    const view = createDetailView();
    expect(view.isOpen()).toBe(false);
  });

  it('hides prev button on first photo and next button on last photo', () => {
    const view = createDetailView();
    const photos = [
      makePhoto({ id: 'p1', title: 'First' }),
      makePhoto({ id: 'p2', title: 'Second' }),
      makePhoto({ id: 'p3', title: 'Third' }),
    ];

    // At first photo — prev should be hidden
    view.open(photos, 0);
    const prevBtn = detailEl.querySelector('.detail-prev')!;
    const nextBtn = detailEl.querySelector('.detail-next')!;
    expect(prevBtn.classList.contains('hidden')).toBe(true);
    expect(nextBtn.classList.contains('hidden')).toBe(false);

    // At last photo — next should be hidden
    view.open(photos, 2);
    expect(prevBtn.classList.contains('hidden')).toBe(false);
    expect(nextBtn.classList.contains('hidden')).toBe(true);
  });

  it('backdrop click closes the panel', () => {
    const view = createDetailView();
    view.open([makePhoto()], 0);
    expect(view.isOpen()).toBe(true);

    const backdrop = detailEl.querySelector('.detail-backdrop') as HTMLElement;
    backdrop.click();
    expect(view.isOpen()).toBe(false);
  });

  it('prev button navigates to previous photo', () => {
    const view = createDetailView();
    const photos = [
      makePhoto({ id: 'p1', title: 'First' }),
      makePhoto({ id: 'p2', title: 'Second' }),
    ];

    view.open(photos, 1);
    expect(detailEl.querySelector('.detail-title')!.textContent).toBe('Second');

    const prevBtn = detailEl.querySelector('.detail-prev') as HTMLButtonElement;
    prevBtn.click();
    expect(detailEl.querySelector('.detail-title')!.textContent).toBe('First');
  });

  it('next button navigates to next photo', () => {
    const view = createDetailView();
    const photos = [
      makePhoto({ id: 'p1', title: 'First' }),
      makePhoto({ id: 'p2', title: 'Second' }),
    ];

    view.open(photos, 0);
    expect(detailEl.querySelector('.detail-title')!.textContent).toBe('First');

    const nextBtn = detailEl.querySelector('.detail-next') as HTMLButtonElement;
    nextBtn.click();
    expect(detailEl.querySelector('.detail-title')!.textContent).toBe('Second');
  });

  it('displays EXIF data for the current photo', () => {
    const view = createDetailView();
    const photos = [makePhoto()];

    view.open(photos, 0);

    const exifEl = detailEl.querySelector('.detail-exif-text')!;
    expect(exifEl.textContent).toContain('50mm');
    expect(exifEl.textContent).toContain('ISO 400');
  });
});
