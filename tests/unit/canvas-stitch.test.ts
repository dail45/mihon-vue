import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  copyBlobToClipboard,
  saveBlobToFile,
  shareBlobFile,
  stitchPagesToBlob,
} from '@/features/reader/utils/canvasStitch'

describe('canvasStitch', () => {
  const origNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const origDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const origClipboardItem = (globalThis as any).ClipboardItem
  const origImage = (globalThis as any).Image

  beforeEach(() => {
    vi.restoreAllMocks()

    // Mock ClipboardItem
    ;(globalThis as any).ClipboardItem = class {
      constructor(public data: Record<string, Blob>) {}
    }

    // Mock navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          write: vi.fn().mockResolvedValue(undefined),
        },
      },
      configurable: true,
      writable: true,
    })

    // Mock document
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(),
        body: {
          appendChild: vi.fn(),
        },
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    if (origNavigator) Object.defineProperty(globalThis, 'navigator', origNavigator)
    if (origDocument) Object.defineProperty(globalThis, 'document', origDocument)
    ;(globalThis as any).ClipboardItem = origClipboardItem
    ;(globalThis as any).Image = origImage
  })

  describe('copyBlobToClipboard', () => {
    it('writes PNG blob to navigator.clipboard.write', async () => {
      const writeMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            write: writeMock,
          },
        },
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['fake-png-data'], { type: 'image/png' })
      const result = await copyBlobToClipboard(blob)

      expect(result).toBe(true)
      expect(writeMock).toHaveBeenCalledTimes(1)
      const items = writeMock.mock.calls[0][0]
      expect(items).toHaveLength(1)
    })

    it('returns false when clipboard API is not available', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['data'], { type: 'image/png' })
      const result = await copyBlobToClipboard(blob)
      expect(result).toBe(false)
    })

    it('returns false when clipboard write throws an error', async () => {
      const writeMock = vi.fn().mockRejectedValue(new Error('Permission denied'))
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            write: writeMock,
          },
        },
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['data'], { type: 'image/png' })
      const result = await copyBlobToClipboard(blob)
      expect(result).toBe(false)
    })
  })

  describe('stitchPagesToBlob', () => {
    it('stitches two images in LTR order', async () => {
      const drawCalls: any[] = []
      const fakeCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn((img, x, y) => {
          drawCalls.push({ img, x, y })
        }),
      }

      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: vi.fn((tagName: string) => {
            if (tagName === 'canvas') {
              return {
                width: 0,
                height: 0,
                getContext: () => fakeCtx,
                toBlob: (cb: (b: Blob) => void) => cb(new Blob(['stitched'], { type: 'image/png' })),
              }
            }
            return {}
          }),
        },
        configurable: true,
        writable: true,
      })

      // Mock Image
      ;(globalThis as any).Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        width = 200
        height = 300
        naturalWidth = 200
        naturalHeight = 300
        _src = ''
        get src() { return this._src }
        set src(v: string) {
          this._src = v
          setTimeout(() => this.onload?.(), 10)
        }
      }

      const result = await stitchPagesToBlob('http://example.com/p1.png', 'http://example.com/p2.png', 'ltr', {
        centerMargin: 8,
      })

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/png')
      // LTR: First image on left (x=0), second image on right (x=200 + 8 = 208)
      expect(drawCalls[0].x).toBe(0)
      expect(drawCalls[1].x).toBe(208)
    })

    it('stitches two images in RTL order', async () => {
      const drawCalls: any[] = []
      const fakeCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn((img, x, y) => {
          drawCalls.push({ img, x, y })
        }),
      }

      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: vi.fn((tagName: string) => {
            if (tagName === 'canvas') {
              return {
                width: 0,
                height: 0,
                getContext: () => fakeCtx,
                toBlob: (cb: (b: Blob) => void) => cb(new Blob(['stitched-rtl'], { type: 'image/png' })),
              }
            }
            return {}
          }),
        },
        configurable: true,
        writable: true,
      })

      ;(globalThis as any).Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        width = 200
        height = 300
        naturalWidth = 200
        naturalHeight = 300
        _src = ''
        get src() { return this._src }
        set src(v: string) {
          this._src = v
          setTimeout(() => this.onload?.(), 10)
        }
      }

      const result = await stitchPagesToBlob('http://example.com/p1.png', 'http://example.com/p2.png', 'rtl', {
        centerMargin: 10,
      })

      expect(result).toBeInstanceOf(Blob)
      // RTL: second image on left (x=0), first image on right (x=200 + 10 = 210)
      expect(drawCalls[0].x).toBe(210)
      expect(drawCalls[1].x).toBe(0)
    })
  })

  describe('saveBlobToFile', () => {
    it('creates download anchor and triggers click', () => {
      const clickSpy = vi.fn()
      const removeSpy = vi.fn()

      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: vi.fn((tagName: string) => {
            if (tagName === 'a') {
              return {
                href: '',
                download: '',
                click: clickSpy,
                remove: removeSpy,
              }
            }
            return {}
          }),
          body: {
            appendChild: vi.fn(),
          },
        },
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['data'], { type: 'image/png' })
      saveBlobToFile(blob, 'test-page.png')
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('shareBlobFile', () => {
    it('calls navigator.share when available and supported', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      const canShareMock = vi.fn().mockReturnValue(true)

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareMock,
          canShare: canShareMock,
        },
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['data'], { type: 'image/png' })
      const shared = await shareBlobFile(blob, 'manga-1.png', { title: 'Manga' })

      expect(shared).toBe(true)
      expect(shareMock).toHaveBeenCalledTimes(1)
      expect(shareMock.mock.calls[0][0].files).toHaveLength(1)
    })

    it('returns false when navigator.share is unsupported', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      })

      const blob = new Blob(['data'], { type: 'image/png' })
      const shared = await shareBlobFile(blob, 'manga-1.png')

      expect(shared).toBe(false)
    })
  })
})
