import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Shell } from '../components/Shell'
import { ErrorBox, Spinner } from '../components/ui'
import { ProfileForm } from './Entry'
import { SetupNotice } from './Setup'
import Lobby from './Lobby'
import Question from './Question'
import Reveal from './Reveal'
import BoardIntro from './BoardIntro'
import { Final, FinalIntro } from './Final'
import Winner from './Winner'
import { backendKind } from '../lib/backend'
import { useRoomSession } from '../lib/useRoomSession'
import { sound } from '../lib/sound'

export default function RoomPage() {
  const params = useParams()
  const nav = useNavigate()
  const code = (params.code ?? '').toUpperCase()
  if (backendKind === 'none') {
    return (
      <Shell>
        <main className="page narrow">
          <SetupNotice />
        </main>
      </Shell>
    )
  }
  return <RoomInner code={code} onHome={() => nav('/')} />
}

function RoomInner({ code, onHome }: { code: string; onHome: () => void }) {
  const s = useRoomSession(code)
  const { phase, room, me } = s
  const [joinError, setJoinError] = useState('')

  // stop the final-round heartbeat loop whenever we leave the page
  useEffect(() => () => sound.stopLoop(), [])

  if (phase === 'loading') {
    return (
      <Shell>
        <Spinner label="מתחברים לחדר…" />
      </Shell>
    )
  }
  if (phase === 'error') {
    return (
      <Shell>
        <main className="page narrow">
          <ErrorBox message={s.error} onRetry={() => void s.join()}>
            <Link className="btn ghost" to="/" onClick={onHome}>
              לדף הבית
            </Link>
          </ErrorBox>
        </main>
      </Shell>
    )
  }
  if (phase === 'needName') {
    return (
      <Shell>
        <main className="page narrow stack">
          <div>
            <div className="eyebrow">חדר {code}</div>
            <h1 className="title-lg">מצטרפים למשחק</h1>
          </div>
          <div className="glass pad">
            <ProfileForm
              submitLabel="✨ כנסו לחדר"
              busy={false}
              error={joinError}
              onSubmit={(n, a) => {
                setJoinError('')
                void s.join(n, a)
              }}
            />
          </div>
        </main>
      </Shell>
    )
  }
  if (!room || !me) {
    return (
      <Shell>
        <Spinner label="טוענים נתונים…" />
      </Shell>
    )
  }

  const chaseDanger =
    room.mode === 'chase' && (room.status === 'board' || room.status === 'final_intro' || room.status === 'final' || room.state.q?.kind === 'chase')

  let screen: React.ReactNode
  switch (room.status) {
    case 'lobby':
      screen = <Lobby s={s} />
      break
    case 'question':
      screen = room.state.q ? <Question s={s} /> : <Spinner />
      break
    case 'reveal':
      screen = room.state.reveal && room.state.q ? <Reveal s={s} /> : <Spinner />
      break
    case 'board':
      screen = <BoardIntro s={s} />
      break
    case 'final_intro':
      screen = <FinalIntro s={s} />
      break
    case 'final':
      screen = <Final s={s} />
      break
    case 'finished':
      screen = <Winner s={s} />
      break
  }

  const screenKey = room.status === 'question' || room.status === 'reveal' ? `${room.status}:${room.step}` : room.status

  return (
    <Shell danger={chaseDanger}>
      <AnimatePresence mode="wait">
        <motion.div key={screenKey} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
          {screen}
        </motion.div>
      </AnimatePresence>
    </Shell>
  )
}
