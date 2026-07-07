import styles from './AppHeader.module.css'
import HouseSigil from './HouseSigil'
import type { House } from '../App'

export default function AppHeader({ house }: { house: House }) {
  return (
    <header className={styles.header} aria-label="Marauder">
      <span className={styles.row}>
        {house !== 'none' && (
          <span className={styles.sigil} aria-hidden="true">
            <HouseSigil house={house} size={26} decorative />
          </span>
        )}
        <span className={styles.logo}>Marauder</span>
      </span>
    </header>
  )
}
