import type { Course, Curriculum, Lesson, LessonDraft, Stage } from './types';

export const stages: Stage[] = ['Beginner', 'Intermediate', 'Advanced'];
export function expandCourse(base: Course, curriculum: Curriculum): Course {
  const lessons: Lesson[] = [];
  const units: NonNullable<Course['units']> = [];
  for (const unit of curriculum.units) {
    if (unit.lessons.length !== 6) throw new Error(`${unit.id} needs six learning lessons plus its checkpoint`);
    const drafts = unit.lessons.map((item): Lesson => {
      if (typeof item === 'string') {
        const source = base.lessons.find(lesson => lesson.id === item);
        if (!source) throw new Error(`Missing preserved lesson ${item}`);
        return { ...source, stage: unit.stage, unitId: unit.id, style: unit.style,
          tempoLadder: source.tempoLadder ?? [40, 55, 70] };
      }
      return fromDraft(item, unit);
    });
    const piece = drafts.at(-1)!;
    const checkpoint: Lesson = {
      ...piece, id: `${unit.id}-checkpoint`, title: `Unit checkpoint: ${unit.title}`,
      kind: 'checkpoint', minutes: 15, goal: `Connect the six skills in ${unit.title.toLowerCase()}.`,
      steps: [
        `Warm up with ${drafts[0].title}. Then read and play ${drafts[1].title} without skipping rests.`,
        `Demonstrate ${drafts[2].title} and ${drafts[3].title}. Say the note names or chord tones before playing.`,
        `Perform ${piece.title} twice at the first tempo-ladder target. Follow the printed counts, not the equal-note pitch reference.`,
        `Check the three goals below. Mark a weak note, chord or rhythm in practice if either take needs work; review the source lesson before moving on.`
      ],
      assessment: `I connected this unit's skills in two uninterrupted, controlled takes.`,
      checks: [drafts[0].goal, drafts[2].goal, piece.goal],
      quiz: drafts[3].quiz
    };
    lessons.push(...drafts, checkpoint);
    units.push({ id: unit.id, title: unit.title, stage: unit.stage, style: unit.style, lessonIds: [...drafts, checkpoint].map(lesson => lesson.id) });
  }
  for (const stage of stages) {
    const stageUnits = units.filter(unit => unit.stage === stage);
    if (stageUnits.length !== 4) throw new Error(`${stage} must have four units`);
    const oldTest = base.lessons.find(lesson => lesson.stage === stage && lesson.kind === 'checkpoint');
    if (!oldTest) throw new Error(`Missing preserved ${stage} test`);
    const stageLessons = lessons.filter(lesson => lesson.stage === stage);
    const test: Lesson = {
      ...oldTest, kind: 'stage-test', title: `Stage test: ${oldTest.title.replace(/^(Checkpoint|Level test): /, '')}`,
      goal: `Demonstrate all four ${stage.toLowerCase()} units and earn the ${stage.toLowerCase()} stage badge.`,
      checks: stageUnits.map(unit => `I passed ${unit.title}'s checkpoint and can reproduce its pattern without stopping.`),
      testQuestions: stageUnits.map(unit => stageLessons.find(lesson => lesson.id === unit.lessonIds[2])!.quiz),
      tempoLadder: stage === 'Beginner' ? [40, 50, 60] : stage === 'Intermediate' ? [50, 65, 80] : [60, 75, 90],
      steps: [
        ...oldTest.steps,
        `Also replay the checkpoint in each of these units: ${stageUnits.map(unit => unit.title).join('; ')}. Use the unit's printed rhythm and demonstrate both a scale/harmony skill and a reading/groove skill.`,
        'Answer all four knowledge checks, confirm each unit performance, and play two complete takes before claiming the badge. Microphone/MIDI assess single pitches, while tone, harmony and musical rhythm require your listening.'
      ]
    };
    const last = lessons.findLastIndex(lesson => lesson.stage === stage);
    lessons.splice(last + 1, 0, test);
  }
  const legacyIds = base.lessons.map(lesson => lesson.id);
  if (!legacyIds.every(id => lessons.some(lesson => lesson.id === id))) throw new Error('Curriculum lost an existing lesson ID');
  return { ...base, units, lessons };
}
function fromDraft(draft: LessonDraft, unit: Curriculum['units'][number]): Lesson {
  const rotation = draft.id.length % 3;
  const options = draft.quiz.slice(1);
  const ordered = options.map((_, index) => options[(index + rotation) % 3]);
  return {
    id: draft.id, title: draft.title, stage: unit.stage, unitId: unit.id, style: unit.style,
    focus: draft.focus, kind: draft.focus === 'repertoire' ? 'piece' : 'lesson',
    goal: draft.goal, minutes: unit.stage === 'Beginner' ? 8 : unit.stage === 'Intermediate' ? 12 : 16,
    steps: draft.steps,
    tip: 'Use the written beat counts for rhythm. Slow down to a clean take, rest your hands or breath regularly, and stop if you feel pain.',
    targetNotes: draft.notes, pattern: draft.pattern, chord: draft.chord,
    assessment: `I can ${draft.goal.charAt(0).toLowerCase()}${draft.goal.slice(1).replace(/\.$/, '')}.`,
    tempoLadder: draft.tempo ?? (unit.stage === 'Beginner' ? [40, 50, 60] : unit.stage === 'Intermediate' ? [50, 65, 80] : [60, 75, 90]),
    quiz: { question: draft.quiz[0], options: ordered, answer: (3 - rotation) % 3, explanation: draft.quiz[1] }
  };
}
export function availableLesson(course: Course, lesson: Lesson, completed: Record<string, unknown>): boolean {
  if (completed[lesson.id]) return true;
  if (!course.units) {
    const index = course.lessons.indexOf(lesson);
    return index === 0 || Boolean(completed[course.lessons[index - 1].id]);
  }
  if (lesson.kind === 'stage-test') return course.units.filter(unit => unit.stage === lesson.stage)
    .every(unit => unit.lessonIds.every(id => completed[id]));
  const unit = course.units.find(item => item.id === lesson.unitId)!;
  const previousStage = stages[stages.indexOf(unit.stage) - 1];
  if (previousStage && !course.lessons.some(item => item.stage === previousStage && item.kind === 'stage-test' && completed[item.id])) return false;
  const index = unit.lessonIds.indexOf(lesson.id);
  if (index > 0) return Boolean(completed[unit.lessonIds[index - 1]]);
  const stageUnits = course.units.filter(item => item.stage === unit.stage);
  const previousUnit = stageUnits[stageUnits.indexOf(unit) - 1];
  return !previousUnit || Boolean(completed[previousUnit.lessonIds.at(-1)!]);
}
export function stageBadges(course: Course, completed: Record<string, unknown>) {
  return stages.map(stage => ({
    name: `${course.name} · ${stage}`,
    earned: Boolean(course.units && course.units.filter(unit => unit.stage === stage).every(unit => unit.lessonIds.every(id => completed[id])) &&
      course.lessons.some(lesson => lesson.stage === stage && lesson.kind === 'stage-test' && completed[lesson.id])),
    detail: `Pass all ${stage.toLowerCase()} units and the stage test`
  }));
}
