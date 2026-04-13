import { describe, it, expect } from 'vitest';
import { MODE_ORDER, MODE_LABELS, type ModeName } from './types';

describe('MODE_ORDER', () => {
  it('has exactly 5 entries', () => {
    expect(MODE_ORDER).toHaveLength(5);
  });

  it('contains the expected mode names', () => {
    const expected: ModeName[] = [
      'slideshow',
      'print-table',
      'film-strip',
      'wall-exhibition',
      'gallery-walk',
    ];
    expect(MODE_ORDER).toEqual(expected);
  });

  it('has no duplicate entries', () => {
    const unique = new Set(MODE_ORDER);
    expect(unique.size).toBe(MODE_ORDER.length);
  });
});

describe('MODE_LABELS', () => {
  it('has an entry for every ModeName in MODE_ORDER', () => {
    for (const mode of MODE_ORDER) {
      expect(MODE_LABELS).toHaveProperty(mode);
    }
  });

  it('has exactly as many entries as MODE_ORDER', () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(MODE_ORDER.length);
  });

  it('all label values are non-empty strings', () => {
    for (const [_mode, label] of Object.entries(MODE_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('has labels for each specific mode', () => {
    expect(MODE_LABELS['slideshow']).toBe('Slideshow');
    expect(MODE_LABELS['print-table']).toBe('Prints');
    expect(MODE_LABELS['film-strip']).toBe('Strip');
    expect(MODE_LABELS['wall-exhibition']).toBe('Wall');
    expect(MODE_LABELS['gallery-walk']).toBe('Gallery');
  });
});
