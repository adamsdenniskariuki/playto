export type RhythmSource = 'mic' | 'midi' | 'tap';
export interface BeatClock { epoch: number; period: number }
export interface TimingHit { beat: number; offset: number; source: RhythmSource }
export function timingHit(time: number, clock: BeatClock, latency: number, source: RhythmSource): TimingHit {
  const corrected = time - latency;
  const beat = Math.round((corrected - clock.epoch) / clock.period);
  return { beat, offset: corrected - (clock.epoch + beat * clock.period), source };
}
export function timingSummary(hits: TimingHit[], expected: number) {
  const unique = new Set(hits.map(hit => hit.beat)).size;
  const extras = hits.length - unique;
  const credit = hits.reduce((sum, hit, index) => sum + (hits.findIndex(other => other.beat === hit.beat) === index ? Math.max(0, 1 - Math.abs(hit.offset) / 150) : 0), 0);
  return { accuracy: Math.round(100 * credit / Math.max(1, expected + extras)), missed: Math.max(0, expected - unique), extras };
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export class OnsetDetector {
  private previous = 0;
  private last = -Infinity;
  detect(samples: Float32Array, time: number): boolean {
    let energy = 0;
    const start = Math.max(0, samples.length - 512);
    for (let i = start; i < samples.length; i++) energy += samples[i] ** 2;
    const rms = Math.sqrt(energy / (samples.length - start));
    const onset = rms > 0.015 && rms > this.previous * 1.6 && rms - this.previous > 0.008 && time - this.last >= 100;
    this.previous = rms;
    if (onset) this.last = time;
    return onset;
  }
}
