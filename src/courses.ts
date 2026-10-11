import keyboard from '../content/keyboard/course.json' with { type: 'json' };
import guitar from '../content/guitar/course.json' with { type: 'json' };
import bass from '../content/bass/course.json' with { type: 'json' };
import sax from '../content/sax/course.json' with { type: 'json' };
import type { Course, Lesson } from './types';

function validateCourse(raw: unknown): Course {
  const course = raw as Course;
  if (!course.id || !Array.isArray(course.lessons) || course.lessons.length === 0) throw new Error('Empty course');
  const ids = new Set<string>();
  for (const lesson of course.lessons) {
    if (ids.has(lesson.id) || !lesson.steps.length || !lesson.targetNotes.length ||
      lesson.quiz.answer < 0 || lesson.quiz.answer >= lesson.quiz.options.length ||
      !lesson.targetNotes.every(note => Number.isInteger(note) && note >= 0 && note <= 127)) {
      throw new Error(`Invalid lesson: ${lesson.id}`);
    }
    ids.add(lesson.id);
  }
  return course;
}
export const courses: Course[] = [keyboard, guitar, bass, sax].map(validateCourse);
export const lessonAvailable = (lessons: Lesson[], index: number, completed: Record<string, unknown>) =>
  index === 0 || Boolean(completed[lessons[index - 1].id]);
