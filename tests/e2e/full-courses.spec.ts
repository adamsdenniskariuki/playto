import { test, expect } from '@playwright/test';
import { courses } from '../../src/courses';
import { freshProgress, STORAGE_KEY } from '../../src/progress';

for (const course of courses.filter(item => item.units)) {
  test(`${course.id}: unit navigation, stage test, style tracks and badge`, async ({ page }) => {
    const progress = freshProgress(); progress.settings.tourSeen = true; progress.instrument = course.id;
    const testLesson = course.lessons.find(lesson => lesson.kind === 'stage-test')!;
    for (const lesson of course.lessons.filter(item => item.stage === 'Beginner' && item !== testLesson))
      progress.instruments[course.id].lessons[lesson.id] = { completedAt: '2026-10-01T12:00:00Z', reviewAt: '2099-10-02T12:00:00Z', interval: 1, reviews: 0 };
    await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(progress) });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /7 lessons/ })).toHaveCount(12);
    await page.getByLabel('Style track').selectOption(course.units![0].style);
    await expect(page.getByRole('heading', { name: /7 lessons/ })).toHaveCount(course.units!.filter(unit => unit.style === course.units![0].style).length);
    await page.getByLabel('Style track').selectOption('All styles');
    await page.getByRole('button', { name: testLesson.title, exact: false }).click();
    await page.getByRole('button', { name: 'Complete lesson', exact: false }).isDisabled().then(disabled => expect(disabled).toBe(true));
    await page.locator('input[name=quiz]').nth(testLesson.quiz.answer).check();
    for (const [index, quiz] of testLesson.testQuestions!.entries()) await page.locator(`input[name=stage-quiz-${index}]`).nth(quiz.answer).check();
    for (const goal of testLesson.checks!) await page.getByLabel(goal, { exact: true }).check();
    await page.getByLabel(testLesson.assessment, { exact: true }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Complete lesson', exact: false }).click();
    await expect(page.getByRole('button', { name: course.lessons.find(lesson => lesson.stage === 'Intermediate')!.title, exact: false })).toBeEnabled();
    await page.getByRole('button', { name: 'Progress', exact: true }).click();
    await expect(page.locator('.badge.earned').filter({ hasText: `${course.name} · Beginner` })).toBeVisible();
    await page.reload();
    expect(await page.evaluate(({ key, id, testId }) => JSON.parse(localStorage.getItem(key)!).instruments[id].lessons[testId] !== undefined, { key: STORAGE_KEY, id: course.id, testId: testLesson.id })).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('wrong notes and self-assessed chords/rhythms persist as targeted reviews', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: 'Play D4', exact: true }).click();
  await page.getByRole('button', { name: 'Mark weak chord', exact: true }).click();
  await page.getByRole('button', { name: 'Mark weak rhythm', exact: true }).click();
  await page.getByRole('button', { name: 'Save practice session' }).click();
  await page.getByRole('button', { name: 'Spaced review', exact: false }).click();
  await expect(page.getByRole('button', { name: /Targeted drill/ })).toHaveCount(3);
  await page.getByRole('button', { name: /Weak note:/ }).click();
  await page.getByLabel('I practised this specific difficulty twice and checked the result.').check();
  await page.getByRole('button', { name: 'Confident · space this review' }).click();
  await expect(page.getByRole('button', { name: /Targeted drill/ })).toHaveCount(2);
  await page.reload(); await page.getByRole('button', { name: 'Spaced review', exact: false }).click();
  await expect(page.getByRole('button', { name: /Targeted drill/ })).toHaveCount(2);
});
test('tempo ladder rejects short takes, passes one target and persists on reload', async ({ page }) => {
  await page.clock.install();
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByLabel(/I played two complete, clean takes/)).toBeDisabled();
  await page.clock.fastForward(31000);
  await page.getByLabel('I kept a steady pulse at this tempo for at least 30 seconds.').check();
  await page.getByLabel(/I played two complete, clean takes/).check();
  await page.getByRole('button', { name: 'Save practice session' }).click();
  await expect(page.getByTestId('tempo-ladder')).toContainText('40 BPM passed');
  await expect(page.getByTestId('tempo-ladder')).toContainText('55 BPM next');
  await page.reload(); await page.getByRole('button', { name: /Play your first lesson/ }).click();
  await expect(page.getByTestId('tempo-ladder')).toContainText('40 BPM passed');
});
test('legacy v1 progress loads unchanged and saves migrated records', async ({ page }) => {
  const legacy = JSON.parse(JSON.stringify(freshProgress())); legacy.version = 1; legacy.xp = 650; legacy.settings.tourSeen = true;
  legacy.instruments.keyboard.lessons['keys-five-fingers'] = { completedAt: '2026-10-01T12:00:00Z', reviewAt: '2099-10-01T12:00:00Z', interval: 1, reviews: 0 };
  for (const data of Object.values(legacy.instruments) as Record<string, unknown>[]) { delete data.weak; delete data.ladders; }
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(legacy) });
  await page.goto('/');
  await expect(page.getByText('650 XP', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Five notes, five fingers/ })).toBeEnabled();
  await page.getByRole('button', { name: /Five notes, five fingers/ }).click();
  await expect(page.getByText('Lesson completed. Replay any time;', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('sepia');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.version).toBe(2); expect(stored.xp).toBe(650);
  expect(stored.instruments.keyboard.lessons['keys-five-fingers']).toBeTruthy();
});
