import type { Photo, PhotoManifest } from '../types';
import manifest from '../photos.json';

export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const data = manifest as PhotoManifest;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getShuffledPhotos(): Photo[] {
  return shuffle(data.photos);
}

export function responsiveSrc(photo: Photo, displayWidth: number): string {
  if (displayWidth <= 400) return photo.thumb;
  if (displayWidth <= 800) return photo.medium;
  return photo.full;
}

export function formatExif(photo: Photo): string {
  const parts = [
    photo.exif.focalLength,
    photo.exif.aperture,
    photo.exif.shutterSpeed,
    photo.exif.iso,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function loadPhoto(
  img: HTMLImageElement,
  photo: Photo,
  displayWidth: number,
  onLoad?: () => void,
): void {
  img.src = photo.lqip;
  img.width = photo.width;
  img.height = photo.height;
  img.alt = photo.title || photo.description || `Photograph ${photo.id}`;
  img.classList.add('photo-img', 'loading');

  const realSrc = responsiveSrc(photo, displayWidth);
  const loader = new Image();
  loader.src = realSrc;
  loader.onload = () => {
    img.src = realSrc;
    img.classList.remove('loading');
    img.classList.add('loaded');
    onLoad?.();
  };
}
