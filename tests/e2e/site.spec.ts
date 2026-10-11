import { test, expect, type Page } from '@playwright/test';
import { freshProgress, STORAGE_KEY } from '../../src/progress';

async function welcome(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip tour' }).click();
}
async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
}
test('welcome, lesson completion, sequential unlock and persistent progress', async ({ page }) => {
  await welcome(page);
  await expect(page.getByRole('heading', { name: "Let's make music." })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello, middle C' })).toBeVisible();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Play C4', exact: true }).click();
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  await page.getByRole('button', { name: 'Save practice session' }).click();
  await page.getByLabel('Just left of a group of two black keys').check();
  await page.getByLabel('I found middle C and played four even notes without tension.').check();
  await page.getByRole('button', { name: /Complete lesson/ }).click();
  await expect(page.getByText('50 XP', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Five notes, five fingers/ })).toBeEnabled();
  await page.reload();
  await expect(page.getByText('50 XP', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('themes, offline dyslexic font, replay tour and navigation layouts', async ({ page }) => {
  await welcome(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Reading font').selectOption('dyslexic');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'dyslexic');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px OpenDyslexic'))).toBe(true);
  await noOverflow(page);
  await page.getByRole('button', { name: 'Replay welcome tour' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('Theme', { exact: true }).selectOption('contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await noOverflow(page);
});
test('guitar tabs and tools fit each viewport and audio works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await welcome(page);
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('guitar');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'Start metronome', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop metronome', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start backing', exact: true }).click();
  await page.getByLabel('Pitch pattern speed').selectOption('0.5');
  await page.getByRole('button', { name: 'Loop selected notes' }).click();
  await page.getByRole('button', { name: 'Stop sound' }).click();
  await noOverflow(page);
  expect(errors).toEqual([]);
});
test('mic is requested only by a tap, detects mocked A4 and releases tracks', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { calls: 0, stopped: 0 };
    Object.assign(window, { mockMic: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      state.calls++;
      const context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator(); oscillator.frequency.value = 440;
      const gain = context.createGain(); gain.gain.value = .25;
      const output = context.createMediaStreamDestination();
      oscillator.connect(gain); gain.connect(output); oscillator.start();
      output.stream.getTracks().forEach(track => {
        const stop = track.stop.bind(track);
        track.stop = () => { state.stopped++; stop(); oscillator.stop(); void context.close(); };
      });
      return output.stream;
    } });
  });
  await welcome(page);
  expect(await page.evaluate(() => (window as unknown as { mockMic: { calls: number } }).mockMic.calls)).toBe(0);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('mic-status')).toContainText('Connected - listening locally');
  await expect(page.getByTestId('tuner')).toContainText('A4', { timeout: 15000 });
  await expect(page.getByTestId('tuner')).toContainText('In tune');
  await page.getByRole('button', { name: 'Disconnect microphone' }).click();
  await expect(page.getByTestId('mic-status')).toContainText('microphone is off');
  expect(await page.evaluate(() => (window as unknown as { mockMic: { stopped: number } }).mockMic.stopped)).toBe(1);
});
test('mic denial is actionable and leaves on-screen practice usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  });
  await welcome(page);
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('mic-status')).toContainText('Permission denied');
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Play C4', exact: true }).click();
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
});
test('JSON export/import is confirmed and invalid input does not replace progress', async ({ page }) => {
  await welcome(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress JSON' }).click();
  expect((await download).suggestedFilename()).toBe('playto-progress.json');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await expect(page.getByRole('status')).toContainText('Import failed');
  const progress = freshProgress(); progress.xp = 500; progress.settings.tourSeen = true;
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(progress)) });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Replace with backup' }).click();
  await expect(page.getByText('500 XP', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).xp, STORAGE_KEY)).toBe(500);
});
test('PWA caches lessons, app and font for offline reload', async ({ page, context }) => {
  await welcome(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Let's make music." })).toBeVisible();
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello, middle C' })).toBeVisible();
  await page.getByRole('button', { name: 'Hear pitch pattern' }).click();
  await noOverflow(page);
  await context.setOffline(false);
});
