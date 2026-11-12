import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AVATARS, AVATAR_HUES } from '../lib/meta'
import { sound } from '../lib/sound'

export function Avatar({ index, size = 44, dim, crown }: { index: number; size?: number; dim?: boolean; crown?: boolean }) {
  const i = ((index % 12) + 12) % 12
  return (
    <span
      className={`avatar${dim ? ' dim' : ''}`}
      style={{ '--s': `${size}px`, '--h': AVATAR_HUES[i] } as CSSProperties}
      aria-hidden="true"
    >
      {crown && <span className="crown">👑</span>}
      {AVATARS[i]}
    </span>
  )
}

export function AvatarPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="avatar-picker" role="group" aria-label="בחירת דמות">
      {AVATARS.map((_, i) => (
        <button
          key={i}
          type="button"
          className="avatar-pick"
          aria-pressed={value === i}
          aria-label={`דמות ${i + 1}`}
          onClick={() => {
            sound.click()
            onChange(i)
          }}
        >
          <Avatar index={i} size={42} />
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="screen-center" role="status" aria-live="polite">
      <div className="spinner" />
      {label && <div className="muted">{label}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div className="screen-center">
      <div style={{ fontSize: 54 }}>😵</div>
      <div className="alert" role="alert">
        {message}
      </div>
      <div className="row center">
        {onRetry && (
          <button className="btn primary" onClick={onRetry}>
            נסו שוב
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

export function MuteButton() {
  const [m, setM] = useState(sound.isMuted())
  useEffect(() => sound.subscribe(() => setM(sound.isMuted())), [])
  return (
    <button
      className="icon-btn"
      aria-label={m ? 'הפעלת צלילים' : 'השתקת צלילים'}
      aria-pressed={m}
      title={m ? 'הפעלת צלילים' : 'השתקה'}
      onClick={() => {
        sound.setMuted(!m)
        if (m) sound.click()
      }}
    >
      {m ? '🔇' : '🔊'}
    </button>
  )
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <div>{message}</div>
    </div>
  )
}

/** animated number that counts up/down to its value */
export function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const from = shown
    if (from === value) return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (value - from) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms])
  return <span className="num">{shown.toLocaleString('en-US')}</span>
}
