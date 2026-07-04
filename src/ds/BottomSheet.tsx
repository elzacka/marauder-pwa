import { useRef, useState, useCallback } from 'react'
import styles from './BottomSheet.module.css'

export type SnapPoint = 'peek' | 'mid'

type Props = {
  snap: SnapPoint
  onSnapChange: (s: SnapPoint) => void
  header: React.ReactNode
  children: React.ReactNode
}

export function BottomSheet({ snap, onSnapChange, header, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const startSnap = useRef<SnapPoint>('peek')

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startY.current = e.clientY
    startSnap.current = snap
    setDragging(true)
    const sheet = sheetRef.current
    if (sheet) sheet.style.transition = 'none'
  }, [snap])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    const sheet = sheetRef.current
    if (!sheet) return
    const dy = e.clientY - startY.current
    // Clamp: don't drag above mid position
    const clampedDy = Math.max(startSnap.current === 'mid' ? 0 : -999, dy)
    sheet.style.setProperty('--drag-offset', `${clampedDy}px`)
    sheet.style.transform = `translateY(calc(var(--snap-translate) + ${clampedDy}px))`
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const sheet = sheetRef.current
    if (sheet) {
      sheet.style.transition = ''
      sheet.style.transform = ''
    }
    setDragging(false)
    const dy = e.clientY - startY.current
    if (Math.abs(dy) < 8) return
    if (startSnap.current === 'peek' && dy < -48) onSnapChange('mid')
    else if (startSnap.current === 'mid' && dy > 48) onSnapChange('peek')
  }, [onSnapChange])

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${styles[snap]} ${dragging ? styles.dragging : ''}`}
      aria-label="Stedspanel"
    >
      <div
        className={styles.dragZone}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="presentation"
      >
        <div className={styles.dragBar} aria-hidden="true" />
      </div>

      <div className={styles.headerArea}>
        {header}
      </div>

      <div className={styles.scrollArea}>
        {children}
      </div>
    </div>
  )
}
