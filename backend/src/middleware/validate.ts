import type { NextFunction, Request, Response } from 'express'
import type { z } from 'zod'

import { HttpError } from '../utils/HttpError.js'

/** Validates req.body against a zod schema and replaces it with the parsed data. */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      next(
        new HttpError(400, 'VALIDATION_ERROR', JSON.stringify(result.error.flatten().fieldErrors)),
      )
      return
    }

    req.body = result.data
    next()
  }
}
