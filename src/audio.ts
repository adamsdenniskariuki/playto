export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const frequencyForMidi = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const noteName = (midi: number) => `${NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;
export function pitchInfo(frequency: number) {
  const value = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(value);
  return { midi, name: noteName(midi), cents: Math.round((value - midi) * 100), frequency };
}

// YIN's normalized difference rejects quiet noise and handles low bass notes.
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  const half = Math.floor(samples.length / 2);
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  if (Math.sqrt(energy / samples.length) < 0.01) return null;
  const maxLag = Math.min(half - 1, Math.floor(sampleRate / 35));
  const minLag = Math.max(2, Math.floor(sampleRate / 1600));
  const difference = new Float32Array(maxLag + 1);
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) { const delta = samples[i] - samples[i + lag]; sum += delta * delta; }
    running += sum;
    difference[lag] = running > 0 ? sum * lag / running : 1;
    if (lag >= minLag && difference[lag] < 0.12 && difference[lag] > difference[lag - 1]) {
      const tau = lag - 1;
      const left = difference[tau - 1], center = difference[tau], right = difference[tau + 1];
      const denominator = 2 * (2 * center - right - left);
      const refined = denominator === 0 ? tau : tau + (right - left) / denominator;
      return sampleRate / refined;
    }
  }
  return null;
}
export class AudioEngine {
  private context: AudioContext | null = null;
  private voices = new Map<OscillatorNode, GainNode>();
  async ready(): Promise<AudioContext> {
    if (!this.context || this.context.state === 'closed') this.context = new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }
  async note(midi: number, seconds = 0.45, delay = 0, volume = 0.12): Promise<void> {
    const context = await this.ready();
    this.noteAt(midi, seconds, context.currentTime + delay, volume);
  }
  noteAt(midi: number, seconds: number, start: number, volume = 0.12): void {
    const context = this.context;
    if (!context || context.state === 'closed') throw new Error('Prepare audio before scheduling notes.');
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequencyForMidi(midi);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain); gain.connect(context.destination);
    this.voices.set(oscillator, gain);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
    oscillator.start(start); oscillator.stop(start + seconds + 0.025);
  }
  async pattern(notes: number[], tempo: number): Promise<void> {
    await this.ready();
    for (const [index, midi] of notes.entries()) await this.note(midi, 60 / tempo * 0.85, index * 60 / tempo);
  }
  stop() {
    for (const [voice, gain] of this.voices) { voice.onended = null; voice.stop(); voice.disconnect(); gain.disconnect(); }
    this.voices.clear();
  }
  async dispose(): Promise<void> {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
export const audio = new AudioEngine();
