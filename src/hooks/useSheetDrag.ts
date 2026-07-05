import { useRef, useCallback, useState } from 'react'

const DISMISS_THRESHOLD = 72

type Options = {
  /** Drag up/down resizes the sheet between default and expanded height.
      When false, only drag-down-to-close is available (e.g. form sheets). */
  resizable?: boolean
}

/**
 * Shared drag behaviour for bottom sheets (Lene, 2026-07-05):
 * drag up → expanded (85svh), drag down → default (33svh), drag far down → close.
 * During the drag the sheet height follows the finger; on release it snaps.
 */
export function useSheetDrag(onClose: () => void, { resizable = true }: Options = {}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const startHeight = useRef(0)
  const [expanded, setExpanded] = useState(false)

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
      const h = Math.min(window.innerHeight * 0.92, Math.max(64, startHeight.current - dy))
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
      setExpanded(false)
      onClose()
      return
    }
    // Snap: above the midpoint between the two states → expanded
    setExpanded(endHeight > vh * 0.55)
  }, [onClose, resizable])

  return { sheetRef, expanded, setExpanded, onDragStart, onDragMove, onDragEnd }
}
