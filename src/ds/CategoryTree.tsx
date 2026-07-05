import { useState } from 'react'
import { CATEGORY_META } from './filterMeta'
import type { FilterState } from './filterMeta'
import styles from './CategoryTree.module.css'

const TYPE_LABELS: Record<string, string> = {
  filming:     'Filming',
  canonical:   'Canonical',
  interpreted: 'Interpreted',
}

type Props = {
  value: FilterState | null
  onChange: (f: FilterState) => void
}

export function CategoryTree({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(e: React.MouseEvent, key: string) {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectCategory(key: string) {
    onChange({ category: key, locationType: 'all' })
  }

  function selectType(category: string, type: string) {
    onChange({ category, locationType: type })
  }

  const isAllActive = value?.category === 'all'
  const categories = CATEGORY_META.filter((c) => c.key !== 'all')

  return (
    <div className={styles.tree}>
      <button
        type="button"
        className={`${styles.row} ${isAllActive ? styles.rowActive : ''}`}
        onClick={() => selectCategory('all')}
      >
        <span className={styles.rowLabel}>All places</span>
      </button>

      {categories.map((cat) => {
        const isSelected = value?.category === cat.key
        const isExpanded = expanded.has(cat.key)
        const hasSubTypes = cat.types.length > 1

        return (
          <div key={cat.key}>
            <div className={`${styles.rowGroup} ${isSelected ? styles.rowGroupActive : ''}`}>
              <button
                type="button"
                className={styles.rowMain}
                onClick={() => selectCategory(cat.key)}
              >
                <span className={styles.rowLabel}>{cat.label}</span>
              </button>
              {hasSubTypes && (
                <button
                  type="button"
                  className={styles.chevronBtn}
                  onClick={(e) => toggleExpand(e, cat.key)}
                  aria-label={isExpanded ? `Hide sub-types for ${cat.label}` : `Show sub-types for ${cat.label}`}
                >
                  <svg
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                  >
                    <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>

            {hasSubTypes && isExpanded && (
              <div className={styles.subTree}>
                <button
                  type="button"
                  className={`${styles.subRow} ${isSelected && value?.locationType === 'all' ? styles.subRowActive : ''}`}
                  onClick={() => selectType(cat.key, 'all')}
                >
                  All types
                </button>
                {cat.types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.subRow} ${isSelected && value?.locationType === t ? styles.subRowActive : ''}`}
                    onClick={() => selectType(cat.key, t)}
                  >
                    {TYPE_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
