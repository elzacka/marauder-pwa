import { useState, useEffect, useId } from 'react'
import { useSheetDrag } from '../hooks/useSheetDrag'
import styles from './AddPlaceSheet.module.css'

type Props = {
  coords: { lng: number; lat: number } | null
  /** Prefilled name, e.g. from a saved geocode result or when editing */
  initialName?: string
  /** Prefilled description — used when editing an existing place */
  initialDescription?: string
  /** Prefilled tags — used when editing an existing place */
  initialTags?: string[]
  /** Prefilled image URL — used when editing an existing place */
  initialImageUrl?: string | null
  /** Tags already in use on other places — offered as quick-add chips */
  existingTags?: string[]
  /** Sheet heading; defaults to "Legg til sted" */
  title?: string
  onSave: (name: string, description: string, tags: string[], imageUrl: string | null) => void
  onClose: () => void
}

export default function AddPlaceSheet({
  coords, initialName, initialDescription, initialTags, initialImageUrl, existingTags = [],
  title = 'Legg til sted', onSave, onClose,
}: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // Reset the form each time the sheet opens; prefill when provided
  // (geocode hits pass a name; editing passes name + description + tags).
  useEffect(() => {
    if (coords) {
      setName(initialName ?? '')
      setDescription(initialDescription ?? '')
      setTags(initialTags ?? [])
      setNewTag('')
      setImageUrl(initialImageUrl ?? '')
    }
  }, [coords, initialName, initialDescription, initialTags, initialImageUrl])

  function addTag(raw: string) {
    const t = raw.trim()
    if (!t) return
    setTags((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t],
    )
    setNewTag('')
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t))
  }

  const suggestions = existingTags.filter(
    (t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()),
  )
  // Form sheet: content-sized, not resizable — drag only closes
  const { sheetRef, onDragStart, onDragMove, onDragEnd, onDragCancel } = useSheetDrag(onClose, { resizable: false })
  const nameId = useId()
  const descId = useId()
  const imageId = useId()
  const tagId = useId()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    // Include a typed-but-not-added tag so it is not silently lost
    const pending = newTag.trim()
    const finalTags = pending && !tags.some((x) => x.toLowerCase() === pending.toLowerCase())
      ? [...tags, pending]
      : tags
    const finalImageUrl = imageUrl.trim() || null
    onSave(name.trim(), description.trim(), finalTags, finalImageUrl)
    setName('')
    setDescription('')
    setTags([])
    setNewTag('')
    setImageUrl('')
  }

  function handleBackdropClose() {
    if (name.trim() || description.trim() || tags.length > 0 || imageUrl.trim()) {
      if (!window.confirm('Forkaste endringer og lukke?')) return
    }
    onClose()
  }

  if (!coords) return null

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClose} role="presentation" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.handle}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
          role="presentation"
        >
          <div className={styles.dragBar} aria-hidden="true" />
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
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

            <div className={styles.field}>
              <label htmlFor={imageId} className={styles.label}>Bilde-URL <span className={styles.optional}>(valgfritt)</span></label>
              <input
                id={imageId}
                type="url"
                className={styles.input}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor={tagId} className={styles.label}>
                Etiketter <span className={styles.optional}>(valgfritt)</span>
              </label>
              {tags.length > 0 && (
                <div className={styles.tagRow}>
                  {tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={styles.tagChipOn}
                      onClick={() => removeTag(t)}
                      aria-label={`Fjern etiketten ${t}`}
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.tagInputRow}>
                <input
                  id={tagId}
                  type="text"
                  className={styles.input}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Ny etikett…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag(newTag)
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.tagAddBtn}
                  onClick={() => addTag(newTag)}
                  disabled={!newTag.trim()}
                >
                  Legg til
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className={styles.tagRow}>
                  {suggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={styles.tagChip}
                      onClick={() => addTag(t)}
                      aria-label={`Legg til etiketten ${t}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
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
