/**
 * Address auto-fill resolution — the `useReverseGeocode` hook turns a pin
 * (browser geolocation or a map click) into Address / City / State values that
 * the donor / NGO / volunteer profile pages auto-fill into their forms.
 *
 * (The registration page no longer auto-fills; the feature moved to the
 * profile pages, which all consume this hook.)
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useReverseGeocode } from '@/hooks/useReverseGeocode'
import { reverseGeocode } from '@/api/geo'

vi.mock('@/api/geo', () => ({ reverseGeocode: vi.fn() }))

const mockedReverseGeocode = vi.mocked(reverseGeocode)

function Harness() {
  const { place, loading, error, lookup } = useReverseGeocode()
  return (
    <div>
      <button type="button" onClick={() => lookup(19.076, 72.8777)}>
        Detect
      </button>
      {loading && <div>Loading…</div>}
      {error && <div role="alert">{error}</div>}
      {place && (
        <dl>
          <dt>Address</dt>
          <dd>{place.address}</dd>
          <dt>City</dt>
          <dd>{place.city}</dd>
          <dt>State</dt>
          <dd>{place.state}</dd>
        </dl>
      )}
    </div>
  )
}

describe('useReverseGeocode', () => {
  it('resolves coordinates into the auto-fill fields', async () => {
    const user = userEvent.setup()
    mockedReverseGeocode.mockResolvedValue({
      place: { address: '123, MG Road', city: 'Mumbai', state: 'Maharashtra' },
    })

    render(<Harness />)
    await user.click(screen.getByText('Detect'))

    await waitFor(() => {
      expect(screen.getByText('123, MG Road')).toBeInTheDocument()
    })
    expect(screen.getByText('Mumbai')).toBeInTheDocument()
    expect(screen.getByText('Maharashtra')).toBeInTheDocument()
    expect(mockedReverseGeocode).toHaveBeenCalledWith(19.076, 72.8777)
  })

  it('surfaces an error message when the reverse geocode fails', async () => {
    const user = userEvent.setup()
    mockedReverseGeocode.mockRejectedValue(new Error('upstream down'))

    render(<Harness />)
    await user.click(screen.getByText('Detect'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not detect the place name/i)
    })
  })

  it('clears the previous place when the lookup is undetectable (place: null)', async () => {
    const user = userEvent.setup()
    mockedReverseGeocode.mockResolvedValue({ place: null })

    render(<Harness />)
    await user.click(screen.getByText('Detect'))

    await waitFor(() => {
      expect(screen.queryByText('Address')).not.toBeInTheDocument()
    })
  })
})
