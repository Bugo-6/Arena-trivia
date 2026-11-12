import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MuteButton } from './ui'
import { sound } from '../lib/sound'

export function Background({ danger }: { danger?: boolean }) {
  return (
    <div className={`bg${danger ? ' danger' : ''}`} aria-hidden="true">
      <div className="orb a" />
      <div className="orb b" />
      <div className="orb c" />
    </div>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="ארנת החידון – דף הבית">
      <span className="mark">⚡</span>
      <span>
        ארנת <span className="grad-text">החידון</span>
      </span>
    </Link>
  )
}

export function Shell({ children, danger, right }: { children: ReactNode; danger?: boolean; right?: ReactNode }) {
  const loc = useLocation()
  return (
    <>
      <Background danger={danger} />
      <header className="topbar">
        <Logo />
        <div className="right">
          {right}
          {loc.pathname !== '/history' && (
            <Link to="/history" className="icon-btn" aria-label="היסטוריה וסטטיסטיקות" title="היסטוריה וסטטיסטיקות" onClick={() => sound.click()}>
              📊
            </Link>
          )}
          <MuteButton />
        </div>
      </header>
      {children}
    </>
  )
}
