import { useState } from 'react';
import { audio, noteName } from './audio';

const intervals = [
  { semitones: 0, name: 'Unison', hint: 'The same pitch twice.' },
  { semitones: 2, name: 'Major second', hint: 'One whole step, like C to D.' },
  { semitones: 4, name: 'Major third', hint: 'Four semitones, like C to E.' },
  { semitones: 5, name: 'Perfect fourth', hint: 'Five semitones, like C to F.' },
  { semitones: 7, name: 'Perfect fifth', hint: 'Seven semitones, like C to G.' },
  { semitones: 12, name: 'Octave', hint: 'The same note name, twelve semitones apart.' }
];
export function EarTraining({ report, onMistake }: { report: (message: string) => void; onMistake?: (notes: number[], label: string) => void }) {
  const [challenge, setChallenge] = useState<{ root: number; answer: number } | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const play = (root: number, answer: number) => {
    void audio.pattern([root, root + intervals[answer].semitones], 70)
      .catch(error => report(`Ear-training audio failed: ${error instanceof Error ? error.message : String(error)}`));
  };
  return <section className="panel ear-training"><span className="eyebrow">LISTEN BEFORE YOU LOOK</span><h2>Train your musical ear</h2><p>Listen to two rising notes. Hum them, then choose the distance between them. These are concert pitches for every instrument. No score penalty; repeat as often as you like.</p>
    <div className="button-row"><button className="primary" onClick={() => {
      audio.stop();
      const bytes = new Uint32Array(2); crypto.getRandomValues(bytes);
      const next = { root: 55 + bytes[0] % 12, answer: bytes[1] % intervals.length };
      setChallenge(next); setChoice(null); play(next.root, next.answer);
    }}>New listening challenge</button><button disabled={!challenge} onClick={() => challenge && play(challenge.root, challenge.answer)}>Listen again</button></div>
    {challenge && <><fieldset><legend>Which interval did you hear?</legend><div className="interval-options">{intervals.map((interval, index) => <button key={interval.name} disabled={choice === challenge.answer} aria-pressed={choice === index} onClick={() => {
      setChoice(index); if (index === challenge.answer) setCorrect(value => value + 1);
      else onMistake?.([challenge.root, challenge.root + intervals[challenge.answer].semitones], `Hear ${intervals[challenge.answer].name.toLowerCase()}`);
    }}>{interval.name}</button>)}</div></fieldset>{choice !== null && <p className="tip" role="status">{choice === challenge.answer ? `Yes - ${intervals[choice].name.toLowerCase()}. ${noteName(challenge.root)} to ${noteName(challenge.root + intervals[choice].semitones)}. ${intervals[choice].hint}` : 'Not quite. Listen again, hum both notes, and try a different distance.'}</p>}</>}
    <p className="small muted">{correct} interval(s) identified in this visit. Ear training is ungraded; lesson XP comes from the playing goal and knowledge check.</p>
  </section>;
}
