// Local development backend: the exact same SQL as Supabase (supabase/schema.sql + seed.sql) running on an
// embedded Postgres (PGlite), exposed over a tiny HTTP API. Real multi-client multiplayer, server-side validation,
// RLS and security-definer functions included – no Supabase account needed for development.
//   npm run dev:local
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.LOCAL_SERVER_PORT || 8787)
const db = new PGlite()

await db.exec(`
  create role anon; create role authenticated;
  create schema auth; grant usage on schema auth to authenticated, anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
`)
await db.exec(fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'))
await db.exec(fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8'))

// periodic cleanup of old rooms
setInterval(() => db.query('select public.cleanup_old_rooms()').catch(() => {}), 10 * 60 * 1000)

// one query at a time (single embedded connection)
let chain = Promise.resolve()
const withUser = (uid, fn) => {
  const run = chain.then(async () => {
    await db.query("select set_config('app.uid', $1, false)", [uid])
    await db.exec('set role authenticated')
    try {
      return await fn()
    } finally {
      await db.exec('reset role')
    }
  })
  chain = run.catch(() => {})
  return run
}

// test-only helper (LOCAL_SERVER_DEBUG=1): lets the E2E bots look up the right answer. Never exists on Supabase.
const withSuper = (fn) => {
  const run = chain.then(fn)
  chain = run.catch(() => {})
  return run
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FN = /^[a-z_]+$/
const PARAM = /^p_[a-z_]+$/
const PUBLIC_FNS = new Set([
  'server_time', 'create_room', 'join_room', 'heartbeat', 'leave_room', 'claim_host', 'update_settings',
  'set_team', 'start_game', 'submit_answer', 'advance', 'final_answer', 'reset_room',
])

const send = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-user',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let d = ''
    req.on('data', (c) => {
      d += c
      if (d.length > 1e5) reject(new Error('too_large'))
    })
    req.on('end', () => resolve(d ? JSON.parse(d) : {}))
    req.on('error', reject)
  })

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    try {
      const uid = String(req.headers['x-user'] || '')
      if (!UUID.test(uid)) return send(res, 401, { error: 'not_authenticated' })
      const url = new URL(req.url, 'http://x')
      const parts = url.pathname.split('/').filter(Boolean) // api, kind, arg
      if (parts[1] === '_debug' && process.env.LOCAL_SERVER_DEBUG === '1') {
        const code = url.searchParams.get('code')
        const name = url.searchParams.get('player')
        const out = await withSuper(async () => {
          const r = (await db.query('select * from public.rooms where code = $1', [code])).rows[0]
          if (!r) return { text: null }
          if (r.status === 'final') {
            const p = (await db.query('select * from public.players where room_id = $1 and name = $2', [r.id, name])).rows[0]
            const rq = p && (await db.query('select * from public.room_questions where player_id = $1 and idx = $2', [p.id, p.final_n])).rows[0]
            return { text: rq ? rq.answers[rq.correct_idx] : null }
          }
          if (r.status !== 'question') return { text: null }
          const rq = (await db.query('select * from public.room_questions where room_id = $1 and player_id is null and idx = $2', [r.id, r.state.q.idx])).rows[0]
          return { text: rq ? rq.answers[rq.correct_idx] : null }
        })
        return send(res, 200, out)
      }

      if (parts[1] === 'rpc') {
        const fn = parts[2]
        if (!FN.test(fn) || !PUBLIC_FNS.has(fn)) return send(res, 404, { error: 'not_found' })
        const { args = {} } = await readBody(req)
        const keys = Object.keys(args)
        if (keys.some((k) => !PARAM.test(k))) return send(res, 400, { error: 'bad_args' })
        const sql = `select public.${fn}(${keys
          .map((k, i) => (args[k] !== null && typeof args[k] === 'object' ? `${k} => $${i + 1}::jsonb` : `${k} => $${i + 1}`))
          .join(', ')}) as r`
        const params = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]))
        const out = await withUser(uid, () => db.query(sql, params))
        return send(res, 200, { data: out.rows[0].r })
      }
      if (parts[1] === 'room' && UUID.test(parts[2] || '')) {
        const out = await withUser(uid, () => db.query('select * from public.rooms where id = $1', [parts[2]]))
        return send(res, 200, { data: out.rows[0] ?? null })
      }
      if (parts[1] === 'players' && UUID.test(parts[2] || '')) {
        const out = await withUser(uid, () => db.query('select * from public.players where room_id = $1 order by joined_at', [parts[2]]))
        return send(res, 200, { data: out.rows })
      }
      if (parts[1] === 'history') {
        const out = await withUser(uid, () => db.query('select * from public.game_results order by played_at desc limit 200'))
        return send(res, 200, { data: out.rows })
      }
      send(res, 404, { error: 'not_found' })
    } catch (e) {
      const msg = String(e?.message || e)
      send(res, 400, { error: msg.replace(/^error: /i, '') })
    }
  })
  .listen(PORT, () => console.log(`local game server on http://localhost:${PORT}  (embedded Postgres, ${fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8').length > 0 ? 'questions seeded' : ''})`))
