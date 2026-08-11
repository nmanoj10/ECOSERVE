import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Leaf, Loader2, Lock, LogIn, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { fetchMe } from '@/api/auth'
import { supabase } from '@/services/supabase'
import { roleDashboardPath } from '@/utils/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const REMEMBERED_EMAIL_KEY = 'ecoserve.rememberedEmail'
/** Carries the protected route a user was on across the Google OAuth round trip. */
const OAUTH_FROM_KEY = 'ecoserve.oauthFrom'

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-11 pr-3.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 transition focus:border-[#0e5e23] focus:outline-none focus:ring-4 focus:ring-[#0e5e23]/10'

/** The multi-color Google "G" mark. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // "Remember me" persists the email for convenience (sessions are already
  // persisted by Supabase), and pre-fills it on the next visit.
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

  /**
   * OAuth round trip: after Google redirects back here with a session, resolve
   * the platform user and continue to their dashboard. New accounts (no role
   * profile yet) finish registration on /register — the role there is bound to
   * the Google account, so it is picked up automatically on later logins.
   */
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return

      setSubmitting(true)
      try {
        const { user } = await fetchMe()
        const from = sessionStorage.getItem(OAUTH_FROM_KEY) ?? (location.state as { from?: string } | null)?.from
        sessionStorage.removeItem(OAUTH_FROM_KEY)
        if (active) {
          const destination = from && from !== '/' && from !== '/register' ? from : roleDashboardPath[user.role]
          navigate(destination, { replace: true })
        }
      } catch (err) {
        sessionStorage.removeItem(OAUTH_FROM_KEY)
        if (active) {
          const status = (err as { response?: { status?: number } }).response?.status
          navigate(status === 401 ? '/register' : '/', { replace: true })
        }
      } finally {
        if (active) setSubmitting(false)
      }
    })

    return () => {
      active = false
    }
    // Run once on mount — location.state is only read for the OAuth return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    // An email login means any pending OAuth "from" is stale.
    sessionStorage.removeItem(OAUTH_FROM_KEY)

    if (remember) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, values.email)
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }

    const { error: signInError } = await supabase.auth.signInWithPassword(values)
    if (signInError) {
      setSubmitting(false)
      setError(signInError.message)
      return
    }

    const from = (location.state as { from?: string } | null)?.from

    try {
      const { user } = await fetchMe()
      setSubmitting(false)
      // Prefer returning to a protected route the user came from; otherwise go
      // to the dashboard for their role (donor / NGO / volunteer / admin).
      const destination = from && from !== '/' && from !== '/register' ? from : roleDashboardPath[user.role]
      navigate(destination, { replace: true })
    } catch (err) {
      setSubmitting(false)
      const status = (err as { response?: { status?: number } }).response?.status
      // Signed in, but the platform user row doesn't exist yet — finish registration.
      navigate(status === 401 ? '/register' : (from ?? '/'), { replace: true })
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setNotice(null)
    setGoogleSubmitting(true)

    const from = (location.state as { from?: string } | null)?.from
    if (from) {
      sessionStorage.setItem(OAUTH_FROM_KEY, from)
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    })
    setGoogleSubmitting(false)
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  const handleForgotPassword = async () => {
    const email = getValues('email').trim()
    setError(null)
    setNotice(null)

    if (!email) {
      setError('Enter your email address first')
      setValue('email', '')
      document.getElementById('email')?.focus()
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setNotice(`We sent a password reset link to ${email}.`)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f2f8ef]">
      {/* ── Brand panel (desktop) ── */}
      <aside className="relative hidden w-[55%] flex-col overflow-hidden lg:flex">
        <Link to="/" className="z-10 inline-flex w-fit items-center gap-2.5 px-12 pt-10" aria-label="Ecoserve home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#0e5e23] text-white shadow-sm shadow-[#0e5e23]/30">
            <Leaf className="size-5" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-[#0e5e23]">ECOSERVE</span>
        </Link>

        <div className="flex min-h-0 flex-1 items-center justify-center px-10 pb-6 pt-2">
          <img
            src="/login.webp"
            alt="Ecoserve volunteers packing rescued produce into the delivery van"
            draggable={false}
            className="max-h-full w-auto max-w-full select-none object-contain"
          />
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Ecoserve home">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#0e5e23] text-white shadow-sm shadow-[#0e5e23]/30">
                <Leaf className="size-5" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-[#0e5e23]">ECOSERVE</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-neutral-100 bg-white px-7 py-9 shadow-[0_24px_60px_-24px_rgba(14,94,35,0.25)] sm:px-10">
            {/* Card header */}
            <div className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#0e5e23] text-white shadow-lg shadow-[#0e5e23]/25">
                <Leaf className="size-6" />
              </span>
              <span className="mt-3 text-lg font-extrabold tracking-tight text-[#0e5e23]">ECOSERVE</span>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">Login to your account</h1>
              <p className="mt-1.5 text-sm text-neutral-500">Your role is detected automatically from your account.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
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
                {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Password
                </label>
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
                {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>}
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-neutral-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border-neutral-300 accent-[#0e5e23]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-[#0e5e23] transition hover:text-[#0a4a1c] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-lg bg-[#e6f4ea] px-3 py-2.5 text-xs text-[#0e5e23]">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e5e23] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#0e5e23]/30 transition hover:bg-[#0a4a1c] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {submitting ? 'Logging in…' : 'Login'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-neutral-200" />
              <span className="text-xs font-medium text-neutral-400">or continue with</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleSubmitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-60"
            >
              {googleSubmitting ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            {/* Footer */}
            <p className="mt-7 text-center text-sm text-neutral-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-[#0e5e23] transition hover:text-[#0a4a1c] hover:underline"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
