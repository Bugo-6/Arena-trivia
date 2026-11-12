import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Avatar, Toast } from '../components/ui'
import { msUntil } from '../lib/clock'
import { catIcon, catLabel, errText } from '../lib/meta'
import { sound } from '../lib/sound'
import type { FinalQuestion } from '../lib/types'
import type { Session } from '../lib/useRoomSession'

const LETTERS = ['א', 'ב', 'ג', 'ד']

export function FinalIntro({ s }: { s: Session }) {
  const qualified = s.players.filter((p) => p.chase_status === 'qualified')
  const me = s.me!
  useEffect(() => {
    sound.qualify()
    const t = window.setTimeout(() => sound.startLoop(), 2500)
    return () => {
      window.clearTimeout(t)
      sound.stopLoop()
    }
  }, [])
  return (
    <main className="page narrow stack center" style={{ minHeight: '70vh', justifyContent: 'center' }}>
      <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--pink)' }}>
        סיבוב הגמר
      </motion.div>
      <motion.h1
        className="title-xl"
        initial={{ opacity: 0, scale: 1.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <span className="hot-text">60 שניות</span>
      </motion.h1>
      <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ fontSize: 19, margin: 0 }}>
        כל השורדים עונים במקביל על כמה שיותר שאלות. כל תשובה נכונה נספרת לצוות, ותשובה שגויה נועלת אתכם ל-2 שניות. בסוף הרודף מנסה לעבור את הסכום שלכם.
      </motion.p>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        {qualified.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.15 }} className="stack center" style={{ gap: 6 }}>
            <Avatar index={p.avatar} size={64} />
            <b>{p.name}</b>
          </motion.div>
        ))}
      </div>
      {me.chase_status === 'qualified' ? (
        <div className="pill green">אתם בגמר. היו מוכנים 🔥</div>
      ) : (
        <div className="pill red">נתפסתם. אתם מעודדים מהיציע 📣</div>
      )}
    </main>
  )
}

export function Final({ s }: { s: Session }) {
  const room = s.room!
  const me = s.me!
  const deadline = room.state.final_deadline!
  const total = (room.state.final_seconds ?? 60) * 1000
  const [left, setLeft] = useState(() => Math.max(0, msUntil(deadline)))
  const [frozen, setFrozen] = useState<{ q: FinalQuestion; choice: number; correctIdx: number; lockedUntil: string | null } | null>(null)
  const [lockLeft, setLockLeft] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const busy = useRef(false)
  const qualified = s.players.filter((p) => p.chase_status === 'qualified')
  const imIn = me.chase_status === 'qualified'
  const teamTotal = qualified.reduce((a, p) => a + p.final_correct, 0)

  useEffect(() => {
    sound.startLoop()
    return () => sound.stopLoop()
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setLeft(Math.max(0, msUntil(deadline)))
      if (frozen?.lockedUntil) setLockLeft(Math.max(0, msUntil(frozen.lockedUntil)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [deadline, frozen])

  const shown = frozen?.q ?? me.final_q

  const choose = useCallback(
    async (i: number) => {
      if (busy.current || !imIn || !me.final_q || frozen || msUntil(deadline) < -300) return
      busy.current = true
      const q = me.final_q
      try {
        const res = await s.actions.finalAnswer(q.n, i)
        if (res.correct) sound.correct()
        else sound.wrong()
        setFrozen({ q, choice: i, correctIdx: res.correct_idx, lockedUntil: res.locked_until })
        const hold = res.correct ? 450 : Math.max(900, msUntil(res.locked_until) + 100)
        window.setTimeout(() => {
          setFrozen(null)
          busy.current = false
        }, hold)
      } catch (e) {
        busy.current = false
        setToast(errText(e))
      }
    },
    [imIn, me.final_q, frozen, deadline, s.actions],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = ['1', '2', '3', '4'].indexOf(e.key)
      if (n >= 0) void choose(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose])

  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 10 && secs > 0
  const locked = !!frozen && frozen.lockedUntil !== null && lockLeft > 0

  return (
    <main className="page stack">
      <div className={`final-clock num${urgent ? ' urgent' : ''}`} role="timer" aria-label={`נותרו ${secs} שניות`}>
        {secs}
      </div>
      <div className="meter" aria-hidden="true">
        <i style={{ width: `${(left / total) * 100}%`, background: urgent ? 'var(--grad-hot)' : undefined }} />
      </div>

      <div className="final-stats">
        <div className="stat">
          <div className="v num">{teamTotal}</div>
          <div className="l">נכונות לצוות</div>
        </div>
        <div className="stat">
          <div className="v num">{me.final_correct}</div>
          <div className="l">שלכם</div>
        </div>
        <div className="stat">
          <div className="v num">{qualified.length}</div>
          <div className="l">שחקנים בגמר</div>
        </div>
      </div>

      {imIn && shown ? (
        <>
          <motion.section key={shown.n} className="glass q-card" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} style={{ position: 'relative' }}>
            <div className="q-meta" style={{ justifyContent: 'center', marginBottom: 10 }}>
              <span className="pill">
                {catIcon(shown.cat)} {catLabel(shown.cat)}
              </span>
            </div>
            <h2 className="q-text" style={{ fontSize: 'clamp(22px, 3.6vw, 36px)' }}>
              {shown.text}
            </h2>
            {locked && <div className="lockout num">❌ {Math.ceil(lockLeft / 1000)}</div>}
          </motion.section>
          <div className="ans-grid">
            {shown.answers.map((a, i) => {
              const f = frozen
              const cls = f ? (i === f.correctIdx ? ' right' : i === f.choice ? ' wrong' : ' faded') : ''
              return (
                <button key={`${shown.n}:${i}`} data-i={i} className={`ans${cls}`} disabled={!!f} onClick={() => choose(i)}>
                  <span className="letter">{LETTERS[i]}</span>
                  <span>{a}</span>
                  <span className="kbd" style={{ marginInlineStart: 'auto' }} aria-hidden="true">
                    {i + 1}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="glass pad stack center">
          <div className="title-md">{imIn ? 'טוענים שאלה…' : 'אתם צופים בגמר 📣'}</div>
          <p className="muted" style={{ margin: 0 }}>
            השורדים עונים כמה שיותר מהר. כל תשובה נכונה נוספת לסכום של הצוות.
          </p>
        </div>
      )}

      <div className="glass pad-sm row" style={{ justifyContent: 'center', gap: 18 }}>
        {qualified.map((p) => (
          <span key={p.id} className="row" style={{ gap: 8 }}>
            <Avatar index={p.avatar} size={30} />
            <b>{p.name}</b>
            <span className="pill green num">{p.final_correct}</span>
            {p.final_wrong > 0 && <span className="pill red num">{p.final_wrong}</span>}
          </span>
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
