import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Bike, Eye, EyeOff, HandHeart, Store } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import AuthLayout from '@/components/layout/AuthLayout'
import { registerUser } from '@/api/auth'
import { registerFormSchema, type RegisterFormValues } from '@/schemas/register'
import { supabase } from '@/services/supabase'
import { roleDashboardPath } from '@/utils/auth'

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

const roles = [
  {
    value: 'DONOR',
    label: 'Donor',
    icon: Store,
    description: 'Restaurant, grocery, or caterer with surplus food.',
  },
  {
    value: 'NGO',
    label: 'NGO',
    icon: HandHeart,
    description: 'Verified organization serving communities.',
  },
  {
    value: 'VOLUNTEER',
    label: 'Volunteer',
    icon: Bike,
    description: 'Deliver rescued food across your city.',
  },
] as const

export default function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    shouldUnregister: true,
    defaultValues: { role: 'DONOR', email: '', password: '', confirmPassword: '', fullName: '', phone: '' },
  })

  const role = watch('role')

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true)
    setError(null)
    setNotice(null)

    // If the user already has a session (e.g. they confirmed their email and were
    // redirected here from login), skip signUp and finish registration directly.
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })

      if (signUpError) {
        setSubmitting(false)
        setError(signUpError.message)
        return
      }

      if (!data.session) {
        setSubmitting(false)
        setNotice(
          `We sent a confirmation link to ${values.email}. Confirm it, then log in — we'll finish setting up your ${values.role.toLowerCase()} profile.`,
        )
        return
      }
    }

    const payload = {
      fullName: values.fullName,
      role: values.role,
      phone: values.phone || undefined,
      ...(values.role === 'DONOR' ? { donor: values.donor } : {}),
      ...(values.role === 'NGO' ? { ngo: values.ngo } : {}),
      ...(values.role === 'VOLUNTEER' ? { volunteer: values.volunteer } : {}),
    }

    // We have a session (fresh or existing) — create the platform user + profile.
    try {
      await registerUser(payload)
      setSubmitting(false)
      navigate(roleDashboardPath[values.role], { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Registration failed',
      )
    }
  }

  return (
    <AuthLayout
      title="Join Ecoserve"
      subtitle="Create your account as a donor, NGO, or volunteer"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        {/* Registering as */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">Registering as</span>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => {
              const selected = role === r.value
              return (
                <label
                  key={r.value}
                  className={`cursor-pointer rounded-xl border p-3 text-center transition ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <input type="radio" value={r.value} className="sr-only" {...register('role')} />
                  <span
                    className={`mx-auto flex size-9 items-center justify-center rounded-lg transition ${
                      selected ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <r.icon className="size-4.5" />
                  </span>
                  <span className={`mt-2 block text-xs font-semibold ${selected ? 'text-brand-800' : 'text-neutral-700'}`}>
                    {r.label}
                  </span>
                  <span className="mt-0.5 hidden text-[10px] leading-tight text-neutral-500 sm:block">
                    {r.description}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Full name
          </label>
          <input id="fullName" autoComplete="name" className={inputClass} placeholder="Your name" {...register('fullName')} />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input id="email" type="email" autoComplete="email" className={inputClass} placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Phone (optional)
            </label>
            <input id="phone" type="tel" autoComplete="tel" className={inputClass} placeholder="+91 …" {...register('phone')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${inputClass} pr-11`}
                placeholder="At least 8 characters"
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

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${inputClass} pr-11`}
                placeholder="Repeat your password"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                {showConfirm ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        {role === 'DONOR' && (
          <div className="space-y-4 rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Donor organization</p>
            <Field label="Organization name" error={errors.donor?.organizationName?.message}>
              <input className={inputClass} placeholder="Green Kitchen" {...register('donor.organizationName')} />
            </Field>
            <Field label="Organization type" error={errors.donor?.organizationType?.message}>
              <input className={inputClass} placeholder="Restaurant / Grocery / Caterer…" {...register('donor.organizationType')} />
            </Field>
            <Field label="Address" error={errors.donor?.address?.message}>
              <input className={inputClass} placeholder="Street address" {...register('donor.address')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" error={errors.donor?.city?.message}>
                <input className={inputClass} placeholder="Mumbai" {...register('donor.city')} />
              </Field>
              <Field label="State" error={errors.donor?.state?.message}>
                <input className={inputClass} placeholder="Maharashtra" {...register('donor.state')} />
              </Field>
            </div>
          </div>
        )}

        {role === 'NGO' && (
          <div className="space-y-4 rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">NGO details</p>
            <Field label="NGO name" error={errors.ngo?.ngoName?.message}>
              <input className={inputClass} placeholder="Food Bank Foundation" {...register('ngo.ngoName')} />
            </Field>
            <Field label="Registration number" error={errors.ngo?.registrationNumber?.message}>
              <input className={inputClass} placeholder="Reg. no." {...register('ngo.registrationNumber')} />
            </Field>
            <Field label="Address" error={errors.ngo?.address?.message}>
              <input className={inputClass} placeholder="Street address" {...register('ngo.address')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" error={errors.ngo?.city?.message}>
                <input className={inputClass} placeholder="Mumbai" {...register('ngo.city')} />
              </Field>
              <Field label="State" error={errors.ngo?.state?.message}>
                <input className={inputClass} placeholder="Maharashtra" {...register('ngo.state')} />
              </Field>
            </div>
            <Field label="Description (optional)">
              <textarea className={inputClass} rows={2} placeholder="What your NGO does" {...register('ngo.description')} />
            </Field>
          </div>
        )}

        {role === 'VOLUNTEER' && (
          <div className="space-y-4 rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Delivery details (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vehicle type">
                <input className={inputClass} placeholder="Bike / Car" {...register('volunteer.vehicleType')} />
              </Field>
              <Field label="Vehicle number">
                <input className={inputClass} placeholder="MH 01 AB 1234" {...register('volunteer.vehicleNumber')} />
              </Field>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800" role="status">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
