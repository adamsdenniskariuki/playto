import { expect, it } from 'vitest';
import { median, OnsetDetector, timingHit, timingSummary } from '../../src/rhythm';

it('reports early/late ms after source latency correction', () => {
  const clock = { epoch: 1000, period: 500 };
  expect(timingHit(1530, clock, 50, 'midi')).toEqual({ beat: 1, offset: -20, source: 'midi' });
  expect(timingHit(2060, clock, 10, 'mic').offset).toBe(50);
});
it('penalizes missed, extra and inaccurate attacks', () => {
  const clock = { epoch: 1000, period: 500 };
  expect(timingSummary([1000,1500,2000,2500].map(time => timingHit(time, clock, 0, 'tap')), 4).accuracy).toBe(100);
  const result = timingSummary([1000,1500,1530].map(time => timingHit(time, clock, 0, 'tap')), 4);
  expect(result).toEqual({ accuracy: 40, missed: 2, extras: 1 });
});
it('calibrates outliers using the median', () => {
  expect(median([40,45,41,300,39,42,43,44])).toBe(42.5);
});
it('detects attacks but not silence or sustained tones', () => {
  const detector = new OnsetDetector();
  const quiet = new Float32Array(1024), loud = new Float32Array(1024).fill(0.1);
  expect(detector.detect(quiet, 0)).toBe(false);
  expect(detector.detect(loud, 20)).toBe(true);
  expect(detector.detect(loud, 180)).toBe(false);
  detector.detect(quiet, 200);
  expect(detector.detect(loud, 220)).toBe(true);
  detector.detect(quiet, 240);
  expect(detector.detect(loud, 250)).toBe(false);
});
