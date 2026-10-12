import { expect, it } from 'vitest';
import { courses } from '../../src/courses';
import { availableLesson } from '../../src/curriculum';
import { buildRoutine } from '../../src/planner';
import { dayKey, freshProgress, parseProgress, saveRoutineResult } from '../../src/progress';

it('builds four timed activities without assigning locked lessons', () => {
  const progress = freshProgress();
  for (const course of courses) {
    const record = progress.instruments[course.id], routine = buildRoutine(course, record);
    expect(routine.map(step => step.title)).toEqual(['Warm-up','Technique','Current piece','Review']);
    expect(routine.reduce((sum, step) => sum + step.seconds, 0)).toBe(720);
    expect(routine.every(step => availableLesson(course, step.lesson, record.lessons))).toBe(true);
  }
});
it('prioritizes due high-mistake targets and preserves their lesson identity', () => {
  const progress = freshProgress(), course = courses[0], lesson = course.lessons[0];
  progress.instruments.keyboard.weak.test = { lessonId: lesson.id, kind: 'note', label: 'C4', notes: [60], mistakes: 5, interval: 1, reviewAt: '2020-01-01', reviews: 0 };
  const step = buildRoutine(course, progress.instruments.keyboard)[3];
  expect(step.instruction).toContain('C4'); expect(step.lesson.targetNotes).toEqual([60]);
});
it('counts only saved active seconds once, keeps streaks and migrates old backups', () => {
  const progress = freshProgress(), lesson = courses[0].lessons[0];
  const result = { seconds: 30, notes: 2, tempo: 0, mistakes: [] };
  const next = saveRoutineResult(progress, 'keyboard', lesson, result, 0);
  expect(next.instruments.keyboard.minutes).toBe(0.5);
  expect(next.instruments.keyboard.planner).toEqual({ day: dayKey(), seconds: [30,0,0,0] });
  expect(next.streak).toBe(1); expect(next.instruments.keyboard.lessons).toEqual({});
  expect(parseProgress(JSON.stringify(next))).toEqual(next);
  const legacy = JSON.parse(JSON.stringify(progress));
  for (const record of Object.values(legacy.instruments) as Record<string, unknown>[]) delete record.planner;
  expect(parseProgress(JSON.stringify(legacy)).instruments.keyboard.planner.seconds).toEqual([0,0,0,0]);
});
