import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { CATEGORY_META, ALL_CATEGORY_KEYS, LOCATION_TYPES, LOCATION_TYPE_COLORS } from './filterMeta'
import type { FilterState } from './filterMeta'
import styles from './CategoryTree.module.css'

const TYPE_LABELS: Record<string, string> = {
  filming:     'Filming',
  canonical:   'Canonical',
  interpreted: 'Interpreted',
}

type Props = {
  value: FilterState
  onChange: (f: FilterState) => void
}

/** Checkbox tinted with the category/type colour, so the menu doubles as a
 *  colour legend (Lene, 2026-07-05). Default: burgundy. */
function CheckBox({ checked, color }: { checked: boolean; color?: string }) {
  return (
    <span
      className={`${styles.checkbox} ${checked ? styles.checkboxOn : ''}`}
      style={color ? ({ '--checkbox-color': color } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {checked && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
    </span>
  )
}

/**
 * Multi-select category tree with explicit checkboxes (Lene, 2026-07-05).
 * Checking adds that category's markers to the map; unchecking removes them.
 * "All places" is a master toggle. No checked categories = empty map.
 */
export function CategoryTree({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const selected = new Set(value.categories)
  const selectedTypes = new Set(value.locationTypes)
  const allSelected = ALL_CATEGORY_KEYS.every((k) => selected.has(k))

  function toggleExpand(e: React.MouseEvent, key: string) {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      onChange({ categories: [], locationTypes: [] })
    } else {
      onChange({ categories: [...ALL_CATEGORY_KEYS], locationTypes: [...LOCATION_TYPES] })
    }
  }

  function toggleCategory(key: string) {
    const next = new Set(selected)
    let nextTypes = [...selectedTypes]
    if (next.has(key)) {
      next.delete(key)
      if (key === 'locations') nextTypes = []
    } else {
      next.add(key)
      if (key === 'locations') nextTypes = [...LOCATION_TYPES]
    }
    onChange({ categories: [...next], locationTypes: nextTypes })
  }

  function toggleType(type: string) {
    const nextTypes = new Set(selectedTypes)
    if (nextTypes.has(type)) nextTypes.delete(type)
    else nextTypes.add(type)

    const next = new Set(selected)
    if (nextTypes.size === 0) {
      // No sub-types left: the whole Locations category is unchecked
      next.delete('locations')
    } else {
      next.add('locations')
    }
    onChange({ categories: [...next], locationTypes: [...nextTypes] })
  }

  return (
    <div className={styles.tree}>
      <button
        type="button"
        className={`${styles.row} ${allSelected ? styles.rowActive : ''}`}
        onClick={toggleAll}
        aria-pressed={allSelected}
      >
        <CheckBox checked={allSelected} />
        <span className={styles.rowLabel}>Alle</span>
      </button>

      {CATEGORY_META.map((cat) => {
        const isSelected = selected.has(cat.key)
        const isExpanded = expanded.has(cat.key)
        const hasSubTypes = cat.types.length > 1

        return (
          <div key={cat.key}>
            <div className={`${styles.rowGroup} ${isSelected ? styles.rowGroupActive : ''}`}>
              <button
                type="button"
                className={styles.rowMain}
                onClick={() => toggleCategory(cat.key)}
                aria-pressed={isSelected}
              >
                <CheckBox checked={isSelected} color={cat.color} />
                <span className={styles.rowLabel}>{cat.label}</span>
              </button>
              {hasSubTypes && (
                <button
                  type="button"
                  className={styles.chevronBtn}
                  onClick={(e) => toggleExpand(e, cat.key)}
                  aria-label={isExpanded ? `Hide sub-types for ${cat.label}` : `Show sub-types for ${cat.label}`}
                >
                  <ChevronDown
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    size={16} aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {hasSubTypes && isExpanded && (
              <div className={styles.subTree}>
                {cat.types.map((t) => {
                  const typeChecked = isSelected && selectedTypes.has(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.subRow} ${typeChecked ? styles.subRowActive : ''}`}
                      onClick={() => toggleType(t)}
                      aria-pressed={typeChecked}
                    >
                      <CheckBox checked={typeChecked} color={LOCATION_TYPE_COLORS[t]} />
                      {TYPE_LABELS[t] ?? t}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
