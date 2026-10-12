import { NOTE_NAMES } from './audio';

const qualities = [
  { suffix: ' major', intervals: [0, 4, 7] },
  { suffix: ' minor', intervals: [0, 3, 7] },
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'add9', intervals: [0, 2, 4, 7] }
];
export const chordNames = NOTE_NAMES.flatMap(root => qualities.map(quality => root + quality.suffix));
export const CHORD_CONFIDENCE = 0.75;
export interface ChordReading { name: string | null; confidence: number }

export function spectrumChroma(spectrum: Float32Array, sampleRate: number, fftSize: number): number[] {
  const peaks: { frequency: number; power: number }[] = [];
  for (let bin = 2; bin < spectrum.length - 1; bin++) {
    const frequency = bin * sampleRate / fftSize;
    if (frequency < 65 || frequency > 1600 || spectrum[bin] < -65) continue;
    if (spectrum[bin] <= spectrum[bin - 1] || spectrum[bin] < spectrum[bin + 1]) continue;
    const left = spectrum[bin - 1], center = spectrum[bin], right = spectrum[bin + 1];
    const denominator = left - 2 * center + right;
    const offset = Number.isFinite(denominator) && denominator !== 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator)) : 0;
    peaks.push({ frequency: (bin + offset) * sampleRate / fftSize, power: 10 ** (center / 10) });
  }
  const chroma = Array<number>(12).fill(0);
  const maximum = Math.max(0, ...peaks.map(peak => peak.power));
  for (const peak of peaks) {
    if (peak.power < maximum * 0.025) continue;
    // Overtones of a stronger lower peak must not turn one note into a chord.
    if (peaks.some(lower => {
      const ratio = peak.frequency / lower.frequency, harmonic = Math.round(ratio);
      return harmonic >= 2 && harmonic <= 8 && lower.power > peak.power * 0.7
        && Math.abs(1200 * Math.log2(ratio / harmonic)) < 35;
    })) continue;
    const midi = 69 + 12 * Math.log2(peak.frequency / 440), rounded = Math.round(midi);
    if (Math.abs(midi - rounded) > 0.35) continue;
    chroma[((rounded % 12) + 12) % 12] += Math.sqrt(peak.power);
  }
  return chroma;
}

export function matchChroma(chroma: number[]): ChordReading {
  const maximum = Math.max(0, ...chroma);
  if (maximum === 0) return { name: null, confidence: 0 };
  const profile = chroma.map(value => value / maximum);
  if (profile.filter(value => value >= 0.18).length < 3) return { name: null, confidence: 0 };
  const norm = Math.sqrt(profile.reduce((sum, value) => sum + value * value, 0));
  const scores = NOTE_NAMES.flatMap((rootName, root) => qualities.map(quality => {
    const tones = quality.intervals.map(interval => (root + interval) % 12);
    const coverage = Math.min(...tones.map(tone => profile[tone]));
    const similarity = tones.reduce((sum, tone) => sum + profile[tone], 0) / (norm * Math.sqrt(tones.length));
    return { name: rootName + quality.suffix, score: coverage >= 0.18 ? similarity : 0 };
  })).sort((a, b) => b.score - a.score);
  const best = scores[0], margin = best.score - scores[1].score;
  const confidence = Math.max(0, Math.min(1, best.score * Math.min(1, margin / 0.12)));
  return { name: best.score > 0 ? best.name : null, confidence };
}

export function detectChord(spectrum: Float32Array, sampleRate: number, fftSize: number): ChordReading {
  return matchChroma(spectrumChroma(spectrum, sampleRate, fftSize));
}
