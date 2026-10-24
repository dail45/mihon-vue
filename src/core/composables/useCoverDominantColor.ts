import { ref, watch, toValue, computed, type MaybeRefOrGetter } from 'vue'
import { generateDynamicTheme } from '@/core/theme/dynamicTheme'
import type { AppTheme } from '@/core/theme/appThemes'

interface ColorBucket {
  r: number
  g: number
  b: number
  count: number
}

/**
 * Extracts the dominant/primary accent color from an image URL using an offscreen canvas.
 * Implements a weighted quantization algorithm favoring saturated, vibrant artwork colors
 * over neutral background/border colors (white, black, gray).
 */
export async function extractDominantColorFromUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl || typeof window === 'undefined' || typeof Image === 'undefined') return null

  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      resolve(null)
    }, 4000)

    img.onload = () => {
      if (timedOut) return
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(null)
          return
        }

        // Downsample to 48x48 for fast sampling and noise reduction
        const sampleSize = 48
        canvas.width = sampleSize
        canvas.height = sampleSize

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const data = imageData.data

        const buckets: Map<number, ColorBucket> = new Map()

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const a = data[i + 3]!

          // Skip transparent or near-transparent pixels
          if (a < 128) continue

          // Quantize RGB to 4-bit bins (step of 16)
          const qR = Math.floor(r / 16) * 16
          const qG = Math.floor(g / 16) * 16
          const qB = Math.floor(b / 16) * 16
          const key = (qR << 16) | (qG << 8) | qB

          const existing = buckets.get(key)
          if (existing) {
            existing.count++
          } else {
            buckets.set(key, { r: qR, g: qG, b: qB, count: 1 })
          }
        }

        if (buckets.size === 0) {
          resolve(null)
          return
        }

        // Rank colors by combining pixel count with saturation & lightness balance
        let bestColor: ColorBucket | null = null
        let bestScore = -1

        for (const bucket of buckets.values()) {
          const rNorm = bucket.r / 255
          const gNorm = bucket.g / 255
          const bNorm = bucket.b / 255

          const max = Math.max(rNorm, gNorm, bNorm)
          const min = Math.min(rNorm, gNorm, bNorm)
          const delta = max - min
          const lightness = (max + min) / 2
          const saturation = max === 0 ? 0 : delta / max

          // Penalize pure black, pure white, and pure neutral grays
          let weight = 1
          if (lightness < 0.1 || lightness > 0.92) {
            weight *= 0.15
          } else if (saturation < 0.12) {
            weight *= 0.25
          } else {
            // Boost vibrant colors
            weight *= (1 + saturation * 2) * (1 - Math.abs(lightness - 0.5))
          }

          const score = bucket.count * weight
          if (score > bestScore) {
            bestScore = score
            bestColor = bucket
          }
        }

        if (!bestColor) {
          resolve(null)
          return
        }

        const hex =
          '#' +
          [bestColor.r, bestColor.g, bestColor.b]
            .map(c => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()

        resolve(hex)
      } catch {
        // Fallback for CORS security restrictions on canvas
        resolve(null)
      }
    }

    img.onerror = () => {
      if (timedOut) return
      clearTimeout(timer)
      resolve(null)
    }

    img.src = imageUrl
  })
}

/**
 * Composable providing reactive cover dominant color extraction and M3 theme generation.
 */
export function useCoverDominantColor(coverUrlSource?: MaybeRefOrGetter<string | null | undefined>) {
  const dominantColor = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const dynamicTheme = computed<AppTheme | null>(() => {
    if (!dominantColor.value) return null
    return generateDynamicTheme(dominantColor.value)
  })

  async function loadDominantColor(url: string | null | undefined) {
    if (!url) {
      dominantColor.value = null
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const color = await extractDominantColorFromUrl(url)
      dominantColor.value = color
    } catch (e) {
      error.value = e as Error
      dominantColor.value = null
    } finally {
      isLoading.value = false
    }
  }

  if (coverUrlSource !== undefined) {
    watch(
      () => toValue(coverUrlSource),
      nextUrl => {
        void loadDominantColor(nextUrl)
      },
      { immediate: true },
    )
  }

  return {
    dominantColor,
    dynamicTheme,
    isLoading,
    error,
    extractDominantColor: extractDominantColorFromUrl,
    loadDominantColor,
  }
}
