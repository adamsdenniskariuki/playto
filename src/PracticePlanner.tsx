import { useEffect, useState } from 'react';
import { Practice } from './Practice';
import { buildRoutine } from './planner';
import { dayKey } from './progress';
import type { Course, InstrumentProgress, Lesson, PracticeResult } from './types';

export function PracticePlanner({ course, record, onActive, onSave, report }: {
  course: Course; record: InstrumentProgress; onActive: (active: boolean) => void;
  onSave: (step: number, lesson: Lesson, result: PracticeResult) => void;
  report: (message: string) => void;
}) {
  const [routine] = useState(() => buildRoutine(course, record));
  const [active, setActive] = useState<number | null>(null);
  const completed = record.planner.day === dayKey() ? record.planner.seconds : [0,0,0,0];
  useEffect(() => { onActive(active !== null); return () => onActive(false); }, [active]);
  return <section className="panel practice-planner"><h2>Your daily practice routine</h2>
    <p className="muted">A 12-minute plan from your unlocked lessons and due weak spots. Take breaks whenever you need. Saved active timer seconds count once toward minutes and streaks; suggested durations do not count.</p>
    <ol className="routine-steps">{routine.map((step, index) => {
      const remaining = Math.max(0, step.seconds - completed[index]);
      return <li key={step.title}><h3>{step.title} · {step.seconds / 60} min</h3><p>{step.instruction}</p>
        <p className="small">{Math.min(step.seconds, completed[index])} / {step.seconds} seconds saved today{remaining === 0 ? ' · Done' : ''}</p>
        <button disabled={active !== null || remaining === 0} onClick={() => setActive(index)}>{remaining === 0 ? `${step.title} done` : `${completed[index] ? 'Resume' : 'Start'} ${step.title.toLowerCase()}`}</button></li>;
    })}</ol>
    {active !== null && <Practice key={active} course={course} lesson={routine[active].lesson} passedTempos={record.ladders[routine[active].lesson.id] ?? []}
      routineSeconds={Math.max(1, routine[active].seconds - completed[active])} routineTitle={routine[active].title}
      report={report} onSave={(seconds, notes, tempo, detail) => {
        onSave(active, routine[active].lesson, detail ?? { seconds, notes, tempo, mistakes: [] });
        setActive(null);
      }}/>}
    <p className="small muted">Pause with Save practice session. Switching pages/instruments saves the active step; hiding the tab pauses it. The plan resumes from saved seconds for today, resets tomorrow, and never completes lessons or reviews just because a timer ran.</p>
  </section>;
}
