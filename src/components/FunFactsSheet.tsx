import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FUN_FACTS } from '../quiz/funfacts'
import { useSheetDrag } from '../hooks/useSheetDrag'
import styles from './FunFactsSheet.module.css'

/** Harry Potter Fun Facts — one verbatim fact per swipeable page.
 *  Horizontal scroll-snap for swiping; each page scrolls vertically if long.
 *  Drags up/down between snap points and closes by dragging down, exactly like
 *  the main menu sheet — no separate close button. */
export default function FunFactsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheetRef, size, onDragStart, onDragMove, onDragEnd } = useSheetDrag(onClose)
  const trackRef = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setIdx((prev) => (prev === i ? prev : i))
  }, [])

  const go = useCallback((i: number) => {
    const el = trackRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(FUN_FACTS.length - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
  }, [])

  if (!open) return null

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${size === 'expanded' ? styles.sheetExpanded : ''} ${size === 'full' ? styles.sheetFull : ''}`}
      role="dialog"
      aria-label="Harry Potter Fun Facts"
    >
      <div
        className={styles.handle}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        role="presentation"
      >
        <div className={styles.dragBar} aria-hidden="true" />
      </div>

      <div className={styles.topbar}>
        <span className={styles.counter}>{idx + 1} / {FUN_FACTS.length}</span>
      </div>

      <div ref={trackRef} className={styles.track} onScroll={onScroll}>
        {FUN_FACTS.map((f, i) => (
          <article key={i} className={styles.page} aria-hidden={i !== idx}>
            <h2 className={styles.title}>{f.title}</h2>
            {f.paragraphs.map((p, j) => (
              <p key={j} className={styles.para}>{p}</p>
            ))}
          </article>
        ))}
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          aria-label="Forrige"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => go(idx + 1)}
          disabled={idx === FUN_FACTS.length - 1}
          aria-label="Neste"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
