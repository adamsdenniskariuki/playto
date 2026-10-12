import { describe, expect, it } from 'vitest';
import { addPractice, completeLesson, currentStreak, dayKey, freshProgress, parseProgress, practiceDay, reviewLesson } from '../../src/progress';
import { courses, lessonAvailable } from '../../src/courses';

describe('local progress', () => {
  const date = new Date('2026-10-10T12:00:00');
  const lesson = courses[0].lessons[0];
  it('round-trips a complete backup', () => {
    const progress = completeLesson(freshProgress(), 'keyboard', lesson, date);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
  it('awards completion once and tracks instruments independently', () => {
    const done = completeLesson(freshProgress(), 'keyboard', lesson, date);
    expect(done.xp).toBe(50);
    expect(completeLesson(done, 'keyboard', lesson, date).xp).toBe(50);
    expect(done.instruments.guitar.lessons).toEqual({});
    expect(done.instruments.keyboard.minutes).toBe(0);
  });
  it('measures actual session minutes, not the suggested duration', () => {
    const progress = addPractice(freshProgress(), 'guitar', 90, 12, 60);
    expect(progress.instruments.guitar).toMatchObject({ minutes: 1.5, notes: 12, tempo: 60 });
    expect(progress.instruments.keyboard.minutes).toBe(0);
  });
  it('does not award a streak for an empty zero-second session', () => {
    expect(addPractice(freshProgress(), 'keyboard', 0, 0, 0).streak).toBe(0);
  });
  it('tracks each introduced chord once', () => {
    const chordsLesson = courses[0].lessons.find(item => item.chords)!;
    const progress = completeLesson(freshProgress(), 'keyboard', chordsLesson, date);
    expect(progress.instruments.keyboard.chords).toEqual(['C major', 'F major', 'G major']);
    expect(completeLesson(progress, 'keyboard', chordsLesson, date).instruments.keyboard.chords).toHaveLength(3);
  });
  it('covers one missed day with a freeze and resets a longer gap', () => {
    const first = practiceDay(freshProgress(), date);
    const frozen = practiceDay(first, new Date('2026-10-12T12:00:00'));
    expect(frozen.streak).toBe(2); expect(frozen.freezes).toBe(0);
    expect(practiceDay(frozen, new Date('2026-10-16T12:00:00')).streak).toBe(1);
    expect(practiceDay(first, date).streak).toBe(1);
  });
  it('displays an expired streak as zero without pretending today was practised', () => {
    const progress = practiceDay(freshProgress(), date);
    expect(currentStreak(progress, new Date('2026-10-11T12:00:00'))).toBe(1);
    expect(currentStreak(progress, new Date('2026-10-12T12:00:00'))).toBe(1);
    expect(currentStreak(progress, new Date('2026-10-13T12:00:00'))).toBe(0);
    expect(progress.lastPractice).toBe('2026-10-10');
  });
  it('uses calendar days across a daylight-saving transition', () => {
    const progress = freshProgress(); progress.lastPractice = '2026-10-31'; progress.streak = 3;
    expect(practiceDay(progress, new Date(2026, 10, 1, 1)).streak).toBe(4);
    expect(dayKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
  it('replenishes a freeze at seven streak days', () => {
    const progress = freshProgress(); progress.lastPractice = '2026-10-09'; progress.streak = 6; progress.freezes = 0;
    expect(practiceDay(progress, date).freezes).toBe(1);
  });
  it('schedules due reviews, prevents early duplicate XP and resets hard reviews', () => {
    const done = completeLesson(freshProgress(), 'keyboard', lesson, date);
    expect(reviewLesson(done, 'keyboard', lesson.id, true, date).xp).toBe(50);
    const reviewed = reviewLesson(done, 'keyboard', lesson.id, true, new Date('2026-10-11T13:00:00'));
    expect(reviewed.xp).toBe(65); expect(reviewed.instruments.keyboard.lessons[lesson.id].interval).toBe(2);
    const hard = reviewLesson(reviewed, 'keyboard', lesson.id, false, new Date('2026-10-14T13:00:00'));
    expect(hard.instruments.keyboard.lessons[lesson.id].interval).toBe(1);
  });
  for (const mutation of [
    (p: Record<string, unknown>) => { p.version = 3; },
    (p: Record<string, unknown>) => { p.xp = -1; },
    (p: Record<string, unknown>) => { p.xp = '50'; },
    (p: Record<string, unknown>) => { p.instruments = {}; },
    (p: Record<string, unknown>) => { p.settings = { theme: 'bad', font: 'bad', tourSeen: false }; },
    (p: Record<string, unknown>) => { p.freezes = 50; }
  ]) it('rejects invalid backup data', () => {
    const raw = JSON.parse(JSON.stringify(freshProgress())); mutation(raw);
    expect(() => parseProgress(JSON.stringify(raw))).toThrow();
  });
  it('rejects corrupt review records and prototype keys', () => {
    const raw = freshProgress();
    raw.instruments.keyboard.lessons['bad-record'] = { completedAt: 'not-a-date', reviewAt: 'x', interval: 1, reviews: 0 };
    expect(() => parseProgress(JSON.stringify(raw))).toThrow();
    expect(() => parseProgress('{"version":1}')).toThrow();
    expect(() => parseProgress('not JSON')).toThrow();
    expect(() => parseProgress(JSON.stringify({ ...freshProgress(), lastPractice: '2026-02-31' }))).toThrow();
  });
  it('unlocks lessons sequentially and permits completed replays', () => {
    expect(lessonAvailable(courses[0].lessons, 0, {})).toBe(true);
    expect(lessonAvailable(courses[0].lessons, 1, {})).toBe(false);
    expect(lessonAvailable(courses[0].lessons, 1, { [lesson.id]: true })).toBe(true);
  });
});
describe('curriculum integrity', () => {
  for (const course of courses) it(`${course.name} has complete, valid lessons`, () => {
    expect(course.lessons).toHaveLength(course.units ? 87 : 15);
    for (const stage of ['Beginner', 'Intermediate', 'Advanced']) {
      expect(course.lessons.filter(lesson => lesson.stage === stage)).toHaveLength(course.units ? 29 : 5);
      expect(course.lessons.some(lesson => lesson.stage === stage && lesson.kind === 'checkpoint')).toBe(true);
    }
    expect(new Set(course.lessons.map(lesson => lesson.id)).size).toBe(course.lessons.length);
    for (const lesson of course.lessons) {
      expect(lesson.steps.length).toBeGreaterThanOrEqual(3);
      expect(lesson.assessment.length).toBeGreaterThan(20);
      expect(lesson.quiz.options[lesson.quiz.answer]).toBeTruthy();
      expect(lesson.targetNotes.every(note => note >= 0 && note <= 127)).toBe(true);
    }
  });
});
