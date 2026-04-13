import { describe, it, expect } from 'vitest';
import { LEARN_CONTENT } from '../content';
import { MODE_ORDER, type ModeName } from '../../types';

describe('LEARN_CONTENT', () => {
  it('has an entry for every mode in MODE_ORDER', () => {
    for (const mode of MODE_ORDER) {
      expect(LEARN_CONTENT).toHaveProperty(mode);
    }
  });

  it('has exactly 5 entries (one per mode)', () => {
    expect(Object.keys(LEARN_CONTENT)).toHaveLength(5);
  });

  it('has no extra keys beyond the known modes', () => {
    const modeSet = new Set<string>(MODE_ORDER);
    for (const key of Object.keys(LEARN_CONTENT)) {
      expect(modeSet.has(key)).toBe(true);
    }
  });

  const requiredFields = ['title', 'description', 'howItWorks', 'whyHiC', 'keyCode'] as const;

  for (const mode of MODE_ORDER) {
    describe(`mode: ${mode}`, () => {
      it('has all required fields', () => {
        const entry = LEARN_CONTENT[mode as ModeName];
        for (const field of requiredFields) {
          expect(entry).toHaveProperty(field);
        }
      });

      it('has no empty strings in required fields', () => {
        const entry = LEARN_CONTENT[mode as ModeName];
        for (const field of requiredFields) {
          expect(
            entry[field].trim().length,
            `${mode}.${field} must not be empty`,
          ).toBeGreaterThan(0);
        }
      });

      it('title is a plain string (no leading/trailing whitespace)', () => {
        const { title } = LEARN_CONTENT[mode as ModeName];
        expect(title).toBe(title.trim());
      });

      it('keyCode contains at least one line of code', () => {
        const { keyCode } = LEARN_CONTENT[mode as ModeName];
        expect(keyCode.trim().length).toBeGreaterThan(0);
      });
    });
  }
});
