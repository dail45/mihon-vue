/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/vue" />

declare module 'vue-virtual-scroller' {
  import type { AllowedComponentProps, ComponentCustomProps, VNode, VNodeProps } from 'vue'

  export interface RecycleScrollerProps<T = any> {
    items: T[]
    itemSize?: number | null
    gridItems?: number
    itemSecondarySize?: number
    minItemSize?: number
    sizeField?: string
    typeField?: string
    keyField?: string
    direction?: 'vertical' | 'horizontal'
    pageMode?: boolean
    prerender?: number
    buffer?: number
    emitUpdate?: boolean
    updateInterval?: number
    listClass?: string
    itemClass?: string
    listTag?: string
    itemTag?: string
  }

  export interface RecycleScrollerSlots<T = any> {
    default: (props: { item: T; index: number; active: boolean }) => VNode[]
    before?: () => VNode[]
    after?: () => VNode[]
    empty?: () => VNode[]
  }

  export const RecycleScroller: new <T = any>() => {
    $props: AllowedComponentProps & ComponentCustomProps & VNodeProps & RecycleScrollerProps<T>
    $slots: RecycleScrollerSlots<T>
  }
}

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
