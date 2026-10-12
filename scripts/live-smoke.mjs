import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const expanded = new Set(process.argv.slice(2));
assert(expanded.size > 0, 'Pass the instrument IDs expected to have full courses.');
const browser = await chromium.launch();
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://playto.madebyfavor.com/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Skip tour' }).click();
    for (const id of ['keyboard','guitar','bass','sax']) {
      await page.getByLabel('CURRENT INSTRUMENT').selectOption(id);
      assert.equal(await page.locator('.lesson-node').count(), expanded.has(id) ? 87 : 15, `${id} live lesson count`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id} path overflow at ${width}`);
      await page.getByRole('button', { name: /Play your first lesson/ }).click();
      assert(await page.locator('.lesson-view h1').isVisible(), `${id} lesson did not open`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id} practice overflow at ${width}`);
      await page.getByRole('button', { name: 'Back to your path' }).click();
    }
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: /Play your first lesson/ }).click();
    assert(await page.locator('.lesson-view h1').isVisible(), 'Offline lesson unavailable');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Live courses, layouts and offline reload passed at ${width}px`);
  }
} finally {
  await browser.close();
}
