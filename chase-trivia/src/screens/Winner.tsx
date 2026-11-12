import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Avatar, CountUp } from '../components/ui'
import { TEAM_NAMES, modeName } from '../lib/meta'
import { sound } from '../lib/sound'
import type { RankRow } from '../lib/types'
import type { Session } from '../lib/useRoomSession'
import StageScene from '../components/StageScene'

function bigConfetti() {
  const end = Date.now() + 3200
  const colors = ['#a855f7', '#3b82f6', '#22d3ee', '#fbbf24', '#ff3d71']
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors })
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  confetti({ particleCount: 160, spread: 110, origin: { y: 0.45 }, colors, scalar: 1.1 })
}

export default function Winner({ s }: { s: Session }) {
  const nav = useNavigate()
  const room = s.room!
  const me = s.me!
  const res = room.state.results
  const ranking: RankRow[] = res?.ranking ?? []
  const mine = ranking.find((r) => r.player_id === me.id)
  const chase = res?.chase ?? null
  const winnerTeam = res?.winner_team ?? null
  const celebrated = useRef(false)

  const iWon = (() => {
    if (!mine) return false
    if (room.mode === 'team') return winnerTeam !== null && mine.team === winnerTeam
    if (room.mode === 'chase') return !!chase?.team_won && mine.chase_status === 'qualified'
    return mine.rank === 1
  })()

  useEffect(() => {
    if (celebrated.current) return
    celebrated.current = true
    sound.stopLoop()
    if (iWon) {
      sound.fanfare()
      bigConfetti()
    } else {
      sound.lose()
    }
  }, [iWon])

  const podium = ranking.slice(0, 3)
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium
  const heights: Record<number, number> = { 1: 150, 2: 112, 3: 84 }
  const champion = ranking[0]

  const headline = (() => {
    if (room.mode === 'team') {
      if (winnerTeam === null) return { t: 'תיקו!', sub: 'שתי הקבוצות סיימו עם אותו ניקוד' }
      return { t: `${TEAM_NAMES[winnerTeam]} ניצחו!`, sub: `${res?.team_scores?.[String(winnerTeam)] ?? 0} נקודות לקבוצה` }
    }
    if (room.mode === 'chase') {
      if (!chase || chase.qualified === 0) return { t: 'הרודף ניצח', sub: 'אף אחד לא הגיע לקו הסיום. בפעם הבאה!' }
      return chase.team_won
        ? { t: 'ניצחתם את הרודף! 🎉', sub: `הצוות צבר ${chase.team_total} נכונות מול ${chase.chaser_final} של הרודף` }
        : { t: 'הרודף ניצח בגמר', sub: `הצוות צבר ${chase.team_total} נכונות, הרודף הגיע ל-${chase.chaser_final}` }
    }
    return { t: `${champion?.name ?? ''} מנצח/ת!`, sub: `${champion?.score.toLocaleString('en-US') ?? 0} נקודות` }
  })()

  const share = () => {
    const text = `סיימתי במקום ${mine?.rank} בארנת החידון (${modeName(room.mode)}) עם ${mine?.score} נקודות! בואו לשחק: ${window.location.origin}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const leave = async () => {
    await s.actions.leave()
    nav('/')
  }

  return (
    <main className="page narrow stack">
      <StageScene mode="winner" title="THE CHAMPION" subtitle={headline.t} />

      <div className="winner-hero">
        <motion.div className="crown-big" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
          {iWon ? '🏆' : '🎖️'}
        </motion.div>
        <motion.h1 className="title-lg grad-text" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          {headline.t}
        </motion.h1>
        <div className="muted">{headline.sub}</div>
        {mine && (
          <span className={`pill ${iWon ? 'gold' : ''}`}>
            {iWon ? '🏅 ניצחתם' : `מקום ${mine.rank}`} · {modeName(room.mode)}
          </span>
        )}
      </div>

      {room.mode !== 'team' && room.mode !== 'chase' && podium.length > 0 && (
        <div className="podium" aria-label="הפודיום">
          {order.map((r) => (
            <motion.div key={r.player_id} className={`pod p${r.rank}`} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + (4 - r.rank) * 0.2 }}>
              <Avatar index={r.avatar} size={r.rank === 1 ? 72 : 56} crown={r.rank === 1} />
              <div className="pn">{r.name}</div>
              <div className="block" style={{ height: heights[r.rank] ?? 70 }}>
                {r.rank}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="glass pad stack">
        <div className="title-md">דירוג סופי</div>
        <div className="lb">
          {ranking.map((r, i) => (
            <motion.div
              key={r.player_id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className={`lb-row${r.player_id === me.id ? ' me' : ''}${r.rank === 1 ? ' first' : ''}`}
            >
              <div className="rk num">{r.rank}</div>
              <Avatar index={r.avatar} size={38} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">
                  {r.name}
                  {r.player_id === me.id ? ' (אתם)' : ''}
                </div>
                <div className="sub">
                  {room.mode === 'team' && r.team !== null
                    ? `${TEAM_NAMES[r.team]} · ${r.correct_count} נכונות`
                    : room.mode === 'chase'
                      ? r.chase_status === 'qualified'
                        ? `שרד לגמר · ${r.final_correct} נכונות בגמר`
                        : 'נתפס'
                      : `${r.correct_count} נכונות`}
                </div>
              </div>
              <div className="sc">
                <CountUp value={r.score} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="stack">
        {s.isHost ? (
          <button className="btn primary big block" disabled={s.busy} onClick={() => s.actions.reset()}>
            🔁 משחק חוזר באותו חדר
          </button>
        ) : (
          <div className="glass pad-sm center muted">ממתינים שהמארח יתחיל משחק חדש…</div>
        )}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn ghost" onClick={share}>
            💬 שתפו תוצאה
          </button>
          <Link className="btn ghost" to="/history">
            📊 היסטוריה
          </Link>
          <button className="btn ghost" onClick={leave}>
            יציאה
          </button>
        </div>
      </div>
    </main>
  )
}
