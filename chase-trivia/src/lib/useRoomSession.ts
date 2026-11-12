import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBackend } from './backend'
import { msSince, msUntil, syncClock } from './clock'
import { errText } from './meta'
import type { Mode, Player, Room, Settings } from './types'

export type SessionPhase = 'loading' | 'needName' | 'error' | 'ready'

const STORE_NAME = 'arena-name'
const STORE_AVATAR = 'arena-avatar'
export const ONLINE_MS = 25000

export const loadProfile = () => {
  try {
    return {
      name: localStorage.getItem(STORE_NAME) ?? '',
      avatar: Number(localStorage.getItem(STORE_AVATAR) ?? Math.floor(Math.random() * 12)) || 0,
    }
  } catch {
    return { name: '', avatar: 0 }
  }
}
export const saveProfile = (name: string, avatar: number) => {
  try {
    localStorage.setItem(STORE_NAME, name)
    localStorage.setItem(STORE_AVATAR, String(avatar))
  } catch {
    /* ignore */
  }
}

export const isOnline = (p: Player) => msSince(p.last_seen) < ONLINE_MS

const REVEAL_HOLD: Record<string, number> = { build: 3800, chase: 7500, ffa: 6000, team: 6500 }

export function useRoomSession(code: string) {
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [error, setError] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const playersRef = useRef<Player[]>([])
  const refreshing = useRef(false)
  const again = useRef(false)

  const me = useMemo(() => players.find((p) => p.user_id === userId) ?? null, [players, userId])
  const isHost = !!room && !!me && room.host_player_id === me.id

  // ---------- data ----------
  const refresh = useCallback(async () => {
    if (!roomId) return
    if (refreshing.current) {
      again.current = true
      return
    }
    refreshing.current = true
    try {
      const be = getBackend()
      const [r, p] = await Promise.all([be.getRoom(roomId), be.getPlayers(roomId)])
      if (!r) {
        setError('החדר נסגר.')
        setPhase('error')
        return
      }
      roomRef.current = r
      playersRef.current = p
      setRoom(r)
      setPlayers(p)
    } catch {
      /* transient network error: next poll retries */
    } finally {
      refreshing.current = false
      if (again.current) {
        again.current = false
        void refresh()
      }
    }
  }, [roomId])

  // ---------- join / reconnect ----------
  const join = useCallback(
    async (name?: string, avatar?: number) => {
      setPhase('loading')
      setError('')
      try {
        const be = getBackend()
        const uid = await be.init()
        setUserId(uid)
        await syncClock()
        const prof = loadProfile()
        const n = (name ?? prof.name).trim()
        const a = avatar ?? prof.avatar
        const res = await be.rpc<{ room_id: string; player_id: string }>('join_room', { p_code: code, p_name: n, p_avatar: a })
        if (n) saveProfile(n, a)
        setRoomId(res.room_id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('invalid_name')) {
          setPhase('needName')
          return
        }
        setError(errText(e))
        setPhase('error')
      }
    },
    [code],
  )

  useEffect(() => {
    void join()
  }, [join])

  useEffect(() => {
    if (!roomId) return
    let alive = true
    void (async () => {
      await refresh()
      if (alive) setPhase('ready')
    })()
    const be = getBackend()
    let t: number | undefined
    const onChange = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => void refresh(), 60)
    }
    const unsub = be.subscribe(roomId, onChange)
    const poll = window.setInterval(() => void refresh(), be.pollMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void be.rpc('heartbeat', { p_room: roomId }).catch(() => {})
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onVis)
    const hb = window.setInterval(() => void be.rpc('heartbeat', { p_room: roomId }).catch(() => {}), 8000)
    const resync = window.setInterval(() => void syncClock(1).catch(() => {}), 60000)
    return () => {
      alive = false
      window.clearTimeout(t)
      unsub()
      window.clearInterval(poll)
      window.clearInterval(hb)
      window.clearInterval(resync)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onVis)
    }
  }, [roomId, refresh])

  // ---------- actions ----------
  const call = useCallback(
    async <T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
      if (!roomId) throw new Error('not_member')
      const out = await getBackend().rpc<T>(fn, { p_room: roomId, ...args })
      void refresh()
      return out
    },
    [roomId, refresh],
  )

  const guarded = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      try {
        await fn()
        return null
      } catch (e) {
        return errText(e)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const actions = useMemo(
    () => ({
      updateSettings: (mode: Mode, settings: Settings) => call('update_settings', { p_mode: mode, p_settings: settings }),
      setTeam: (team: number) => call('set_team', { p_team: team }),
      start: () => guarded(() => call('start_game')),
      answer: (idx: number, choice: number) => call('submit_answer', { p_idx: idx, p_choice: choice }),
      finalAnswer: (n: number, choice: number) =>
        call<{ correct: boolean; correct_idx: number; locked_until: string | null }>('final_answer', { p_n: n, p_choice: choice }),
      reset: () => guarded(() => call('reset_room')),
      leave: async () => {
        if (roomId) await getBackend().rpc('leave_room', { p_room: roomId }).catch(() => {})
      },
    }),
    [call, guarded, roomId],
  )

  // ---------- game flow controller ----------
  // The host drives the game. If the host stalls, anyone can take over after a timeout (enforced on the server).
  useEffect(() => {
    if (!room || !me) return
    const step = room.step
    const timers: number[] = []
    const tryAdvance = (attempt = 0) => {
      void call('advance', { p_step: step }).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('too_early') && attempt < 6) timers.push(window.setTimeout(() => tryAdvance(attempt + 1), 450))
      })
    }
    const fire = (ms: number) => timers.push(window.setTimeout(() => tryAdvance(), Math.max(60, ms)))

    switch (room.status) {
      case 'question':
        if (room.state.q) fire(msUntil(room.state.q.deadline) + (isHost ? 350 : 5600))
        break
      case 'reveal': {
        const hold = REVEAL_HOLD[room.state.reveal?.kind ?? 'ffa'] ?? 6000
        const since = msSince(room.state.reveal_at)
        fire(isHost ? hold - since : 20600 - since)
        break
      }
      case 'board':
        fire((isHost ? 7000 : 30600) - msSince(room.updated_at))
        break
      case 'final_intro':
        fire((isHost ? 8000 : 30600) - msSince(room.updated_at))
        break
      case 'final':
        fire(msUntil(room.state.final_deadline) + (isHost ? 350 : 5600))
        break
      default:
        break
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.step, room?.status, isHost, !!me])

  // host: close the question early once every connected player answered
  useEffect(() => {
    if (!room || !isHost || room.status !== 'question' || !room.state.q) return
    const q = room.state.q
    const answered = new Set(room.state.answered ?? [])
    const eligible = players.filter((p) => isOnline(p) && (q.kind !== 'chase' || p.chase_status === 'alive'))
    if (!eligible.length || !eligible.every((p) => answered.has(p.id))) return
    const step = room.step
    const t = window.setTimeout(() => void call('advance', { p_step: step }).catch(() => {}), 900)
    return () => window.clearTimeout(t)
  }, [room, players, isHost, call])

  // anyone: take over as host when the host went away
  useEffect(() => {
    if (!roomId || !me) return
    const t = window.setInterval(() => {
      const r = roomRef.current
      const host = playersRef.current.find((p) => p.id === r?.host_player_id)
      if (r && me.id !== r.host_player_id && (!host || msSince(host.last_seen) > ONLINE_MS + 3000)) {
        void getBackend().rpc('claim_host', { p_room: roomId }).then(() => refresh()).catch(() => {})
      }
    }, 5000)
    return () => window.clearInterval(t)
  }, [roomId, me, refresh])

  return { phase, error, room, players, me, isHost, busy, actions, join, retry: join, refresh }
}

export type Session = ReturnType<typeof useRoomSession>
