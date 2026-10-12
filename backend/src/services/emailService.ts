import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'

import { env } from '../config/env.js'

let transporter: Transporter | null = null

/** True when SMTP credentials are configured (real email delivery possible). */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}

/** Lazily-built nodemailer transport. Null when SMTP is not configured. */
function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null

  if (!transporter) {
    transporter = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // implicit TLS only on the SMTPS port
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

/**
 * Sends the forgot-password OTP to the given address.
 *
 * When SMTP is not configured (dev/test), the code is printed to the server
 * console instead of emailed — the endpoint still behaves end-to-end so the
 * flow is testable without a mail server.
 *
 * Returns `true` when the email was handed to an SMTP server, `false` when it
 * was logged to the console instead.
 */
export async function sendPasswordResetOtp(email: string, code: string, expiresInMinutes: number): Promise<boolean> {
  const t = getTransporter()

  if (!t) {
    console.log(`[dev] Password-reset OTP for ${email}: ${code} (valid for ${expiresInMinutes} min)`)
    return false
  }

  await t.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Your EcoServe password reset code',
    text: [
      'Hello,',
      '',
      `We received a request to reset your EcoServe password.`,
      ``,
      `Your one-time reset code is: ${code}`,
      ``,
      `It expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
      ``,
      `— The EcoServe team`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #15803d; margin: 0 0 16px;">EcoServe password reset</h2>
        <p>We received a request to reset your EcoServe password.</p>
        <p style="margin: 24px 0;">
          <span style="display: inline-block; background: #f0fdf4; border: 1px dashed #15803d; border-radius: 8px;
                       padding: 12px 20px; font-size: 24px; letter-spacing: 6px; color: #166534; font-weight: bold;">
            ${code}
          </span>
        </p>
        <p>This code expires in <strong>${expiresInMinutes} minutes</strong>. If you didn't request it, you can safely ignore this email.</p>
        <p style="color: #737373; font-size: 13px; margin-top: 32px;">— The EcoServe team</p>
      </div>
    `,
  })

  return true
}