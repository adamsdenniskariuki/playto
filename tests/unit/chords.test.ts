import { describe, expect, it } from 'vitest';
import { detectChord, matchChroma } from '../../src/chords';
import { frequencyForMidi } from '../../src/audio';

function spectrum(notes: number[], harmonics = false) {
  const bins = new Float32Array(4096).fill(-100);
  for (const note of notes) {
    for (let harmonic = 1; harmonic <= (harmonics ? 5 : 1); harmonic++) {
      const bin = frequencyForMidi(note) * harmonic * 8192 / 48000;
      for (let offset = -1; offset <= 1; offset++) {
        const index = Math.round(bin) + offset;
        bins[index] = Math.max(bins[index], -20 - 20 * Math.log10(harmonic) - 16 * (index - bin) ** 2);
      }
    }
  }
  return bins;
}
describe('local chord confidence', () => {
  it.each([
    [[60,64,67], 'C major'], [[40,47,52,55,59,64], 'E minor'],
    [[57,61,64,67], 'A7'], [[60,64,67,71], 'Cmaj7'], [[62,65,69,72], 'Dm7'],
    [[48,52,55,62], 'Cadd9']
  ] as [number[], string][])('recognizes %s as %s', (notes, name) => {
    const result = detectChord(spectrum(notes, true), 48000, 8192);
    expect(result.name).toBe(name); expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });
  it('rejects silence, single tones, overtones and dyads', () => {
    for (const notes of [[], [60], [69], [60,67]]) expect(detectChord(spectrum(notes, true), 48000, 8192).confidence).toBeLessThan(0.75);
  });
  it('rejects broadband and ambiguous pitch classes', () => {
    expect(detectChord(new Float32Array(4096).fill(-30), 48000, 8192).name).toBeNull();
    expect(matchChroma(Array<number>(12).fill(1)).confidence).toBeLessThan(0.75);
  });
});
