/**
 * i18n: internationalization loader.
 *
 * Loads locale JSON files and provides a t() function for translations.
 * Falls back to zh-CN (default) when a key is missing in the current locale.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const zhCN: Record<string, any> = require('./zh-CN.json')
const enUS: Record<string, any> = require('./en-US.json')

export type Locale = 'zh-CN' | 'en-US'

const LOCALES: Record<Locale, Record<string, any>> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

let currentLocale: Locale = 'zh-CN'

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function getAvailableLocales(): Locale[] {
  return Object.keys(LOCALES) as Locale[]
}

/**
 * Get a translated string by dotted key path.
 * Falls back to zh-CN, then returns the key itself.
 *
 * t('mcp.title') → "MCP 服务" (zh-CN) or "MCP services" (en-US)
 */
export function t(key: string, fallback?: string): string {
  const value = resolveKey(LOCALES[currentLocale], key)
  if (value !== undefined) return value
  // Fallback to zh-CN
  if (currentLocale !== 'zh-CN') {
    const fallbackValue = resolveKey(LOCALES['zh-CN'], key)
    if (fallbackValue !== undefined) return fallbackValue
  }
  return fallback ?? key
}

function resolveKey(obj: Record<string, any>, key: string): string | undefined {
  const parts = key.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}
