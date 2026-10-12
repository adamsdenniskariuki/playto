import { expect, test } from '@playwright/test';
import { freshProgress, STORAGE_KEY } from '../../src/progress';
import { courses } from '../../src/courses';

test('all four advanced level tests and due reviews open with saved prerequisite progress', async ({ page }) => {
  const progress = freshProgress(); progress.settings.tourSeen = true;
  for (const course of courses) for (const lesson of course.lessons) {
    progress.instruments[course.id].lessons[lesson.id] = {
      completedAt: '2026-10-01T12:00:00Z', reviewAt: '2026-10-02T12:00:00Z', interval: 1, reviews: 0
    };
  }
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(progress) });
  await page.goto('/');
  for (const course of courses) {
    await page.getByLabel('CURRENT INSTRUMENT').selectOption(course.id);
    await expect(page.getByRole('button', { name: course.lessons.at(-1)!.title, exact: false })).toBeEnabled();
    await page.getByRole('button', { name: course.lessons.at(-1)!.title, exact: false }).click();
    await expect(page.getByRole('heading', { name: course.lessons.at(-1)!.title })).toBeVisible();
    await expect(page.getByText(course.lessons.at(-1)!.assessment, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Back to your path' }).click();
  }
  await page.getByRole('button', { name: 'Spaced review', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Spaced review' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ready to revisit/ })).toHaveCount(courses.at(-1)!.lessons.length);
});
test('ear training plays a random challenge and gives correct feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: (array: Uint32Array) => { array[0] = 5; array[1] = 4; return array; } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'New listening challenge' }).click();
  await page.getByRole('button', { name: 'Major second', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Not quite' })).toBeVisible();
  await page.getByRole('button', { name: 'Perfect fifth', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Yes - perfect fifth. C4 to G4.' })).toBeVisible();
  await page.getByRole('button', { name: 'Listen again' }).click();
});
test('Web MIDI connects, ignores note-off, matches notes and disconnects', async ({ page }) => {
  await page.addInitScript(() => {
    const input = { onmidimessage: null as null | ((event: { data: Uint8Array }) => void) };
    const access = { inputs: new Map([['test', input]]), onstatechange: null };
    Object.assign(window, { testMidi: input });
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => access });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Connect MIDI keyboard' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'MIDI connected - 1' })).toBeVisible();
  await page.evaluate(() => {
    const input = (window as unknown as { testMidi: { onmidimessage: (event: { data: Uint8Array }) => void } }).testMidi;
    input.onmidimessage({ data: new Uint8Array([0x80, 60, 0]) });
    input.onmidimessage({ data: new Uint8Array([0x90, 60, 100]) });
  });
  await expect(page.getByText(/1 notes matched/)).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect MIDI' }).click();
  expect(await page.evaluate(() => (window as unknown as { testMidi: { onmidimessage: unknown } }).testMidi.onmidimessage)).toBeNull();
});
test('leaving an active session saves notes without overwriting lesson completion', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Play C4', exact: true }).click();
  await page.getByLabel('Just left of a group of two black keys').check();
  await page.getByLabel('I found middle C and played four even notes without tension.').check();
  await page.getByRole('button', { name: /Complete lesson/ }).click();
  await expect(page.getByText('50 XP', { exact: true })).toBeVisible();
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(progress.instruments.keyboard.notes).toBe(1);
  expect(progress.instruments.keyboard.lessons['keys-first-sound']).toBeTruthy();
});
test('visual snapshots and overflow on all primary layouts', async ({ page }, info) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
  await page.getByLabel('CURRENT INSTRUMENT').selectOption('sax');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.screenshot({ path: info.outputPath('sax-studio.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
