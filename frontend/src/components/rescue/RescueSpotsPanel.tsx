import { Clock, HandHeart, MapPin, Navigation } from 'lucide-react'

import type { RescueSpot, RescueSpotsResponse } from '@/api/volunteer'
import { RescueSpotsMap, SPOT_EMOJI } from '@/components/maps/RescueSpotsMap'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

const SPOT_TONE: Record<RescueSpot['type'], string> = {
  railway_station: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  bus_stand: 'bg-sky-50 text-sky-700 ring-sky-200',
  homeless_shelter: 'bg-rose-50 text-rose-700 ring-rose-200',
  worship: 'bg-violet-50 text-violet-700 ring-violet-200',
  community_centre: 'bg-teal-50 text-teal-700 ring-teal-200',
}

const LEGEND: Array<{ type: RescueSpot['type']; label: string }> = [
  { type: 'railway_station', label: 'Railway station' },
  { type: 'bus_stand', label: 'Bus stand' },
  { type: 'homeless_shelter', label: 'Shelter' },
  { type: 'worship', label: 'Worship place' },
  { type: 'community_centre', label: 'Community centre' },
]

/** \"2026-08-12T12:00:00Z\" → \"3h left\" / \"Expiring now\". */
function expiryLabel(expiryTime: string | null): string | null {
  if (!expiryTime) return null
  const hours = Math.max(0, Math.round((new Date(expiryTime).getTime() - Date.now()) / 3_600_000))
  return hours === 0 ? 'Expiring now' : `${hours}h left`
}

/**
 * Phase 45 — the rescue mission card shown on the volunteer dashboard after a
 * rescue alert is accepted: the donor pickup location, the nearby railway
 * stations / bus stands / homeless-gathering spots, and each spot's address
 * with a direct Google Maps link so the volunteer can go pick up and hand out.
 */
export default function RescueSpotsPanel({ data }: { data: RescueSpotsResponse }) {
  const { donation, pickup, pickupMapsUrl, spots } = data

  return (
    <Card id="rescue-panel" className="mt-6 overflow-hidden">
      <CardHeader className="border-b border-neutral-100 bg-gradient-to-r from-amber-50 via-white to-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <HandHeart className="size-5" />
            </span>
            <div>
              <CardTitle>Rescue &amp; handout spots</CardTitle>
              <CardDescription>
                Where to pick up the food and hand it out nearby — people in need gather at these places
              </CardDescription>
            </div>
          </div>
        </div>
        {donation && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Clock className="size-3" />
            {expiryLabel(donation.expiryTime) ?? 'Rescue mission'}
          </span>
        )}
      </CardHeader>

      <CardContent className="pt-5">
        {donation && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-neutral-900">{donation.foodName}</span>
            <span className="text-neutral-500">
              {donation.quantity} {donation.unit} · {donation.donorOrganization}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
              <MapPin className="size-3.5 text-brand-600" />
              {donation.pickupAddress}
            </span>
            {pickupMapsUrl && (
              <a
                href={pickupMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                <Navigation className="size-3.5" />
                Open pickup in Maps
              </a>
            )}
          </div>
        )}

        {!pickup ? (
          <EmptyState
            icon={MapPin}
            title="No rescue location"
            description="This donation has no location pin — ask the donor for the pickup address first."
            className="py-10"
          />
        ) : spots.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No handout spots found nearby"
            description="We couldn't find railway stations, bus stands or shelters within 5 km. Try opening the pickup address in Google Maps to scout the area."
            className="py-10"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Map — donor pin + handout spots */}
            <div className="lg:col-span-3">
              <RescueSpotsMap
                pickup={pickup}
                pickupLabel={donation?.donorOrganization ?? 'Donor pickup'}
                spots={spots}
              />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {LEGEND.map((item) => (
                  <span key={item.type} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
                    <span className="text-sm leading-none">{SPOT_EMOJI[item.type]}</span>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Spot list with addresses */}
            <div className="lg:col-span-2">
              <ul className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
                {spots.map((spot) => (
                  <li
                    key={`${spot.type}-${spot.latitude}-${spot.longitude}`}
                    className="rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-lg leading-none">{SPOT_EMOJI[spot.type]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-neutral-900">{spot.name}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${SPOT_TONE[spot.type]}`}>
                            {spot.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">{spot.distanceKm} km from pickup</p>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                          {spot.address ?? 'Address not mapped — use directions below'}
                        </p>
                        <a
                          href={spot.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-700"
                        >
                          <Navigation className="size-3.5" />
                          Get directions
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Skeleton shown while the rescue map for the accepted alert is loading. */
export function RescueSpotsPanelSkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}
