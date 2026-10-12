/**
 * Password-reset OTP unit tests (forgot-password flow).
 *
 * Covers the code generator/hasher and the issue/consume lifecycle: per-code
 * guess budget, per-hour send cap, expiry, single-use semantics, and the fact
 * that only hashes ever touch the database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

import {
  consumePasswordResetOtp,
  generateOtpCode,
  hashOtpCode,
  issuePasswordResetOtp,
  MAX_OTP_CODES_PER_HOUR,
} from '../src/services/passwordResetService.js'
import { env } from '../src/config/env.js'

const prismaMock = vi.hoisted(() => ({
  passwordReset: { deleteMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))

// The hoisted mock doubles as the assertion handle (keeps full vi.fn() types).
const mockedPrisma = prismaMock

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateOtpCode', () => {
  it('always produces a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/)
    }
  })

  it('produces varied codes (not a constant)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('hashOtpCode', () => {
  it('is deterministic and 64 hex chars, differing between codes', () => {
    const a = hashOtpCode('123456')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(hashOtpCode('123456')).toBe(a)
    expect(hashOtpCode('654321')).not.toBe(a)
  })

  it('is peppered with JWT_SECRET (a plain sha256 of the code differs)', () => {
    expect(hashOtpCode('123456')).not.toBe(createHash('sha256').update('123456').digest('hex'))
    expect(env.JWT_SECRET.length).toBeGreaterThan(0)
  })
})

describe('issuePasswordResetOtp', () => {
  it('prunes used/expired codes, creates a fresh hashed row, and returns the raw code', async () => {
    mockedPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 2 } as never)
    mockedPrisma.passwordReset.count.mockResolvedValue(0 as never)
    mockedPrisma.passwordReset.create.mockResolvedValue({ id: 'pr1' } as never)

    const code = await issuePasswordResetOtp('u1')

    expect(mockedPrisma.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', OR: [{ usedAt: { not: null } }, { expiresAt: { lt: expect.any(Date) } }] },
    })
    const createArgs = mockedPrisma.passwordReset.create.mock.calls[0]?.[0]
    expect(createArgs?.data?.userId).toBe('u1')
    // Never the raw code — only the hash hits the database.
    expect(createArgs?.data?.codeHash).toMatch(/^[0-9a-f]{64}$/)
    expect(createArgs?.data?.codeHash).not.toBe(code)
    expect(createArgs?.data?.expiresAt).toBeInstanceOf(Date)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('returns null (silent throttle) once the hourly cap is reached', async () => {
    mockedPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 } as never)
    mockedPrisma.passwordReset.count.mockResolvedValue(MAX_OTP_CODES_PER_HOUR as never)

    await expect(issuePasswordResetOtp('u1')).resolves.toBeNull()
    expect(mockedPrisma.passwordReset.create).not.toHaveBeenCalled()
  })
})

describe('consumePasswordResetOtp', () => {
  it('rejects when no unused, unexpired code exists', async () => {
    mockedPrisma.passwordReset.findFirst.mockResolvedValue(null)

    await expect(consumePasswordResetOtp('u1', '123456')).resolves.toBe(false)
    expect(mockedPrisma.passwordReset.update).not.toHaveBeenCalled()
  })

  it('accepts the correct code, consuming it as single-use', async () => {
    mockedPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr1',
      codeHash: hashOtpCode('123456'),
      attempts: 0,
    } as never)

    await expect(consumePasswordResetOtp('u1', '123456')).resolves.toBe(true)
    expect(mockedPrisma.passwordReset.update).toHaveBeenCalledWith({
      where: { id: 'pr1' },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('rejects a wrong code and increments the attempt counter', async () => {
    mockedPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr1',
      codeHash: hashOtpCode('123456'),
      attempts: 1,
    } as never)

    await expect(consumePasswordResetOtp('u1', '000000')).resolves.toBe(false)
    expect(mockedPrisma.passwordReset.update).toHaveBeenCalledWith({
      where: { id: 'pr1' },
      data: { attempts: 2 },
    })
  })

  it('destroys the code once the guess budget is exhausted', async () => {
    mockedPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr1',
      codeHash: hashOtpCode('123456'),
      attempts: 4, // one more wrong guess hits the MAX_OTP_ATTEMPTS budget
    } as never)

    await expect(consumePasswordResetOtp('u1', '000000')).resolves.toBe(false)
    expect(mockedPrisma.passwordReset.delete).toHaveBeenCalledWith({ where: { id: 'pr1' } })
    expect(mockedPrisma.passwordReset.update).not.toHaveBeenCalled()
  })
})