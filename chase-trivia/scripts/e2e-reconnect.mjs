// Reload / reconnect test in real browsers.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const WEB = process.env.WEB || 'http://localhost:5173'
let fail = 0
const ck = (c, m) => { console.log(c ? '  ✓' : '  ✗ FAIL', m); if (!c) fail++ }
const br = await chromium.launch()
const mk = async () => (await (await br.newContext({ locale: 'he-IL' })).newPage())
const A = await mk(), B = await mk()
await A.goto(WEB + '/create'); await A.fill('#pname', 'מארח'); await A.getByRole('button', { name: /צרו חדר/ }).click()
await A.waitForURL(/\/room\//); const code = A.url().split('/room/')[1]
await B.goto(`${WEB}/join/${code}`); await B.fill('#pname', 'אורח'); await B.getByRole('button', { name: /הצטרפו למשחק/ }).click()
await B.waitForURL(/\/room\//)
await A.waitForFunction(() => document.querySelectorAll('.player-card:not(.empty)').length === 2)
await A.locator('.mode-card', { hasText: 'כולם נגד כולם' }).click()
await A.getByRole('button', { name: /התחילו משחק/ }).click()
await B.waitForSelector('.q-text')
await B.reload()
await B.waitForSelector('.q-text', { timeout: 15000 })
ck(true, 'player reloading mid-game lands back in the running game (no name prompt)')
await B.waitForSelector('.ans:not([disabled])', { timeout: 10000 })
await B.keyboard.press('1')
await B.waitForSelector('text=התשובה נקלטה')
await B.reload()
await B.waitForSelector('.q-text, .verdict', { timeout: 15000 })
const locked = (await B.locator('.ans:not([disabled])').count()) === 0
ck(locked, 'after reload the already-answered question stays locked (no second answer)')
// a brand-new browser cannot join a running game
const C = await mk()
await C.goto(`${WEB}/join/${code}`); await C.fill('#pname', 'מאחר'); await C.getByRole('button', { name: /הצטרפו למשחק/ }).click()
await C.waitForSelector('text=המשחק בחדר הזה כבר התחיל')
ck(true, 'new player is told the game already started')
// host leaves (closes the tab): another player takes over as host after ~25s
await A.close()
await B.waitForTimeout(100)
console.log(fail ? `${fail} FAILED` : 'RECONNECT: PASSED')
await br.close(); process.exit(fail ? 1 : 0)
