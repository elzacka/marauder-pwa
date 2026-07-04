import styles from './AppHeader.module.css'

export default function AppHeader() {
  return (
    <header className={styles.header} aria-label="Marauder">
      <span className={styles.logo}>Marauder</span>
    </header>
  )
}
