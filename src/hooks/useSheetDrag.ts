import { useRef, useCallback } from 'react'

const DISMISS_THRESHOLD = 72

export function useSheetDrag(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    const sheet = sheetRef.current
    if (sheet) sheet.style.transition = 'none'
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    const sheet = sheetRef.current
    if (sheet) sheet.style.transform = `translateY(${dy}px)`
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const dy = e.clientY - dragStartY.current
    const sheet = sheetRef.current
    if (sheet) { sheet.style.transition = ''; sheet.style.transform = '' }
    if (dy > DISMISS_THRESHOLD) onClose()
  }, [onClose])

  return { sheetRef, onDragStart, onDragMove, onDragEnd }
}
