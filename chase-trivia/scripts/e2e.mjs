// Real-browser end-to-end test: 3 separate browser contexts (= 3 different players) play a full game against the
// local server. Usage: LOCAL_SERVER_DEBUG=1 npm run dev:local   (in another terminal)  then:  node scripts/e2e.mjs [ffa|chase|team]
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const MODE = process.argv[2] || 'ffa'
const WEB = process.env.WEB || 'http://localhost:5173'
const API = process.env.API || 'http://localhost:8787'
const OUT = process.env.SHOTS || '/tmp/shots'
fs.mkdirSync(OUT, { recursive: true })

const log = (...a) => console.log(`[${MODE}]`, ...a)
let failures = 0
const check = (c, m) => { if (c) log('✓', m); else { failures++; log('✗ FAIL', m) } }

const browser = await chromium.launch()
const errors = []
async function newPlayer(name, viewport = { width: 1280, height: 820 }) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL' })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`))
  return { name, ctx, page }
}

const A = await newPlayer('אלון')
const B = await newPlayer('בר', { width: 390, height: 844 })
const C = await newPlayer('גל')

// ---------- create & join ----------
await A.page.goto(`${WEB}/`)
await A.page.screenshot({ path: `${OUT}/${MODE}-01-landing.png` })
await A.page.getByRole('link', { name: /פתחו חדר/ }).click()
await A.page.fill('#pname', A.name)
await A.page.screenshot({ path: `${OUT}/${MODE}-02-create.png` })
await A.page.getByRole('button', { name: /צרו חדר/ }).click()
await A.page.waitForURL(/\/room\/[A-Z0-9]{5}/)
const code = A.page.url().split('/room/')[1]
check(/^[A-Z2-9]{5}$/.test(code), `room created with code ${code}`)

