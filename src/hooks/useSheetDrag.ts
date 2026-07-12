import { useRef, useCallback, useState } from 'react'

const DISMISS_THRESHOLD = 72

export type SheetSize = 'default' | 'expanded' | 'full'

/** Space reserved at the top for the Marauder wordmark — the sheet's upper
 *  edge never travels past this. Keep in sync with --sheet-full-height. */
const TOP_RESERVED_PX = 64

/** Snap heights in px for the current viewport — keep in sync with the
 *  --sheet-*-height tokens in tokens.css */
function snapHeights(vh: number): Array<{ size: SheetSize; height: number }> {
  return [
    { size: 'default', height: vh * 0.5 },
    { size: 'expanded', height: vh * 0.7 },
    { size: 'full', height: vh - TOP_RESERVED_PX },
  ]
}

type Options = {
  /** Drag up/down resizes the sheet between the snap points.
      When false, only drag-down-to-close is available (e.g. form sheets). */
  resizable?: boolean
}

/**
 * Shared drag behaviour for bottom sheets:
 * three snap points — 50svh (default), 70svh (expanded), full (100svh − 64px) —
 * plus drag far down to close. During the drag the sheet height follows the
 * finger; on release it snaps to the nearest point.
 */
export function useSheetDrag(onClose: () => void, { resizable = true }: Options = {}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const startHeight = useRef(0)
  const [size, setSize] = useState<SheetSize>('default')

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    const sheet = sheetRef.current
    if (sheet) {
      startHeight.current = sheet.getBoundingClientRect().height
      sheet.style.transition = 'none'
    }
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    const dy = e.clientY - dragStartY.current // positive = downwards
    const sheet = sheetRef.current
    if (!sheet) return
    if (resizable) {
      // Clamp: never past the reserved top strip, never below a sliver
      const max = window.innerHeight - TOP_RESERVED_PX
      const h = Math.min(max, Math.max(64, startHeight.current - dy))
      sheet.style.height = `${h}px`
    } else {
      sheet.style.transform = `translateY(${Math.max(0, dy)}px)`
    }
  }, [resizable])

  const onDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dy = e.clientY - dragStartY.current
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = ''
      sheet.style.transform = ''
      sheet.style.height = ''
    }
    if (!resizable) {
      if (dy > DISMISS_THRESHOLD) onClose()
      return
    }
    const endHeight = startHeight.current - dy
    const vh = window.innerHeight
    if (endHeight < vh * 0.18) {
      setSize('default')
      onClose()
      return
    }
    // Snap to the nearest point (default / expanded / full)
    let nearest: SheetSize = 'default'
    let best = Number.POSITIVE_INFINITY
    for (const { size: s, height } of snapHeights(vh)) {
      const d = Math.abs(endHeight - height)
      if (d < best) {
        best = d
        nearest = s
      }
    }
    setSize(nearest)
  }, [onClose, resizable])

  // pointercancel (e.g. iOS scroll takeover) — revert the in-flight drag
  // without snapping or closing. clientY may be 0 on iOS 26, so never pass
  // pointercancel through onDragEnd.
  const onDragCancel = useCallback(() => {
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = ''
      sheet.style.transform = ''
      sheet.style.height = ''
    }
  }, [])

  return { sheetRef, size, setSize, onDragStart, onDragMove, onDragEnd, onDragCancel }
}
