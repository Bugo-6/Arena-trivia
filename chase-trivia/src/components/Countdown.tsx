import { useEffect, useRef, useState } from 'react'
import { msUntil } from '../lib/clock'
import { sound } from '../lib/sound'

/** Server-synchronised countdown ring. Everyone sees the same remaining time. */
export function Countdown({ deadline, limit, beeps = true }: { deadline: string; limit: number; beeps?: boolean }) {
  const [left, setLeft] = useState(() => msUntil(deadline))
  const lastSec = useRef<number>(-1)

  useEffect(() => {
    let raf = 0
    lastSec.current = -1
    const tick = () => {
      const ms = msUntil(deadline)
      setLeft(Math.max(0, ms))
      const s = Math.ceil(ms / 1000)
      if (beeps && s !== lastSec.current && s > 0 && s <= 5) {
        lastSec.current = s
        sound.urgent()
      }
      if (ms > -200) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [deadline, beeps])

  const secs = Math.ceil(left / 1000)
  const frac = Math.max(0, Math.min(1, left / (limit * 1000)))
  const R = 33
  const C = 2 * Math.PI * R
  const urgent = secs <= 5 && secs > 0
  return (
    <div className={`ring${urgent ? ' urgent' : ''}`} role="timer" aria-label={`נותרו ${secs} שניות`}>
      <svg width="100%" height="100%" viewBox="0 0 76 76">
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a855f7" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={R}
          fill="none"
          stroke={urgent ? '#ff3d71' : 'url(#ringg)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
        />
      </svg>
      <div className="t num">{secs}</div>
    </div>
  )
}

/** big 3-2-1 overlay until `startAt` (server time) */
export function LeadIn({ startAt, label }: { startAt: string; label: string }) {
  const [n, setN] = useState(() => Math.ceil(msUntil(startAt) / 1000))
  const prev = useRef(n)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = Math.ceil(msUntil(startAt) / 1000)
      setN(v)
      if (v !== prev.current) {
        prev.current = v
        if (v > 0) sound.tick()
        else sound.go()
      }
      if (v > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [startAt])
  if (n <= 0) return null
  return (
    <div className="overlay-count" aria-live="assertive">
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {label}
        </div>
        <div key={n} className="big num" style={{ animation: 'pop .5s cubic-bezier(.2,1.4,.4,1)' }}>
          {n}
        </div>
      </div>
    </div>
  )
}
