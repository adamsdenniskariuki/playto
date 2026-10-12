import { test, expect } from '@playwright/test';
import { dayKey, freshProgress, STORAGE_KEY } from '../../src/progress';

test('daily routine timers save once, resume and stop at the planned duration', async ({ page }) => {
  const initial = freshProgress(); initial.settings.tourSeen = true;
  initial.instruments.keyboard.planner = { day: dayKey(), seconds: [117,0,0,0] };
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(initial) });
  await page.goto('/'); await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Resume warm-up', exact: true }).click();
  await expect(page.getByTestId('routine-timer')).toContainText('Warm-up timer');
  await page.getByRole('button', { name: 'Play C4', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Warm-up done', exact: true })).toBeDisabled({ timeout: 8000 });
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(after.instruments.keyboard.planner.seconds[0]).toBe(120);
  expect(after.instruments.keyboard.minutes).toBe(3 / 60);
  expect(after.instruments.keyboard.notes).toBe(1);
  expect(after.streak).toBe(1);
  await page.getByRole('button', { name: 'Start technique', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Save practice session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume technique', exact: true })).toBeEnabled();
  await page.reload(); await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume technique', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
