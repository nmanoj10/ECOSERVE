import { createHmac, randomUUID } from 'node:crypto'

import type { Request, Response } from 'express'

import { env } from '../config/env.js'

/**
 * Returns the upload authentication parameters for a client-side ImageKit
 * upload. The private key never leaves the server: the client gets a short-lived
 * `token`, `expire`, and an HMAC-SHA1 `signature` over `token + expire`, then
 * uploads directly to ImageKit with its public key.
 *
 * Endpoint is auth-protected so strangers can't mint signatures on our account.
 */
export function imagekitAuth(_req: Request, res: Response): void {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY

  if (!privateKey) {
    res.status(503).json({
      configured: false,
      message: 'IMAGEKIT_PRIVATE_KEY is not configured on the server',
    })
    return
  }

  const token = randomUUID()
  const expire = Math.floor(Date.now() / 1000) + 30 * 60 // 30 minutes
  const signature = createHmac('sha1', privateKey).update(`${token}${expire}`).digest('hex')

  res.json({ configured: true, token, expire, signature })
}
