import type { CSSProperties } from 'react'

const NEUTRAL_BG = 'rgba(26,10,0,0.07)'
// 0.75 ink for WCAG AA on parchment cards; 0.6 measured 4.24:1 and failed for 10-12px text
const NEUTRAL_COLOR = 'rgba(26,10,0,0.75)'

const VARIANT_DOT_COLORS: Record<string, string> = {
  filming:       '#3E1F6B',
  canonical:     '#5C1010',
  interpreted:   '#9E6B1A',
  atmosphere:    '#2A5070',
  attractions:   '#5C1010',
  eat_and_drink: '#6B3E1A',
  inspiration:   '#4A3B6B',
  sleep:         '#2E6B3E',
  locations:     '#3E1F6B',
  transport:     '#1A4A1A',
  default:       'rgba(26,10,0,0.4)',
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

const SIZES: Record<BadgeSize, { fontSize: string; padding: string; gap: string }> = {
  sm: { fontSize: '10px', padding: '2px 7px',  gap: '4px' },
  md: { fontSize: '11px', padding: '3px 9px',  gap: '5px' },
  lg: { fontSize: '12px', padding: '4px 11px', gap: '5px' },
}

export function Badge({ type, category, label, size = 'md', dot = false, style: extraStyle = {} }: Props) {
  const key = type ?? category ?? 'default'
  const dotColor = VARIANT_DOT_COLORS[key] ?? VARIANT_DOT_COLORS.default
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
        background: NEUTRAL_BG,
        color: NEUTRAL_COLOR,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {displayLabel}
    </span>
  )
}
