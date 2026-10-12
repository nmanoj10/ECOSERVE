import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, LogIn, Lock, Mail, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { login, getCurrentUser, forgotPassword, googleLogin, setTokens } from '@/services/local-auth'
import { signInWithGoogle } from '@/services/firebase'
import AuthLayout from '@/components/layout/AuthLayout'
import { roleDashboardPath } from '@/utils/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const REMEMBERED_EMAIL_KEY = 'ecoserve.rememberedEmail'

/** Inline Google "G" logo (the 4-color mark that disambiguates the button). */
function GoogleLogo() {
  return (
    <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3C33.7 32.66 29.18 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.85 1.15 7.99 3.02l5.66-5.66C34.46 6.11 29.52 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.32-.13-2.62-.39-3.92z"
      />
      <path
        fill="#FF3D00"
        d="m6.31 14.69 6.58 4.83C14.66 15.46 18.98 12 24 12c3.06 0 5.85 1.15 7.99 3.02l5.66-5.66C34.46 6.11 29.52 4 24 4 16.32 4 9.66 8.34 6.31 14.69z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.16 0 9.86-1.97 13.41-5.17l-6.19-5.24C29.23 35.05 26.69 36 24 36c-5.18 0-9.7-3.34-11.3-8l-6.53 5.03C9.51 39.55 16.25 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3c-.79 2.23-2.22 4.14-4.08 5.55l6.19 5.24C36.85 40.5 44 35.5 44 24c0-1.32-.13-2.62-.39-3.92z"
      />
    </svg>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white py-3 pl-11 pr-3.5 text-base text-neutral-900 sm:text-sm ' +
  'placeholder:text-neutral-400 transition hover:border-neutral-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // "Remember me" persists the email for convenience (sessions are handled by backend JWTs)
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) !== null)

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '', password: '' },
  })

  useEffect(() => {
    // On mount, try to restore session from stored access token
    const token = localStorage.getItem('accessToken')
    if (token) {
      getCurrentUser().then((user) => {
        if (user) {
          const destination = roleDashboardPath[user.role]
          navigate(destination, { replace: true })
        }
      })
    }
  }, [])

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    // Remember email for next visit
    if (remember) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, values.email)
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }

    try {
      const { user, tokens } = await login(values.email, values.password)
      setTokens(tokens)

      // Prefer returning to a protected route the user came from; otherwise go
      // to the dashboard for their role (donor / NGO / volunteer / admin).
      const from = (location.state as { from?: string } | null)?.from
      const destination = from && from !== '/' && from !== '/register' ? from : roleDashboardPath[user.role]
      navigate(destination, { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          (err instanceof Error ? err.message : undefined) ??
          'Login failed',
      )
    }
  }

  const handleForgotPassword = async () => {
    const email = getValues('email').trim()
    setError(null)
    setNotice(null)
    setResetEmailSentTo(null)

    if (!email) {
      setError('Enter your email address first')
      setValue('email', '')
      ;(document.getElementById('email') as HTMLInputElement).focus()
      return
    }

    setSendingReset(true)
    try {
      // Backend issues a 6-digit OTP and emails it; it always responds 200
      // (anti-enumeration), so this resolves even for unregistered addresses.
      await forgotPassword(email)
      setNotice(`We sent a 6-digit reset code to ${email}.`)
      setResetEmailSentTo(email)
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          (err instanceof Error ? err.message : undefined) ??
          'Could not send reset code',
      )
    } finally {
      setSendingReset(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setNotice(null)
    setResetEmailSentTo(null)
    setGoogleSubmitting(true)

    try {
      // Firebase opens the Google popup; the backend swaps the verified ID
      // token for local JWT tokens (no Firebase secret ever touches the client).
      const { idToken, email, name } = await signInWithGoogle()
      const { user, tokens, needsProfile } = await googleLogin(idToken)
      setTokens(tokens)

      if (needsProfile) {
        // Brand-new Google account — finish the profile (role + phone are
        // compulsory) on the registration page, with pre-filled details.
        navigate('/register', { replace: true, state: { googleProfile: { email, fullName: name } } })
        return
      }

      navigate(roleDashboardPath[user.role], { replace: true })
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          (err instanceof Error ? err.message : undefined) ??
          'Google login failed',
      )
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Login to your account"
      subtitle="Your role is detected automatically from your account."
    >
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(22,163,74,0.18)] sm:p-8">
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

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                className="flex items-center gap-1 text-xs font-semibold text-brand-700 transition hover:text-brand-800 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingReset && <Loader2 className="size-3 animate-spin" />}
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`${inputClass} pr-11`}
                placeholder="Enter your password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>}
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 rounded border-neutral-300 accent-brand-600"
            />
            Remember me
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <div
              role="status"
              className="rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-xs font-medium text-brand-800"
            >
              <p>{notice}</p>
              {resetEmailSentTo && (
                <Link
                  to={`/reset-password?email=${encodeURIComponent(resetEmailSentTo)}`}
                  className="mt-1.5 inline-block font-semibold text-brand-700 underline hover:text-brand-800"
                >
                  Enter the code to reset your password →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:from-brand-700 hover:to-emerald-700 hover:shadow-lg hover:shadow-brand-600/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {submitting ? 'Logging in…' : 'Login'}
          </button>

          {/* Trust hint */}
          <p className="flex items-center justify-center gap-1.5 border-t border-neutral-100 pt-4 text-xs text-neutral-400">
            <ShieldCheck className="size-3.5 text-brand-500" aria-hidden="true" />
            Your session is encrypted and stays on this device
          </p>
        </form>

        {/* Google sign-in (Firebase) */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">or continue with</span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleSubmitting || submitting}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleSubmitting ? <Loader2 className="size-4 animate-spin" /> : <GoogleLogo />}
            {googleSubmitting ? 'Connecting to Google…' : 'Continue with Google'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-neutral-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-700 transition hover:text-brand-800 hover:underline">
          Create Account
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
