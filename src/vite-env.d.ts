/// <reference types="vite/client" />

declare namespace Intl {
  interface LocaleWeekInfo {
    firstDay: number
    minimalDays?: number
    weekend?: number[]
  }

  interface Locale {
    getWeekInfo?: () => LocaleWeekInfo
    weekInfo?: LocaleWeekInfo
  }
}
