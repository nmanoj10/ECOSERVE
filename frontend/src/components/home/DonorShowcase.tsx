import { useEffect, useRef, useState } from 'react'

import { fetchPublicDonors } from '@/api/donor'
import { Skeleton } from '@/components/ui/Skeleton'

interface DonorShowcaseItem {
  id: string
  organizationName: string
  organizationType: string
  city: string
  state: string
  logoUrl: string
  description: string | null
}

/**
 * Moving marquee of donor logos — shows restaurants/organizations that contribute
 * to the platform. Logos scroll infinitely from right to left.
 */
export function DonorShowcase() {
  const [donors, setDonors] = useState<DonorShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Fetch donors on mount
  useEffect(() => {
    let cancelled = false
    fetchPublicDonors()
      .then(({ donors }) => {
        if (!cancelled) setDonors(donors)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load contributors')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clone the array for seamless infinite scroll
  const items = [...donors, ...donors]

  if (loading) {
    return (
      <section className="py-12 bg-brand-50" aria-label="Our contributors">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">Our Contributors</h2>
            <p className="mt-2 text-neutral-600">Restaurants & organizations helping feed those in need</p>
          </div>
          <div className="overflow-hidden" role="list" aria-label="Donor logos loading">
            <div className="flex gap-8" style={{ animation: 'marquee 20s linear infinite' }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 h-20">
                  <Skeleton className="size-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (error || donors.length === 0) {
    return (
      <section className="py-12 bg-brand-50" aria-label="Our contributors">
        <div className="mx-auto max-w-screen-2xl px-4 text-center">
          <svg className="mx-auto size-12 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-neutral-700">No contributors yet</h3>
          <p className="mt-2 text-neutral-500">
            Be the first restaurant to join EcoServe and help feed communities!
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 bg-brand-50" aria-label="Our contributors">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg className="size-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <h2 className="text-2xl font-bold text-neutral-900">Our Contributors</h2>
          </div>
          <p className="text-neutral-600">Restaurants & organizations helping feed those in need</p>
        </div>

        <div className="relative overflow-hidden">
          {/* Gradient fade on left */}
          <div
            className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-brand-50 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          {/* Gradient fade on right */}
          <div
            className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-brand-50 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          <div
            ref={trackRef}
            className="flex gap-8"
            style={{
              animation: 'marquee 30s linear infinite',
              width: 'max-content',
            }}
            role="list"
            aria-label="Donor logos"
            onMouseEnter={(e) => {
              e.currentTarget.style.animationPlayState = 'paused'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.animationPlayState = 'running'
            }}
          >
            {items.map((donor, index) => (
              <div
                key={`${donor.id}-${index}`}
                className="flex-shrink-0 w-40 h-20 flex flex-col items-center gap-2 group"
                role="listitem"
              >
                <div className="relative w-full h-16 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:scale-105">
                  <img
                    src={donor.logoUrl}
                    alt={`${donor.organizationName} - contributing to EcoServe`}
                    className="size-full object-contain p-2"
                    loading="lazy"
                  />
                </div>
                <div className="w-full text-center">
                  <p className="text-xs font-medium text-neutral-900 truncate">{donor.organizationName}</p>
                  <p className="text-[10px] text-neutral-500 truncate">
                    {donor.city}, {donor.state}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inject keyframes once */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `,
        }}
      />
    </section>
  )
}

export default DonorShowcase