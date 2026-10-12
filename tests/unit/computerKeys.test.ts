import { expect, it } from 'vitest';
import { fretColumns, pianoStart, PLAY_KEYS, playKeyIndex } from '../../src/computerKeys';
import { freshProgress, parseProgress } from '../../src/progress';

it('maps all displayed piano semitones and ignores unrelated keys', () => {
  expect(PLAY_KEYS.length).toBe(13);
  expect(PLAY_KEYS.map(playKeyIndex)).toEqual(Array.from({ length: 13 }, (_, index) => index));
  expect(playKeyIndex('A')).toBe(0); expect(playKeyIndex('Escape')).toBe(-1);
  expect(pianoStart(60)).toBe(60); expect(pianoStart(71)).toBe(60);
});
it('mirrors every fret without changing fret numbers', () => {
  expect(fretColumns(13, true)).toEqual(fretColumns(13, false).reverse());
  expect(fretColumns(25, true)[0]).toBe(24);
});
it('preserves handedness in backups and defaults old backups to right-handed', () => {
  const progress = freshProgress(); progress.settings.leftHanded = true;
  expect(parseProgress(JSON.stringify(progress)).settings.leftHanded).toBe(true);
  const legacy = JSON.parse(JSON.stringify(progress)); delete legacy.settings.leftHanded;
  expect(parseProgress(JSON.stringify(legacy)).settings.leftHanded).toBe(false);
  legacy.settings.leftHanded = 'yes';
  expect(() => parseProgress(JSON.stringify(legacy))).toThrow();
});
