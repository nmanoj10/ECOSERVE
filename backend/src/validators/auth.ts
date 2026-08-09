import { z } from 'zod'

const refreshTokenSchema = z.string().trim().min(10, 'refreshToken is required')

export const refreshSchema = z.object({ refreshToken: refreshTokenSchema })

export const sessionSchema = z.object({ refreshToken: refreshTokenSchema })

export const logoutSchema = z.object({ refreshToken: refreshTokenSchema })

export type RefreshBody = z.infer<typeof refreshSchema>
export type LogoutBody = z.infer<typeof logoutSchema>