for (const p of [B, C]) {
  await p.page.goto(`${WEB}/join/${code}`)
  await p.page.fill('#pname', p.name)
  await p.page.getByRole('button', { name: /הצטרפו למשחק/ }).click()
  await p.page.waitForURL(/\/room\//)
}
await A.page.waitForSelector('text=ממתינים לשחקן', { timeout: 10000 })
await A.page.waitForFunction(() => document.querySelectorAll('.player-card:not(.empty)').length === 3, null, { timeout: 15000 })
check(true, 'host sees all 3 players in the lobby in real time')
await B.page.waitForFunction(() => document.querySelectorAll('.player-card:not(.empty)').length === 3, null, { timeout: 15000 })
check(true, 'joined player sees all 3 players too')
check(await B.page.getByText('ממתינים שהמארח יתחיל').isVisible(), 'non-host sees waiting message, no start button')
check((await B.page.getByRole('button', { name: /התחילו משחק/ }).count()) === 0, 'non-host cannot see the start button')

// host picks mode + settings
const modeName = { ffa: 'כולם נגד כולם', chase: 'המרדף', team: 'קרב קבוצות' }[MODE]
await A.page.locator('.mode-card', { hasText: modeName }).click()
await A.page.waitForFunction((n) => document.querySelector('.mode-card[aria-pressed="true"]')?.textContent?.includes(n), modeName)
await B.page.waitForFunction((n) => document.querySelector('.mode-card[aria-pressed="true"]')?.textContent?.includes(n), modeName, { timeout: 10000 })
check(true, 'mode selection synced to other players')
if (MODE !== 'chase') await A.page.locator('.seg button', { hasText: /^5$/ }).first().click()
await A.page.locator('.seg button', { hasText: /^10$/ }).last().click().catch(() => {})
await A.page.getByRole('button', { name: /^ספורט/ }).click().catch(() => {})
await A.page.screenshot({ path: `${OUT}/${MODE}-03-lobby.png` })
await B.page.screenshot({ path: `${OUT}/${MODE}-03-lobby-mobile.png` })
if (MODE === 'team') {
  await A.page.locator('.team-col.t0 .chip').click()
  await B.page.locator('.team-col.t1 .chip').click()
  await C.page.locator('.team-col.t1 .chip').click()
}

// ---------- bots ----------
const policies = {
  אלון: () => true,
  בר: () => Math.random() < 0.55,
  גל: () => (MODE === 'chase' ? false : Math.random() < 0.3),
}
const shots = new Set()
let finished = false
const shot = async (label) => { if (!shots.has(label)) { shots.add(label); await A.page.screenshot({ path: `${OUT}/${MODE}-${label}.png` }) } }

async function correctText(player) {
  const r = await fetch(`${API}/api/_debug/correct?code=${code}&player=${encodeURIComponent(player)}`, { headers: { 'x-user': '00000000-0000-0000-0000-000000000001' } })
  return (await r.json()).text
}

async function bot(p) {
  const answeredFor = new Set()
  while (!finished) {
    const page = p.page
    try {
      if (await page.getByText('דירוג סופי').count()) return
      const btns = page.locator('.ans:not([disabled])')
      if ((await btns.count()) === 4) {
        const qtext = (await page.locator('.q-text').first().textContent()) ?? ''
        const inFinal = (await page.locator('.final-clock').count()) > 0
        const key = inFinal ? null : qtext
        if (!key || !answeredFor.has(key)) {
          const right = await correctText(p.name)
          if (right) {
            if (key) answeredFor.add(key)
            const want = policies[p.name]()
            const texts = await btns.evaluateAll((els) => els.map((e) => e.querySelector('span:nth-child(2)')?.textContent))
            let idx = texts.indexOf(right)
            if (idx < 0) idx = 0
            if (!want) idx = (idx + 1) % 4
            if (p.name === 'בר' && !inFinal && Math.random() < 0.3) await page.waitForTimeout(1500)
            await page.keyboard.press(String(idx + 1)).catch(() => {})
            await page.waitForTimeout(inFinal ? 100 : 300)
          }
        }
      }
    } catch { /* page navigating */ }
    await page.waitForTimeout(150)
  }
}

// host starts
const startBtn = A.page.getByRole('button', { name: /התחילו משחק/ })
await startBtn.click()
log('game started')
await A.page.waitForSelector('.q-text', { timeout: 15000 })
check(true, 'question screen shown after start')
check(await B.page.locator('.q-text').first().isVisible(), 'other player sees the question too')

const bots = [bot(A), bot(B), bot(C)]

// watcher: screenshots + assertions on phases
const watcher = (async () => {
  const t0 = Date.now()
  while (!finished && Date.now() - t0 < 12 * 60 * 1000) {
    try {
      if (await A.page.locator('.overlay-count').count()) await shot('04-leadin')
      if (await A.page.locator('.ans.picked').count()) await shot('05-question-answered')
      if (await A.page.locator('.verdict').count()) { await A.page.waitForTimeout(2500); await shot('06-reveal'); }
      if (await A.page.locator('.board').count()) { await A.page.waitForTimeout(1200); await shot('07-board') }
      if (await A.page.locator('.event-banner.caught').count()) await shot('07b-caught')
      if (await A.page.locator('.final-clock').count()) { await A.page.waitForTimeout(3000); await shot('08-final') }
      if (await B.page.locator('.q-text').count()) await B.page.screenshot({ path: `${OUT}/${MODE}-05-question-mobile.png` })
      if (await A.page.getByText('דירוג סופי').count()) { await A.page.waitForTimeout(3500); await shot('09-winner'); finished = true }
    } catch { /* ignore */ }
    await A.page.waitForTimeout(400)
  }
})()

await watcher
await Promise.all(bots)
check(finished, 'game ran to the end and the winner screen was shown')
await B.page.screenshot({ path: `${OUT}/${MODE}-09-winner-mobile.png`, fullPage: true })
const rows = await A.page.locator('.lb-row').count()
check(rows === 3, 'final ranking lists all 3 players')
const winTxt = await A.page.locator('.winner-hero').textContent()
log('headline:', winTxt?.replace(/\s+/g, ' ').slice(0, 120))
check((await A.page.getByRole('button', { name: /משחק חוזר/ }).count()) === 1, 'host has a rematch button')
check((await B.page.getByRole('button', { name: /משחק חוזר/ }).count()) === 0, 'non-host has no rematch button')

// rematch returns everyone to the lobby
await A.page.getByRole('button', { name: /משחק חוזר/ }).click()
await B.page.waitForSelector('text=ממתינים שהמארח יתחיל', { timeout: 10000 })
check(true, 'rematch resets the room to the lobby for everyone')

// history
await C.page.goto(`${WEB}/history`)
await C.page.waitForSelector('.stats-grid', { timeout: 10000 })
await C.page.screenshot({ path: `${OUT}/${MODE}-10-history.png` })
check((await C.page.locator('.hist-item').count()) >= 1, 'history shows the finished game')

const real = errors.filter((e) => !/favicon|fonts\.g|ERR_INTERNET|Failed to load resource/.test(e))
check(real.length === 0, `no console errors${real.length ? ': ' + real.slice(0, 3).join(' | ') : ''}`)
await browser.close()
console.log(failures ? `\n${failures} FAILED` : `\nE2E ${MODE}: PASSED`)
process.exit(failures ? 1 : 0)
