import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import AuthLayout from '@/components/layout/AuthLayout'
import { forgotPassword, resetPassword } from '@/services/local-auth'

const resetSchema = z
  .object({
    email: z.string().email('Enter a valid email'),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetValues = z.infer<typeof resetSchema>

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white py-3 pl-11 pr-3.5 text-base text-neutral-900 sm:text-sm ' +
  'placeholder:text-neutral-400 transition hover:border-neutral-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

const RESEND_COOLDOWN_SECONDS = 30

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [success, setSuccess] = useState(false)
  // "Resend code" cooldown so the button can't be hammered on the SMTP backend.
  const [resendLeft, setResendLeft] = useState(0)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: searchParams.get('email') ?? '', code: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (values: ResetValues) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      await resetPassword(values.email.trim(), values.code.trim(), values.newPassword)
      setSuccess(true)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          (err instanceof Error ? err.message : undefined) ??
          'Could not reset password',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    const email = getValues('email').trim()
    setError(null)

    if (!email) {
      setError('Enter your email address first')
      return
    }

    setResending(true)
    try {
      await forgotPassword(email)
      setNotice(`We sent a new 6-digit code to ${email}.`)
      setResendLeft(RESEND_COOLDOWN_SECONDS)
      const timer = window.setInterval(() => {
        setResendLeft((left) => {
          if (left <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return left - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the 6-digit code we emailed you, then choose a new password."
    >
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(22,163,74,0.18)] sm:p-8">
        {success ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-brand-600" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Password updated</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Your password has been changed and all existing sessions were signed out.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:from-brand-700 hover:to-emerald-700 hover:shadow-lg hover:shadow-brand-600/25"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                  placeholder="Enter your email"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>}
            </div>

            {/* OTP code */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="code" className="block text-sm font-medium text-neutral-700">
                  Reset code
                </label>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendLeft > 0}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-700 transition hover:text-brand-800 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resending ? <Loader2 className="size-3 animate-spin" /> : null}
                  {resendLeft > 0 ? `Resend code (${resendLeft}s)` : 'Resend code'}
                </button>
              </div>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={`${inputClass} font-mono tracking-[0.3em]`}
                  placeholder="000000"
                  {...register('code')}
                />
              </div>
              {errors.code && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.code.message}</p>}
            </div>

            {/* New password */}
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
                New password
              </label>
              <div className="relative">
                <ShieldCheck
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="At least 8 characters"
                  {...register('newPassword')}
                />
              </div>
              {errors.newPassword && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm new password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Confirm new password
              </label>
              <div className="relative">
                <ShieldCheck
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="Repeat the new password"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs font-medium text-brand-800">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:from-brand-700 hover:to-emerald-700 hover:shadow-lg hover:shadow-brand-600/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-neutral-600">
        Remembered your password?{' '}
        <Link to="/login" className="font-semibold text-brand-700 transition hover:text-brand-800 hover:underline">
          Back to login
        </Link>
      </p>

      <Link
        to="/"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" />
        Back to home
      </Link>
    </AuthLayout>
  )
}