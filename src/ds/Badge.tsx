import type { CSSProperties } from 'react'
import { CATEGORY_COLORS, LOCATION_TYPE_COLORS } from './filterMeta'
import styles from './Badge.module.css'

// One palette everywhere: colours come from filterMeta (single source)
const VARIANT_DOT_COLORS: Record<string, string> = {
  ...CATEGORY_COLORS,
  ...LOCATION_TYPE_COLORS,
  default: 'rgba(26,10,0,0.4)',
}

const LOCATION_TYPE_LABELS: Record<string, string> = {
  filming:     'Filming',
  canonical:   'Canonical',
  interpreted: 'Interpreted',
}

const CATEGORY_LABELS: Record<string, string> = {
  atmosphere:    'Atmosphere',
  attractions:   'Attractions',
  eat_and_drink: 'Eat & drink',
  inspiration:   'Inspiration',
  sleep:         'Sleep',
  locations:     'Locations',
  transport:     'Transport',
}

type BadgeSize = 'sm' | 'md' | 'lg'

type Props = {
  type?: string
  category?: string
  label?: string
  size?: BadgeSize
  dot?: boolean
  style?: CSSProperties
}

export function Badge({ type, category, label, size = 'md', dot = false, style: extraStyle = {} }: Props) {
  const key = type ?? category ?? 'default'
  const dotColor = VARIANT_DOT_COLORS[key] ?? VARIANT_DOT_COLORS.default

  const displayLabel =
    label ??
    (type && LOCATION_TYPE_LABELS[type]) ??
    (category && CATEGORY_LABELS[category]) ??
    key

  return (
    <span className={`${styles.badge} ${styles[size]}`} style={extraStyle}>
      {dot && (
        <span
          className={styles.dot}
          style={{ '--badge-dot-color': dotColor } as CSSProperties}
        />
      )}
      {displayLabel}
    </span>
  )
}
