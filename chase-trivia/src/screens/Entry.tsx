import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../components/Shell'
import { AvatarPicker } from '../components/ui'
import { SetupNotice } from './Setup'
import { backendKind, getBackend } from '../lib/backend'
import { syncClock } from '../lib/clock'
import { errText } from '../lib/meta'
import { sound } from '../lib/sound'
import { loadProfile, saveProfile } from '../lib/useRoomSession'

export function ProfileForm({
  onSubmit,
  submitLabel,
  busy,
  error,
  children,
  initialName,
}: {
  onSubmit: (name: string, avatar: number) => void
  submitLabel: string
  busy: boolean
  error: string
  children?: React.ReactNode
  initialName?: string
}) {
  const prof = loadProfile()
  const [name, setName] = useState(initialName ?? prof.name)
  const [avatar, setAvatar] = useState(prof.avatar)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    sound.unlock()
    onSubmit(name.trim(), avatar)
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      {children}
      <div className="field">
        <label htmlFor="pname">איך קוראים לכם?</label>
        <input
          id="pname"
          className="input"
          value={name}
          maxLength={16}
          placeholder="השם שיופיע במשחק"
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label>בחרו דמות</label>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <button className="btn primary big block" disabled={busy || !name.trim()}>
        {busy ? 'רגע...' : submitLabel}
      </button>
    </form>
  )
}

export function CreatePage() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async (name: string, avatar: number) => {
    setBusy(true)
    setError('')
    try {
      const be = getBackend()
      await be.init()
      await syncClock()
      const res = await be.rpc<{ code: string }>('create_room', { p_name: name, p_avatar: avatar })
      saveProfile(name, avatar)
      nav(`/room/${res.code}`)
    } catch (e) {
      setError(errText(e))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <main className="page narrow stack">
        <div>
          <div className="eyebrow">שלב 1</div>
          <h1 className="title-lg">פותחים חדר חדש</h1>
          <p className="muted">אתם המארחים: אתם בוחרים מצב משחק ומתחילים כשכולם בפנים.</p>
        </div>
        {backendKind === 'none' ? (
          <SetupNotice />
        ) : (
          <div className="glass pad">
            <ProfileForm onSubmit={create} submitLabel="🚀 צרו חדר" busy={busy} error={error} />
          </div>
        )}
      </main>
    </Shell>
  )
}

export function JoinPage() {
  const nav = useNavigate()
  const params = useParams()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const join = async (name: string, avatar: number) => {
    const c = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(c)) {
      setError('קוד חדר הוא 5 תווים (אותיות ומספרים).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const be = getBackend()
      await be.init()
      await syncClock()
      await be.rpc('join_room', { p_code: c, p_name: name, p_avatar: avatar })
      saveProfile(name, avatar)
      sound.join()
      nav(`/room/${c}`)
    } catch (e) {
      setError(errText(e))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <main className="page narrow stack">
        <div>
          <div className="eyebrow">מצטרפים</div>
          <h1 className="title-lg">יש לכם קוד חדר?</h1>
          <p className="muted">הקלידו את הקוד שהמארח שלח לכם.</p>
        </div>
        {backendKind === 'none' ? (
          <SetupNotice />
        ) : (
          <div className="glass pad">
            <ProfileForm onSubmit={join} submitLabel="✨ הצטרפו למשחק" busy={busy} error={error}>
              <div className="field">
                <label htmlFor="rcode">קוד חדר</label>
                <input
                  id="rcode"
                  className="input code"
                  value={code}
                  maxLength={5}
                  placeholder="•••••"
                  autoCapitalize="characters"
                  autoComplete="off"
                  inputMode="text"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
              </div>
            </ProfileForm>
          </div>
        )}
      </main>
    </Shell>
  )
}
