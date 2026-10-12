import { test, expect } from '@playwright/test';
import { STORAGE_KEY } from '../../src/progress';

test('a sustained wrong microphone pitch creates one target-note review, not repeated hits', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(); oscillator.frequency.value = 440;
      const gain = context.createGain(); gain.gain.value = .25;
      const output = context.createMediaStreamDestination();
      oscillator.connect(gain); gain.connect(output); oscillator.start();
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        track.stop = () => { stop(); oscillator.stop(); void context.close(); };
      });
      return output.stream;
    } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('tuner')).toContainText('A4');
  await expect(page.getByText('1 difficulty report(s) this session.', { exact: false })).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Save practice session' }).click();
  const weak = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).instruments.keyboard.weak, STORAGE_KEY);
  expect(Object.keys(weak)).toHaveLength(1);
  expect(weak['keys-first-sound-note-60']).toMatchObject({ notes: [60], mistakes: 1 });
});
