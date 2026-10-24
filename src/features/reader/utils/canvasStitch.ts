/**
 * Reader Dual-Page Canvas Stitching Utility
 *
 * Stitches two manga pages side-by-side onto an OffscreenCanvas or HTMLCanvasElement,
 * honoring LTR and RTL (Japanese manga) reading direction, and provides high-fidelity
 * clipboard copying via ClipboardItem('image/png').
 *
 * Reference:
 * - Komikku / SY ImageUtil.mergeBitmaps
 * - Komikku ReaderViewModel.shareImages / saveImages
 */

export interface CanvasStitchOptions {
  direction?: 'ltr' | 'rtl'
  backgroundColor?: string
  centerMargin?: number
}

export interface LoadedImageSource {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

/**
 * Loads an image from a URL or Blob into a drawable source (ImageBitmap or HTMLImageElement).
 */
export async function loadImageSource(urlOrBlob: string | Blob): Promise<LoadedImageSource> {
  let blob: Blob

  if (typeof urlOrBlob === 'string') {
    try {
      const resp = await fetch(urlOrBlob, { credentials: 'include' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      blob = await resp.blob()
    } catch {
      // Fallback: load directly via HTMLImageElement
      return new Promise<LoadedImageSource>((resolve, reject) => {
        if (typeof Image === 'undefined') {
          reject(new Error('HTMLImageElement is not supported in this environment.'))
          return
        }
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          resolve({
            source: img,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            close: () => {},
          })
        }
        img.onerror = () => reject(new Error(`Failed to load image from ${urlOrBlob}`))
        img.src = urlOrBlob
      })
    }
  } else {
    blob = urlOrBlob
  }

  // Modern browsers: createImageBitmap is fast and doesn't block DOM
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => {
          if (typeof bitmap.close === 'function') bitmap.close()
        },
      }
    } catch {
      // Fall through to object URL fallback
    }
  }

  if (typeof URL !== 'undefined' && typeof Image !== 'undefined') {
    const objectUrl = URL.createObjectURL(blob)
    return new Promise<LoadedImageSource>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          source: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          close: () => URL.revokeObjectURL(objectUrl),
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Failed to decode image from blob'))
      }
      img.src = objectUrl
    })
  }

  throw new Error('No supported image decoding API found in environment.')
}

/**
 * Stitches two images side-by-side into a single PNG Blob.
 *
 * In LTR reading order:
 * - First page is placed on the LEFT
 * - Second page is placed on the RIGHT
 *
 * In RTL reading order (Manga):
 * - First page is placed on the RIGHT
 * - Second page is placed on the LEFT
 */
export async function stitchPagesToBlob(
  firstSource: string | Blob,
  secondSource: string | Blob,
  direction: 'ltr' | 'rtl' = 'ltr',
  options?: CanvasStitchOptions
): Promise<Blob> {
  const [img1, img2] = await Promise.all([
    loadImageSource(firstSource),
    loadImageSource(secondSource),
  ])

  try {
    const centerMargin = options?.centerMargin ?? 0
    const totalWidth = img1.width + img2.width + centerMargin
    const maxHeight = Math.max(img1.height, img2.height)

    // Calculate layout coordinates
    let x1 = 0
    let x2 = 0
    if (direction === 'ltr') {
      x1 = 0
      x2 = img1.width + centerMargin
    } else {
      // RTL: second page on left, first page on right
      x2 = 0
      x1 = img2.width + centerMargin
    }

    const y1 = Math.floor((maxHeight - img1.height) / 2)
    const y2 = Math.floor((maxHeight - img2.height) / 2)

    // Use OffscreenCanvas where available
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(totalWidth, maxHeight)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get 2d context for OffscreenCanvas')

      if (options?.backgroundColor) {
        ctx.fillStyle = options.backgroundColor
        ctx.fillRect(0, 0, totalWidth, maxHeight)
      }

      ctx.drawImage(img1.source as CanvasImageSource, x1, y1)
      ctx.drawImage(img2.source as CanvasImageSource, x2, y2)

      return await canvas.convertToBlob({ type: 'image/png' })
    }

    // Fallback to DOM HTMLCanvasElement
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      canvas.width = totalWidth
      canvas.height = maxHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get 2d context for HTMLCanvasElement')

      if (options?.backgroundColor) {
        ctx.fillStyle = options.backgroundColor
        ctx.fillRect(0, 0, totalWidth, maxHeight)
      }

      ctx.drawImage(img1.source as CanvasImageSource, x1, y1)
      ctx.drawImage(img2.source as CanvasImageSource, x2, y2)

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create PNG blob from canvas'))
        }, 'image/png')
      })
    }

    throw new Error('Canvas API is not supported in this environment.')
  } finally {
    img1.close()
    img2.close()
  }
}

/**
 * Copies a PNG blob directly to the system clipboard via `navigator.clipboard.write`.
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false
  }

  // Ensure blob is image/png
  let pngBlob = blob
  if (blob.type !== 'image/png') {
    if (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined') {
      const img = await loadImageSource(blob)
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          const c = new OffscreenCanvas(img.width, img.height)
          const ctx = c.getContext('2d')
          ctx?.drawImage(img.source as CanvasImageSource, 0, 0)
          pngBlob = await c.convertToBlob({ type: 'image/png' })
        } else if (typeof document !== 'undefined') {
          const c = document.createElement('canvas')
          c.width = img.width
          c.height = img.height
          const ctx = c.getContext('2d')
          ctx?.drawImage(img.source as CanvasImageSource, 0, 0)
          pngBlob = await new Promise<Blob>((resolve, reject) => {
            c.toBlob(b => b ? resolve(b) : reject(new Error('Conversion failed')), 'image/png')
          })
        }
      } finally {
        img.close()
      }
    }
  }

  try {
    const item = new ClipboardItem({ 'image/png': pngBlob })
    await navigator.clipboard.write([item])
    return true
  } catch {
    return false
  }
}

/**
 * Stitches two pages and immediately writes the result to the system clipboard.
 */
export async function copyStitchedPagesToClipboard(
  firstSource: string | Blob,
  secondSource: string | Blob,
  direction: 'ltr' | 'rtl' = 'ltr',
  options?: CanvasStitchOptions
): Promise<Blob> {
  const blob = await stitchPagesToBlob(firstSource, secondSource, direction, options)
  const copied = await copyBlobToClipboard(blob)
  if (!copied) {
    throw new Error('Clipboard image copying is not supported in this browser.')
  }
  return blob
}

/**
 * Triggers a file download for the given Blob.
 */
export function saveBlobToFile(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Shares a Blob using the Web Share API if supported.
 */
export async function shareBlobFile(
  blob: Blob,
  filename: string,
  metadata?: { title?: string; text?: string }
): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  const shareNavigator = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  if (typeof shareNavigator.share !== 'function') return false

  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  if (typeof shareNavigator.canShare === 'function' && !shareNavigator.canShare({ files: [file] })) {
    return false
  }

  await shareNavigator.share({
    files: [file],
    title: metadata?.title,
    text: metadata?.text,
  })
  return true
}
