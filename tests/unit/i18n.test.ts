import { describe, expect, it, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v) },
  removeItem: (k: string) => { storage.delete(k) },
})

import {
  MR,
  resolveEffectiveLocale,
  stringResource,
  pluralStringResource,
  setAppLanguage,
  currentLanguage,
  effectiveLanguage,
  STORAGE_KEY,
} from '../../src/i18n'
import { APP_LOCALE_TAGS } from '../../src/utils/appLanguage'

describe('i18n infrastructure', () => {
  beforeEach(async () => {
    storage.clear()
    await setAppLanguage('en')
  })

  it('ships 68 generated locale files matching APP_LOCALE_TAGS', () => {
    const localesDir = path.resolve('src/locales')
    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'))
    expect(files).toHaveLength(68)

    for (const tag of APP_LOCALE_TAGS) {
      const p = path.join(localesDir, `${tag}.json`)
      expect(fs.existsSync(p), `Missing locale file for ${tag}`).toBe(true)
    }
  })

  it('defines extensive MR.strings and MR.plurals from Mihon moko-resources', () => {
    const stringKeys = Object.keys(MR.strings)
    const pluralKeys = Object.keys(MR.plurals)
    expect(stringKeys.length).toBeGreaterThan(950)
    expect(pluralKeys.length).toBeGreaterThan(20)

    expect(MR.strings.app_name).toBe('app_name')
    expect(MR.strings.label_library).toBe('label_library')
    expect(MR.strings.label_settings).toBe('label_settings')
    expect(MR.strings.pref_app_language).toBe('pref_app_language')
    expect(MR.plurals.num_categories).toBe('num_categories')
    expect(MR.plurals.download_queue_summary).toBe('download_queue_summary')
  })

  it('correctly resolves effective locale from preference or system', () => {
    expect(resolveEffectiveLocale('ru')).toBe('ru')
    expect(resolveEffectiveLocale('en')).toBe('en')
    expect(resolveEffectiveLocale('zh-CN')).toBe('zh-CN')
    expect(resolveEffectiveLocale('pt-BR')).toBe('pt-BR')
    // When tag is unknown or empty, falls back to navigator.language or 'en'
    expect(['en', 'ru']).toContain(resolveEffectiveLocale('unknown_locale'))
    expect(['en', 'ru']).toContain(resolveEffectiveLocale(''))
  })

  it('translates base English strings and interpolates positional parameters', () => {
    expect(stringResource(MR.strings.label_library)).toBe('Library')
    expect(stringResource(MR.strings.label_settings)).toBe('Settings')
    expect(stringResource(MR.strings.unlock_app_title, 'Mihon')).toBe('Unlock Mihon')
  })

  it('switches to Russian dynamically and formats Russian strings & plurals correctly', async () => {
    await setAppLanguage('ru')
    expect(currentLanguage.value).toBe('ru')
    expect(effectiveLanguage.value).toBe('ru')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ru')
    if (typeof document !== 'undefined') {
      expect(document.documentElement.getAttribute('lang')).toBe('ru')
    }

    // Russian string translations
    expect(stringResource(MR.strings.label_library)).toBe('Библиотека')
    expect(stringResource(MR.strings.label_recent_updates)).toBe('Обновления')
    expect(stringResource(MR.strings.label_recent_manga)).toBe('История')
    expect(stringResource(MR.strings.label_settings)).toBe('Настройки')
    expect(stringResource(MR.strings.pref_category_appearance)).toBe('Отображение')
    expect(stringResource(MR.strings.unlock_app_title, 'Mihon')).toBe('Разблокировать Mihon')

    // Russian plural rules: 1 -> one, 2-4 -> few, 5-0 -> many
    expect(pluralStringResource(MR.plurals.num_categories, 1, 1)).toBe('1 категория')
    expect(pluralStringResource(MR.plurals.num_categories, 2, 2)).toBe('2 категории')
    expect(pluralStringResource(MR.plurals.num_categories, 5, 5)).toBe('5 категорий')
  })

  it('falls back to English when a string is missing in selected locale', async () => {
    await setAppLanguage('ru')
    // app_name is translatable="false" in Mihon, so base "Mihon" is present
    expect(stringResource(MR.strings.app_name)).toBe('Mihon')
  })

  it('switches to default/system language when empty tag is provided', async () => {
    await setAppLanguage('ru')
    expect(currentLanguage.value).toBe('ru')
    await setAppLanguage('')
    expect(currentLanguage.value).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('')
  })
})
