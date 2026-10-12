import { describe, expect, it } from 'vitest';
import { fontLabels, isFont, isTheme, resolveTheme, themeLabels } from '../../src/appearance';
import { freshProgress, parseProgress } from '../../src/progress';

describe('appearance preferences', () => {
  it('uses Stage and Andika as unchosen defaults', () => {
    expect(freshProgress().settings).toMatchObject({ theme: 'stage', font: 'andika', themeChosen: false, fontChosen: false });
    expect(parseProgress(JSON.stringify(freshProgress()))).toEqual(freshProgress());
  });
  it('upgrades unflagged legacy system/native defaults without changing musical progress', () => {
    const legacy = JSON.parse(JSON.stringify(freshProgress()));
    legacy.settings = { theme: 'system', font: 'default', tourSeen: true }; legacy.xp = 1200;
    const migrated = parseProgress(JSON.stringify(legacy));
    expect(migrated.settings).toEqual({ theme: 'stage', font: 'andika', themeChosen: false, fontChosen: false, tourSeen: true, leftHanded: false });
    expect(migrated.xp).toBe(1200); expect(migrated.instruments).toEqual(legacy.instruments);
  });
  it('retains non-default legacy choices and explicit system/native choices independently', () => {
    const legacy = JSON.parse(JSON.stringify(freshProgress()));
    legacy.settings = { theme: 'sepia', font: 'dyslexic', tourSeen: true };
    expect(parseProgress(JSON.stringify(legacy)).settings).toEqual({ ...legacy.settings, themeChosen: true, fontChosen: true, leftHanded: false });
    legacy.settings = { theme: 'system', font: 'default', themeChosen: true, fontChosen: true, tourSeen: true };
    expect(parseProgress(JSON.stringify(legacy)).settings).toEqual({ ...legacy.settings, leftHanded: false });
    legacy.settings = { theme: 'contrast', font: 'default', tourSeen: true };
    expect(parseProgress(JSON.stringify(legacy)).settings).toMatchObject({ theme: 'contrast', themeChosen: true, font: 'andika', fontChosen: false });
  });
  it('validates every option and rejects corrupt chosen flags', () => {
    for (const theme of Object.keys(themeLabels)) expect(isTheme(theme)).toBe(true);
    for (const font of Object.keys(fontLabels)) expect(isFont(font)).toBe(true);
    expect(isTheme('__proto__')).toBe(false); expect(isFont('no-such-font')).toBe(false);
    const value = JSON.parse(JSON.stringify(freshProgress())); value.settings.themeChosen = 'yes';
    expect(() => parseProgress(JSON.stringify(value))).toThrow('valid Playto');
  });
  it('adapts new palettes to system mode without changing fixed legacy choices', () => {
    for (const theme of ['stage', 'wood', 'velvet', 'pastel', 'amoled'] as const) {
      expect(resolveTheme(theme, true)).toEqual({ mode: 'dark', palette: theme });
      expect(resolveTheme(theme, false)).toEqual({ mode: 'light', palette: theme });
    }
    expect(resolveTheme('light', true)).toEqual({ mode: 'light', palette: '' });
    expect(resolveTheme('dark', false)).toEqual({ mode: 'dark', palette: '' });
  });
});
