/**
 * Forgot-email-password controller tests — the OTP hand-off between the
 * password-reset service and the email sender, including the anti-enumeration
 * contract (always `{ ok: true }`) and the console fallback when SMTP fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { forgotPassword } from '../src/controllers/authController.js'
import { sendPasswordResetOtp } from '../src/services/emailService.js'
import { issuePasswordResetOtp, OTP_TTL_MINUTES } from '../src/services/passwordResetService.js'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  session: { create: vi.fn() },
}))

vi.mock('../src/config/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../src/services/passwordResetService.js', () => ({
  issuePasswordResetOtp: vi.fn(),
  consumePasswordResetOtp: vi.fn(),
  OTP_TTL_MINUTES: 10,
}))
vi.mock('../src/services/emailService.js', () => ({
  sendPasswordResetOtp: vi.fn(),
}))

const mockedIssue = vi.mocked(issuePasswordResetOtp)
const mockedSend = vi.mocked(sendPasswordResetOtp)

function makeReq(overrides: Record<string, unknown> = {}) {
  return { body: { email: 'alice@example.com' }, ...overrides }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('forgotPassword', () => {
  it('issues and emails an OTP for an active account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    mockedIssue.mockResolvedValue('123456')

    const res = makeRes()
    await forgotPassword(makeReq() as never, res as never)

    expect(mockedIssue).toHaveBeenCalledWith('u1')
    expect(mockedSend).toHaveBeenCalledWith('alice@example.com', '123456', OTP_TTL_MINUTES)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('still answers ok and falls back to the console when SMTP delivery fails', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    mockedIssue.mockResolvedValue('123456')
    mockedSend.mockRejectedValue(new Error('connect ECONNREFUSED smtp.gmail.com:465'))
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = makeRes()
    await forgotPassword(makeReq() as never, res as never)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[dev] Password-reset OTP for alice@example.com: 123456 (valid for ${OTP_TTL_MINUTES} min)`,
    )
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    consoleWarnSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('never leaks account existence for an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = makeRes()
    await forgotPassword(makeReq({ body: { email: 'nobody@example.com' } }) as never, res as never)

    expect(mockedIssue).not.toHaveBeenCalled()
    expect(mockedSend).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('skips OTP issuance for a non-active account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })

    const res = makeRes()
    await forgotPassword(makeReq({ body: { email: 'suspended@example.com' } }) as never, res as never)

    expect(mockedIssue).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })
})