import { Router } from 'express'

import {
  createInstantSignup,
  getPendingRegistration,
  listSessions,
  login,
  logout,
  me,
  refresh,
  register,
  registerSession,
  revokeSession,
  savePendingRegistration,
} from '../controllers/authController.js'
import { authRequired, localVerifyToken } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { validate } from '../middleware/validate.js'
import { logoutSchema, refreshSchema, sessionSchema } from '../validators/auth.js'
import { loginSchema, pendingRegistrationSchema, registerSchema, signupSchema } from '../validators/register.js'

export const authRoutes = Router()

authRoutes.use(authLimiter)

// Instant demo signup — creates a pre-confirmed auth user via the Admin API
// (no confirmation email, no email rate limit), so the client can sign in
// immediately and finish registration. Public (no session yet) but rate-limited.
//
// ⚠️ DEMO-ONLY: anyone can create an email-confirmed account for ANY address
// with a caller-chosen password. Do NOT ship this endpoint to production
// without email verification (see docs/security.md).
authRoutes.post('/signup', validate(signupSchema), createInstantSignup)

// Login — authenticates email/password and returns JWT tokens
authRoutes.post('/login', validate(loginSchema), login)

// Protected by a valid local JWT token (signed with JWT_SECRET).
authRoutes.post('/register', localVerifyToken, validate(registerSchema), register)
authRoutes.get('/me', authRequired, me)

// Registration form saved before email confirmation, so the confirmation-link
// landing can finish the profile from any device (no re-typing). Saved without
// a session (the account isn't confirmed yet); fetched once the user is signed
// in after confirming.
authRoutes.post('/pending-registrations', validate(pendingRegistrationSchema), savePendingRegistration)
authRoutes.get('/pending-registrations/current', authRequired, getPendingRegistration)

// Refresh-token lifecycle (Step 33: access + refresh, secure + revocable).
// The refresh token is the credential for /refresh and /logout, so both work
// even when the access token has expired.
authRoutes.post('/refresh', validate(refreshSchema), refresh)
authRoutes.post('/sessions', authRequired, validate(sessionSchema), registerSession)
authRoutes.get('/sessions', authRequired, listSessions)
authRoutes.delete('/sessions/:id', authRequired, revokeSession)
authRoutes.post('/logout', validate(logoutSchema), logout)
