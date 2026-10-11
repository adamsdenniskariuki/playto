import { describe, expect, it } from 'vitest';
import { detectPitch, frequencyForMidi, noteName, pitchInfo } from '../../src/audio';

describe('single-note detector', () => {
  for (const rate of [44100, 48000]) for (const midi of [28, 40, 53, 60, 69, 84]) {
    it(`detects ${noteName(midi)} at ${rate} Hz sample rate`, () => {
      const frequency = frequencyForMidi(midi);
      const data = Float32Array.from({ length: 4096 }, (_, i) => Math.sin(2 * Math.PI * frequency * i / rate) * .3);
      const found = detectPitch(data, rate);
      expect(found).not.toBeNull();
      expect(Math.abs(pitchInfo(found!).cents)).toBeLessThan(5);
      expect(pitchInfo(found!).midi).toBe(midi);
    });
  }
  it('ignores silence and quiet input', () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    expect(detectPitch(Float32Array.from({ length: 4096 }, (_, i) => .001 * Math.sin(i)), 48000)).toBeNull();
  });
  it('rejects nonperiodic noise', () => {
    let seed = 1234;
    const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * .4 - .2; });
    expect(detectPitch(noise, 48000)).toBeNull();
  });
  it('handles harmonics and detuned strings', () => {
    const frequency = frequencyForMidi(40) * 2 ** (18 / 1200);
    const data = Float32Array.from({ length: 4096 }, (_, i) => .2 * Math.sin(2 * Math.PI * frequency * i / 48000) + .1 * Math.sin(4 * Math.PI * frequency * i / 48000));
    const info = pitchInfo(detectPitch(data, 48000)!);
    expect(info.midi).toBe(40);
    expect(info.cents).toBeGreaterThan(15);
    expect(info.cents).toBeLessThan(21);
  });
  it('maps standard pitch and octave correctly', () => {
    expect(noteName(60)).toBe('C4'); expect(frequencyForMidi(69)).toBe(440);
    expect(pitchInfo(440)).toMatchObject({ midi: 69, name: 'A4', cents: 0 });
  });
});
