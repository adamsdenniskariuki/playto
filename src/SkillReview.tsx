import { useState } from 'react';
import { Practice } from './Practice';
import type { Course, Lesson, PracticeResult, WeakItem } from './types';

export function SkillReview({ course, lesson, item, passedTempos, onReview, onSave, report }: {
  course: Course; lesson: Lesson; item: WeakItem; passedTempos: number[];
  onReview: (confident: boolean) => void;
  onSave: (seconds: number, hits: number, tempo: number, detail?: PracticeResult) => void;
  report: (message: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const drill = { ...lesson, targetNotes: item.notes, tempoLadder: undefined };
  return <section className="panel">
    <h2>Weak {item.kind}: {item.label}</h2>
    <p>{item.mistakes} mistake(s) recorded. {item.kind === 'note' ? 'Hear the target, play it slowly, release, and repeat. Use mic/MIDI for single-note feedback.' :
      item.kind === 'chord' ? 'Check every chord tone separately, then play the whole chord twice. Assess clarity by listening; the mic does not grade chords.' :
      'Count the written subdivisions, clap the pattern, then play it twice with the metronome. Timing is self-assessed, not inferred from pitch.'}</p>
    <p className="pattern">{lesson.pattern}</p>
    <Practice course={course} lesson={drill} passedTempos={passedTempos} onSave={onSave} report={report}/>
    <label className="check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>I practised this specific difficulty twice and checked the result.</label>
    <div className="button-row"><button disabled={!confirmed} onClick={() => onReview(false)}>Still difficult · review tomorrow</button>
      <button className="primary" disabled={!confirmed} onClick={() => onReview(true)}>Confident · space this review</button></div>
  </section>;
}
