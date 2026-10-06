import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

import { env } from './env.js'
import { PrismaClient } from '../generated/prisma/client.js'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Supabase's pooler presents its own CA, so pg's sslmode=require (treated as
// verify-full) would fail the TLS handshake. Strip sslmode from the URL and
// connect with cert verification disabled. (Dev convenience.)
const poolConnectionString = env.DATABASE_URL.replace(/([?&])sslmode=[^&#]*/i, '$1').replace(/[?&]$/, '')

const pool = new pg.Pool({
  connectionString: poolConnectionString,
  ssl: false,
})
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
