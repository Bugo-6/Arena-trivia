import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar, Toast } from '../components/ui'
import { CATEGORIES, DIFFICULTIES, MODES, TEAM_NAMES, errText } from '../lib/meta'
import { sound } from '../lib/sound'
import type { Session } from '../lib/useRoomSession'
import { isOnline } from '../lib/useRoomSession'
import type { Mode, Settings } from '../lib/types'

const ROUNDS = [5, 10, 15, 20]
const TIMES = [10, 15, 20, 30]

export default function Lobby({ s }: { s: Session }) {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const solo = searchParams.get('solo') === '1'
  const room = s.room!
  const me = s.me!
  const [draft, setDraft] = useState<{ mode: Mode; settings: Settings } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState('')
  const prevCount = useRef(s.players.length)

  // clear the optimistic draft once the server copy arrives
  useEffect(() => setDraft(null), [room.updated_at, room.mode])

  useEffect(() => {
    if (s.players.length > prevCount.current) sound.join()
    prevCount.current = s.players.length
  }, [s.players.length])

  const mode = draft?.mode ?? room.mode
  const settings = draft?.settings ?? room.settings
  const host = s.isHost
  const link = `${window.location.origin}/join/${room.code}`

  const push = async (m: Mode, st: Settings) => {
    setDraft({ mode: m, settings: st })
    sound.click()
    try {
      await s.actions.updateSettings(m, st)
    } catch (e) {
      setDraft(null)
      setToast(errText(e))
    }
  }

  const toggleCat = (id: string) => {
    const has = settings.categories.includes(id)
    void push(mode, { ...settings, categories: has ? settings.categories.filter((c) => c !== id) : [...settings.categories, id] })
  }

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast(msg)
    } catch {
      setToast('לא הצלחנו להעתיק. אפשר להעתיק ידנית.')
    }
  }

  const share = () => {
    const text = `בואו לשחק איתי טריוויה! קוד החדר: ${room.code}\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const start = async () => {
    setError('')
    sound.unlock()
    const err = await s.actions.start()
    if (err) setError(err)
  }

  const leave = async () => {
    await s.actions.leave()
    nav('/')
  }

  const slots = Array.from({ length: 8 }, (_, i) => s.players[i] ?? null)
  const canStart = s.players.length >= (solo ? 1 : 2) && (!solo || mode === 'ffa')
  const teamPlayers = (t: number) => s.players.filter((p) => p.team === t)
  const unassigned = s.players.filter((p) => p.team === null)

  return (
    <main className="page">
      <div className="lobby-grid">
        <section className="stack">
          <div className="glass code-card">
            <div className="eyebrow">קוד החדר</div>
            <button
              className="room-code"
              onClick={() => copy(room.code, 'הקוד הועתק ✓')}
              aria-label={`קוד החדר ${room.code.split('').join(' ')}. לחצו להעתקה`}
            >
              {room.code}
            </button>
            <div className="share-row">
              <button className="btn ghost" onClick={() => copy(link, 'הקישור הועתק ✓')}>
                🔗 העתקת קישור
              </button>
              <button className="btn ghost" onClick={share}>
                💬 שיתוף בוואטסאפ
              </button>
            </div>
          </div>

          <div className="glass pad">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="title-md">שחקנים</div>
              <span className="pill violet num">{s.players.length} / 8</span>
            </div>
            <div className="player-grid">
              <AnimatePresence initial={false}>
                {slots.map((p, i) =>
                  p ? (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`player-card${p.id === me.id ? ' me' : ''}`}
                    >
                      <Avatar index={p.avatar} size={42} crown={p.id === room.host_player_id} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="nm">
                          {p.name}
                          {p.id === me.id ? ' (אתם)' : ''}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {p.id === room.host_player_id ? 'מארח' : isOnline(p) ? 'מחובר' : 'מנותק'}
                        </div>
                      </div>
                      <span className={`dot${isOnline(p) ? '' : ' off'}`} aria-hidden="true" />
                    </motion.div>
                  ) : (
                    <div key={`e${i}`} className="player-card empty">
                      ממתינים לשחקן…
                    </div>
                  ),
                )}
              </AnimatePresence>
            </div>
          </div>

          {mode === 'team' && (
            <div className="glass pad">
              <div className="title-md" style={{ marginBottom: 12 }}>
                בחרו קבוצה
              </div>
              <div className="team-pick">
                {[0, 1].map((t) => (
                  <div key={t} className={`team-col t${t}`}>
                    <h4>
                      {t === 0 ? '🔥' : '⚡'} {TEAM_NAMES[t]}
                    </h4>
                    <div className="stack" style={{ gap: 6 }}>
                      {teamPlayers(t).map((p) => (
                        <div key={p.id} className="row" style={{ gap: 8 }}>
                          <Avatar index={p.avatar} size={28} />
                          <span style={{ fontWeight: 700 }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="chip"
                      style={{ marginTop: 10 }}
                      aria-pressed={me.team === t}
                      onClick={() => {
                        sound.click()
                        void s.actions.setTeam(t).catch((e) => setToast(errText(e)))
                      }}
                    >
                      {me.team === t ? '✓ אתם כאן' : 'הצטרפו'}
                    </button>
                  </div>
                ))}
              </div>
              {unassigned.length > 0 && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  שחקנים בלי קבוצה ({unassigned.map((p) => p.name).join(', ')}) יחולקו אוטומטית כשהמשחק מתחיל.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="stack">
          <div className="glass pad stack">
            <div className="row between">
              <div className="title-md">מצב משחק</div>
              {!host && <span className="pill">המארח בוחר</span>}
            </div>
            {solo ? (
              <div className="alert info" role="status">🧠 מצב אימון אישי פעיל — משחק טריוויה רגיל, רק אתם מול השאלות. מצב המרדף וקבוצות זמינים במשחק מרובה משתתפים.</div>
            ) : (
            <div className="mode-grid" role="group" aria-label="מצב משחק">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className="mode-card"
                  aria-pressed={mode === m.id}
                  disabled={!host}
                  onClick={() => push(m.id, settings)}
                >
                  <div className="mi">{m.icon}</div>
                  <div>
                    <h3>
                      {m.name} <span className="pill violet">{m.tag}</span>
                    </h3>
                    <p>{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            )}
          </div>

          <div className="glass pad stack">
            <div className="title-md">קטגוריות ורמת קושי</div>
            <div className="chips" role="group" aria-label="קטגוריות">
              {CATEGORIES.map((c) => {
                const on = settings.categories.length === 0 || settings.categories.includes(c.id)
                return (
                  <button
                    key={c.id}
                    className="chip"
                    aria-pressed={settings.categories.includes(c.id)}
                    style={settings.categories.length === 0 ? { background: 'rgba(139,92,246,.2)' } : undefined}
                    disabled={!host}
                    onClick={() => toggleCat(c.id)}
                    title={on ? '' : 'לא נבחרה'}
                  >
                    {c.icon} {c.label}
                  </button>
                )
              })}
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: -6 }}>
              {settings.categories.length === 0 ? 'כל הקטגוריות משתתפות (לחצו כדי לצמצם)' : `${settings.categories.length} קטגוריות נבחרו`}
            </div>
            <div className="field">
              <label>רמת קושי</label>
              <div className="seg" role="group" aria-label="רמת קושי">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={settings.difficulty === d.id}
                    disabled={!host}
                    onClick={() => push(mode, { ...settings, difficulty: d.id })}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {mode !== 'chase' && (
              <div className="field">
                <label>מספר שאלות</label>
                <div className="seg" role="group" aria-label="מספר שאלות">
                  {ROUNDS.map((r) => (
                    <button key={r} className="num" aria-pressed={settings.rounds === r} disabled={!host} onClick={() => push(mode, { ...settings, rounds: r })}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <label>זמן לשאלה (שניות)</label>
              <div className="seg" role="group" aria-label="זמן לשאלה">
                {TIMES.map((t) => (
                  <button key={t} className="num" aria-pressed={settings.time_limit === t} disabled={!host} onClick={() => push(mode, { ...settings, time_limit: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {host ? (
            <button className="btn hot big block" disabled={!canStart || s.busy} onClick={start}>
              {canStart ? (solo ? '🧠 התחילו אימון אישי' : '🚀 התחילו משחק') : solo ? 'האימון האישי זמין במצב FFA בלבד' : 'צריך לפחות 2 שחקנים'}
            </button>
          ) : (
            <div className="glass pad-sm center row" style={{ justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
              <span>ממתינים שהמארח יתחיל…</span>
            </div>
          )}
          <button className="btn ghost block" onClick={leave}>
            יציאה מהחדר
          </button>
        </section>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  )
}
