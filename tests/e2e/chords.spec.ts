import { test, expect } from '@playwright/test';

test('mic chord estimates, held attacks, low-confidence fallback and cleanup', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, notes: [60,64,67] };
    Object.assign(window, { chordMock: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume();
      const output = context.createMediaStreamDestination();
      const voices = [0,1,2].map(index => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.frequency.value = 440 * 2 ** ((state.notes[index] - 69) / 12);
        gain.gain.value = 0.12; oscillator.connect(gain); gain.connect(output); oscillator.start();
        return { oscillator, gain };
      });
      const timer = setInterval(() => voices.forEach((voice, index) => {
        voice.gain.gain.value = index < state.notes.length ? 0.12 : 0;
        if (index < state.notes.length) voice.oscillator.frequency.value = 440 * 2 ** ((state.notes[index] - 69) / 12);
      }), 50);
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        track.stop = () => { state.stopped++; clearInterval(timer); stop(); voices.forEach(voice => voice.oscillator.stop()); void context.close(); };
      });
      return output.stream;
    } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByLabel('Listen for chords instead of single notes').check();
  await page.getByLabel('Chord to practise').selectOption('C major');
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('chord-reading')).toContainText('C major', { timeout: 15000 });
  await expect(page.getByTestId('chord-reading')).toContainText('1 chords matched');
  await page.waitForTimeout(600);
  await expect(page.getByTestId('chord-reading')).toContainText('1 chords matched');
  await page.evaluate(() => { (window as unknown as { chordMock: { notes: number[] } }).chordMock.notes = [69]; });
  await expect(page.getByText(/Low confidence - use self-assessment/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Disconnect microphone' }).click();
  expect(await page.evaluate(() => (window as unknown as { chordMock: { stopped: number } }).chordMock.stopped)).toBe(1);
});
