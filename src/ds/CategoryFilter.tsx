import { useState } from 'react'
import { CATEGORY_META } from './filterMeta'
import type { FilterState } from './filterMeta'
export type { FilterState } from './filterMeta'

const TYPE_META: { key: string; label: string }[] = [
  { key: 'all',         label: 'Alle typer' },
  { key: 'filming',     label: 'Filming' },
  { key: 'canonical',   label: 'Kanonisk' },
  { key: 'interpreted', label: 'Tolket' },
]

type Props = {
  value: FilterState
  onChange: (f: FilterState) => void
}

export function CategoryFilter({ value, onChange }: Props) {
  const selectedMeta = CATEGORY_META.find((c) => c.key === value.category) ?? CATEGORY_META[0]
  const showTypeRow = value.category !== 'all' && selectedMeta.types.length > 1

  function handleCategoryClick(key: string) {
    const meta = CATEGORY_META.find((c) => c.key === key) ?? CATEGORY_META[0]
    onChange({
      category: key,
      locationType: meta.types.length === 1 ? meta.types[0] : 'all',
    })
  }

  function handleTypeClick(key: string) {
    onChange({ ...value, locationType: key })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <ChipRow>
        {CATEGORY_META.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            active={value.category === key}
            onClick={() => handleCategoryClick(key)}
          />
        ))}
      </ChipRow>

      {showTypeRow && (
        <ChipRow>
          {TYPE_META.filter((t) => t.key === 'all' || selectedMeta.types.includes(t.key)).map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              active={value.locationType === key}
              onClick={() => handleTypeClick(key)}
              secondary
            />
          ))}
        </ChipRow>
      )}
    </div>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--gap-chips)',
        overflowX: 'auto',
        padding: '2px 16px 4px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  )
}

function Chip({ label, active, onClick, secondary = false }: { label: string; active: boolean; onClick: () => void; secondary?: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: secondary ? '30px' : '36px',
        padding: '0 14px',
        borderRadius: 'var(--radius-chip)',
        border: '1.5px solid',
        borderColor: active
          ? secondary ? 'var(--color-gold)' : 'var(--color-burgundy)'
          : 'rgba(26,10,0,0.15)',
        background: active
          ? secondary ? 'var(--color-gold)' : 'var(--color-burgundy)'
          : hovered ? 'rgba(26,10,0,0.05)' : 'var(--surface-card)',
        color: active ? 'var(--color-cream)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: secondary ? '11px' : 'var(--text-sm)',
        fontWeight: active ? 600 : 400,
        letterSpacing: secondary ? '0.04em' : '0.02em',
        textTransform: secondary ? 'uppercase' : 'none',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
        flexShrink: 0,
        boxShadow: active ? 'var(--shadow-xs)' : 'none',
      }}
    >
      {label}
    </button>
  )
}
