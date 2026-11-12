import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { Avatar } from '../components/ui'
import { backendKind } from '../lib/backend'
import { MODES } from '../lib/meta'
import { sound } from '../lib/sound'
import StageScene from '../components/StageScene'

const demo = [
  { a: 0, from: '18%', to: '62%' },
  { a: 5, from: '32%', to: '80%' },
  { a: 8, from: '10%', to: '48%' },
]

export default function Landing() {
  return (
    <Shell>
      <main className="page">
        <section className="hero">
          <motion.span className="badge-live" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <i /> מולטיפלייר בזמן אמת · 2–8 שחקנים
          </motion.span>
          <motion.h1
            className="title-xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6 }}
          >
            תברחו מ<span className="hot-text">הרודף</span>.
            <br />
            <span className="grad-text">תנצחו את החברים.</span>
          </motion.h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
            משחק טריוויה בסגנון תוכנית טלוויזיה. פותחים חדר, שולחים קוד לחברים, ובונים צבר, בורחים מהרודף ונלחמים בסיבוב הגמר מול השעון.
          </motion.p>
          <motion.div className="cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Link to="/create" className="btn primary big" onClick={() => sound.unlock()}>
              🎮 פתחו חדר
            </Link>
            <Link to="/inspect" className="btn ghost big" onClick={() => sound.unlock()}>
              🧭 בדיקת המפה
            </Link>
            <Link to="/join" className="btn ghost big" onClick={() => sound.unlock()}>
              🔑 הצטרפו עם קוד
            </Link>
          </motion.div>
          {backendKind === 'none' && (
            <div className="alert info" role="status">
              השרת עדיין לא מחובר. <Link to="/setup">הוראות חיבור ל-Supabase</Link>
            </div>
          )}

          <StageScene />

          <motion.div
            className="glass hero-board"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            aria-hidden="true"
          >
            {demo.map((d, i) => (
              <div className="mini-lane" key={i}>
                <Avatar index={d.a} size={40} />
                <div className="mini-track">
                  <motion.div
                    className="mini-fill"
                    initial={{ width: d.from }}
                    animate={{ width: [d.from, d.to, d.from] }}
                    transition={{ duration: 7 + i, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="mini-wall"
                    animate={{ width: ['8%', '30%', '8%'] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            ))}
            <div className="row between muted" style={{ fontSize: 13, fontWeight: 700 }}>
              <span>🥷 הרודף מתקרב</span>
              <span>🏁 קו הסיום</span>
            </div>
          </motion.div>
        </section>

        <section className="feature-grid" aria-label="מצבי משחק">
          {MODES.map((m, i) => (
            <motion.article
              key={m.id}
              className="glass feature"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="ico">{m.icon}</div>
              <h3>{m.name}</h3>
              <p>{m.desc}</p>
            </motion.article>
          ))}
        </section>
      </main>
    </Shell>
  )
}
