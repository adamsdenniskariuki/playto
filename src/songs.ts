import keyboard from '../content/keyboard/songs.json';
import guitar from '../content/guitar/songs.json';
import bass from '../content/bass/songs.json';
import sax from '../content/sax/songs.json';
import type { InstrumentId } from './types';

export interface ScoreEvent { note: number | null; beats: number }
export interface Song { id: string; title: string; tempo: number; roots: number[]; events: ScoreEvent[] }
export interface ReferenceScore { title: string; tempo: number; countIn: number; events: ScoreEvent[]; roots: number[]; transposition: number }
export const songs: Record<InstrumentId, Song[]> = { keyboard, guitar, bass, sax };
export function scoreTimeline(events: ScoreEvent[]) {
  let beat = 0;
  return events.map(event => { const start = beat; beat += event.beats; return { ...event, start, end: beat }; });
}
export function scorePosition(events: ScoreEvent[], beats: number, repeat: boolean): number {
  const timeline = scoreTimeline(events), duration = timeline.at(-1)?.end ?? 0;
  if (beats < 0 || duration === 0 || (!repeat && beats >= duration)) return -1;
  const position = repeat ? beats % duration : beats;
  return timeline.findIndex(event => position >= event.start && position < event.end);
}
