import { api } from './client'

export interface UserPreferences {
  /** When false, the rescue sweep never sends location-based "food needs rescue" alerts. */
  locationAlertsEnabled: boolean
}

/** GET /v1/users/preferences — current notification preferences. */
export async function fetchUserPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<{ preferences: UserPreferences }>('/v1/users/preferences')
  return data.preferences
}

/** PATCH /v1/users/preferences — update notification preferences. */
export async function updateUserPreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  const { data } = await api.patch<{ preferences: UserPreferences }>('/v1/users/preferences', patch)
  return data.preferences
}