import type { Photo } from '../types';
import { formatExif } from '../lib/photos';

interface DetailView {
  open: (photos: Photo[], index: number) => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createDetailView(): DetailView {
  const el = document.getElementById('detail-view')!;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Photo detail view');

  let photos: Photo[] = [];
  let currentIndex = 0;
  let isVisible = false;
  let previousFocus: HTMLElement | null = null;

  el.innerHTML = `
    <div class="detail-backdrop"></div>
    <div class="detail-content" tabindex="-1">
      <img class="detail-img" />
      <div class="detail-info">
        <h3 class="detail-title"></h3>
        <p class="detail-desc"></p>
        <div class="detail-exif exif-container">
          <span class="exif detail-exif-text"></span>
        </div>
      </div>
    </div>
    <button class="detail-nav detail-prev" aria-label="Previous">‹</button>
    <button class="detail-nav detail-next" aria-label="Next">›</button>
  `;

  const backdrop = el.querySelector('.detail-backdrop') as HTMLElement;
  const img = el.querySelector('.detail-img') as HTMLImageElement;
  const titleEl = el.querySelector('.detail-title')!;
  const descEl = el.querySelector('.detail-desc')!;
  const exifEl = el.querySelector('.detail-exif-text')!;
  const prevBtn = el.querySelector('.detail-prev')!;
  const nextBtn = el.querySelector('.detail-next')!;

  function show(index: number): void {
    const photo = photos[index];
    if (!photo) return;
    currentIndex = index;

    img.src = photo.full;
    img.alt = photo.title || photo.description || `Photograph ${photo.id}`;
    img.width = photo.width;
    img.height = photo.height;

    titleEl.textContent = photo.title || '';
    descEl.textContent = photo.description || '';
    exifEl.textContent = formatExif(photo);

    prevBtn.classList.toggle('hidden', index === 0);
    nextBtn.classList.toggle('hidden', index === photos.length - 1);
  }

  function close(): void {
    if (!isVisible) return;
    isVisible = false;
    el.classList.remove('detail-visible');
    el.classList.add('detail-hidden');
    previousFocus?.focus();
    previousFocus = null;
  }

  backdrop.addEventListener('click', close);
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) show(currentIndex - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (currentIndex < photos.length - 1) show(currentIndex + 1);
  });

  document.addEventListener('keydown', (e) => {
    if (!isVisible) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && currentIndex > 0) show(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) show(currentIndex + 1);
  });

  return {
    open(p: Photo[], index: number) {
      previousFocus = document.activeElement as HTMLElement | null;
      photos = p;
      show(index);
      isVisible = true;
      el.classList.remove('detail-hidden');
      el.classList.add('detail-visible');
      // Move focus into the detail view so keyboard users can navigate
      (el.querySelector('.detail-content') as HTMLElement)?.focus();
    },
    close,
    isOpen: () => isVisible,
  };
}
