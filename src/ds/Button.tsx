import { useState } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold'
type Size = 'sm' | 'md' | 'lg'

type Props = {
  variant?: Variant
  size?: Size
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  disabled?: boolean
  fullWidth?: boolean
  onClick?: () => void
  children?: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
}

const SIZES: Record<Size, React.CSSProperties> = {
  sm: { fontSize: 'var(--text-sm)',  padding: '8px 14px',  minHeight: '36px' },
  md: { fontSize: 'var(--text-base)', padding: '11px 20px', minHeight: '44px' },
  lg: { fontSize: 'var(--text-lg)',  padding: '13px 26px', minHeight: '52px' },
}

const BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--weight-medium)' as unknown as number,
  letterSpacing: 'var(--tracking-wide)',
  borderRadius: 'var(--radius-btn)',
  border: 'none',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  transition: 'background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
  boxSizing: 'border-box',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  onClick,
  children,
  type = 'button',
  'aria-label': ariaLabel,
}: Props) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {
      background: hovered && !disabled ? 'var(--color-burgundy-dark)' : 'var(--color-burgundy)',
      color: 'var(--color-cream)',
      boxShadow: 'var(--shadow-btn)',
    },
    secondary: {
      background: hovered && !disabled ? 'rgba(92,16,16,0.08)' : 'transparent',
      color: 'var(--color-burgundy)',
      border: '1.5px solid var(--color-burgundy)',
    },
    ghost: {
      background: hovered && !disabled ? 'rgba(26,10,0,0.06)' : 'transparent',
      color: 'var(--text-primary)',
    },
    gold: {
      background: hovered && !disabled ? 'var(--color-gold-muted)' : 'var(--color-gold)',
      color: 'var(--color-cream)',
      boxShadow: 'var(--shadow-btn)',
    },
  }

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        ...BASE,
        ...SIZES[size],
        ...variantStyles[variant],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 'var(--opacity-disabled)' : 1,
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
        width: fullWidth ? '100%' : undefined,
      }}
    >
      {icon && iconPosition === 'left' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
    </button>
  )
}
