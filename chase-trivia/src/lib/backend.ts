import { createClient } from '@supabase/supabase-js'
import type { GameResult, Player, Room } from './types'

/**
 * Two interchangeable transports for the SAME server logic (supabase/schema.sql):
 *  - "supabase": hosted Supabase (Auth + Postgres + Realtime). Production.
 *  - "local":    scripts/local-server.mjs – the same SQL running on an embedded Postgres (PGlite).
 *                Real multi-client multiplayer over your LAN, used for development and testing.
 */
export interface Backend {
  kind: 'supabase' | 'local'
  init(): Promise<string>
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>
  getRoom(id: string): Promise<Room | null>
  getPlayers(roomId: string): Promise<Player[]>
  getHistory(): Promise<GameResult[]>
  subscribe(roomId: string, onChange: () => void): () => void
  pollMs: number
}

const env = import.meta.env
const SB_URL = env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = env.VITE_SUPABASE_ANON_KEY as string | undefined
const LOCAL = env.VITE_LOCAL_SERVER as string | undefined

export const backendKind: 'supabase' | 'local' | 'none' = LOCAL ? 'local' : SB_URL && SB_KEY ? 'supabase' : 'none'

function supabaseBackend(): Backend {
  const sb = createClient(SB_URL!, SB_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return {
    kind: 'supabase',
    pollMs: 3000,
    async init() {
      const { data } = await sb.auth.getSession()
      if (data.session) return data.session.user.id
      const res = await sb.auth.signInAnonymously()
      if (res.error || !res.data.user) throw new Error('auth_failed')
      return res.data.user.id
    },
    async rpc(fn, args) {
      const { data, error } = await sb.rpc(fn, args ?? {})
      if (error) throw new Error(error.message || 'network')
      return data as never
    },
    async getRoom(id) {
      const { data, error } = await sb.from('rooms').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error('network')
      return data as Room | null
    },
    async getPlayers(roomId) {
      const { data, error } = await sb.from('players').select('*').eq('room_id', roomId).order('joined_at')
      if (error) throw new Error('network')
      return (data ?? []) as Player[]
    },
    async getHistory() {
      const { data, error } = await sb.from('game_results').select('*').order('played_at', { ascending: false }).limit(200)
      if (error) throw new Error('network')
      return (data ?? []) as GameResult[]
    },
    subscribe(roomId, onChange) {
      const ch = sb
        .channel(`room-${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, onChange)
        .subscribe()
      return () => {
        void sb.removeChannel(ch)
      }
    },
  }
}

function localBackend(): Backend {
  const base = LOCAL!.replace(/\/$/, '')
  // sessionStorage => every browser tab is its own player, handy for testing alone
  const uid = (() => {
    try {
      let v = sessionStorage.getItem('arena-local-uid')
      if (!v) {
        v = crypto.randomUUID()
        sessionStorage.setItem('arena-local-uid', v)
      }
      return v
    } catch {
      return crypto.randomUUID()
    }
  })()
  const call = async (path: string, body?: unknown) => {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', 'x-user': uid },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new Error('network')
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'network')
    return json
  }
  return {
    kind: 'local',
    pollMs: 700,
    async init() {
      return uid
    },
    async rpc(fn, args) {
      return (await call(`/api/rpc/${fn}`, { args: args ?? {} })).data
    },
    async getRoom(id) {
      return (await call(`/api/room/${id}`)).data
    },
    async getPlayers(roomId) {
      return (await call(`/api/players/${roomId}`)).data
    },
    async getHistory() {
      return (await call('/api/history')).data
    },
    subscribe() {
      return () => {}
    },
  }
}

let instance: Backend | null = null
export function getBackend(): Backend {
  if (backendKind === 'none') throw new Error('backend_not_configured')
  if (!instance) instance = backendKind === 'local' ? localBackend() : supabaseBackend()
  return instance
}
