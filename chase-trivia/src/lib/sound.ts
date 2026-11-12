// Synthesised sound effects (WebAudio) – no audio files needed. Optional, with a persisted mute switch.
type Listener = () => void

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem('arena-muted') === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<Listener>()
let master: GainNode | null = null
let loop: { stop: () => void } | null = null

function ac(): AudioContext | null {
  if (muted) return null
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}) {
  const c = ac()
  if (!c || !master) return
  const t = c.currentTime + (opts.delay ?? 0)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(freq, t)
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + opts.slide), t + dur)
  const vol = opts.vol ?? 0.25
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(dur: number, vol = 0.2, delay = 0, hp = 800) {
  const c = ac()
  if (!c || !master) return
  const t = c.currentTime + delay
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(master)
  src.start(t)
}

export const sound = {
  isMuted: () => muted,
  subscribe(l: Listener) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  setMuted(v: boolean) {
    muted = v
    try {
      localStorage.setItem('arena-muted', v ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (v) this.stopLoop()
    listeners.forEach((l) => l())
  },
  unlock() {
    ac()
  },
  click: () => tone(520, 0.07, { type: 'triangle', vol: 0.14 }),
  join: () => {
    tone(660, 0.1, { type: 'triangle' })
    tone(990, 0.14, { type: 'triangle', delay: 0.08 })
  },
  tick: () => tone(880, 0.05, { type: 'square', vol: 0.08 }),
  urgent: () => tone(1180, 0.09, { type: 'square', vol: 0.12 }),
  go: () => {
    tone(523, 0.12, { type: 'triangle' })
    tone(784, 0.25, { type: 'triangle', delay: 0.1 })
  },
  lock: () => tone(300, 0.1, { type: 'sine', vol: 0.2, slide: 200 }),
  whoosh: () => noise(0.35, 0.1, 0, 1500),
  correct: () => {
    tone(523, 0.12, { type: 'triangle' })
    tone(659, 0.12, { type: 'triangle', delay: 0.09 })
    tone(784, 0.3, { type: 'triangle', delay: 0.18 })
  },
  wrong: () => {
    tone(220, 0.3, { type: 'sawtooth', vol: 0.16, slide: -90 })
    tone(165, 0.4, { type: 'sawtooth', vol: 0.14, delay: 0.12, slide: -60 })
  },
  step: () => tone(340, 0.09, { type: 'triangle', vol: 0.18, slide: 120 }),
  chaserStep: () => {
    tone(90, 0.28, { type: 'sine', vol: 0.5 })
    noise(0.12, 0.12, 0, 200)
  },
  caught: () => {
    tone(196, 0.5, { type: 'sawtooth', vol: 0.2, slide: -120 })
    tone(98, 0.8, { type: 'square', vol: 0.15, delay: 0.1, slide: -50 })
    noise(0.5, 0.15, 0, 300)
  },
  qualify: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', delay: i * 0.09 }))
  },
  fanfare: () => {
    ;[523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i > 6 ? 0.7 : 0.2, { type: 'triangle', vol: 0.22, delay: i * 0.13 }))
    ;[262, 330, 392].forEach((f) => tone(f, 1.3, { type: 'sine', vol: 0.1, delay: 0.9 }))
  },
  lose: () => {
    ;[392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.22 }))
  },
  /** suspense heartbeat for the final round */
  startLoop() {
    this.stopLoop()
    const c = ac()
    if (!c) return
    let stopped = false
    let beat = 0
    const run = () => {
      if (stopped) return
      tone(70, 0.2, { type: 'sine', vol: 0.45 })
      tone(70, 0.2, { type: 'sine', vol: 0.3, delay: 0.17 })
      beat++
      window.setTimeout(run, Math.max(380, 900 - beat * 12))
    }
    run()
    loop = {
      stop: () => {
        stopped = true
      },
    }
  },
  stopLoop() {
    loop?.stop()
    loop = null
  },
}
