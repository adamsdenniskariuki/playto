import type { InstrumentId, Lesson, PracticeResult, Progress, WeakKind } from './types';
import { DEFAULT_FONT, DEFAULT_THEME, isFont, isTheme } from './appearance';

export const STORAGE_KEY = 'playto.progress.v1';
export const instrumentIds: InstrumentId[] = ['keyboard', 'guitar', 'bass', 'sax'];
export function freshProgress(): Progress {
  return {
    version: 2, xp: 0, streak: 0, lastPractice: null, freezes: 1, instrument: 'keyboard',
    settings: { theme: DEFAULT_THEME, font: DEFAULT_FONT, themeChosen: false, fontChosen: false, tourSeen: false, leftHanded: false },
    instruments: {
      keyboard: { lessons: {}, minutes: 0, notes: 0, chords: [], tempo: 0, weak: {}, ladders: {}, planner: { day: null, seconds: [0,0,0,0] } },
      guitar: { lessons: {}, minutes: 0, notes: 0, chords: [], tempo: 0, weak: {}, ladders: {}, planner: { day: null, seconds: [0,0,0,0] } },
      bass: { lessons: {}, minutes: 0, notes: 0, chords: [], tempo: 0, weak: {}, ladders: {}, planner: { day: null, seconds: [0,0,0,0] } },
      sax: { lessons: {}, minutes: 0, notes: 0, chords: [], tempo: 0, weak: {}, ladders: {}, planner: { day: null, seconds: [0,0,0,0] } }
    }
  };
}
export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dayNumber(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date) / 86400000;
}
export function currentStreak(progress: Progress, date = new Date()): number {
  if (!progress.lastPractice) return 0;
  const gap = dayNumber(dayKey(date)) - dayNumber(progress.lastPractice);
  return gap <= 1 || (gap === 2 && progress.freezes > 0) ? progress.streak : 0;
}
export function practiceDay(progress: Progress, date = new Date()): Progress {
  const next = structuredClone(progress);
  const today = dayKey(date);
  if (next.lastPractice === today) return next;
  const gap = next.lastPractice ? dayNumber(today) - dayNumber(next.lastPractice) : Infinity;
  if (gap === 1) next.streak += 1;
  else if (gap === 2 && next.freezes > 0) { next.freezes -= 1; next.streak += 1; }
  else if (gap > 1) next.streak = 1;
  next.lastPractice = today;
  if (next.streak % 7 === 0) next.freezes = Math.min(2, next.freezes + 1);
  return next;
}
export function completeLesson(progress: Progress, instrument: InstrumentId, lesson: Lesson, date = new Date()): Progress {
  const next = practiceDay(progress, date);
  if (next.instruments[instrument].lessons[lesson.id]) return next;
  next.instruments[instrument].lessons[lesson.id] = {
    completedAt: date.toISOString(), reviewAt: new Date(date.getTime() + 86400000).toISOString(),
    interval: 1, reviews: 0
  };
  for (const chord of [...(lesson.chords ?? []), ...(lesson.chord ? [lesson.chord] : [])]) {
    if (!next.instruments[instrument].chords.includes(chord)) next.instruments[instrument].chords.push(chord);
  }
  next.xp += lesson.kind === 'stage-test' ? 100 : lesson.kind === 'checkpoint' ? 75 : 50;
  return next;
}
export function reviewLesson(progress: Progress, instrument: InstrumentId, lessonId: string, easy: boolean, date = new Date()): Progress {
  const next = practiceDay(progress, date);
  const record = next.instruments[instrument].lessons[lessonId];
  if (!record) throw new Error('Complete the lesson before reviewing it.');
  if (new Date(record.reviewAt) > date) return next;
  record.interval = easy ? Math.min(60, record.interval * 2) : 1;
  record.reviewAt = new Date(date.getTime() + record.interval * 86400000).toISOString();
  record.reviews += 1;
  next.xp += 15;
  return next;
}
export function addPractice(progress: Progress, instrument: InstrumentId, seconds: number, notes: number, tempo: number): Progress {
  if (seconds < 1 && notes < 1) return structuredClone(progress);
  const next = practiceDay(progress);
  const item = next.instruments[instrument];
  item.minutes += Math.max(0, seconds) / 60;
  item.notes += Math.max(0, Math.floor(notes));
  item.tempo = Math.max(item.tempo, tempo);
  next.xp += Math.min(20, Math.floor(seconds / 60) * 2);
  return next;
}
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9;
const integer = (value: unknown): value is number => count(value) && Number.isInteger(value);
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeKey = (key: string) => /^[a-z0-9-]+$/.test(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
export function parseProgress(text: string): Progress {
  if (text.length > 2_000_000) throw new Error('Backup is too large (maximum 2 MB).');
  const raw: unknown = JSON.parse(text);
  if (!object(raw) || ![1, 2].includes(Number(raw.version)) || typeof raw.version !== 'number' || !integer(raw.xp) || !integer(raw.streak) ||
      !integer(raw.freezes) || raw.freezes > 2 || !instrumentIds.includes(raw.instrument as InstrumentId) ||
      !(raw.lastPractice === null || (typeof raw.lastPractice === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastPractice) && validDate(raw.lastPractice) && dayKey(new Date(`${raw.lastPractice}T12:00:00`)) === raw.lastPractice)) ||
      !object(raw.settings) || !isTheme(raw.settings.theme) || !isFont(raw.settings.font) ||
      (raw.settings.themeChosen !== undefined && typeof raw.settings.themeChosen !== 'boolean') ||
      (raw.settings.fontChosen !== undefined && typeof raw.settings.fontChosen !== 'boolean') ||
      (raw.settings.leftHanded !== undefined && typeof raw.settings.leftHanded !== 'boolean') ||
      typeof raw.settings.tourSeen !== 'boolean' ||
      !object(raw.instruments)) throw new Error('This is not a valid Playto v1/v2 backup.');
  const result = freshProgress();
  result.xp = raw.xp; result.streak = raw.streak; result.freezes = raw.freezes;
  result.instrument = raw.instrument as InstrumentId; result.lastPractice = raw.lastPractice as string | null;
  // Legacy system/native values are treated as untouched defaults for this migration.
  const themeChosen = raw.settings.themeChosen ?? raw.settings.theme !== 'system';
  const fontChosen = raw.settings.fontChosen ?? raw.settings.font !== 'default';
  result.settings = {
    theme: themeChosen ? raw.settings.theme : DEFAULT_THEME,
    font: fontChosen ? raw.settings.font : DEFAULT_FONT,
    themeChosen, fontChosen, tourSeen: raw.settings.tourSeen, leftHanded: raw.settings.leftHanded ?? false
  };
  for (const id of instrumentIds) {
    const data = raw.instruments[id];
    if (data === undefined) continue;
    if (!object(data) || !object(data.lessons) || !count(data.minutes) || !integer(data.notes) ||
      !count(data.tempo) || data.tempo > 240 || !Array.isArray(data.chords) ||
      !data.chords.every(chord => typeof chord === 'string' && chord.length < 80) ||
      Object.keys(data.lessons).length > 10000) throw new Error(`Invalid ${id} progress in backup.`);
    const lessons: Progress['instruments']['keyboard']['lessons'] = {};
    for (const [key, record] of Object.entries(data.lessons)) {
      if (!safeKey(key) || !object(record) || !validDate(record.completedAt) ||
        !validDate(record.reviewAt) || !integer(record.interval) || record.interval < 1 ||
        record.interval > 60 || !integer(record.reviews)) throw new Error('Invalid lesson review record.');
      lessons[key] = { completedAt: record.completedAt, reviewAt: record.reviewAt, interval: record.interval, reviews: record.reviews };
    }
    const weak: Progress['instruments']['keyboard']['weak'] = {};
    const ladders: Progress['instruments']['keyboard']['ladders'] = {};
    if (raw.version === 2) {
      if (!object(data.weak) || !object(data.ladders) || Object.keys(data.weak).length > 10000) throw new Error('Invalid practice records.');
      for (const [key, item] of Object.entries(data.weak)) {
        if (!safeKey(key) || !object(item) || typeof item.lessonId !== 'string' || !safeKey(item.lessonId) ||
          !['note','chord','rhythm'].includes(String(item.kind)) || typeof item.label !== 'string' || item.label.length > 200 ||
          !Array.isArray(item.notes) || item.notes.length === 0 || item.notes.length > 128 || !item.notes.every(note => integer(note) && note <= 127) ||
          !integer(item.mistakes) || !integer(item.interval) || item.interval < 1 || item.interval > 60 ||
          !integer(item.reviews) || !validDate(item.reviewAt)) throw new Error('Invalid weak-skill record.');
        weak[key] = { lessonId: item.lessonId, kind: item.kind as WeakKind, label: item.label, notes: item.notes as number[],
          mistakes: item.mistakes, interval: item.interval, reviews: item.reviews, reviewAt: item.reviewAt };
      }
      for (const [key, tempos] of Object.entries(data.ladders)) {
        if (!safeKey(key) || !Array.isArray(tempos) || tempos.length > 20 || !tempos.every(bpm => integer(bpm) && bpm >= 30 && bpm <= 180) || new Set(tempos).size !== tempos.length) throw new Error('Invalid tempo ladder.');
        ladders[key] = [...tempos] as number[];
      }
    }
    let planner: Progress['instruments']['keyboard']['planner'] = { day: null, seconds: [0,0,0,0] };
    if (data.planner !== undefined) {
      if (!object(data.planner) || !(data.planner.day === null || (typeof data.planner.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.planner.day) && validDate(data.planner.day))) ||
        !Array.isArray(data.planner.seconds) || data.planner.seconds.length !== 4 || !data.planner.seconds.every(value => integer(value) && value <= 86400)) throw new Error('Invalid daily planner record.');
      planner = { day: data.planner.day as string | null, seconds: [...data.planner.seconds] as number[] };
    }
    result.instruments[id] = { lessons, minutes: data.minutes, notes: data.notes, chords: [...data.chords] as string[], tempo: data.tempo, weak, ladders, planner };
  }
  return result;
}
export function recordMistake(progress: Progress, instrument: InstrumentId, lessonId: string, kind: WeakKind, label: string, notes: number[], date = new Date()): Progress {
  const next = structuredClone(progress);
  const key = `${lessonId}-${kind}-${notes.join('-')}`;
  const existing = next.instruments[instrument].weak[key];
  next.instruments[instrument].weak[key] = {
    lessonId, kind, label, notes, mistakes: (existing?.mistakes ?? 0) + 1,
    interval: 1, reviews: existing?.reviews ?? 0, reviewAt: date.toISOString()
  };
  return next;
}
export function reviewWeak(progress: Progress, instrument: InstrumentId, key: string, confident: boolean, date = new Date()): Progress {
  const next = practiceDay(progress, date);
  const item = next.instruments[instrument].weak[key];
  if (!item) throw new Error('This weak-skill review no longer exists.');
  if (Date.parse(item.reviewAt) > date.getTime()) return next;
  item.interval = confident ? Math.min(60, item.interval * 2) : 1;
  item.reviewAt = new Date(date.getTime() + item.interval * 86400000).toISOString();
  item.reviews++;
  next.xp += 10;
  return next;
}
export function savePracticeResult(progress: Progress, instrument: InstrumentId, lesson: Lesson | undefined, result: PracticeResult): Progress {
  let next = addPractice(progress, instrument, result.seconds, result.notes, result.tempo);
  if (lesson) {
    for (const mistake of result.mistakes) next = recordMistake(next, instrument, lesson.id, mistake.kind, mistake.label, mistake.notes);
    if (result.seconds >= 30 && result.ladderTempo && result.tempo === result.ladderTempo && lesson.tempoLadder?.includes(result.ladderTempo)) {
      const passed = next.instruments[instrument].ladders[lesson.id] ?? [];
      const target = lesson.tempoLadder.find(bpm => !passed.includes(bpm));
      if (target === result.ladderTempo) next.instruments[instrument].ladders[lesson.id] = [...passed, target];
    }
  }
  return next;
}
export function saveRoutineResult(progress: Progress, instrument: InstrumentId, lesson: Lesson, result: PracticeResult, step: number): Progress {
  if (!Number.isInteger(step) || step < 0 || step > 3) throw new Error('Invalid routine step.');
  const next = savePracticeResult(progress, instrument, lesson, result);
  const today = dayKey(), record = next.instruments[instrument];
  if (record.planner.day !== today) record.planner = { day: today, seconds: [0,0,0,0] };
  record.planner.seconds[step] = Math.min(86400, record.planner.seconds[step] + Math.max(0, Math.floor(result.seconds)));
  return next;
}
export function badges(progress: Progress): { name: string; earned: boolean; detail: string }[] {
  const records = Object.values(progress.instruments);
  return [
    { name: 'First sound', earned: records.some(item => Object.keys(item.lessons).length > 0), detail: 'Finish your first lesson' },
    { name: 'On a roll', earned: progress.streak >= 3, detail: 'Practise on three consecutive days' },
    { name: 'Time well played', earned: records.reduce((sum, item) => sum + item.minutes, 0) >= 60, detail: 'Practise for 60 minutes' },
    { name: 'Multi-instrumentalist', earned: records.filter(item => Object.keys(item.lessons).length > 0).length >= 2, detail: 'Complete lessons on two instruments' },
    { name: 'Note explorer', earned: records.reduce((sum, item) => sum + item.notes, 0) >= 100, detail: 'Match 100 notes using mic, MIDI or on-screen practice' }
  ];
}
