/**
 * Instant-signup tests.
 *
 * `POST /auth/signup` creates a Supabase auth user that is already
 * email-confirmed via the Admin API (`email_confirm: true` — no confirmation
 * email is sent), so demo signups work even while the project still has
 * "Confirm email" enabled or the free-plan email quota is exhausted. The
 * client signs in with the password right after.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createInstantSignup } from '../src/controllers/authController.js'

function makeReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, ...overrides }
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() }
}

describe('createInstantSignup', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a pre-confirmed user via the Admin API and returns 201', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }))

    const res = makeRes()
    await createInstantSignup(
      makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never,
      res as never,
    )

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/auth/v1/admin/users')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.com',
      password: 'password123',
      email_confirm: true,
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('confirms an existing unconfirmed account instead of failing', async () => {
    // 1) create → the email is already registered (unconfirmed from an earlier signup)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error_code: 'user_already_exists',
          msg: 'A user with this email address has already been registered',
        }),
        { status: 422 },
      ),
    )
    // 2) lookup the existing user by email
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ id: 'existing-1' }] }), { status: 200 }))
    // 3) update → mark the email confirmed
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'existing-1' }), { status: 200 }))

    const res = makeRes()
    await createInstantSignup(
      makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never,
      res as never,
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const updateCall = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(updateCall[0]).toContain('/auth/v1/admin/users/existing-1')
    expect(updateCall[1].method).toBe('PUT')
    expect(JSON.parse(updateCall[1].body as string)).toEqual({ email_confirm: true })
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('surfaces an error when the Admin API rejects the signup', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ msg: 'Signup is not allowed for this project' }), { status: 400 }),
    )

    await expect(
      createInstantSignup(makeReq({ body: { email: 'a@b.com', password: 'password123' } }) as never, makeRes() as never),
    ).rejects.toMatchObject({ status: 400, code: 'SIGNUP_FAILED' })
  })
})
