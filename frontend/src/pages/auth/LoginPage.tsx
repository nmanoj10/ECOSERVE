import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { login, getCurrentUser, setTokens } from '@/services/local-auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { roleDashboardPath } from '@/utils/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const REMEMBERED_EMAIL_KEY = 'ecoserve.rememberedEmail'

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-11 pr-3.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

    if (!email) {
      setError('Enter your email address first')
      setValue('email', '')
      ;(document.getElementById('email') as HTMLInputElement).focus()
      return
    }

    // TODO: Implement local password reset endpoint when available
    setNotice(`We sent a password reset link to ${email}.`)
  }

  return (
    <AuthLayout
      title="Login to your account"
      subtitle="Your role is detected automatically from your account."
    >
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_40px_-24px_rgba(0,0,0,0.12)] backdrop-blur sm:p-7">
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
                className="size-4 rounded border-neutral-300 accent-brand-600"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-semibold text-brand-700 transition hover:text-brand-800 hover:underline"
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
            <p role="status" className="rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>
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