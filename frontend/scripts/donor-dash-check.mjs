/* Temporary diagnostic — renders the donor dashboard and reports text + errors. Delete after use. */
import { chromium } from 'playwright'

const EMAIL = process.env.DONOR_EMAIL ?? 'donor.dash.1786538978@gmail.com'
const PASSWORD = 'Demopass123!'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const issues = []
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') issues.push(`[console.${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', (err) => issues.push(`[pageerror] ${err.message}`))
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 300)
    } catch {
      body = '(no body)'
    }
    issues.push(`[http ${res.status()}] ${res.url()} :: ${body}`)
  }
})

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  console.log('ON LOGIN?', page.url())

  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')

  await page.waitForTimeout(7000)
  console.log('FINAL URL:', page.url())

  const sessionState = await page.evaluate(() => {
    const keys = Object.keys(localStorage)
    const authKey = keys.find((k) => k.includes('auth-token'))
    let parsed = null
    if (authKey) {
      try {
        const raw = JSON.parse(localStorage.getItem(authKey))
        parsed = { hasAccessToken: Boolean(raw?.access_token), hasRefresh: Boolean(raw?.refresh_token), email: raw?.user?.email ?? null }
      } catch {
        parsed = { parseError: true }
      }
    }
    return { authKey: authKey ?? null, parsed }
  })
  console.log('SESSION STATE:', JSON.stringify(sessionState))

  const text = await page.evaluate(() => document.body.innerText)
  console.log('--- PAGE TEXT (first 2000 chars) ---')
  console.log(text.slice(0, 2000))
  console.log('--- END TEXT ---')
} catch (err) {
  console.log('SCRIPT ERROR:', err.message)
} finally {
  console.log('--- ISSUES ---')
  console.log(issues.length ? issues.join('\n') : '(none)')
  await browser.close()
}
