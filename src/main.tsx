import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/merriweather/latin-700.css';
import '@fontsource/comic-neue/latin-400.css';
import '@fontsource/comic-neue/latin-700.css';
import './styles.css';
import { courses } from './courses';
import { addPractice, badges, completeLesson, currentStreak, freshProgress, parseProgress, reviewLesson, STORAGE_KEY } from './progress';
import { InstrumentMark } from './Visuals';
import { Practice } from './Practice';
import { EarTraining } from './EarTraining';
import { SkillReview } from './SkillReview';
import { availableLesson, stageBadges } from './curriculum';
import { dayKey, recordMistake, reviewWeak, savePracticeResult, saveRoutineResult } from './progress';
import { PracticePlanner } from './PracticePlanner';
import { InstrumentPreferences } from './InstrumentPreferences';
import { fontLabels, isFont, isTheme, resolveTheme, themeLabels } from './appearance';
import type { Course, Lesson, PracticeResult, Progress, WeakKind } from './types';

type Page = 'learn' | 'practice' | 'review' | 'progress' | 'settings';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function Dialog({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="dialog-title">
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="Close dialog">×</button></div>{children}
  </dialog>;
}
function LessonView({ course, lesson, completed, due, passedTempos, onMistake, onComplete, onReview, onSave, report, close }: {
  course: Course; lesson: Lesson; completed: boolean; due: boolean; onComplete: () => void;
  passedTempos: number[]; onMistake: (kind: WeakKind, notes?: number[], label?: string) => void;
  onReview: (easy: boolean) => void; onSave: (seconds: number, hits: number, tempo: number, detail?: PracticeResult) => void;
  report: (message: string) => void; close: () => void;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [testAnswers, setTestAnswers] = useState<Record<number, number>>({});
  const correct = answer === lesson.quiz.answer;
  const passed = checked && correct && (lesson.checks ?? []).every((_, index) => checks[index]) &&
    (lesson.testQuestions ?? []).every((quiz, index) => testAnswers[index] === quiz.answer);
  return <article className="lesson-view">
    <button className="back" onClick={close}>← Back to your path</button>
    <div className="lesson-title"><span className="eyebrow">{course.name} / {lesson.stage} / {lesson.kind}</span><h1>{lesson.title}</h1><p>{lesson.goal}</p><span className="pill">Suggested {lesson.minutes} min · go at your own pace</span></div>
    <section className="panel"><h2>Let's play</h2><ol className="steps">{lesson.steps.map(step => <li key={step}>{step}</li>)}</ol><aside className="tip"><strong>A small tip</strong><p>{lesson.tip}</p></aside><div className="pattern"><strong>Your pattern</strong><p>{lesson.pattern}</p></div></section>
    <Practice course={course} lesson={lesson} passedTempos={passedTempos} onSave={onSave} report={report}/>
    <EarTraining report={report} onMistake={(notes, label) => onMistake('note', notes.map(note => note + (course.id === 'sax' ? 9 : 0)), label)}/>
    <section className="panel"><h2>A quick check</h2><fieldset><legend>{lesson.quiz.question}</legend>{lesson.quiz.options.map((option, index) => <label className={`quiz-option ${answer === index ? 'selected' : ''}`} key={option}><input type="radio" name="quiz" checked={answer === index} onChange={() => { setAnswer(index); if (index !== lesson.quiz.answer) onMistake(lesson.focus === 'harmony' ? 'chord' : lesson.focus === 'rhythm' ? 'rhythm' : 'note'); }}/>{option}</label>)}</fieldset>
      {answer !== null && <p role="status" className="tip">{correct ? 'Exactly. ' : 'Try again. '}{lesson.quiz.explanation}</p>}
      {lesson.testQuestions?.map((quiz, question) => <fieldset key={question}><legend>{quiz.question}</legend>{quiz.options.map((option, index) => <label className="quiz-option" key={option}><input type="radio" name={`stage-quiz-${question}`} checked={testAnswers[question] === index} onChange={() => { setTestAnswers(current => ({ ...current, [question]: index })); if (index !== quiz.answer) onMistake('note'); }}/>{option}</label>)}{testAnswers[question] !== undefined && <p className="small" role="status">{testAnswers[question] === quiz.answer ? 'Correct. ' : 'Revisit this unit: '}{quiz.explanation}</p>}</fieldset>)}
      {lesson.checks?.map((goal, index) => <label className="check" key={goal}><input type="checkbox" checked={Boolean(checks[index])} onChange={event => setChecks(current => ({ ...current, [index]: event.target.checked }))}/>{goal}</label>)}
      <label className="check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>{lesson.assessment}</label>
      {!completed ? <><button className="primary" disabled={!passed} onClick={onComplete}>Complete lesson · +{lesson.kind === 'stage-test' ? 100 : lesson.kind === 'checkpoint' ? 75 : 50} XP</button><p className="small muted">Complete every check and tick your playing goals. Microphone use is optional.</p></>
        : due ? <div className="button-row"><button disabled={!passed} onClick={() => onReview(false)}>Review: needs practice · +15 XP</button><button className="primary" disabled={!passed} onClick={() => onReview(true)}>Review: feels confident · +15 XP</button></div>
          : <p className="tip">Lesson completed. Replay any time; your next spaced review will appear when due.</p>}
    </section>
  </article>;
}
function App() {
  const [initial] = useState(() => {
    try { const stored = localStorage.getItem(STORAGE_KEY); return { progress: stored ? parseProgress(stored) : freshProgress(), error: '' }; }
    catch (error) { return { progress: freshProgress(), error: `Saved progress could not be loaded: ${error instanceof Error ? error.message : String(error)}. Your original data has not been overwritten. Export it or import a valid backup before saving.` }; }
  });
  const [progress, setProgress] = useState(initial.progress);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [message, setMessage] = useState(initial.error);
  const [page, setPage] = useState<Page>('learn');
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [selectedWeak, setSelectedWeak] = useState<string | null>(null);
  const [style, setStyle] = useState('All styles');
  const [tour, setTour] = useState(!initial.progress.settings.tourSeen);
  const [tourStep, setTourStep] = useState(0);
  const [confirmImport, setConfirmImport] = useState<Progress | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [plannerActive, setPlannerActive] = useState(false);
  const course = courses.find(item => item.id === progress.instrument) ?? courses[0];
  const record = progress.instruments[course.id];
  const completed = course.lessons.filter(lesson => record.lessons[lesson.id]);
  const due = course.lessons.filter(lesson => record.lessons[lesson.id] && Date.parse(record.lessons[lesson.id].reviewAt) <= Date.now());
  const weakDue = Object.entries(record.weak).filter(([, item]) => Date.parse(item.reviewAt) <= Date.now() && course.lessons.some(lesson => lesson.id === item.lessonId));
  const next = course.lessons.find(lesson => !record.lessons[lesson.id] && availableLesson(course, lesson, record.lessons));
  const level = Math.floor(progress.xp / 250) + 1;
  const streak = currentStreak(progress);
  function save(value: Progress | ((current: Progress) => Progress)) {
    setProgress(current => {
      const next = typeof value === 'function' ? value(current) : value;
      if (storageBlocked) setMessage('Progress is in memory only until you import a valid backup. Export your current session before closing.');
      else {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
        catch (error) { setMessage(`Progress could not be saved on this device: ${error instanceof Error ? error.message : String(error)}. Export a backup before closing.`); }
      }
      return next;
    });
  }
  function navigate(value: Page) { setPage(value); setSelected(null); setSelectedWeak(null); window.scrollTo({ top: 0 }); }
  function chooseInstrument(id: Course['id']) {
    save(current => ({ ...current, instrument: id }));
    setSelected(null); setSelectedWeak(null); setStyle('All styles');
  }
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const override = new URLSearchParams(location.search).get('scoutTheme');
      const { mode, palette } = resolveTheme(isTheme(override) ? override : progress.settings.theme, media.matches);
      document.documentElement.dataset.theme = mode;
      document.documentElement.dataset.palette = palette;
      document.documentElement.dataset.font = progress.settings.font;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
        getComputedStyle(document.documentElement).getPropertyValue('--cp-bg').trim());
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [progress.settings.theme, progress.settings.font]);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    window.addEventListener('beforeinstallprompt', capture);
    let active = true;
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js').then(registration => {
        if (registration.waiting && active) setUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller && active) setUpdate(worker);
          });
        });
        return navigator.serviceWorker.ready;
      }).then(() => { if (active) setOfflineReady(true); }).catch(error => { if (active) setMessage(`Offline installation failed: ${error instanceof Error ? error.message : String(error)}. Online lessons still work.`); });
    }
    return () => { active = false; window.removeEventListener('beforeinstallprompt', capture); };
  }, []);
  function exportBackup(raw = false) {
    try {
      const data = raw ? localStorage.getItem(STORAGE_KEY) : JSON.stringify(progress, null, 2);
      if (!data) { setMessage('No stored data to export.'); return; }
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = raw ? 'playto-recovery.json' : 'playto-progress.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Backup exported. Keep it somewhere safe; progress stays on this device.');
    } catch (error) { setMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Backup is too large (maximum 2 MB).');
      setConfirmImport(parseProgress(await file.text()));
    } catch (error) { setMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}. Your current progress is unchanged.`); }
    if (importInput.current) importInput.current.value = '';
  }
  const weakItem = selectedWeak ? record.weak[selectedWeak] : undefined;
  const practiceLesson = selected ?? (weakItem ? course.lessons.find(lesson => lesson.id === weakItem.lessonId) : undefined);
  const onSave = (seconds: number, hits: number, tempo: number, detail?: PracticeResult) => {
    save(current => detail ? savePracticeResult(current, course.id, practiceLesson, detail) : addPractice(current, course.id, seconds, hits, tempo));
    setMessage(`Saved ${Math.floor(seconds / 60)}m ${seconds % 60}s of ${course.name} practice and ${hits} matched notes.${detail?.mistakes.length ? ' Difficulties are ready in Spaced review.' : ''}`);
  };
  const endTour = () => { setTour(false); save({ ...progress, settings: { ...progress.settings, tourSeen: true } }); };
  const totalMinutes = Object.values(progress.instruments).reduce((sum, item) => sum + item.minutes, 0);
  return <InstrumentPreferences.Provider value={{ leftHanded: progress.settings.leftHanded }}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('learn'); }}><span className="brand-icon">♪</span>playto<span className="brand-dot">.</span></a>
      <span className="header-tag">A little practice. A lot of music.</span>
      <div className="header-stats"><span className="stat-chip" title="All instruments combined"><span aria-hidden="true" className="chip-icon">★</span><span>{progress.xp} XP</span></span><span className="stat-chip"><span aria-hidden="true" className="chip-icon">🔥</span><span>{streak} day streak</span></span><span className="level"><span>Level {level}</span><progress className="level-progress" max={250} value={progress.xp % 250} aria-label="Level progress"/></span></div>
    </header>
    <div className="app-layout">
      <aside className="sidebar"><div className="sidebar-top"><span className="eyebrow">YOUR MUSIC, YOUR PACE</span><nav aria-label="Main navigation">
        {(['learn','practice','review','progress','settings'] as Page[]).map((item, index) => <button key={item} className={page === item ? 'nav-item current' : 'nav-item'} aria-current={page === item ? 'page' : undefined} onClick={() => navigate(item)}><span aria-hidden="true">{['▤','♫','↻','☆','⚙'][index]}</span>{item === 'learn' ? 'My learning path' : item === 'review' ? 'Spaced review' : item[0].toUpperCase() + item.slice(1)}{item === 'review' && due.length + weakDue.length > 0 && <b>{due.length + weakDue.length}</b>}</button>)}
      </nav><label htmlFor="instrument" className="eyebrow instrument-label">CURRENT INSTRUMENT</label><select id="instrument" value={course.id} onChange={event => { const chosen = courses.find(item => item.id === event.target.value); if (chosen) chooseInstrument(chosen.id); }}>
        {courses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className="sidebar-course"><InstrumentMark instrument={course.id}/><strong>{course.name}</strong><p className="small muted">{completed.length} of {course.lessons.length} lessons complete</p><progress max={course.lessons.length} value={completed.length} aria-label="Course completion"/></div></div>
      <div className="sidebar-bottom"><span className="offline-dot"/> {offlineReady ? 'Ready for offline practice' : 'Offline preparation in progress'}<p className="small muted">No accounts. No ads. Just music.</p><a href="https://langto.madebyfavor.com">Meet our sister site, Langto ↗</a></div></aside>
      <main id="main" tabIndex={-1}>
        {message && <div className="notice" role="status"><span>{message}</span><button aria-label="Dismiss notification" onClick={() => setMessage('')}>×</button></div>}
        {update && <div className="notice"><span>A new Playto version is ready. Save your practice session before updating.</span><button onClick={() => { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); update.postMessage('SKIP_WAITING'); }}>Update & reload</button></div>}
        {weakItem && practiceLesson ? <><button className="back" onClick={() => setSelectedWeak(null)}>Back to reviews</button><SkillReview key={selectedWeak} course={course} lesson={practiceLesson} item={weakItem} passedTempos={record.ladders[practiceLesson.id] ?? []} onSave={onSave} report={setMessage} onReview={confident => { save(current => reviewWeak(current, course.id, selectedWeak!, confident)); setSelectedWeak(null); setMessage('Targeted review saved. The next repetition is scheduled.'); }}/></>
        : selected ? <LessonView key={`${course.id}-${selected.id}`} course={course} lesson={selected} close={() => setSelected(null)} completed={Boolean(record.lessons[selected.id])} due={due.some(lesson => lesson.id === selected.id)} report={setMessage} onSave={onSave}
          passedTempos={record.ladders[selected.id] ?? []} onMistake={(kind, notes, label) => save(current => recordMistake(current, course.id, selected.id, kind, label ?? `${selected.title}: knowledge check`, notes ?? selected.targetNotes))}
          onComplete={() => { save(current => completeLesson(current, course.id, selected)); setMessage('Lesson complete. A new step is ready, and your first review is tomorrow.'); setSelected(null); }}
          onReview={easy => { save(current => reviewLesson(current, course.id, selected.id, easy)); setMessage('Review saved. Your next review is scheduled.'); setSelected(null); }}/>
        : page === 'learn' ? <>
          <div className="page-heading"><div><span className="eyebrow">WELCOME TO YOUR NEXT NOTE</span><h1>Let's make music<span className="accent">.</span></h1><p className="muted">Small steps. Real instruments. A rhythm that works for you.</p></div><button className="quiet" onClick={() => { setTourStep(0); setTour(true); }}>How Playto works ↗</button></div>
          <section className="hero"><div className="hero-copy"><span className="pill">{course.subtitle}</span><h2>{completed.length === 0 ? 'Every musician starts\nwith one note.' : next ? 'Your next little\nbreakthrough awaits.' : 'Look how far\nyou have come.'}</h2><p>{course.description}</p><button className="primary" onClick={() => next ? setSelected(next) : navigate('review')}>{completed.length === 0 ? 'Play your first lesson' : next ? 'Continue learning' : 'Keep it fresh with review'} <span aria-hidden="true">→</span></button><span className="small muted">{next ? `${next.title} · ${next.minutes} min` : 'Revisit a lesson or try another instrument'}</span></div>
            <div className="hero-art" aria-hidden="true"><div className="music-orbit"><span className="orbit-note">♪</span><span className="orbit-note second">♫</span><InstrumentMark instrument={course.id}/></div><span className="art-caption">a few minutes, every day</span></div></section>
          <section className="instrument-section"><div className="section-heading"><h2>Pick your sound</h2><span className="muted small">Switch any time. Every journey is saved.</span></div><div className="instrument-grid">{courses.map(item => <button key={item.id} className={`instrument-card ${course.id === item.id ? 'chosen' : ''}`} aria-pressed={course.id === item.id} onClick={() => chooseInstrument(item.id)}><InstrumentMark instrument={item.id}/><strong>{item.name}</strong><span>{item.subtitle}</span><span className="small">{Object.keys(progress.instruments[item.id].lessons).length} lessons completed {course.id === item.id ? '· Selected' : ''}</span></button>)}</div></section>
          <section><div className="section-heading"><div><span className="eyebrow">ONE SMALL STEP AT A TIME</span><h2>Your {course.name.toLowerCase()} path</h2></div><span className="pill">{Math.round(completed.length / course.lessons.length * 100)}% complete</span></div>
            {course.units && <><p className="muted">Three stages, four seven-lesson units per stage, plus a stage test. Existing lessons stay completed; fill new gaps at your own pace. Stage badges require all unit goals.</p><label>Style track <select aria-label="Style track" value={style} onChange={event => setStyle(event.target.value)}>{['All styles', ...new Set(course.units.map(unit => unit.style))].map(item => <option key={item}>{item}</option>)}</select></label><p className="small muted">Style filtering helps you find repertoire; it does not skip prerequisites. Choose All styles to continue your full path.</p></>}
            {(['Beginner','Intermediate','Advanced'] as const).map(stage => {
              const lessons = course.lessons.filter(lesson => lesson.stage === stage && (!course.units || style === 'All styles' || lesson.style === style || lesson.kind === 'stage-test'));
              return lessons.length > 0 && <div className="path-stage" key={stage}><h3>{stage}<span>{stage === 'Beginner' ? 'Find your foundation' : stage === 'Intermediate' ? 'Build your musical vocabulary' : 'Make it your own'}</span></h3><div className="lesson-path">{lessons.map(lesson => {
                const index = course.lessons.indexOf(lesson), done = Boolean(record.lessons[lesson.id]), available = availableLesson(course, lesson, record.lessons);
                const unit = course.units?.find(item => item.id === lesson.unitId);
                const unitStart = unit?.lessonIds[0] === lesson.id;
                return <React.Fragment key={lesson.id}>{unitStart && <h4 className="unit-heading">{unit.title} <span className="small muted"> · {unit.style} · 7 lessons</span></h4>}
                <button className={`lesson-node ${done ? 'done' : available ? 'ready' : 'locked'}`} disabled={!available} onClick={() => { setSelected(lesson); window.scrollTo({ top: 0 }); }}>
                  <span className="node-number" aria-hidden="true">{done ? '✓' : available ? index + 1 : '·'}</span><span className="node-description"><strong>{lesson.title}</strong><span>{lesson.kind === 'stage-test' ? 'Stage test · badge' : lesson.kind === 'checkpoint' ? 'Checkpoint' : lesson.kind === 'piece' ? 'Original piece' : 'Lesson'} · {lesson.minutes} min{done ? ' · Completed' : !available ? ' · Complete prerequisites to unlock' : ' · Ready to play'}</span></span><span className="node-arrow" aria-hidden="true">→</span></button></React.Fragment>;
              })}</div></div>;
            })}
          </section><aside className="encouragement"><span aria-hidden="true">♫</span><div><strong>You don't have to be good to start.</strong><p className="muted">You just have to start to get better. Five minutes counts.</p></div></aside>
        </> : page === 'practice' ? <><div className="page-heading"><div><span className="eyebrow">NO PERFECT PERFORMANCE REQUIRED</span><h1>Your practice studio</h1><p className="muted">{course.tuning}</p></div></div>
          <PracticePlanner key={`${course.id}-${dayKey()}`} course={course} record={record} onActive={setPlannerActive} report={setMessage} onSave={(step, lesson, result) => {
            save(current => saveRoutineResult(current, course.id, lesson, result, step));
            setMessage(`Daily routine saved: ${result.seconds}s of ${course.name} practice. Resume whenever you are ready.`);
          }}/>
          {!plannerActive && <><Practice key={course.id} course={course} onSave={onSave} report={setMessage}/><EarTraining key={`ear-${course.id}`} report={setMessage}/></>}</>
        : page === 'review' ? <><span className="eyebrow">KEEP THE GOOD THINGS FRESH</span><h1>Spaced review</h1><p className="muted">Mistakes create specific note, chord and rhythm drills immediately. Confident reviews double their interval up to 60 days; difficult skills return tomorrow (+10 XP). Whole-lesson reviews start tomorrow (+15 XP).</p>
          {weakDue.map(([key, item]) => <button className="review-card panel" key={key} onClick={() => setSelectedWeak(key)}><strong>Weak {item.kind}: {item.label}</strong><span>{item.mistakes} mistake(s) · Targeted drill →</span></button>)}
          {due.map(lesson => <button className="review-card panel" key={lesson.id} onClick={() => setSelected(lesson)}><strong>{lesson.title}</strong><span>Ready to revisit →</span></button>)}
          {!due.length && !weakDue.length && <div className="empty panel"><span className="accent">↻</span><h2>{completed.length ? 'You are all caught up.' : 'Your first notes come first.'}</h2><p>Complete a lesson or mark a difficult skill during practice to build your review queue.</p><button onClick={() => navigate('learn')}>Back to learning</button></div>}</>
        : page === 'progress' ? <><span className="eyebrow">LITTLE STEPS ADD UP</span><h1>Your musical journey</h1><div className="stats-grid"><div className="panel"><strong>{progress.xp}</strong><span>Total XP · level {level}</span><progress value={progress.xp % 250} max={250} aria-label="Progress to next level"/><span className="small muted">{250 - progress.xp % 250} XP to next level</span></div><div className="panel"><strong>{Math.floor(totalMinutes)}</strong><span>Minutes practised</span></div><div className="panel"><strong>{streak}</strong><span>Day streak · {progress.freezes} freeze(s)</span><span className="small muted">One missed day is covered automatically. Earn a freeze every 7 streak days, up to 2.</span></div></div>
          <h2>By instrument</h2><div className="progress-courses">{courses.map(item => { const data = progress.instruments[item.id]; return <section className="panel" key={item.id}><h3>{item.name}</h3><p>{Object.keys(data.lessons).length} / {item.lessons.length} lessons · {Math.floor(data.minutes)} minutes · {data.notes} notes matched</p><p className="small muted">Tempo milestone: {data.tempo ? `${data.tempo} BPM (self-assessed)` : 'not set yet'} · Chords learned: {data.chords.length ? data.chords.join(', ') : 'none yet'}</p><progress value={Object.keys(data.lessons).length} max={item.lessons.length} aria-label={`${item.name} progress`}/></section>; })}</div>
          <h2>Small celebrations</h2><div className="badge-grid">{[...badges(progress), ...courses.filter(item => item.units).flatMap(item => stageBadges(item, progress.instruments[item.id].lessons))].map(badge => <div className={`panel badge ${badge.earned ? 'earned' : ''}`} key={badge.name}><span aria-hidden="true">{badge.earned ? '★' : '☆'}</span><strong>{badge.name}</strong><p>{badge.detail}</p><span className="small">{badge.earned ? 'Earned' : 'Keep playing'}</span></div>)}</div></>
        : <><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Settings</h1><section className="panel settings"><h2>A space that suits you</h2><label htmlFor="theme">Theme</label><select id="theme" value={progress.settings.theme} onChange={event => { const theme = event.target.value; if (isTheme(theme)) save({ ...progress, settings: { ...progress.settings, theme, themeChosen: true } }); }}>{Object.entries(themeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label htmlFor="font">Reading font</label><select id="font" value={progress.settings.font} onChange={event => { const font = event.target.value; if (isFont(font)) save({ ...progress, settings: { ...progress.settings, font, fontChosen: true } }); }}>{Object.entries(fontLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="muted">Stage and Andika are Playto's defaults. The new themes follow your device's light/dark setting; AMOLED uses true black in dark mode. All named fonts are bundled for offline use. Choose what feels easiest to read; font preferences are personal, not a treatment.</p><button onClick={() => save({ ...progress, settings: { ...progress.settings, theme: 'stage', font: 'andika', themeChosen: false, fontChosen: false } })}>Use Playto defaults</button><button onClick={() => { setTourStep(0); setTour(true); }}>Replay welcome tour</button></section>
          <section className="panel"><h2>Playing accessibility</h2>
            <label className="check"><input type="checkbox" checked={progress.settings.leftHanded} onChange={event => save({ ...progress, settings: { ...progress.settings, leftHanded: event.target.checked } })}/>Left-handed guitar and bass fretboards</label>
            <p className="small muted">Mirrors fret columns and chord diagrams without changing pitches or string numbers. Target stars, written note names and PLAY/NEXT labels never rely on colour alone. Piano/fretboards accept computer keys when focused; playing shortcuts do not capture typing in Settings or other fields.</p>
          </section>
          <section className="panel"><h2>Your progress belongs to you</h2><p>Nothing is sent to a server. Progress is saved in this browser, separately for every instrument. Clearing browser storage removes it, so keep a backup.</p><div className="button-row"><button className="primary" onClick={() => exportBackup()}>Export progress JSON</button><button onClick={() => importInput.current?.click()}>Import progress JSON</button>{storageBlocked && <button onClick={() => exportBackup(true)}>Export original stored data</button>}</div><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event => void importBackup(event.target.files?.[0])}/><p className="small muted">Import validates the entire file and asks before replacing anything. You can move your backup between devices.</p></section>
          <section className="panel"><h2>Take Playto with you</h2><p>{offlineReady ? 'All lessons, instruments, fonts and sounds are ready offline after this first visit.' : 'Visit online once and let offline preparation finish.'} On iPhone/iPad use Safari's Share menu → Add to Home Screen. On Android or desktop use the browser's Install app option.</p>{install && <button onClick={() => { void install.prompt().then(() => install.userChoice).then(choice => { setMessage(choice.outcome === 'accepted' ? 'Playto installation accepted.' : 'Installation dismissed. You can install later.'); setInstall(null); }).catch(error => setMessage(`Installation failed: ${String(error)}`)); }}>Install Playto</button>}<p className="small muted">Microphone and MIDI support depends on your browser. Both are optional. Audio processing stays on your device. Recordings are made only with Record take and are never uploaded.</p></section>
          <section className="panel"><h2>About the music</h2><p>All lesson pieces and synthesized backing patterns are original Playto exercises. Start slow, keep your body relaxed, and stop if you feel pain. These courses support practice; an instrument teacher can help with posture, setup and feedback.</p><a href="https://github.com/adamsdenniskariuki/playto">Source & curriculum ↗</a><p className="small"><a href="/font-license.txt">Bundled font licences</a> · SIL Open Font License 1.1</p></section></>}
        <footer>Made for the joy of playing. <span>playto · no pressure, just progress</span></footer>
      </main>
    </div>
    {tour && <Dialog title={['Welcome to Playto', 'Make it sound like you', 'Your progress, your pace'][tourStep]} close={endTour}><div className="tour-art"><InstrumentMark instrument={course.id}/></div><p>{['Pick an instrument. Tiny steps. Real music. Play a short lesson, and build a habit without accounts, ads, lives or leaderboards.', 'Hear the pitch pattern, use the interactive keys or fretboard, and try your own instrument. The microphone is optional and only turns on when you tap Connect microphone. Chords use your own honest assessment.', 'Save practice sessions to track time. Complete lessons to unlock your path and earn XP. Export a JSON backup in Settings, choose a comfortable font or theme, and return tomorrow for a spaced review.'][tourStep]}</p><div className="tour-footer"><span className="muted">Step {tourStep + 1} of 3</span><button onClick={endTour}>Skip tour</button><button className="primary" onClick={() => tourStep < 2 ? setTourStep(tourStep + 1) : endTour()}>{tourStep < 2 ? 'Next' : 'Let’s play'}</button></div></Dialog>}
    {confirmImport && <Dialog title="Replace device progress?" close={() => setConfirmImport(null)}><p>This backup contains {confirmImport.xp} XP. Import replaces all current progress and settings on this device. Export your current progress first if you want to keep both.</p><div className="button-row"><button onClick={() => setConfirmImport(null)}>Cancel</button><button className="primary" onClick={() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(confirmImport)); setProgress(confirmImport); setStorageBlocked(false); setConfirmImport(null); setSelected(null); setTour(false); setMessage('Backup imported and saved successfully.'); }
      catch (error) { setMessage(`Import could not be saved: ${String(error)}. Your progress is unchanged.`); setConfirmImport(null); }
    }}>Replace with backup</button></div></Dialog>}
  </InstrumentPreferences.Provider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
