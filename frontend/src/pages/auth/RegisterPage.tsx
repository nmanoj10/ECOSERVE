import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Store, HandHeart, Bike, ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import AuthLayout from '@/components/layout/AuthLayout'

import { signup, getCurrentUser, setTokens, getAccessToken } from '@/services/local-auth'
import { roleDashboardPath } from '@/utils/auth'
import {
  registerUser,
  getPendingRegistration,
  type RegisterPayload,
} from '@/api/auth'

/** Zod schema for the registration form. */
const registerFormSchema = z.object({
  role: z.enum(['DONOR', 'NGO', 'VOLUNTEER']),
  fullName: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm your password'),
  donor: z
    .object({
      organizationName: z.string().min(2, 'Enter organization name'),
      organizationType: z.string().min(2, 'Enter organization type'),
      address: z.string().min(5, 'Enter address'),
      city: z.string().min(2, 'Enter city'),
      state: z.string().min(2, 'Enter state'),
    })
    .optional(),
  ngo: z
    .object({
      ngoName: z.string().min(2, 'Enter NGO name'),
      registrationNumber: z.string().min(2, 'Enter registration number'),
      address: z.string().min(5, 'Enter address'),
      city: z.string().min(2, 'Enter city'),
      state: z.string().min(2, 'Enter state'),
      description: z.string().optional(),
    })
    .optional(),
  volunteer: z
    .object({
      vehicleType: z.string().optional(),
      vehicleNumber: z.string().optional(),
    })
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/** Type inferred from the registration schema. */
type RegisterFormValues = z.infer<typeof registerFormSchema>

/**
 * Holds the form values across the email-confirmation round trip. The
 * confirmation link returns to /register, where the session is picked up and
 * the platform user is created automatically — no re-typing.
 */
const PENDING_REGISTRATION_KEY = 'ecoserve.pendingRegistration'

function buildPayload(values: RegisterFormValues): RegisterPayload {
  return {
    fullName: values.fullName,
    role: values.role,
    phone: values.phone || undefined,
    ...(values.role === 'DONOR' ? { donor: values.donor } : {}),
    ...(values.role === 'NGO' ? { ngo: values.ngo } : {}),
    ...(values.role === 'VOLUNTEER' ? { volunteer: values.volunteer } : {}),
  }
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 sm:text-sm ' +
  'placeholder:text-neutral-400 transition hover:border-neutral-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

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

  /** Email-confirmation round trip: the user clicks the link, returns to /register,
   * and we finish creating their platform user + role profile automatically using
   * the form they filled in. The form is kept in localStorage (same browser) AND
   * on the server (any browser/device), so no matter where the confirmation link is
   * opened the user lands straight on their role dashboard without re-typing anything.
   */
  useEffect(() => {
    let active = true
    let done = false

    const finishRegistration = async (payload: RegisterPayload): Promise<void> => {
      if (done) return
      done = true
      localStorage.removeItem(PENDING_REGISTRATION_KEY)
      setSubmitting(true)
      try {
        await registerUser(payload)
        if (active) navigate(roleDashboardPath[payload.role], { replace: true })
      } catch (err) {
        done = false
        if (active) {
          setSubmitting(false)
          setError(
            (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Registration failed'
          )
        }
      }
    }

    const tryFinish = async (): Promise<void> => {
      if (done) return

      // 1) Same-browser round trip — the form saved to localStorage at signup.
      const pending = localStorage.getItem(PENDING_REGISTRATION_KEY)
      if (pending) {
        try {
          const local = JSON.parse(pending) as { email: string; payload: RegisterPayload }
          if (active && !done) {
            await finishRegistration(local.payload)
          }
          return
        } catch {
          localStorage.removeItem(PENDING_REGISTRATION_KEY)
        }
      }

      // 2) Cross-device round trip — the link may have been opened in a
      //    different browser where localStorage is empty. Pull the form the
      //    server saved at signup instead. Skip the call when there's no
      //    session yet (first visit to /register) — it would just 401.
      const saved = getAccessToken() ? await getPendingRegistration() : null
      if (!active || done) return
      if (saved) {
        await finishRegistration(saved.payload)
      }
    }

    void tryFinish()

    // Run once on mount — the confirmation link always lands here fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitting(true)
    setError(null)

    // Check if there's an existing session (e.g. they were redirected here from login).
    // Skip the network call when no token is stored — during a fresh signup
    // there is nothing to restore and the request would only 401.
    const existingUser = getAccessToken() ? await getCurrentUser() : null
    if (existingUser) {
      // Already logged in — just finish profile registration
      try {
        await registerUser(buildPayload(values))
        localStorage.removeItem(PENDING_REGISTRATION_KEY)
        setSubmitting(false)
        navigate(roleDashboardPath[values.role], { replace: true })
      } catch (err) {
        setSubmitting(false)
        setError(
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Registration failed'
        )
      }
      return
    }

    // Create the account pre-confirmed via the backend.
    // No email is ever sent, so signup is instant and the free-plan email quota is never touched.
    // `signup()` auto-signs-in with the caller-chosen password and returns a
    // token pair — store it so the POST /auth/register below is authenticated.
    try {
      const { tokens } = await signup(values.email, values.password)
      setTokens(tokens)
    } catch (err) {
      setSubmitting(false)
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          (err instanceof Error ? err.message : undefined) ??
          'Could not create account',
      )
      return
    }

    // We have a session (just created) — create the platform user + profile.
    try {
      await registerUser(buildPayload(values))
      localStorage.removeItem(PENDING_REGISTRATION_KEY)
      setSubmitting(false)
      navigate(roleDashboardPath[values.role], { replace: true })
    } catch (err) {
      setSubmitting(false)
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Registration failed'
      )
    }
  }

  return (
    <AuthLayout
      title="Join Ecoserve"
      subtitle="Create your account as a donor, NGO, or volunteer"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(22,163,74,0.18)] sm:p-7"
      >
        {/* Registering as — role tabs */}
        <div>
          <span className="mb-2 block text-sm font-medium text-neutral-700">Registering as</span>
          <div className="grid grid-cols-3 gap-2.5">
            {roles.map((r) => {
              const selected = role === r.value
              return (
                <label
                  key={r.value}
                  className={`group relative cursor-pointer rounded-2xl border p-3 text-center transition ${
                    selected
                      ? 'border-brand-500 bg-brand-50/70 shadow-sm shadow-brand-500/10 ring-2 ring-brand-500/20'
                      : 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <input type="radio" value={r.value} className="sr-only" {...register('role')} />
                  <span
                    className={`mx-auto flex size-10 items-center justify-center rounded-xl transition ${
                      selected
                        ? 'bg-gradient-to-br from-brand-500 to-emerald-600 text-white shadow-sm shadow-brand-600/30'
                        : 'bg-neutral-100 text-neutral-500 group-hover:bg-brand-100 group-hover:text-brand-700'
                    }`}
                  >
                    <r.icon className="size-5" />
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
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-neutral-700">Full name</label>
          <input id="fullName" autoComplete="name" className={inputClass} placeholder="Your name" {...register('fullName')} />
          {errors.fullName && <p className="mt-1 text-xs font-medium text-red-600">{errors.fullName.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">Email</label>
            <input id="email" type="email" autoComplete="email" className={inputClass} placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs font-medium text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-700">Phone (optional)</label>
            <input id="phone" type="tel" autoComplete="tel" className={inputClass} placeholder="+91 …" {...register('phone')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">Password</label>
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
            {errors.password && <p className="mt-1 text-xs font-medium text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">Confirm password</label>
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
            {errors.confirmPassword && <p className="mt-1 text-xs font-medium text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        {role === 'DONOR' && (
          <div className="space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Organization details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="organizationName" className="mb-1.5 block text-sm font-medium text-neutral-700">Organization name</label>
                <input
                  id="organizationName"
                  className={inputClass}
                  placeholder="Green Kitchen"
                  {...register('donor.organizationName')}
                />
                {errors.donor?.organizationName && <p className="mt-1 text-xs font-medium text-red-600">{errors.donor.organizationName.message}</p>}
              </div>
              <div>
                <label htmlFor="organizationType" className="mb-1.5 block text-sm font-medium text-neutral-700">Organization type</label>
                <input
                  id="organizationType"
                  className={inputClass}
                  placeholder="Restaurant / Grocery / Caterer"
                  {...register('donor.organizationType')}
                />
                {errors.donor?.organizationType && <p className="mt-1 text-xs font-medium text-red-600">{errors.donor.organizationType.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-neutral-700">Address</label>
                <input
                  id="address"
                  className={inputClass}
                  placeholder="Street address"
                  {...register('donor.address')}
                />
                {errors.donor?.address && <p className="mt-1 text-xs font-medium text-red-600">{errors.donor.address.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-neutral-700">City</label>
                  <input
                    id="city"
                    className={inputClass}
                    placeholder="Mumbai"
                    {...register('donor.city')}
                  />
                  {errors.donor?.city && <p className="mt-1 text-xs font-medium text-red-600">{errors.donor.city.message}</p>}
                </div>
                <div>
                  <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-neutral-700">State</label>
                  <input
                    id="state"
                    className={inputClass}
                    placeholder="Maharashtra"
                    {...register('donor.state')}
                  />
                  {errors.donor?.state && <p className="mt-1 text-xs font-medium text-red-600">{errors.donor.state.message}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {role === 'NGO' && (
          <div className="space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Organization details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ngoName" className="mb-1.5 block text-sm font-medium text-neutral-700">NGO name</label>
                <input
                  id="ngoName"
                  className={inputClass}
                  placeholder="Food Bank Foundation"
                  {...register('ngo.ngoName')}
                />
                {errors.ngo?.ngoName && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.ngoName.message}</p>}
              </div>
              <div>
                <label htmlFor="registrationNumber" className="mb-1.5 block text-sm font-medium text-neutral-700">Registration number</label>
                <input
                  id="registrationNumber"
                  className={inputClass}
                  placeholder="Reg. no."
                  {...register('ngo.registrationNumber')}
                />
                {errors.ngo?.registrationNumber && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.registrationNumber.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ngoAddress" className="mb-1.5 block text-sm font-medium text-neutral-700">Address</label>
                <input
                  id="ngoAddress"
                  className={inputClass}
                  placeholder="Street address"
                  {...register('ngo.address')}
                />
                {errors.ngo?.address && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.address.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ngoCity" className="mb-1.5 block text-sm font-medium text-neutral-700">City</label>
                  <input
                    id="ngoCity"
                    className={inputClass}
                    placeholder="Mumbai"
                    {...register('ngo.city')}
                  />
                  {errors.ngo?.city && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.city.message}</p>}
                </div>
                <div>
                  <label htmlFor="ngoState" className="mb-1.5 block text-sm font-medium text-neutral-700">State</label>
                  <input
                    id="ngoState"
                    className={inputClass}
                    placeholder="Maharashtra"
                    {...register('ngo.state')}
                  />
                  {errors.ngo?.state && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.state.message}</p>}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ngoDescription" className="mb-1.5 block text-sm font-medium text-neutral-700">Description (optional)</label>
              <textarea
                id="ngoDescription"
                rows={2}
                className={inputClass}
                placeholder="What your NGO does"
                {...register('ngo.description')}
              />
              {errors.ngo?.description && <p className="mt-1 text-xs font-medium text-red-600">{errors.ngo.description.message}</p>}
            </div>
          </div>
        )}

        {role === 'VOLUNTEER' && (
          <div className="space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Delivery details (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="vehicleType" className="mb-1.5 block text-sm font-medium text-neutral-700">Vehicle type</label>
                <input
                  id="vehicleType"
                  className={inputClass}
                  placeholder="Bike / Car"
                  {...register('volunteer.vehicleType')}
                />
              </div>
              <div>
                <label htmlFor="vehicleNumber" className="mb-1.5 block text-sm font-medium text-neutral-700">Vehicle number</label>
                <input
                  id="vehicleNumber"
                  className={inputClass}
                  placeholder="MH 01 AB 1234"
                  {...register('volunteer.vehicleNumber')}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:from-brand-700 hover:to-emerald-700 hover:shadow-lg hover:shadow-brand-600/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 transition hover:text-brand-800 hover:underline">
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
