import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Loader2, LocateFixed, MapPin, Save, Store } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { fetchMe } from '@/api/auth'
import { updateDonorProfile } from '@/api/donor'
import DashboardShell from '@/components/layout/DashboardShell'
import { LocationPinMap } from '@/components/maps/LocationPinMap'
import { RescueAlertsToggleCard } from '@/components/preferences/RescueAlertsToggleCard'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useReverseGeocode } from '@/hooks/useReverseGeocode'
import { donorNav } from '@/pages/donor/nav'
import type { DonorProfile } from '@/types/user'

const profileSchema = z
  .object({
    organizationName: z.string().trim().min(1, 'Required').max(150),
    organizationType: z.string().trim().min(1, 'Required').max(100),
    address: z.string().trim().min(1, 'Required').max(250),
    city: z.string().trim().min(1, 'Required').max(100),
    state: z.string().trim().min(1, 'Required').max(100),
    latitude: z
      .string()
      .refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90), 'Latitude must be between -90 and 90'),
    longitude: z
      .string()
      .refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180), 'Longitude must be between -180 and 180'),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((data) => (data.latitude.trim() === '') === (data.longitude.trim() === ''), {
    message: 'Set both latitude and longitude (or use “Use my location”).',
    path: ['longitude'],
  })

type ProfileFormValues = z.infer<typeof profileSchema>

const emptyForm: ProfileFormValues = {
  organizationName: '',
  organizationType: '',
  address: '',
  city: '',
  state: '',
  latitude: '',
  longitude: '',
  description: '',
}

function toFormValues(donor: DonorProfile): ProfileFormValues {
  return {
    organizationName: donor.organizationName ?? '',
    organizationType: donor.organizationType ?? '',
    address: donor.address ?? '',
    city: donor.city ?? '',
    state: donor.state ?? '',
    latitude: donor.latitude != null ? String(donor.latitude) : '',
    longitude: donor.longitude != null ? String(donor.longitude) : '',
    description: donor.description ?? '',
  }
}

