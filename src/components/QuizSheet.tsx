import { useState, useMemo, useCallback } from 'react'
import { QUIZ_QUESTIONS } from '../quiz/questions'
import { useSheetDrag } from '../hooks/useSheetDrag'
import styles from './QuizSheet.module.css'

const ROUND_SIZE = 10

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// O.W.L. grades — canon wording
function verdict(score: number): string {
  if (score >= 9) return 'Outstanding! Hermione would be proud.'
  if (score >= 7) return 'Exceeds Expectations.'
  if (score >= 5) return 'Acceptable. More time in the library, perhaps?'
  return 'Troll… Read the books again on the train!'
}

/** Offline HP quiz — 10 random questions per round (train entertainment) */
export default function QuizSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheetRef, onDragStart, onDragMove, onDragEnd } = useSheetDrag(onClose, { resizable: false })
  const [roundKey, setRoundKey] = useState(0)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<number | null>(null)

  const round = useMemo(
    () =>
      shuffle(QUIZ_QUESTIONS)
        .slice(0, ROUND_SIZE)
        .map((q) => {
          const opts = q.options.map((text, i) => ({ text, correct: i === 0 }))
          return { q: q.q, options: shuffle(opts) }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roundKey],
  )

  const restart = useCallback(() => {
    setRoundKey((k) => k + 1)
    setIndex(0)
    setScore(0)
    setAnswered(null)
  }, [])

  if (!open) return null

  const done = index >= ROUND_SIZE
  const current = done ? null : round[index]

  function answer(i: number) {
    if (answered !== null || !current) return
    setAnswered(i)
    if (current.options[i].correct) setScore((s) => s + 1)
    setTimeout(() => {
      setAnswered(null)
      setIndex((x) => x + 1)
    }, 900)
  }

  return (
    <div
      ref={sheetRef}
      className={styles.sheet}
      role="dialog"
      aria-label="HP-quiz"
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

      {!done && current && (
        <div className={styles.content}>
          <p className={styles.progress}>Spørsmål {index + 1} av {ROUND_SIZE} · {score} riktige</p>
          <h2 className={styles.question}>{current.q}</h2>
          <div className={styles.options}>
            {current.options.map((opt, i) => {
              const state =
                answered === null ? '' :
                opt.correct ? styles.correct :
                answered === i ? styles.wrong : styles.dimmed
              return (
                <button
                  key={opt.text}
                  type="button"
                  className={`${styles.option} ${state}`}
                  onClick={() => answer(i)}
                  disabled={answered !== null}
                >
                  {opt.text}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {done && (
        <div className={styles.content}>
          <h2 className={styles.question}>{score} av {ROUND_SIZE} riktige</h2>
          <p className={styles.verdict}>{verdict(score)}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={restart}>
              Ny runde
            </button>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Lukk
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
