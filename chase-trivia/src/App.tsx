import { Route, Routes } from 'react-router-dom'
import Landing from './screens/Landing'
import { CreatePage, JoinPage } from './screens/Entry'
import RoomPage from './screens/Room'
import History from './screens/History'
import Setup from './screens/Setup'
import { Shell } from './components/Shell'
import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <Shell>
      <main className="page narrow screen-center">
        <div style={{ fontSize: 64 }}>🧭</div>
        <h1 className="title-lg">הדף לא נמצא</h1>
        <Link className="btn primary" to="/">
          חזרה לדף הבית
        </Link>
      </main>
    </Shell>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="/history" element={<History />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