export default function DonorProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<DonorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const geo = useGeolocation()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyForm,
  })

  const geoCode = useReverseGeocode()
  const lastLookup = useRef('')

  /** Reverse-geocodes a pin and auto-fills the address/city/state fields. */
  const fillPlaceFromCoords = useCallback(
    async (lat: number, lng: number) => {
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
      if (lastLookup.current === key) return
      lastLookup.current = key
      const place = await geoCode.lookup(lat, lng)
      if (!place) return
      setValue('address', place.address, { shouldDirty: true })
      setValue('city', place.city, { shouldDirty: true })
      setValue('state', place.state, { shouldDirty: true })
    },
    // geoCode.lookup is stable — depending on the whole object would recreate
    // this callback every render and re-run the geolocation effect in a loop.
    [geoCode.lookup, setValue],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { user } = await fetchMe()
      if (!user.donor) {
        setError('Donor profile not found — complete your registration first.')
        return
      }
      setProfile(user.donor)
      setAlertsEnabled(user.locationAlertsEnabled ?? true)
      reset(toFormValues(user.donor))
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Failed to load your profile',
      )
    } finally {
      setLoading(false)
    }
  }, [reset])

  useEffect(() => {
    load()
  }, [load])

  // Drop the freshly-located pin into the form fields and auto-fill the place.
  useEffect(() => {
    if (!geo.coords) return
    setValue('latitude', geo.coords.latitude.toFixed(6), { shouldDirty: true })
    setValue('longitude', geo.coords.longitude.toFixed(6), { shouldDirty: true })
    void fillPlaceFromCoords(geo.coords.latitude, geo.coords.longitude)
  }, [geo.coords, setValue, fillPlaceFromCoords])

  /** Manual coordinate entry → auto-fill the place on blur. */
  const handleCoordsBlur = () => {
    const latStr = getValues('latitude').trim()
    const lngStr = getValues('longitude').trim()
    if (latStr === '' || lngStr === '') return
    const lat = Number(latStr)
    const lng = Number(lngStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    void fillPlaceFromCoords(lat, lng)
  }

  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true)
    try {
      const hasPin = values.latitude.trim() !== '' && values.longitude.trim() !== ''
      const { donor } = await updateDonorProfile({
        organizationName: values.organizationName,
        organizationType: values.organizationType,
        address: values.address,
        city: values.city,
        state: values.state,
        // Clearing both inputs removes the pin (null is a valid clear).
        latitude: hasPin ? Number(values.latitude) : null,
        longitude: hasPin ? Number(values.longitude) : null,
        description: values.description || null,
      })
      setProfile(donor)
      reset(toFormValues(donor))
      toast({
        variant: 'success',
        title: 'Profile updated',
        description:
          donor.latitude != null && donor.longitude != null
            ? 'Your location is set — listings without a pin can now be found nearby.'
            : 'Your profile details were saved.',
      })
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not save',
        description:
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
          'Something went wrong — try again',
      })
    } finally {
      setSaving(false)
    }
  }

  const watchedLatitude = watch('latitude')
  const watchedLongitude = watch('longitude')
  const hasPin = watchedLatitude.trim() !== '' && watchedLongitude.trim() !== ''
  const previewCenter = hasPin ? { latitude: Number(watchedLatitude), longitude: Number(watchedLongitude) } : null

  const form = (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* Left: organization details */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization details</CardTitle>
            <CardDescription>Shown to NGOs and volunteers when they claim your food.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Organization name *"
                placeholder="e.g. Spice House Restaurant"
                {...register('organizationName')}
                error={errors.organizationName?.message}
              />
            </div>
            <Input
              label="Organization type *"
              placeholder="e.g. Restaurant, Grocery, Caterer"
              {...register('organizationType')}
              error={errors.organizationType?.message}
            />
            <div className="sm:col-span-2">
              <Input label="Street address *" placeholder="Building, street, area" {...register('address')} error={errors.address?.message} />
            </div>
            <Input label="City *" placeholder="e.g. Bengaluru" {...register('city')} error={errors.city?.message} />
            <Input label="State *" placeholder="e.g. Karnataka" {...register('state')} error={errors.state?.message} />
            <div className="sm:col-span-2">
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-neutral-700">
                About your organization
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="What you donate, typical surplus times, pickup instructions…"
                className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                {...register('description')}
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
            <Button type="submit" disabled={saving || !isDirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save changes
            </Button>
            {!isDirty && <p className="text-xs text-neutral-400">No changes yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Right: location pin */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-brand-600" />
              <CardTitle>Your location</CardTitle>
            </div>
            <CardDescription>
              This pin helps NGOs nearby find you — and backs listings that don&apos;t carry their own coordinates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                {...register('latitude', { onBlur: handleCoordsBlur })}
                error={errors.latitude?.message}
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="e.g. 77.5946"
                {...register('longitude', { onBlur: handleCoordsBlur })}
                error={errors.longitude?.message}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full"
              onClick={geo.locate}
              disabled={geo.loading || !geo.supported}
            >
              {geo.loading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              {geo.loading ? 'Locating…' : 'Use my location'}
            </Button>

            {geo.error && <p className="mt-2 text-xs leading-relaxed text-amber-600">{geo.error}</p>}
            {geo.coords?.accuracy != null && <p className="mt-2 text-xs text-neutral-500">Accuracy ±{Math.round(geo.coords.accuracy)} m</p>}
            {geoCode.loading && <p className="mt-2 text-xs text-neutral-500">Detecting place name…</p>}
            {geoCode.error && <p className="mt-2 text-xs leading-relaxed text-amber-600">{geoCode.error}</p>}
            {geoCode.place && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                ✓ Auto-filled:{' '}
                {[geoCode.place.address, geoCode.place.city, geoCode.place.state].filter(Boolean).join(', ')}
              </p>
            )}

            <div className="mt-4">
              {previewCenter ? (
                <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200">
                  <LocationPinMap center={previewCenter} label={profile?.organizationName ?? 'Your location'} />
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
                  <MapPin className="size-5 text-neutral-400" />
                  <p className="mt-2 text-xs text-neutral-500">Your pin previews here.</p>
                </div>
              )}
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                {hasPin
                  ? 'This is where the nearby search measures from. You can also type coordinates above.'
                  : 'Set your pin so NGOs near you can find your surplus.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Phase 46 — privacy opt-out for location-based rescue alerts (spec §9). */}
        <RescueAlertsToggleCard enabled={alertsEnabled} />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="size-4 text-brand-600" />
              <CardTitle>Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-neutral-500">
              Your organization details and location pin live here and stay in sync with your dashboard automatically.
            </p>
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-brand-800">
              <Building2 className="mt-0.5 size-4 shrink-0" />
              Add coordinates when listing a donation to make it visible to NGOs instantly.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  )

  return (
    <DashboardShell roleLabel="Donor" nav={donorNav} title="Donor profile" subtitle="Organization details and your location pin">
      {loading ? (
        <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardContent className="space-y-5 py-6">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-5 py-6">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <ErrorState description={error} error={error} onRetry={load} />
      ) : (
        form
      )}
    </DashboardShell>
  )
}
