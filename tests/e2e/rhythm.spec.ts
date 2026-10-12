import { test, expect } from '@playwright/test';

test('tap timing, calibration, MIDI and beat-clock lifecycle', async ({ page }) => {
  await page.addInitScript(() => {
    const input = { onmidimessage: null as null | ((event: { data: Uint8Array }) => void) };
    Object.assign(window, { rhythmMidi: input });
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => ({ inputs: new Map([['mock',input]]), onstatechange: null }) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start metronome', exact: true }).click();
  await page.getByRole('button', { name: 'Start rhythm scoring', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Tap beat', exact: true }).click();
  await expect(page.getByTestId('timing-summary')).toContainText('1 attacks');
  await expect(page.getByTestId('timing-offset')).toContainText(/ms (early|late|on time)/);
  await page.getByRole('button', { name: 'Stop rhythm scoring' }).click();
  await page.getByLabel('Tempo ·').fill('180');
  await page.getByRole('button', { name: 'Calibrate 8 beats' }).click();
  for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Tap beat', exact: true }).click(); await page.waitForTimeout(360); }
  await expect(page.getByTestId('rhythm-status')).toContainText('Calibration saved for tap');
  await page.getByLabel('Rhythm input').selectOption('midi');
  await page.getByLabel('Latency correction (ms)').fill('35');
  await page.getByRole('button', { name: 'Connect MIDI keyboard' }).click();
  await page.getByRole('button', { name: 'Start rhythm scoring', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const input = (window as unknown as { rhythmMidi: { onmidimessage: (event: { data: Uint8Array }) => void } }).rhythmMidi;
    input.onmidimessage({ data: new Uint8Array([0x90,60,100]) });
    input.onmidimessage({ data: new Uint8Array([0x80,60,0]) });
  });
  await expect(page.getByTestId('timing-summary')).toContainText('1 attacks');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Stop sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start rhythm scoring', exact: true })).toBeDisabled();
});

test('microphone onset pulses score attacks without repeated held-note hits', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
      oscillator.frequency.value = 440; gain.gain.value = 0;
      oscillator.connect(gain); gain.connect(output); oscillator.start();
      const timer = setInterval(() => {
        gain.gain.setValueAtTime(0.25, context.currentTime);
        gain.gain.setValueAtTime(0, context.currentTime + 0.25);
      }, 1000);
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); oscillator.stop(); void context.close(); };
      });
      return output.stream;
    } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start backing', exact: true }).click();
  await page.getByLabel('Rhythm input').selectOption('mic');
  await page.getByRole('button', { name: 'Start rhythm scoring', exact: true }).click();
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('timing-summary')).toContainText(/[1-9]\d* attacks/, { timeout: 10000 });
  await page.getByRole('button', { name: 'Disconnect microphone' }).click();
});
