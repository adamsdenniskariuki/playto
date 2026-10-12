import { expect, test } from '@playwright/test';
import { freshProgress, STORAGE_KEY } from '../../src/progress';

test('count-agnostic welcome, new default and independently preserved chosen preferences', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toContainText('Pick an instrument. Tiny steps. Real music.');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'stage');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'andika');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('system');
  await page.getByLabel('Reading font').selectOption('default');
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('system');
  await expect(page.getByLabel('Reading font')).toHaveValue('default');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).settings, STORAGE_KEY);
  expect(saved.themeChosen).toBe(true); expect(saved.fontChosen).toBe(true);
  await page.getByRole('button', { name: 'Use Playto defaults' }).click();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('stage');
  await expect(page.getByLabel('Reading font')).toHaveValue('andika');
});

test('all new palettes meet AA text and control contrast in both system modes', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const theme of ['stage', 'wood', 'velvet', 'pastel', 'amoled']) {
      await page.getByLabel('Theme', { exact: true }).selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      await expect(page.locator('html')).toHaveAttribute('data-palette', theme);
      const failures = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const read = (key: string) => {
          const text = style.getPropertyValue(`--cp-${key}`).trim();
          if (text.startsWith('#')) return [1, 3, 5].map(index => parseInt(text.slice(index, index + 2), 16)).concat(1);
          const values = text.match(/[\d.]+/g)!.map(Number);
          return values.length === 3 ? [...values, 1] : values;
        };
        const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
          const scaled = value / 255; return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const contrast = (a: number[], b: number[]) => {
          const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
        };
        const failures: string[] = [];
        const surfaces = ['bg', 'bg-elevated', 'surface', 'surface-soft'];
        for (const bg of surfaces) {
          const base = read(bg), soft = read('accent-soft');
          const blend = soft.slice(0, 3).map((value, index) => value * soft[3] + base[index] * (1 - soft[3]));
          for (const text of ['text', 'text-muted', 'text-soft', 'accent', 'link']) {
            for (const background of [base, blend]) if (contrast(read(text), background) < 4.5) failures.push(`${text}/${bg}`);
          }
          if (contrast(read('border-strong'), base) < 3) failures.push(`control border/${bg}`);
        }
        for (const bg of ['accent', 'accent-hover']) if (contrast(read('accent-fg'), read(bg)) < 4.5) failures.push(`primary/${bg}`);
        return failures;
      });
      expect(failures, `${theme}/${colorScheme}`).toEqual([]);
      if (theme === 'amoled' && colorScheme === 'dark')
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('all new fonts load, persist and work offline without page overflow', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const [font, family] of [['andika', 'Andika'], ['outfit', 'Outfit'], ['merriweather', 'Merriweather'], ['comic', 'Comic Neue']]) {
    await page.getByLabel('Reading font').selectOption(font);
    await page.evaluate(family => document.fonts.load(`16px "${family}"`), family);
    expect(await page.evaluate(family => document.fonts.check(`16px "${family}"`), family)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect(page.getByText('All lessons, instruments, fonts and sounds are ready offline', { exact: false })).toBeVisible();
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const [font, family] of [['andika', 'Andika'], ['outfit', 'Outfit'], ['merriweather', 'Merriweather'], ['comic', 'Comic Neue']]) {
    await page.getByLabel('Reading font').selectOption(font);
    const loaded = await page.evaluate(family => document.fonts.load(`700 16px "${family}"`).then(faces => faces.length), family);
    expect(loaded).toBeGreaterThan(0);
  }
});

test('unflagged legacy system/native migrates but non-default legacy appearance stays', async ({ page }) => {
  const progress = JSON.parse(JSON.stringify(freshProgress()));
  progress.settings = { theme: 'system', font: 'default', tourSeen: true };
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(progress) });
  await page.goto('/'); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('stage');
  await expect(page.getByLabel('Reading font')).toHaveValue('andika');
  progress.settings = { theme: 'sepia', font: 'dyslexic', tourSeen: true };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(progress) });
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('sepia');
  await expect(page.getByLabel('Reading font')).toHaveValue('dyslexic');
});
