import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { ErrorBox, Spinner } from '../components/ui'
import { SetupNotice } from './Setup'
import { backendKind, getBackend } from '../lib/backend'
import { modeName } from '../lib/meta'
import type { GameResult } from '../lib/types'

export default function History() {
  const [rows, setRows] = useState<GameResult[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setRows(null)
    try {
      const be = getBackend()
      await be.init()
      setRows(await be.getHistory())
    } catch {
      setError('לא הצלחנו לטעון את ההיסטוריה.')
    }
  }, [])

  useEffect(() => {
    if (backendKind !== 'none') void load()
  }, [load])

  const stats = (() => {
    if (!rows || !rows.length) return null
    const games = rows.length
    const wins = rows.filter((r) => r.won).length
    const correct = rows.reduce((a, r) => a + r.correct_count, 0)
    const answered = rows.reduce((a, r) => a + r.answered, 0)
    return {
      games,
      wins,
      winRate: Math.round((wins / games) * 100),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      best: Math.max(...rows.map((r) => r.score)),
    }
  })()

  const last = rows ? [...rows].slice(0, 10).reverse() : []
  const maxScore = Math.max(1, ...last.map((r) => r.score))

  return (
    <Shell>
      <main className="page narrow stack">
        <div>
          <div className="eyebrow">הקריירה שלכם</div>
          <h1 className="title-lg">היסטוריה וסטטיסטיקות</h1>
          <p className="muted">המשחקים שסיימתם במכשיר ובדפדפן הזה.</p>
        </div>

        {backendKind === 'none' ? (
          <SetupNotice />
        ) : error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !rows ? (
          <Spinner label="טוענים…" />
        ) : !stats ? (
          <div className="glass pad stack center">
            <div style={{ fontSize: 54 }}>🎮</div>
            <div className="title-md">עוד לא שיחקתם משחק מלא</div>
            <p className="muted" style={{ margin: 0 }}>
              אחרי המשחק הראשון הסטטיסטיקות יופיעו כאן.
            </p>
            <Link to="/create" className="btn primary">
              פתחו חדר
            </Link>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              {[
                ['משחקים', stats.games],
                ['ניצחונות', stats.wins],
                ['אחוז ניצחון', `${stats.winRate}%`],
                ['דיוק בתשובות', `${stats.accuracy}%`],
              ].map(([l, v]) => (
                <div key={l} className="stat">
                  <div className="v num">{v}</div>
                  <div className="l">{l}</div>
                </div>
              ))}
            </div>
            <div className="glass pad stack">
              <div className="row between">
                <div className="title-md">ניקוד ב-10 המשחקים האחרונים</div>
                <span className="pill gold num">שיא: {stats.best.toLocaleString('en-US')}</span>
              </div>
              <div className="bars" aria-hidden="true">
                {last.map((r) => (
                  <i key={r.id} style={{ height: `${Math.max(6, (r.score / maxScore) * 100)}%` }} title={`${r.score}`} />
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {rows.slice(0, 30).map((r) => (
                <div key={r.id} className={`hist-item${r.won ? ' won' : ''}`}>
                  <div className="rk num">{r.rank}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {modeName(r.mode)} · {r.player_name}
                    </div>
                    <div className="muted" style={{ fontSize: 14 }}>
                      {new Date(r.played_at).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })} · {r.players_count} שחקנים · חדר {r.room_code}
                    </div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div className="num" style={{ fontWeight: 800, fontSize: 20 }}>
                      {r.score.toLocaleString('en-US')}
                    </div>
                    {r.won && <span className="pill gold">ניצחון</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Shell>
  )
}
