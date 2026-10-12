import { NOTE_NAMES, noteName } from './audio';
import type { InstrumentId } from './types';

const tunings = { guitar: [64, 59, 55, 50, 45, 40], bass: [43, 38, 33, 28] };
export const chordShapes: Record<string, (number | null)[]> = {
  'E minor': [0, 2, 2, 0, 0, 0], 'A minor': [null, 0, 2, 2, 1, 0],
  'C major': [null, 3, 2, 0, 1, 0], 'G major': [3, 2, 0, 0, 0, 3],
  'D major': [null, null, 0, 2, 3, 2], 'F major': [null, null, 3, 2, 1, 1],
  'E major': [0, 2, 2, 1, 0, 0], 'A major': [null, 0, 2, 2, 2, 0],
  'D minor': [null, null, 0, 2, 3, 1], 'A7': [null, 0, 2, 0, 2, 0],
  'D7': [null, null, 0, 2, 1, 2], 'E7': [0, 2, 0, 1, 0, 0],
  'B minor': [null, 2, 4, 4, 3, 2], 'F barre': [1, 3, 3, 2, 1, 1],
  'Cmaj7': [null, 3, 2, 0, 0, 0], 'Dm7': [null, null, 0, 2, 1, 1],
  'G7': [3, 2, 0, 0, 0, 1], 'Cadd9': [null, 3, 2, 0, 3, 3]
};
export function InstrumentMark({ instrument }: { instrument: InstrumentId }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    {instrument === 'keyboard' ? <><rect x="8" y="16" width="48" height="32" rx="3"/><path d="M16 16v32m8-32v32m8-32v32m8-32v32m8-32v32"/><path strokeWidth="5" d="M20 17v16m8-16v16m16-16v16m8-16v16"/></>
      : instrument === 'sax' ? <><path d="M40 8h9l-8 12v27c0 15-24 15-24 0V33l-8-4 4 20c2 18 35 18 35-3V21"/><path d="M37 26h7m-7 7h7m-7 7h7"/></>
      : <><path d="M41 8l7 4-15 23c13 17-11 30-24 19S7 26 21 29L41 8z"/><path d="M18 48l25-36"/><circle cx="23" cy="40" r="5"/><path d="M10 47l9 7m21-39l8 5"/></>}
  </svg>;
}
export function Piano({ target, play }: { target: number; play: (midi: number) => void }) {
  const start = Math.max(24, Math.min(84, Math.floor(target / 12) * 12));
  const keys = Array.from({ length: 13 }, (_, index) => start + index);
  return <div className="piano" aria-label="Interactive piano">
    {keys.map(midi => <button key={midi} className={`key ${[1, 3, 6, 8, 10].includes(midi % 12) ? 'black' : 'white'} ${midi === target ? 'target' : ''}`}
      aria-label={`Play ${noteName(midi)}`} onClick={() => play(midi)}><span>{noteName(midi)}</span></button>)}
  </div>;
}
export function Fretboard({ instrument, target, play, chord }: { instrument: 'guitar' | 'bass'; target: number; play: (midi: number) => void; chord?: string }) {
  const strings = tunings[instrument];
  const fretCount = Math.max(13, Math.min(25, target - strings[0] + 1));
  const shape = chord && instrument === 'guitar' ? chordShapes[chord] : undefined;
  return <>
    {shape && <div className="chord-diagram">
      <strong>{chord} chord shape</strong>
      <div className="chord-strings">{shape.map((fret, index) => <div key={index}>
        <span>String {6 - index}</span><b>{fret === null ? 'x' : fret}</b>
        <span>{fret === null ? 'Skip' : fret === 0 ? 'Open' : `Fret ${fret}`}</span>
      </div>)}</div>
      <p className="muted small">Thickest to thinnest. x = skip, 0 = open. Pick each string to check clarity.</p>
    </div>}
    <div className="fretboard-scroll" tabIndex={0} aria-label="Fretboard scroll area">
      <table className="fretboard"><caption>{instrument === 'guitar' ? 'Guitar' : 'Bass'} fretboard · thin strings at the top</caption>
        <thead><tr><th scope="col">String</th>{Array.from({ length: fretCount }, (_, fret) => <th key={fret} scope="col">{fret === 0 ? 'Open' : fret}</th>)}</tr></thead>
        <tbody>{strings.map((open, index) => <tr key={open}><th scope="row">{index + 1} · {noteName(open)}</th>
          {Array.from({ length: fretCount }, (_, fret) => <td key={fret}><button className={open + fret === target ? 'target' : ''}
            aria-label={`Play ${noteName(open + fret)}, string ${index + 1}, fret ${fret}`} onClick={() => play(open + fret)}>{NOTE_NAMES[(open + fret) % 12]}</button></td>)}</tr>)}</tbody>
      </table>
    </div>
  </>;
}

