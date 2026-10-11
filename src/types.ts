export type InstrumentId = 'keyboard' | 'guitar' | 'bass' | 'sax';
export type Theme = 'system' | 'light' | 'dark' | 'sepia' | 'contrast';
export type Font = 'default' | 'serif' | 'dyslexic';
export interface Lesson {
  id: string;
  title: string;
  stage: 'Beginner' | 'Intermediate' | 'Advanced';
  kind: 'lesson' | 'checkpoint' | 'piece';
  minutes: number;
  goal: string;
  steps: string[];
  tip: string;
  targetNotes: number[];
  pattern: string;
  assessment: string;
  quiz: { question: string; options: string[]; answer: number; explanation: string };
  chord?: string;
}
export interface Course {
  id: InstrumentId;
  name: string;
  subtitle: string;
  symbol: string;
  description: string;
  tuning: string;
  lessons: Lesson[];
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
}
export interface Progress {
  version: 1;
  xp: number;
  streak: number;
  lastPractice: string | null;
  freezes: number;
  instrument: InstrumentId;
  settings: { theme: Theme; font: Font; tourSeen: boolean };
  instruments: Record<InstrumentId, InstrumentProgress>;
}
