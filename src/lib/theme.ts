/** السمة المرسومة فعلاً (ما يقرؤه CSS وReact Flow). */
export type Theme = 'dark' | 'light'
/** تفضيل المستخدم: سمة ثابتة، أو «تلقائي» يتبع نظام التشغيل. */
export type ThemeMode = Theme | 'system'

export const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system']

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/** السمة المرسومة لتفضيل ما؛ «تلقائي» يتبع تفضيل النظام (وإن لم يتوفر matchMedia فداكنة، الافتراضي). */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): Theme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

/** هل يفضّل النظام الوضع الداكن الآن؟ آمن خارج المتصفح وفي jsdom (لا matchMedia فيه). */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
