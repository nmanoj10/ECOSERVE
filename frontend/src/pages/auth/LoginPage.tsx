import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import AuthLayout from '@/components/layout/AuthLayout'
import { fetchMe } from '@/api/auth'
import { supabase } from '@/services/supabase'
import { roleDashboardPath } from '@/utils/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true)
    setError(null)

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
      // to the dashboard for their role (donor / NGO / volunteer).
      const destination = from && from !== '/' && from !== '/register' ? from : roleDashboardPath[user.role]
      navigate(destination, { replace: true })
    } catch (err) {
      setSubmitting(false)
      const status = (err as { response?: { status?: number } }).response?.status
      // Signed in, but the platform user row doesn't exist yet — finish registration.
      navigate(status === 401 ? '/register' : (from ?? '/'), { replace: true })
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your Ecoserve account"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`${inputClass} pr-11`}
              placeholder="••••••••"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <LogIn className="size-4" />
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        New to Ecoserve?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
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
