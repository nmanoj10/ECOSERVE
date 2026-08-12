/* Temporary diagnostic — current DB state. Delete after use. */
import pg from 'pg'

import { env } from '../src/config/env.js'

console.log('RESULT db host:', new URL(env.DATABASE_URL).hostname)

const poolConnectionString = env.DATABASE_URL.replace(/([?&])sslmode=[^&#]*/i, '$1').replace(/[?&]$/, '')
const pool = new pg.Pool({ connectionString: poolConnectionString, ssl: { rejectUnauthorized: false } })

try {
  const t = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
  console.log('RESULT tables:', t.rows.map((x) => x.tablename).join(', '))
  const m = await pool.query(`SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY started_at`)
  console.log('RESULT migrations recorded:', m.rows.length)
  for (const row of m.rows) console.log('RESULT   migration:', row.migration_name, '| applied:', row.applied)
  const u = await pool.query(`SELECT count(*) AS n FROM users`)
  console.log('RESULT users count:', u.rows[0].n)
} catch (e) {
  console.log('RESULT ERROR:', (e as Error).message)
} finally {
  await pool.end().catch(() => {})
}
