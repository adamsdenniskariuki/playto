import { test, expect } from '@playwright/test';

test('real MediaRecorder with mocked mic persists, compares, downloads and deletes takes', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { calls: 0, stopped: 0 }; Object.assign(window, { recordingMock: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      state.calls++;
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(), output = context.createMediaStreamDestination();
      oscillator.connect(output); oscillator.start();
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        track.stop = () => { state.stopped++; stop(); oscillator.stop(); void context.close(); };
      });
      return output.stream;
    } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { recordingMock: { calls: number } }).recordingMock.calls)).toBe(0);
  await page.getByRole('button', { name: 'Record take', exact: true }).click();
  await expect(page.getByTestId('record-status')).toContainText('RECORDING');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop & save take', exact: true }).click();
  await expect(page.getByTestId('record-status')).toContainText('Take saved locally');
  await expect(page.getByLabel('Recent take', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { recordingMock: { stopped: number } }).recordingMock.stopped)).toBeGreaterThanOrEqual(1);
  await page.reload(); await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Compare with reference', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop comparison', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop comparison', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download take', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('playto-keyboard');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Delete take', exact: true }).click();
  await page.getByRole('button', { name: 'Keep take', exact: true }).click();
  await expect(page.getByLabel('Recent take', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete take', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete take', exact: true }).click();
  await expect(page.getByText('No saved takes for this instrument yet.')).toBeVisible();
});

test('recording denial is reported without creating a take', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Record take', exact: true }).click();
  await expect(page.getByTestId('record-status')).toContainText('Recording could not start: Permission denied');
  await expect(page.getByText('No saved takes for this instrument yet.')).toBeVisible();
});

test('leaving recording saves final chunks and releases its microphone', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0 }; Object.assign(window, { recordingCleanup: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(), output = context.createMediaStreamDestination();
      oscillator.connect(output); oscillator.start();
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        let released = false;
        track.stop = () => { if (released) return; released = true; state.stopped++; stop(); oscillator.stop(); void context.close(); };
      });
      return output.stream;
    } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Record take', exact: true }).click();
  await expect(page.getByTestId('record-status')).toContainText('RECORDING');
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { recordingCleanup: { stopped: number } }).recordingCleanup.stopped)).toBe(1);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByLabel('Recent take', { exact: true })).toBeVisible();
});
