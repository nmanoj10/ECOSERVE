/* Temporary diagnostic — replicate browser login flow and compare token sub to DB. Delete after use. */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => envRaw.split('\n').find((l) => l.startsWith(`${k}=`))?.split('=').slice(1).join('=').trim()

const SUPABASE_URL_VALUE = get('VITE_SUPABASE_URL')
const KEY = get('VITE_SUPABASE_PUBLISHABLE_KEY')
const EMAIL = 'donor.dash.1786538978@gmail.com'
const PASSWORD = 'Demopass123!'

const supabase = createClient(SUPABASE_URL_VALUE, KEY)
const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (error) {
  console.log('SIGN IN ERROR:', error.message)
  process.exit(1)
}
console.log('signed in as:', data.user?.email, '| sub:', data.user?.id)

// Decode the access token's payload to see the sub claim the backend will see
const token = data.session?.access_token
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
console.log('token sub claim:', payload.sub)

// Hit the local backend exactly like the browser does
const res = await fetch('http://localhost:3001/api/v1/auth/me', {
  headers: { Authorization: `Bearer ${token}` },
})
console.log('/auth/me status:', res.status)
console.log('/auth/me body:', (await res.text()).slice(0, 400))
