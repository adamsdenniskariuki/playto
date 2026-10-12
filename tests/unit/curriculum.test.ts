import { describe, it, expect } from 'vitest';
import { courses } from '../../src/courses';
import { availableLesson, stageBadges, stages } from '../../src/curriculum';
import { completeLesson, freshProgress, parseProgress, recordMistake, reviewWeak, savePracticeResult } from '../../src/progress';
import keyboard from '../../content/keyboard/course.json' with { type: 'json' };
import guitar from '../../content/guitar/course.json' with { type: 'json' };
import bass from '../../content/bass/course.json' with { type: 'json' };
import sax from '../../content/sax/course.json' with { type: 'json' };

describe('full-depth curriculum', () => {
  for (const course of courses.filter(item => item.units)) {
    it(`${course.id} has four seven-lesson units and a test per stage, preserving all IDs`, () => {
      expect(course.units).toHaveLength(12);
      const base = { keyboard, guitar, bass, sax }[course.id];
      expect(base.lessons.every(lesson => course.lessons.some(item => item.id === lesson.id))).toBe(true);
      for (const stage of stages) {
        const units = course.units!.filter(unit => unit.stage === stage);
        expect(units).toHaveLength(4);
        for (const unit of units) {
          expect(unit.lessonIds).toHaveLength(7);
          expect(course.lessons.find(lesson => lesson.id === unit.lessonIds.at(-1))!.kind).toBe('checkpoint');
          expect(unit.lessonIds.every(id => course.lessons.some(lesson => lesson.id === id && lesson.stage === stage))).toBe(true);
        }
        const test = course.lessons.find(lesson => lesson.stage === stage && lesson.kind === 'stage-test')!;
        expect(test.testQuestions).toHaveLength(4); expect(test.checks).toHaveLength(4);
        const focused = new Set(course.lessons.filter(lesson => lesson.stage === stage).map(lesson => lesson.focus));
        for (const focus of ['reading','scale','harmony','rhythm'] as const) expect(focused.has(focus)).toBe(true);
      }
      for (const lesson of course.lessons) {
        expect(lesson.tempoLadder).toHaveLength(3);
        expect(lesson.targetNotes.every(note => course.id !== 'sax' || (note >= 58 && note <= 89))).toBe(true);
        expect(lesson.quiz.options.every(option => typeof option === 'string')).toBe(true);
      }
    });
    it(`${course.id} unlocks every prerequisite and awards badges only after all unit work`, () => {
      const completed: Record<string, true> = {};
      for (const lesson of course.lessons) {
        expect(availableLesson(course, lesson, completed)).toBe(true);
        const next = course.lessons[course.lessons.indexOf(lesson) + 1];
        if (next) expect(availableLesson(course, next, completed)).toBe(false);
        completed[lesson.id] = true;
      }
      expect(stageBadges(course, completed).every(badge => badge.earned)).toBe(true);
      delete completed[course.lessons[1].id];
      expect(stageBadges(course, completed)[0].earned).toBe(false);
      expect(availableLesson(course, course.lessons.at(-1)!, completed)).toBe(true);
    });
  }
});
describe('compatible practice records', () => {
  it('migrates old backups without changing completions, XP, streak or stats', () => {
    const current = completeLesson(freshProgress(), 'keyboard', courses[0].lessons[0]);
    const old = JSON.parse(JSON.stringify(current)); old.version = 1;
    for (const data of Object.values(old.instruments) as Record<string, unknown>[]) { delete data.weak; delete data.ladders; }
    const migrated = parseProgress(JSON.stringify(old));
    expect(migrated).toEqual(current); expect(migrated.version).toBe(2);
  });
  it('isolates note/chord/rhythm mistakes by instrument and reschedules from failure', () => {
    const date = new Date('2026-10-10T12:00:00Z');
    let value = freshProgress();
    for (const kind of ['note','chord','rhythm'] as const) value = recordMistake(value, 'keyboard', 'keys-first-sound', kind, 'Target C', [60], date);
    expect(Object.keys(value.instruments.keyboard.weak)).toHaveLength(3);
    expect(value.instruments.guitar.weak).toEqual({});
    const key = 'keys-first-sound-note-60';
    value = reviewWeak(value, 'keyboard', key, true, date);
    expect(value.instruments.keyboard.weak[key].interval).toBe(2);
    expect(reviewWeak(value, 'keyboard', key, true, date).xp).toBe(value.xp);
    value = recordMistake(value, 'keyboard', 'keys-first-sound', 'note', 'Target C', [60], date);
    expect(value.instruments.keyboard.weak[key]).toMatchObject({ interval: 1, mistakes: 2, reviews: 1 });
    expect(parseProgress(JSON.stringify(value))).toEqual(value);
  });
  it('advances only one ordered per-lesson tempo target after at least 30 seconds', () => {
    const lesson = courses[0].lessons[0];
    const result = { seconds: 29, notes: 10, tempo: 40, mistakes: [], ladderTempo: 40 };
    let value = savePracticeResult(freshProgress(), 'keyboard', lesson, result);
    expect(value.instruments.keyboard.ladders).toEqual({});
    value = savePracticeResult(value, 'keyboard', lesson, { ...result, seconds: 30, ladderTempo: 70 });
    expect(value.instruments.keyboard.ladders).toEqual({});
    value = savePracticeResult(value, 'keyboard', lesson, { ...result, seconds: 30 });
    expect(value.instruments.keyboard.ladders[lesson.id]).toEqual([40]);
    expect(parseProgress(JSON.stringify(value))).toEqual(value);
    expect(value.instruments.guitar.ladders).toEqual({});
  });
  it('rejects corrupt new records instead of silently dropping them', () => {
    const value = recordMistake(freshProgress(), 'keyboard', 'keys-first-sound', 'note', 'C4', [60]);
    const key = Object.keys(value.instruments.keyboard.weak)[0];
    value.instruments.keyboard.weak[key].notes = [999];
    expect(() => parseProgress(JSON.stringify(value))).toThrow('weak-skill');
    const invalid = freshProgress(); invalid.instruments.keyboard.ladders['keys-first-sound'] = [40, 40];
    expect(() => parseProgress(JSON.stringify(invalid))).toThrow('tempo ladder');
  });
});
