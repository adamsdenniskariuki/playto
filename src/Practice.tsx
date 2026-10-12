import { useEffect, useRef, useState } from 'react';
import { audio, detectPitch, noteName, pitchInfo } from './audio';
import { CHORD_CONFIDENCE, chordNames, matchChroma, spectrumChroma, type ChordReading } from './chords';
import { RhythmScoring, type RhythmInput } from './RhythmScoring';
import { OnsetDetector, type BeatClock } from './rhythm';
import { SongMode } from './SongMode';
import { RecordCompare } from './RecordCompare';
import { songs, type ReferenceScore } from './songs';
import { chordShapes, Fretboard, Piano, SaxChart, Staff } from './Visuals';
import type { Course, Lesson, PracticeResult, WeakKind } from './types';

interface MidiInput extends EventTarget { onmidimessage: ((event: { data: Uint8Array }) => void) | null }
interface MidiAccess extends EventTarget { inputs: Map<string, MidiInput>; onstatechange: (() => void) | null }
type MidiNavigator = Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> };
export function Practice({ course, lesson, passedTempos = [], onSave, report }: {
  course: Course; lesson?: Lesson; passedTempos?: number[];
  onSave: (seconds: number, notes: number, tempo: number, detail?: PracticeResult) => void;
  report: (message: string) => void;
}) {
  const targets = lesson?.targetNotes ?? (course.id === 'sax' ? [71,69,67] : course.id === 'bass' ? [28,33,38,43] : course.id === 'guitar' ? [40,45,50,55,59,64] : [60,62,64,65,67]);
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const ladderTarget = lesson?.tempoLadder?.find(bpm => !passedTempos.includes(bpm));
  const [tempo, setTempo] = useState(ladderTarget ?? 60);
  const [cleanTakes, setCleanTakes] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const mistakes = useRef<PracticeResult['mistakes']>([]);
  const [speed, setSpeed] = useState(1);
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(targets.length);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [backing, setBacking] = useState(false);
  const [beat, setBeat] = useState(0);
  const beatClock = useRef<BeatClock | null>(null);
  const rhythmInput = useRef<RhythmInput>(() => {});
  const [stopSignal, setStopSignal] = useState(0);
  const [songStopSignal, setSongStopSignal] = useState(0);
  const songReference = useRef<ReferenceScore>({ title: songs[course.id][0].title, tempo: 60, countIn: 4, events: songs[course.id][0].events, roots: songs[course.id][0].roots, transposition: course.id === 'sax' ? -9 : 0 });
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [steady, setSteady] = useState(false);
  const [chord, setChord] = useState(lesson?.chord ?? 'E minor');
  const [chordMode, setChordMode] = useState(false);
  const [chordReading, setChordReading] = useState<ChordReading>({ name: null, confidence: 0 });
  const [chordHits, setChordHits] = useState(0);
  const chordRef = useRef({ enabled: chordMode, target: chord });
  chordRef.current = { enabled: chordMode, target: chord };
  const [micStatus, setMicStatus] = useState('Not connected - microphone is off');
  const [micOn, setMicOn] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const [reading, setReading] = useState<ReturnType<typeof pitchInfo> | null>(null);
  const [midiStatus, setMidiStatus] = useState('MIDI not connected');
  const stream = useRef<MediaStream | null>(null);
  const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
  const frame = useRef(0);
  const micGeneration = useRef(0);
  const midiGeneration = useRef(0);
  const midi = useRef<MidiAccess | null>(null);
  const mounted = useRef(true);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const sessionRef = useRef({ start: sessionStart, hits, tempo, steady, cleanTakes, speed, ladderTarget });
  sessionRef.current = { start: sessionStart, hits, tempo, steady, cleanTakes, speed, ladderTarget };
  const target = targets[index % targets.length];
  const targetRef = useRef(target);
  const runningRef = useRef(sessionStart !== null);
  targetRef.current = target;
  runningRef.current = sessionStart !== null;
  const concert = (written: number) => written - (course.id === 'sax' ? 9 : 0);
  const transposition = course.id === 'sax' ? 9 : 0;
  const safeAudio = (action: Promise<void>) => { void action.catch(error => report(`Audio unavailable: ${error instanceof Error ? error.message : String(error)}`)); };
  function matchNote(written: number) {
    if (runningRef.current && written === targetRef.current) {
      setHits(value => value + 1);
      setIndex(value => (value + 1) % targets.length);
    } else if (runningRef.current && lesson) {
      markMistake('note', `Expected ${noteName(targetRef.current)}; played ${noteName(written)}`, [targetRef.current]);
    }
  }
  function markMistake(kind: WeakKind, label: string, notes = targets) {
    if (!runningRef.current || !lesson) return;
    mistakes.current.push({ kind, label, notes: [...new Set(notes)] });
    setMistakeCount(mistakes.current.length);
    setCleanTakes(false);
  }
  function play(written: number) { rhythmInput.current('tap', performance.now()); safeAudio(audio.note(concert(written))); matchNote(written); }
  function stopMic() {
    micGeneration.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(track => track.stop());
    sourceNode.current?.disconnect(); sourceNode.current = null;
    stream.current = null;
    setMicOn(false); setMicPending(false); setReading(null); setChordReading({ name: null, confidence: 0 }); setMicStatus('Not connected - microphone is off');
  }
  async function startMic() {
    if (!navigator.mediaDevices?.getUserMedia) { setMicStatus('Unavailable - use HTTPS and a browser that supports microphone input.'); return; }
    const generation = ++micGeneration.current;
    setMicPending(true); setMicStatus('Permission requested - check your browser microphone prompt');
    let acquired: MediaStream | null = null;
    try {
      // This call happens directly from the user's click, before any async audio setup.
      acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!mounted.current || generation !== micGeneration.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const context = await audio.ready();
      if (!mounted.current || generation !== micGeneration.current) return;
      const source = context.createMediaStreamSource(acquired);
      sourceNode.current = source;
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const spectrum = new Float32Array(analyser.frequencyBinCount);
      const onset = new OnsetDetector();
      let profile = Array<number>(12).fill(0), heldChord: string | null = null, stableChord: string | null = null, chordFrames = 0, quietChordFrames = 0;
      let held: number | null = null, candidate: number | null = null, stable = 0, silence = 0;
      let lastAnalysis = 0;
      setMicOn(true); setMicPending(false); setMicStatus('Connected - listening locally; audio is never uploaded');
      const listen = (time: number) => {
        if (generation !== micGeneration.current) { source.disconnect(); return; }
        analyser.getFloatTimeDomainData(samples);
        if (onset.detect(samples, time)) rhythmInput.current('mic', time);
        if (time - lastAnalysis > 70) {
          lastAnalysis = time;
          if (chordRef.current.enabled) {
            analyser.getFloatFrequencyData(spectrum);
            const current = spectrumChroma(spectrum, context.sampleRate, analyser.fftSize);
            profile = profile.map((value, i) => Math.max(current[i], value * 0.65));
            quietChordFrames = current.some(value => value > 0) ? 0 : quietChordFrames + 1;
            if (quietChordFrames >= 3) { profile.fill(0); heldChord = null; }
            const result = matchChroma(profile);
            setChordReading(result);
            if (result.name && result.confidence >= CHORD_CONFIDENCE) {
              chordFrames = stableChord === result.name ? chordFrames + 1 : 1;
              stableChord = result.name;
              if (chordFrames >= 3 && heldChord !== result.name && runningRef.current) {
                heldChord = result.name;
                const expected = chordRef.current.target === 'F barre' ? 'F major' : chordRef.current.target;
                if (result.name === expected) setChordHits(value => value + 1);
                else markMistake('chord', `Expected ${expected}; detected ${result.name}`);
              }
            } else { stableChord = null; chordFrames = 0; }
            setReading(null);
            frame.current = requestAnimationFrame(listen);
            return;
          }
          profile.fill(0); heldChord = null; stableChord = null; chordFrames = 0; quietChordFrames = 0;
          const frequency = detectPitch(samples, context.sampleRate);
          const info = frequency ? pitchInfo(frequency) : null;
          setReading(info);
          if (info && Math.abs(info.cents) <= 35) {
            silence = 0;
            if (candidate === info.midi) stable++; else { candidate = info.midi; stable = 1; }
            if (stable >= 3 && held !== info.midi) { held = info.midi; matchNote(info.midi + transposition); }
          } else if (!info) {
            if (++silence >= 3) { held = null; candidate = null; stable = 0; }
          }
        }
        frame.current = requestAnimationFrame(listen);
      };
      frame.current = requestAnimationFrame(listen);
      acquired.getTracks().forEach(track => { track.onended = () => {
        if (mounted.current && generation === micGeneration.current) {
          stopMic(); setMicStatus('Microphone disconnected - reconnect to continue.');
        }
      }; });
    } catch (error) {
      acquired?.getTracks().forEach(track => track.stop()); stream.current = null;
      sourceNode.current?.disconnect(); sourceNode.current = null;
      if (!mounted.current || generation !== micGeneration.current) return;
      setMicPending(false); setMicOn(false);
      const reason = error instanceof Error ? error.name : '';
      setMicStatus(reason === 'NotAllowedError' ? 'Permission denied - allow the microphone in browser site settings, then try again. You can still practise on screen.'
        : reason === 'NotFoundError' ? 'No microphone found - connect one and try again.'
        : `Microphone failed: ${error instanceof Error ? error.message : String(error)}. On-screen practice still works.`);
    }
  }
  function disconnectMidi() {
    midiGeneration.current++;
    if (midi.current) {
      midi.current.inputs.forEach(input => { input.onmidimessage = null; });
      midi.current.onstatechange = null;
    }
    midi.current = null;
    setMidiStatus('MIDI not connected');
  }
  async function connectMidi() {
    const request = (navigator as MidiNavigator).requestMIDIAccess;
    if (!request) { setMidiStatus('Web MIDI is unavailable in this browser. Try Chrome/Edge over HTTPS or use the on-screen keys.'); return; }
    const generation = ++midiGeneration.current;
    try {
      const access = await request.call(navigator);
      if (!mounted.current || generation !== midiGeneration.current) return;
      midi.current = access;
      const bind = () => {
        access.inputs.forEach(input => { input.onmidimessage = event => {
          const [status, note, velocity] = event.data;
          if ((status & 0xf0) === 0x90 && velocity > 0) { rhythmInput.current('midi', performance.now()); matchNote(note); }
        }; });
        setMidiStatus(access.inputs.size ? `MIDI connected - ${access.inputs.size} input(s); play a key` : 'MIDI enabled - connect a USB MIDI keyboard');
      };
      bind(); access.onstatechange = bind;
    } catch (error) { if (mounted.current) setMidiStatus(`MIDI permission or connection failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; micGeneration.current++; midiGeneration.current++;
      cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(track => track.stop());
      sourceNode.current?.disconnect(); sourceNode.current = null;
      if (midi.current) { midi.current.inputs.forEach(input => { input.onmidimessage = null; }); midi.current.onstatechange = null; }
      audio.stop();
      const session = sessionRef.current;
      if (session.start !== null) {
        const seconds = Math.floor((performance.now() - session.start) / 1000);
        sessionRef.current.start = null;
        const milestone = session.steady && seconds >= 30 ? session.tempo : 0;
        saveRef.current(seconds, session.hits, milestone, {
          seconds, notes: session.hits, tempo: milestone, mistakes: mistakes.current,
          ladderTempo: seconds >= 30 && session.cleanTakes && session.steady && session.speed === 1 && session.tempo === session.ladderTarget ? session.tempo : undefined
        });
      }
    };
  }, []);
  useEffect(() => {
    if (sessionStart === null) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - sessionStart) / 1000)), 500);
    return () => clearInterval(timer);
  }, [sessionStart]);
  useEffect(() => {
    if (!metronome && !backing) return;
    let count = 0, timer = 0, cancelled = false;
    safeAudio(audio.ready().then(() => {
      if (cancelled) return;
      const epoch = performance.now() + 150, period = 60000 / tempo;
      beatClock.current = { epoch, period };
      const schedule = () => {
        const now = performance.now();
        while (epoch + count * period < now + 100) {
          const delay = Math.max(0, (epoch + count * period - now) / 1000);
          if (metronome) safeAudio(audio.note(count % 4 === 0 ? 96 : 89, 0.07, delay, 0.07));
          if (backing) {
            const roots = course.id === 'guitar' ? [40,40,45,45] : [48,53,55,48];
            const root = roots[Math.floor(count / 4) % 4];
            safeAudio(audio.note(root + (count % 4 === 2 ? 7 : 0), 60 / tempo * 0.65, delay, 0.08));
          }
          count++;
        }
        setBeat(now < epoch ? 0 : Math.floor((now - epoch) / period) % 4 + 1);
      };
      schedule(); timer = window.setInterval(schedule, 25);
    }));
    return () => { cancelled = true; clearInterval(timer); beatClock.current = null; setBeat(0); };
  }, [metronome, backing, tempo, course.id]);
  useEffect(() => {
    if (!loop) return;
    const slice = targets.slice(loopStart - 1, loopEnd).map(concert);
    safeAudio(audio.pattern(slice, tempo * speed));
    const timer = window.setInterval(() => safeAudio(audio.pattern(slice, tempo * speed)), slice.length * 60000 / (tempo * speed));
    return () => { clearInterval(timer); audio.stop(); };
  }, [loop, loopStart, loopEnd, tempo, speed]);
  function finish() {
    if (sessionStart === null) return;
    const seconds = Math.floor((performance.now() - sessionStart) / 1000);
    sessionRef.current.start = null;
    const milestone = steady && seconds >= 30 ? tempo : 0;
    onSave(seconds, hits, milestone, { seconds, notes: hits, tempo: milestone, mistakes: mistakes.current,
      ladderTempo: seconds >= 30 && cleanTakes && steady && speed === 1 && tempo === ladderTarget ? tempo : undefined });
    mistakes.current = []; setMistakeCount(0); setCleanTakes(false);
    setSessionStart(null); setElapsed(0); setHits(0); setChordHits(0); setIndex(0); setSteady(false);
    setStopSignal(value => value + 1); setLoop(false); setMetronome(false); setBacking(false); stopMic(); disconnectMidi(); audio.stop();
  }
  return <div className="practice">
    <div className="practice-heading"><div><span className="eyebrow">YOUR PRACTICE SPACE</span><h3>Make a little music</h3></div>
      <span className="pill">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} · {hits} notes matched</span></div>
    <p className="muted">Start a session to track actual practice time. Sessions save when you finish or leave this practice space. Save before closing the browser. Chord estimates and beat-timing drills supplement musical self-assessment.</p>
    <div className="button-row">{sessionStart === null ? <button className="primary" onClick={() => { mistakes.current = []; setMistakeCount(0); setCleanTakes(false); setSessionStart(performance.now()); setIndex(0); setHits(0); setChordHits(0); }}>Start practice</button>
      : <button className="primary" onClick={finish}>Save practice session</button>}
      <button onClick={() => safeAudio(audio.pattern(targets.map(concert), tempo * speed))}>Hear pitch pattern</button>
      <button onClick={() => { setStopSignal(value => value + 1); setLoop(false); setMetronome(false); setBacking(false); audio.stop(); }}>Stop sound</button></div>
    <div className="target-note"><span>Next note</span><strong>{noteName(target)}</strong><span>{sessionStart === null ? 'Start practice to match notes' : 'Play, then release before repeating'}</span></div>
    {course.id === 'guitar' && <label className="chord-picker">Chord diagram <select aria-label="Chord diagram" value={chord} onChange={event => setChord(event.target.value)}>
      {Object.keys(chordShapes).map(name => <option key={name}>{name}</option>)}
    </select></label>}
    {course.id === 'keyboard' ? <Piano target={target} play={play}/>
      : course.id === 'sax' ? <SaxChart target={target} play={play}/>
      : <Fretboard instrument={course.id} target={target} play={play} chord={chord}/>}
    <Staff notes={targets} bass={course.id === 'bass'} octaveShift={course.id === 'guitar' || course.id === 'bass' ? 1 : 0}/>
    <SongMode course={course} lesson={lesson} stopSignal={stopSignal + songStopSignal} reference={songReference} report={report} onStart={() => { setLoop(false); setMetronome(false); setBacking(false); audio.stop(); }}/>
    <RecordCompare instrument={course.id} reference={songReference} stopSignal={stopSignal} report={report} onStart={() => { setSongStopSignal(value => value + 1); setLoop(false); setMetronome(false); setBacking(false); audio.stop(); }}/>
    {lesson && <section className="tool-card"><h3>Practise the tricky bits</h3>
      <p className="small">Wrong single notes from mic, MIDI or screen are saved as targeted reviews with this session. Mark chord clarity or rhythm difficulties yourself. {mistakeCount} difficulty report(s) this session.</p>
      <div className="button-row">{(['note','chord','rhythm'] as const).map(kind => <button key={kind} disabled={sessionStart === null} onClick={() => markMistake(kind, kind === 'note' ? noteName(target) : kind === 'chord' ? lesson.chord ?? `${lesson.title}: harmony` : `${lesson.title}: written rhythm`, kind === 'note' ? [target] : targets)}>Mark weak {kind}</button>)}</div>
    </section>}
    <div className="tool-grid">
      <section className="tool-card"><h3>Listen & tune</h3><p className="small">Use headphones in a quiet space to avoid detecting Playto's sounds. Single-note tuner range: about 35-1600 Hz.</p>
        {(course.id === 'keyboard' || course.id === 'guitar') && <>
          <label className="check"><input type="checkbox" checked={chordMode} onChange={event => { setChordMode(event.target.checked); setChordReading({ name: null, confidence: 0 }); }}/>Listen for chords instead of single notes</label>
          {chordMode && <>
            <label>Chord to practise<select aria-label="Chord to practise" value={chord === 'F barre' ? 'F major' : chord} onChange={event => { setChord(event.target.value); setChordHits(0); }}>
              {chordNames.map(name => <option key={name}>{name}</option>)}
            </select></label>
            <p role="status" data-testid="chord-reading">{chordReading.name ?? 'No clear chord'} · Confidence {Math.round(chordReading.confidence * 100)}% · {chordHits} chords matched</p>
            <p className="small">{chordReading.confidence >= CHORD_CONFIDENCE ? 'Confident estimate. Sustain the whole chord, then release before repeating.' : 'Low confidence - use self-assessment. Check every string/key sounds clearly.'}</p>
            <p className="small muted">Local FFT pitch-class matching supports major/minor, 7, maj7, m7 and add9 chords, including strums. It cannot grade voicing, technique or musical expression. Estimates are not lesson passes.</p>
          </>}
        </>}
        <button disabled={micPending} onClick={micOn ? stopMic : startMic}>{micPending ? 'Requesting permission...' : micOn ? 'Disconnect microphone' : 'Connect microphone'}</button>
        <p className="small" role="status" data-testid="mic-status">{micStatus}</p>
        {!chordMode && <div className="tuner" data-testid="tuner"><strong>{reading?.name ?? '--'}</strong><span>{reading ? `${reading.frequency.toFixed(1)} Hz · ${reading.cents > 0 ? '+' : ''}${reading.cents} cents` : 'Play a single sustained note'}</span>
          <div className="tuner-track"><i style={{ left: `${50 + Math.max(-50, Math.min(50, reading?.cents ?? 0))}%` }}/></div>
          <span>{reading ? Math.abs(reading.cents) <= 10 ? 'In tune' : reading.cents < 0 ? 'Flat - raise pitch gently' : 'Sharp - lower pitch gently' : 'A4 reference = 440 Hz'}</span></div>}
        {course.id === 'sax' && <p className="small">Tuner displays concert pitch. Written B4 on alto sax sounds concert D4.</p>}
        {course.id === 'keyboard' && <><button onClick={midi.current ? disconnectMidi : connectMidi}>{midi.current ? 'Disconnect MIDI' : 'Connect MIDI keyboard'}</button><p role="status" className="small">{midiStatus}</p></>}
      </section>
      <section className="tool-card"><h3>Find your groove</h3>
        <label htmlFor="tempo">Tempo · {tempo} BPM</label><input id="tempo" type="range" min="40" max="180" step="5" value={tempo} onChange={event => { setTempo(Number(event.target.value)); setSteady(false); setCleanTakes(false); }}/>
        <div className="beat-dots" aria-label={`Beat ${beat || 'stopped'} of four`}>{[1,2,3,4].map(value => <span key={value} className={beat === value ? 'active' : ''}>{value}</span>)}</div>
        <div className="button-row"><button aria-pressed={metronome} onClick={() => { safeAudio(audio.ready().then(() => {})); setMetronome(!metronome); }}>{metronome ? 'Stop metronome' : 'Start metronome'}</button>
          <button aria-pressed={backing} onClick={() => { safeAudio(audio.ready().then(() => {})); setBacking(!backing); }}>{backing ? 'Stop backing' : 'Start backing'}</button></div>
        <p className="small muted">{course.id === 'guitar' ? 'Original Em / Em / Am / Am backing.' : 'Original C / F / G / C backing (concert pitch).'} Four beats per bar, synthesized locally.</p>
        <label className="check"><input type="checkbox" checked={steady} onChange={event => setSteady(event.target.checked)} disabled={sessionStart === null}/>I kept a steady pulse at this tempo for at least 30 seconds.</label>
        <p className="small muted">Tempo milestones are self-assessed and saved only after 30 seconds of practice.</p>
        {lesson?.tempoLadder && <section><h4>Tempo ladder</h4><p data-testid="tempo-ladder">{lesson.tempoLadder.map(bpm => `${bpm} BPM${passedTempos.includes(bpm) ? ' passed' : bpm === ladderTarget ? ' next' : ''}`).join(' · ')}</p>
          {ladderTarget ? <><button disabled={sessionStart !== null} onClick={() => { setTempo(ladderTarget); setSpeed(1); }}>Set ladder target · {ladderTarget} BPM</button>
            <label className="check"><input type="checkbox" disabled={sessionStart === null || tempo !== ladderTarget || speed !== 1 || elapsed < 30} checked={cleanTakes} onChange={event => setCleanTakes(event.target.checked)}/>I played two complete, clean takes of this lesson's written pattern at {ladderTarget} BPM, at full speed.</label></> : <p>All targets passed. Replay for expression and consistency.</p>}
          <p className="small muted">Save at least 30 seconds with a steady pulse and two clean takes to pass one target. This is self-assessed; pitch hits alone do not prove rhythm or chord accuracy.</p>
        </section>}
      </section>
      <RhythmScoring clockVersion={`${tempo}-${metronome}-${backing}`} clock={beatClock} input={rhythmInput} active={metronome || backing} running={sessionStart !== null} onMistake={label => markMistake('rhythm', label)}/>
      <section className="tool-card"><h3>Slow it down</h3>
        <label htmlFor="speed">Pitch pattern speed</label><select id="speed" value={speed} onChange={event => { setSpeed(Number(event.target.value)); setCleanTakes(false); }}><option value="0.5">Half speed</option><option value="0.75">Three-quarter speed</option><option value="1">Full speed</option></select>
        <div className="loop-inputs"><label>From note<input type="number" min="1" max={loopEnd} value={loopStart} onChange={event => setLoopStart(Math.max(1, Math.min(loopEnd, Number(event.target.value) || 1)))}/></label>
          <label>To note<input type="number" min={loopStart} max={targets.length} value={loopEnd} onChange={event => setLoopEnd(Math.max(loopStart, Math.min(targets.length, Number(event.target.value) || targets.length)))}/></label></div>
        <button aria-pressed={loop} onClick={() => setLoop(!loop)}>{loop ? 'Stop loop' : 'Loop selected notes'}</button>
        <p className="small muted">Loops use equal-length notes. For held notes and rests, follow the lesson's written counts with the metronome instead.</p>
      </section>
    </div>
  </div>;
}
