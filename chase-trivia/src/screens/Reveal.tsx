import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { ChaseBoard } from '../components/ChaseBoard'
import { Leaderboard } from '../components/Leaderboard'
import { Avatar } from '../components/ui'
import { TEAM_NAMES, catIcon, catLabel } from '../lib/meta'
import { sound } from '../lib/sound'
import type { Player } from '../lib/types'
import type { Session } from '../lib/useRoomSession'

const LETTERS = ['א', 'ב', 'ג', 'ד']

export default function Reveal({ s }: { s: Session }) {
  const room = s.room!
  const me = s.me!
  const q = room.state.q!
  const rv = room.state.reveal!
  const results = useMemo(() => Object.fromEntries(rv.results.map((r) => [r.player_id, r])), [rv])
  const mine = results[me.id]
  const kind = rv.kind
  const [stage, setStage] = useState(0)
  const played = useRef('')

  // choreography: 0 = answer shown, 1 = scores/players move, 2 = chaser moves
  useEffect(() => {
    setStage(0)
    const t1 = window.setTimeout(() => setStage(1), 800)
    const t2 = window.setTimeout(() => setStage(2), kind === 'chase' ? 2800 : 900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [room.step, kind])

  useEffect(() => {
    const id = `${room.id}:${room.step}`
    if (played.current === id) return
    played.current = id
    if (!mine) return
    if (mine.correct) {
      sound.correct()
      confetti({ particleCount: 36, spread: 60, startVelocity: 28, origin: { y: 0.4 }, scalar: 0.8, colors: ['#a855f7', '#22d3ee', '#fbbf24'] })
    } else {
      sound.wrong()
    }
  }, [room.id, room.step, mine])

  // chase sounds per stage
  useEffect(() => {
    if (kind !== 'chase') return
    if (stage === 1 && mine?.correct) sound.step()
    if (stage === 2) {
      if (rv.chaser?.correct) sound.chaserStep()
      if (rv.caught.includes(me.id)) window.setTimeout(() => sound.caught(), 450)
      else if (rv.qualified.includes(me.id)) window.setTimeout(() => sound.qualify(), 450)
    }
  }, [stage, kind, mine, rv, me.id])

  const deltas = useMemo(() => Object.fromEntries(rv.results.map((r) => [r.player_id, r.points])), [rv])

  // players as they were before this question → animate to the real values
  const shownPlayers: Player[] = useMemo(() => {
    return s.players.map((p) => {
      const r = results[p.id]
      if (!r) return p
      if (kind === 'ffa' || kind === 'team') {
        return stage >= 1 ? p : { ...p, score: p.score - r.points }
      }
      if (kind === 'chase') {
        const pos = stage < 1 && r.correct ? Math.max(1, p.position - 1) : p.position
        const changed = rv.caught.includes(p.id) || rv.qualified.includes(p.id)
        return { ...p, position: pos, chase_status: stage < 2 && changed ? 'alive' : p.chase_status }
      }
      return p
    })
  }, [s.players, results, kind, stage, rv])

  const chaserPos = room.state.chaser_pos ?? 0
  const shownChaser = kind === 'chase' ? (stage >= 2 ? chaserPos : chaserPos - (rv.chaser?.correct ? 1 : 0)) : 0
  const ts = room.state.team_scores

  const verdict = !mine ? 'neutral' : mine.correct ? 'good' : 'bad'
  const verdictText = !mine
    ? 'צופים בסיבוב'
    : mine.correct
      ? kind === 'chase'
        ? 'צעד קדימה! 🏃'
        : kind === 'build'
          ? 'מצוין! נוסף לצבר ✓'
          : `נכון! +${mine.points}`
      : mine.choice === null
        ? 'לא ענית בזמן ⏱️'
        : 'טעות 😬'

  const eventBanner = (() => {
    if (kind !== 'chase' || stage < 2) return null
    if (rv.caught.includes(me.id)) return { cls: 'caught', text: '💀 הרודף תפס אתכם!' }
    if (rv.qualified.includes(me.id)) return { cls: 'safe', text: '🏁 עברתם את קו הסיום! אתם בגמר' }
    if (rv.caught.length) {
      const names = s.players.filter((p) => rv.caught.includes(p.id)).map((p) => p.name)
      return { cls: 'caught', text: `💀 ${names.join(', ')} נתפס${names.length > 1 ? 'ו' : ''}!` }
    }
    return null
  })()

  const answersByIdx = (i: number) => rv.results.filter((r) => r.choice === i).map((r) => s.players.find((p) => p.id === r.player_id)).filter(Boolean) as Player[]

  return (
    <main className="page">
      <div className="q-head">
        <div className="q-meta">
          <span className="pill">
            {catIcon(q.cat)} {catLabel(q.cat)}
          </span>
        </div>
      </div>
      <div className="reveal-grid">
        <section className="stack">
          <motion.div
            className={`verdict ${verdict}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            role="status"
          >
            {verdictText}
          </motion.div>
          <div className="glass pad-sm" style={{ textAlign: 'center' }}>
            <div className="title-md" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {q.text}
            </div>
          </div>
          <div className="ans-grid" style={{ marginTop: 0 }}>
            {q.answers.map((a, i) => {
              const right = i === rv.correct_idx
              const mineWrong = mine?.choice === i && !right
              const who = answersByIdx(i)
              return (
                <div key={i} data-i={i} className={`ans${right ? ' right' : mineWrong ? ' wrong' : ' faded'}`} style={{ cursor: 'default', minHeight: 70 }}>
                  <span className="letter">{right ? '✓' : LETTERS[i]}</span>
                  <span>{a}</span>
                  {who.length > 0 && (
                    <span className="who">
                      {who.map((p) => (
                        <Avatar key={p.id} index={p.avatar} size={28} />
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {kind === 'chase' && rv.chaser && (
            <div className="chaser-line">
              <div className="em">🥷</div>
              <div>
                <div style={{ fontWeight: 800 }}>הרודף ענה: {q.answers[rv.chaser.choice]}</div>
                <div className="muted">{rv.chaser.correct ? 'נכון, הוא מתקדם צעד' : 'טעה, נשאר במקום'}</div>
              </div>
              <span className={`pill ${rv.chaser.correct ? 'red' : 'green'}`} style={{ marginInlineStart: 'auto' }}>
                {rv.chaser.correct ? 'מתקדם' : 'נעצר'}
              </span>
            </div>
          )}
        </section>

        <section className="stack">
          {eventBanner && (
            <motion.div className={`event-banner ${eventBanner.cls}`} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {eventBanner.text}
            </motion.div>
          )}
          {kind === 'chase' ? (
            <ChaseBoard
              players={shownPlayers}
              chaserPos={shownChaser}
              boardLen={room.state.board_len ?? 12}
              meId={me.id}
              flashChaser={stage === 2 && !!rv.chaser?.correct}
            />
          ) : kind === 'build' ? (
            <div className="glass pad stack">
              <div className="title-md">הצבר של כולם</div>
              <div className="picks">
                {s.players.map((p) => {
                  const r = results[p.id]
                  return (
                    <div key={p.id} className={`pick-row ${r?.correct ? 'ok' : 'no'}`}>
                      <Avatar index={p.avatar} size={30} />
                      <b>{p.name}</b>
                      <span className="muted" style={{ marginInlineStart: 'auto' }}>
                        צבר: <b className="num">{p.bank}</b> {r?.correct ? '✓' : '✗'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="muted">בסוף 6 שאלות כל שחקן מתחיל את המרדף מהצעד שנקבע לפי הצבר שלו.</div>
            </div>
          ) : (
            <div className="glass pad stack">
              {room.mode === 'team' && ts && (
                <div className="team-bar" style={{ marginBottom: 0 }}>
                  {[0, 1].map((t) => (
                    <div key={t} className={`team-score t${t}${Number(ts[String(t)]) >= Number(ts[String(1 - t)]) ? ' lead' : ''}`} style={{ gridColumn: t === 0 ? 1 : 3 }}>
                      <div style={{ fontWeight: 700 }}>
                        {t === 0 ? '🔥' : '⚡'} {TEAM_NAMES[t]}
                      </div>
                      <div className="v num">{Number(ts[String(t)] ?? 0).toLocaleString('en-US')}</div>
                      {rv.team_bonus.includes(t) && <span className="pill gold">בונוס קבוצה +300</span>}
                    </div>
                  ))}
                  <div className="vs" style={{ gridColumn: 2, gridRow: 1 }}>
                    VS
                  </div>
                </div>
              )}
              <div className="title-md">לוח תוצאות</div>
              <Leaderboard
                players={shownPlayers}
                meId={me.id}
                deltas={stage >= 1 ? deltas : undefined}
                sub={(p) => (room.mode === 'team' && p.team !== null ? TEAM_NAMES[p.team] : `${p.correct_count} נכונות`)}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
