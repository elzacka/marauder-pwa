import { useState, useMemo, useCallback, useEffect } from 'react'
import { QUIZ_BOOKS, ALL_QUIZ_QUESTIONS, type QuizBook } from '../quiz/questions'
import { useSheetDrag } from '../hooks/useSheetDrag'
import { useQuizBest } from '../hooks/useQuizBest'
import { Star, ChevronLeft } from 'lucide-react'
import styles from './QuizSheet.module.css'

// The full-series exam, treated as one big "book"
const NEWT: QuizBook = { key: 'newt', title: 'N.E.W.T. — All books', questions: ALL_QUIZ_QUESTIONS }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// O.W.L. grades, scaled to the round's length — canon wording
function verdict(score: number, total: number): string {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return 'Outstanding! A true Marauder — every question, no mistakes.'
  if (pct >= 0.9) return 'Outstanding! Hermione would be proud.'
  if (pct >= 0.7) return 'Exceeds Expectations.'
  if (pct >= 0.5) return 'Acceptable. More time in the library, perhaps?'
  return 'Troll… Read the books again on the train!'
}

type Wrong = { q: string; correct: string; chosen: string }

/** Offline HP quiz — pick a book (or the full N.E.W.T. exam), answer all its
 *  questions in random order. Best score per book is saved and shown, so there
 *  is always a personal record to beat. */
export default function QuizSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sheetRef, onDragStart, onDragMove, onDragEnd } = useSheetDrag(onClose, { resizable: false })
  const { best, record } = useQuizBest()
  const [book, setBook] = useState<QuizBook | null>(null)
  const [roundKey, setRoundKey] = useState(0)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<number | null>(null)
  const [wrong, setWrong] = useState<Wrong[]>([])
  const [prevBest, setPrevBest] = useState(0)

  const round = useMemo(
    () =>
      book
        ? shuffle(book.questions).map((q) => ({
            q: q.q,
            options: shuffle(q.options.map((text, i) => ({ text, correct: i === 0 }))),
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, roundKey],
  )

  const total = round.length
  const done = book !== null && index >= total
  const current = book !== null && !done ? round[index] : null

  // Persist the best score once a round is finished
  useEffect(() => {
    if (done && book) record(book.key, score)
  }, [done, book, score, record])

  const beginRound = useCallback(() => {
    setRoundKey((k) => k + 1)
    setIndex(0)
    setScore(0)
    setAnswered(null)
    setWrong([])
  }, [])

  const startBook = useCallback((b: QuizBook) => {
    setPrevBest(best[b.key] ?? 0)
    setBook(b)
    beginRound()
  }, [best, beginRound])

  const restart = useCallback(() => {
    if (book) setPrevBest(best[book.key] ?? 0)
    beginRound()
  }, [book, best, beginRound])

  const backToList = useCallback(() => {
    setBook(null)
    setIndex(0)
    setScore(0)
    setAnswered(null)
    setWrong([])
  }, [])

  if (!open) return null

  function answer(i: number) {
    if (answered !== null || !current) return
    setAnswered(i)
    if (current.options[i].correct) {
      setScore((s) => s + 1)
    } else {
      const correct = current.options.find((o) => o.correct)?.text ?? ''
      setWrong((w) => [...w, { q: current.q, correct, chosen: current.options[i].text }])
    }
    setTimeout(() => {
      setAnswered(null)
      setIndex((x) => x + 1)
    }, 900)
  }

  const mastered = QUIZ_BOOKS.filter((b) => (best[b.key] ?? 0) === b.questions.length).length
  const isNewBest = done && score > prevBest && score > 0

  return (
    <div ref={sheetRef} className={styles.sheet} role="dialog" aria-label="HP-quiz">
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

      {/* Book picker */}
      {book === null && (
        <div className={styles.content}>
          <h2 className={styles.question}>Velg kategori</h2>
          <p className={styles.mastery}>Mestret: {mastered} av {QUIZ_BOOKS.length} kategorier</p>
          <ul className={styles.bookList} role="list">
            {QUIZ_BOOKS.map((b) => {
              const bScore = best[b.key]
              const isMastered = (bScore ?? 0) === b.questions.length
              return (
                <li key={b.key}>
                  <button type="button" className={styles.bookRow} onClick={() => startBook(b)}>
                    <span className={styles.bookTitle}>{b.title}</span>
                    <span className={styles.bookMeta}>
                      <span className={styles.bookBest}>
                        {bScore === undefined ? 'Beste –' : `Beste ${bScore}/${b.questions.length}`}
                      </span>
                      {isMastered && (
                        <span className={styles.masterMark} role="img" aria-label="Mestret">
                          <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <button type="button" className={`${styles.bookRow} ${styles.newtRow}`} onClick={() => startBook(NEWT)}>
                <span className={styles.bookTitle}>N.E.W.T. — hele serien</span>
                <span className={styles.bookMeta}>
                  <span className={styles.bookBest}>
                    {best.newt === undefined ? 'Beste –' : `Beste ${best.newt}/${NEWT.questions.length}`}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* A question */}
      {book !== null && !done && current && (
        <div className={styles.content}>
          <button type="button" className={styles.backBtn} onClick={backToList}><ChevronLeft size={15} aria-hidden="true" />Kategorier</button>
          <p className={styles.progress}>{book.title} · {index + 1} av {total} · {score} riktige</p>
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

      {/* Result */}
      {book !== null && done && (
        <div className={styles.content}>
          <p className={styles.progress}>{book.title}</p>
          {isNewBest && <p className={styles.newBest}>Ny rekord! Du slo {prevBest}/{total}.</p>}
          <h2 className={styles.question}>{score} av {total} riktige</h2>
          <p className={styles.verdict}>{verdict(score, total)}</p>

          {wrong.length > 0 && (
            <div className={styles.review}>
              <p className={styles.reviewHead}>Gjennomgang — det du bomma på</p>
              <ul className={styles.reviewList} role="list">
                {wrong.map((w, i) => (
                  <li key={i} className={styles.reviewItem}>
                    <span className={styles.reviewQ}>{w.q}</span>
                    <span className={styles.reviewCorrect}>Riktig: {w.correct}</span>
                    <span className={styles.reviewChosen}>Ditt svar: {w.chosen}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={restart}>Ny runde</button>
            <button type="button" className={styles.btnSecondary} onClick={backToList}>Velg kategori</button>
          </div>
        </div>
      )}
    </div>
  )
}
