import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.tsx'

type EBState = { hasError: boolean }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false }

  static getDerivedStateFromError(): EBState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'Georgia, serif', color: '#1A0A00' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Noe gikk galt</h1>
          <p>Marauder-kartet kunne ikke vises. Last inn siden på nytt for å prøve igjen.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem', padding: '0.6rem 1.2rem',
              background: '#5C1010', color: '#F5ECD7', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Last inn på nytt
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
