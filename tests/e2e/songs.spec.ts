import { test, expect } from '@playwright/test';

test('song count-in, held/rest score, next labels, synchronized scroll and section loops', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByLabel('Song tempo (BPM)').fill('180');
  await page.getByLabel('Count-in', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect(page.getByTestId('song-position')).toContainText('Count-in');
  await page.waitForFunction(() => document.querySelector('[data-testid="song-event-1"]')?.getAttribute('aria-current') === 'step'
    && document.querySelector('[data-testid="song-event-2"]')?.textContent?.includes('NEXT')
    && document.querySelector('[data-testid="song-position"]')?.textContent?.includes('Playing event 1'), undefined, { timeout: 6000, polling: 20 });
  await page.waitForFunction(() => document.querySelector('[data-testid="song-event-5"]')?.getAttribute('aria-current') === 'step', undefined, { timeout: 6000, polling: 20 });
  expect(await page.getByLabel(/scrolling score/).evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop song', exact: true }).click();
  await page.getByLabel('Section from event').fill('3'); await page.getByLabel('Section to event').fill('3');
  await page.getByLabel('Count-in', { exact: true }).selectOption('0');
  await page.getByLabel('Song speed').selectOption('0.5');
  await page.getByLabel('Repeat song section').check();
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect(page.getByTestId('song-position')).toContainText('Playing event 3');
  await page.waitForTimeout(2200);
  await expect(page.getByTestId('song-position')).toContainText('Playing event 3');
  await page.getByRole('button', { name: 'Stop sound', exact: true }).click();
  await expect(page.getByTestId('song-position')).toContainText('Song stopped');
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('guitar');
  await expect(page.getByTestId('song-event-1')).toContainText('Tab: string 6, fret 0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
