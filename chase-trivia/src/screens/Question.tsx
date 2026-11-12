import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Countdown, LeadIn } from '../components/Countdown'
import { Avatar, Toast } from '../components/ui'
import { msUntil } from '../lib/clock'
import { TEAM_NAMES, catIcon, catLabel, diffLabel, errText } from '../lib/meta'
import { sound } from '../lib/sound'
import HostCompanion from '../components/HostCompanion'
import type { Session } from '../lib/useRoomSession'

const LETTERS = ['א', 'ב', 'ג', 'ד']

export function phaseLabel(s: Session): string {
  const room = s.room!
  const q = room.state.q!
  if (q.kind === 'build') return `בניית הצבר · ${q.idx + 1}/${room.state.total ?? 6}`
  if (q.kind === 'chase') return 'המרדף'
  return `שאלה ${q.idx + 1}/${room.state.total ?? room.settings.rounds}`
}

export default function Question({ s }: { s: Session }) {
  const room = s.room!
  const me = s.me!
  const q = room.state.q!
  const answered = room.state.answered ?? []
  const iAnswered = answered.includes(me.id)
  const [picked, setPicked] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [started, setStarted] = useState(() => msUntil(q.started_at) <= 0)
  const [questionVisible, setQuestionVisible] = useState(() => msUntil(q.started_at) <= 0)
  const key = `${room.id}:${q.idx}:${q.kind}`
  const locked = useRef(false)

  const spectator = q.kind === 'chase' && me.chase_status !== 'alive'

  // new question → reset
  useEffect(() => {
    setPicked(null)
    locked.current = false
    const ms = msUntil(q.started_at)
    setStarted(ms <= 0)
    setQuestionVisible(ms <= 0)
    if (ms > 0) {
      const t = window.setTimeout(() => setStarted(true), ms)
      return () => window.clearTimeout(t)
    }
    sound.whoosh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!started) return
    setQuestionVisible(false)
    const revealTimer = window.setTimeout(() => setQuestionVisible(true), 900)
    sound.whoosh()
    return () => window.clearTimeout(revealTimer)
  }, [started, key])

  const choose = useCallback(
    async (i: number) => {
      if (locked.current || iAnswered || spectator || !started) return
      if (msUntil(q.deadline) < -300) return
      locked.current = true
      setPicked(i)
      sound.lock()
      try {
        await s.actions.answer(q.idx, i)
      } catch (e) {
        const msg = errText(e)
        if (!(e instanceof Error && e.message.includes('already_answered'))) setToast(msg)
      }
    },
    [iAnswered, spectator, started, q.deadline, q.idx, s.actions],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = ['1', '2', '3', '4'].indexOf(e.key)
      if (n >= 0) void choose(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose])

  const eligible = s.players.filter((p) => q.kind !== 'chase' || p.chase_status === 'alive')
  const answeredPlayers = eligible.filter((p) => answered.includes(p.id))
  const lockedIn = picked !== null || iAnswered
  const ts = room.state.team_scores

  return (
    <main className="page">
      {!started && <LeadIn startAt={q.started_at} label={q.kind === 'chase' ? 'המרדף מתחיל' : q.kind === 'build' ? 'בונים את הצבר' : 'השאלה הבאה'} />}
      {room.mode === 'team' && ts && (
        <div className="team-bar" aria-label="ניקוד קבוצות">
          {[0, 1].map((t) => (
            <div key={t} className={`team-score t${t}`} style={{ gridColumn: t === 0 ? 1 : 3 }}>
              <div style={{ fontWeight: 700 }}>
                {t === 0 ? '🔥' : '⚡'} {TEAM_NAMES[t]}
              </div>
              <div className="v num">{Number(ts[String(t)] ?? 0).toLocaleString('en-US')}</div>
            </div>
          ))}
          <div className="vs" style={{ gridColumn: 2, gridRow: 1 }}>
            VS
          </div>
        </div>
      )}
      <div className="q-head">
        <div className="q-meta">
          <span className="pill violet">{phaseLabel(s)}</span>
          <span className="pill">
            {catIcon(q.cat)} {catLabel(q.cat)}
          </span>
          <span className="pill gold">{diffLabel(q.diff)}</span>
        </div>
        <Countdown deadline={q.deadline} limit={q.limit} beeps={!spectator && started} />
      </div>

      <HostCompanion kind={q.kind} answered={lockedIn} spectator={spectator} questionText={q.text} questionKey={key} questionVisible={questionVisible} />

      <motion.section
        key={key}
        className="glass q-card"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        aria-live="polite"
      >
        {q.kind === 'build' && <div className="eyebrow" style={{ marginBottom: 10 }}>כל תשובה נכונה = צעד קדימה על הלוח</div>}
        {q.kind === 'chase' && <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--pink)' }}>🥷 הרודף עונה יחד איתכם</div>}
        <motion.h2
          className="q-text"
          initial={false}
          animate={questionVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: .97 }}
          transition={{ duration: .5, type: 'spring', stiffness: 190, damping: 20 }}
        >{questionVisible ? q.text : started ? 'גיא מציג את השאלה…' : '...'}</motion.h2>
      </motion.section>

      {spectator && (
        <div className="alert info" style={{ marginTop: 14, textAlign: 'center' }} role="status">
          {me.chase_status === 'caught' ? '💀 נתפסתם. אפשר לצפות ולעודד את מי שנשאר.' : '🏁 כבר עברתם את קו הסיום! ממתינים לשאר השחקנים.'}
        </div>
      )}

      <div className="ans-grid" role="group" aria-label="תשובות אפשריות">
        {q.answers.map((a, i) => (
          <motion.button
            key={`${key}:${i}`}
            data-i={i}
            className={`ans${picked === i ? ' picked' : ''}${lockedIn && picked !== i ? ' faded' : ''}`}
            disabled={!started || lockedIn || spectator}
            onClick={() => choose(i)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i + 0.1 }}
          >
            <span className="letter">{LETTERS[i]}</span>
            <span>{started ? a : '•••'}</span>
            <span className="kbd" style={{ marginInlineStart: 'auto' }} aria-hidden="true">
              {i + 1}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="answered-strip" aria-live="polite">
        {lockedIn && !spectator && <span className="pill green">✓ התשובה נקלטה. ממתינים לשאר…</span>}
        <span className="muted num">
          {answeredPlayers.length}/{eligible.length} ענו
        </span>
        {answeredPlayers.map((p) => (
          <motion.span key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <Avatar index={p.avatar} size={32} />
          </motion.span>
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
