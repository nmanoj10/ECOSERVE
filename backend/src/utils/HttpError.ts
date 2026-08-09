/**
 * Error carrying an HTTP status and a stable machine-readable code.
 * Matches the `{ error: { code, message } }` contract from docs/api-design.md.
 */
export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}
