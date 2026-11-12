import { getBackend } from './backend'

// Offset between this device's clock and the database clock, so every player sees the same timers.
let offset = 0
let synced = false

export const serverNow = () => Date.now() + offset
export const isClockSynced = () => synced
export const msUntil = (iso: string | undefined | null) => (iso ? new Date(iso).getTime() - serverNow() : 0)
export const msSince = (iso: string | undefined | null) => (iso ? serverNow() - new Date(iso).getTime() : 0)

export async function syncClock(samples = 3): Promise<void> {
  const be = getBackend()
  let best: { rtt: number; off: number } | null = null
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now()
    const srv = await be.rpc<string>('server_time')
    const t1 = Date.now()
    const rtt = t1 - t0
    const off = new Date(srv).getTime() + rtt / 2 - t1
    if (!best || rtt < best.rtt) best = { rtt, off }
  }
  if (best) {
    offset = best.off
    synced = true
  }
}
