import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { i18n, stringResource, MR } from '@/core/i18n'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'

describe('Bug 2: Library Settings & Display Sheet i18n Verification', () => {
  const sheetSource = readFileSync('src/features/library/components/LibrarySettingsSheet.vue', 'utf8')
  const displaySource = readFileSync('src/features/library/components/LibraryDisplaySettings.vue', 'utf8')

  beforeEach(() => {
    ;(i18n.global.locale as any).value = 'ru'
  })

  it('Problem A: "Show hidden categories" toggle is completely removed from both components', () => {
    expect(sheetSource).not.toContain('showHiddenCategories')
    expect(sheetSource).not.toContain('Show hidden categories')
    expect(sheetSource).not.toContain('categories-hidden-row')

    expect(displaySource).not.toContain('showHiddenCategories')
    expect(displaySource).not.toContain('Show hidden categories')
  })

  it('Problem B: All tabs render in Russian', () => {
    expect(stringResource(MR.strings.action_filter)).toBe('Фильтрация')
    expect(stringResource(MR.strings.action_sort)).toBe('Сортировка')
    expect(stringResource(MR.strings.action_display)).toBe('Отображение')
    expect(stringResource(MR.strings.group)).toBe('Группа')
  })

  it('Problem B: All filter row labels render in Russian', () => {
    expect(stringResource(MR.strings.label_downloaded)).toBe('Загружено')
    expect(stringResource(MR.strings.action_filter_unread)).toBe('Не прочитано')
    expect(stringResource(MR.strings.label_started)).toBe('Начато')
    expect(stringResource(MR.strings.action_filter_bookmarked)).toBe('В закладках')
    expect(stringResource(MR.strings.completed)).toBe('Завершено')
    expect(stringResource(MR.strings.categories)).toBe('Категории')
    expect(stringResource(MR.strings.action_edit)).toBe('Изменить')
    expect(stringResource(MR.strings.action_filter_tracked)).toBe('Отслеживается')
    expect(stringResource(MR.strings.pref_library_filter_categories_details)).toBe(
      'Тайтлы из исключённых категорий не будут показаны, даже если они также входят во включённые категории.'
    )
  })

  it('Problem B: All sort option names render in Russian', () => {
    expect(stringResource(MR.strings.action_sort_alpha)).toBe('Алфавит')
    expect(stringResource(MR.strings.action_sort_total)).toBe('Количество глав')
    expect(stringResource(MR.strings.action_sort_last_read)).toBe('Последнее прочитанное')
    expect(stringResource(MR.strings.action_sort_last_manga_update)).toBe('Последняя проверка обновления')
    expect(stringResource(MR.strings.action_sort_unread_count)).toBe('Оставшиеся главы')
    expect(stringResource(MR.strings.action_sort_latest_chapter)).toBe('Последняя глава')
    expect(stringResource(MR.strings.action_sort_chapter_fetch_date)).toBe('Последнее получение главы')
    expect(stringResource(MR.strings.action_sort_date_added)).toBe('Последнее добавление серии')
    expect(stringResource(MR.strings.action_sort_tracker_score)).toBe('Оценка сервиса отслеживания')
    expect(stringResource(MR.strings.tag_sorting)).toBe('Сортировка по тегам')
    expect(stringResource(MR.strings.action_sort_random)).toBe('Случайно')
  })

  it('Problem B: All group mode titles render in Russian', () => {
    expect(stringResource(MR.strings.by_default)).toBe('По умолчанию')
    expect(stringResource(MR.strings.by_source)).toBe('По источнику')
    expect(stringResource(MR.strings.by_status)).toBe('По статусу')
    expect(stringResource(MR.strings.by_track_status)).toBe('По статусу отслеживания')
    expect(stringResource(MR.strings.ungrouped)).toBe('Не сгруппировано')
  })

  it('Problem B: All display mode titles and slider render in Russian', () => {
    expect(stringResource(MR.strings.action_display_mode)).toBe('Режим отображения')
    expect(stringResource(MR.strings.action_display_grid)).toBe('Компактная сетка')
    expect(stringResource(MR.strings.action_display_comfortable_grid)).toBe('Удобная сетка')
    expect(stringResource(MR.strings.action_display_comfortable_grid_panorama)).toBe('Удобная сетка (панорама)')
    expect(stringResource(MR.strings.action_display_cover_only_grid)).toBe('Сетка без названия')
    expect(stringResource(MR.strings.action_display_list)).toBe('Список')
    expect(stringResource(MR.strings.pref_library_columns)).toBe('Размер сетки')
    expect(stringResource(MR.strings.label_auto)).toBe('Авто')
  })

  it('Problem B: All badge toggles and tabs toggles render in Russian', () => {
    expect(stringResource(MR.strings.badges_header)).toBe('Значки')
    expect(stringResource(MR.strings.overlay_header)).toBe('Наложение')
    expect(stringResource(MR.strings.action_display_download_badge)).toBe('Загруженные главы')
    expect(stringResource(MR.strings.action_display_unread_badge)).toBe('Непрочитанные главы')
    expect(stringResource(MR.strings.action_display_local_badge)).toBe('Источник на устройстве')
    expect(stringResource(MR.strings.action_display_language_badge)).toBe('Язык')
    expect(stringResource(MR.strings.action_display_language_icon)).toBe('Показывать значок флага языка')
    expect(stringResource(MR.strings.action_display_source_badge)).toBe('Показывать значок источника')
    expect(stringResource(MR.strings.action_display_show_continue_reading_button)).toBe('Кнопка «Продолжить чтение»')

    expect(stringResource(MR.strings.tabs_header)).toBe('Вкладки')
    expect(stringResource(MR.strings.action_display_show_tabs)).toBe('Показать вкладки категорий')
    expect(stringResource(MR.strings.action_display_show_number_of_items)).toBe('Показывать количество серий')
  })

  it('Every key required exists in both en.json and ru.json with non-empty values', () => {
    const requiredKeys = [
      'action_filter', 'action_sort', 'action_display', 'group',
      'library_settings', 'label_downloaded', 'action_filter_unread',
      'label_started', 'action_filter_bookmarked', 'completed',
      'categories', 'action_edit', 'action_filter_tracked',
      'pref_library_filter_categories_details',
      'action_sort_alpha', 'action_sort_total', 'action_sort_last_read',
      'action_sort_last_manga_update', 'action_sort_unread_count',
      'action_sort_latest_chapter', 'action_sort_chapter_fetch_date',
      'action_sort_date_added', 'action_sort_tracker_score', 'tag_sorting',
      'action_sort_random', 'by_default', 'by_source', 'by_status',
      'by_track_status', 'ungrouped', 'action_display_mode',
      'action_display_grid', 'action_display_comfortable_grid',
      'action_display_comfortable_grid_panorama', 'action_display_cover_only_grid',
      'action_display_list', 'pref_library_columns', 'label_auto',
      'badges_header', 'overlay_header', 'action_display_download_badge',
      'action_display_unread_badge', 'action_display_local_badge',
      'action_display_language_badge', 'action_display_language_icon',
      'action_display_source_badge', 'action_display_show_continue_reading_button',
      'tabs_header', 'action_display_show_tabs', 'action_display_show_number_of_items'
    ]

    for (const key of requiredKeys) {
      expect((en as Record<string, any>)[key], `Missing ${key} in en.json`).toBeTruthy()
      expect((ru as Record<string, any>)[key], `Missing ${key} in ru.json`).toBeTruthy()
    }
  })
})
