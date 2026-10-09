import { zodResolver } from '@hookform/resolvers/zod'
import { Bike, Loader2, LocateFixed, MapPin, Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { fetchMe } from '@/api/auth'
import { updateVolunteerProfile, type VolunteerAvailability } from '@/api/volunteer'
import DashboardShell from '@/components/layout/DashboardShell'
import { LocationPinMap } from '@/components/maps/LocationPinMap'
import { RescueAlertsToggleCard } from '@/components/preferences/RescueAlertsToggleCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useReverseGeocode } from '@/hooks/useReverseGeocode'
import { volunteerNav } from '@/pages/volunteer/nav'
import type { VolunteerProfile } from '@/types/user'

const availabilityOptions: Array<{ value: VolunteerAvailability; label: string }> = [
  { value: 'AVAILABLE', label: 'Available — ready for pickups' },
  { value: 'BUSY', label: 'Busy — currently on a run' },
  { value: 'OFFLINE', label: 'Offline — not accepting work' },
]

const profileSchema = z
  .object({
    vehicleType: z.string().trim().max(50).optional(),
    vehicleNumber: z.string().trim().max(20).optional(),
    availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']),
    currentLatitude: z
      .string()
      .refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90), 'Latitude must be between -90 and 90'),
    currentLongitude: z
      .string()
      .refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180), 'Longitude must be between -180 and 180'),
  })
  .refine((data) => (data.currentLatitude.trim() === '') === (data.currentLongitude.trim() === ''), {
    message: 'Set both latitude and longitude (or use “Use my location”).',
    path: ['currentLongitude'],
  })

type ProfileFormValues = z.infer<typeof profileSchema>

const emptyForm: ProfileFormValues = {
  vehicleType: '',
  vehicleNumber: '',
  availability: 'OFFLINE',
  currentLatitude: '',
  currentLongitude: '',
}

function toFormValues(volunteer: VolunteerProfile): ProfileFormValues {
  return {
    vehicleType: volunteer.vehicleType ?? '',
    vehicleNumber: volunteer.vehicleNumber ?? '',
    availability: (volunteer.availability as VolunteerAvailability) ?? 'OFFLINE',
    currentLatitude: volunteer.currentLatitude != null ? String(volunteer.currentLatitude) : '',
    currentLongitude: volunteer.currentLongitude != null ? String(volunteer.currentLongitude) : '',
  }
}