// Numbered main keys run left index to right ring; special keys are named in text.
const saxFingerings: Record<number, { keys: number[]; octave: boolean; extra: string }> = {
  58: { keys: [1,2,3,4,5,6], octave: false, extra: 'Low Bb: all six main keys, right little-finger low-C key, and left little-finger low-Bb key. No octave key.' },
  59: { keys: [1,2,3,4,5,6], octave: false, extra: 'Low B: all six main keys, right little-finger low-C key, and left little-finger low-B key. No octave key.' },
  60: { keys: [1,2,3,4,5,6], octave: false, extra: 'Low C: all six main keys plus the right little-finger low-C key. No octave key.' },
  61: { keys: [1,2,3,4,5,6], octave: false, extra: 'Low C#: all six main keys, right little-finger low-C key, and left little-finger low-C# key. No octave key.' },
  62: { keys: [1,2,3,4,5,6], octave: false, extra: 'D: all six main keys.' },
  63: { keys: [1,2,3,4,5,6], octave: false, extra: 'Add right little-finger Eb key.' },
  64: { keys: [1,2,3,4,5], octave: false, extra: 'E: lift right ring finger.' },
  65: { keys: [1,2,3,4], octave: false, extra: 'F: right index only in the lower stack.' },
  66: { keys: [1,2,3,5], octave: false, extra: 'F#: use right middle finger, not index.' },
  67: { keys: [1,2,3], octave: false, extra: 'G: left-hand main keys only.' },
  68: { keys: [1,2,3], octave: false, extra: 'Add left little-finger G# key.' },
  69: { keys: [1,2], octave: false, extra: 'A: left index and middle.' },
  70: { keys: [1], octave: false, extra: 'Bb: left index plus the small bis key beneath B.' },
  71: { keys: [1], octave: false, extra: 'B: left index only.' },
  72: { keys: [2], octave: false, extra: 'C: left middle finger only.' },
  73: { keys: [], octave: false, extra: 'C#: all six main keys open.' },
  85: { keys: [], octave: true, extra: 'High C#: open all six main keys and use the octave key.' },
  86: { keys: [], octave: true, extra: 'High D: octave key plus left-hand palm D. Keep the six main keys open; consult your teacher for palm-key reach.' },
  87: { keys: [], octave: true, extra: 'High Eb: octave key plus palm D and palm Eb. Main keys open.' },
  88: { keys: [], octave: true, extra: 'High E: octave key, palm D and Eb, plus the right-hand high-E side key. Main keys open; key placement varies.' },
  89: { keys: [], octave: true, extra: 'High F: octave key, left-hand palm D, Eb and F, plus the right-hand high-E side key. Main keys open; use a teacher to check comfortable reach.' }
};
export function SaxChart({ target, play }: { target: number; play: (midi: number) => void }) {
  const base = target >= 74 && target <= 84 ? target - 12 : target;
  const fingering = saxFingerings[base];
  const octave = target >= 74 || Boolean(fingering?.octave);
  return <div className="sax-chart">
    <div className="sax-keys" aria-label={`Fingering for written ${noteName(target)}`}>
      <span className={octave ? 'closed' : ''}>Octave: {octave ? 'press' : 'release'}</span>
      {[1,2,3,4,5,6].map(key => <span key={key} className={fingering?.keys.includes(key) ? 'closed' : ''}>{key} · {fingering?.keys.includes(key) ? 'closed' : 'open'}</span>)}
    </div>
    <div><h3>Written {noteName(target)}</h3><p>{fingering?.extra ?? 'Consult your instrument teacher for this fingering.'}</p>
      <p>1-3: left index, middle, ring. 4-6: right index, middle, ring. {octave && 'Press the left-thumb octave key.'}</p>
      <p className="muted">Alto sax is in Eb. Written {noteName(target)} sounds concert {noteName(target - 9)}. The microphone listens for concert pitch.</p>
      <button onClick={() => play(target)}>Hear concert {noteName(target - 9)}</button>
    </div>
  </div>;
}
export function Staff({ notes, bass = false, octaveShift = 0 }: { notes: number[]; bass?: boolean; octaveShift?: number }) {
  const bottom = bass ? 43 : 64;
  const diatonic = (midi: number) => Math.floor(midi / 12) * 7 + [0,0,1,1,2,3,3,4,4,5,5,6][midi % 12];
  const shown = notes.slice(0, 12).map(note => note + octaveShift * 12);
  return <div className="staff-scroll"><svg viewBox={`0 0 ${Math.max(350, shown.length * 38 + 70)} 190`} role="img"
    aria-label={`${bass ? 'Bass' : 'Treble'} clef pitch guide: ${shown.map(noteName).join(', ')}.${octaveShift ? ' Sounds one octave lower than written.' : ''} Rhythm is described in the lesson.`}>
    {[0,1,2,3,4].map(line => <line key={line} x1="20" y1={35 + line * 12} x2={Math.max(330, shown.length * 38 + 50)} y2={35 + line * 12} stroke="currentColor"/>)}
    <text x="12" y="30" fill="currentColor" fontSize="13">{bass ? 'Bass clef' : 'Treble clef'}</text>
    {shown.map((midi, index) => {
      const x = 65 + index * 38, y = 83 - (diatonic(midi) - diatonic(bottom)) * 6;
      const ledgers = y > 83 ? Array.from({ length: Math.floor((y - 83) / 12) }, (_, i) => 95 + i * 12)
        : y < 35 ? Array.from({ length: Math.floor((35 - y) / 12) }, (_, i) => 23 - i * 12) : [];
      return <g key={index}><ellipse cx={x} cy={y} rx="7" ry="5" fill="currentColor" transform={`rotate(-15 ${x} ${y})`}/>
        <line x1={x + 6} y1={y} x2={x + 6} y2={y - 28} stroke="currentColor"/>
        {ledgers.map(ledger => <line key={ledger} x1={x - 11} x2={x + 11} y1={ledger} y2={ledger} stroke="currentColor"/>)}
        {[1,3,6,8,10].includes(midi % 12) && <text x={x - 19} y={y + 5} fill="currentColor">#</text>}
        <text x={x} y="178" textAnchor="middle" fill="currentColor" fontSize="11">{noteName(midi)}</text></g>;
    })}
  </svg><p className="small muted">Pitch guide, not a full score. {notes.length > 12 ? 'First 12 notes shown. ' : ''}{octaveShift ? 'Guitar/bass notation is written one octave higher than it sounds. ' : ''}Follow the lesson's counts and rhythm; accidentals are shown as sharps.</p></div>;
}
