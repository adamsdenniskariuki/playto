import { expect, test } from '@playwright/test';

test('bass and sax have independent paths and accessible playable visuals', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.getByRole('button', { name: /Alto saxophone Find your voice/ })).toBeVisible();
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('bass');
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await expect(page.getByRole('heading', { name: 'One note, a whole groove' })).toBeVisible();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Play E1, string 4, fret 0', exact: true }).click();
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  await page.getByRole('button', { name: 'Save practice session' }).click();
  await page.getByLabel('E1', { exact: true }).check();
  await page.getByLabel('I played four even low E notes and controlled the ringing.').check();
  await page.getByRole('button', { name: /Complete lesson/ }).click();
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('sax');
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await expect(page.getByRole('heading', { name: 'A breath becomes a note' })).toBeVisible();
  await expect(page.getByText('Alto sax is in Eb.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Hear concert D4', exact: true }).click();
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('alto sax microphone matches concert D4 to written B4 once per sustained note', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(); oscillator.frequency.value = 440 * 2 ** ((62 - 69) / 12);
      const gain = context.createGain(); gain.gain.value = .25;
      const output = context.createMediaStreamDestination(); oscillator.connect(gain); gain.connect(output); oscillator.start();
      return output.stream;
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('sax');
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Connect microphone', exact: true }).click();
  await expect(page.getByTestId('tuner')).toContainText('D4');
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  // A held note cannot repeatedly earn hits without a release or pitch change.
  await page.waitForTimeout(700);
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to your path' }).click();
});
