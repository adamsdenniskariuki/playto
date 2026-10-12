import { expect, it } from 'vitest';
import { evictedTakes, TAKE_BYTES, TAKE_COUNT } from '../../src/takes';

it('keeps the newest ten takes within the byte cap', () => {
  const takes = Array.from({ length: 12 }, (_, index) => ({ id: `${index}`, createdAt: index, blob: new Blob(['take']) }));
  expect(evictedTakes(takes)).toEqual(['1','0']);
  expect(TAKE_COUNT).toBe(10);
});
it('enforces device-wide bytes and prioritizes newest takes', () => {
  const blob = new Blob([new Uint8Array(TAKE_BYTES / 2)]);
  expect(evictedTakes([0,1,2].map(index => ({ id: `${index}`, createdAt: index, blob })))).toEqual(['0']);
});
