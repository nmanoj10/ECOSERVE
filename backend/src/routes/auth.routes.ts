import { Router } from 'express'

import {
  getPendingRegistration,
  listSessions,
  logout,
  me,
  refresh,
  register,
  registerSession,
  revokeSession,
  savePendingRegistration,
} from '../controllers/authController.js'
import { authRequired, verifyToken } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { validate } from '../middleware/validate.js'
import { logoutSchema, refreshSchema, sessionSchema } from '../validators/auth.js'
import { pendingRegistrationSchema, registerSchema } from '../validators/register.js'

export const authRoutes = Router()

authRoutes.use(authLimiter)

// Protected by a valid Supabase token (the token IS the proof of identity).
authRoutes.post('/register', verifyToken, validate(registerSchema), register)
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
