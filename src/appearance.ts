import type { Font, Theme } from './types';

export const DEFAULT_THEME: Theme = 'stage';
export const DEFAULT_FONT: Font = 'andika';
export const themeLabels: Record<Theme, string> = {
  stage: 'Stage (default) · follows system', wood: 'Warm wood · follows system',
  velvet: 'Velvet · follows system', pastel: 'Rose pastel · follows system',
  amoled: 'AMOLED · follows system',
  system: 'Classic · follows system', light: 'Classic light', dark: 'Classic dark',
  sepia: 'Sepia reading', contrast: 'High contrast'
};
export const fontLabels: Record<Font, string> = {
  andika: 'Andika (default) · clear and open', outfit: 'Outfit · modern sans serif',
  merriweather: 'Merriweather · book serif', comic: 'Comic Neue · handwritten',
  default: 'Segoe UI / native sans serif', serif: 'Georgia / serif',
  dyslexic: 'OpenDyslexic (dyslexia-friendly)'
};
export const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && Object.hasOwn(themeLabels, value);
export const isFont = (value: unknown): value is Font =>
  typeof value === 'string' && Object.hasOwn(fontLabels, value);
export function resolveTheme(theme: Theme, dark: boolean) {
  const adaptive = ['stage', 'wood', 'velvet', 'pastel', 'amoled'].includes(theme);
  return {
    mode: adaptive || theme === 'system' ? dark ? 'dark' : 'light' : theme,
    palette: adaptive ? theme : ''
  };
}
