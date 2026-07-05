// TEMPORARY — viewport diagnosis overlay (added 2026-07-05).
// Remove this component and its usage in App.tsx once the bottom-field /
// control-overlap bug is diagnosed. It renders live viewport, safe-area and
// display-mode values so the bug can be measured on-device instead of guessed
// from screenshots.
import { useEffect, useState } from 'react'

type DebugValues = {
  innerW: number
  innerH: number
  clientH: number
  vvH: number | null
  vvOffsetTop: number | null
  screenW: number
  screenH: number
  dpr: number
  safeTop: number
  safeBottom: number
  standalone: boolean
}

function readSafeArea(): { top: number; bottom: number } {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const top = parseFloat(cs.paddingTop) || 0
  const bottom = parseFloat(cs.paddingBottom) || 0
  probe.remove()
  return { top, bottom }
}

function readValues(): DebugValues {
  const safe = readSafeArea()
  const vv = window.visualViewport
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    clientH: document.documentElement.clientHeight,
    vvH: vv ? Math.round(vv.height) : null,
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : null,
    screenW: window.screen.width,
    screenH: window.screen.height,
    dpr: window.devicePixelRatio,
    safeTop: safe.top,
    safeBottom: safe.bottom,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true,
  }
}

export default function DebugOverlay() {
  const [v, setV] = useState<DebugValues>(readValues)

  useEffect(() => {
    const update = () => setV(readValues())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])

  const rows: Array<[string, string]> = [
    ['inner', `${v.innerW} x ${v.innerH}`],
    ['clientH', `${v.clientH}`],
    ['visualVp', v.vvH === null ? 'n/a' : `${v.vvH} (top ${v.vvOffsetTop})`],
    ['screen', `${v.screenW} x ${v.screenH} @${v.dpr}x`],
    ['safe t/b', `${v.safeTop} / ${v.safeBottom}`],
    ['standalone', v.standalone ? 'yes' : 'no'],
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        left: 4,
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.78)',
        color: '#fff',
        fontFamily: 'Courier, monospace',
        fontSize: 11,
        lineHeight: 1.45,
        padding: '6px 8px',
        borderRadius: 6,
        whiteSpace: 'pre',
      }}
    >
      {rows.map(([k, val]) => `${k.padEnd(11)}${val}`).join('\n')}
    </div>
  )
}
