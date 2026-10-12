import { z } from 'zod'

const refreshTokenSchema = z.string().trim().min(10, 'refreshToken is required')

export const refreshSchema = z.object({ refreshToken: refreshTokenSchema })

export const sessionSchema = z.object({ refreshToken: refreshTokenSchema })

export const logoutSchema = z.object({ refreshToken: refreshTokenSchema })

export type RefreshBody = z.infer<typeof refreshSchema>
export type LogoutBody = z.infer<typeof logoutSchema>

/**
 * Forgot-password — just an email. Always responds 200 whether or not the
 * address exists (anti-enumeration); expectant behavior lives in the handler.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>

/**
 * Reset-password — email + the 6-digit OTP sent to it + the new password.
 * Password rules mirror signup so the frontend schema and this stay in sync.
 */
export const resetPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: z.string().min(8, 'At least 8 characters'),
})

export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>

/**
 * Google sign-in — the client exchanges its Firebase ID token for local JWT
 * tokens via `POST /auth/google`. The token is verified server-side against
 * Google's public keys; the client never needs a Firebase secret.
 */
export const googleAuthSchema = z.object({
  idToken: z.string().trim().min(20, 'idToken is required'),
})

export type GoogleAuthBody = z.infer<typeof googleAuthSchema>
