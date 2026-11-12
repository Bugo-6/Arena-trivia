import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChaseBoard } from '../components/ChaseBoard'
import { Avatar } from '../components/ui'
import { sound } from '../lib/sound'
import type { Session } from '../lib/useRoomSession'

/** Shown after the 6 "build your bank" questions: everyone's starting positions vs the chaser. */
export default function BoardIntro({ s }: { s: Session }) {
  const room = s.room!
  const me = s.me!
  useEffect(() => {
    sound.whoosh()
    const t = window.setTimeout(() => sound.chaserStep(), 700)
    return () => window.clearTimeout(t)
  }, [])
  const sorted = [...s.players].sort((a, b) => b.position - a.position)
  return (
    <main className="page stack">
      <div className="center stack" style={{ gap: 6 }}>
        <div className="eyebrow" style={{ color: 'var(--pink)' }}>
          הצבר מוכן
        </div>
        <motion.h1 className="title-lg" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          הרודף יוצא לדרך 🥷
        </motion.h1>
        <p className="muted" style={{ margin: 0, maxWidth: 620 }}>
          כל תשובה נכונה מקדמת אתכם צעד לכיוון קו הסיום. כל תשובה לא נכונה משאירה אתכם במקום. אם הרודף מגיע אליכם, אתם בחוץ. מי שמגיע לקו הסיום נכנס לסיבוב הגמר.
        </p>
      </div>
      <ChaseBoard players={s.players} chaserPos={room.state.chaser_pos ?? 0} boardLen={room.state.board_len ?? 12} meId={me.id} />
      <div className="glass pad-sm row" style={{ justifyContent: 'center', gap: 18 }}>
        {sorted.map((p) => (
          <span key={p.id} className="row" style={{ gap: 8 }}>
            <Avatar index={p.avatar} size={30} />
            <b>{p.name}</b>
            <span className="pill violet num">צעד {p.position}</span>
          </span>
        ))}
      </div>
    </main>
  )
}
