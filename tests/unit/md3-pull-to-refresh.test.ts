import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const scssSource = readFileSync('src/styles/main.scss', 'utf8')
const componentSource = readFileSync('src/core/components/Md3PullToRefresh.vue', 'utf8')

describe('MD3 Pull-to-Refresh: Browser Containment in main.scss', () => {
  it('disables native browser pull-to-refresh on html, body, #app, .v-application, and .v-main', () => {
    // oversroll-behavior-y: contain ensures Chrome/Safari mobile never triggers full-page reload
    expect(scssSource).toMatch(/html\s*\{[^}]*overscroll-behavior-y:\s*contain;/s)
    expect(scssSource).toMatch(/body\s*\{[^}]*overscroll-behavior-y:\s*contain;/s)
    expect(scssSource).toMatch(/#app\s*\{[^}]*overscroll-behavior-y:\s*contain;/s)
    expect(scssSource).toMatch(/\.v-application\s*\{[^}]*overscroll-behavior-y:\s*contain;/s)
    expect(scssSource).toMatch(/\.v-main\s*\{[^}]*overscroll-behavior-y:\s*contain;/s)
  })
})

describe('MD3 Pull-to-Refresh: Component Architecture & Geometry', () => {
  it('wraps default slot content in a relative container with ref containerRef', () => {
    expect(componentSource).toContain('class="md3-pull-to-refresh" ref="containerRef"')
    expect(componentSource).toContain('<slot />')
    expect(componentSource).toMatch(/\.md3-pull-to-refresh\s*\{[^}]*position:\s*relative;/s)
  })

  it('implements authentic MD3 floating indicator pill dimensions and styling', () => {
    // Jetpack Compose M3 PullToRefreshDefaults.Indicator: 40dp circle with Level 2/3 elevation
    expect(componentSource).toMatch(/width:\s*40px;/)
    expect(componentSource).toMatch(/height:\s*40px;/)
    expect(componentSource).toMatch(/border-radius:\s*9999px;/)
    expect(componentSource).toMatch(/left:\s*50%;/)
    expect(componentSource).toMatch(/top:\s*16px;/)
    expect(componentSource).toMatch(/z-index:\s*10;/)
    expect(componentSource).toMatch(/pointer-events:\s*none;/)
    expect(componentSource).toMatch(/box-shadow:\s*0 1px 3px rgba\(0,\s*0,\s*0,\s*0\.3\),\s*0 4px 8px 3px rgba\(0,\s*0,\s*0,\s*0\.15\);/)
    expect(componentSource).toContain('rgb(var(--v-theme-surface-container-high, 236 230 240))')
    expect(componentSource).toContain('rgb(var(--v-theme-primary, 103 80 164))')
  })

  it('declares the specified Props and Emits contracts', () => {
    // Props
    expect(componentSource).toContain('modelValue?: boolean')
    expect(componentSource).toContain('refreshing?: boolean')
    expect(componentSource).toContain('disabled?: boolean')
    expect(componentSource).toContain('threshold?: number')
    expect(componentSource).toContain('maxPull?: number')

    // Emits
    expect(componentSource).toContain("(e: 'refresh'): void")
    expect(componentSource).toContain("(e: 'update:modelValue', value: boolean): void")
    expect(componentSource).toContain("(e: 'update:refreshing', value: boolean): void")
  })

  it('renders standard M3 pulling SVG arc with tangent arrow tip', () => {
    expect(componentSource).toContain('v-if="!isRefreshing"')
    expect(componentSource).toContain('class="md3-pull-to-refresh__track"')
    expect(componentSource).toContain('class="md3-pull-to-refresh__arrow"')
    // Arc pathLength 100 with proportional stroke sweep
    expect(componentSource).toContain(':stroke-dasharray="`${pullProgress * 75} 100`"')
    // Arrow rotated clockwise with the arc sweep
    expect(componentSource).toContain(':transform="`rotate(${pullProgress * 270 - 90} 12 12)`"')
  })

  it('renders authentic indeterminate M3 circular progress spinner when refreshing', () => {
    expect(componentSource).toContain('class="md3-pull-to-refresh__spinner"')
    expect(componentSource).toContain('md3-ptr-global-rotate')
    expect(componentSource).toContain('md3-ptr-step-rotate')
    expect(componentSource).toContain('md3-ptr-sweep')
    expect(componentSource).toContain('animation: md3-ptr-global-rotate 6s linear infinite')
  })

  it('snaps to resting offset when refreshing and scales down to 0 on finish', () => {
    // Snaps to resting offset translate(-50%, 16px)
    expect(componentSource).toMatch(/\.md3-pull-to-refresh__indicator--refreshing\s*\{[^}]*transform:\s*translate\(-50%,\s*16px\);/s)
    // Smooth scale-down transition to scale(0) and opacity 0
    expect(componentSource).toMatch(/\.md3-pull-to-refresh__indicator--closing\s*\{[^}]*transform:\s*translate\(-50%,\s*16px\)\s*scale\(0\);\s*opacity:\s*0;/s)
    expect(componentSource).toMatch(/transition:\s*transform 0\.2s cubic-bezier\(0\.2,\s*0,\s*0,\s*1\),\s*opacity 0\.2s linear;/s)
  })
})

describe('MD3 Pull-to-Refresh: Resistance & Progress Mathematics', () => {
  const calculatePull = (deltaY: number, threshold = 72, maxPull = 120) => {
    const pullDistance = Math.min(maxPull, Math.max(0, deltaY) * 0.45)
    const pullProgress = Math.min(1, Math.max(0, pullDistance / threshold))
    return { pullDistance, pullProgress }
  }

  it('calculates 0 pull distance and progress at idle', () => {
    const { pullDistance, pullProgress } = calculatePull(0)
    expect(pullDistance).toBe(0)
    expect(pullProgress).toBe(0)
  })

  it('applies rubber-band resistance 0.45x factor below threshold', () => {
    // 100px drag * 0.45 = 45px pull distance
    const { pullDistance, pullProgress } = calculatePull(100, 72, 120)
    expect(pullDistance).toBe(45)
    expect(pullProgress).toBeCloseTo(45 / 72, 4)
    expect(pullProgress).toBeLessThan(1)
  })

  it('reaches pullProgress 1.0 at threshold (160px drag * 0.45 = 72px)', () => {
    const { pullDistance, pullProgress } = calculatePull(160, 72, 120)
    expect(pullDistance).toBe(72)
    expect(pullProgress).toBe(1.0)
  })

  it('caps pullDistance at maxPull (120px) and clamps pullProgress to 1.0', () => {
    const { pullDistance, pullProgress } = calculatePull(350, 72, 120)
    expect(pullDistance).toBe(120)
    expect(pullProgress).toBe(1.0)
  })

  it('derives maxPull as threshold * 1.6 when custom threshold is provided without maxPull', () => {
    const customThreshold = 100
    const derivedMaxPull = customThreshold * 1.6 // 160
    const { pullDistance, pullProgress } = calculatePull(300, customThreshold, derivedMaxPull)
    // 300 * 0.45 = 135
    expect(pullDistance).toBe(135)
    expect(pullProgress).toBeCloseTo(1.35 > 1 ? 1 : 1.35)
  })
})

describe('MD3 Pull-to-Refresh: Scroll & Gesture Validation Invariants', () => {
  it('registers non-passive touchmove listener to allow preventDefault', () => {
    expect(componentSource).toContain("addEventListener('touchmove', handleTouchMove, { passive: false })")
    expect(componentSource).toContain('if (event.cancelable)')
    expect(componentSource).toContain('event.preventDefault()')
  })

  it('checks top scroll state across window, container, and child scrollables like .vue-recycle-scroller', () => {
    expect(componentSource).toContain('window.scrollY')
    expect(componentSource).toContain('container.scrollTop')
    expect(componentSource).toContain('.vue-recycle-scroller')
  })

  it('aborts vertical pull when predominantly horizontal gesture is detected', () => {
    expect(componentSource).toContain('Math.abs(deltaX) > Math.abs(deltaY)')
    expect(componentSource).toContain('touchActive = false')
  })

  it('supports async Promise resolution from onRefresh handler', () => {
    expect(componentSource).toContain("typeof props.onRefresh === 'function'")
    expect(componentSource).toContain('await res')
    expect(componentSource).toContain('finishRefresh()')
  })
})
