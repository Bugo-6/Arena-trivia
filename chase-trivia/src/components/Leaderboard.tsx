import { motion } from 'framer-motion'
import type { Player } from '../lib/types'
import { Avatar, CountUp } from './ui'

export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || b.correct_count - a.correct_count || a.joined_at.localeCompare(b.joined_at))
}

/** Live leaderboard: rows animate to their new positions when scores change. */
export function Leaderboard({
  players,
  meId,
  deltas,
  sub,
}: {
  players: Player[]
  meId?: string
  deltas?: Record<string, number>
  sub?: (p: Player) => string
}) {
  const sorted = sortPlayers(players)
  const top = sorted[0]?.score ?? 0
  return (
    <div className="lb" aria-label="לוח תוצאות">
      {sorted.map((p, i) => (
        <motion.div
          key={p.id}
          layout
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className={`lb-row${p.id === meId ? ' me' : ''}${i === 0 && top > 0 ? ' first' : ''}`}
        >
          <div className="rk num">{i + 1}</div>
          <Avatar index={p.avatar} size={38} crown={i === 0 && top > 0} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">
              {p.name}
              {p.id === meId ? ' (אתם)' : ''}
            </div>
            {sub && <div className="sub">{sub(p)}</div>}
          </div>
          <div>
            <div className="sc">
              <CountUp value={p.score} />
            </div>
            {deltas?.[p.id] ? <span className="delta num">+{deltas[p.id]}</span> : null}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