export default function VolunteerProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<VolunteerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const geo = useGeolocation()
  const geoCode = useReverseGeocode()
  const lastLookup = useRef('')

  /** Reverse-geocodes a pin and updates the detected-place display. */
  const lookupPlace = useCallback(
    async (lat: number, lng: number) => {
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
      if (lastLookup.current === key) return
      lastLookup.current = key
      await geoCode.lookup(lat, lng)
    },
    // geoCode.lookup is stable — depending on the whole object would recreate
    // this callback every render and re-run the geolocation effect in a loop.
    [geoCode.lookup],
  )

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { user } = await fetchMe()
      if (!user.volunteer) {
        setError('Volunteer profile not found — complete your registration first.')
        return
      }
      setProfile(user.volunteer)
      setAlertsEnabled(user.locationAlertsEnabled ?? true)
      reset(toFormValues(user.volunteer))
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

  // Drop the freshly-located pin into the form fields and show its place.
  useEffect(() => {
    if (!geo.coords) return
    setValue('currentLatitude', geo.coords.latitude.toFixed(6), { shouldDirty: true })
    setValue('currentLongitude', geo.coords.longitude.toFixed(6), { shouldDirty: true })
    void lookupPlace(geo.coords.latitude, geo.coords.longitude)
  }, [geo.coords, setValue, lookupPlace])

  /** Manual coordinate entry → refresh the detected place on blur. */
  const handleCoordsBlur = () => {
    const latStr = getValues('currentLatitude').trim()
    const lngStr = getValues('currentLongitude').trim()
    if (latStr === '' || lngStr === '') return
    const lat = Number(latStr)
    const lng = Number(lngStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    void lookupPlace(lat, lng)
  }

  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true)
    try {
      const hasPin = values.currentLatitude.trim() !== '' && values.currentLongitude.trim() !== ''
      const { volunteer } = await updateVolunteerProfile({
        vehicleType: (values.vehicleType ?? '').trim() !== '' ? values.vehicleType : null,
        vehicleNumber: (values.vehicleNumber ?? '').trim() !== '' ? values.vehicleNumber : null,
        availability: values.availability,
        // Clearing both inputs removes the pin (null is a valid clear).
        currentLatitude: hasPin ? Number(values.currentLatitude) : null,
        currentLongitude: hasPin ? Number(values.currentLongitude) : null,
      })
      setProfile(volunteer)
      reset(toFormValues(volunteer))
      toast({
        variant: 'success',
        title: 'Profile updated',
        description:
          volunteer.currentLatitude != null && volunteer.currentLongitude != null
            ? 'Your location is set — rescue alerts now match you by proximity.'
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

  const watchedLatitude = watch('currentLatitude')
  const watchedLongitude = watch('currentLongitude')
  const hasPin = watchedLatitude.trim() !== '' && watchedLongitude.trim() !== ''
  const previewCenter = hasPin ? { latitude: Number(watchedLatitude), longitude: Number(watchedLongitude) } : null

  const form = (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
      {/* Left: profile details */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>Your vehicle and availability, shown to the delivery coordinator.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Vehicle type"
              placeholder="e.g. Bike, Car, Cargo van"
              {...register('vehicleType')}
              error={errors.vehicleType?.message}
              hint="Optional — helps match you to suitable pickups."
            />
            <Input
              label="Vehicle number"
              placeholder="e.g. KA 01 AB 1234"
              {...register('vehicleNumber')}
              error={errors.vehicleNumber?.message}
            />
            <div className="sm:col-span-2">
              <Select label="Availability" error={errors.availability?.message} {...register('availability')}>
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-neutral-500">
                Rescue alerts only go to volunteers marked available.
              </p>
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
              This is where rescue alerts look for volunteers nearby. Update it as you move around.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                {...register('currentLatitude', { onBlur: handleCoordsBlur })}
                error={errors.currentLatitude?.message}
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="e.g. 77.5946"
                {...register('currentLongitude', { onBlur: handleCoordsBlur })}
                error={errors.currentLongitude?.message}
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
              <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-neutral-700">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                Detected place:{' '}
                {[geoCode.place.address, geoCode.place.city, geoCode.place.state].filter(Boolean).join(', ')}
              </p>
            )}

            <div className="mt-4">
              {previewCenter ? (
                <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200">
                  <LocationPinMap center={previewCenter} label="Your location" />
                </div>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
                  <MapPin className="size-5 text-neutral-400" />
                  <p className="mt-2 text-xs text-neutral-500">Your pin previews here.</p>
                </div>
              )}
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                {hasPin
                  ? 'Rescue matching measures from this pin. You can also type coordinates above.'
                  : 'Set your pin to get matched to rescue requests near you.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Phase 46 — privacy opt-out for location-based rescue alerts (spec §9). */}
        <RescueAlertsToggleCard enabled={alertsEnabled} />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bike className="size-4 text-brand-600" />
              <CardTitle>Deliveries</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant={profile?.availability === 'AVAILABLE' ? 'success' : profile?.availability === 'BUSY' ? 'warning' : 'neutral'} dot>
              {profile?.availability ?? '—'}
            </Badge>
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              You&apos;ve completed {profile?.totalDeliveries ?? 0} deliveries with a rating of{' '}
              {profile?.rating != null ? `${profile.rating.toFixed(1)} / 5` : '—'}.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  )

  return (
    <DashboardShell roleLabel="Volunteer" nav={volunteerNav} title="Volunteer profile" subtitle="Vehicle details and your live location">
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
