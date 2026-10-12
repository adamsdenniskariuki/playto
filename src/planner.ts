import { availableLesson } from './curriculum';
import type { Course, InstrumentProgress, Lesson } from './types';

export interface RoutineStep { title: string; instruction: string; seconds: number; lesson: Lesson }
export function buildRoutine(course: Course, record: InstrumentProgress, now = new Date()): RoutineStep[] {
  const unlocked = course.lessons.filter(lesson => availableLesson(course, lesson, record.lessons));
  const current = unlocked.find(lesson => !record.lessons[lesson.id]) ?? unlocked.at(-1) ?? course.lessons[0];
  const technique = unlocked.find(lesson => (lesson.focus === 'technique' || lesson.focus === 'scale') && !record.lessons[lesson.id])
    ?? [...unlocked].reverse().find(lesson => lesson.focus === 'technique' || lesson.focus === 'scale') ?? current;
  const piece = unlocked.find(lesson => (lesson.focus === 'repertoire' || lesson.kind === 'piece') && !record.lessons[lesson.id]) ?? current;
  const weak = Object.values(record.weak).filter(item => Date.parse(item.reviewAt) <= now.getTime() && course.lessons.some(lesson => lesson.id === item.lessonId))
    .sort((a, b) => b.mistakes - a.mistakes || Date.parse(a.reviewAt) - Date.parse(b.reviewAt))[0];
  const due = unlocked.filter(lesson => record.lessons[lesson.id] && Date.parse(record.lessons[lesson.id].reviewAt) <= now.getTime())
    .sort((a, b) => Date.parse(record.lessons[a.id].reviewAt) - Date.parse(record.lessons[b.id].reviewAt))[0];
  const review = weak ? course.lessons.find(lesson => lesson.id === weak.lessonId)! : due ?? unlocked.find(lesson => record.lessons[lesson.id]) ?? current;
  return [
    { title: 'Warm-up', instruction: 'Settle your posture. Play comfortable notes softly, releasing tension between each one. Stop if anything hurts.', seconds: 120, lesson: { ...course.lessons[0], tempoLadder: undefined } },
    { title: 'Technique', instruction: technique.goal, seconds: 180, lesson: technique },
    { title: 'Current piece', instruction: `Work slowly on ${piece.title}. ${piece.pattern}`, seconds: 240, lesson: piece },
    { title: 'Review', instruction: weak ? `Your strongest due weak spot: ${weak.kind} - ${weak.label}. Repeat slowly and assess twice.` : `Revisit ${review.title}. Listen, play, release and repeat.`, seconds: 180,
      lesson: weak ? { ...review, targetNotes: weak.notes, tempoLadder: undefined } : { ...review, tempoLadder: undefined } }
  ];
}
