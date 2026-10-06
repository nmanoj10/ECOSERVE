import { Bell, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { updateUserPreferences } from '@/api/user'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

/**
 * Phase 46 — privacy opt-out card (spec §9): donors and volunteers can turn off
 * location-based rescue alerts while keeping ordinary notifications. The switch
 * persists instantly via PATCH /v1/users/preferences. The backend rescue sweep
 * already filters on this flag, so nothing here is cosmetic.
 */
export function RescueAlertsToggleCard({ enabled }: { enabled: boolean }) {
  const { toast } = useToast()
  const [optIn, setOptIn] = useState(enabled)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !optIn
    setOptIn(next)
    setSaving(true)
    try {
      await updateUserPreferences({ locationAlertsEnabled: next })
      toast({
        variant: 'success',
        title: next ? 'Rescue alerts enabled' : 'Rescue alerts paused',
        description: next
          ? 'You\u2019ll get pinged when surplus food near you needs rescuing.'
          : 'No more location-based rescue alerts. Account and delivery updates continue normally.',
      })
    } catch {
      setOptIn(!next)
      toast({ variant: 'error', title: 'Could not save preference', description: 'Something went wrong — try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-brand-600" />
          <CardTitle>Rescue alerts</CardTitle>
        </div>
        <CardDescription>Location-based alerts when food near you is about to expire.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">{optIn ? 'Enabled' : 'Paused'}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              {optIn
                ? 'You\u2019ll be offered rescue missions nearby. Your exact location is never shown publicly.'
                : 'You won\u2019t get location-based rescue alerts. You can re-enable any time.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={optIn}
            aria-label="Toggle location-based rescue alerts"
            disabled={saving}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-wait disabled:opacity-60 ${
              optIn ? 'bg-brand-600' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white shadow transition ${
                optIn ? 'translate-x-6' : 'translate-x-1'
              }`}
            >
              {saving && <Loader2 className="size-4 animate-spin text-neutral-400" />}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}