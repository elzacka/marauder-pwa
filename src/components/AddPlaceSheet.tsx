import { useState, useRef, useCallback, useId } from 'react'
import styles from './AddPlaceSheet.module.css'

type Props = {
  coords: { lng: number; lat: number } | null
  onSave: (name: string, description: string) => void
  onClose: () => void
}

export default function AddPlaceSheet({ coords, onSave, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const nameId = useId()
  const descId = useId()

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
    const sheet = sheetRef.current
    if (sheet) { sheet.style.transition = ''; sheet.style.transform = '' }
    if (e.clientY - dragStartY.current > 72) onClose()
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), description.trim())
    setName('')
    setDescription('')
  }

  if (!coords) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Legg til sted"
        onClick={(e) => e.stopPropagation()}
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

        <div className={styles.content}>
          <h2 className={styles.title}>Legg til sted</h2>
          <p className={styles.coords}>
            {coords.lat.toFixed(5)}° N, {Math.abs(coords.lng).toFixed(5)}° {coords.lng < 0 ? 'V' : 'Ø'}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor={nameId} className={styles.label}>Navn</label>
              <input
                id={nameId}
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Skriv inn stedsnavn…"
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label htmlFor={descId} className={styles.label}>Beskrivelse <span className={styles.optional}>(valgfritt)</span></label>
              <textarea
                id={descId}
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notater om stedet…"
                rows={3}
              />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Avbryt
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
                Lagre sted
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
