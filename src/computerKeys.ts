export const PLAY_KEYS = ['a','w','s','e','d','f','t','g','y','h','u','j','k'];
export function playKeyIndex(key: string): number { return PLAY_KEYS.indexOf(key.toLowerCase()); }
export function pianoStart(target: number): number { return Math.max(24, Math.min(84, Math.floor(target / 12) * 12)); }
export function fretColumns(count: number, leftHanded: boolean): number[] {
  const frets = Array.from({ length: count }, (_, fret) => fret);
  return leftHanded ? frets.reverse() : frets;
}
