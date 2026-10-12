import { useEffect, useRef, useState, type RefObject } from 'react';
import { AudioEngine, noteName } from './audio';
import { scorePosition, scoreTimeline, songs, type ReferenceScore, type Song } from './songs';
import { Staff, tunings } from './Visuals';
import type { Course, Lesson } from './types';

export function SongMode({ course, lesson, stopSignal, onStart, reference, report }: {
  course: Course; lesson?: Lesson; stopSignal: number; onStart: () => void;
  reference: RefObject<ReferenceScore>; report: (message: string) => void;
}) {
  const arrangements = songs[course.id];
  const lessonExercise: Song | null = lesson ? { id: 'lesson-exercise', title: `${lesson.title} - equal-beat pitch exercise`, tempo: lesson.tempoLadder?.[0] ?? 60, roots: arrangements[0].roots, events: lesson.targetNotes.map(note => ({ note, beats: 1 })) } : null;
  const choices = lessonExercise ? [lessonExercise, ...arrangements] : arrangements;
  const [songId, setSongId] = useState(choices[0].id);
  const song = choices.find(item => item.id === songId) ?? choices[0];
  const [tempo, setTempo] = useState(song.tempo);
  const [speed, setSpeed] = useState(1);
  const [from, setFrom] = useState(1), [to, setTo] = useState(song.events.length);
  const [repeat, setRepeat] = useState(false);
  const [countIn, setCountIn] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(-1), [count, setCount] = useState(0);
  const [withBacking, setWithBacking] = useState(true);
  const [pending, setPending] = useState(false);
  const engine = useRef(new AudioEngine());
  const timer = useRef(0), generation = useRef(0);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const strip = useRef<HTMLOListElement | null>(null);
  const events = song.events.slice(from - 1, to);
  const reportRef = useRef(report);
  const transposition = course.id === 'sax' ? -9 : 0;
  useEffect(() => { reportRef.current = report; });
  useEffect(() => {
    reference.current = { title: song.title, tempo: tempo * speed, countIn, events, roots: withBacking ? song.roots : [], transposition };
  });
  function stop() { generation.current++; clearInterval(timer.current); engine.current.stop(); setPlaying(false); setPending(false); setPosition(-1); setCount(0); }
  useEffect(() => { stop(); }, [stopSignal]);
  useEffect(() => () => { generation.current++; clearInterval(timer.current); void engine.current.dispose().catch(error => reportRef.current(`Song audio cleanup failed: ${String(error)}`)); }, []);
  useEffect(() => {
    const card = cards.current[position], container = strip.current;
    if (card && container) container.scrollTo({ left: card.offsetLeft - container.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2, behavior: 'auto' });
  }, [position]);
  async function start() {
    const request = ++generation.current;
    setPending(true);
    try {
      const context = await engine.current.ready();
      if (request !== generation.current) return;
      const timeline = scoreTimeline(events);
      if (!timeline.length) { stop(); report('Choose at least one song event to play.'); return; }
      onStart();
      const origin = context.currentTime + 0.15, secondsPerBeat = 60 / (tempo * speed);
      const duration = timeline[timeline.length - 1].end;
      const first = origin + countIn * secondsPerBeat;
      let nextCycle = first;
      for (let beat = 0; beat < countIn; beat++) engine.current.noteAt(beat % 4 === 0 ? 96 : 89, 0.07, origin + beat * secondsPerBeat, 0.07);
      function cycle(startTime: number) {
        for (const event of timeline) if (event.note !== null) engine.current.noteAt(event.note + transposition, event.beats * secondsPerBeat * 0.85, startTime + event.start * secondsPerBeat);
        if (withBacking) for (let beat = 0; beat < duration; beat++) {
          const root = song.roots[Math.floor(beat / 4) % song.roots.length];
          engine.current.noteAt(root + (beat % 4 === 2 ? 7 : 0), secondsPerBeat * 0.65, startTime + beat * secondsPerBeat, 0.05);
        }
      }
      cycle(nextCycle); nextCycle += duration * secondsPerBeat;
      setPlaying(true); setPending(false);
      const tick = () => {
        const now = context.currentTime, beats = (now - first) / secondsPerBeat;
        if (!repeat && beats >= duration) { stop(); return; }
        if (repeat && nextCycle < now + 0.2) { cycle(nextCycle); nextCycle += duration * secondsPerBeat; }
        setCount(now < origin ? 0 : beats < 0 ? Math.min(countIn, Math.floor((now - origin) / secondsPerBeat) + 1) : 0);
        const index = scorePosition(events, beats, repeat);
        setPosition(index < 0 ? -1 : index + from - 1);
      };
      tick(); timer.current = window.setInterval(tick, 25);
    } catch (error) { stop(); report(`Song playback failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  const next = position < 0 ? from - 1 : position + 1 < to ? position + 1 : repeat ? from - 1 : -1;
  return <section className="tool-card song-mode"><h3>Song mode</h3>
    <label>Score<select disabled={playing || pending} value={songId} onChange={event => {
      const selected = choices.find(item => item.id === event.target.value)!;
      setSongId(selected.id); setTempo(selected.tempo); setFrom(1); setTo(selected.events.length);
    }}>{choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    {songId === 'lesson-exercise' && <p className="small muted">Equal-beat pitch exercise only. Follow the lesson's written counts separately, or choose an original timed arrangement below.</p>}
    <div className="loop-inputs">
      <label>Song tempo (BPM)<input type="number" min="40" max="180" disabled={playing || pending} value={tempo} onChange={event => setTempo(Math.max(40, Math.min(180, Number(event.target.value) || 40)))}/></label>
      <label>Song speed<select disabled={playing || pending} value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="0.5">Half speed</option><option value="0.75">Three-quarter speed</option><option value="1">Full speed</option></select></label>
      <label>Section from event<input type="number" min="1" max={to} disabled={playing || pending} value={from} onChange={event => setFrom(Math.max(1, Math.min(to, Number(event.target.value) || 1)))}/></label>
      <label>Section to event<input type="number" min={from} max={song.events.length} disabled={playing || pending} value={to} onChange={event => setTo(Math.max(from, Math.min(song.events.length, Number(event.target.value) || from)))}/></label>
      <label>Count-in<select aria-label="Count-in" disabled={playing || pending} value={countIn} onChange={event => setCountIn(Number(event.target.value))}><option value="0">No count-in</option><option value="4">4 beats</option><option value="8">8 beats</option></select></label>
    </div>
    <label className="check"><input type="checkbox" disabled={playing || pending} checked={repeat} onChange={event => setRepeat(event.target.checked)}/>Repeat song section</label>
    <label className="check"><input type="checkbox" disabled={playing || pending} checked={withBacking} onChange={event => setWithBacking(event.target.checked)}/>Play song backing</label>
    <button disabled={pending} onClick={playing ? stop : () => void start()}>{pending ? 'Preparing song...' : playing ? 'Stop song' : 'Play song'}</button>
    <p role="status" data-testid="song-position">{count ? `Count-in ${count}/${countIn}` : position >= 0 ? `Playing event ${position + 1}: ${song.events[position].note === null ? 'Rest' : noteName(song.events[position].note!)}` : 'Song stopped'} · Next: {next >= 0 ? song.events[next].note === null ? 'Rest' : noteName(song.events[next].note!) : 'End'}</p>
    <ol className="song-strip" ref={strip} tabIndex={0} aria-label={`${song.title} scrolling score`}>
      {song.events.map((event, index) => {
        const midi = event.note;
        const strings = course.id === 'guitar' || course.id === 'bass' ? tunings[course.id] : null;
        const string = midi !== null && strings ? strings.findIndex(open => midi >= open && midi - open <= 12) : -1;
        return <li key={index} ref={node => { cards.current[index] = node; }} className={position === index ? 'song-current' : next === index ? 'song-next' : ''}
          aria-current={position === index ? 'step' : undefined} data-testid={`song-event-${index + 1}`}>
          <strong>{index + 1} · {midi === null ? 'Rest' : noteName(midi)}</strong><span>{event.beats} {event.beats === 1 ? 'beat' : 'beats'}{position === index ? ' · PLAY' : next === index ? ' · NEXT' : ''}</span>
          {midi !== null ? strings ? <span>{string >= 0 ? `Tab: string ${string + 1}, fret ${midi - strings[string]}` : 'Outside standard tab range'}</span> : <Staff notes={[midi]}/> : <span>Rest - release the note</span>}
        </li>;
      })}
    </ol>
    <p className="small muted">Original JSON scores include held notes, half-beats and rests. Notation uses written pitch; guitar/bass tab is sounding pitch and alto sax playback is nine semitones below its written notes. PLAY/NEXT labels work without colour. The count-in runs once; loops repeat the selected events with their backing.</p>
  </section>;
}
