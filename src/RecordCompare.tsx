import { useEffect, useRef, useState, type RefObject } from 'react';
import { AudioEngine } from './audio';
import { scoreTimeline, type ReferenceScore } from './songs';
import { deleteTake, readTakes, storeTake, TAKE_BYTES, TAKE_COUNT, TAKE_SECONDS, type Take } from './takes';
import type { InstrumentId } from './types';

export function RecordCompare({ instrument, reference, stopSignal, onStart, report }: {
  instrument: InstrumentId; reference: RefObject<ReferenceScore>; stopSignal: number;
  onStart: () => void; report: (message: string) => void;
}) {
  const [takes, setTakes] = useState<Take[]>([]), [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false), [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0), [message, setMessage] = useState('Recording is off.');
  const [unsaved, setUnsaved] = useState<Take | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false), [comparing, setComparing] = useState(false);
  const [alignment, setAlignment] = useState(0), [url, setUrl] = useState('');
  const mounted = useRef(true), generation = useRef(0), timer = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null), engine = useRef(new AudioEngine());
  const take = takes.find(item => item.id === selected);
  async function refresh() {
    try {
      const list = (await readTakes()).filter(item => item.instrument === instrument);
      if (mounted.current) { setTakes(list); setSelected(value => list.some(item => item.id === value) ? value : list[0]?.id ?? ''); }
    } catch (error) { report(`Recording storage unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  }
  function stopComparison() { player.current?.pause(); engine.current.stop(); setComparing(false); }
  function stopRecording() {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    engine.current.stop();
  }
  useEffect(() => { mounted.current = true; void refresh(); return () => {
    mounted.current = false; generation.current++; clearInterval(timer.current);
    stopRecording(); player.current?.pause();
    void engine.current.dispose().catch(error => report(`Recording audio cleanup failed: ${String(error)}`));
  }; }, []);
  useEffect(() => { stopComparison(); }, [stopSignal]);
  useEffect(() => {
    stopComparison(); setConfirmDelete(false);
    const next = take ? URL.createObjectURL(take.blob) : '';
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [take?.id]);
  function schedule(score: ReferenceScore, origin: number) {
    const beat = 60 / score.tempo;
    for (let i = 0; i < score.countIn; i++) engine.current.noteAt(i % 4 === 0 ? 96 : 89, 0.07, origin + i * beat, 0.05);
    const first = origin + score.countIn * beat, timeline = scoreTimeline(score.events);
    for (const event of timeline) if (event.note !== null) engine.current.noteAt(event.note + score.transposition, event.beats * beat * 0.85, first + event.start * beat, 0.07);
    if (score.roots.length) for (let i = 0; i < (timeline.at(-1)?.end ?? 0); i++) {
      engine.current.noteAt(score.roots[Math.floor(i / 4) % score.roots.length] + (i % 4 === 2 ? 7 : 0), beat * 0.65, first + i * beat, 0.04);
    }
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('Recording is unavailable. Use a MediaRecorder-capable browser over HTTPS.'); return;
    }
    const request = ++generation.current;
    setPending(true); setMessage('Microphone permission requested for recording. Audio stays on this device.');
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!mounted.current || request !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const context = await engine.current.ready();
      if (!mounted.current || request !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stopComparison(); onStart();
      const snapshot = structuredClone(reference.current), started = performance.now();
      const media = new MediaRecorder(acquired), chunks: Blob[] = [];
      let bytes = 0, failed = false;
      recorder.current = media;
      media.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes >= TAKE_BYTES && media.state === 'recording') stopRecording();
      };
      media.onerror = () => { failed = true; stopRecording(); report('Recording failed in the browser. Try a different supported browser or microphone.'); };
      media.onstop = () => {
        clearInterval(timer.current); acquired?.getTracks().forEach(track => track.stop());
        stream.current = null; recorder.current = null; engine.current.stop();
        if (mounted.current) { setRecording(false); setPending(false); }
        if (failed || !bytes) { if (mounted.current) setMessage('No usable audio was captured. Try again.'); return; }
        const captured: Take = { id: crypto.randomUUID(), instrument, createdAt: Date.now(),
          seconds: (performance.now() - started) / 1000, reference: snapshot, blob: new Blob(chunks, { type: media.mimeType || chunks[0].type }) };
        void storeTake(captured).then(removed => {
          if (mounted.current) { setMessage(`Take saved locally.${removed ? ` ${removed} oldest take(s) removed to stay within the cap.` : ''}`); setUnsaved(null); void refresh(); }
        }).catch(error => {
          if (mounted.current) { setUnsaved(captured); setMessage('Take was not saved. Download the unsaved take before leaving.'); }
          report(`Take storage failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      };
      acquired.getTracks().forEach(track => { track.onended = () => { if (media.state === 'recording') { setMessage('Microphone disconnected; saving the captured audio.'); stopRecording(); } }; });
      media.start(1000); setRecording(true); setPending(false); setSeconds(0);
      setMessage('RECORDING - use headphones. Play after the count-in; Stop & save take when finished.');
      schedule(snapshot, context.currentTime + 0.15);
      timer.current = window.setInterval(() => {
        const elapsed = (performance.now() - started) / 1000;
        setSeconds(Math.floor(elapsed));
        if (elapsed >= TAKE_SECONDS) stopRecording();
      }, 250);
    } catch (error) {
      acquired?.getTracks().forEach(track => track.stop()); stream.current = null;
      if (!mounted.current || request !== generation.current) return;
      setPending(false); setRecording(false);
      setMessage(`Recording could not start: ${error instanceof Error ? error.message : String(error)}. Check microphone permissions and available devices.`);
    }
  }
  async function compare() {
    if (!take || !player.current) return;
    try {
      stopComparison(); onStart();
      const context = await engine.current.ready();
      player.current.currentTime = Math.max(0, -alignment / 1000);
      await player.current.play();
      schedule(take.reference, context.currentTime + 0.15 + Math.max(0, alignment / 1000));
      setComparing(true);
    } catch (error) { stopComparison(); report(`Comparison playback failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function remove() {
    if (!take) return;
    try { stopComparison(); await deleteTake(take.id); setConfirmDelete(false); await refresh(); setMessage('Take deleted from this device.'); }
    catch (error) { report(`Take deletion failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  function download(item: Take) {
    const local = URL.createObjectURL(item.blob), anchor = document.createElement('a');
    anchor.href = local; anchor.download = `playto-${instrument}-${item.createdAt}.${item.blob.type.includes('mp4') ? 'mp4' : item.blob.type.includes('ogg') ? 'ogg' : 'webm'}`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(local), 1000);
  }
  return <section className="tool-card record-compare"><h3>Record & compare</h3>
    <p className="small">Record your selected song-mode score with its count-in/reference. Headphones keep the reference out of the microphone. Recording begins only when you tap Record take and permit the microphone; no audio is uploaded.</p>
    <div className="button-row">
      <button disabled={pending || recording || Boolean(unsaved)} onClick={() => void record()}>{pending ? 'Preparing recording...' : 'Record take'}</button>
      <button disabled={!recording} onClick={stopRecording}>Stop & save take</button>
    </div>
    <p role="status" data-testid="record-status">{message} {recording && `${seconds}s / ${TAKE_SECONDS}s`}</p>
    {unsaved && <button onClick={() => download(unsaved)}>Download unsaved take</button>}
    <p className="small muted">Device-wide cap: {TAKE_COUNT} takes / 50 MB, five minutes per take. Saving a new take automatically removes the oldest when needed. Recordings are in IndexedDB, not progress JSON backups; download anything you want to keep. Clearing browser storage removes them.</p>
    {takes.length > 0 ? <>
      <label>Recent take<select aria-label="Recent take" disabled={recording || pending} value={selected} onChange={event => setSelected(event.target.value)}>
        {takes.map(item => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.reference.title} · {Math.round(item.seconds)}s</option>)}
      </select></label>
      <audio ref={player} controls src={url || undefined} aria-label="Recorded take playback" onEnded={stopComparison} onPause={() => { engine.current.stop(); setComparing(false); }} onError={() => report('This recording could not be played by the browser.')}/>
      <label>Reference alignment (ms)<input type="number" min="-1000" max="1000" disabled={recording || comparing} value={alignment} onChange={event => setAlignment(Math.max(-1000, Math.min(1000, Number(event.target.value) || 0)))}/></label>
      <p className="small muted">Positive alignment delays the reference; negative starts further into the take. Adjust by ear for device latency. Comparison is listening-based, not an automatic performance grade.</p>
      <div className="button-row"><button disabled={recording || pending || !url} onClick={() => comparing ? stopComparison() : void compare()}>{comparing ? 'Stop comparison' : 'Compare with reference'}</button>
        <button disabled={recording || pending} onClick={() => take && download(take)}>Download take</button>
        <button disabled={recording || pending} onClick={() => setConfirmDelete(true)}>Delete take</button>
        {confirmDelete && <><button onClick={() => void remove()}>Confirm delete take</button><button onClick={() => setConfirmDelete(false)}>Keep take</button></>}</div>
    </> : <p>No saved takes for this instrument yet.</p>}
  </section>;
}
