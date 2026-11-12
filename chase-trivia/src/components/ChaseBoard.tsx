import type { CSSProperties } from 'react'
import type { Player } from '../lib/types'
import { Avatar } from './ui'

/**
 * The chase board. One lane per player, 13 cells (0 = where the chaser starts, 12 = finish line).
 * The red wall is the chaser: it advances across all lanes; anyone it reaches is caught.
 * Progress runs right → left (RTL), all movement is CSS-transitioned.
 */
export function ChaseBoard({
  players,
  chaserPos,
  boardLen = 12,
  meId,
  flashChaser,
}: {
  players: Player[]
  chaserPos: number
  boardLen?: number
  meId?: string
  flashChaser?: boolean
}) {
  const n = boardLen + 1
  const cells = Array.from({ length: n }, (_, i) => i)
  const order = [...players].sort((a, b) => {
    const rank = (p: Player) => (p.chase_status === 'qualified' ? 0 : p.chase_status === 'alive' ? 1 : 2)
    return rank(a) - rank(b) || b.position - a.position
  })
  return (
    <div className="glass board" style={{ '--n': n } as CSSProperties}>
      <div className="board-head">
        <div className="title-md">לוח המרדף</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill red">🔴 הרודף: צעד {chaserPos}</span>
          <span className="pill gold">🏁 קו הסיום: {boardLen}</span>
        </div>
      </div>
      <div className="lanes has-tag" style={{ '--n': n } as CSSProperties}>
        {order.map((p) => {
          const caught = p.chase_status === 'caught'
          const pos = p.chase_status === 'qualified' ? boardLen : p.position
          return (
            <div key={p.id} className="lane" aria-label={`${p.name}: צעד ${pos}${caught ? ', נתפס' : ''}`}>
              <div className="who">
                <Avatar index={p.avatar} size={32} dim={caught} />
                <span className="nm">
                  {p.name}
                  {p.id === meId ? ' ★' : ''}
                </span>
              </div>
              <div className="track">
                {cells.map((c) => (
                  <div key={c} className={`cell${c === boardLen ? ' finish' : ''}${c === 0 ? ' start' : ''}`}>
                    {c > 0 && c < boardLen ? c : ''}
                  </div>
                ))}
                <div className={`token${caught ? ' caught' : ''}`} style={{ insetInlineStart: `calc(${pos} * 100% / ${n})` }}>
                  <Avatar index={p.avatar} size={36} dim={caught} />
                  {caught && <span className="skull">💀</span>}
                </div>
              </div>
            </div>
          )
        })}
        <ChaserWall pos={chaserPos} n={n} flash={flashChaser} />
      </div>
    </div>
  )
}

function ChaserWall({ pos, n, flash }: { pos: number; n: number; flash?: boolean }) {
  // the wall lives in the track column (right of the lane label); mirror that offset with calc()
  return (
    <div
      className="wall"
      style={
        {
          '--n': n,
          insetInlineStart: `calc(var(--label, 140px) + 10px + ${pos} * (100% - var(--label, 140px) - 10px) / ${n})`,
          filter: flash ? 'brightness(1.5)' : undefined,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="body" />
      <div className="tag">הרודף</div>
      <div className="face">🥷</div>
    </div>
  )
}
