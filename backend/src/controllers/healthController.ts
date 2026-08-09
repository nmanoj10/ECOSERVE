import type { Request, Response } from 'express'

export function healthController(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    service: 'ecoserve-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
}
