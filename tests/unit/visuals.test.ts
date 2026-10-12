import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaxChart } from '../../src/Visuals';
import { courses } from '../../src/courses';
import { noteName } from '../../src/audio';

const chart = (target: number) => renderToStaticMarkup(createElement(SaxChart, { target, play: () => {} }));
describe('full-course sax fingerings', () => {
  it('covers every written course target and labels its concert pitch', () => {
    const notes = new Set(courses.find(course => course.id === 'sax')!.lessons.flatMap(lesson => lesson.targetNotes));
    for (const note of notes) {
      const html = chart(note);
      expect(html).not.toContain('Consult your instrument teacher for this fingering.');
      expect(html).toContain(`Hear concert ${noteName(note - 9)}`);
      expect(html).toContain(`Octave: ${note >= 74 ? 'press' : 'release'}`);
    }
  });
  it('includes the right low-C key for low Bb, B and C#', () => {
    for (const note of [58, 59, 61]) {
      expect(chart(note)).toContain('right little-finger low-C key');
      expect(chart(note)).toContain('No octave key.');
    }
  });
  it('keeps lower main shapes in the second octave without contradictory thumb instructions', () => {
    for (let note = 74; note <= 84; note++) {
      const html = chart(note);
      expect(html).toContain('Octave: press');
      expect(html).not.toContain('No octave key.');
    }
    expect(chart(86)).toContain('palm D');
    expect(chart(88)).toContain('high-E side key');
    expect(chart(89)).toContain('palm D, Eb and F');
    expect(chart(89)).toContain('high-E side key');
  });
});
