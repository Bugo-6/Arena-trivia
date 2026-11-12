import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { ChaseBoard } from '../components/ChaseBoard'
import type { Player } from '../lib/types'

const DEMO_PLAYERS: Player[] = [
  { id: 'inspect-noam', room_id: 'inspect', user_id: 'inspect-noam', name: 'נועם', avatar: 0, team: null, score: 1200, correct_count: 4, bank: 4, position: 2, chase_status: 'alive', final_correct: 0, final_wrong: 0, final_n: 0, final_q: null, final_locked_until: null, last_seen: '2026-11-12T12:00:00.000Z', joined_at: '2026-11-12T12:00:00.000Z' },
  { id: 'inspect-player-2', room_id: 'inspect', user_id: 'inspect-player-2', name: 'מאיה', avatar: 3, team: null, score: 900, correct_count: 3, bank: 3, position: 5, chase_status: 'alive', final_correct: 0, final_wrong: 0, final_n: 0, final_q: null, final_locked_until: null, last_seen: '2026-11-12T12:00:00.000Z', joined_at: '2026-11-12T12:00:00.000Z' },
  { id: 'inspect-player-3', room_id: 'inspect', user_id: 'inspect-player-3', name: 'דולב', avatar: 7, team: null, score: 700, correct_count: 2, bank: 2, position: 8, chase_status: 'alive', final_correct: 0, final_wrong: 0, final_n: 0, final_q: null, final_locked_until: null, last_seen: '2026-11-12T12:00:00.000Z', joined_at: '2026-11-12T12:00:00.000Z' },
]

export default function InspectMode() {
  const [chaserPos, setChaserPos] = useState(4)
  const [positions, setPositions] = useState(DEMO_PLAYERS.map((p) => p.position))
  const players = DEMO_PLAYERS.map((p, i) => ({ ...p, position: positions[i] }))

  const movePlayer = (index: number, delta: number) => {
    setPositions((current) => current.map((pos, i) => i === index ? Math.max(0, Math.min(12, pos + delta)) : pos))
  }

  const reset = () => {
    setChaserPos(4)
    setPositions(DEMO_PLAYERS.map((p) => p.position))
  }

  return (
    <Shell right={<Link to="/" className="btn ghost">חזרה</Link>}>
      <main className="page stack">
        <div className="row between">
          <div>
            <div className="eyebrow">INSPECT MODE · תצוגת בדיקה</div>
            <h1 className="title-lg">בודקים את מפת המרדף</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>תצוגה עצמאית עם שחקנים מדומים — בלי לפתוח חדר ובלי לחכות לאף אחד.</p>
          </div>
          <button className="btn ghost" onClick={reset}>↺ איפוס תצוגה</button>
        </div>

        <ChaseBoard players={players} chaserPos={chaserPos} boardLen={12} meId="inspect-noam" />

        <section className="glass pad stack">
          <div className="row between">
            <div className="title-md">שליטה בתצוגה</div>
            <span className="pill violet">לא נשמר במשחק</span>
          </div>
          <div className="row between">
            <b>🥷 מיקום הרודף</b>
            <div className="row">
              <button className="chip" onClick={() => setChaserPos((v) => Math.max(0, v - 1))} disabled={chaserPos === 0}>−</button>
              <span className="pill red num">צעד {chaserPos}</span>
              <button className="chip" onClick={() => setChaserPos((v) => Math.min(12, v + 1))} disabled={chaserPos === 12}>+</button>
            </div>
          </div>
          {players.map((p, i) => (
            <div className="row between" key={p.id}>
              <b>{p.name}</b>
              <div className="row">
                <button className="chip" onClick={() => movePlayer(i, -1)} disabled={positions[i] === 0}>−</button>
                <span className="pill num">צעד {positions[i]}</span>
                <button className="chip" onClick={() => movePlayer(i, 1)} disabled={positions[i] === 12}>+</button>
              </div>
            </div>
          ))}
        </section>

        <div className="alert info" role="note">
          כאן אנחנו רואים את רכיב המפה האמיתי של המשחק. אפשר להזיז את השחקנים ואת הרודף כדי לבדוק מרווחים, חפיפות ומיקום לפני שנוגעים במשחק עצמו.
        </div>
      </main>
    </Shell>
  )
}
