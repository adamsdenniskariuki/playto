import keyboard from '../content/keyboard/course.json' with { type: 'json' };
import guitar from '../content/guitar/course.json' with { type: 'json' };
import bass from '../content/bass/course.json' with { type: 'json' };
import sax from '../content/sax/course.json' with { type: 'json' };
import keyboardCurriculum from '../content/keyboard/curriculum.json' with { type: 'json' };
import { expandCourse, stages } from './curriculum';
import type { Course, Curriculum, Lesson } from './types';

function validateCourse(raw: unknown): Course {
  const course = raw as Course;
  if (!course.id || !Array.isArray(course.lessons) || course.lessons.length === 0) throw new Error('Empty course');
  const ids = new Set<string>();
  for (const lesson of course.lessons) {
    if (!/^[a-z0-9-]+$/.test(lesson.id) || ids.has(lesson.id) || lesson.steps.length < 3 || !lesson.targetNotes.length ||
      lesson.quiz.answer < 0 || lesson.quiz.answer >= lesson.quiz.options.length ||
      !lesson.targetNotes.every(note => Number.isInteger(note) && note >= 0 && note <= 127) ||
      !stages.includes(lesson.stage) || !lesson.goal || !lesson.pattern || !lesson.assessment ||
      (lesson.tempoLadder && (lesson.tempoLadder.length < 3 || lesson.tempoLadder.some((bpm, index, list) => !Number.isInteger(bpm) || bpm < 40 || bpm > 180 || (index > 0 && bpm <= list[index - 1]))))) {
      throw new Error(`Invalid lesson: ${lesson.id}`);
    }
    ids.add(lesson.id);
  }
  return course;
}
export const courses: Course[] = [
  expandCourse(validateCourse(keyboard), keyboardCurriculum as Curriculum), guitar, bass, sax
].map(validateCourse);
export const lessonAvailable = (lessons: Lesson[], index: number, completed: Record<string, unknown>) =>
  index === 0 || Boolean(completed[lessons[index - 1].id]);
