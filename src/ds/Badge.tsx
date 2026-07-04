import type { CSSProperties } from 'react'

const VARIANT_STYLES: Record<string, { bg: string; color: string }> = {
  filming:         { bg: '#3E1F6B', color: '#F5ECD7' },
  canonical:       { bg: '#5C1010', color: '#F5ECD7' },
  interpreted:     { bg: '#9E6B1A', color: '#F5ECD7' },
  practical:       { bg: '#2E6B3E', color: '#F5ECD7' },
  hogwarts:        { bg: '#5C1010', color: '#F5ECD7' },
  diagon_alley:    { bg: '#3E1F6B', color: '#F5ECD7' },
  hogsmeade:       { bg: '#2A5070', color: '#F5ECD7' },
  ministry:        { bg: '#1A4A1A', color: '#F5ECD7' },
  other_wizarding: { bg: '#6B3E1A', color: '#F5ECD7' },
  food:            { bg: '#9E6B1A', color: '#F5ECD7' },
  accommodation:   { bg: '#2E6B3E', color: '#F5ECD7' },
  default:         { bg: '#2E1505', color: '#F5ECD7' },
}

const LOCATION_TYPE_LABELS: Record<string, string> = {
  filming:     'Filming',
  canonical:   'Canonical',
  interpreted: 'Interpreted',
  practical:   'Practical',
}

const CATEGORY_LABELS: Record<string, string> = {
  hogwarts:        'Hogwarts',
  diagon_alley:    'Diagon Alley',
  hogsmeade:       'Hogsmeade',
  ministry:        'Ministry',
  other_wizarding: 'Wizarding',
  food:            'Food',
  accommodation:   'Accommodation',
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

const SIZES: Record<BadgeSize, { fontSize: string; padding: string; gap: string }> = {
  sm: { fontSize: '10px', padding: '2px 7px',  gap: '4px' },
  md: { fontSize: '11px', padding: '3px 9px',  gap: '5px' },
  lg: { fontSize: '12px', padding: '4px 11px', gap: '5px' },
}

export function Badge({ type, category, label, size = 'md', dot = false, style: extraStyle = {} }: Props) {
  const key = type ?? category ?? 'default'
  const colors = VARIANT_STYLES[key] ?? VARIANT_STYLES.default
  const s = SIZES[size]

  const displayLabel =
    label ??
    (type && LOCATION_TYPE_LABELS[type]) ??
    (category && CATEGORY_LABELS[category]) ??
    key

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        fontSize: s.fontSize,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1,
        padding: s.padding,
        borderRadius: 'var(--radius-full)',
        background: colors.bg,
        color: colors.color,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: colors.color,
            opacity: 0.75,
            flexShrink: 0,
          }}
        />
      )}
      {displayLabel}
    </span>
  )
}
