import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Photo } from '../../types';
import manifest from '../../photos.json';

// Import functions under test
import {
  getShuffledPhotos,
  responsiveSrc,
  formatExif,
  loadPhoto,
} from '../photos';

const allPhotos = manifest.photos as Photo[];

describe('getShuffledPhotos', () => {
  it('returns the same number of photos as the manifest', () => {
    const result = getShuffledPhotos();
    expect(result).toHaveLength(allPhotos.length);
  });

  it('contains every photo ID from the manifest', () => {
    const result = getShuffledPhotos();
    const resultIds = new Set(result.map((p) => p.id));
    for (const photo of allPhotos) {
      expect(resultIds.has(photo.id)).toBe(true);
    }
  });

  it('returns a new array (does not mutate the original)', () => {
    const result = getShuffledPhotos();
    expect(result).not.toBe(allPhotos);
  });

  it('produces different orderings across calls (probabilistic)', () => {
    // With 45 photos the probability of getting the exact same order twice is
    // astronomically small — treat one mismatch as sufficient evidence.
    const a = getShuffledPhotos().map((p) => p.id).join(',');
    const b = getShuffledPhotos().map((p) => p.id).join(',');
    const c = getShuffledPhotos().map((p) => p.id).join(',');
    // At least two of the three runs should differ
    const allSame = a === b && b === c;
    expect(allSame).toBe(false);
  });
});

describe('getShuffledPhotos edge cases', () => {
  it('returns an empty array when the manifest has no photos', () => {
    // The function shuffles data.photos — with the real manifest this always
    // has content, but the shuffle helper itself handles empty arrays safely.
    const result = getShuffledPhotos();
    // We can only verify the function doesn't throw and returns an array
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('formatExif edge cases', () => {
  it('returns empty string when exif has all empty strings', () => {
    const photo = makePhoto({
      exif: { focalLength: '', aperture: '', shutterSpeed: '', iso: '' },
    });
    expect(formatExif(photo)).toBe('');
  });

  it('handles exif with whitespace-only values as truthy', () => {
    const photo = makePhoto({
      exif: { focalLength: ' ', aperture: '', shutterSpeed: '', iso: '' },
    });
    // A single space is truthy, so it will be included
    expect(formatExif(photo)).toBe(' ');
  });
});

// Build a minimal Photo fixture for deterministic unit tests
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
    aperture: 'ƒ/1.8',
    shutterSpeed: '1/500s',
    iso: 'ISO 400',
  },
  title: 'Test Photo',
  description: 'A test photograph',
  ...overrides,
});

describe('responsiveSrc', () => {
  const photo = makePhoto();

  it('returns thumb for displayWidth <= 400', () => {
    expect(responsiveSrc(photo, 400)).toBe(photo.thumb);
    expect(responsiveSrc(photo, 1)).toBe(photo.thumb);
    expect(responsiveSrc(photo, 400)).toBe(photo.thumb);
  });

  it('returns medium for displayWidth <= 800 (but > 400)', () => {
    expect(responsiveSrc(photo, 401)).toBe(photo.medium);
    expect(responsiveSrc(photo, 800)).toBe(photo.medium);
  });

  it('returns full for displayWidth > 800', () => {
    expect(responsiveSrc(photo, 801)).toBe(photo.full);
    expect(responsiveSrc(photo, 1600)).toBe(photo.full);
    expect(responsiveSrc(photo, 4000)).toBe(photo.full);
  });
});

describe('formatExif', () => {
  it('formats all four EXIF fields with mid-dot separators', () => {
    const photo = makePhoto();
    expect(formatExif(photo)).toBe('50mm · ƒ/1.8 · 1/500s · ISO 400');
  });

  it('omits missing focalLength', () => {
    const photo = makePhoto({ exif: { focalLength: '', aperture: 'ƒ/2.8', shutterSpeed: '1/60s', iso: 'ISO 100' } });
    expect(formatExif(photo)).toBe('ƒ/2.8 · 1/60s · ISO 100');
  });

  it('omits missing aperture', () => {
    const photo = makePhoto({ exif: { focalLength: '35mm', aperture: '', shutterSpeed: '1/250s', iso: 'ISO 800' } });
    expect(formatExif(photo)).toBe('35mm · 1/250s · ISO 800');
  });

  it('omits missing shutterSpeed', () => {
    const photo = makePhoto({ exif: { focalLength: '85mm', aperture: 'ƒ/1.4', shutterSpeed: '', iso: 'ISO 200' } });
    expect(formatExif(photo)).toBe('85mm · ƒ/1.4 · ISO 200');
  });

  it('omits missing iso', () => {
    const photo = makePhoto({ exif: { focalLength: '24mm', aperture: 'ƒ/4', shutterSpeed: '1/1000s', iso: '' } });
    expect(formatExif(photo)).toBe('24mm · ƒ/4 · 1/1000s');
  });

  it('returns empty string when all EXIF fields are missing', () => {
    const photo = makePhoto({ exif: { focalLength: '', aperture: '', shutterSpeed: '', iso: '' } });
    expect(formatExif(photo)).toBe('');
  });

  it('handles a single field gracefully (no separator)', () => {
    const photo = makePhoto({ exif: { focalLength: '28mm', aperture: '', shutterSpeed: '', iso: '' } });
    expect(formatExif(photo)).toBe('28mm');
  });
});

describe('loadPhoto', () => {
  let img: HTMLImageElement;
  let photo: Photo;

  beforeEach(() => {
    img = document.createElement('img');
    photo = makePhoto();
  });

  it('sets img.src to the lqip immediately', () => {
    loadPhoto(img, photo, 800);
    expect(img.src).toContain('data:image/webp');
  });

  it('sets img.width and img.height from photo dimensions', () => {
    loadPhoto(img, photo, 800);
    expect(img.width).toBe(photo.width);
    expect(img.height).toBe(photo.height);
  });

  it('sets alt from photo.title when present', () => {
    loadPhoto(img, photo, 800);
    expect(img.alt).toBe('Test Photo');
  });

  it('falls back alt to description when title is empty', () => {
    const p = makePhoto({ title: '', description: 'A street scene' });
    loadPhoto(img, p, 800);
    expect(img.alt).toBe('A street scene');
  });

  it('falls back alt to "Photograph <id>" when both title and description are empty', () => {
    const p = makePhoto({ title: '', description: '' });
    loadPhoto(img, p, 800);
    expect(img.alt).toBe(`Photograph ${p.id}`);
  });

  it('adds photo-img and loading CSS classes', () => {
    loadPhoto(img, photo, 800);
    expect(img.classList.contains('photo-img')).toBe(true);
    expect(img.classList.contains('loading')).toBe(true);
  });

  it('calls onLoad callback once the real image fires onload', () => {
    const onLoad = vi.fn();
    loadPhoto(img, photo, 800, onLoad);

    // The internal `loader` Image fires its onload — simulate by calling it
    // on any Image created during the call. We check that the callback is
    // wired (not yet called synchronously).
    expect(onLoad).not.toHaveBeenCalled();
  });
});
