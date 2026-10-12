import { useEffect, useRef, useState, type RefObject } from 'react';
import { median, timingHit, timingSummary, type BeatClock, type RhythmSource, type TimingHit } from './rhythm';

export type RhythmInput = (source: RhythmSource, time: number) => void;
export function RhythmScoring({ clock, input, active, running, clockVersion, onMistake }: {
  clock: RefObject<BeatClock | null>; input: RefObject<RhythmInput>;
  active: boolean; running: boolean; clockVersion: string; onMistake: (label: string) => void;
}) {
  const [scoring, setScoring] = useState(false);
  const [source, setSource] = useState<RhythmSource>('tap');
  const [latencies, setLatencies] = useState<Record<RhythmSource, number>>({ mic: 0, midi: 0, tap: 0 });
  const [hits, setHits] = useState<TimingHit[]>([]);
  const [expected, setExpected] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [calibration, setCalibration] = useState<number[]>([]);
  const [message, setMessage] = useState('Start the metronome or backing, then start scoring. One attack per beat.');
  const start = useRef<BeatClock | null>(null);
  const calibrationBeats = useRef(new Set<number>());
  input.current = (eventSource, time) => {
    if (!active || !running || eventSource !== source || !clock.current) return;
    if (calibrating) {
      const hit = timingHit(time, clock.current, 0, source);
      if (calibrationBeats.current.has(hit.beat)) return;
      calibrationBeats.current.add(hit.beat);
      setCalibration(values => [...values, hit.offset].slice(0, 8));
      return;
    }
    if (!scoring || !start.current) return;
    const hit = timingHit(time, start.current, latencies[source], source);
    if (hit.beat < 0 || hit.beat >= 256) return;
    setHits(values => [...values, hit].slice(-256));
    if (Math.abs(hit.offset) > 80) onMistake(`${source}: ${Math.round(Math.abs(hit.offset))} ms ${hit.offset < 0 ? 'early' : 'late'} on beat ${hit.beat + 1}`);
  };
  useEffect(() => {
    if (calibration.length < 8) return;
    const offset = Math.round(median(calibration));
    setLatencies(values => ({ ...values, [source]: offset }));
    setCalibrating(false);
    setMessage(`Calibration saved for ${source}: ${offset} ms. Includes this device's audio/input delay and your tapping bias; recalibrate after changing devices.`);
  }, [calibration, source]);
  useEffect(() => {
    setScoring(false); setCalibrating(false);
  }, [active, running, clockVersion]);
  useEffect(() => {
    if (!scoring) return;
    const timer = setInterval(() => {
      if (start.current) {
        const beats = Math.max(0, Math.floor((performance.now() - start.current.epoch - 150) / start.current.period) + 1);
        setExpected(Math.min(256, beats));
        if (beats >= 256) { setScoring(false); setMessage('256-beat take finished. Start a new scoring take to continue.'); }
      }
    }, 50);
    return () => clearInterval(timer);
  }, [scoring]);
  const total = Math.max(expected, ...hits.map(hit => hit.beat + 1), 0);
  const summary = timingSummary(hits, total);
  const latest = hits.at(-1);
  function begin() {
    const beatClock = clock.current;
    if (!beatClock) { setMessage('Beat clock is not ready. Start the metronome or backing first.'); return; }
    const next = Math.ceil((performance.now() + 250 - beatClock.epoch) / beatClock.period);
    start.current = { epoch: beatClock.epoch + next * beatClock.period, period: beatClock.period };
    setHits([]); setExpected(0); setCalibration([]); setCalibrating(false); setScoring(true);
    setMessage('Play or tap once on every beat. Use headphones for microphone scoring.');
  }
  return <section className="tool-card"><h3>Rhythm scoring</h3>
    <p className="small">A one-attack-per-beat timing drill, not a grade for the lesson's full written rhythm. Audio is scheduled on the same clock as metronome/backing. Microphone attacks use local onset detection; headphones prevent backing feedback.</p>
    <label>Rhythm input<select value={source} disabled={scoring || calibrating} onChange={event => { setSource(event.target.value as RhythmSource); setHits([]); setExpected(0); setCalibration([]); }}>
      <option value="tap">Tap / screen keys</option><option value="midi">MIDI note-on</option><option value="mic">Microphone attacks</option>
    </select></label>
    <label>Latency correction (ms)<input type="number" min="-500" max="500" value={latencies[source]} disabled={scoring || calibrating}
      onChange={event => setLatencies(values => ({ ...values, [source]: Math.max(-500, Math.min(500, Number(event.target.value) || 0)) }))}/></label>
    <div className="button-row">
      <button disabled={!active || !running} onClick={() => scoring ? setScoring(false) : begin()}>{scoring ? 'Stop rhythm scoring' : 'Start rhythm scoring'}</button>
      <button disabled={!active || !running || scoring} onClick={() => { calibrationBeats.current.clear(); setCalibration([]); setCalibrating(!calibrating); setMessage('Make eight attacks exactly with distinct clicks to estimate a median timing correction. Connect the selected microphone or MIDI input first.'); }}>{calibrating ? 'Cancel calibration' : 'Calibrate 8 beats'}</button>
      <button disabled={!active || !running || source !== 'tap'} onClick={() => input.current('tap', performance.now())}
        onKeyDown={event => { if (event.repeat) event.preventDefault(); }}>Tap beat</button>
    </div>
    <p role="status" data-testid="rhythm-status">{message} {calibrating && `${calibration.length}/8 calibration beats`}</p>
    <p data-testid="timing-summary">Timing accuracy {summary.accuracy}% · {hits.length} attacks · {summary.missed} missed · {summary.extras} extra</p>
    <p role="status" data-testid="timing-offset">{latest ? `Beat ${latest.beat + 1}: ${Math.round(Math.abs(latest.offset))} ms ${latest.offset < -10 ? 'early' : latest.offset > 10 ? 'late' : 'on time'}` : 'No attacks measured yet'}</p>
    <ol className="small">{hits.slice(-8).map((hit, index) => <li key={hits.length - 8 + index}>Beat {hit.beat + 1} · {Math.round(hit.offset)} ms ({hit.source})</li>)}</ol>
    <p className="small muted">Accuracy decreases linearly from 100% at 0 ms to 0% at ±150 ms; missed and extra attacks count against it. Offsets beyond ±80 ms become weak-rhythm reviews in a lesson session. Calibration is per input for this practice space; it does not auto-pass tempo ladders.</p>
  </section>;
}
