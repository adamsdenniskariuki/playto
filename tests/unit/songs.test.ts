import { expect, it } from 'vitest';
import { scorePosition, scoreTimeline, songs } from '../../src/songs';

it('uses explicit half-beat, held and rest events with correct boundaries and loops', () => {
  const events = [{ note: 60, beats: 0.5 }, { note: null, beats: 1 }, { note: 64, beats: 2 }];
  expect(scoreTimeline(events).map(event => event.start)).toEqual([0,0.5,1.5]);
  expect(scorePosition(events, -1, true)).toBe(-1);
  expect(scorePosition(events, 0.5, false)).toBe(1);
  expect(scorePosition(events, 3.5, false)).toBe(-1);
  expect(scorePosition(events, 3.5, true)).toBe(0);
});
it('registers valid original timed JSON pieces for every instrument', () => {
  for (const list of Object.values(songs)) for (const song of list) {
    expect(song.title).toContain('original');
    expect(song.tempo).toBeGreaterThanOrEqual(40);
    expect(scoreTimeline(song.events).at(-1)?.end).toBe(16);
    expect(song.events.some(event => event.note === null)).toBe(true);
    expect(song.events.every(event => event.beats > 0 && (event.note === null || Number.isInteger(event.note)))).toBe(true);
  }
});
