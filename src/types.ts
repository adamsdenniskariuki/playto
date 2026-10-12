export type InstrumentId = 'keyboard' | 'guitar' | 'bass' | 'sax';
export type Theme = 'system' | 'light' | 'dark' | 'sepia' | 'contrast' | 'stage' | 'wood' | 'velvet' | 'pastel' | 'amoled';
export type Font = 'default' | 'serif' | 'dyslexic' | 'andika' | 'outfit' | 'merriweather' | 'comic';
export type Stage = 'Beginner' | 'Intermediate' | 'Advanced';
export type Focus = 'technique' | 'reading' | 'scale' | 'harmony' | 'rhythm' | 'ear' | 'repertoire' | 'creativity';
export type WeakKind = 'note' | 'chord' | 'rhythm';
export interface Lesson {
  id: string;
  title: string;
  stage: Stage;
  kind: 'lesson' | 'checkpoint' | 'piece' | 'stage-test';
  minutes: number;
  goal: string;
  steps: string[];
  tip: string;
  targetNotes: number[];
  pattern: string;
  assessment: string;
  quiz: { question: string; options: string[]; answer: number; explanation: string };
  chord?: string;
  chords?: string[];
  unitId?: string;
  focus?: Focus;
  style?: string;
  tempoLadder?: number[];
  checks?: string[];
  testQuestions?: Lesson['quiz'][];
}
export interface Unit {
  id: string; title: string; stage: Stage; style: string; lessonIds: string[];
}
export interface Course {
  id: InstrumentId;
  name: string;
  subtitle: string;
  symbol: string;
  description: string;
  tuning: string;
  lessons: Lesson[];
  units?: Unit[];
}
export interface LessonDraft {
  id: string; title: string; focus: Focus; goal: string; steps: string[]; notes: number[];
  quiz: [string, string, string, string];
  pattern: string; chord?: string; tempo?: number[];
}
export interface Curriculum {
  units: { id: string; title: string; stage: Stage; style: string; lessons: (string | LessonDraft)[] }[];
}
export interface LessonProgress {
  completedAt: string;
  reviewAt: string;
  interval: number;
  reviews: number;
}
export interface InstrumentProgress {
  lessons: Record<string, LessonProgress>;
  minutes: number;
  notes: number;
  chords: string[];
  tempo: number;
  weak: Record<string, WeakItem>;
  ladders: Record<string, number[]>;
  planner: { day: string | null; seconds: number[] };
}
export interface WeakItem {
  lessonId: string; kind: WeakKind; label: string; notes: number[];
  mistakes: number; interval: number; reviewAt: string; reviews: number;
}
export interface PracticeResult {
  seconds: number; notes: number; tempo: number;
  mistakes: { kind: WeakKind; label: string; notes: number[] }[];
  ladderTempo?: number;
}
export interface Progress {
  version: 2;
  xp: number;
  streak: number;
  lastPractice: string | null;
  freezes: number;
  instrument: InstrumentId;
  settings: { theme: Theme; font: Font; themeChosen: boolean; fontChosen: boolean; tourSeen: boolean; leftHanded: boolean };
  instruments: Record<InstrumentId, InstrumentProgress>;
}
